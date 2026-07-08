<template>
  <div class="pc-page">

    <!-- ══ Hero Header ══ -->
    <div class="pc-hero">
      <button class="pc-back" @click="$router.back()">← กลับ</button>
      <div class="pc-hero-content">
        <div class="pc-avatar-wrap">
          <img v-if="child?.photo_url" :src="fixPhotoUrl(child.photo_url)" class="pc-avatar-img" @error="e=>e.target.style.display='none'" />
          <div v-else class="pc-avatar-initial">{{ (child?.name||'?').charAt(0) }}</div>
        </div>
        <div class="pc-hero-info">
          <div class="pc-hero-name">{{ child?.prefix }}{{ child?.name }} {{ child?.surname }}</div>
          <div class="pc-hero-meta">
            <span class="pc-hero-badge">{{ child?.class_id }}</span>
            <span class="pc-hero-badge">เลขที่ {{ child?.seat_number }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ Tab bar ══ -->
    <div class="pc-tabbar">
      <button
        v-for="tab in TABS" :key="tab.key"
        class="pc-tab"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <span class="pc-tab-icon">{{ tab.icon }}</span>
        <span class="pc-tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- ══════════ TAB: มาเรียน ══════════ -->
    <div v-if="activeTab === 'attendance'" class="pc-body" v-loading="loadingAtt">

      <!-- TTS -->
      <button class="pc-tts-btn" @click="speakAttendance">
        <span class="pc-tts-icon">🔊</span>
        <span>ฟังสรุปการมาเรียน</span>
      </button>

      <!-- Period pills -->
      <div class="pc-pills">
        <button
          v-for="p in PERIODS" :key="p.key"
          class="pc-pill"
          :class="{ active: attPeriod === p.key }"
          @click="attPeriod = p.key"
        >{{ p.label }}</button>
      </div>

      <!-- Custom date range -->
      <div v-if="attPeriod === 'custom'" class="pc-date-card">
        <div class="pc-date-row">
          <label class="pc-date-lbl">จาก</label>
          <input type="date" class="pc-date-input" v-model="customFrom" :max="customTo" />
          <label class="pc-date-lbl">ถึง</label>
          <input type="date" class="pc-date-input" v-model="customTo" :min="customFrom" :max="todayStr()" />
        </div>
        <button class="pc-search-btn" @click="loadAttendanceCustom" :disabled="loadingAtt">
          {{ loadingAtt ? 'กำลังโหลด...' : '🔍 ดูข้อมูล' }}
        </button>
      </div>

      <!-- Stat cards: total + 4 รวมใน grid เดียว -->
      <div class="pc-card-grid">
        <div class="pc-card pc-card-total">
          <div class="pc-card-num">{{ attSummary.total }}</div>
          <div class="pc-card-lbl">📚 ทั้งหมด</div>
        </div>
        <div class="pc-card pc-card-present">
          <div class="pc-card-num">{{ attSummary.present }}</div>
          <div class="pc-card-lbl">✅ มาเรียน</div>
        </div>
        <div class="pc-card pc-card-late">
          <div class="pc-card-num">{{ attSummary.late }}</div>
          <div class="pc-card-lbl">⏰ มาสาย</div>
        </div>
        <div class="pc-card pc-card-absent">
          <div class="pc-card-num">{{ attSummary.absent }}</div>
          <div class="pc-card-lbl">❌ ขาด</div>
        </div>
        <div class="pc-card pc-card-leave">
          <div class="pc-card-num">{{ attSummary.leave }}</div>
          <div class="pc-card-lbl">📋 ลา</div>
        </div>
        <div v-if="attSummary.unrecorded > 0" class="pc-card pc-card-pending pc-card-full">
          <div class="pc-card-num">{{ attSummary.unrecorded }}</div>
          <div class="pc-card-lbl">🔘 ยังไม่บันทึก</div>
        </div>
      </div>

      <!-- Daily records -->
      <div class="pc-day-list">
        <div v-if="!filteredRecordsByDate.length" class="pc-empty">ยังไม่มีข้อมูล</div>
        <div v-for="day in filteredRecordsByDate" :key="day.date" class="pc-day-card">
          <div class="pc-day-head">
            <span>{{ formatThaiDate(day.date) }}</span>
            <span v-if="day.isLate" class="pc-late-chip">⏰ มาสาย</span>
          </div>
          <div v-for="r in day.records" :key="r.period" class="pc-rec" :class="rowBorderClass(r.status, r.period)">
            <span class="pc-rec-period">{{ r.period }}</span>
            <span class="pc-rec-icon">{{ statusIcon(r.status, r.period) }}</span>
            <span class="pc-rec-subj">
              {{ r.subject || `คาบ ${r.period}` }}
              <small v-if="r.teacher" class="pc-rec-teacher">{{ r.teacher }}</small>
            </span>
            <span class="pc-rec-status" :class="statusClass(r.status, r.period)">{{ r.status }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ TAB: คะแนน ══════════ -->
    <div v-else-if="activeTab === 'scores'" class="pc-body" v-loading="loadingScores">
      <button class="pc-tts-btn" @click="speakScores">
        <span class="pc-tts-icon">🔊</span><span>ฟังสรุปคะแนน</span>
      </button>

      <div class="pc-section-title">
        <span>📊 คะแนนเก็บรายวิชา</span>
        <span class="pc-term-chip">{{ termLabel || 'ภาคเรียนนี้' }}</span>
      </div>

      <div v-if="scores.length" class="pc-score-list">
        <div v-for="s in scores" :key="s.subject_code" class="pc-score-card">
          <div class="pc-score-subj">{{ s.subject_name }}</div>
          <div v-if="hasAnyScore(s)" class="pc-score-chips">
            <template v-for="(val, key) in s.scores" :key="key">
              <div v-if="val !== null && val !== ''" class="pc-score-chip">
                <div class="pc-chip-key">{{ key }}</div>
                <div class="pc-chip-val">{{ val }}</div>
              </div>
            </template>
          </div>
          <div v-else class="pc-score-none">ยังไม่ได้กรอก</div>
        </div>
      </div>
      <div v-else class="pc-empty">ยังไม่มีคะแนน<br><small>ครูยังไม่ได้กรอกข้อมูล</small></div>
    </div>

    <!-- ══════════ TAB: ความประพฤติ ══════════ -->
    <div v-else-if="activeTab === 'behavior'" class="pc-body" v-loading="loadingBeh">
      <button class="pc-tts-btn" @click="speakBehavior">
        <span class="pc-tts-icon">🔊</span><span>ฟังสรุปความประพฤติ</span>
      </button>

      <!-- Big score circle -->
      <div class="pc-beh-hero">
        <div class="pc-beh-circle" :class="behaviorCircleClass">
          <div class="pc-beh-circle-num">{{ behavior?.total_score ?? child?.behavior_score ?? 100 }}</div>
          <div class="pc-beh-circle-lbl">คะแนนรวม</div>
        </div>
      </div>

      <!-- Sub scores -->
      <div class="pc-beh-grid">
        <div class="pc-beh-card pc-beh-green">
          <div class="pc-beh-icon">📅</div>
          <div class="pc-beh-num">{{ behavior?.attendance_score ?? 0 }}</div>
          <div class="pc-beh-lbl">การมาเรียน</div>
        </div>
        <div class="pc-beh-card pc-beh-blue">
          <div class="pc-beh-icon">📚</div>
          <div class="pc-beh-num">{{ behavior?.learning_score ?? 0 }}</div>
          <div class="pc-beh-lbl">การเรียน</div>
        </div>
        <div class="pc-beh-card pc-beh-purple">
          <div class="pc-beh-icon">🤝</div>
          <div class="pc-beh-num">{{ behavior?.general_score ?? 0 }}</div>
          <div class="pc-beh-lbl">ทั่วไป</div>
        </div>
      </div>

      <!-- ทัณฑ์บน -->
      <div v-if="behavior && (behavior.probation_score ?? 0) !== 0" class="pc-beh-probation">
        <div class="pc-beh-prob-icon">⚠️</div>
        <div class="pc-beh-prob-body">
          <div class="pc-beh-prob-label">ทัณฑ์บน</div>
          <div class="pc-beh-prob-note">มีบันทึกความผิดร้ายแรง</div>
        </div>
        <div class="pc-beh-prob-score">{{ behavior.probation_score }}</div>
      </div>

      <!-- Log history -->
      <div v-if="behavior && behavior.recent_logs?.length" class="pc-beh-history">
        <div class="pc-beh-hist-title">ประวัติการบันทึก</div>

        <!-- Filter tabs -->
        <div class="pc-beh-ftabs">
          <button v-for="tab in behTypeTabs" :key="tab.value"
            class="pc-beh-ftab" :class="{ 'pc-beh-ftab--active': behFilterType === tab.value }"
            @click="behFilterType = tab.value">{{ tab.label }}</button>
        </div>

        <!-- Date filters -->
        <div class="pc-beh-date-row">
          <input type="date" v-model="behDateFrom" class="pc-beh-date-input" />
          <span class="pc-beh-date-sep">–</span>
          <input type="date" v-model="behDateTo" class="pc-beh-date-input" />
          <button v-if="behDateFrom || behDateTo" class="pc-beh-clr-btn" @click="behDateFrom=''; behDateTo=''">✕</button>
        </div>

        <!-- Summary -->
        <div class="pc-beh-sum-row">
          รวม <strong>{{ filteredBehLogs.length }}</strong> รายการ &nbsp;|&nbsp;
          ผลรวม
          <strong :class="filteredBehSum < 0 ? 'pc-beh-sum--neg' : filteredBehSum > 0 ? 'pc-beh-sum--pos' : ''">
            {{ filteredBehSum > 0 ? '+' : '' }}{{ filteredBehSum }}
          </strong>
        </div>

        <div v-if="!filteredBehLogs.length" class="pc-beh-empty-log">ไม่มีรายการในช่วงนี้</div>
        <div v-else class="pc-beh-log-list">
          <div v-for="(log, idx) in filteredBehLogs" :key="idx" class="pc-beh-log-item">
            <div class="pc-beh-log-dot" :class="(log.points ?? log.points_change) >= 0 ? 'pc-beh-dot--pos' : 'pc-beh-dot--neg'">
              {{ (log.points ?? log.points_change) >= 0 ? '+' : '' }}{{ log.points ?? log.points_change }}
            </div>
            <div class="pc-beh-log-body">
              <div class="pc-beh-log-label">{{ log.label || behTypeLabel(log.type || log.behavior_type) }}</div>
              <div v-if="log.note" class="pc-beh-log-note">{{ log.note }}</div>
              <div v-if="Array.isArray(log.image_urls) && log.image_urls.filter(Boolean).length" class="pc-beh-log-imgs">
                <img v-for="(url, i) in log.image_urls.filter(Boolean)" :key="i"
                  :src="fixPhotoUrl(url)" class="pc-beh-log-img" loading="lazy"
                  @click="viewingAttachment = fixPhotoUrl(url)" />
              </div>
              <div class="pc-beh-log-meta">
                <span class="pc-beh-log-date">{{ log.date ? fmtDate(log.date) : '—' }}</span>
                <span class="pc-beh-log-sep">·</span>
                <span class="pc-beh-log-teacher">{{ log.teacher || log.recorded_by_name_snapshot || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!loadingBeh && !behavior" class="pc-empty">ยังไม่มีข้อมูลความประพฤติ</div>
    </div>

    <!-- ══════════ TAB: รายวิชา (เหมือนหน้านักเรียนทุกอย่าง) ══════════ -->
    <div v-else-if="activeTab === 'subject_att'" class="pc-body" v-loading="loadingSubject || loadingScores">

      <div v-if="loadingSubject || loadingScores" class="sa-center">กำลังโหลด...</div>
      <template v-else>

        <!-- Grand total -->
        <div class="sa-total-card">
          <div class="sa-total-title">สรุปการมาเรียนทั้งหมด</div>
          <div class="sa-total-grid">
            <div class="sa-total-cell c-attend2"><div class="sa-tc-num">{{ subjectGrand.attend    }}</div><div class="sa-tc-lbl">มาเรียน</div></div>
            <div class="sa-total-cell c-late2">  <div class="sa-tc-num">{{ subjectGrand.late      }}</div><div class="sa-tc-lbl">มาสาย</div></div>
            <div class="sa-total-cell c-sick2">  <div class="sa-tc-num">{{ subjectGrand.sick      }}</div><div class="sa-tc-lbl">ลาป่วย</div></div>
            <div class="sa-total-cell c-leave2">  <div class="sa-tc-num">{{ subjectGrand.leave     }}</div><div class="sa-tc-lbl">ลากิจ</div></div>
            <div class="sa-total-cell c-absent2"><div class="sa-tc-num">{{ subjectGrand.absent    }}</div><div class="sa-tc-lbl">ขาดเรียน</div></div>
            <div class="sa-total-cell c-pending2"><div class="sa-tc-num">{{ subjectGrand.notFilled }}</div><div class="sa-tc-lbl">ยังไม่บันทึก</div></div>
            <div class="sa-total-cell c-all2">   <div class="sa-tc-num">{{ subjectGrand.all       }}</div><div class="sa-tc-lbl">ทั้งหมด</div></div>
          </div>
        </div>

        <!-- TTS Summary card -->
        <div v-if="subjectList.length" class="sa-summary-card">
          <button class="sa-tts-summary-btn" @click="speakSubjectSummary">
            🔊 ฟังสรุปภาพรวม
          </button>
          <div class="sa-summary-row">
            <div class="sa-summary-chip" :class="riskMsCount > 0 ? 'sa-sum--danger' : 'sa-sum--ok'">
              <div class="sa-sum-num">{{ riskMsCount }}</div>
              <div class="sa-sum-lbl">⚠️ เสี่ยง มส.</div>
            </div>
            <div class="sa-summary-chip" :class="lowScoreCount > 0 ? 'sa-sum--warn' : 'sa-sum--ok'">
              <div class="sa-sum-num">{{ lowScoreCount }}</div>
              <div class="sa-sum-lbl">📝 คะแนนไม่ถึงครึ่ง</div>
            </div>
            <div class="sa-summary-chip sa-sum--ok">
              <div class="sa-sum-num">{{ subjectList.length }}</div>
              <div class="sa-sum-lbl">📚 วิชาทั้งหมด</div>
            </div>
          </div>
        </div>

        <div v-if="!subjectList.length" class="sa-empty-card">
          <div class="sa-empty-icon">📋</div>
          <div class="sa-empty-text">ยังไม่มีข้อมูล</div>
        </div>

        <!-- Per-subject cards -->
        <div v-for="sub in subjectList" :key="sub.name" class="sa-subject-card">
          <div class="sa-sub-header">
            <div class="sa-sub-name">{{ sub.name }}</div>
            <div class="sa-sub-header-right">
              <span v-if="sub.teacher" class="sa-sub-teacher">👨‍🏫 {{ sub.teacher }}</span>
              <button class="sa-tts-btn" @click="speakSubject(sub)">🔊</button>
            </div>
          </div>

          <!-- เวลาเรียน -->
          <div class="sa-section-lbl">เวลาเรียน</div>
          <div v-if="sub.all === 0" class="sa-no-data">ยังไม่มีข้อมูล</div>
          <div v-else>
            <div class="sa-attend-chips">
              <div class="sa-chip c-attend2"><span class="sa-chip-num">{{ sub.attend    }}</span><span class="sa-chip-lbl">มาเรียน</span></div>
              <div class="sa-chip c-late2">  <span class="sa-chip-num">{{ sub.late      }}</span><span class="sa-chip-lbl">มาสาย</span></div>
              <div class="sa-chip c-sick2">  <span class="sa-chip-num">{{ sub.sick      }}</span><span class="sa-chip-lbl">ลาป่วย</span></div>
              <div class="sa-chip c-leave2"> <span class="sa-chip-num">{{ sub.leave     }}</span><span class="sa-chip-lbl">ลากิจ</span></div>
              <div class="sa-chip c-absent2"><span class="sa-chip-num">{{ sub.absent    }}</span><span class="sa-chip-lbl">ขาดเรียน</span></div>
              <div class="sa-chip c-pending2"><span class="sa-chip-num">{{ sub.notFilled }}</span><span class="sa-chip-lbl">ยังไม่บันทึก</span></div>
              <div class="sa-chip c-all2">   <span class="sa-chip-num">{{ sub.all       }}</span><span class="sa-chip-lbl">ทั้งหมด</span></div>
            </div>
            <div class="sa-bar-track">
              <div class="sa-seg sa-seg-attend" :style="{ width: saSegPct(sub,'attend') + '%' }"></div>
              <div class="sa-seg sa-seg-absent" :style="{ width: saSegPct(sub,'absent') + '%' }"></div>
            </div>
            <div class="sa-pct-row">
              <span class="sa-pct-label">
                <span class="sa-pct-attend">มาเรียน {{ sub.attend + sub.late }}/{{ sub.all }} คาบ</span>
                <span class="sa-pct-num">{{ saAttPct(sub) }}%</span>
              </span>
              <span class="sa-ms-badge" :class="saAttPct(sub) < 80 ? 'sa-ms--fail' : 'sa-ms--pass'">
                {{ saAttPct(sub) < 80 ? 'มส.' : 'มีสิทธิ์สอบ' }}
              </span>
            </div>
          </div>

          <!-- คะแนนเก็บ -->
          <div class="sa-section-lbl" style="margin-top:18px">คะแนนเก็บ</div>
          <div v-if="!sub.hasScores" class="sa-no-data">ยังไม่มีข้อมูล</div>
          <div v-else>
            <div class="sa-scores-row">
              <div v-for="i in saNumUnits" :key="i" class="sa-score-chip"
                :class="saHasScore(sub, i) ? 'sa-sc-filled' : 'sa-sc-empty'">
                <div class="sa-sc-label">ครั้ง {{ i }}</div>
                <div class="sa-sc-val">{{ saHasScore(sub, i) ? sub.scores['u'+i] : '—' }}</div>
                <div class="sa-sc-max-lbl">/{{ saMaxScores[i-1] || 20 }}</div>
                <div class="sa-sc-bar-track">
                  <div class="sa-sc-bar-fill"
                    :style="{ width: saHasScore(sub,i) ? Math.round(Number(sub.scores['u'+i]) / (saMaxScores[i-1]||20) * 100) + '%' : '0%' }">
                  </div>
                </div>
              </div>
            </div>
            <div class="sa-score-total-row">
              <div class="sa-total-left">
                <span class="sa-total-num">{{ sub.totalScore }}</span>
                <span class="sa-total-sep">/</span>
                <span class="sa-total-max">{{ sub.totalMax }}</span>
                <span class="sa-total-lbl">คะแนนรวม</span>
              </div>
              <span class="sa-pass-tag" :class="sub.passed ? 'sa-pass--pass' : 'sa-pass--warn'">
                {{ sub.passed ? 'ผ่าน' : 'ยังไม่ผ่าน' }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ══════════ TAB: ตารางสอน ══════════ -->
    <div v-else-if="activeTab === 'timetable'" class="pc-body">
      <div v-if="loadingTimetable" class="pc-empty">กำลังโหลด...</div>
      <div v-else-if="timetableError" class="pc-empty" style="color:#dc2626">{{ timetableError }}</div>
      <div v-else-if="!timetableSlots.length" class="pc-empty">ยังไม่มีตารางสอน</div>
      <div v-else>
        <!-- Day tabs -->
        <div class="pc-tt-daytabs">
          <button
            v-for="d in ttActiveDays" :key="d.num"
            class="pc-tt-daytab"
            :class="{ active: ttActiveDay === d.num }"
            @click="ttActiveDay = d.num"
          >{{ d.short }}</button>
        </div>
        <!-- Period cards -->
        <div class="pc-tt-periods">
          <div v-if="!ttDaySlots.length" class="pc-empty">ไม่มีคาบเรียนวันนี้</div>
          <div
            v-for="slot in ttDaySlots" :key="slot.period_number"
            class="pc-tt-card"
            :class="ttSlotClass(slot)"
          >
            <div class="pc-tt-period-num">คาบ {{ slot.period_number }}</div>
            <div class="pc-tt-info">
              <div class="pc-tt-subject">{{ ttSlotLabel(slot) }}</div>
              <div v-if="slot.slot_type === 'subject' && slot.teacher_name?.trim()" class="pc-tt-teacher">👤 {{ slot.teacher_name }}</div>
              <div v-if="slot.room_id" class="pc-tt-room">🚪 {{ slot.room_id }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ TAB: ข้อความจากครู ══════════ -->
    <div v-else-if="activeTab === 'messages'" class="pc-body" v-loading="loadingMsgs">

      <div class="pc-msg-readonly-banner">
        🔒 อ่านได้อย่างเดียว — ข้อความที่ครูส่งหานักเรียน
      </div>

      <div v-if="!loadingMsgs && !parentMsgs.length" class="pc-empty">ยังไม่มีข้อความจากครู</div>

      <div class="pc-msg-list">
        <div v-for="m in parentMsgs" :key="m.id" class="pc-msg-item">
          <div class="pc-msg-header">
            <span class="pc-msg-teacher">👨‍🏫 {{ m.teacher_name || 'ครูที่ปรึกษา' }}</span>
            <span class="pc-msg-time">{{ fmtMsgDate(m.created_at) }}</span>
          </div>
          <div v-if="m.content" class="pc-msg-body">{{ m.content }}</div>
          <div v-if="m.attachments?.length" class="pc-msg-atts">
            <template v-for="(att, i) in m.attachments" :key="i">
              <img v-if="att.type === 'image'" :src="fixPhotoUrl(att.url)" class="pc-msg-att-img"
                @click="viewingAttachment = fixPhotoUrl(att.url)" />
              <a v-else :href="att.url" target="_blank" class="pc-msg-att-file">
                📄 {{ att.name || 'ไฟล์แนบ' }}
              </a>
            </template>
          </div>
        </div>
      </div>

      <!-- Attachment lightbox -->
      <div v-if="viewingAttachment" class="pc-lightbox" @click="viewingAttachment = ''">
        <img :src="viewingAttachment" class="pc-lightbox-img" @click.stop />
        <button class="pc-lightbox-close" @click="viewingAttachment = ''">✕</button>
      </div>
    </div>

    <!-- ══════════ TAB: เช็คอิน ══════════ -->
    <div v-else-if="activeTab === 'checkin'" class="pc-body" v-loading="loadingCheckins">

      <div class="pc-section-title">
        <span>📍 ประวัติเช็คอินเข้าโรงเรียน</span>
      </div>

      <!-- Filter pills -->
      <div class="pc-pills">
        <button v-for="p in CHECKIN_PERIODS" :key="p.key"
          class="pc-pill" :class="{ active: checkinPeriod === p.key }"
          @click="checkinPeriod = p.key">{{ p.label }}</button>
      </div>

      <div v-if="!loadingCheckins && !filteredCheckins.length" class="pc-empty">ยังไม่มีข้อมูลเช็คอิน</div>

      <div class="pc-ci-list">
        <div v-for="c in filteredCheckins" :key="c.id" class="pc-ci-item">
          <!-- Date + time -->
          <div class="pc-ci-left">
            <div class="pc-ci-date">{{ fmtCheckinDate(c.date) }}</div>
            <div class="pc-ci-time">{{ fmtCheckinTime(c.checkin_time) }}</div>
            <div class="pc-ci-dist" v-if="c.distance_m != null">
              📍 {{ c.distance_m }} ม.
            </div>
            <div class="pc-ci-face" v-if="c.face_verified != null">
              {{ c.face_verified ? '🟢 ยืนยันใบหน้า' : '🔴 ใบหน้าไม่ตรง' }}
            </div>
          </div>
          <!-- Selfie -->
          <div class="pc-ci-right">
            <img v-if="c.selfie_url" :src="fixPhotoUrl(c.selfie_url)" class="pc-ci-selfie"
              @click="viewingAttachment = fixPhotoUrl(c.selfie_url)" />
            <div v-else class="pc-ci-no-selfie">📷</div>
          </div>
        </div>
      </div>

      <!-- Lightbox (shared) -->
      <div v-if="viewingAttachment" class="pc-lightbox" @click="viewingAttachment = ''">
        <img :src="viewingAttachment" class="pc-lightbox-img" @click.stop />
        <button class="pc-lightbox-close" @click="viewingAttachment = ''">✕</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/supabase/client'
import { useParentStore } from '@/stores/parent'
import { fixPhotoUrl } from '@/composables/useStudentUpload'

const route       = useRoute()
const parentStore = useParentStore()

const TABS = [
  { key: 'attendance',  icon: '📅', label: 'มาเรียน' },
  { key: 'subject_att', icon: '📚', label: 'รายวิชา' },
  { key: 'behavior',    icon: '⭐', label: 'ความประพฤติ' },
  { key: 'timetable',   icon: '🗓️', label: 'ตารางสอน' },
  { key: 'messages',    icon: '💬', label: 'ข้อความ' },
  { key: 'checkin',     icon: '📍', label: 'เช็คอิน' },
]
const PERIODS = [
  { key: 'today',  label: 'วันนี้' },
  { key: 'week',   label: 'สัปดาห์นี้' },
  { key: 'month',  label: 'เดือนนี้' },
  { key: 'custom', label: '📅 เลือกวัน' },
]

const activeTab    = ref('attendance')
const attPeriod    = ref('today')
const customFrom   = ref(monthStart())
const customTo     = ref('')
const loadingAtt   = ref(false)
const loadingScores = ref(false)
const loadingBeh   = ref(false)
const attRecords   = ref([])  // [{date, period, subject, status}]
const scores       = ref([])
const behavior     = ref(null)
const childExtra   = ref(null)  // { join_date, subject_carry_over }

// ── New tabs ──────────────────────────────────────────────
const subjectRecords  = ref([])
const loadingSubject  = ref(false)
const parentMsgs      = ref([])
const loadingMsgs     = ref(false)
const checkins        = ref([])
const loadingCheckins = ref(false)
const checkinPeriod   = ref('week')
const viewingAttachment = ref('')

// ─── Behavior log filters ──────────────────────────────────────
const behFilterType = ref('all')
const behDateFrom   = ref('')
const behDateTo     = ref('')

const behTypeTabs = [
  { value: 'all',       label: 'ทั้งหมด' },
  { value: 'general',   label: 'ทั่วไป' },
  { value: 'classroom', label: 'ในห้องเรียน' },
  { value: 'probation', label: 'ทัณฑ์บน' },
]

const BEH_TYPE_LABELS = { general: 'ทั่วไป', attendance: 'ในห้องเรียน', learning: 'ในห้องเรียน', probation: 'ทัณฑ์บน' }
function behTypeLabel(t) { return BEH_TYPE_LABELS[t] || t || '-' }

const filteredBehLogs = computed(() => {
  const logs = behavior.value?.recent_logs || []
  return logs.filter(l => {
    const type = l.type || l.behavior_type || ''
    if (behFilterType.value === 'classroom' && !['attendance','learning'].includes(type)) return false
    if (behFilterType.value === 'general'   && type !== 'general')   return false
    if (behFilterType.value === 'probation' && type !== 'probation') return false
    if (behDateFrom.value && l.date && l.date < behDateFrom.value) return false
    if (behDateTo.value   && l.date && l.date > behDateTo.value)   return false
    return true
  })
})

const filteredBehSum = computed(() =>
  filteredBehLogs.value.reduce((s, l) => s + (l.points ?? l.points_change ?? 0), 0)
)

function fmtDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const CHECKIN_PERIODS = [
  { key: 'today', label: 'วันนี้' },
  { key: 'week',  label: 'สัปดาห์นี้' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'all',   label: 'ทั้งหมด' },
]

const studentCode = computed(() => route.params.code)
const child       = computed(() => parentStore.getChild(studentCode.value))
const schoolId    = computed(() => parentStore.schoolId)
const termId      = computed(() => parentStore.currentTerm || '')
const termLabel   = computed(() => parentStore.termLabel || '')

// ─── Date helpers ──────────────────────────────────────────────
const THAI_MONTHS = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function formatThaiDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${+d} ${THAI_MONTHS[+m]} ${+y + 543}`
}

function todayStr()  { return new Date().toISOString().slice(0,10) }
function weekStart() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0,10)
}
function monthStart() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

// ─── Attendance filter & summary ──────────────────────────────
const filteredRecords = computed(() => {
  const joinDate = childExtra.value?.join_date || null
  let records = joinDate
    ? attRecords.value.filter(r => !r.date || r.date >= joinDate)
    : attRecords.value
  if (attPeriod.value === 'custom') return records
  const from = attPeriod.value === 'today' ? todayStr()
             : attPeriod.value === 'week'  ? weekStart()
             : monthStart()
  return records.filter(r => r.date >= from && r.date <= todayStr())
})

// จัดกลุ่ม status — period 0 (คาบเข้าแถว) ขาด = มาสาย
function categorizeStatus(status, period) {
  if (!status || status === 'ยังไม่บันทึก') return 'unrecorded'
  if (status === 'มาเรียน') return 'present'
  if (status === 'มาสาย')   return 'late'
  // ขาดคาบ 0 = มาสาย (ครูที่ปรึกษา เข้าแถว)
  if (Number(period) === 0 && !['ลาป่วย','ลากิจ','ไปราชการ'].includes(status)) return 'late'
  if (status.includes('ลา') || status === 'ไปราชการ' || status === 'บวช') return 'leave'
  if (status.includes('ขาด') || status.includes('โดด') || status.includes('หนี')) return 'absent'
  return 'present'
}

function isDayLate(records) {
  return records.some(r => categorizeStatus(r.status, r.period) === 'late')
}

const attSummary = computed(() => {
  const r = filteredRecords.value
  const lateDates = new Set()
  const grouped = {}
  for (const x of r) {
    if (!grouped[x.date]) grouped[x.date] = []
    grouped[x.date].push(x)
  }
  for (const [date, recs] of Object.entries(grouped)) {
    if (isDayLate(recs)) lateDates.add(date)
  }
  // carry-over: บวกเฉพาะ month/custom (ไม่บวกสำหรับ today/week)
  const showCarryOver = attPeriod.value === 'month' || attPeriod.value === 'custom'
  const co = showCarryOver ? (childExtra.value?.subject_carry_over || {}) : {}
  const coVals = Object.values(co).map(Number).filter(v => v > 0)
  const carryOver = coVals.length ? Math.round(coVals.reduce((a, b) => a + b, 0) / coVals.length) : 0
  return {
    total:      r.length + carryOver,
    present:    r.filter(x => categorizeStatus(x.status, x.period) === 'present').length + carryOver,
    late:       lateDates.size,
    absent:     r.filter(x => categorizeStatus(x.status, x.period) === 'absent').length,
    leave:      r.filter(x => categorizeStatus(x.status, x.period) === 'leave').length,
    unrecorded: r.filter(x => categorizeStatus(x.status, x.period) === 'unrecorded').length,
    carryOver,
  }
})

const filteredRecordsByDate = computed(() => {
  const map = {}
  for (const r of filteredRecords.value) {
    if (!map[r.date]) map[r.date] = []
    map[r.date].push(r)
  }
  return Object.entries(map)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .slice(0, attPeriod.value === 'today' ? 1 : 99)
    .map(([date, records]) => ({ date, records, isLate: isDayLate(records) }))
})

// ─── Subject attendance (เหมือน StudentAttendanceView) ────────
const saNumUnits  = ref(8)
const saMaxScores = ref(Array(8).fill(20))

function saClassify(status) {
  if (!status || status === 'ยังไม่บันทึก') return 'notFilled'
  if (status.includes('มาสาย')) return 'late'
  if (status.includes('มาเรียน')) return 'attend'
  if (status.includes('ป่วย')) return 'sick'
  if (status.includes('ลากิจ') || status.includes('ราชการ') || status.includes('บวช')) return 'leave'
  return 'absent'
}

function normSubj(name) {
  return (name || '').replace(/\s+/g, '').toLowerCase()
}

const subjectList = computed(() => {
  // group attendance by subject name
  const acc = {}
  for (const r of subjectRecords.value) {
    const key = r.subject || '(ไม่ระบุวิชา)'
    if (!acc[key]) {
      acc[key] = { name: key, teacher: r.teacher || '', attend: 0, late: 0, sick: 0, leave: 0, absent: 0, notFilled: 0, all: 0 }
    }
    acc[key].all++
    acc[key][saClassify(r.status)]++
  }

  // score lookup by normalized name
  const scoreByNorm = {}
  for (const s of scores.value) {
    scoreByNorm[normSubj(s.subject_name)] = s.scores || {}
  }

  return Object.values(acc).map(sub => {
    const rawScores = scoreByNorm[normSubj(sub.name)] || {}
    const hasScores = Object.values(rawScores).some(v => v !== null && v !== undefined && v !== '')
    let totalScore = 0, totalMax = 0
    for (let i = 1; i <= saNumUnits.value; i++) {
      const v = rawScores['u' + i]
      const m = saMaxScores.value[i - 1] || 20
      if (v !== null && v !== undefined && v !== '') { totalScore += Number(v); totalMax += m }
    }
    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
    return { ...sub, scores: rawScores, hasScores, totalScore, totalMax, passed: pct >= 50 }
  }).sort((a, b) => a.name.localeCompare(b.name, 'th'))
})

const subjectGrand = computed(() => {
  const g = { attend: 0, late: 0, sick: 0, leave: 0, absent: 0, notFilled: 0, all: 0 }
  for (const s of subjectList.value) {
    g.attend += s.attend; g.late += s.late; g.sick += s.sick
    g.leave  += s.leave;  g.absent += s.absent; g.notFilled += s.notFilled; g.all += s.all
  }
  return g
})

function saAttPct(sub) {
  if (!sub.all) return 0
  return Math.round(((sub.attend + sub.late) / sub.all) * 100)
}
function saSegPct(sub, type) {
  if (!sub.all) return 0
  const val = type === 'attend' ? (sub.attend + sub.late) : (sub.sick + sub.leave + sub.absent + sub.notFilled)
  return Math.round((val / sub.all) * 100)
}
function saHasScore(sub, i) {
  const v = sub.scores['u' + i]
  return v !== null && v !== undefined && v !== ''
}

// ─── Subject TTS computed ──────────────────────────────────────
const riskMsCount = computed(() =>
  subjectList.value.filter(s => s.all > 0 && saAttPct(s) < 80).length
)
const lowScoreCount = computed(() =>
  subjectList.value.filter(s => s.hasScores && !s.passed).length
)

// ─── Checkin filtered ──────────────────────────────────────────
const filteredCheckins = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1)
  const weekStart = d.toISOString().slice(0, 10)
  const monthStart_ = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`
  if (checkinPeriod.value === 'today') return checkins.value.filter(c => c.date === today)
  if (checkinPeriod.value === 'week')  return checkins.value.filter(c => c.date >= weekStart && c.date <= today)
  if (checkinPeriod.value === 'month') return checkins.value.filter(c => c.date >= monthStart_ && c.date <= today)
  return checkins.value
})


// ─── Message + checkin format helpers ─────────────────────────
function fmtMsgDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const THAI_DAYS = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.']
function fmtCheckinDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  const weekday = THAI_DAYS[new Date(d).getDay()]
  return `${weekday} ${+day}/${+m}/${+y + 543}`
}
function fmtCheckinTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} น.`
}

// ─── Status helpers ────────────────────────────────────────────
function statusIcon(s, period) {
  const cat = categorizeStatus(s, period)
  if (cat === 'present')    return '✅'
  if (cat === 'late')       return '⏰'
  if (cat === 'absent')     return '❌'
  if (cat === 'leave')      return '📋'
  if (cat === 'unrecorded') return '🔘'
  return '📌'
}
function statusClass(s, period) {
  const cat = categorizeStatus(s, period)
  if (cat === 'present')    return 'sta-ok'
  if (cat === 'late')       return 'sta-late'
  if (cat === 'absent')     return 'sta-skip'
  if (cat === 'leave')      return 'sta-leave'
  return 'sta-pending'
}
function rowBorderClass(s, period) {
  const cat = categorizeStatus(s, period)
  if (cat === 'present')    return 'rb-ok'
  if (cat === 'late')       return 'rb-late'
  if (cat === 'absent')     return 'rb-skip'
  if (cat === 'leave')      return 'rb-leave'
  return 'rb-pending'
}

function hasAnyScore(s) {
  if (!s?.scores) return false
  return Object.values(s.scores).some(v => v !== null && v !== '' && v !== undefined)
}

// ─── Behavior circle ───────────────────────────────────────────
const behaviorCircleClass = computed(() => {
  const s = child.value?.behavior_score ?? 100
  if (s >= 90) return 'pc-bc-green'
  if (s >= 70) return 'pc-bc-amber'
  return 'pc-bc-red'
})

// ─── TTS ──────────────────────────────────────────────────────
const THAI_NUMS = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า','สิบ',
  'สิบเอ็ด','สิบสอง','สิบสาม','สิบสี่','สิบห้า','สิบหก','สิบเจ็ด','สิบแปด','สิบเก้า','ยี่สิบ']
function numTH(n) {
  const v = Math.floor(+n)
  if (v <= 20) return THAI_NUMS[v] || String(v)
  const tens = Math.floor(v/10), ones = v%10
  const units = ['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า']
  const t = (tens === 2 ? 'ยี่สิบ' : units[tens]+'สิบ')
  return ones === 0 ? t : ones === 1 ? t+'เอ็ด' : t+units[ones]
}

function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'th-TH'; utt.rate = 0.85
  window.speechSynthesis.speak(utt)
}

function periodLabel() {
  if (attPeriod.value === 'today') return `วันที่ ${formatThaiDate(todayStr())}`
  if (attPeriod.value === 'week')  return 'สัปดาห์นี้'
  return 'เดือนนี้'
}

function speakAttendance() {
  const s = attSummary.value
  const name = `${child.value?.name || ''} ${child.value?.surname || ''}`
  // อ่านตาม summary ที่โชว์บนหน้าจอ ทุกตัวเลขต้องตรงกัน
  const parts = [`สรุปการมาเรียน ${periodLabel()} ของ ${name}`]
  parts.push(`คาบเรียนทั้งหมด ${numTH(s.total)} คาบ`)
  parts.push(`มาเรียน ${numTH(s.present)} คาบ`)
  if (s.late       > 0) parts.push(`มาสาย ${numTH(s.late)} วัน`)
  if (s.absent     > 0) parts.push(`ขาดเรียน ${numTH(s.absent)} คาบ`)
  if (s.leave      > 0) parts.push(`ลา ${numTH(s.leave)} คาบ`)
  if (s.unrecorded > 0) parts.push(`ยังไม่บันทึก ${numTH(s.unrecorded)} คาบ`)
  if (s.absent === 0 && s.late === 0 && s.leave === 0 && s.unrecorded === 0) parts.push('เข้าเรียนครบทุกคาบ')
  speak(parts.join(' '))
}

function speakScores() {
  const name = `${child.value?.name || ''} ${child.value?.surname || ''}`
  const parts = [`สรุปคะแนนของ ${name}`]
  const filled = scores.value.filter(s => hasAnyScore(s))
  if (!filled.length) {
    parts.push('ยังไม่มีคะแนนเก็บ')
  } else {
    for (const s of filled) {
      const vals = Object.values(s.scores || {}).filter(v => v !== null && v !== '')
      parts.push(`วิชา${s.subject_name} คะแนน ${vals.join(' ')}`)
    }
  }
  speak(parts.join(' '))
}

function speakBehavior() {
  const name = `${child.value?.name || ''} ${child.value?.surname || ''}`
  const b = behavior.value
  if (!b) { speak(`ยังไม่มีข้อมูลความประพฤติของ ${name}`); return }
  const parts = [
    `สรุปความประพฤติของ ${name}`,
    `คะแนนรวม ${numTH(b.total_score ?? 100)} คะแนน`,
    `คะแนนด้านการมาเรียน ${numTH(b.attendance_score ?? 0)} คะแนน`,
    `คะแนนด้านการเรียน ${numTH(b.learning_score ?? 0)} คะแนน`,
  ]
  speak(parts.join(' '))
}

function speakSubjectSummary() {
  const name = `${child.value?.name || ''} ${child.value?.surname || ''}`
  const risk = riskMsCount.value
  const low  = lowScoreCount.value
  const total = subjectList.value.length
  const parts = [`สรุปรายวิชาของ ${name}`]
  parts.push(`วิชาทั้งหมด ${numTH(total)} วิชา`)
  if (risk > 0) parts.push(`วิชาที่เสี่ยงมส ${numTH(risk)} วิชา`)
  else parts.push('ไม่มีวิชาที่เสี่ยงมส')
  if (low > 0) parts.push(`วิชาที่คะแนนไม่ถึงครึ่ง ${numTH(low)} วิชา`)
  else parts.push('ทุกวิชาคะแนนผ่าน')
  speak(parts.join(' '))
}

function speakSubject(sub) {
  const parts = [`วิชา${sub.name}`]
  if (sub.teacher) parts.push(`ครู${sub.teacher}`)
  // attendance
  if (sub.all > 0) {
    parts.push(`มาเรียน ${numTH(sub.attend + sub.late)} จาก ${numTH(sub.all)} คาบ คิดเป็น ${numTH(saAttPct(sub))} เปอร์เซ็น`)
    if (sub.absent > 0) parts.push(`ขาด ${numTH(sub.absent)} คาบ`)
    if (sub.sick   > 0) parts.push(`ลาป่วย ${numTH(sub.sick)} คาบ`)
    if (sub.leave  > 0) parts.push(`ลากิจ ${numTH(sub.leave)} คาบ`)
    if (saAttPct(sub) < 80) parts.push('เสี่ยงหมดสิทธิ์สอบ')
    else parts.push('มีสิทธิ์สอบ')
  } else {
    parts.push('ยังไม่มีข้อมูลเวลาเรียน')
  }
  // scores
  if (sub.hasScores) {
    const scored = []
    for (let i = 1; i <= saNumUnits.value; i++) {
      if (saHasScore(sub, i)) scored.push(`ครั้งที่ ${numTH(i)} ได้ ${numTH(sub.scores['u'+i])} คะแนน`)
    }
    if (scored.length) parts.push(...scored)
    parts.push(`คะแนนรวม ${numTH(sub.totalScore)} จาก ${numTH(sub.totalMax)} คะแนน`)
    parts.push(sub.passed ? 'ผ่าน' : 'ยังไม่ผ่าน')
  } else {
    parts.push('ยังไม่มีคะแนน')
  }
  speak(parts.join(' '))
}

// ─── Data loading ──────────────────────────────────────────────
async function loadAttendance(dateFrom, dateTo) {
  if (!studentCode.value || !schoolId.value) return
  loadingAtt.value = true
  try {
    const from = dateFrom || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10) })()
    const to   = dateTo   || todayStr()
    const { data } = await supabase.rpc('get_parent_child_attendance', {
      p_student_code: studentCode.value,
      p_school_id:    schoolId.value,
      p_date_from:    from,
      p_date_to:      to,
    })
    attRecords.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
  } finally {
    loadingAtt.value = false
  }
}

async function loadAttendanceCustom() {
  const from = customFrom.value
  const to   = customTo.value || todayStr()
  if (!from) return
  await loadAttendance(from, to)
}

async function loadScores() {
  if (!studentCode.value || !schoolId.value || !termId.value) return
  loadingScores.value = true
  try {
    const { data } = await supabase.rpc('get_parent_child_scores', {
      p_student_code: studentCode.value,
      p_school_id:    schoolId.value,
      p_term_id:      termId.value,
    })
    scores.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
  } finally {
    loadingScores.value = false
  }
}

async function loadBehavior() {
  if (!studentCode.value || !schoolId.value || !termId.value) return
  loadingBeh.value = true
  try {
    const { data } = await supabase.rpc('get_parent_child_behavior', {
      p_student_code: studentCode.value,
      p_school_id:    schoolId.value,
      p_term_id:      termId.value,
    })
    behavior.value = data || null
  } catch (e) {
    console.error(e)
  } finally {
    loadingBeh.value = false
  }
}

async function loadSubjectAttendance() {
  if (!studentCode.value || !schoolId.value) return
  loadingSubject.value = true
  try {
    // โหลดย้อนหลัง 180 วัน ครอบคลุมทั้งภาคเรียน
    const from = new Date(); from.setDate(from.getDate() - 180)
    const { data } = await supabase.rpc('get_parent_child_attendance', {
      p_student_code: studentCode.value,
      p_school_id:    schoolId.value,
      p_date_from:    from.toISOString().slice(0, 10),
      p_date_to:      todayStr(),
    })
    subjectRecords.value = Array.isArray(data) ? data : []
  } catch (e) { console.error(e) } finally { loadingSubject.value = false }
}

async function loadParentMsgs() {
  if (!studentCode.value || !schoolId.value) return
  loadingMsgs.value = true
  try {
    const { data, error } = await supabase.rpc('get_parent_child_teacher_messages', {
      p_student_code: studentCode.value,
      p_school_id:    schoolId.value,
    })
    if (error) throw error
    parentMsgs.value = Array.isArray(data) ? data : []
  } catch (e) { console.error(e) } finally { loadingMsgs.value = false }
}

async function loadCheckins() {
  if (!studentCode.value || !schoolId.value) return
  loadingCheckins.value = true
  try {
    const { data, error } = await supabase.rpc('get_parent_child_checkins', {
      p_student_code: studentCode.value,
      p_school_id:    schoolId.value,
    })
    if (error) throw error
    checkins.value = Array.isArray(data) ? data : []
  } catch (e) { console.error(e) } finally { loadingCheckins.value = false }
}

// ─── Timetable tab ────────────────────────────────────────
const timetableSlots  = ref([])
const loadingTimetable = ref(false)
const timetableError   = ref('')
const ttActiveDay      = ref(currentTTWeekday())

const TT_DAY_NAMES = [
  { num: 1, short: 'จ' },
  { num: 2, short: 'อ' },
  { num: 3, short: 'พ' },
  { num: 4, short: 'พฤ' },
  { num: 5, short: 'ศ' },
  { num: 6, short: 'ส' },
  { num: 7, short: 'อา' },
]

function currentTTWeekday() { const d = new Date().getDay(); return d === 0 ? 1 : d }

const ttActiveDays = computed(() => {
  const days = new Set(timetableSlots.value.map(s => s.day_of_week))
  return TT_DAY_NAMES.filter(d => days.has(d.num))
})

const ttDaySlots = computed(() =>
  timetableSlots.value
    .filter(s => s.day_of_week === ttActiveDay.value)
    .sort((a, b) => a.period_number - b.period_number)
)

function ttSlotLabel(slot) {
  if (!slot) return ''
  if (slot.slot_type === 'subject')  return slot.subject_name || '?'
  if (slot.slot_type === 'activity') return slot.act_name || 'กิจกรรม'
  return slot.lock_label || '-'
}

function ttSlotClass(slot) {
  if (!slot) return ''
  if (slot.slot_type === 'activity') return 'pc-tt-act'
  if (slot.slot_type === 'lock')     return 'pc-tt-lock'
  return 'pc-tt-sub'
}

async function loadTimetable() {
  if (timetableSlots.value.length) return
  loadingTimetable.value = true
  timetableError.value = ''
  const classId = child.value?.class_id
  if (!schoolId.value || !classId || !termId.value) {
    timetableError.value = 'ไม่พบข้อมูลห้องเรียน'
    loadingTimetable.value = false
    return
  }
  const { data, error } = await supabase.rpc('get_class_timetable', {
    p_school_id: schoolId.value,
    p_class_id:  classId,
    p_term_id:   termId.value,
  })
  if (error) { timetableError.value = error.message; loadingTimetable.value = false; return }
  timetableSlots.value = data || []
  const withSlots = new Set(timetableSlots.value.map(s => s.day_of_week))
  if (!withSlots.has(ttActiveDay.value)) {
    ttActiveDay.value = [...withSlots].sort((a, b) => a - b)[0] || 1
  }
  loadingTimetable.value = false
}

function switchTab(key) {
  activeTab.value = key
  if (key === 'attendance'  && !attRecords.value.length)     loadAttendance()
  if (key === 'subject_att' && !subjectRecords.value.length) loadSubjectAttendance()
  if (key === 'subject_att' && !scores.value.length)        loadScores()
  if (key === 'scores'      && !scores.value.length)         loadScores()
  if (key === 'behavior'    && !behavior.value)              loadBehavior()
  if (key === 'timetable'   && !timetableSlots.value.length) loadTimetable()
  if (key === 'messages'    && !parentMsgs.value.length)     loadParentMsgs()
  if (key === 'checkin'     && !checkins.value.length)       loadCheckins()
}

async function loadChildExtra() {
  if (!studentCode.value || !schoolId.value) return
  try {
    const { data } = await supabase.from('students')
      .select('join_date, subject_carry_over')
      .eq('school_id', schoolId.value)
      .eq('student_code', studentCode.value)
      .maybeSingle()
    childExtra.value = data || null
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => { loadAttendance(); loadChildExtra() })
watch(studentCode, () => {
  attRecords.value = []; scores.value = []; behavior.value = null; childExtra.value = null
  subjectRecords.value = []; parentMsgs.value = []; checkins.value = []
  loadAttendance(); loadChildExtra()
})
</script>

<style scoped>
/* ══ Base ═══════════════════════════════════════════════ */
.pc-page {
  min-height: 100dvh;
  background: #f0f4f8;
  padding-bottom: 40px;
  font-family: 'Noto Sans Thai', sans-serif;
}

/* ══ Hero Header ══════════════════════════════════════════ */
.pc-hero {
  background: linear-gradient(160deg, #0c2461 0%, #1a5276 50%, #117a65 100%);
  padding: 18px 20px 28px;
  position: relative;
}
.pc-back {
  background: rgba(255,255,255,0.15);
  border: 1.5px solid rgba(255,255,255,0.35);
  color: #fff; border-radius: 12px; padding: 9px 18px;
  font-size: 15px; font-weight: 700; cursor: pointer;
  margin-bottom: 18px; display: inline-block;
  backdrop-filter: blur(6px);
}
.pc-hero-content {
  display: flex; align-items: center; gap: 18px;
}
.pc-avatar-wrap {
  width: 86px; height: 86px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg,#f39c12,#e74c3c);
  border: 4px solid rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
}
.pc-avatar-img     { width:100%; height:100%; object-fit:cover; }
.pc-avatar-initial { font-size: 36px; font-weight: 900; color: #fff; }
.pc-hero-info { flex: 1; }
.pc-hero-name {
  font-size: 22px; font-weight: 900; color: #fff;
  line-height: 1.3; text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.pc-hero-meta { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.pc-hero-badge {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.4);
  color: #fff; font-size: 14px; font-weight: 700;
  padding: 4px 14px; border-radius: 20px;
  backdrop-filter: blur(4px);
}

/* ══ Tab bar ══════════════════════════════════════════════ */
.pc-tabbar {
  display: flex;
  background: #1e293b;
  border-bottom: 3px solid #0f172a;
  position: sticky; top: 0; z-index: 10;
  box-shadow: 0 3px 12px rgba(0,0,0,0.3);
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.pc-tabbar::-webkit-scrollbar { display: none; }
.pc-tab {
  flex-shrink: 0; min-width: 68px;
  display: flex; flex-direction: column; align-items: center;
  padding: 11px 10px 9px; border: none; background: transparent;
  cursor: pointer; color: rgba(255,255,255,0.45);
  transition: all 0.18s; gap: 3px;
}
.pc-tab.active {
  color: #fbbf24;
  border-bottom: 3px solid #fbbf24;
  background: rgba(251,191,36,0.1);
}
.pc-tab-icon  { font-size: 22px; }
.pc-tab-label { font-size: 12px; font-weight: 800; white-space: nowrap; }

/* ══ Body ════════════════════════════════════════════════ */
.pc-body {
  padding: 20px 16px;
  max-width: 860px;
  margin: 0 auto;
}

/* ══ TTS button ══════════════════════════════════════════ */
.pc-tts-btn {
  display: flex; align-items: center; gap: 12px; justify-content: center;
  width: 100%; margin-bottom: 20px;
  background: linear-gradient(135deg,#1565c0,#0d47a1);
  color: #fff; border: none; border-radius: 16px;
  padding: 18px 24px; font-size: 19px; font-weight: 800;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(21,101,192,0.45);
  transition: transform 0.12s, opacity 0.12s;
}
.pc-tts-btn:hover  { opacity: 0.9; transform: translateY(-1px); }
.pc-tts-btn:active { transform: translateY(0); }
.pc-tts-icon { font-size: 24px; }

/* ══ Period pills ════════════════════════════════════════ */
.pc-pills {
  display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap;
}
.pc-pill {
  flex: 1; min-width: 72px;
  padding: 12px 8px; border-radius: 14px;
  border: 2px solid #dde2ea; background: #fff;
  font-size: 15px; font-weight: 700; color: #475569;
  cursor: pointer; transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}
.pc-pill:last-child {
  background: #1e293b; color: #fbbf24; border-color: #fbbf24;
}
.pc-pill.active {
  background: #1e293b; color: #fbbf24; border-color: #fbbf24;
  box-shadow: 0 4px 14px rgba(0,0,0,0.22);
}
.pc-pill:last-child.active {
  background: #fbbf24; color: #1c1917;
}

/* ══ Date range card ════════════════════════════════════ */
.pc-date-card {
  background: #1e293b; border-radius: 18px;
  padding: 18px; margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}
.pc-date-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px; flex-wrap: wrap;
}
.pc-date-lbl { color: #cbd5e1; font-size: 15px; font-weight: 700; white-space: nowrap; }
.pc-date-input {
  flex: 1; min-width: 130px;
  background: #f8fafc; color: #0f172a;
  border: 2px solid #475569; border-radius: 12px;
  padding: 11px 14px; font-size: 15px;
  color-scheme: light;
}
.pc-date-input:focus { outline: none; border-color: #fbbf24; }
.pc-search-btn {
  width: 100%; padding: 15px; border-radius: 14px;
  background: linear-gradient(135deg,#f59e0b,#d97706);
  color: #1c1917; border: none;
  font-size: 17px; font-weight: 800; cursor: pointer;
  box-shadow: 0 4px 14px rgba(245,158,11,0.4);
}
.pc-search-btn:disabled { opacity: 0.55; cursor: not-allowed; }

/* ══ Stat card grid ══════════════════════════════════════
   Mobile  : 2 col (total spans 2, then 2x2)
   ≥560px  : 5 col แถวเดียวครบ ตัวเลขเล็กลงนิด
   ══════════════════════════════════════════════════════ */
.pc-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px; margin-bottom: 24px;
}
/* mobile: total card spans full width */
.pc-card-grid > .pc-card:first-child { grid-column: 1 / -1; }
.pc-card-full { grid-column: 1 / -1; }

@media (min-width: 560px) {
  .pc-card-grid {
    grid-template-columns: repeat(5, 1fr);
  }
  /* desktop: total ไม่ span แล้ว — อยู่ col แรกปกติ */
  .pc-card-grid > .pc-card:first-child { grid-column: auto; }
  .pc-card-full { grid-column: auto; }
  .pc-card-num  { font-size: 40px; }
  .pc-card-lbl  { font-size: 13px; }
  .pc-card      { padding: 18px 8px; }
}

.pc-card {
  border-radius: 20px; padding: 22px 14px; text-align: center;
  border: 2.5px solid transparent;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  transition: transform 0.12s;
}
.pc-card:hover { transform: translateY(-2px); }
.pc-card-num { font-size: 56px; font-weight: 900; line-height: 1; }
.pc-card-lbl { font-size: 16px; font-weight: 700; margin-top: 8px; }
.pc-card-total   { background: linear-gradient(145deg,#0f172a,#1e293b); color: #f1f5f9; border-color: #334155; }
.pc-card-present { background: linear-gradient(145deg,#052e16,#064e3b); color: #4ade80; border-color: #16a34a; }
.pc-card-late    { background: linear-gradient(145deg,#431407,#7c2d12); color: #fb923c; border-color: #ea580c; }
.pc-card-absent  { background: linear-gradient(145deg,#450a0a,#7f1d1d); color: #f87171; border-color: #dc2626; }
.pc-card-leave   { background: linear-gradient(145deg,#172554,#1e3a8a); color: #93c5fd; border-color: #3b82f6; }
.pc-card-pending { background: linear-gradient(145deg,#1c1917,#292524); color: #a8a29e; border-color: #57534e; }

/* ══ Daily records ══════════════════════════════════════ */
.pc-day-list { display: flex; flex-direction: column; gap: 16px; }
.pc-day-card {
  background: #fff; border-radius: 20px; overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.10);
  border: 1.5px solid #e8edf3;
}
.pc-day-head {
  background: linear-gradient(135deg,#1e293b,#334155);
  color: #f1f5f9; font-size: 17px; font-weight: 800;
  padding: 14px 18px;
  display: flex; align-items: center; justify-content: space-between;
}
.pc-late-chip {
  background: #f59e0b; color: #1c1917;
  font-size: 13px; font-weight: 800;
  padding: 4px 12px; border-radius: 20px;
}
.pc-rec {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 16px 13px 20px;
  border-bottom: 1px solid #f1f5f9;
  border-left: 6px solid #e2e8f0;
  font-size: 16px; transition: background 0.1s;
}
.pc-rec:last-child { border-bottom: none; }
.pc-rec:hover { background: #f8fafc; }
.pc-rec-period {
  font-size: 13px; font-weight: 900; color: #475569;
  min-width: 28px; text-align: center;
  background: #f1f5f9; border-radius: 8px;
  padding: 4px 6px; flex-shrink: 0;
}
.pc-rec-icon   { font-size: 22px; flex-shrink: 0; }
.pc-rec-subj   { flex: 1; font-weight: 700; color: #0f172a; display: flex; flex-direction: column; gap: 2px; }
.pc-rec-teacher{ font-size: 13px; font-weight: 500; color: #64748b; }
.pc-rec-status { font-weight: 800; font-size: 14px; white-space: nowrap; }

.rb-ok      { border-left-color: #16a34a; }
.rb-late    { border-left-color: #ea580c; }
.rb-skip    { border-left-color: #dc2626; background: #fff8f8; }
.rb-leave   { border-left-color: #3b82f6; }
.rb-pending { border-left-color: #cbd5e1; background: #f8fafc; }

.sta-ok      { color: #15803d; }
.sta-late    { color: #c2410c; }
.sta-skip    { color: #dc2626; }
.sta-leave   { color: #1d4ed8; }
.sta-pending { color: #94a3b8; font-style: italic; }

/* ══ Score section ══════════════════════════════════════ */
.pc-section-title {
  display: flex; justify-content: space-between; align-items: center;
  background: linear-gradient(135deg,#1e293b,#334155);
  color: #f1f5f9; font-size: 17px; font-weight: 800;
  padding: 14px 18px; border-radius: 16px; margin-bottom: 16px;
  box-shadow: 0 3px 12px rgba(0,0,0,0.2);
}
.pc-term-chip {
  font-size: 13px; color: #94a3b8; font-weight: 600;
  background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 20px;
}
.pc-score-list { display: flex; flex-direction: column; gap: 12px; }
.pc-score-card {
  background: #fff; border-radius: 18px; padding: 18px;
  box-shadow: 0 3px 14px rgba(0,0,0,0.09);
  border: 1.5px solid #e8edf3;
}
.pc-score-subj { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
.pc-score-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.pc-score-chip {
  background: linear-gradient(145deg,#eff6ff,#dbeafe);
  border: 1.5px solid #93c5fd;
  border-radius: 14px; padding: 10px 16px; text-align: center;
  min-width: 64px;
}
.pc-chip-key { font-size: 12px; color: #3b82f6; font-weight: 800; text-transform: uppercase; }
.pc-chip-val { font-size: 28px; font-weight: 900; color: #1d4ed8; line-height: 1.1; }
.pc-score-none { font-size: 14px; color: #94a3b8; font-style: italic; }

/* ══ Behavior section ═══════════════════════════════════ */
.pc-beh-hero {
  display: flex; justify-content: center; margin-bottom: 24px;
}
.pc-beh-circle {
  width: 190px; height: 190px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 8px solid;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.pc-beh-circle-num { font-size: 72px; font-weight: 900; line-height: 1; }
.pc-beh-circle-lbl { font-size: 15px; font-weight: 700; margin-top: 4px; opacity: 0.8; }
.pc-bc-green  { background: linear-gradient(145deg,#052e16,#064e3b); color: #4ade80; border-color: #16a34a; }
.pc-bc-amber  { background: linear-gradient(145deg,#431407,#7c2d12); color: #fb923c; border-color: #f97316; }
.pc-bc-red    { background: linear-gradient(145deg,#450a0a,#7f1d1d); color: #f87171; border-color: #dc2626; }

.pc-beh-grid { display: flex; gap: 12px; margin-bottom: 16px; }
.pc-beh-card {
  flex: 1; border-radius: 18px; padding: 20px 10px; text-align: center;
  border: 2.5px solid transparent;
  box-shadow: 0 4px 16px rgba(0,0,0,0.14);
}
.pc-beh-icon { font-size: 26px; margin-bottom: 6px; }
.pc-beh-num  { font-size: 46px; font-weight: 900; line-height: 1; }
.pc-beh-lbl  { font-size: 13px; font-weight: 700; margin-top: 6px; }
.pc-beh-green  { background: linear-gradient(145deg,#052e16,#064e3b); color: #4ade80; border-color: #16a34a; }
.pc-beh-blue   { background: linear-gradient(145deg,#172554,#1e3a8a); color: #93c5fd; border-color: #3b82f6; }
.pc-beh-purple { background: linear-gradient(145deg,#2e1065,#4c1d95); color: #c4b5fd; border-color: #7c3aed; }
.pc-beh-probation {
  display: flex; align-items: center; gap: 14px;
  background: #fff1f2; border: 2px solid #fca5a5; border-radius: 16px;
  padding: 14px 18px; margin-bottom: 16px;
}
.pc-beh-prob-icon { font-size: 28px; flex-shrink: 0; }
.pc-beh-prob-body { flex: 1; }
.pc-beh-prob-label { font-size: 15px; font-weight: 800; color: #991b1b; }
.pc-beh-prob-note  { font-size: 12px; color: #b91c1c; margin-top: 2px; }
.pc-beh-prob-score { font-size: 32px; font-weight: 900; color: #dc2626; flex-shrink: 0; }

/* ══ Behavior log history ═══════════════════════════════ */
.pc-beh-history { margin-top: 8px; }
.pc-beh-hist-title { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 12px; }
.pc-beh-ftabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.pc-beh-ftab {
  padding: 5px 12px; border-radius: 99px; border: 1.5px solid #e5e7eb;
  background: white; color: #6b7280; font-size: 12px; font-weight: 600; cursor: pointer;
}
.pc-beh-ftab--active { background: #6d28d9; color: white; border-color: #6d28d9; }
.pc-beh-date-row { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.pc-beh-date-input {
  border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 5px 8px;
  font-size: 12px; color: #374151; outline: none; flex: 1; min-width: 0; width: 0;
}
.pc-beh-date-sep { color: #9ca3af; font-size: 12px; flex-shrink: 0; }
.pc-beh-clr-btn {
  border: none; background: #f3f4f6; color: #6b7280;
  border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.pc-beh-sum-row {
  font-size: 12px; color: #6b7280; margin-bottom: 12px;
  padding: 8px 12px; background: #f9fafb; border-radius: 8px;
}
.pc-beh-sum--neg { color: #dc2626; }
.pc-beh-sum--pos { color: #16a34a; }
.pc-beh-empty-log { text-align: center; color: #9ca3af; padding: 16px 0; font-size: 13px; }
.pc-beh-log-list { display: flex; flex-direction: column; gap: 8px; }
.pc-beh-log-item {
  display: flex; align-items: stretch;
  background: #f9fafb; border-radius: 14px; overflow: hidden;
  border: 1px solid #f3f4f6;
}
.pc-beh-log-dot {
  min-width: 52px; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900; padding: 12px 4px;
}
.pc-beh-dot--pos { background: #dcfce7; color: #15803d; }
.pc-beh-dot--neg { background: #fee2e2; color: #dc2626; }
.pc-beh-log-body {
  flex: 1; padding: 10px 12px; border-left: 1px solid #f3f4f6;
  display: flex; flex-direction: column; justify-content: center; gap: 2px;
}
.pc-beh-log-label { font-size: 13px; font-weight: 700; color: #1e1b4b; line-height: 1.4; }
.pc-beh-log-note  { font-size: 12px; color: #6b7280; line-height: 1.4; }
.pc-beh-log-imgs  { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.pc-beh-log-img   { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1.5px solid #e5e7eb; cursor: pointer; }
.pc-beh-log-meta  { display: flex; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
.pc-beh-log-date    { font-size: 12px; font-weight: 600; color: #7c3aed; }
.pc-beh-log-sep     { font-size: 11px; color: #d1d5db; }
.pc-beh-log-teacher { font-size: 12px; color: #6b7280; }

/* ══ Empty ══════════════════════════════════════════════ */
.pc-empty {
  text-align: center; padding: 48px 24px;
  font-size: 19px; color: #64748b;
  background: #fff; border-radius: 20px;
  box-shadow: 0 3px 14px rgba(0,0,0,0.08);
  border: 1.5px solid #e8edf3;
}

/* ══ Subject Attendance Tab (copy from StudentAttendanceView) ═══ */
.sa-center { text-align:center; color:#9ca3af; padding:40px 0; }
.sa-total-card { background:white; border-radius:16px; padding:18px; box-shadow:0 2px 12px rgba(0,0,0,.07); margin-bottom:16px; }
.sa-total-title { font-size:15px; font-weight:700; color:#374151; margin-bottom:12px; }
.sa-total-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.sa-total-cell { border-radius:12px; padding:12px 6px; text-align:center; }
.sa-tc-num { font-size:28px; font-weight:900; line-height:1; }
.sa-tc-lbl { font-size:11px; margin-top:4px; }
.c-attend2  { background:#dcfce7; color:#166534; }
.c-late2    { background:#fef9c3; color:#854d0e; }
.c-sick2    { background:#dbeafe; color:#1e40af; }
.c-leave2   { background:#ede9fe; color:#5b21b6; }
.c-absent2  { background:#fef2f2; color:#b91c1c; }
.c-pending2 { background:#f1f5f9; color:#64748b; }
.c-all2     { background:#f3f4f6; color:#374151; }
.sa-empty-card { background:white; border-radius:16px; padding:40px 20px; text-align:center; box-shadow:0 2px 12px rgba(0,0,0,.07); }
.sa-empty-icon { font-size:40px; margin-bottom:10px; }
.sa-empty-text { font-size:15px; color:#9ca3af; }
.sa-subject-card { background:white; border-radius:18px; padding:18px; box-shadow:0 2px 12px rgba(0,0,0,.07); margin-bottom:14px; }
.sa-sub-header { margin-bottom:14px; display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
.sa-sub-header-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.sa-tts-btn { background:none; border:1px solid #e2e8f0; border-radius:8px; padding:4px 8px; font-size:14px; cursor:pointer; }
.sa-tts-btn:active { background:#f1f5f9; }
.sa-summary-card { background:white; border-radius:16px; padding:16px; box-shadow:0 2px 12px rgba(0,0,0,.07); margin-bottom:14px; }
.sa-tts-summary-btn { width:100%; padding:10px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; margin-bottom:12px; }
.sa-summary-row { display:flex; gap:8px; }
.sa-summary-chip { flex:1; border-radius:12px; padding:10px 8px; text-align:center; }
.sa-sum--danger { background:#fee2e2; }
.sa-sum--warn   { background:#fef3c7; }
.sa-sum--ok     { background:#d1fae5; }
.sa-sum-num { font-size:22px; font-weight:800; line-height:1; }
.sa-sum-lbl { font-size:10px; color:#64748b; margin-top:2px; }
.sa-sub-name { font-size:18px; font-weight:800; color:#1e1b4b; margin-bottom:4px; }
.sa-sub-meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.sa-sub-teacher { font-size:13px; color:#6b7280; }
.sa-section-lbl { font-size:13px; font-weight:700; color:#6366f1; margin-bottom:10px; text-transform:uppercase; letter-spacing:.5px; }
.sa-no-data { font-size:14px; color:#9ca3af; padding:6px 0 4px; font-style:italic; }
.sa-attend-chips { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px; }
.sa-chip { border-radius:10px; padding:10px 6px; text-align:center; }
.sa-chip-num { display:block; font-size:24px; font-weight:900; line-height:1; }
.sa-chip-lbl { display:block; font-size:11px; margin-top:3px; }
.sa-bar-track { height:20px; background:#f1f5f9; border-radius:99px; overflow:hidden; margin-bottom:8px; display:flex; }
.sa-seg { height:100%; transition:width .4s; }
.sa-seg-attend { background:linear-gradient(90deg,#16a34a,#22c55e); }
.sa-seg-absent { background:linear-gradient(90deg,#dc2626,#ef4444); }
.sa-pct-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.sa-pct-label { display:flex; align-items:center; gap:10px; }
.sa-pct-attend { font-size:15px; font-weight:700; color:#166534; }
.sa-pct-num    { font-size:18px; font-weight:900; color:#1f2937; }
.sa-ms-badge { font-size:13px; font-weight:800; padding:4px 14px; border-radius:10px; white-space:nowrap; }
.sa-ms--pass { background:#dcfce7; color:#166534; }
.sa-ms--fail { background:#fef2f2; color:#b91c1c; }
.sa-scores-row { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
.sa-score-chip { border-radius:14px; padding:12px 8px 10px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:2px; }
.sa-sc-filled { background:#f0fdf4; border:1.5px solid #bbf7d0; }
.sa-sc-empty  { background:#f9fafb; border:1.5px solid #e5e7eb; }
.sa-sc-label  { font-size:11px; font-weight:600; color:#9ca3af; margin-bottom:2px; }
.sa-sc-val    { font-size:26px; font-weight:900; color:#15803d; line-height:1; }
.sa-sc-empty .sa-sc-val { color:#d1d5db; font-size:22px; }
.sa-sc-max-lbl { font-size:11px; color:#9ca3af; margin-bottom:4px; }
.sa-sc-bar-track { width:100%; height:5px; background:#e5e7eb; border-radius:99px; overflow:hidden; margin-top:2px; }
.sa-sc-bar-fill  { height:100%; background:linear-gradient(90deg,#16a34a,#22c55e); border-radius:99px; transition:width .3s; }
.sa-score-total-row { display:flex; align-items:center; justify-content:space-between; background:#f8fafc; border-radius:12px; padding:12px 16px; gap:8px; }
.sa-total-left { display:flex; align-items:baseline; gap:4px; }
.sa-total-num  { font-size:28px; font-weight:900; color:#1f2937; }
.sa-total-sep  { font-size:18px; color:#9ca3af; }
.sa-total-max  { font-size:20px; font-weight:700; color:#6b7280; }
.sa-total-lbl  { font-size:13px; color:#9ca3af; margin-left:4px; }
.sa-pass-tag { font-size:14px; font-weight:800; padding:6px 16px; border-radius:10px; }
.sa-pass--pass { background:#dcfce7; color:#166534; }
.sa-pass--warn { background:#fef9c3; color:#854d0e; }

/* ══ Timetable Tab ══════════════════════════════════════ */
.pc-tt-daytabs {
  display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;
}
.pc-tt-daytab {
  flex-shrink: 0; padding: 8px 18px; border-radius: 20px;
  border: 2px solid #fde68a; background: white; color: #92400e;
  font-size: 15px; font-weight: 700; cursor: pointer; transition: all .15s;
}
.pc-tt-daytab.active { background: #b45309; color: white; border-color: #b45309; }

.pc-tt-periods { display: flex; flex-direction: column; gap: 10px; }

.pc-tt-card {
  display: flex; align-items: flex-start; gap: 12px;
  background: white; border-radius: 14px; padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(146,64,14,.1);
  border-left: 5px solid #fbbf24;
}
.pc-tt-sub  { border-left-color: #b45309; }
.pc-tt-act  { border-left-color: #d97706; }
.pc-tt-lock { border-left-color: #9ca3af; }

.pc-tt-period-num {
  min-width: 48px; font-size: 13px; font-weight: 700; color: #b45309;
  background: #fef3c7; border-radius: 8px; padding: 4px 8px;
  text-align: center; flex-shrink: 0;
}
.pc-tt-info   { flex: 1; min-width: 0; }
.pc-tt-subject { font-size: 16px; font-weight: 800; color: #1f2937; }
.pc-tt-teacher { font-size: 13px; color: #6b7280; margin-top: 4px; }
.pc-tt-room    { font-size: 12px; color: #9ca3af; margin-top: 2px; }

/* ══ Messages Tab ════════════════════════════════════════ */
.pc-msg-readonly-banner {
  background: #fef3c7; border: 1.5px solid #fcd34d;
  border-radius: 12px; padding: 10px 16px; font-size: 13px; font-weight: 700;
  color: #92400e; margin-bottom: 16px; text-align: center;
}
.pc-msg-list { display: flex; flex-direction: column; gap: 12px; }
.pc-msg-item {
  background: #fff; border-radius: 16px; padding: 16px 18px;
  box-shadow: 0 3px 12px rgba(0,0,0,0.08); border: 1.5px solid #e8edf3;
  border-left: 5px solid #0f766e;
}
.pc-msg-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px; flex-wrap: wrap; gap: 4px;
}
.pc-msg-teacher { font-size: 13px; font-weight: 800; color: #0f766e; }
.pc-msg-time    { font-size: 11px; color: #94a3b8; }
.pc-msg-body    { font-size: 15px; color: #1e293b; line-height: 1.7; white-space: pre-wrap; }
.pc-msg-atts    { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.pc-msg-att-img {
  max-width: 160px; max-height: 140px; border-radius: 10px; object-fit: cover;
  cursor: pointer; border: 1.5px solid #e2e8f0;
}
.pc-msg-att-file {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px;
  background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px;
  text-decoration: none; font-size: 13px; font-weight: 600; color: #15803d;
}

/* ══ Check-in Tab ════════════════════════════════════════ */
.pc-ci-list { display: flex; flex-direction: column; gap: 12px; }
.pc-ci-item {
  background: #fff; border-radius: 16px; padding: 16px;
  box-shadow: 0 3px 12px rgba(0,0,0,0.08); border: 1.5px solid #e8edf3;
  display: flex; align-items: flex-start; gap: 14px;
}
.pc-ci-left  { flex: 1; min-width: 0; }
.pc-ci-date  { font-size: 15px; font-weight: 800; color: #0f172a; }
.pc-ci-time  { font-size: 20px; font-weight: 900; color: #0f766e; margin: 2px 0 6px; }
.pc-ci-dist  { font-size: 13px; color: #475569; margin-bottom: 4px; }
.pc-ci-face  { font-size: 12px; font-weight: 700; }
.pc-ci-right { flex-shrink: 0; }
.pc-ci-selfie {
  width: 80px; height: 80px; border-radius: 12px; object-fit: cover;
  cursor: pointer; border: 2px solid #e2e8f0;
}
.pc-ci-no-selfie {
  width: 80px; height: 80px; border-radius: 12px;
  background: #f1f5f9; display: flex; align-items: center; justify-content: center;
  font-size: 28px; color: #94a3b8;
}

/* ══ Lightbox ════════════════════════════════════════════ */
.pc-lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  z-index: 9999; display: flex; align-items: center; justify-content: center;
}
.pc-lightbox-img {
  max-width: 95vw; max-height: 90vh; border-radius: 12px; object-fit: contain;
}
.pc-lightbox-close {
  position: absolute; top: 20px; right: 20px;
  background: rgba(255,255,255,0.15); border: none; color: #fff;
  width: 40px; height: 40px; border-radius: 50%; font-size: 18px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
</style>
