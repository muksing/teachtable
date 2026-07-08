<template>
  <AppLayout>
    <div class="hd-page" v-loading="loading">

      <!-- ── Header ────────────────────────────────────────────── -->
      <div class="hd-header">
        <div class="hd-header-left">
          <div class="hd-class-badge">{{ homeroomClass }}</div>
          <div>
            <h1 class="hd-title">📋 Dashboard ห้องประจำชั้น</h1>
            <p class="hd-sub">ครูที่ปรึกษา: {{ myName }} · {{ schoolStore.termLabel }}</p>
          </div>
        </div>
        <div class="hd-header-right">
          <el-button size="small" plain @click="loadData">🔄 รีเฟรช</el-button>
          <el-button size="small" plain @click="$router.push('/reports/attendance')">📊 รายงานเต็ม</el-button>
        </div>
      </div>

      <!-- ── ข่าวสารประชาสัมพันธ์ (always visible) ───────────────── -->
      <AnnSlideshow
        :items="announcements"
        :new-threshold="newsNewThreshold"
      >
        <template #title>
          ข่าวสารประชาสัมพันธ์
          <span v-if="unreadNewsCount > 0" class="hd-badge hd-badge--orange">{{ unreadNewsCount }} ใหม่</span>
        </template>
      </AnnSlideshow>

      <!-- ── Main tab nav ───────────────────────────────────────── -->

      <div class="hd-main-tabs">
        <button class="hd-main-tab hd-tab--attendance" :class="{ 'hd-main-tab--active': mainTab === 'attendance' }"
          @click="mainTab = 'attendance'">
          <span class="hd-tab-icon">📊</span>
          <span class="hd-tab-label">เวลาเรียน</span>
        </button>
        <button class="hd-main-tab hd-tab--deeds" :class="{ 'hd-main-tab--active': mainTab === 'deeds' }"
          @click="mainTab = 'deeds'; loadGoodDeeds()">
          <span class="hd-tab-icon">🌟</span>
          <span class="hd-tab-label">ความดี<span v-if="pendingDeedsCount > 0" class="hd-badge hd-badge--green">{{ pendingDeedsCount }}</span></span>
        </button>
        <button class="hd-main-tab hd-tab--messages" :class="{ 'hd-main-tab--active': mainTab === 'messages' }"
          @click="mainTab = 'messages'; loadMsgConvos()">
          <span class="hd-tab-icon">💬</span>
          <span class="hd-tab-label">ข้อความ<span v-if="unreadMsgCount > 0" class="hd-badge hd-badge--red">{{ unreadMsgCount }}</span></span>
        </button>
        <button class="hd-main-tab hd-tab--checkin" :class="{ 'hd-main-tab--active': mainTab === 'checkin' }"
          @click="mainTab = 'checkin'; loadCiStudents(); loadCiReport()">
          <span class="hd-tab-icon">🏫</span>
          <span class="hd-tab-label">เช็คอิน</span>
        </button>
      </div>

      <!-- ── Check-in Dashboard (tab content) ──────────────────── -->
      <div v-show="mainTab === 'checkin'" class="ci-section">
        <div class="ci-section-head">
          <div class="ci-section-title">⏰ เช็คอินนักเรียน</div>
          <div class="ci-date-nav">
            <button class="ci-nav-btn" @click="ciPrevDay">‹</button>
            <span class="ci-date-label">{{ fmtCiDate(ciDate) }}</span>
            <button class="ci-nav-btn" @click="ciNextDay" :disabled="ciDate >= thaiToday()">›</button>
            <button class="ci-nav-today" @click="ciGoToday">วันนี้</button>
          </div>
        </div>

        <!-- Non-school-day warning -->
        <div v-if="ciIsNonSchoolDay" class="ci-nonschool-banner">
          ⛔ วันนี้ไม่ใช่วันเปิดทำการ (เสาร์-อาทิตย์ หรือวันหยุด)
        </div>

        <!-- Stats bar -->
        <div class="ci-stats-row" v-loading="ciLoading">
          <div class="ci-stat ci-stat--green"><span class="ci-stat-n">{{ ciOntime }}</span><span class="ci-stat-l">มาทัน</span></div>
          <div class="ci-stat ci-stat--amber"><span class="ci-stat-n">{{ ciLate }}</span><span class="ci-stat-l">มาสาย</span></div>
          <div class="ci-stat ci-stat--red"><span class="ci-stat-n">{{ ciAbsent }}</span><span class="ci-stat-l">ยังไม่เช็คอิน</span></div>
          <div class="ci-stat ci-stat--gray"><span class="ci-stat-n">{{ ciStudents.length }}</span><span class="ci-stat-l">ทั้งหมด</span></div>
        </div>

        <!-- Progress bar -->
        <div class="ci-progress-wrap">
          <div class="ci-progress-bar">
            <div class="ci-bar-ontime" :style="`width:${ciPct(ciOntime)}%`"></div>
            <div class="ci-bar-late"   :style="`width:${ciPct(ciLate)}%`"></div>
          </div>
          <span class="ci-pct-text">{{ ciPct(ciOntime+ciLate) }}% เช็คอินแล้ว</span>
        </div>

        <!-- Filter chips + select toggle -->
        <div class="ci-filter-row">
          <button :class="['ci-chip', ciFilter === 'all' ? 'ci-chip--active' : '']" @click="ciFilter = 'all'">ทั้งหมด ({{ ciStudents.length }})</button>
          <button :class="['ci-chip ci-chip--green', ciFilter === 'checked' ? 'ci-chip--active' : '']" @click="ciFilter = 'checked'">✅ เช็คอิน ({{ ciOntime + ciLate }})</button>
          <button :class="['ci-chip ci-chip--red', ciFilter === 'absent' ? 'ci-chip--active' : '']" @click="ciFilter = 'absent'">❌ ยังไม่มา ({{ ciAbsent }})</button>
          <button :class="['ci-chip ci-chip--purple', ciSelectMode ? 'ci-chip--active' : '']" style="margin-left:auto" @click="toggleSelectMode">
            {{ ciSelectMode ? `✓ ยกเลิก (${ciSelected.size})` : '☑ เลือกหลายคน' }}
          </button>
        </div>

        <!-- Student list — 2-column for มาทัน/มาสาย, full-width for ยังไม่มา -->
        <div v-if="!ciLoading && !ciFilteredStudents.length" class="ci-empty">ไม่พบข้อมูลนักเรียน</div>

        <div v-if="ciFilter !== 'absent' && (ciFilteredOntime.length > 0 || ciFilteredLate.length > 0)" class="ci-two-col">

          <!-- ══ คอลัมน์ มาทัน ══ -->
          <div v-if="ciFilteredOntime.length > 0" class="ci-col">
            <div class="ci-group-header ci-group-header--ontime">
              <label v-if="ciSelectMode" class="ci-group-check-label" @click.stop>
                <input type="checkbox"
                  :checked="ciGroupAllChecked('ontime')"
                  :indeterminate.prop="ciGroupIndeterminate('ontime')"
                  @change="toggleCiGroupAll('ontime')" class="ci-checkbox" />
              </label>
              <span>✅ มาทัน</span>
              <span class="ci-group-count">{{ ciFilteredOntime.length }}</span>
              <span v-if="ciSelectMode && ciGroupSelectedCount('ontime') > 0" class="ci-group-selected-badge">{{ ciGroupSelectedCount('ontime') }}</span>
              <button v-if="ciSelectMode && ciGroupSelectedCount('ontime') > 0" class="ci-group-action-btn" @click.stop="openBulkFromGroup('ontime')">⭐</button>
            </div>
            <div class="ci-col-rows">
              <div
                v-for="s in ciFilteredOntime" :key="s.student_code"
                class="ci-row ci-row--ontime"
                :class="[!ciSelectMode ? 'ci-row--clickable' : 'ci-row--selectable', ciSelected.has(s.student_code) ? 'ci-row--selected' : '']"
                @click="ciSelectMode ? toggleCiSelect(s) : openCiDetail(s)"
              >
                <input v-if="ciSelectMode" type="checkbox" :checked="ciSelected.has(s.student_code)" @click.stop @change="toggleCiSelect(s)" class="ci-checkbox" />
                <div class="ci-avatar">
                  <img v-if="s.photo_url" :src="fixPhotoUrl(s.photo_url)" class="ci-avatar-img" @error="e => e.target.style.display='none'" />
                  <span v-else>{{ (s.first_name||'?')[0] }}</span>
                </div>
                <div class="ci-row-name">{{ s.prefix }}{{ s.first_name }} {{ s.last_name }}</div>
                <div v-if="s.checkin?.selfie_url" class="ci-selfie-thumb" title="รูปเช็คอิน" @click.stop="viewingPhoto = s.checkin.selfie_url">
                  <img :src="fixPhotoUrl(s.checkin.selfie_url)" class="ci-avatar-img" @error="e => e.target.parentElement.style.display='none'" />
                </div>
                <div v-else class="ci-selfie-empty"></div>
                <div class="ci-row-time">{{ fmtTime(s.checkin.checkin_time) }}</div>
                <button v-if="!ciSelectMode" class="ci-score-btn" title="บันทึกคะแนน" @click.stop="openCiBehavior(s)">⭐</button>
              </div>
            </div>
          </div>

          <!-- ══ คอลัมน์ มาสาย ══ -->
          <div v-if="ciFilteredLate.length > 0" class="ci-col">
            <div class="ci-group-header ci-group-header--late">
              <label v-if="ciSelectMode" class="ci-group-check-label" @click.stop>
                <input type="checkbox"
                  :checked="ciGroupAllChecked('late')"
                  :indeterminate.prop="ciGroupIndeterminate('late')"
                  @change="toggleCiGroupAll('late')" class="ci-checkbox" />
              </label>
              <span>⚠️ มาสาย</span>
              <span class="ci-group-count">{{ ciFilteredLate.length }}</span>
              <span v-if="ciSelectMode && ciGroupSelectedCount('late') > 0" class="ci-group-selected-badge">{{ ciGroupSelectedCount('late') }}</span>
              <button v-if="ciSelectMode && ciGroupSelectedCount('late') > 0" class="ci-group-action-btn" @click.stop="openBulkFromGroup('late')">⭐</button>
            </div>
            <div class="ci-col-rows">
              <div
                v-for="s in ciFilteredLate" :key="s.student_code"
                class="ci-row ci-row--late"
                :class="[!ciSelectMode ? 'ci-row--clickable' : 'ci-row--selectable', ciSelected.has(s.student_code) ? 'ci-row--selected' : '']"
                @click="ciSelectMode ? toggleCiSelect(s) : openCiDetail(s)"
              >
                <input v-if="ciSelectMode" type="checkbox" :checked="ciSelected.has(s.student_code)" @click.stop @change="toggleCiSelect(s)" class="ci-checkbox" />
                <div class="ci-avatar">
                  <img v-if="s.photo_url" :src="fixPhotoUrl(s.photo_url)" class="ci-avatar-img" @error="e => e.target.style.display='none'" />
                  <span v-else>{{ (s.first_name||'?')[0] }}</span>
                </div>
                <div class="ci-row-name">{{ s.prefix }}{{ s.first_name }} {{ s.last_name }}</div>
                <div v-if="s.checkin?.selfie_url" class="ci-selfie-thumb" title="รูปเช็คอิน" @click.stop="viewingPhoto = s.checkin.selfie_url">
                  <img :src="fixPhotoUrl(s.checkin.selfie_url)" class="ci-avatar-img" @error="e => e.target.parentElement.style.display='none'" />
                </div>
                <div v-else class="ci-selfie-empty"></div>
                <div class="ci-row-time ci-row-time--late">{{ fmtTime(s.checkin.checkin_time) }}</div>
                <button v-if="!ciSelectMode" class="ci-score-btn" title="บันทึกคะแนน" @click.stop="openCiBehavior(s)">⭐</button>
              </div>
            </div>
          </div>

        </div>

        <!-- ══ ยังไม่เช็คอิน (full width) ══ -->
        <div v-if="ciFilteredAbsent.length > 0 && ciFilter !== 'checked'" class="ci-absent-section">
          <div class="ci-group-header ci-group-header--absent">
            <label v-if="ciSelectMode" class="ci-group-check-label" @click.stop>
              <input type="checkbox"
                :checked="ciGroupAllChecked('absent')"
                :indeterminate.prop="ciGroupIndeterminate('absent')"
                @change="toggleCiGroupAll('absent')" class="ci-checkbox" />
            </label>
            <span>❌ ยังไม่เช็คอิน</span>
            <span class="ci-group-count">{{ ciFilteredAbsent.length }}</span>
            <span v-if="ciSelectMode && ciGroupSelectedCount('absent') > 0" class="ci-group-selected-badge">{{ ciGroupSelectedCount('absent') }}</span>
            <button v-if="ciSelectMode && ciGroupSelectedCount('absent') > 0" class="ci-group-action-btn" @click.stop="openBulkFromGroup('absent')">⭐ บันทึกคะแนน</button>
          </div>
          <div class="ci-absent-rows">
            <div
              v-for="s in ciFilteredAbsent" :key="s.student_code"
              class="ci-row ci-row--absent"
              :class="[ciSelectMode ? 'ci-row--selectable' : '', ciSelected.has(s.student_code) ? 'ci-row--selected' : '']"
              @click="ciSelectMode ? toggleCiSelect(s) : null"
            >
              <input v-if="ciSelectMode" type="checkbox" :checked="ciSelected.has(s.student_code)" @click.stop @change="toggleCiSelect(s)" class="ci-checkbox" />
              <div class="ci-avatar">
                <img v-if="s.photo_url" :src="fixPhotoUrl(s.photo_url)" class="ci-avatar-img" @error="e => e.target.style.display='none'" />
                <span v-else>{{ (s.first_name||'?')[0] }}</span>
              </div>
              <div class="ci-row-name">{{ s.prefix }}{{ s.first_name }} {{ s.last_name }}</div>
              <div class="ci-row-absent">ยังไม่เช็คอิน</div>
            </div>
          </div>
        </div>

        <!-- Bulk action bar -->
        <transition name="ci-bulk-slide">
          <div v-if="ciSelectMode && ciSelected.size > 0" class="ci-bulk-bar">
            <div class="ci-bulk-title">
              เลือกแล้ว {{ ciSelected.size }} คน
              <span v-if="ciGroupSelectedCount('ontime') > 0" class="ci-bulk-tag ci-bulk-tag--ontime">✅ มาทัน {{ ciGroupSelectedCount('ontime') }}</span>
              <span v-if="ciGroupSelectedCount('late') > 0"   class="ci-bulk-tag ci-bulk-tag--late">⚠️ มาสาย {{ ciGroupSelectedCount('late') }}</span>
              <span v-if="ciGroupSelectedCount('absent') > 0" class="ci-bulk-tag ci-bulk-tag--absent">❌ ไม่มา {{ ciGroupSelectedCount('absent') }}</span>
            </div>
            <div class="ci-bulk-presets">
              <button class="ci-preset ci-preset--pos" @click="applyBulkPreset(1,'มาเรียนตรงเวลา')">+1 มาตรงเวลา</button>
              <button class="ci-preset ci-preset--neg" @click="applyBulkPreset(-1,'มาเรียนสาย')">-1 มาสาย</button>
              <button class="ci-preset ci-preset--pos" @click="applyBulkPreset(2,'มาเรียนสม่ำเสมอ')">+2 สม่ำเสมอ</button>
              <button class="ci-preset ci-preset--neg" @click="applyBulkPreset(-2,'ขาดเรียนบ่อย')">-2 ขาดบ่อย</button>
              <button class="ci-preset ci-preset--pos" @click="openBulkCustom">✏️ กำหนดเอง</button>
            </div>
          </div>
        </transition>

        <!-- Bulk custom dialog -->
        <el-dialog v-model="ciBulkDialog.visible" title="บันทึกคะแนนหลายคนพร้อมกัน" width="360px" align-center>
          <div class="ci-bdialog">
            <div class="ci-bdialog-info">
              เลือกไว้ <strong>{{ ciSelected.size }} คน</strong>
            </div>
            <div class="ci-bdialog-presets">
              <button class="ci-preset ci-preset--pos" @click="ciBulkDialog.points = 1; ciBulkDialog.label = 'มาเรียนตรงเวลา'">+1 มาตรงเวลา</button>
              <button class="ci-preset ci-preset--neg" @click="ciBulkDialog.points = -1; ciBulkDialog.label = 'มาเรียนสาย'">-1 มาสาย</button>
              <button class="ci-preset ci-preset--pos" @click="ciBulkDialog.points = 2; ciBulkDialog.label = 'มาเรียนสม่ำเสมอ'">+2 สม่ำเสมอ</button>
              <button class="ci-preset ci-preset--neg" @click="ciBulkDialog.points = -2; ciBulkDialog.label = 'ขาดเรียนบ่อย'">-2 ขาดบ่อย</button>
            </div>
            <div class="ci-bdialog-row">
              <label class="ci-bdialog-lbl">คะแนน</label>
              <el-input-number v-model="ciBulkDialog.points" :min="-20" :max="20" style="width:100%" />
            </div>
            <div class="ci-bdialog-row">
              <label class="ci-bdialog-lbl">หัวข้อ</label>
              <el-input v-model="ciBulkDialog.label" placeholder="หัวข้อพฤติกรรม" />
            </div>
            <el-button type="primary" :loading="ciBulkDialog.submitting" style="width:100%;margin-top:14px" @click="submitCiBulk">
              บันทึก {{ ciSelected.size }} คน
            </el-button>
          </div>
        </el-dialog>

        <!-- Behavior Score Dialog -->
        <el-dialog v-model="ciBehaviorDialog.visible" title="บันทึกคะแนนพฤติกรรม" width="340px" align-center>
          <div v-if="ciBehaviorDialog.student" class="ci-bdialog">
            <div class="ci-bdialog-name">{{ ciBehaviorDialog.student.prefix }}{{ ciBehaviorDialog.student.first_name }} {{ ciBehaviorDialog.student.last_name }}</div>
            <div class="ci-bdialog-status" :class="`ci-bdialog-status--${ciBehaviorDialog.student.status}`">
              {{ ciBehaviorDialog.student.status === 'ontime' ? '✅ มาทัน' : '⚠️ มาสาย' }} · {{ fmtTime(ciBehaviorDialog.student.checkin?.checkin_time) }} น.
            </div>
            <div class="ci-bdialog-presets">
              <button class="ci-preset ci-preset--pos" @click="ciBehaviorDialog.points = 1; ciBehaviorDialog.label = 'มาเรียนตรงเวลา'">+1 มาตรงเวลา</button>
              <button class="ci-preset ci-preset--neg" @click="ciBehaviorDialog.points = -1; ciBehaviorDialog.label = 'มาเรียนสาย'">-1 มาสาย</button>
              <button class="ci-preset ci-preset--pos" @click="ciBehaviorDialog.points = 2; ciBehaviorDialog.label = 'มาเรียนสม่ำเสมอ'">+2 สม่ำเสมอ</button>
              <button class="ci-preset ci-preset--neg" @click="ciBehaviorDialog.points = -2; ciBehaviorDialog.label = 'ขาดเรียนบ่อย'">-2 ขาดบ่อย</button>
            </div>
            <div class="ci-bdialog-row">
              <label class="ci-bdialog-lbl">คะแนน</label>
              <el-input-number v-model="ciBehaviorDialog.points" :min="-20" :max="20" style="width:100%" />
            </div>
            <div class="ci-bdialog-row">
              <label class="ci-bdialog-lbl">หัวข้อ</label>
              <el-input v-model="ciBehaviorDialog.label" placeholder="หัวข้อพฤติกรรม" />
            </div>
            <el-button type="primary" :loading="ciBehaviorDialog.submitting" style="width:100%;margin-top:14px" @click="submitCiBehavior">บันทึกคะแนน</el-button>
          </div>
        </el-dialog>

        <!-- Check-in Detail Dialog -->
        <el-dialog
          v-model="ciDetailOpen"
          :title="ciDetailStudent ? `${ciDetailStudent.prefix}${ciDetailStudent.first_name} ${ciDetailStudent.last_name}` : ''"
          width="360px"
          align-center
          @closed="destroyCiMap"
        >
          <div v-if="ciDetailStudent" class="ci-detail">
            <div class="ci-detail-status" :class="`ci-detail-status--${ciDetailStudent.status}`">
              {{ ciDetailStudent.status === 'ontime' ? '✅ มาทัน' : '⚠️ มาสาย' }}
              &nbsp;·&nbsp; {{ fmtTime(ciDetailStudent.checkin?.checkin_time) }} น.
            </div>
            <div class="ci-detail-body">
              <div class="ci-detail-selfie-col">
                <img v-if="ciDetailStudent.checkin?.selfie_url" :src="fixPhotoUrl(ciDetailStudent.checkin.selfie_url)" class="ci-detail-selfie" />
                <div v-else class="ci-detail-no-selfie">📷</div>
              </div>
              <div v-if="ciDetailStudent.checkin?.lat" class="ci-detail-gps">
                <div class="ci-detail-gps-row"><span>📍 ระยะ</span><strong>{{ ciDetailStudent.checkin.distance_m != null ? ciDetailStudent.checkin.distance_m + ' ม.' : '-' }}</strong></div>
                <div class="ci-detail-gps-row"><span>Lat</span><span class="ci-detail-coord">{{ Number(ciDetailStudent.checkin.lat).toFixed(5) }}</span></div>
                <div class="ci-detail-gps-row"><span>Lng</span><span class="ci-detail-coord">{{ Number(ciDetailStudent.checkin.lng).toFixed(5) }}</span></div>
                <a :href="`https://maps.google.com/?q=${ciDetailStudent.checkin.lat},${ciDetailStudent.checkin.lng}`" target="_blank" class="ci-detail-map-link">🗺️ Google Maps</a>
              </div>
            </div>
            <div v-if="ciDetailStudent.checkin?.lat" ref="ciDetailMapEl" class="ci-detail-map"></div>
          </div>
        </el-dialog>

        <!-- Report tabs -->
        <el-tabs v-model="ciReportTab" class="ci-report-tabs mt-3" @tab-change="loadCiReport">
          <el-tab-pane label="รายสัปดาห์" name="weekly">
            <div class="ci-report-table">
              <div class="ci-report-head"><span>วัน</span><span>เช็คอิน</span><span>มาสาย</span><span>ขาด</span><span>%</span></div>
              <div v-for="d in ciWeekDays" :key="d.date" class="ci-report-row" :class="d.date === ciDate ? 'ci-report-row--today' : ''">
                <span>{{ d.label }}</span>
                <span class="ci-col--green">{{ d.ontime }}</span>
                <span class="ci-col--amber">{{ d.late }}</span>
                <span class="ci-col--red">{{ d.total - d.checkedIn }}</span>
                <span class="ci-col--gray">{{ d.total ? Math.round(d.checkedIn/d.total*100) : 0 }}%</span>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="รายเดือน" name="monthly">
            <div class="ci-month-grid">
              <div v-for="d in ciMonthDays" :key="d.date" class="ci-month-cell"
                :class="[`ci-month-cell--${d.checkedIn >= d.total*0.8 ? 'good' : d.checkedIn > 0 ? 'partial' : 'none'}`, d.date === ciDate ? 'ci-month-cell--today' : '']">
                <div class="ci-month-num">{{ d.label }}</div>
                <div class="ci-month-pct">{{ d.total ? Math.round(d.checkedIn/d.total*100) : 0 }}%</div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="รายเทอม" name="term">
            <div class="ci-report-table">
              <div class="ci-report-head"><span>สัปดาห์</span><span>เช็คอิน</span><span>สาย</span><span>%</span></div>
              <div v-for="w in ciTermWeeks" :key="w.weekStart" class="ci-report-row">
                <span>{{ fmtWeekLabel(w.weekStart) }}</span>
                <span class="ci-col--green">{{ w.ontime }}</span>
                <span class="ci-col--amber">{{ w.late }}</span>
                <span class="ci-col--gray">{{ w.days && w.total ? Math.round(w.checkedIn/(w.days*w.total)*100) : 0 }}%</span>
              </div>
              <div v-if="!ciTermWeeks.length" class="ci-empty">ไม่มีข้อมูล</div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- ── Period tabs ─────────────────────────────────────── -->
      <div v-show="mainTab === 'attendance'" class="hd-period-row mb-5">
        <span class="hd-period-label">🗓 ช่วงเวลา</span>
        <div class="hd-period-tabs">
          <button v-for="p in PERIODS" :key="p.key"
            class="hd-period-btn" :class="{ 'hd-period-btn--active': period === p.key }"
            @click="period = p.key; loadData()">{{ p.label }}</button>
        </div>
      </div>

      <!-- ── Summary cards ──────────────────────────────────── -->
      <div v-show="mainTab === 'attendance'" class="hd-cards mb-5">
        <div class="hd-card hd-card--green">
          <div class="hd-card-num">{{ avgPct.toFixed(1) }}%</div>
          <div class="hd-card-lbl">เฉลี่ยมาเรียน</div>
        </div>
        <div class="hd-card hd-card--red">
          <div class="hd-card-num">{{ atRiskCount }}</div>
          <div class="hd-card-lbl">เสี่ยงหมดสิทธิ์ (&lt;{{ wSettings.attendance_pct }}%)</div>
        </div>
        <div class="hd-card hd-card--orange">
          <div class="hd-card-num">{{ todayAbsentCount }}</div>
          <div class="hd-card-lbl">ขาด/ลา วันนี้</div>
        </div>
        <div class="hd-card hd-card--yellow">
          <div class="hd-card-num">{{ todayLateCount }}</div>
          <div class="hd-card-lbl">มาสายวันนี้</div>
        </div>
        <div class="hd-card hd-card--purple">
          <div class="hd-card-num">{{ watchList.length }}</div>
          <div class="hd-card-lbl">เฝ้าระวัง</div>
        </div>
      </div>

      <!-- ── Watch list ─────────────────────────────────────── -->
      <div v-if="watchList.length && mainTab === 'attendance'" class="hd-watchlist mb-5">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div class="hd-section-title">⚠️ เฝ้าระวัง ({{ watchList.length }} คน)</div>
          <el-button
            type="warning" size="small"
            :disabled="watchlistSelected.size === 0"
            @click="startNotify"
          >
            📣 ส่งแจ้งเตือนผู้ปกครอง ({{ watchlistSelected.size }} คน)
          </el-button>
        </div>
        <div class="hd-watch-table">
          <el-table
            :data="watchList" size="small" border
            @selection-change="rows => { watchlistSelected.clear(); rows.forEach(r => watchlistSelected.add(r.student_id)) }"
            :header-cell-style="{ background:'#fff7ed', color:'#c2410c', fontWeight:'700', fontSize:'12px' }"
          >
            <el-table-column type="selection" width="42" align="center" />
            <el-table-column label="ที่" width="46" align="center" prop="seat_number" />
            <el-table-column label="ชื่อ-สกุล" min-width="150">
              <template #default="{ row }">
                <span class="font-semibold">{{ row.prefix }}{{ row.name }} {{ row.surname }}</span>
              </template>
            </el-table-column>
            <el-table-column label="เหตุเฝ้าระวัง" min-width="200">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-1">
                  <el-tag v-if="row.consAbsent >= wSettings.absent_streak" type="danger" size="small">
                    🔴 ขาด {{ row.consAbsent }} วันติด
                  </el-tag>
                  <el-tag v-if="row.consLate >= wSettings.late_streak" type="warning" size="small">
                    🟡 สาย {{ row.consLate }} วันติด
                  </el-tag>
                  <el-tag v-if="row.skipCount >= wSettings.skip_count" type="danger" size="small">
                    ⚫ โดด {{ row.skipCount }} คาบ
                  </el-tag>
                  <el-tag v-if="row.totalDays >= 5 && row.attendancePct < wSettings.attendance_pct" type="danger" size="small">
                    📉 {{ row.attendancePct.toFixed(0) }}% เสี่ยง มส.
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="ขาด" width="55" align="center">
              <template #default="{ row }"><span class="text-red-600 font-bold">{{ row.absentDays }}</span></template>
            </el-table-column>
            <el-table-column label="ลา" width="50" align="center">
              <template #default="{ row }"><span class="text-purple-500">{{ row.leaveDays }}</span></template>
            </el-table-column>
            <el-table-column label="สาย" width="50" align="center">
              <template #default="{ row }"><span class="text-yellow-600 font-bold">{{ row.lateDays }}</span></template>
            </el-table-column>
            <el-table-column label="โดด" width="55" align="center">
              <template #default="{ row }"><span class="text-rose-700 font-bold">{{ row.skipCount }}</span></template>
            </el-table-column>
            <el-table-column label="% มา" width="72" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.totalDays > 0"
                  :type="row.attendancePct >= wSettings.attendance_pct ? 'success' : 'danger'"
                  size="small" style="font-weight:700">
                  {{ row.attendancePct.toFixed(0) }}%
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- ── Student table ──────────────────────────────────── -->
      <div v-show="mainTab === 'attendance'" class="hd-table-wrap">
        <div class="hd-section-title mb-2">👥 รายชื่อนักเรียน ({{ students.length }} คน)</div>
        <el-table
          :data="studentStats" border stripe size="small"
          :header-cell-style="{ background:'#1e3a5f', color:'white', fontWeight:'700', fontSize:'12px' }"
          :default-sort="{ prop:'seat_number', order:'ascending' }"
        >
          <el-table-column prop="seat_number" label="ที่" width="52" align="center" sortable />
          <el-table-column label="ชื่อ-สกุล" min-width="160" prop="name">
            <template #default="{ row }">
              <span class="font-semibold text-gray-800">{{ row.prefix }}{{ row.name }} {{ row.surname }}</span>
            </template>
          </el-table-column>
          <el-table-column label="มา" width="55" align="center" sortable prop="presentDays">
            <template #default="{ row }">
              <span class="text-green-600 font-bold">{{ row.presentDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="สาย" width="55" align="center" sortable prop="lateDays">
            <template #default="{ row }">
              <span :class="row.lateDays > 0 ? 'text-yellow-600 font-bold' : 'text-gray-300'">{{ row.lateDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ขาด" width="55" align="center" sortable prop="absentDays">
            <template #default="{ row }">
              <span :class="row.absentDays > 0 ? 'text-red-600 font-bold' : 'text-gray-300'">{{ row.absentDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ลา" width="52" align="center" sortable prop="leaveDays">
            <template #default="{ row }">
              <span :class="row.leaveDays > 0 ? 'text-purple-500' : 'text-gray-300'">{{ row.leaveDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ขาดลา" width="62" align="center" sortable prop="absentLeaveDays">
            <template #default="{ row }">
              <span :class="row.absentLeaveDays > 0 ? 'text-red-500 font-bold' : 'text-gray-300'">{{ row.absentLeaveDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="โดด" width="55" align="center" sortable prop="skipCount">
            <template #default="{ row }">
              <span :class="row.skipCount > 0 ? 'text-rose-700 font-bold' : 'text-gray-300'">{{ row.skipCount }}</span>
            </template>
          </el-table-column>
          <el-table-column label="% มา" width="80" align="center" sortable prop="attendancePct">
            <template #default="{ row }">
              <el-tag v-if="row.totalDays > 0"
                :type="row.attendancePct >= wSettings.attendance_pct ? 'success' : row.attendancePct >= wSettings.attendance_pct - 10 ? 'warning' : 'danger'"
                size="small" style="font-weight:700;font-size:11px">
                {{ row.attendancePct.toFixed(0) }}%
              </el-tag>
              <span v-else class="text-gray-300 text-xs">-</span>
            </template>
          </el-table-column>
          <el-table-column label="ขาดติด" width="70" align="center" sortable prop="consAbsent">
            <template #default="{ row }">
              <span v-if="row.consAbsent > 0" class="font-bold"
                :class="row.consAbsent >= wSettings.absent_streak ? 'text-red-600' : 'text-orange-500'">
                {{ row.consAbsent }} วัน
              </span>
              <span v-else class="text-gray-300 text-xs">-</span>
            </template>
          </el-table-column>
          <el-table-column label="สายติด" width="70" align="center" sortable prop="consLate">
            <template #default="{ row }">
              <span v-if="row.consLate > 0" class="font-bold"
                :class="row.consLate >= wSettings.late_streak ? 'text-yellow-600' : 'text-gray-500'">
                {{ row.consLate }} วัน
              </span>
              <span v-else class="text-gray-300 text-xs">-</span>
            </template>
          </el-table-column>
          <el-table-column label="ประเมิน" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.totalDays >= 5 && row.attendancePct >= wSettings.attendance_pct" type="success" size="small" style="font-weight:700;font-size:11px">มีสิทธิ์สอบ</el-tag>
              <el-tag v-else-if="row.totalDays >= 5 && row.attendancePct < wSettings.attendance_pct" type="danger" size="small" style="font-weight:700;font-size:11px">เสี่ยง</el-tag>
              <span v-else class="text-gray-400 text-xs">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- ══ Good Deeds Tab ═════════════════════════════════════ -->
      <div v-show="mainTab === 'deeds'">
        <div class="hd-tab-header">
          <div class="hd-section-title">🌟 บันทึกความดีของนักเรียน · ห้อง {{ homeroomClass }}</div>
          <div class="flex gap-2 items-center flex-wrap">
            <el-select v-model="deedFilter" size="small" style="width:130px" placeholder="ทุกสถานะ">
              <el-option value="" label="ทุกสถานะ" />
              <el-option value="pending" label="รออนุมัติ" />
              <el-option value="approved" label="อนุมัติแล้ว" />
              <el-option value="rejected" label="ปฏิเสธ" />
            </el-select>
            <el-button size="small" plain @click="loadGoodDeeds()">🔄 รีเฟรช</el-button>
          </div>
        </div>
        <div v-if="deedsLoading" class="hd-empty">กำลังโหลด...</div>
        <div v-else-if="!filteredDeeds.length" class="hd-empty">ยังไม่มีรายการบันทึกความดี</div>
        <div v-else class="deeds-grid">
          <div v-for="deed in filteredDeeds" :key="deed.id" class="deed-card">
            <div class="deed-card-top">
              <div class="deed-student">{{ studentNameMap[deed.student_code] || deed.student_code }}</div>
              <el-tag :type="deedStatusType(deed.status)" size="small">{{ deedStatusLabel(deed.status) }}</el-tag>
            </div>
            <div class="deed-title">{{ deed.title }}</div>
            <div v-if="deed.detail" class="deed-detail">{{ deed.detail }}</div>
            <div v-if="deed.photos?.length" class="deed-photos">
              <img v-for="(p,pi) in deed.photos" :key="pi" :src="fixPhotoUrl(p)" class="deed-thumb"
                @click="viewingPhoto = p" />
            </div>
            <div class="deed-footer">
              <span class="deed-date">{{ fmtDT(deed.created_at) }}</span>
              <span v-if="deed.status === 'approved'" class="deed-approved-info">+{{ deed.points_awarded }} คะแนน</span>
              <div v-if="deed.status === 'pending'" class="deed-actions">
                <el-button type="success" size="small" @click="openApprove(deed)">✅ อนุมัติ</el-button>
                <el-button type="danger" size="small" plain @click="rejectDeed(deed)">❌ ปฏิเสธ</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ Messages Tab ════════════════════════════════════════ -->
      <div v-show="mainTab === 'messages'" class="msg-layout">

        <!-- ── LEFT: Sidebar ──────────────────────────────────── -->
        <div class="msg-sidebar">

          <!-- Header: title + compose button -->
          <div class="msg-sb-head">
            <span class="msg-sb-ttl">💬 ข้อความ</span>
            <button class="msg-compose-btn" @click="showNewMsg = true" title="ส่งข้อความใหม่">✏️</button>
          </div>

          <!-- Search within conversations -->
          <div class="msg-sb-search-row">
            <input v-model="msgConvoSearch" class="msg-sb-search" placeholder="🔍 ค้นหาในสนทนา..." />
          </div>

          <!-- Conversation list -->
          <div class="msg-convo-list">
            <div v-if="msgLoading" class="msg-hint">กำลังโหลด...</div>
            <div v-else-if="!visibleConvos.length" class="msg-hint-empty">
              <div class="msg-hint-icon">💬</div>
              <div>ยังไม่มีสนทนา</div>
              <div class="msg-hint-sub">กด ✏️ เพื่อส่งข้อความหานักเรียน</div>
            </div>
            <div v-for="c in visibleConvos" :key="c.student_code"
              class="msg-convo-item" :class="{ 'msg-convo-item--active': selectedCode === c.student_code }"
              @click="selectConvo(c.student_code)">
              <div class="msg-av">
                <img v-if="msgStudentPhotoMap[c.student_code]" :src="fixPhotoUrl(msgStudentPhotoMap[c.student_code])" class="msg-av-img" />
                <span v-else>{{ c.student_name.replace(/^(นาย|นาง|น\.ส\.|นางสาว|เด็กชาย|เด็กหญิง)\s*/, '').charAt(0) || '?' }}</span>
              </div>
              <div class="msg-convo-body">
                <div class="msg-convo-r1">
                  <span class="msg-convo-name">{{ c.student_name }}</span>
                  <span class="msg-convo-time">{{ c.last_time }}</span>
                </div>
                <div class="msg-convo-r2">
                  <span class="msg-convo-preview">{{ c.last_content || '…' }}</span>
                  <span v-if="c.unread > 0" class="msg-unread-dot">{{ c.unread }}</span>
                </div>
                <div class="msg-convo-cls">{{ c.class_id }}</div>
              </div>
              <button class="msg-hide-btn" @click.stop="hideConvo(c.student_code)" title="ซ่อนสนทนา">×</button>
            </div>
          </div>

          <!-- Compose overlay: slides over sidebar -->
          <transition name="slide-left">
            <div v-if="showNewMsg" class="msg-new-overlay">
              <div class="msg-new-head">
                <button class="msg-new-back" @click="showNewMsg = false">‹</button>
                <span>ส่งข้อความใหม่</span>
              </div>
              <div class="msg-new-filters">
                <input v-model="msgNameSearch" class="msg-new-search" placeholder="🔍 ค้นหาชื่อ..." />
                <select v-model="msgClassFilter" class="msg-new-cls-sel">
                  <option value="">ทุกห้อง</option>
                  <option v-for="cls in msgClasses" :key="cls" :value="cls">{{ cls }}</option>
                </select>
              </div>
              <div class="msg-new-list">
                <div v-if="!msgFilteredStudents.length" class="msg-hint">ไม่พบนักเรียน</div>
                <div v-for="s in msgFilteredStudents" :key="s.student_code"
                  class="msg-new-item" @click="selectConvo(s.student_code); showNewMsg = false">
                  <div class="msg-av msg-av--sm">
                    <img v-if="msgStudentPhotoMap[s.student_code]" :src="fixPhotoUrl(msgStudentPhotoMap[s.student_code])" class="msg-av-img" />
                    <span v-else>{{ s.name.replace(/^(นาย|นาง|น\.ส\.|นางสาว|เด็กชาย|เด็กหญิง)\s*/, '').charAt(0) || '?' }}</span>
                  </div>
                  <div>
                    <div class="msg-new-name">{{ s.name }}</div>
                    <div class="msg-new-cls">ห้อง {{ s.class_id }}</div>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- ── RIGHT: Chat panel ──────────────────────────────── -->
        <div class="msg-chat">
          <!-- Empty state -->
          <div v-if="!selectedCode" class="msg-empty-state">
            <div class="msg-empty-icon">💬</div>
            <div class="msg-empty-txt">เลือกสนทนาหรือกด ✏️ เพื่อส่งข้อความ</div>
          </div>

          <template v-else>
            <!-- Chat header -->
            <div class="msg-chat-hd">
              <div class="msg-av">
                <img v-if="msgStudentPhotoMap[selectedCode]" :src="fixPhotoUrl(msgStudentPhotoMap[selectedCode])" class="msg-av-img" />
                <span v-else>{{ (msgStudentNameMap[selectedCode] || '?').replace(/^(นาย|นาง|น\.ส\.|นางสาว|เด็กชาย|เด็กหญิง)\s*/, '').charAt(0) }}</span>
              </div>
              <div class="msg-chat-hd-info">
                <div class="msg-chat-name">{{ msgStudentNameMap[selectedCode] || selectedCode }}</div>
                <div class="msg-chat-sub">{{ msgAllStudents.find(s => String(s.student_code) === String(selectedCode))?.class_id || 'นักเรียน' }}</div>
              </div>
              <button class="msg-refresh-btn" @click="refreshTeacherMsgs" title="รีเฟรช">🔄</button>
            </div>

            <!-- Bubbles -->
            <div class="msg-bubbles" ref="bubblesRef">
              <template v-for="m in convoMsgs" :key="m.id">
                <div class="msg-brow" :class="{ 'msg-brow--me': m.sender === 'teacher' }">
                  <div v-if="m.sender === 'student'" class="msg-bav">
                    <img v-if="msgStudentPhotoMap[selectedCode]" :src="fixPhotoUrl(msgStudentPhotoMap[selectedCode])" class="msg-av-img" />
                    <span v-else>{{ (msgStudentNameMap[selectedCode] || '?').replace(/^(นาย|นาง|น\.ส\.|นางสาว|เด็กชาย|เด็กหญิง)\s*/, '').charAt(0) }}</span>
                  </div>
                  <div class="msg-bubble" :class="m.sender === 'teacher' ? 'msg-bubble--me' : 'msg-bubble--them'">
                    <div v-if="m.content" class="msg-text">{{ m.content }}</div>
                    <div v-if="m.attachments?.length" class="msg-att-grid">
                      <template v-for="(att, ai) in m.attachments" :key="ai">
                        <img v-if="att.type === 'image'" :src="fixPhotoUrl(att.url)" class="msg-att-img" @click="viewingPhoto = att.url" />
                        <div v-else-if="att.type === 'video'" class="msg-att-vid-wrap">
                          <a :href="att.url" target="_blank" class="msg-att-vid-link">▶ เล่นวิดีโอ</a>
                        </div>
                        <a v-else :href="att.url" target="_blank" class="msg-att-file">📄 {{ att.name || 'ไฟล์แนบ' }}</a>
                      </template>
                    </div>
                    <div class="msg-time">
                      {{ fmtDT(m.created_at) }}
                      <span v-if="m.sender === 'teacher'">{{ m.read_by_student ? ' ✓✓' : ' ✓' }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- Pending attachments -->
            <div v-if="pendingAttachments.length" class="msg-pending-row">
              <div v-for="(a, i) in pendingAttachments" :key="i" class="msg-pending-item">
                <img v-if="a.type === 'image'" :src="a.preview" class="msg-pending-thumb" />
                <div v-else class="msg-pending-file">
                  <span>{{ a.type === 'video' ? '🎬' : '📄' }}</span>
                  <span class="msg-pending-name">{{ a.file.name }}</span>
                </div>
                <button class="msg-del-btn" @click="pendingAttachments.splice(i, 1)">✕</button>
              </div>
            </div>

            <!-- Input bar -->
            <div class="msg-input-row">
              <label class="msg-attach-label" title="แนบไฟล์">
                📎
                <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" multiple
                  style="display:none" @change="onTeacherAttach" :disabled="msgSending" />
              </label>
              <el-input v-model="msgText" type="textarea" :rows="1" autosize
                placeholder="พิมพ์ข้อความ..." class="msg-input"
                @keydown.enter.exact.prevent="sendTeacherMsg" />
              <el-button type="primary" size="small" :loading="msgSending"
                :disabled="!msgText.trim() && !pendingAttachments.length"
                @click="sendTeacherMsg">ส่ง</el-button>
            </div>
          </template>
        </div>
      </div>

    </div>

    <!-- ══ Notification Dialog ══════════════════════════════════ -->
    <el-dialog
      v-model="notifyDialog.visible"
      :title="`📣 แจ้งเตือนผู้ปกครอง (${notifyDialog.index + 1} / ${notifyDialog.queue.length})`"
      width="560px"
      :close-on-click-modal="false"
    >
      <div v-if="notifyDialog.current" class="notify-body">

        <!-- student info -->
        <div class="notify-student-header">
          <div class="notify-student-name">{{ notifyDialog.current.prefix }}{{ notifyDialog.current.name }} {{ notifyDialog.current.surname }}</div>
          <div class="flex flex-wrap gap-1 mt-1">
            <el-tag v-if="notifyDialog.current.consAbsent >= wSettings.absent_streak" type="danger" size="small">ขาด {{ notifyDialog.current.consAbsent }} วันติด</el-tag>
            <el-tag v-if="notifyDialog.current.consLate >= wSettings.late_streak" type="warning" size="small">สาย {{ notifyDialog.current.consLate }} วันติด</el-tag>
            <el-tag v-if="notifyDialog.current.skipCount >= wSettings.skip_count" type="danger" size="small">โดด {{ notifyDialog.current.skipCount }} คาบ</el-tag>
            <el-tag v-if="notifyDialog.current.totalDays >= 5 && notifyDialog.current.attendancePct < wSettings.attendance_pct" type="danger" size="small">มาเรียน {{ notifyDialog.current.attendancePct.toFixed(0) }}%</el-tag>
          </div>
        </div>

        <!-- message editor -->
        <div class="mt-3 mb-1 text-xs font-bold text-gray-600">ข้อความแจ้งเตือน (แก้ไขได้)</div>
        <el-input
          v-model="notifyDialog.message"
          type="textarea" :rows="5"
          style="font-size:13px"
        />
        <el-button size="small" plain class="mt-1" @click="copyMessage">📋 คัดลอกข้อความ</el-button>

        <!-- contacts -->
        <div class="notify-contacts mt-4">
          <div class="text-xs font-bold text-gray-600 mb-2">📞 ข้อมูลผู้ปกครอง</div>

          <!-- Primary guardian -->
          <div v-if="notifyDialog.current.guardian_primary" class="notify-guardian">
            <div class="notify-guardian-label">ผู้ปกครองหลัก: {{ notifyDialog.current.guardian_primary.name || '' }}</div>
            <div class="notify-contact-btns">
              <a v-if="notifyDialog.current.guardian_primary.phone"
                :href="`tel:${notifyDialog.current.guardian_primary.phone}`"
                class="notify-btn notify-btn--phone">
                📞 {{ notifyDialog.current.guardian_primary.phone }}
              </a>
              <button v-if="notifyDialog.current.guardian_primary.line_id"
                class="notify-btn notify-btn--line"
                @click="openLine(notifyDialog.current.guardian_primary.line_id, notifyDialog.message)">
                💬 LINE ({{ notifyDialog.current.guardian_primary.line_id }})
              </button>
              <a v-if="notifyDialog.current.guardian_primary.email"
                :href="mailtoLink(notifyDialog.current.guardian_primary.email, notifyDialog.current)"
                class="notify-btn notify-btn--email">
                ✉️ {{ notifyDialog.current.guardian_primary.email }}
              </a>
              <button v-if="notifyDialog.current.guardian_primary.telegram"
                class="notify-btn notify-btn--telegram"
                @click="openTelegram(notifyDialog.current.guardian_primary.telegram, notifyDialog.message)">
                ✈️ Telegram
              </button>
            </div>
          </div>

          <!-- Secondary guardian -->
          <div v-if="notifyDialog.current.guardian_secondary" class="notify-guardian mt-2">
            <div class="notify-guardian-label">ผู้ปกครองสำรอง: {{ notifyDialog.current.guardian_secondary.name || '' }}</div>
            <div class="notify-contact-btns">
              <a v-if="notifyDialog.current.guardian_secondary.phone"
                :href="`tel:${notifyDialog.current.guardian_secondary.phone}`"
                class="notify-btn notify-btn--phone">
                📞 {{ notifyDialog.current.guardian_secondary.phone }}
              </a>
              <button v-if="notifyDialog.current.guardian_secondary.line_id"
                class="notify-btn notify-btn--line"
                @click="openLine(notifyDialog.current.guardian_secondary.line_id, notifyDialog.message)">
                💬 LINE
              </button>
              <a v-if="notifyDialog.current.guardian_secondary.email"
                :href="mailtoLink(notifyDialog.current.guardian_secondary.email, notifyDialog.current)"
                class="notify-btn notify-btn--email">
                ✉️ Email
              </a>
              <button v-if="notifyDialog.current.guardian_secondary.telegram"
                class="notify-btn notify-btn--telegram"
                @click="openTelegram(notifyDialog.current.guardian_secondary.telegram, notifyDialog.message)">
                ✈️ Telegram
              </button>
            </div>
          </div>

          <!-- Fallback: parent_name/parent_phone -->
          <div v-if="!notifyDialog.current.guardian_primary && notifyDialog.current.parent_phone" class="notify-guardian">
            <div class="notify-guardian-label">{{ notifyDialog.current.parent_name || 'ผู้ปกครอง' }}</div>
            <div class="notify-contact-btns">
              <a :href="`tel:${notifyDialog.current.parent_phone}`" class="notify-btn notify-btn--phone">
                📞 {{ notifyDialog.current.parent_phone }}
              </a>
            </div>
          </div>

          <div v-if="!notifyDialog.current.guardian_primary && !notifyDialog.current.parent_phone"
            class="text-sm text-gray-400 italic py-2">ไม่มีข้อมูลผู้ปกครองในระบบ</div>
        </div>

        <!-- ส่งในระบบ ผปค. -->
        <div class="notify-system-row">
          <div class="notify-system-label">📱 ส่งในระบบ ผปค.</div>
          <button
            class="notify-btn notify-btn--system"
            :class="{ 'notify-btn--sent': notifSentCodes.includes(notifyDialog.current?.student_id) }"
            :disabled="sendingNotify || notifSentCodes.includes(notifyDialog.current?.student_id)"
            @click="sendSystemNotify"
          >
            <span v-if="notifSentCodes.includes(notifyDialog.current?.student_id)">
              ✅ ส่งแล้ว — ผปค. จะเห็นเมื่อล็อกอิน
            </span>
            <span v-else-if="sendingNotify">กำลังส่ง...</span>
            <span v-else>📲 ส่งเข้าแดชบอร์ดผู้ปกครอง</span>
          </button>
          <div class="notify-system-hint">ผู้ปกครองรับข้อความและฟังเสียงได้ทันทีเมื่อเข้าระบบ</div>
        </div>

        <!-- progress indicator -->
        <el-progress
          :percentage="Math.round(notifyDialog.doneCount / notifyDialog.queue.length * 100)"
          :format="() => `${notifyDialog.doneCount}/${notifyDialog.queue.length}`"
          class="mt-4"
          :stroke-width="10"
          status="success"
        />
      </div>

      <template #footer>
        <div class="flex justify-between w-full">
          <el-button @click="notifyDialog.visible = false">❌ ปิด</el-button>
          <div class="flex gap-2">
            <el-button @click="notifySkip">⏭️ ข้ามคนนี้</el-button>
            <el-button type="success" @click="notifyDone">✅ แจ้งแล้ว → ถัดไป</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- ══ Approval Dialog ═══════════════════════════════════════ -->
    <el-dialog v-model="approveDialog.visible" title="✅ อนุมัติบันทึกความดี" width="460px">
      <div v-if="approveDialog.deed" class="approve-body">
        <div class="approve-student">{{ studentNameMap[approveDialog.deed.student_code] || approveDialog.deed.student_code }}</div>
        <div class="approve-deed-title">{{ approveDialog.deed.title }}</div>
        <div v-if="approveDialog.deed.detail" class="approve-deed-detail">{{ approveDialog.deed.detail }}</div>
        <div v-if="approveDialog.deed.photos?.length" class="deed-photos mt-2">
          <img v-for="(p,pi) in approveDialog.deed.photos" :key="pi" :src="fixPhotoUrl(p)" class="deed-thumb" @click="viewingPhoto = p" />
        </div>
        <div class="mt-4">
          <div class="text-sm font-bold mb-1">คะแนนที่ให้ (คะแนนความประพฤติ)</div>
          <el-input-number v-model="approveDialog.points" :min="0" :max="20" :step="1" size="default" />
        </div>
        <div class="mt-3">
          <div class="text-sm font-bold mb-1">หมายเหตุ (ถ้ามี)</div>
          <el-input v-model="approveDialog.note" type="textarea" :rows="2" placeholder="เช่น ทำดีมาก..." />
        </div>
      </div>
      <template #footer>
        <el-button @click="approveDialog.visible = false">ยกเลิก</el-button>
        <el-button type="success" :loading="deedsSubmitting" @click="confirmApprove">✅ อนุมัติและบันทึกคะแนน</el-button>
      </template>
    </el-dialog>

    <!-- ══ Photo Viewer ══════════════════════════════════════════ -->
    <el-dialog v-model="viewingPhotoVisible" width="90vw" :show-header="false"
      @close="viewingPhoto = ''">
      <img :src="fixPhotoUrl(viewingPhoto)" style="width:100%;max-height:80vh;object-fit:contain;display:block" />
    </el-dialog>

  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import AnnSlideshow from '@/components/AnnSlideshow.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useBehavior } from '@/composables/useBehavior'
import { uploadViaGAS, fixPhotoUrl } from '@/composables/useStudentUpload'
import { useCheckinDashboard } from '@/composables/useCheckinDashboard'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { recordBehavior } = useBehavior()
const { getCheckinStudents, getWeeklyReport, getMonthlyReport, getTermReport, thaiToday } = useCheckinDashboard()

// ─── Constants ────────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: '📅 วันนี้' },
  { key: 'week',  label: '📆 สัปดาห์นี้' },
  { key: 'month', label: '🗓️ เดือนนี้' },
  { key: 'term',  label: '📚 ภาคเรียนนี้' },
]

// ─── State ────────────────────────────────────────────────────
const loading       = ref(false)
const period        = ref('week')
const homeroomClass = ref('')
const myName        = ref('')
const students      = ref([])
const actuals       = ref([])
const homeroomPeriods = ref([])   // [{period, name, days}]
const wSettings = reactive({ absent_streak: 3, late_streak: 3, skip_count: 5, attendance_pct: 80 })

// ── Check-in state ─────────────────────────────────────────────
const ciDate      = ref(thaiToday())
const ciLoading   = ref(false)
const ciStudents  = ref([])
const ciReportTab = ref('weekly')
const ciWeekDays  = ref([])
const ciMonthDays = ref([])
const ciTermWeeks = ref([])
const isToday     = computed(() => ciDate.value === thaiToday())
const ciOntime    = computed(() => ciStudents.value.filter(s => s.status === 'ontime').length)
const ciLate      = computed(() => ciStudents.value.filter(s => s.status === 'late').length)
const ciAbsent    = computed(() => ciStudents.value.filter(s => s.status === 'absent').length)
function ciPct(n) { return ciStudents.value.length ? Math.round(n / ciStudents.value.length * 100) : 0 }

const ciFilter = ref('all')
const ciFilteredStudents = computed(() => {
  if (ciFilter.value === 'checked') return ciStudents.value.filter(s => s.checkin)
  if (ciFilter.value === 'absent')  return ciStudents.value.filter(s => !s.checkin)
  return ciStudents.value
})
const ciFilteredOntime = computed(() => ciFilteredStudents.value.filter(s => s.status === 'ontime'))
const ciFilteredLate   = computed(() => ciFilteredStudents.value.filter(s => s.status === 'late'))
const ciFilteredAbsent = computed(() => ciFilteredStudents.value.filter(s => s.status === 'absent'))

const ciBehaviorDialog = reactive({ visible: false, student: null, label: '', points: 1, submitting: false })
function openCiBehavior(s) {
  ciBehaviorDialog.student = s
  ciBehaviorDialog.label   = s.status === 'ontime' ? 'มาเรียนตรงเวลา' : 'มาเรียนสาย'
  ciBehaviorDialog.points  = s.status === 'ontime' ? 1 : -1
  ciBehaviorDialog.visible = true
}
async function submitCiBehavior() {
  const s = ciBehaviorDialog.student
  if (!s || !ciBehaviorDialog.label.trim()) return
  ciBehaviorDialog.submitting = true
  try {
    await recordBehavior({
      student:      { student_id: s.student_code, class_id: s.class_id || homeroomClass.value },
      setting:      { behavior_type: 'attendance', label: ciBehaviorDialog.label, points: Math.abs(ciBehaviorDialog.points) },
      pointsChange: ciBehaviorDialog.points,
      note:         `เช็คอินวันที่ ${ciDate.value}`,
      source:       'manual',
    })
    ElMessage.success('บันทึกคะแนนเรียบร้อย')
    ciBehaviorDialog.visible = false
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    ciBehaviorDialog.submitting = false
  }
}
// ─── Bulk selection ───────────────────────────────────────────
const ciSelectMode = ref(false)
const ciSelected   = ref(new Set())
function toggleSelectMode() {
  ciSelectMode.value = !ciSelectMode.value
  ciSelected.value = new Set()
}
function toggleCiSelect(s) {
  const next = new Set(ciSelected.value)
  if (next.has(s.student_code)) next.delete(s.student_code)
  else next.add(s.student_code)
  ciSelected.value = next
}

// per-group helpers
function ciGroupStudents(status) {
  if (status === 'ontime') return ciFilteredOntime.value
  if (status === 'late')   return ciFilteredLate.value
  return ciFilteredAbsent.value
}
function ciGroupSelectedCount(status) {
  return ciGroupStudents(status).filter(s => ciSelected.value.has(s.student_code)).length
}
function ciGroupAllChecked(status) {
  const g = ciGroupStudents(status)
  return g.length > 0 && g.every(s => ciSelected.value.has(s.student_code))
}
function ciGroupIndeterminate(status) {
  const cnt = ciGroupSelectedCount(status)
  return cnt > 0 && !ciGroupAllChecked(status)
}
function toggleCiGroupAll(status) {
  const g = ciGroupStudents(status)
  const next = new Set(ciSelected.value)
  if (ciGroupAllChecked(status)) {
    g.forEach(s => next.delete(s.student_code))
  } else {
    g.forEach(s => next.add(s.student_code))
  }
  ciSelected.value = next
}
function openBulkFromGroup(status) {
  ciBulkDialog.points  = status === 'ontime' ? 1 : status === 'late' ? -1 : -2
  ciBulkDialog.label   = status === 'ontime' ? 'มาเรียนตรงเวลา' : status === 'late' ? 'มาเรียนสาย' : 'ขาดเรียน'
  ciBulkDialog.visible = true
}

const ciBulkDialog = reactive({ visible: false, points: 1, label: 'มาเรียนตรงเวลา', submitting: false })

function applyBulkPreset(pts, lbl) {
  ciBulkDialog.points = pts
  ciBulkDialog.label  = lbl
  submitCiBulk()
}
function openBulkCustom() {
  ciBulkDialog.visible = true
}
async function submitCiBulk() {
  if (!ciSelected.value.size || !ciBulkDialog.label.trim()) return
  ciBulkDialog.submitting = true
  const targets = ciFilteredStudents.value.filter(s => ciSelected.value.has(s.student_code))
  let ok = 0, fail = 0
  for (const s of targets) {
    try {
      await recordBehavior({
        student:      { student_id: s.student_code, class_id: s.class_id || homeroomClass.value },
        setting:      { behavior_type: 'attendance', label: ciBulkDialog.label, points: Math.abs(ciBulkDialog.points) },
        pointsChange: ciBulkDialog.points,
        note:         `เช็คอินวันที่ ${ciDate.value}`,
        source:       'manual',
      })
      ok++
    } catch { fail++ }
  }
  ciBulkDialog.submitting = false
  ciBulkDialog.visible    = false
  if (ok > 0) ElMessage.success(`บันทึกคะแนนสำเร็จ ${ok} คน${fail ? ` (ไม่สำเร็จ ${fail} คน)` : ''}`)
  else ElMessage.error('บันทึกไม่สำเร็จ')
  ciSelected.value   = new Set()
  ciSelectMode.value = false
}

function fmtCiDate(d) { return d ? new Date(d).toLocaleDateString('th-TH', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '' }
function fmtTime(dt) { return dt ? new Date(dt).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) : '' }
function fmtWeekLabel(d) { return d ? new Date(d).toLocaleDateString('th-TH', { day:'numeric', month:'short' }) : '' }
async function loadCiStudents() {
  ciLoading.value = true
  try { ciStudents.value = await getCheckinStudents(ciDate.value, homeroomClass.value) }
  catch { ciStudents.value = [] } finally { ciLoading.value = false }
}
async function loadCiReport(tab) {
  const t = tab || ciReportTab.value
  const cls = homeroomClass.value
  if (!cls) return
  if (t === 'weekly') {
    const r = await getWeeklyReport(ciDate.value, cls)
    ciWeekDays.value = r.days
  } else if (t === 'monthly') {
    const [y, m] = ciDate.value.split('-').map(Number)
    const r = await getMonthlyReport(y, m, cls)
    ciMonthDays.value = r.days
  } else if (t === 'term') {
    const ts = schoolStore.termStart || `${new Date().getFullYear()}-05-01`
    const te = schoolStore.termEnd   || thaiToday()
    const r  = await getTermReport(ts, te, cls)
    ciTermWeeks.value = r.weeks
  }
}
const ciHolidaySet = computed(() => {
  const hols = schoolStore.settingsObj?.teaching_log_settings?.holidays || []
  return new Set(hols.map(h => (typeof h === 'string' ? h : h?.date)).filter(Boolean))
})
function isSchoolDay(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  if (dow === 0 || dow === 6) return false // เสาร์-อาทิตย์
  return !ciHolidaySet.value.has(dateStr)
}
function stepDate(dateStr, n) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m-1, d+n).toLocaleDateString('en-CA') }
function ciStepSchoolDay(dateStr, direction) {
  let d = dateStr
  for (let i = 0; i < 14; i++) {
    d = stepDate(d, direction)
    if (isSchoolDay(d)) return d
  }
  return d
}
function ciPrevDay() { ciDate.value = ciStepSchoolDay(ciDate.value, -1); loadCiStudents(); loadCiReport() }
function ciNextDay() { if (isToday.value) return; ciDate.value = ciStepSchoolDay(ciDate.value, 1); loadCiStudents(); loadCiReport() }
function ciGoToday() {
  let d = thaiToday()
  if (!isSchoolDay(d)) d = ciStepSchoolDay(d, -1)
  ciDate.value = d
  loadCiStudents(); loadCiReport()
}
const ciIsNonSchoolDay = computed(() => !isSchoolDay(ciDate.value))

const ciDetailOpen    = ref(false)
const ciDetailStudent = ref(null)
const ciDetailMapEl   = ref(null)
let _ciDetailMap = null

async function openCiDetail(s) {
  if (!s.checkin) return
  ciDetailStudent.value = s
  ciDetailOpen.value = true
  if (s.checkin.lat) {
    await nextTick()
    await nextTick() // el-dialog needs 2 ticks to mount content
    initCiDetailMap(s.checkin.lat, s.checkin.lng)
  }
}
function initCiDetailMap(lat, lng) {
  if (!ciDetailMapEl.value) return
  if (_ciDetailMap) { _ciDetailMap.remove(); _ciDetailMap = null }
  _ciDetailMap = L.map(ciDetailMapEl.value, { center: [lat, lng], zoom: 17, attributionControl: false })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_ciDetailMap)
  const icon = L.divIcon({ html: '📍', className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
  L.marker([lat, lng], { icon }).addTo(_ciDetailMap)
}
function destroyCiMap() {
  _ciDetailMap?.remove()
  _ciDetailMap = null
}

// ─── Notify dialog ────────────────────────────────────────────
const watchlistSelected = reactive(new Set())
const notifyDialog = reactive({
  visible: false,
  queue: [],
  index: 0,
  current: null,
  message: '',
  doneCount: 0,
})
const sendingNotify  = ref(false)
const notifSentCodes = ref([])

// ─── Date helpers ─────────────────────────────────────────────
function toLocalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getDateRange(p) {
  const today = new Date(); today.setHours(0,0,0,0)
  const ts = toLocalStr(today)
  if (p === 'today') return { start: ts, end: ts }
  if (p === 'week') {
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((today.getDay()+6)%7))
    return { start: toLocalStr(mon), end: ts }
  }
  if (p === 'month') {
    return { start: toLocalStr(new Date(today.getFullYear(), today.getMonth(), 1)), end: ts }
  }
  // ภาคเรียน: ใช้ term start จาก school store หรือ default
  const term = schoolStore.currentTerm
  const year = parseInt(term.split('_')[0] || '2568') - 543
  const sem  = parseInt(term.split('_')[1] || '1')
  const termStart = sem === 1 ? new Date(year, 4, 1) : new Date(year, 9, 1)
  return { start: toLocalStr(termStart), end: ts }
}

// ─── Stats computation ────────────────────────────────────────
const TODAY_STR = toLocalStr(new Date())

function computeMode(arr) {
  if (!arr.length) return null
  const counts = {}
  for (const v of arr) counts[v] = (counts[v] || 0) + 1
  let best = null; let max = 0
  for (const [v, c] of Object.entries(counts)) { if (c > max) { max = c; best = v } }
  return best
}

const homeroomPeriodNums = computed(() => new Set(homeroomPeriods.value.map(hp => Number(hp.period))))

const studentStats = computed(() => {
  if (!students.value.length) return []

  // Build per-student data: dayData[sid][date] = { hmStatus, regularStatuses: [] }
  const dayData = {}

  for (const ta of actuals.value) {
    const date = ta.date
    const isHm = homeroomPeriodNums.value.has(Number(ta.period_number)) || ta.slot_type === 'homeroom'

    if (!ta.is_filled) {
      // ครูไม่บันทึก → นักเรียนทุกคนในห้องขาดคาบนี้
      for (const stu of students.value) {
        const sid = String(stu.student_id)
        if (!dayData[sid]) dayData[sid] = {}
        if (!dayData[sid][date]) dayData[sid][date] = { hmStatus: null, regularStatuses: [], skipCount: 0 }
        if (isHm) {
          dayData[sid][date].hmStatus = 'ขาดเรียน'
        } else {
          dayData[sid][date].regularStatuses.push('ขาดเรียน')
        }
      }
      continue
    }

    for (const [sid, rec] of Object.entries(ta.student_records || {})) {
      if (!dayData[sid]) dayData[sid] = {}
      if (!dayData[sid][date]) dayData[sid][date] = { hmStatus: null, regularStatuses: [], skipCount: 0 }

      const st = rec.status || 'มาเรียน'
      if (isHm) {
        dayData[sid][date].hmStatus = st
      } else {
        dayData[sid][date].regularStatuses.push(st)
        if (st === 'โดดเรียน') dayData[sid][date].skipCount++
      }
    }
  }

  // Compute today's late/absent from dayData
  // (for header cards, done in separate computed below)

  return students.value.map(stu => {
    const sid      = String(stu.student_id)
    const days     = dayData[sid] || {}
    const joinDate = stu.join_date || null
    const allDates = Object.keys(days).sort()
    const sortedDates = joinDate ? allDates.filter(d => d >= joinDate) : allDates

    let presentDays = 0, absentDays = 0, leaveDays = 0, lateDays = 0, skipCount = 0

    for (const date of sortedDates) {
      const { hmStatus, regularStatuses, skipCount: sc } = days[date]

      // โดดเรียน: นับรายคาบ (ไม่ใช่รายวัน)
      skipCount += sc

      const regularMode = regularStatuses.length ? computeMode(regularStatuses) : null

      // มาสาย = คาบ homeroom ขาด/ลา แต่คาบปกติมาเรียน (นักเรียนมาสายเกินเข้าแถว)
      const homeroomMissed = hmStatus != null &&
        (hmStatus === 'ขาดเรียน' || hmStatus === 'ลาป่วย' || hmStatus === 'ลากิจ' || hmStatus === 'ไปราชการ')
      const regularPresent = regularMode != null &&
        (regularMode === 'มาเรียน' || regularMode === 'มาสาย')

      if (homeroomMissed && regularPresent) {
        // pattern มาสาย: ขาด homeroom แต่มาคาบเรียนปกติ
        presentDays++
        lateDays++
      } else {
        // ใช้ฐานนิยมของคาบปกติ (หรือ homeroom ถ้าไม่มีคาบปกติ) เพื่อตัดสินวัน
        const dayMode = regularMode ?? hmStatus
        if (dayMode === 'ขาดเรียน') {
          absentDays++
        } else if (dayMode === 'ลาป่วย' || dayMode === 'ลากิจ' || dayMode === 'ไปราชการ') {
          leaveDays++
        } else {
          presentDays++
        }
      }
    }

    const totalDays = presentDays + absentDays + leaveDays
    const attendancePct = totalDays > 0 ? (presentDays / totalDays) * 100 : 100
    const absentLeaveDays = absentDays + leaveDays

    // Consecutive streaks (จากวันล่าสุด)
    let consAbsent = 0
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const { hmStatus, regularStatuses } = days[sortedDates[i]]
      const regularMode = regularStatuses.length ? computeMode(regularStatuses) : null
      const dayMode = regularMode ?? hmStatus
      if (dayMode === 'ขาดเรียน') consAbsent++
      else break
    }

    let consLate = 0
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const { hmStatus, regularStatuses } = days[sortedDates[i]]
      const regularMode = regularStatuses.length ? computeMode(regularStatuses) : null
      const homeroomMissed = hmStatus != null &&
        (hmStatus === 'ขาดเรียน' || hmStatus === 'ลาป่วย' || hmStatus === 'ลากิจ' || hmStatus === 'ไปราชการ')
      const regularPresent = regularMode != null &&
        (regularMode === 'มาเรียน' || regularMode === 'มาสาย')
      if (homeroomMissed && regularPresent) consLate++
      else break
    }

    return {
      ...stu,
      presentDays, absentDays, leaveDays, lateDays, skipCount,
      totalDays, attendancePct, absentLeaveDays,
      consAbsent, consLate,
    }
  }).sort((a, b) => Number(a.seat_number) - Number(b.seat_number))
})

const avgPct = computed(() => {
  const rows = studentStats.value.filter(r => r.totalDays > 0)
  return rows.length ? rows.reduce((s, r) => s + r.attendancePct, 0) / rows.length : 100
})

const atRiskCount = computed(() =>
  studentStats.value.filter(r => r.totalDays >= 5 && r.attendancePct < wSettings.attendance_pct).length
)

// Today's stats: ตรวจจาก actuals วันนี้
const todayAbsentCount = computed(() => {
  const sidSet = new Set()
  for (const ta of actuals.value) {
    if (!ta.is_filled || ta.date !== TODAY_STR || !ta.student_records) continue
    for (const [sid, rec] of Object.entries(ta.student_records)) {
      if (['ขาดเรียน','ลาป่วย','ลากิจ'].includes(rec.status)) sidSet.add(sid)
    }
  }
  return sidSet.size
})
const todayLateCount = computed(() => {
  const sidSet = new Set()
  for (const ta of actuals.value) {
    if (!ta.is_filled || ta.date !== TODAY_STR || !ta.student_records) continue
    const isHm = homeroomPeriodNums.value.has(Number(ta.period_number)) || ta.slot_type === 'homeroom'
    if (!isHm) continue
    for (const [sid, rec] of Object.entries(ta.student_records)) {
      if (rec.status === 'มาสาย') sidSet.add(sid)
    }
  }
  return sidSet.size
})

const watchList = computed(() =>
  studentStats.value.filter(r =>
    r.consAbsent >= wSettings.absent_streak ||
    r.consLate >= wSettings.late_streak ||
    r.skipCount >= wSettings.skip_count ||
    (r.totalDays >= 5 && r.attendancePct < wSettings.attendance_pct)
  )
)

// ─── Notification ─────────────────────────────────────────────
function buildMessage(stu) {
  const school = schoolStore.schoolInfo?.name || 'โรงเรียน'
  const lines = [
    `🏫 ${school}`,
    `เรียน ผู้ปกครองนักเรียน ${stu.prefix}${stu.name} ${stu.surname} ชั้น ${homeroomClass.value}`,
    '',
    `ขอแจ้งให้ทราบว่าบุตรหลานของท่านมีพฤติกรรมการมาเรียนที่ต้องติดตาม:`,
  ]
  if (stu.consAbsent >= wSettings.absent_streak)
    lines.push(`• ขาดเรียนติดต่อกัน ${stu.consAbsent} วัน`)
  if (stu.consLate >= wSettings.late_streak)
    lines.push(`• มาสายติดต่อกัน ${stu.consLate} วัน`)
  if (stu.skipCount >= wSettings.skip_count)
    lines.push(`• โดดเรียนสะสม ${stu.skipCount} คาบ`)
  if (stu.totalDays >= 5 && stu.attendancePct < wSettings.attendance_pct)
    lines.push(`• เวลาเรียนสะสม ${stu.attendancePct.toFixed(0)}% (ต่ำกว่า ${wSettings.attendance_pct}% เสี่ยงหมดสิทธิ์สอบ)`)
  lines.push('', 'กรุณาติดต่อครูที่ปรึกษาเพื่อหาแนวทางแก้ไขร่วมกัน')
  lines.push(`ครูที่ปรึกษา: ${myName.value}`)
  return lines.join('\n')
}

function startNotify() {
  const selected = watchList.value.filter(r => watchlistSelected.has(r.student_id))
  if (!selected.length) return
  notifyDialog.queue = [...selected]
  notifyDialog.index = 0
  notifyDialog.doneCount = 0
  notifyDialog.current = selected[0]
  notifyDialog.message = buildMessage(selected[0])
  notifyDialog.visible = true
}

function advanceNotify() {
  const next = notifyDialog.index + 1
  if (next >= notifyDialog.queue.length) {
    notifyDialog.visible = false
    ElMessage.success(`แจ้งเตือนผู้ปกครองครบ ${notifyDialog.doneCount} คนแล้ว`)
    return
  }
  notifyDialog.index = next
  notifyDialog.current = notifyDialog.queue[next]
  notifyDialog.message = buildMessage(notifyDialog.current)
}

function notifyDone() { notifyDialog.doneCount++; advanceNotify() }
function notifySkip()  { advanceNotify() }

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(notifyDialog.message)
    ElMessage.success('คัดลอกข้อความแล้ว')
  } catch {
    ElMessage.warning('ไม่สามารถคัดลอกได้ กรุณาคัดลอกด้วยตนเอง')
  }
}

async function openLine(lineId, msg) {
  try {
    await navigator.clipboard.writeText(msg)
    ElMessage.success('คัดลอกข้อความแล้ว — เปิด LINE แล้ววางข้อความ')
  } catch { /* ignore */ }
  window.open(`https://line.me/ti/p/~${lineId}`, '_blank')
}

function openTelegram(handle, msg) {
  const username = handle.replace(/^@/, '')
  window.open(`https://t.me/${username}?text=${encodeURIComponent(msg)}`, '_blank')
}

async function sendSystemNotify() {
  const stu = notifyDialog.current
  if (!stu) return
  const studentCode = stu.student_id   // student_id ใน view นี้ = student_code จาก DB
  sendingNotify.value = true
  try {
    const { error } = await supabase.from('parent_notifications').insert({
      school_id:    authStore.schoolId,
      student_code: studentCode,
      message:      notifyDialog.message,
      sender_name:  myName.value,
      class_id:     homeroomClass.value,
    })
    if (error) throw error
    if (!notifSentCodes.value.includes(studentCode)) {
      notifSentCodes.value.push(studentCode)
    }
    ElMessage.success('ส่งข้อความเข้าระบบผู้ปกครองแล้ว')
  } catch (e) {
    ElMessage.error('ส่งไม่สำเร็จ: ' + e.message)
  } finally {
    sendingNotify.value = false
  }
}

function mailtoLink(email, stu) {
  const subject = encodeURIComponent(`แจ้งเตือนการมาเรียน: ${stu.prefix}${stu.name} ${stu.surname}`)
  const body = encodeURIComponent(notifyDialog.message)
  return `mailto:${email}?subject=${subject}&body=${body}`
}

// ─── Main Tab ─────────────────────────────────────────────────
const mainTab = ref('attendance')

// ─── Announcements / News ─────────────────────────────────────
const newsLoading        = ref(false)
const announcements      = ref([])
const newsNewThreshold   = computed(() => Math.max(0, Date.now() - prevSeenTs.value))
const NEWS_SEEN_KEY   = 'hd_news_seen'
const prevSeenTs      = ref(0)   // snapshot ก่อนที่จะ mark as read

const lastSeenTs = computed(() => {
  try { return new Date(localStorage.getItem(NEWS_SEEN_KEY) || 0).getTime() } catch { return 0 }
})
// จำนวนยังไม่อ่าน (เทียบกับ lastSeenTs ใน localStorage ปัจจุบัน — ใช้แสดง badge)
const unreadNewsCount = computed(() =>
  announcements.value.filter(a => new Date(a.created_at).getTime() > lastSeenTs.value).length
)
// จำนวนที่ยังไม่อ่านก่อนเปิดแท็บ (ใช้แสดงใน statsbar)
const prevUnreadCount = computed(() =>
  announcements.value.filter(a => new Date(a.created_at).getTime() > prevSeenTs.value).length
)

async function loadAnnouncements() {
  prevSeenTs.value = lastSeenTs.value
  newsLoading.value = true
  try {
    const schoolId  = authStore.schoolId
    const myTeacherId = String(authStore.profile?.teacher_id || '')
    const { data, error } = await supabase
      .from('school_announcements')
      .select('id, title, author_name, content, type, targets, target_user_ids, target_teacher_id, image_urls, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    announcements.value = (data || []).filter(a => {
      const targets = a.targets || ['teacher']
      if (!targets.includes('teacher')) return false

      // ระบบใหม่: target_user_ids (teacher_id strings)
      const uids = a.target_user_ids
      if (uids && uids.length > 0) return uids.includes(myTeacherId)

      // ระบบเก่า: target_teacher_id (numeric)
      if (a.target_teacher_id !== null && a.target_teacher_id !== undefined) {
        return String(a.target_teacher_id) === myTeacherId
      }

      // ไม่ระบุเฉพาะบุคคล = ประกาศทั่วไปทุกคนเห็น
      return true
    })
    localStorage.setItem(NEWS_SEEN_KEY, new Date().toISOString())
  } catch { /* ignore */ } finally {
    newsLoading.value = false
  }
}

// ─── Good Deeds ───────────────────────────────────────────────
const goodDeeds     = ref([])
const deedsLoading  = ref(false)
const deedFilter    = ref('')
const deedsSubmitting = ref(false)
const viewingPhoto  = ref('')
const viewingPhotoVisible = computed({
  get: () => !!viewingPhoto.value,
  set: v => { if (!v) viewingPhoto.value = '' },
})
const approveDialog = reactive({ visible: false, deed: null, points: 1, note: '' })

const studentNameMap = computed(() => {
  const m = {}
  for (const s of students.value)
    m[s.student_id] = `${s.prefix}${s.name} ${s.surname}`.trim()
  return m
})

const filteredDeeds = computed(() =>
  deedFilter.value ? goodDeeds.value.filter(d => d.status === deedFilter.value) : goodDeeds.value
)
const pendingDeedsCount = computed(() => goodDeeds.value.filter(d => d.status === 'pending').length)

function deedStatusLabel(s) {
  return s === 'approved' ? 'อนุมัติแล้ว' : s === 'rejected' ? 'ปฏิเสธ' : 'รออนุมัติ'
}
function deedStatusType(s) {
  return s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warning'
}
function fmtDT(dtStr) {
  if (!dtStr) return ''
  const d = new Date(dtStr)
  const y = d.getFullYear() + 543
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mo}/${y} ${hh}:${mm}`
}

async function loadGoodDeeds() {
  if (!homeroomClass.value) return
  deedsLoading.value = true
  try {
    const { data } = await supabase.from('student_good_deeds').select('*')
      .eq('school_id', authStore.schoolId)
      .eq('class_id', homeroomClass.value)
      .order('created_at', { ascending: false }).limit(100)
    goodDeeds.value = data || []
  } finally {
    deedsLoading.value = false
  }
}

function openApprove(deed) {
  approveDialog.deed = deed
  approveDialog.points = 1
  approveDialog.note = ''
  approveDialog.visible = true
}

async function confirmApprove() {
  const deed = approveDialog.deed
  if (!deed) return
  deedsSubmitting.value = true
  const teacherCode = String(authStore.profile?.teacher_id || '')
  const pts = Number(approveDialog.points) || 0
  try {
    await supabase.from('student_good_deeds').update({
      status: 'approved',
      approved_by: teacherCode,
      approved_at: new Date().toISOString(),
      points_awarded: pts,
      approved_note: approveDialog.note || null,
    }).eq('id', deed.id)

    if (pts > 0) {
      const stu = students.value.find(s => s.student_id === deed.student_code)
      if (stu) {
        await recordBehavior({
          student: { student_id: stu.student_id, class_id: stu.class_id || homeroomClass.value },
          setting: { behavior_type: 'general', label: 'บันทึกความดี', points: pts },
          pointsChange: pts,
          note: deed.title + (deed.detail ? ': ' + deed.detail : ''),
          source: 'manual',
        })
      }
    }

    await loadGoodDeeds()
    ElMessage.success('อนุมัติและบันทึกคะแนนเรียบร้อย')
    approveDialog.visible = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    deedsSubmitting.value = false
  }
}

async function rejectDeed(deed) {
  const teacherCode = String(authStore.profile?.teacher_id || '')
  await supabase.from('student_good_deeds').update({
    status: 'rejected',
    approved_by: teacherCode,
    approved_at: new Date().toISOString(),
  }).eq('id', deed.id)
  await loadGoodDeeds()
  ElMessage.info('ปฏิเสธรายการนี้แล้ว')
}

// ─── Messages ─────────────────────────────────────────────────
const msgConvos           = ref([])
const msgLoading          = ref(false)
const selectedCode        = ref(null)
const convoMsgs           = ref([])
const msgText             = ref('')
const msgSending          = ref(false)
const pendingAttachments  = ref([])
const bubblesRef          = ref(null)
const msgStudentNameMap   = ref({})
const msgStudentPhotoMap  = ref({})
const msgAllStudents      = ref([])   // นักเรียนทุกคนในโรงเรียน
const msgNameSearch       = ref('')
const msgClassFilter      = ref('')
const showNewMsg          = ref(false)
const msgConvoSearch      = ref('')
let   msgChannel          = null
let   badgeChannel        = null

const _hiddenKey = () => `msgHidden_${authStore.schoolId}`
const hiddenCodes = ref(new Set())

function _loadHidden() {
  try { hiddenCodes.value = new Set(JSON.parse(localStorage.getItem(_hiddenKey()) || '[]')) } catch { hiddenCodes.value = new Set() }
}
function hideConvo(code) {
  hiddenCodes.value = new Set([...hiddenCodes.value, String(code)])
  localStorage.setItem(_hiddenKey(), JSON.stringify([...hiddenCodes.value]))
  if (selectedCode.value === code) selectedCode.value = null
}

function fmtMsgTime(dtStr) {
  if (!dtStr) return ''
  const d = new Date(dtStr)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  if (diffDays === 1) return 'เมื่อวาน'
  if (diffDays < 7) return ['อา','จ','อ','พ','พฤ','ศ','ส'][d.getDay()]
  return `${d.getDate()}/${d.getMonth()+1}`
}

const unreadMsgCount = computed(() => msgConvos.value.reduce((s, c) => s + c.unread, 0))

const visibleConvos = computed(() => {
  let list = msgConvos.value.filter(c => !hiddenCodes.value.has(String(c.student_code)))
  if (msgConvoSearch.value) {
    const q = msgConvoSearch.value.toLowerCase()
    list = list.filter(c => c.student_name.toLowerCase().includes(q))
  }
  return list
})

const msgClasses = computed(() => {
  const s = new Set(msgAllStudents.value.map(x => x.class_id).filter(Boolean))
  return [...s].sort()
})

const msgFilteredStudents = computed(() => {
  let list = msgAllStudents.value.map(s => ({
    student_code: String(s.student_code),
    name: `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim(),
    class_id: s.class_id || '',
  }))
  if (msgClassFilter.value) list = list.filter(x => x.class_id === msgClassFilter.value)
  if (msgNameSearch.value) {
    const q = msgNameSearch.value.toLowerCase()
    list = list.filter(x => x.name.toLowerCase().includes(q))
  }
  return list.sort((a, b) => a.class_id.localeCompare(b.class_id) || a.name.localeCompare(b.name, 'th'))
})

function scrollToBottom() {
  nextTick(() => {
    const el = bubblesRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
    const last = el.lastElementChild
    if (last) last.scrollIntoView({ behavior: 'instant', block: 'end' })
  })
}

async function refreshTeacherMsgs() {
  if (!selectedCode.value) return
  const schoolId  = authStore.schoolId
  const teacherId = String(authStore.profile?.teacher_id || '')
  const { data } = await supabase.from('student_messages').select('*')
    .eq('school_id', schoolId).eq('teacher_id', teacherId).eq('student_code', selectedCode.value)
    .order('created_at', { ascending: true })
  convoMsgs.value = data || []
  scrollToBottom()
}

async function loadMsgConvos() {
  msgLoading.value = true
  _loadHidden()
  const schoolId  = authStore.schoolId
  const teacherId = String(authStore.profile?.teacher_id || '')
  try {
    const { data } = await supabase.from('student_messages')
      .select('student_code, sender, content, created_at, read_by_teacher')
      .eq('school_id', schoolId).eq('teacher_id', teacherId)
      .order('created_at', { ascending: false }).limit(1000)

    const byCode = {}
    for (const m of (data || [])) {
      const key = String(m.student_code)
      if (!byCode[key]) {
        byCode[key] = { student_code: key, last_content: m.content || '📎', unread: 0, last_at: m.created_at }
      }
      if (m.sender === 'student' && !m.read_by_teacher) byCode[key].unread++
    }

    // ดึงชื่อ + รูป + ห้อง นักเรียนจาก DB ทุกห้อง
    const codes = Object.keys(byCode)
    const nameMap  = { ...studentNameMap.value }
    const photoMap = { ...msgStudentPhotoMap.value }
    const classMap = {}
    if (codes.length) {
      const { data: stuData } = await supabase.from('students')
        .select('student_code, prefix, first_name, last_name, photo_url, class_id')
        .eq('school_id', schoolId).in('student_code', codes)
      for (const s of (stuData || [])) {
        const k = String(s.student_code)
        nameMap[k]  = `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim()
        if (s.photo_url) photoMap[k] = s.photo_url
        classMap[k] = s.class_id || ''
      }
    }
    msgStudentNameMap.value  = nameMap
    msgStudentPhotoMap.value = photoMap

    msgConvos.value = Object.values(byCode)
      .map(c => ({
        ...c,
        student_name: nameMap[c.student_code] || c.student_code,
        class_id: classMap[c.student_code] || '',
        last_time: fmtMsgTime(c.last_at),
      }))
      .sort((a, b) => (b.last_at || '') > (a.last_at || '') ? 1 : -1)

    // โหลดนักเรียนทุกคนในโรงเรียน สำหรับส่งข้อความเริ่มใหม่
    const { data: allStu } = await supabase.from('students')
      .select('student_code, prefix, first_name, last_name, class_id, photo_url')
      .eq('school_id', schoolId).eq('is_active', true)
      .order('class_id').order('first_name')
    msgAllStudents.value = allStu || []
    for (const s of (allStu || [])) {
      const k = String(s.student_code)
      if (!nameMap[k]) nameMap[k] = `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim()
      if (s.photo_url && !photoMap[k]) photoMap[k] = s.photo_url
    }
    msgStudentNameMap.value  = { ...nameMap }
    msgStudentPhotoMap.value = { ...photoMap }
  } finally {
    msgLoading.value = false
  }
}

async function selectConvo(studentCode) {
  selectedCode.value = studentCode
  const schoolId  = authStore.schoolId
  const teacherId = String(authStore.profile?.teacher_id || '')
  const { data } = await supabase.from('student_messages').select('*')
    .eq('school_id', schoolId).eq('teacher_id', teacherId).eq('student_code', studentCode)
    .order('created_at', { ascending: true })
  convoMsgs.value = data || []

  await supabase.from('student_messages').update({ read_by_teacher: true })
    .eq('school_id', schoolId).eq('teacher_id', teacherId)
    .eq('student_code', studentCode).eq('sender', 'student').eq('read_by_teacher', false)
  const c = msgConvos.value.find(c => c.student_code === studentCode)
  if (c) c.unread = 0

  if (msgChannel) supabase.removeChannel(msgChannel)
  msgChannel = supabase.channel(`t_msgs_${schoolId}_${teacherId}_${studentCode}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_messages',
      filter: `school_id=eq.${schoolId}` }, payload => {
      const m = payload.new
      if (m.student_code !== selectedCode.value || m.teacher_id !== teacherId) return
      if (m.sender === 'teacher') return  // skip own (already added locally)
      convoMsgs.value = [...convoMsgs.value, m]
      supabase.from('student_messages').update({ read_by_teacher: true }).eq('id', m.id)
      scrollToBottom()
    }).subscribe()

  scrollToBottom()
}

async function onTeacherAttach(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  for (const file of files) {
    const isImage = file.type.startsWith('image')
    const isVideo = file.type.startsWith('video')
    let preview = ''
    if (isImage) {
      preview = await new Promise(r => {
        const fr = new FileReader(); fr.onload = ev => r(ev.target.result); fr.readAsDataURL(file)
      })
    }
    pendingAttachments.value.push({
      file, preview,
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
    })
  }
}

async function sendTeacherMsg() {
  const text = msgText.value.trim()
  const atts = [...pendingAttachments.value]
  if (!text && !atts.length) return
  if (msgSending.value) return

  msgSending.value = true
  msgText.value = ''
  pendingAttachments.value = []

  const schoolId  = authStore.schoolId
  const teacherId = String(authStore.profile?.teacher_id || '')
  const localId   = `local_${Date.now()}`
  const now       = new Date().toISOString()

  // Add locally immediately
  convoMsgs.value = [...convoMsgs.value, {
    id: localId, sender: 'teacher',
    content: text || null, attachments: [],
    read_by_student: false, created_at: now,
  }]
  scrollToBottom()

  try {
    const attachments = []
    for (const att of atts) {
      const url = await uploadViaGAS(att.file, schoolId, 'msg_teacher')
      attachments.push({ url, type: att.type, name: att.file.name })
    }
    if (attachments.length) {
      convoMsgs.value = convoMsgs.value.map(m => m.id === localId ? { ...m, attachments } : m)
    }
    const stuData = msgAllStudents.value.find(s => String(s.student_code) === String(selectedCode.value))
    const { error } = await supabase.from('student_messages').insert({
      school_id: schoolId, student_code: selectedCode.value,
      class_id: stuData?.class_id || homeroomClass.value,
      teacher_id: teacherId, sender: 'teacher',
      content: text || null,
      attachments: attachments.length ? attachments : [],
      read_by_student: false,
    })
    if (error) throw error

    // Update sidebar convo list
    const code = String(selectedCode.value)
    const stuData2 = msgAllStudents.value.find(s => String(s.student_code) === code)
    const existing = msgConvos.value.find(c => String(c.student_code) === code)
    if (existing) {
      existing.last_content = text || '📎'
      existing.last_at = now
      existing.last_time = fmtMsgTime(now)
      msgConvos.value = [existing, ...msgConvos.value.filter(c => c !== existing)]
    } else {
      msgConvos.value = [{
        student_code: code,
        student_name: msgStudentNameMap.value[code] || code,
        class_id: stuData2?.class_id || '',
        last_content: text || '📎',
        last_at: now, last_time: fmtMsgTime(now), unread: 0,
      }, ...msgConvos.value]
    }
    // ถ้าเคยซ่อน ให้เอาออกจาก hidden
    if (hiddenCodes.value.has(code)) {
      hiddenCodes.value = new Set([...hiddenCodes.value].filter(c => c !== code))
      localStorage.setItem(_hiddenKey(), JSON.stringify([...hiddenCodes.value]))
    }
  } catch (e) {
    convoMsgs.value = convoMsgs.value.filter(m => m.id !== localId)
    msgText.value = text
    pendingAttachments.value = atts
    ElMessage.error('ส่งข้อความไม่สำเร็จ: ' + (e.message || e))
  } finally {
    msgSending.value = false
  }
}

// ─── Load ─────────────────────────────────────────────────────
async function findHomeroomClass() {
  const teacherId = authStore.profile?.teacher_id
  if (!teacherId) return null
  const { data } = await supabase
    .from('classes')
    .select('class_name')
    .eq('school_id', authStore.schoolId)
    .filter('homeroom_teacher_ids', 'cs', `{"${teacherId}"}`)
    .limit(1)
    .maybeSingle()
  return data?.class_name || null
}

async function loadData() {
  if (!homeroomClass.value) return
  loading.value = true
  try {
    const { start, end } = getDateRange(period.value)
    const schoolId = authStore.schoolId
    const termId   = schoolStore.currentTerm

    const [stuRes, actRes] = await Promise.all([
      supabase
        .from('students')
        .select('student_code, prefix, first_name, last_name, seat_number, status, guardian_primary, guardian_secondary, parent_name, parent_phone')
        .eq('school_id', schoolId)
        .eq('class_id', homeroomClass.value)
        .or('student_status.is.null,student_status.eq.เรียนอยู่')
        .order('seat_number'),
      supabase
        .from('teach_actuals')
        .select('date, period_number, slot_type, is_filled, student_records')
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .eq('class_id', homeroomClass.value)
        .gte('date', start)
        .lte('date', end)
        .order('date'),
    ])

    if (stuRes.error) throw stuRes.error
    if (actRes.error) throw actRes.error

    students.value = (stuRes.data || [])
      .filter(s => !s.status || s.status === 'เรียนอยู่')
      .map(s => ({
        student_id:        s.student_code,
        prefix:            s.prefix || '',
        name:              s.first_name || '',
        surname:           s.last_name || '',
        seat_number:       s.seat_number,
        guardian_primary:  s.guardian_primary || null,
        guardian_secondary: s.guardian_secondary || null,
        parent_name:       s.parent_name || '',
        parent_phone:      s.parent_phone || '',
      }))
    actuals.value = actRes.data || []
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

// ── badge counts: โหลดตั้งแต่ mount ไม่รอกดแท็บ ──────────────
async function loadBadgeCounts() {
  const schoolId  = authStore.schoolId
  const teacherId = String(authStore.profile?.teacher_id || '')
  const cls       = homeroomClass.value
  if (!schoolId || !teacherId || !cls) return

  // โหลดพร้อมกัน
  await Promise.all([
    loadGoodDeeds(),
    loadMsgConvos(),
  ])

  // Realtime: แจ้งเตือนเมื่อมีข้อความ/ความดีใหม่
  if (badgeChannel) supabase.removeChannel(badgeChannel)
  badgeChannel = supabase
    .channel(`badge_${schoolId}_${teacherId}`)
    // ข้อความใหม่จากนักเรียน
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'student_messages',
      filter: `school_id=eq.${schoolId}`,
    }, payload => {
      const m = payload.new
      if (m.teacher_id !== teacherId || m.sender !== 'student') return
      // อัปเดต convo list
      const existing = msgConvos.value.find(c => c.student_code === m.student_code)
      if (existing) {
        existing.last_content = m.content || '📎'
        if (mainTab.value !== 'messages' || selectedCode.value !== m.student_code) {
          existing.unread = (existing.unread || 0) + 1
        }
      } else {
        const name = msgStudentNameMap.value[m.student_code] || m.student_code
        msgConvos.value.unshift({ student_code: m.student_code, student_name: name, last_content: m.content || '📎', unread: 1 })
      }
      // toast แจ้งเตือนเมื่ออยู่แท็บอื่น
      if (mainTab.value !== 'messages') {
        const name = msgStudentNameMap.value[m.student_code] || m.student_code
        ElNotification({ title: '💬 ข้อความใหม่', message: `${name}: ${m.content || '📎'}`, type: 'info', duration: 4000 })
      }
    })
    // ความดีใหม่จากนักเรียน
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'student_good_deeds',
      filter: `school_id=eq.${schoolId}`,
    }, payload => {
      const d = payload.new
      if (d.class_id !== cls) return
      goodDeeds.value.unshift({ ...d })
      if (mainTab.value !== 'deeds') {
        ElNotification({ title: '🌟 บันทึกความดีใหม่', message: d.title || 'นักเรียนส่งบันทึกความดี', type: 'success', duration: 4000 })
      }
    })
    .subscribe()
}

onUnmounted(() => {
  if (msgChannel)   supabase.removeChannel(msgChannel)
  if (badgeChannel) supabase.removeChannel(badgeChannel)
})

onMounted(async () => {
  loading.value = true
  try {
    // โหลด school settings (homeroom periods + watchlist settings)
    const { data: schoolRow } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', authStore.schoolId)
      .maybeSingle()
    const tl = schoolRow?.settings?.teaching_log_settings || {}
    homeroomPeriods.value = Array.isArray(tl.homeroom_special_periods) ? tl.homeroom_special_periods : []
    const ws = tl.watchlist_settings || {}
    wSettings.absent_streak   = Number(ws.absent_streak ?? 3)
    wSettings.late_streak     = Number(ws.late_streak ?? 3)
    wSettings.skip_count      = Number(ws.skip_count ?? 5)
    wSettings.attendance_pct  = Number(ws.attendance_pct ?? 80)

    // ชื่อครู
    const p = authStore.profile
    const teacherCode = p?.teacher_id || p?.teacherId
    if (teacherCode) {
      const { data: tRow } = await supabase
        .from('teachers')
        .select('prefix, first_name, last_name')
        .eq('school_id', authStore.schoolId)
        .eq('teacher_code', teacherCode)
        .maybeSingle()
      if (tRow) myName.value = `${tRow.prefix || ''}${tRow.first_name || ''} ${tRow.last_name || ''}`.trim()
    }
    if (!myName.value) myName.value = p?.displayName || p?.display_name || ''

    const cls = await findHomeroomClass()
    if (!cls) { ElMessage.warning('ไม่พบห้องประจำชั้นของคุณ'); loading.value = false; return }
    homeroomClass.value = cls
    await loadData()
    loadBadgeCounts()     // โหลด badge counts + เปิด realtime (ไม่ block)
    loadAnnouncements()   // โหลดข่าวสารตั้งแต่เปิดหน้า
    loadCiStudents()      // check-in dashboard
    loadCiReport()
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
    loading.value = false
  }
})
</script>

<style scoped>
.hd-page {
  padding: 20px 24px 40px;
  max-width: 1300px;
  margin: 0 auto;
}

/* Header */
.hd-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
  background: linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%);
  border-radius: 18px; padding: 20px 24px; margin-bottom: 20px;
  box-shadow: 0 6px 24px rgba(30,58,95,0.25);
}
.hd-header-left  { display: flex; align-items: center; gap: 16px; }
.hd-header-right { display: flex; gap: 8px; align-items: center; }
.hd-class-badge {
  background: rgba(255,255,255,0.2); color: white;
  font-size: 28px; font-weight: 900;
  padding: 10px 18px; border-radius: 14px;
  border: 2px solid rgba(255,255,255,0.3); white-space: nowrap;
}
.hd-title { font-size: 20px; font-weight: 800; color: white; }
.hd-sub   { font-size: 12px; color: rgba(255,255,255,0.75); margin-top: 3px; }

/* Period sub-tab row */
.hd-period-row {
  display: flex; align-items: center; gap: 10px; padding-top: 14px;
}
.hd-period-label {
  font-size: 11px; font-weight: 700; color: #92400e;
  white-space: nowrap; letter-spacing: 0.3px;
}

/* Period sub-tabs (filter/segmented style) */
.hd-period-tabs {
  display: inline-flex; gap: 0; flex-wrap: wrap;
  border: 1.5px solid #fbbf24; border-radius: 8px; overflow: hidden;
  background: #fffbeb;
}
.hd-period-btn {
  padding: 5px 16px; border-radius: 0; font-size: 12px; font-weight: 600;
  border: none; border-right: 1.5px solid #fbbf24;
  background: transparent; color: #92400e; cursor: pointer;
  transition: all 0.12s;
}
.hd-period-btn:last-child { border-right: none; }
.hd-period-btn:hover { background: #fef3c7; }
.hd-period-btn--active {
  background: #f59e0b; color: white; font-weight: 700;
}

/* Summary cards */
.hd-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
@media (max-width: 900px) { .hd-cards { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 600px) { .hd-cards { grid-template-columns: repeat(2,1fr); } }

.hd-card { border-radius: 14px; padding: 16px; text-align: center; border: 2px solid transparent; }
.hd-card--green  { background: #dcfce7; border-color: #86efac; }
.hd-card--red    { background: #fee2e2; border-color: #fca5a5; }
.hd-card--orange { background: #ffedd5; border-color: #fdba74; }
.hd-card--yellow { background: #fef9c3; border-color: #fde047; }
.hd-card--purple { background: #ede9fe; border-color: #c4b5fd; }

.hd-card-num { font-size: 28px; font-weight: 900; line-height: 1.1; }
.hd-card-lbl { font-size: 11px; font-weight: 600; margin-top: 4px; color: #475569; }
.hd-card--green  .hd-card-num { color: #15803d; }
.hd-card--red    .hd-card-num { color: #dc2626; }
.hd-card--orange .hd-card-num { color: #c2410c; }
.hd-card--yellow .hd-card-num { color: #854d0e; }
.hd-card--purple .hd-card-num { color: #6d28d9; }

/* Watch list */
.hd-watchlist {
  background: #fff7ed; border: 2px solid #fed7aa;
  border-radius: 14px; padding: 14px 18px;
}
.hd-section-title { font-size: 13px; font-weight: 800; color: #1e3a5f; }
.hd-watch-table :deep(.el-table) { border-radius: 10px; overflow: hidden; }

/* Main table */
.hd-table-wrap {
  background: white; border-radius: 14px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

/* Notify dialog */
.notify-body { font-size: 13px; }
.notify-student-header {
  background: linear-gradient(135deg,#1e3a5f,#0f766e);
  border-radius: 12px; padding: 12px 16px;
}
.notify-student-name { font-size: 17px; font-weight: 800; color: white; }
.notify-guardian { padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.notify-guardian-label { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 6px; }
.notify-contact-btns { display: flex; flex-wrap: wrap; gap: 6px; }
.notify-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
  border: none; cursor: pointer; text-decoration: none; transition: opacity 0.15s;
}
.notify-btn:hover { opacity: 0.85; }
.notify-btn--phone    { background: #dcfce7; color: #15803d; }
.notify-btn--line     { background: #bbf7d0; color: #065f46; }
.notify-btn--email    { background: #dbeafe; color: #1e40af; }
.notify-btn--telegram { background: #e0f2fe; color: #0369a1; }
.notify-btn--system   {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white; width: 100%; justify-content: center;
  padding: 9px 16px; font-size: 13px; border-radius: 10px;
}
.notify-btn--system:disabled { opacity: 0.65; cursor: default; }
.notify-btn--sent    { background: linear-gradient(135deg, #059669, #047857); }
.notify-system-row   { margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
.notify-system-label { font-size: 12px; font-weight: 700; color: #4f46e5; margin-bottom: 8px; }
.notify-system-hint  { font-size: 11px; color: #94a3b8; margin-top: 6px; text-align: center; }

/* ─── Main tabs (navigation style) ─── */
.hd-main-tabs {
  display: flex; gap: 8px; flex-wrap: nowrap;
  padding: 10px 12px; background: #f1f5f9;
  border-radius: 16px; margin-bottom: 0 !important;
}
.hd-main-tab {
  flex: 1; padding: 10px 8px; border-radius: 12px; font-size: 12px; font-weight: 700;
  border: 2px solid transparent;
  background: #fff; color: #94a3b8; cursor: pointer;
  transition: all 0.18s; display: flex; flex-direction: column; align-items: center;
  gap: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}
.hd-tab-icon { font-size: 20px; line-height: 1; }
.hd-tab-label { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; white-space: nowrap; }

/* inactive hover */
.hd-tab--attendance:hover { color: #3730a3; background: #eef2ff; border-color: #c7d2fe; }
.hd-tab--deeds:hover      { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.hd-tab--messages:hover   { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.hd-tab--checkin:hover    { color: #6b21a8; background: #faf5ff; border-color: #e9d5ff; }

/* active states — each tab gets its own color */
.hd-tab--attendance.hd-main-tab--active {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff; border-color: #4f46e5;
  box-shadow: 0 4px 14px rgba(79,70,229,0.4);
}
.hd-tab--deeds.hd-main-tab--active {
  background: linear-gradient(135deg, #d97706, #f59e0b);
  color: #fff; border-color: #d97706;
  box-shadow: 0 4px 14px rgba(217,119,6,0.4);
}
.hd-tab--messages.hd-main-tab--active {
  background: linear-gradient(135deg, #059669, #10b981);
  color: #fff; border-color: #059669;
  box-shadow: 0 4px 14px rgba(5,150,105,0.4);
}
.hd-tab--checkin.hd-main-tab--active {
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: #fff; border-color: #7c3aed;
  box-shadow: 0 4px 14px rgba(124,58,237,0.4);
}
.hd-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; border-radius: 99px; font-size: 11px;
  font-weight: 800; padding: 0 4px;
}
.hd-badge--green  { background: #bbf7d0; color: #065f46; }
.hd-badge--red    { background: #fecaca; color: #dc2626; }
.hd-badge--orange { background: #fed7aa; color: #c2410c; }

/* ── News / Announcements (now AnnSlideshow component) ── */
.hd-tab-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin-bottom: 16px;
}
.hd-empty { padding: 32px; text-align: center; color: #9ca3af; font-size: 14px; }

/* ─── Good Deeds ─── */
.deeds-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.deed-card {
  background: white; border: 2px solid #e2e8f0; border-radius: 14px;
  padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  display: flex; flex-direction: column; gap: 8px;
}
.deed-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.deed-student { font-size: 13px; font-weight: 700; color: #1e3a5f; }
.deed-title   { font-size: 15px; font-weight: 800; color: #1e1b4b; }
.deed-detail  { font-size: 13px; color: #64748b; }
.deed-photos  { display: flex; flex-wrap: wrap; gap: 6px; }
.deed-thumb   { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid #e2e8f0; }
.deed-footer  { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.deed-date    { font-size: 11px; color: #9ca3af; }
.deed-actions { display: flex; gap: 6px; }
.deed-approved-info { font-size: 12px; color: #059669; font-weight: 700; }

/* ─── Approval Dialog ─── */
.approve-body { font-size: 14px; }
.approve-student { font-size: 16px; font-weight: 800; color: #1e3a5f; margin-bottom: 6px; }
.approve-deed-title { font-size: 15px; font-weight: 700; color: #1e1b4b; }
.approve-deed-detail { font-size: 13px; color: #64748b; margin-top: 4px; }

/* ─── Messages ─── */
.msg-layout {
  display: grid; grid-template-columns: 260px 1fr; gap: 0;
  border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;
  height: 560px; background: white;
}
@media (max-width: 700px) {
  .msg-layout { grid-template-columns: 1fr; grid-template-rows: auto 1fr; height: 480px; }
}
/* ── Messages: Sidebar ───────────────────────────────────────────── */
.msg-sidebar {
  border-right: 1px solid #e2e8f0;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
}
.msg-sb-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 14px 10px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
}
.msg-sb-ttl { font-size: 15px; font-weight: 800; color: #1e293b; }
.msg-compose-btn {
  background: #0f766e; color: white; border: none; border-radius: 50%;
  width: 34px; height: 34px; font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background 0.15s;
}
.msg-compose-btn:hover { background: #0d6862; }
.msg-sb-search-row { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
.msg-sb-search {
  width: 100%; padding: 7px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 12px; outline: none; font-family: inherit; box-sizing: border-box;
}
.msg-convo-list { flex: 1; min-height: 0; overflow-y: auto; }
.msg-hint { padding: 14px 16px; font-size: 12px; color: #94a3b8; }
.msg-hint-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 32px 16px; color: #94a3b8; text-align: center; font-size: 13px; gap: 6px;
}
.msg-hint-icon { font-size: 32px; }
.msg-hint-sub { font-size: 11px; color: #cbd5e1; }

/* Convo items */
.msg-convo-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px 10px 14px; cursor: pointer; border-bottom: 1px solid #f8fafc;
  transition: background 0.12s; position: relative;
}
.msg-convo-item:hover { background: #f8fafc; }
.msg-convo-item--active { background: #f0fdf4; }
.msg-convo-body { flex: 1; min-width: 0; }
.msg-convo-r1 { display: flex; justify-content: space-between; align-items: baseline; }
.msg-convo-name { font-size: 13px; font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-convo-time { font-size: 10px; color: #94a3b8; flex-shrink: 0; margin-left: 4px; }
.msg-convo-r2 { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
.msg-convo-preview { font-size: 11px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.msg-unread-dot {
  background: #16a34a; color: white; border-radius: 99px;
  min-width: 18px; height: 18px; padding: 0 5px; font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.msg-convo-cls { font-size: 10px; color: #94a3b8; margin-top: 2px; }
.msg-hide-btn {
  opacity: 0; background: none; border: none; font-size: 18px; color: #94a3b8;
  cursor: pointer; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
  line-height: 1; transition: opacity 0.15s;
}
.msg-convo-item:hover .msg-hide-btn { opacity: 1; }

/* Avatar (shared sidebar + chat) */
.msg-av {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #0f766e, #1e3a5f);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 800; color: white; overflow: hidden;
}
.msg-av--sm { width: 36px; height: 36px; font-size: 14px; }
.msg-av-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }

/* New-message overlay */
.msg-new-overlay {
  position: absolute; inset: 0; background: white; z-index: 10;
  display: flex; flex-direction: column;
}
.msg-new-head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
  font-size: 14px; font-weight: 700; color: #1e293b;
}
.msg-new-back {
  font-size: 24px; background: none; border: none; cursor: pointer;
  color: #0f766e; padding: 0 4px; font-weight: 700; line-height: 1;
}
.msg-new-filters {
  display: flex; gap: 6px; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
}
.msg-new-search {
  flex: 1; min-width: 0; padding: 7px 12px; border: 1px solid #e2e8f0;
  border-radius: 8px; font-size: 13px; outline: none; font-family: inherit;
}
.msg-new-cls-sel {
  padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 12px; outline: none; background: white; font-family: inherit; max-width: 100px;
}
.msg-new-list { flex: 1; overflow-y: auto; }
.msg-new-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f8fafc;
  transition: background 0.12s;
}
.msg-new-item:hover { background: #f0fdf4; }
.msg-new-name { font-size: 13px; font-weight: 700; color: #1e293b; }
.msg-new-cls { font-size: 11px; color: #94a3b8; }

/* Slide transition */
.slide-left-enter-active, .slide-left-leave-active { transition: transform 0.2s ease; }
.slide-left-enter-from { transform: translateX(100%); }
.slide-left-leave-to  { transform: translateX(100%); }

/* ── Messages: Chat panel ────────────────────────────────────────── */
.msg-chat { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.msg-empty-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: #94a3b8;
}
.msg-empty-icon { font-size: 40px; }
.msg-empty-txt { font-size: 13px; text-align: center; }
.msg-chat-hd {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; background: white; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.msg-chat-hd-info { flex: 1; min-width: 0; }
.msg-chat-name { font-size: 14px; font-weight: 800; color: #1e293b; }
.msg-chat-sub  { font-size: 11px; color: #94a3b8; }
.msg-refresh-btn { background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px 6px; border-radius: 8px; flex-shrink: 0; }
.msg-refresh-btn:hover { background: #f1f5f9; }
.msg-bubbles { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #f8fafc; }
.msg-brow { display: flex; gap: 6px; }
.msg-brow--me { justify-content: flex-end; }
.msg-bav {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
  background: #7c3aed; color: white; font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; align-self: flex-end;
}
.msg-bubble {
  max-width: 70%; padding: 9px 13px; border-radius: 16px;
  font-size: 13px; line-height: 1.55; word-break: break-word;
}
.msg-bubble--them { background: white; color: #1e293b; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.msg-bubble--me   { background: #0f766e; color: white; border-bottom-right-radius: 4px; }
.msg-text { white-space: pre-wrap; }
.msg-att-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.msg-att-img {
  max-width: 180px; max-height: 180px; border-radius: 10px;
  cursor: pointer; object-fit: cover; display: block;
}
.msg-att-vid-wrap { display: inline-block; }
.msg-att-vid-link {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  background: rgba(0,0,0,.12); border-radius: 10px; color: inherit; text-decoration: none;
  font-size: 13px; font-weight: 600;
}
.msg-att-file {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
  background: rgba(0,0,0,.1); border-radius: 8px; color: inherit; text-decoration: none;
  font-size: 12px; font-weight: 600;
}
.msg-time { font-size: 10px; margin-top: 4px; opacity: 0.65; text-align: right; }
.msg-input-row {
  display: flex; gap: 8px; align-items: flex-end;
  padding: 10px 12px; border-top: 1px solid #e2e8f0; flex-shrink: 0; background: white;
}
.msg-input { flex: 1; }
.msg-attach-label {
  cursor: pointer; font-size: 18px; padding: 4px 6px; border-radius: 8px;
  display: flex; align-items: center; transition: background 0.12s;
}
.msg-attach-label:hover { background: #f1f5f9; }
.msg-pending-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 12px; border-top: 1px solid #f1f5f9; flex-shrink: 0; background: white; }
.msg-pending-item { position: relative; display: inline-flex; align-items: center; }
.msg-pending-thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; }
.msg-pending-file {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 72px; height: 52px; background: #1e293b; border-radius: 8px; gap: 2px;
}
.msg-pending-name { font-size: 9px; color: #94a3b8; text-align: center; padding: 0 3px; overflow: hidden; max-width: 66px; }
.msg-del-btn {
  position: absolute; top: -5px; right: -5px; background: #dc2626; color: white;
  border: none; border-radius: 50%; width: 16px; height: 16px; cursor: pointer;
  font-size: 9px; display: flex; align-items: center; justify-content: center;
}

/* ── Check-in Dashboard ─────────────────────────────────────────── */
.ci-section { background:white; border-radius:16px; padding:16px; margin-bottom:16px; box-shadow:0 2px 10px rgba(0,0,0,.06); }
.ci-section-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px; }
.ci-section-title { font-weight:700; font-size:1rem; color:#1e3a5f; }
.ci-date-nav { display:flex; align-items:center; gap:6px; }
.ci-nav-btn { padding:4px 10px; border:1.5px solid #d1d5db; border-radius:8px; background:white; cursor:pointer; font-size:1rem; line-height:1; }
.ci-nav-btn:disabled { opacity:.3; cursor:default; }
.ci-date-label { font-size:.82rem; font-weight:600; color:#374151; min-width:0; }
.ci-nav-today { padding:4px 10px; border:none; background:#1e3a5f; color:white; border-radius:8px; font-size:.76rem; cursor:pointer; }
.ci-stats-row { display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
.ci-stat { flex:1; min-width:60px; border-radius:12px; padding:8px; text-align:center; }
.ci-stat--green  { background:#d1fae5; } .ci-stat--amber { background:#fef3c7; }
.ci-stat--red    { background:#fee2e2; } .ci-stat--gray  { background:#f3f4f6; }
.ci-stat-n { display:block; font-size:1.25rem; font-weight:800; }
.ci-stat-l { display:block; font-size:.64rem; color:#4b5563; margin-top:1px; }
.ci-progress-wrap { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.ci-progress-bar { flex:1; height:10px; background:#e5e7eb; border-radius:99px; overflow:hidden; display:flex; }
.ci-bar-ontime { background:#10b981; } .ci-bar-late { background:#f59e0b; }
.ci-pct-text { font-size:.76rem; font-weight:700; color:#059669; white-space:nowrap; }
.ci-two-col { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; align-items:start; }
.ci-col { display:flex; flex-direction:column; min-width:0; }
.ci-col-rows { display:flex; flex-direction:column; gap:4px; max-height:380px; overflow-y:auto; }
.ci-absent-section { margin-top:4px; }
.ci-absent-rows { display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; }
.ci-row { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:8px; }
.ci-row--ontime { background:#f0fdf4; } .ci-row--late { background:#fffbeb; } .ci-row--absent { background:#fef2f2; }
.ci-group-header { font-size:.78rem; font-weight:800; padding:6px 10px; border-radius:8px; margin-bottom:4px; display:flex; align-items:center; gap:6px; }
.ci-group-header--ontime { background:#d1fae5; color:#065f46; }
.ci-group-header--late   { background:#fef3c7; color:#92400e; }
.ci-group-header--absent { background:#fee2e2; color:#991b1b; }
.ci-group-count { font-size:.72rem; font-weight:600; background:rgba(0,0,0,.1); border-radius:99px; padding:1px 8px; }
.ci-group-check-label { display:flex; align-items:center; cursor:pointer; }
.ci-group-selected-badge { font-size:.7rem; font-weight:700; background:rgba(0,0,0,.15); border-radius:99px; padding:1px 8px; }
.ci-group-action-btn { margin-left:auto; font-size:.72rem; font-weight:700; background:rgba(0,0,0,.15); border:none; border-radius:8px; padding:3px 10px; cursor:pointer; color:inherit; transition:background .15s; }
.ci-group-action-btn:hover { background:rgba(0,0,0,.28); }
.ci-row-time--late { color:#d97706; }
.ci-bulk-title { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:.82rem; font-weight:700; margin-bottom:10px; }
.ci-bulk-tag { font-size:.7rem; font-weight:700; border-radius:99px; padding:2px 8px; }
.ci-bulk-tag--ontime { background:rgba(16,185,129,.3); }
.ci-bulk-tag--late   { background:rgba(245,158,11,.3); }
.ci-bulk-tag--absent { background:rgba(239,68,68,.3); }
.ci-avatar-pair { display:flex; align-items:center; gap:4px; flex-shrink:0; }
.ci-avatar { width:36px; height:36px; border-radius:50%; background:#e5e7eb; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.78rem; flex-shrink:0; overflow:hidden; }
.ci-selfie-thumb { position:relative; width:36px; height:36px; border-radius:8px; overflow:hidden; border:2px solid #f59e0b; flex-shrink:0; }
.ci-selfie-badge { position:absolute; bottom:1px; right:1px; font-size:9px; line-height:1; }
.ci-avatar-img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.ci-filter-row { display:flex; gap:6px; flex-wrap:wrap; margin:10px 0 8px; }
.ci-chip { padding:4px 12px; border-radius:99px; border:1.5px solid #e5e7eb; background:white; font-size:.75rem; font-weight:600; cursor:pointer; color:#6b7280; transition:all .15s; }
.ci-chip--active { border-color:#4f46e5; color:#4f46e5; background:#eff6ff; }
.ci-chip--green.ci-chip--active  { border-color:#059669; color:#059669; background:#f0fdf4; }
.ci-chip--red.ci-chip--active    { border-color:#dc2626; color:#dc2626; background:#fef2f2; }
.ci-chip--purple.ci-chip--active { border-color:#7c3aed; color:#7c3aed; background:#f5f3ff; }
.ci-select-all-row { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; background:#f5f3ff; border-radius:8px; margin-bottom:4px; }
.ci-select-all-label { display:flex; align-items:center; gap:8px; font-size:.82rem; font-weight:600; color:#4c1d95; cursor:pointer; }
.ci-selected-count { font-size:.78rem; font-weight:700; color:#7c3aed; background:#ede9fe; padding:2px 10px; border-radius:99px; }
.ci-checkbox { width:16px; height:16px; accent-color:#7c3aed; cursor:pointer; }
.ci-row--selectable { cursor:pointer; }
.ci-row--selected { background:#ede9fe !important; outline:2px solid #7c3aed; outline-offset:-2px; border-radius:8px; }
.ci-bulk-bar { background:linear-gradient(135deg,#1e1b4b,#4c1d95); border-radius:14px; padding:14px 16px; margin-top:10px; color:white; }
.ci-bulk-presets { display:flex; gap:6px; flex-wrap:wrap; }
.ci-bulk-presets .ci-preset { font-size:.72rem; }
.ci-bulk-slide-enter-active, .ci-bulk-slide-leave-active { transition: all .25s ease; }
.ci-bulk-slide-enter-from, .ci-bulk-slide-leave-to { opacity:0; transform:translateY(10px); }
.ci-bdialog-info { font-size:.88rem; color:#374151; background:#f3f4f6; border-radius:8px; padding:8px 12px; }
.ci-nonschool-banner { background:#fef9c3; border:1.5px solid #fde047; border-radius:10px; padding:8px 14px; font-size:.82rem; font-weight:600; color:#854d0e; margin-bottom:10px; }
.ci-score-btn { background:rgba(250,204,21,.2); border:1.5px solid rgba(250,204,21,.6); border-radius:8px; padding:2px 7px; font-size:.8rem; cursor:pointer; flex-shrink:0; transition:background .15s; }
.ci-score-btn:hover { background:rgba(250,204,21,.45); }
.ci-bdialog { display:flex; flex-direction:column; gap:10px; }
.ci-bdialog-name { font-size:1rem; font-weight:800; color:#1e293b; }
.ci-bdialog-status { font-size:.82rem; font-weight:600; padding:4px 10px; border-radius:8px; display:inline-block; }
.ci-bdialog-status--ontime { background:#d1fae5; color:#065f46; }
.ci-bdialog-status--late   { background:#fef3c7; color:#92400e; }
.ci-bdialog-presets { display:flex; gap:6px; flex-wrap:wrap; }
.ci-preset { padding:5px 10px; border-radius:8px; border:1.5px solid; font-size:.75rem; font-weight:700; cursor:pointer; transition:all .15s; }
.ci-preset--pos { border-color:#059669; color:#059669; background:#f0fdf4; }
.ci-preset--pos:hover { background:#d1fae5; }
.ci-preset--neg { border-color:#dc2626; color:#dc2626; background:#fef2f2; }
.ci-preset--neg:hover { background:#fee2e2; }
.ci-bdialog-row { display:flex; flex-direction:column; gap:4px; }
.ci-bdialog-lbl { font-size:.75rem; font-weight:600; color:#6b7280; }
.ci-row-name { flex:1; font-size:.82rem; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ci-row-time { font-size:.76rem; color:#059669; font-weight:700; }
.ci-row-absent { font-size:.73rem; color:#dc2626; }
.ci-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.ci-dot--ontime { background:#10b981; } .ci-dot--late { background:#f59e0b; } .ci-dot--absent { background:#dc2626; }
.ci-empty { text-align:center; padding:20px; color:#d1d5db; font-size:.85rem; }
.ci-report-tabs { margin-top:4px; }
.ci-report-table { width:100%; }
.ci-report-head { display:grid; grid-template-columns:1fr repeat(4,52px); gap:4px; font-size:.72rem; font-weight:700; color:#6b7280; padding:6px 4px; border-bottom:2px solid #e5e7eb; }
.ci-report-row { display:grid; grid-template-columns:1fr repeat(4,52px); gap:4px; font-size:.78rem; padding:5px 4px; border-bottom:1px solid #f3f4f6; }
.ci-report-row--today { background:#eff6ff; border-radius:6px; font-weight:700; }
.ci-col--green { color:#059669; font-weight:600; text-align:center; }
.ci-col--amber { color:#d97706; font-weight:600; text-align:center; }
.ci-col--red   { color:#dc2626; font-weight:600; text-align:center; }
.ci-col--gray  { color:#6b7280; text-align:center; }
.ci-month-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:4px; }
.ci-month-cell { border-radius:8px; padding:6px 4px; text-align:center; border:1px solid transparent; }
.ci-month-cell--good    { background:#d1fae5; } .ci-month-cell--partial { background:#fef3c7; } .ci-month-cell--none { background:#fee2e2; }
.ci-month-cell--today   { border:2px solid #1e3a5f; }
.ci-month-num { font-size:.78rem; font-weight:700; }
.ci-month-pct { font-size:.65rem; color:#6b7280; }
.ci-row--clickable { cursor:pointer; transition:filter .15s; }
.ci-row--clickable:hover { filter:brightness(.95); }
.ci-selfie-thumb-wrap { flex-shrink:0; }
.ci-selfie-thumb { width:36px; height:36px; border-radius:8px; object-fit:cover; border:2px solid rgba(0,0,0,.08); box-shadow:0 1px 4px rgba(0,0,0,.12); }
/* Detail dialog */
.ci-detail { display:flex; flex-direction:column; gap:12px; }
.ci-detail-status { padding:8px 14px; border-radius:10px; font-weight:700; font-size:.9rem; text-align:center; }
.ci-detail-status--ontime { background:#d1fae5; color:#065f46; }
.ci-detail-status--late   { background:#fef3c7; color:#92400e; }
.ci-detail-body { display:flex; gap:12px; align-items:flex-start; }
.ci-detail-selfie-col { flex-shrink:0; }
.ci-detail-selfie { width:100px; height:100px; border-radius:12px; object-fit:cover; box-shadow:0 2px 10px rgba(0,0,0,.14); }
.ci-detail-no-selfie { width:100px; height:100px; background:#f3f4f6; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#9ca3af; }
.ci-detail-gps { flex:1; background:#f8fafc; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:7px; border:1px solid #e2e8f0; }
.ci-detail-gps-row { display:flex; justify-content:space-between; font-size:.8rem; color:#374151; }
.ci-detail-coord { font-family:monospace; font-size:.78rem; font-weight:600; }
.ci-detail-map-link { font-size:.78rem; color:#2563eb; text-decoration:none; font-weight:600; margin-top:2px; }
.ci-detail-map-link:hover { text-decoration:underline; }
.ci-detail-map { width:100%; height:200px; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; }
</style>
