<template>
  <AppLayout>
    <div class="dashboard-wrapper p-6">
      <el-alert
        v-if="schoolStore.isViewOnlyMode"
        type="error"
        :closable="false"
        show-icon
        class="mb-4"
        title="แพ็กเกจหมดอายุ: ตอนนี้ใช้งานได้เฉพาะดูตารางสอน"
        :description="expiredDescription"
      />

      <el-alert
        v-else-if="schoolStore.planNotice?.unread"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        :title="schoolStore.planNotice?.title || 'มีการอัปเดตแพ็กเกจ'"
        :description="schoolStore.planNotice?.message || ''"
      />

      <!-- Header Section -->
      <div class="header-section mb-8 p-8 rounded-3xl bg-grad-royal text-white shadow-xl relative overflow-hidden">
        <div class="relative z-10">
          <div class="flex items-center gap-4 mb-4">
            <div class="avatar-lg bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl" style="overflow:hidden">
              <img v-if="authStore.profile?.photo_url" :src="authStore.profile.photo_url" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" @error="e => e.target.style.display='none'" />
              <span v-else>{{ authStore.profile?.displayName?.charAt(0) || '👋' }}</span>
            </div>
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight">สวัสดี, {{ authStore.profile?.displayName }}</h1>
              <p class="text-white/80">ยินดีต้อนรับกลับสู่ระบบจัดการตารางสอน</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 text-sm mt-6 pt-6 border-t border-white/10">
            <div class="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
              <span>📅</span> {{ thaiDate }}
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
              <span>🏫</span> {{ schoolStore.schoolName || 'ยังไม่ได้กำหนดชื่อโรงเรียน' }}
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
              <span>🏷️</span> {{ schoolStore.termLabel }}
            </div>
          </div>
        </div>
        <div class="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-10 -left-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
      </div>

      <!-- Package Info Card (admin only) -->
      <div v-if="authStore.isAdmin && schoolStore.pricingPlan" class="package-info-card mb-6"
        :class="schoolStore.isViewOnlyMode ? 'pkg-expired' : 'pkg-active'">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="pkg-icon">💳</div>
            <div>
              <div class="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">แพ็กเกจปัจจุบัน</div>
              <div class="flex flex-wrap items-center gap-3">
                <span class="font-bold text-lg">{{ schoolStore.pricingPlan.code || '-' }} บาท/เดือน</span>
                <span class="text-sm opacity-80">ผู้จัดได้ {{ schoolStore.schedulerLimit }} คน</span>
                <span class="pkg-badge" :class="schoolStore.isViewOnlyMode ? 'pkg-badge-expired' : 'pkg-badge-active'">
                  {{ schoolStore.isViewOnlyMode ? '⛔ หมดอายุ' : '✅ ใช้งานได้' }}
                </span>
              </div>
              <div class="text-sm mt-1 opacity-80">
                {{ schoolStore.isViewOnlyMode ? 'หมดอายุเมื่อ' : 'ใช้งานได้ถึง' }}: {{ subscriptionExpiryLabel }}
              </div>
            </div>
          </div>
          <router-link to="/admin/renewal">
            <el-button :type="schoolStore.isViewOnlyMode ? 'danger' : 'primary'" size="small">
              💳 {{ schoolStore.isViewOnlyMode ? 'ต่ออายุทันที' : 'ต่ออายุ / จัดการแพ็กเกจ' }}
            </el-button>
          </router-link>
        </div>
      </div>

      <!-- ── Check-in Dashboard (admin/ผู้บริหาร) ──────────────────── -->
      <div v-if="authStore.isAdmin" class="ci-admin-card mb-8">
        <div class="ci-admin-head">
          <div class="ci-admin-title">⏰ เช็คอินนักเรียน ทั้งโรงเรียน</div>
          <div class="ci-date-nav">
            <button class="ci-nav-btn" @click="adminCiPrevDay">‹</button>
            <span class="ci-date-label">{{ fmtCiDate(adminCiDate) }}</span>
            <button class="ci-nav-btn" @click="adminCiNextDay" :disabled="adminIsToday">›</button>
            <button class="ci-nav-today" @click="adminCiGoToday">วันนี้</button>
          </div>
        </div>

        <!-- โดยรวม -->
        <div class="ci-stats-row" v-loading="adminCiLoading">
          <div class="ci-stat ci-stat--green"><span class="ci-stat-n">{{ adminCiTotal.checkedIn }}</span><span class="ci-stat-l">เช็คอินแล้ว</span></div>
          <div class="ci-stat ci-stat--amber"><span class="ci-stat-n">{{ adminCiTotal.late }}</span><span class="ci-stat-l">มาสาย</span></div>
          <div class="ci-stat ci-stat--red"><span class="ci-stat-n">{{ adminCiTotal.notYet }}</span><span class="ci-stat-l">ยังไม่เช็คอิน</span></div>
          <div class="ci-stat ci-stat--gray"><span class="ci-stat-n">{{ adminCiTotal.total }}</span><span class="ci-stat-l">ทั้งหมด</span></div>
        </div>

        <!-- แยกตามห้อง -->
        <div class="ci-class-grid">
          <div v-for="cls in adminCiByClass" :key="cls.class_id" class="ci-class-card"
            :class="cls.pct >= 80 ? 'ci-class-card--good' : cls.pct >= 50 ? 'ci-class-card--partial' : 'ci-class-card--low'">
            <div class="ci-class-name">{{ cls.class_id }}</div>
            <div class="ci-class-bar"><div class="ci-class-fill" :style="`width:${cls.pct}%`"></div></div>
            <div class="ci-class-stats">
              <span class="ci-col--green">{{ cls.checkedIn }}</span>/<span>{{ cls.total }}</span>
              <span class="ci-class-pct">{{ cls.pct }}%</span>
            </div>
            <div v-if="cls.late" class="ci-class-late">สาย {{ cls.late }}</div>
          </div>
        </div>

        <!-- Report tabs -->
        <el-tabs v-model="adminCiTab" class="ci-report-tabs mt-4" @tab-change="loadAdminCiReport">
          <el-tab-pane label="รายสัปดาห์" name="weekly">
            <div class="ci-report-table">
              <div class="ci-report-head"><span>วัน</span><span>เช็คอิน</span><span>สาย</span><span>ขาด</span><span>%</span></div>
              <div v-for="d in adminCiWeekDays" :key="d.date" class="ci-report-row" :class="d.date === adminCiDate ? 'ci-report-row--today' : ''">
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
              <div v-for="d in adminCiMonthDays" :key="d.date" class="ci-month-cell"
                :class="[`ci-month-cell--${d.checkedIn >= d.total*0.8 ? 'good' : d.checkedIn > 0 ? 'partial' : 'none'}`, d.date === adminCiDate ? 'ci-month-cell--today' : '']">
                <div class="ci-month-num">{{ d.label }}</div>
                <div class="ci-month-pct">{{ d.total ? Math.round(d.checkedIn/d.total*100) : 0 }}%</div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="รายเทอม" name="term">
            <div class="ci-report-table">
              <div class="ci-report-head"><span>สัปดาห์</span><span>เช็คอิน</span><span>สาย</span><span>%</span></div>
              <div v-for="w in adminCiTermWeeks" :key="w.weekStart" class="ci-report-row">
                <span>{{ fmtWeekLabel(w.weekStart) }}</span>
                <span class="ci-col--green">{{ w.ontime }}</span>
                <span class="ci-col--amber">{{ w.late }}</span>
                <span class="ci-col--gray">{{ w.days && w.total ? Math.round(w.checkedIn/(w.days*w.total)*100) : 0 }}%</span>
              </div>
              <div v-if="!adminCiTermWeeks.length" class="ci-empty">ไม่มีข้อมูล</div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- ══ กรอบรวม: สถิติ + สถานะครู ══ -->
      <div class="section-box mb-8" v-if="canSeeDailyStats && schoolStore.isTeachingLogEnabled">

        <!-- Date picker row -->
        <div class="dash-date-row mb-6">
          <button class="dash-date-nav" @click="prevDay">◀</button>
          <div class="dash-date-center">
            <el-date-picker
              v-model="selectedDate"
              type="date"
              value-format="YYYY-MM-DD"
              :clearable="false"
              :disabled-date="d => d > new Date()"
              size="small"
              style="width:160px"
              @change="loadDailyStats"
            />
            <span class="dash-date-label">{{ formatThaiDate(selectedDate) }}</span>
            <span v-if="isToday" class="dash-date-today-chip">วันนี้</span>
          </div>
          <button class="dash-date-nav" :disabled="isToday" @click="nextDay">▶</button>
        </div>

        <!-- Stats Grid -->
        <div class="section-box-label">📊 ภาพรวมโรงเรียน</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" v-loading="loadingStats">
          <div v-for="stat in stats" :key="stat.label" class="stat-card-modern p-5 rounded-2xl flex flex-col items-center justify-center text-center" :style="{ background: stat.bg, boxShadow: `0 4px 16px ${stat.shadow}` }">
            <div class="stat-icon-circle mb-2" :style="{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize:'24px' }">
              {{ stat.icon }}
            </div>
            <div class="text-3xl font-black mb-1" style="color:#fff">
              {{ stat.value === null ? '...' : stat.value }}
            </div>
            <div class="text-xs font-bold uppercase tracking-widest" style="color:rgba(255,255,255,0.8)">{{ stat.label }}</div>
          </div>
        </div>

        <!-- Teacher Status -->
        <div class="section-box-label">👨‍🏫 สถานะครู {{ isToday ? 'วันนี้' : formatThaiDate(selectedDate) }}
          <span class="section-box-refresh">
            <span class="inline-block w-2 h-2 rounded-full animate-pulse" :class="loadingDaily ? 'bg-gray-300' : 'bg-emerald-400'"></span>
            {{ lastRefreshed ? 'อัปเดต ' + lastRefreshed : 'กำลังโหลด...' }}
          </span>
        </div>
        <div class="grid grid-cols-3 gap-4" v-loading="loadingDaily && !lastRefreshed">
          <div class="rounded-2xl p-5 text-center border" style="background:#f0fdf4;border-color:#bbf7d0">
            <div class="text-4xl font-black mb-1 text-emerald-600">{{ teacherStats.atWork }}</div>
            <div class="text-sm font-bold text-emerald-700">มาทำงาน</div>
            <div class="text-xs text-emerald-500 mt-1">จาก {{ teacherStats.total }} คน</div>
          </div>
          <div class="rounded-2xl p-5 text-center border" style="background:#fff7ed;border-color:#fed7aa">
            <div class="text-4xl font-black mb-1 text-orange-500">{{ teacherStats.onLeave }}</div>
            <div class="text-sm font-bold text-orange-600">ลา</div>
            <div class="text-xs text-orange-400 mt-1">ลาป่วย / ลากิจ</div>
          </div>
          <div class="rounded-2xl p-5 text-center border" style="background:#eff6ff;border-color:#bfdbfe">
            <div class="text-4xl font-black mb-1 text-blue-500">{{ teacherStats.onOfficial }}</div>
            <div class="text-sm font-bold text-blue-600">ไปราชการ</div>
            <div v-if="teacherStats.onTraining" class="text-xs text-blue-400 mt-1">
              + อบรม {{ teacherStats.onTraining }} คน
            </div>
          </div>
        </div>

      </div>

      <!-- fallback stats สำหรับ role ที่ไม่เห็น daily stats -->
      <div v-if="!canSeeDailyStats || !schoolStore.isTeachingLogEnabled" class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8" v-loading="loadingStats">
        <div v-for="stat in stats" :key="stat.label" class="stat-card-modern p-6 rounded-2xl flex flex-col items-center justify-center text-center" :style="{ background: stat.bg, boxShadow: `0 6px 20px ${stat.shadow}` }">
          <div class="stat-icon-circle mb-3" :style="{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize:'26px' }">{{ stat.icon }}</div>
          <div class="text-3xl font-black mb-1" style="color:#fff">{{ stat.value === null ? '...' : stat.value }}</div>
          <div class="text-xs font-bold uppercase tracking-widest" style="color:rgba(255,255,255,0.8)">{{ stat.label }}</div>
        </div>
      </div>

      <!-- ── Student Attendance ──────────────────────────────── -->
      <div v-if="canSeeDailyStats && schoolStore.isTeachingLogEnabled" class="section-box mb-10">

        <!-- Section header -->
        <div class="section-box-label" style="margin-bottom:16px">
          🎓 การมาเรียน {{ isToday ? 'วันนี้' : formatThaiDate(selectedDate) }}
          <span class="text-sm font-normal text-gray-400 ml-1">(จากคาบเข้าแถว)</span>
          <span class="section-box-refresh">
            <span v-if="isToday" class="inline-block w-2 h-2 bg-violet-400 rounded-full animate-pulse"></span>
            <span v-if="isToday">รีเฟรชทุก 1 นาที ·</span>
            <span v-if="lastRefreshed">{{ lastRefreshed }}</span>
          </span>
        </div>

        <!-- Loading -->
        <div v-if="loadingDaily && !classAttendance.length" class="text-center py-14 text-gray-400">
          <div class="text-4xl mb-3">⏳</div>กำลังโหลด...
        </div>

        <!-- No data -->
        <div v-else-if="!classAttendance.length" class="text-center py-14 text-gray-400 glass-card rounded-2xl">
          <div class="text-4xl mb-3">📊</div>ยังไม่มีข้อมูลการมาเรียน{{ isToday ? 'วันนี้' : formatThaiDate(selectedDate) }}
        </div>

        <template v-else>
          <!-- ── School-wide summary ── -->
          <div class="att-summary-card mb-6">
            <div class="att-summary-left">
              <div class="att-big-pct" :style="{ color: barColor(schoolTotals.pct) }">
                {{ schoolTotals.pct }}<span class="att-big-pct-unit">%</span>
              </div>
              <div class="att-big-label">มาเรียนทั้งโรงเรียน</div>
              <div class="att-rooms-badge">
                บันทึกแล้ว {{ schoolTotals.filledRooms }}/{{ schoolTotals.totalRooms }} ห้อง
              </div>
            </div>
            <div class="att-summary-stats">
              <div class="att-stat-pill att-stat-green">
                <div class="att-stat-num">{{ schoolTotals.present }}</div>
                <div class="att-stat-lbl">มาเรียน</div>
              </div>
              <div class="att-stat-pill att-stat-amber">
                <div class="att-stat-num">{{ schoolTotals.late }}</div>
                <div class="att-stat-lbl">มาสาย</div>
              </div>
              <div class="att-stat-pill att-stat-red">
                <div class="att-stat-num">{{ schoolTotals.absent }}</div>
                <div class="att-stat-lbl">ขาดเรียน</div>
              </div>
              <div v-if="schoolTotals.leave > 0" class="att-stat-pill att-stat-blue">
                <div class="att-stat-num">{{ schoolTotals.leave }}</div>
                <div class="att-stat-lbl">ลา</div>
              </div>
              <div class="att-stat-pill att-stat-gray">
                <div class="att-stat-num">{{ schoolTotals.total }}</div>
                <div class="att-stat-lbl">ทั้งหมด</div>
              </div>
            </div>
            <!-- Overall bar -->
            <div class="att-summary-bar-wrap">
              <div class="att-summary-bar">
                <div class="att-bar-seg att-bar-green"
                  :style="{ width: schoolTotals.total ? (schoolTotals.present / schoolTotals.total * 100) + '%' : '0%' }"></div>
                <div class="att-bar-seg att-bar-amber"
                  :style="{ width: schoolTotals.total ? (schoolTotals.late / schoolTotals.total * 100) + '%' : '0%' }"></div>
                <div class="att-bar-seg att-bar-red"
                  :style="{ width: schoolTotals.total ? (schoolTotals.absent / schoolTotals.total * 100) + '%' : '0%' }"></div>
              </div>
              <div class="att-bar-legend">
                <span class="att-leg-dot att-leg-green"></span>มาเรียน
                <span class="att-leg-dot att-leg-amber"></span>มาสาย
                <span class="att-leg-dot att-leg-red"></span>ขาดเรียน
                <span class="att-leg-dot att-leg-gray"></span>ไม่มีข้อมูล
              </div>
            </div>
          </div>

          <!-- ── Per-class cards ── -->
          <div class="att-class-list">
            <div
              v-for="cls in classAttendance"
              :key="cls.class_id"
              class="att-row"
              :class="cls.filled ? '' : 'att-row-alert'"
            >
              <!-- Header: ชื่อห้อง + ครู + % -->
              <div class="att-row-head">
                <div class="att-row-head-left">
                  <span class="att-room-name">{{ cls.class_name }}</span>
                  <span class="att-teacher-name">{{ cls.teacher_name || '—' }}</span>
                </div>
                <div v-if="cls.filled" class="att-pct-badge" :style="{ color: barColor(cls.pct) }">
                  {{ cls.pct }}%
                </div>
                <div v-else class="att-alert-badge">⚠️ ยังไม่บันทึก</div>
              </div>

              <!-- Bar (filled only) -->
              <div v-if="cls.filled" class="att-hbar">
                <div class="att-hbar-seg att-bar-green"
                  :style="{ width: cls.total ? (cls.present / cls.total * 100) + '%' : '0%' }"></div>
                <div class="att-hbar-seg att-bar-amber"
                  :style="{ width: cls.total ? (cls.late / cls.total * 100) + '%' : '0%' }"></div>
                <div class="att-hbar-seg att-bar-red"
                  :style="{ width: cls.total ? (cls.absent / cls.total * 100) + '%' : '0%' }"></div>
              </div>

              <!-- Alert row (unfilled) -->
              <div v-if="!cls.filled" class="att-alert-row">
                <span class="att-alert-count">นักเรียน {{ cls.enrolled }} คน ยังไม่มีข้อมูลวันนี้</span>
                <button class="att-nudge-btn" @click="openNudge(cls)">📨 ส่งข้อความทวง</button>
              </div>

              <!-- Stat chips (filled only) -->
              <div v-if="cls.filled" class="att-chips">
                <div class="att-chip att-chip-green">
                  <span class="att-chip-num">{{ cls.present }}</span>
                  <span class="att-chip-lbl">มาเรียน</span>
                </div>
                <div class="att-chip att-chip-amber">
                  <span class="att-chip-num">{{ cls.late }}</span>
                  <span class="att-chip-lbl">มาสาย</span>
                </div>
                <div class="att-chip att-chip-red">
                  <span class="att-chip-num">{{ cls.absent }}</span>
                  <span class="att-chip-lbl">ขาด</span>
                </div>
                <div v-if="cls.leave > 0" class="att-chip att-chip-blue">
                  <span class="att-chip-num">{{ cls.leave }}</span>
                  <span class="att-chip-lbl">ลา</span>
                </div>
                <div class="att-chip att-chip-total">
                  <span class="att-chip-num">{{ cls.total }}</span>
                  <span class="att-chip-lbl">ทั้งหมด</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Nudge Dialog ── -->
          <el-dialog v-model="nudgeDialog.visible" title="📨 ส่งข้อความทวงครูที่ปรึกษา" width="420px" align-center>
            <div v-if="nudgeDialog.cls" class="nudge-body">
              <div class="nudge-class">ห้อง {{ nudgeDialog.cls.class_name }}</div>
              <div class="nudge-teacher">ครูที่ปรึกษา: {{ nudgeDialog.cls.teacher_name }}</div>
              <div class="nudge-msg-label">ข้อความ:</div>
              <el-input v-model="nudgeDialog.message" type="textarea" :rows="4" />
            </div>
            <template #footer>
              <div class="flex gap-2 justify-end flex-wrap">
                <el-button @click="nudgeDialog.visible = false" plain>ปิด</el-button>
                <el-button plain @click="nudgeCopy">📋 คัดลอก</el-button>
                <el-button
                  v-if="nudgeDialog.cls?.teacher_id"
                  type="primary"
                  @click="nudgeSendSystem"
                  :loading="nudgeSending"
                >📲 ส่งในระบบ</el-button>
              </div>
            </template>
          </el-dialog>
        </template>
      </div>

      <!-- ── คาบสอนแทนวันนี้ (เฉพาะครูที่ได้รับมอบหมาย) ──────────── -->
      <div v-if="subPendingCount > 0 && schoolStore.isTeachingLogEnabled"
        class="sub-alert-banner mb-6">
        <div class="sub-alert-icon">🔄</div>
        <div class="sub-alert-body">
          <div class="sub-alert-title">คุณมีคาบสอนแทนวันนี้ {{ subPendingCount }} คาบ ที่ยังไม่ได้บันทึก</div>
          <div class="sub-alert-sub">กรุณาไปบันทึกการเข้าสอนในระบบ</div>
        </div>
        <router-link to="/teacher/teaching-log">
          <el-button type="danger" size="small" style="white-space:nowrap;font-weight:700">บันทึกเดี๋ยวนี้ →</el-button>
        </router-link>
      </div>

      <!-- Quick Action Cards -->
      <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span class="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
        เมนูจัดการหลัก
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-if="authStore.isAdmin" class="action-card-modern group">
          <div class="card-bg bg-grad-primary"></div>
          <div class="card-content">
            <div class="icon-box text-4xl mb-4">🗂️</div>
            <h3 class="text-xl font-bold mb-2">จัดการข้อมูลพื้นฐาน</h3>
            <p class="text-white/70 text-sm mb-6">จัดการข้อมูลครู นักเรียน รายวิชา และห้องเรียนทั้งหมด</p>
            <router-link to="/admin/teachers">
              <el-button color="white" class="w-full text-indigo-600 font-bold rounded-xl shadow-lg">เข้าสู่เมนูจัดการ</el-button>
            </router-link>
          </div>
        </div>

        <div v-if="authStore.isAdmin || authStore.isScheduler" class="action-card-modern group">
          <div class="card-bg bg-grad-success"></div>
          <div class="card-content">
            <div class="icon-box text-4xl mb-4">📅</div>
            <h3 class="text-xl font-bold mb-2">จัดตารางสอน</h3>
            <p class="text-white/70 text-sm mb-6">สร้างและปรับแต่งตารางสอนสำหรับภาคเรียนปัจจุบัน</p>
            <router-link :to="schoolStore.isViewOnlyMode ? '/planning/print' : '/planning/timetable'">
              <el-button color="white" class="w-full text-emerald-600 font-bold rounded-xl shadow-lg">
                {{ schoolStore.isViewOnlyMode ? 'ไปหน้าดูตาราง' : 'ไปยังหน้าจัดตาราง' }}
              </el-button>
            </router-link>
          </div>
        </div>

        <div v-if="authStore.isAdmin" class="action-card-modern group">
          <div class="card-bg bg-grad-info"></div>
          <div class="card-content">
            <div class="icon-box text-4xl mb-4">📊</div>
            <h3 class="text-xl font-bold mb-2">สรุปรายงาน</h3>
            <p class="text-white/70 text-sm mb-6">ดูรายงานภาระงานและสรุปผลการจัดตารางรายห้อง/รายครู</p>
            <router-link to="/reports/assignments">
              <el-button color="white" class="w-full text-blue-600 font-bold rounded-xl shadow-lg">ดูรายงาน</el-button>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { supabase } from '@/supabase/client'
import { useCheckinDashboard } from '@/composables/useCheckinDashboard'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getTeachers, getStudents, getSubjects, getClasses } = useSchoolDb()
const { getCheckinSummaryByClass, getWeeklyReport, getMonthlyReport, getTermReport, thaiToday } = useCheckinDashboard()

const canSeeDailyStats = computed(() =>
  authStore.isAdmin || authStore.hasAnyRole?.(['school_director'])
)

// ── Admin check-in dashboard ───────────────────────────────────
const adminCiDate      = ref(thaiToday())
const adminCiLoading   = ref(false)
const adminCiByClass   = ref([])
const adminCiTab       = ref('weekly')
const adminCiWeekDays  = ref([])
const adminCiMonthDays = ref([])
const adminCiTermWeeks = ref([])
const adminIsToday     = computed(() => adminCiDate.value === thaiToday())
const adminCiTotal     = computed(() => adminCiByClass.value.reduce(
  (a, c) => ({ checkedIn: a.checkedIn + c.checkedIn, late: a.late + c.late, notYet: a.notYet + c.notYet, total: a.total + c.total }),
  { checkedIn: 0, late: 0, notYet: 0, total: 0 }
))
function fmtCiDate(d) { return d ? new Date(d).toLocaleDateString('th-TH', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '' }
function fmtWeekLabel(d) { return d ? new Date(d).toLocaleDateString('th-TH', { day:'numeric', month:'short' }) : '' }
async function loadAdminCiByClass() {
  adminCiLoading.value = true
  try { adminCiByClass.value = await getCheckinSummaryByClass(adminCiDate.value) }
  catch { adminCiByClass.value = [] } finally { adminCiLoading.value = false }
}
async function loadAdminCiReport(tab) {
  const t = tab || adminCiTab.value
  if (t === 'weekly') {
    const r = await getWeeklyReport(adminCiDate.value)
    adminCiWeekDays.value = r.days
  } else if (t === 'monthly') {
    const [y, m] = adminCiDate.value.split('-').map(Number)
    const r = await getMonthlyReport(y, m)
    adminCiMonthDays.value = r.days
  } else if (t === 'term') {
    const ts = schoolStore.termStart || `${new Date().getFullYear()}-05-01`
    const te = schoolStore.termEnd   || thaiToday()
    const r  = await getTermReport(ts, te)
    adminCiTermWeeks.value = r.weeks
  }
}
function stepDate(dateStr, n) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m-1, d+n).toLocaleDateString('en-CA') }
function adminCiPrevDay() { adminCiDate.value = stepDate(adminCiDate.value, -1); loadAdminCiByClass(); loadAdminCiReport() }
function adminCiNextDay() { if (adminIsToday.value) return; adminCiDate.value = stepDate(adminCiDate.value, 1); loadAdminCiByClass(); loadAdminCiReport() }
function adminCiGoToday() { adminCiDate.value = thaiToday(); loadAdminCiByClass(); loadAdminCiReport() }

// ── Thai date ──────────────────────────────────────────────────
const THAI_MONTHS    = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const THAI_DAYS_FULL = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

const thaiDate = computed(() => {
  const [y, m, d] = thaiToday().split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `วัน${THAI_DAYS_FULL[dow]}ที่ ${d} ${THAI_MONTHS[m - 1]} พ.ศ. ${y + 543}`
})

const expiredDescription = computed(() => {
  const exp = schoolStore.subscriptionExpiry
  if (!exp) return 'กรุณาติดต่อผู้ดูแลเพื่อทำการต่ออายุแพ็กเกจ'
  return `หมดอายุเมื่อ ${exp.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}`
})

const subscriptionExpiryLabel = computed(() => {
  const exp = schoolStore.subscriptionExpiry
  if (!exp) return 'ยังไม่กำหนด'
  return exp.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
})

// ── Summary stats (top 4 cards) ───────────────────────────────
const loadingStats = ref(false)
const stats = ref([
  { icon: '👨‍🏫', label: 'ครูทั้งหมด',      value: null, color: '#6366f1', bg: 'linear-gradient(135deg,#4f46e5,#7c3aed)', shadow: 'rgba(99,102,241,0.35)' },
  { icon: '👨‍🎓', label: 'นักเรียนทั้งหมด',  value: null, color: '#10b981', bg: 'linear-gradient(135deg,#059669,#10b981)', shadow: 'rgba(16,185,129,0.35)' },
  { icon: '📚',  label: 'วิชาทั้งหมด',      value: null, color: '#f59e0b', bg: 'linear-gradient(135deg,#d97706,#f59e0b)', shadow: 'rgba(245,158,11,0.35)' },
  { icon: '🏫',  label: 'ห้องเรียน',         value: null, color: '#3b82f6', bg: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', shadow: 'rgba(59,130,246,0.35)' },
])

// ── Daily live stats ──────────────────────────────────────────
const loadingDaily    = ref(false)
const lastRefreshed   = ref('')
const teacherStats    = ref({ total: 0, atWork: 0, onLeave: 0, onOfficial: 0, onTraining: 0 })
const classAttendance = ref([])

const todayStr      = thaiToday()
const selectedDate  = ref(todayStr)
const isToday       = computed(() => selectedDate.value === thaiToday())

function prevDay() {
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1)
  selectedDate.value = dt.toLocaleDateString('en-CA')
  loadDailyStats()
}
function nextDay() {
  if (isToday.value) return
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  selectedDate.value = dt.toLocaleDateString('en-CA')
  loadDailyStats()
}
function formatThaiDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })
}
let refreshTimer = null

const schoolTotals = computed(() => {
  const all     = classAttendance.value
  const filled  = all.filter(c => c.filled)
  const total   = all.reduce((s, c) => s + (c.enrolled || c.total), 0)
  const present = filled.reduce((s, c) => s + c.present, 0)
  const late    = filled.reduce((s, c) => s + c.late,    0)
  const absent  = filled.reduce((s, c) => s + c.absent,  0)
  const leave   = filled.reduce((s, c) => s + (c.leave || 0), 0)
  const pct     = total ? Math.round((present + late) / total * 100) : 0
  return { total, present, late, absent, leave, pct, filledRooms: filled.length, totalRooms: all.length }
})

async function loadDailyStats() {
  const schoolId = authStore.schoolId
  if (!schoolId) return
  loadingDaily.value = true
  try {
    const today = selectedDate.value

    const [leavesRes, schoolRes, classesRes, studentsRes] = await Promise.all([
      // Teachers with leave requests covering selected date (not cancelled)
      supabase.from('leave_requests')
        .select('leave_type')
        .eq('school_id', schoolId)
        .contains('dates', [today])
        .neq('status', 'cancelled'),

      // School settings → homeroom_special_periods
      supabase.from('schools')
        .select('settings')
        .eq('id', schoolId)
        .maybeSingle(),

      // All real classes (exclude schedule-only placeholder classes)
      supabase.from('classes')
        .select('class_name, homeroom_teacher_id, homeroom_teacher_ids, homeroom_teacher_names_snapshot, is_schedule_only')
        .eq('school_id', schoolId)
        .or('is_schedule_only.is.null,is_schedule_only.eq.false')
        .order('class_name'),

      // นักเรียนกำลังเรียนอยู่ ทุกห้อง — นับเพื่อใช้เป็น total จริง
      supabase.from('students')
        .select('class_id')
        .eq('school_id', schoolId)
        .or('student_status.eq.เรียนอยู่,student_status.is.null'),
    ])

    // Resolve homeroom period numbers from school settings
    const tl = schoolRes.data?.settings?.teaching_log_settings || {}
    const homeroomSpecialPeriods = Array.isArray(tl.homeroom_special_periods)
      ? tl.homeroom_special_periods : []
    const homeroomPeriodNums = homeroomSpecialPeriods.map(hp => Number(hp.period))
    // Query teach_actuals for homeroom periods today
    let homeroomQuery = supabase.from('teach_actuals')
      .select('class_id, student_records, is_filled, record_by_name, period_number, slot_type')
      .eq('school_id', schoolId)
      .eq('date', today)

    if (homeroomPeriodNums.length > 0) {
      homeroomQuery = homeroomQuery.in('period_number', homeroomPeriodNums)
    } else {
      homeroomQuery = homeroomQuery.eq('slot_type', 'homeroom')
    }

    const homeroomRes = await homeroomQuery

    // Teacher leave counts
    const leaves     = leavesRes.data || []
    const onLeave    = leaves.filter(l => ['sick', 'personal'].includes(l.leave_type)).length
    const onOfficial = leaves.filter(l => l.leave_type === 'official').length
    const onTraining = leaves.filter(l => l.leave_type === 'training').length
    const totalTeachers = typeof stats.value[0].value === 'number' ? stats.value[0].value : 0
    teacherStats.value = {
      total:      totalTeachers,
      atWork:     Math.max(0, totalTeachers - onLeave - onOfficial - onTraining),
      onLeave,
      onOfficial,
      onTraining,
    }

    // นับนักเรียนกำลังเรียนอยู่ต่อห้อง
    const enrolledMap = {}
    for (const s of (studentsRes.data || [])) {
      if (s.class_id) enrolledMap[s.class_id] = (enrolledMap[s.class_id] || 0) + 1
    }

    // Build map: class_id → teach_actual (is_filled ก่อน)
    const actualMap = {}
    for (const ta of (homeroomRes.data || [])) {
      const existing = actualMap[ta.class_id]
      if (!existing || (!existing.is_filled && ta.is_filled)) {
        actualMap[ta.class_id] = ta
      }
    }

    // Merge all classes with homeroom records
    classAttendance.value = (classesRes.data || []).map(cls => {
      const enrolled     = enrolledMap[cls.class_name] || 0
      const homeroomName = (cls.homeroom_teacher_names_snapshot || []).join(', ') || '-'
      const ta = actualMap[cls.class_name]

      if (!ta || !ta.is_filled) {
        return {
          class_id:      cls.class_name,
          class_name:    cls.class_name,
          teacher_name:  homeroomName,
          teacher_id:    cls.homeroom_teacher_id || null,
          enrolled,
          present: 0, late: 0, absent: 0, leave: 0,
          total:   enrolled,
          pct:     0,
          filled:  false,
        }
      }

      const records = ta.student_records ? Object.values(ta.student_records) : []
      const present = records.filter(r => ['มาเรียน'].includes(r.status)).length
      const late    = records.filter(r => r.status === 'มาสาย').length
      const absent  = records.filter(r => ['ขาดเรียน','โดดเรียน'].includes(r.status)).length
      const leave   = records.filter(r => ['ลาป่วย','ลากิจ','ลา','ไปราชการ','บวช'].includes(r.status)).length
      // total = ใช้จำนวนนักเรียนจริง ถ้ายังไม่ครบให้ใช้ enrolled
      const total   = enrolled || records.length
      return {
        class_id:     cls.class_name,
        class_name:   cls.class_name,
        teacher_name: homeroomName,
        teacher_id:   cls.homeroom_teacher_id || null,
        recorder:     ta.record_by_name || '-',
        enrolled,
        present, late, absent, leave, total,
        pct:    total ? Math.round((present + late) / total * 100) : 0,
        filled: true,
      }
    })

    const now = new Date()
    lastRefreshed.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} น.`
  } catch (e) {
    console.error('loadDailyStats:', e)
  } finally {
    loadingDaily.value = false
  }
}

// ─── Nudge (ทวงครู) ───────────────────────────────────────────
const nudgeDialog  = ref({ visible: false, cls: null, message: '' })
const nudgeSending = ref(false)

function openNudge(cls) {
  const dateLabel = new Date(selectedDate.value + 'T00:00:00').toLocaleDateString('th-TH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  nudgeDialog.value = {
    visible: true,
    cls,
    message: `เรียน ${cls.teacher_name || 'ครูที่ปรึกษา'}\n\nขอความกรุณาบันทึกการมาเรียนของห้อง ${cls.class_name} ประจำวัน${dateLabel} ในระบบ SchoolLOG ด้วยนะครับ/ค่ะ\n\nขอบคุณครับ/ค่ะ`,
  }
}

function nudgeCopy() {
  navigator.clipboard.writeText(nudgeDialog.value.message)
  ElMessage.success('คัดลอกข้อความแล้ว')
}

async function nudgeSendSystem() {
  const cls = nudgeDialog.value.cls
  if (!cls?.teacher_id) return
  nudgeSending.value = true
  try {
    await supabase.from('teacher_notifications').insert({
      school_id:   authStore.schoolId,
      teacher_id:  cls.teacher_id,
      message:     nudgeDialog.value.message,
      type:        'nudge_attendance',
      class_id:    cls.class_id,
      created_by:  authStore.profile?.teacher_id || null,
    })
    ElMessage.success(`ส่งข้อความถึงครู ${cls.teacher_name} แล้ว`)
    nudgeDialog.value.visible = false
  } catch (e) {
    ElMessage.error('ส่งไม่สำเร็จ: ' + e.message)
  } finally {
    nudgeSending.value = false
  }
}

function barColor(pct) {
  if (pct >= 80) return '#10b981'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
}

// ── คาบสอนแทนวันนี้ ──────────────────────────────────────────
const subPendingCount = ref(0)

async function loadSubPending() {
  const tid = authStore.profile?.teacher_id
  const sid = authStore.schoolId
  if (!tid || !sid) return
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    const { count } = await supabase
      .from('teach_actuals')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', sid)
      .eq('date', today)
      .eq('actual_teacher_id', tid)
      .eq('is_substitute_mandatory', true)
      .eq('is_filled', false)
    subPendingCount.value = count || 0
  } catch { subPendingCount.value = 0 }
}

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(async () => {
  loadingStats.value = true
  try {
    const [teachers, students, subjects, classes] = await Promise.all([
      getTeachers(),
      getStudents(null, { activeOnly: true }),
      getSubjects(),
      getClasses(),
    ])
    stats.value[0].value = teachers.length
    stats.value[1].value = students.length
    stats.value[2].value = subjects.length
    stats.value[3].value = classes.filter(c => !c.is_schedule_only).length
  } catch (e) {
    ElMessage.error('โหลดข้อมูลสถิติไม่สำเร็จ: ' + e.message)
    stats.value.forEach(s => { if (s.value === null) s.value = '-' })
  } finally {
    loadingStats.value = false
  }

  if (canSeeDailyStats.value && schoolStore.isTeachingLogEnabled) {
    await loadDailyStats()
    refreshTimer = setInterval(() => { if (isToday.value) loadDailyStats() }, 60_000)
  }
  if (authStore.isAdmin) {
    loadAdminCiByClass()
    loadAdminCiReport()
  }
  loadSubPending()
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
/* ══ Section Box — กรอบใหญ่รวม ══════════════════════════════════ */
.section-box {
  background: #fff;
  border-radius: 24px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.07);
  border: 1.5px solid #e8eaf6;
}
.section-box-label {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 800; color: #1e293b;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f1f5f9;
}
.section-box-refresh {
  margin-left: auto; display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 400; color: #94a3b8;
}

/* ── คาบสอนแทน banner ────────────────────────────────────────── */
.sub-alert-banner {
  display: flex; align-items: center; gap: 14px;
  background: linear-gradient(135deg, #fef2f2, #fff7ed);
  border: 1.5px solid #fca5a5;
  border-left: 5px solid #ef4444;
  border-radius: 14px;
  padding: 14px 18px;
  box-shadow: 0 4px 16px rgba(239,68,68,0.12);
  animation: sub-alert-pulse 2s infinite;
}
@keyframes sub-alert-pulse {
  0%, 100% { box-shadow: 0 4px 16px rgba(239,68,68,0.12); }
  50%       { box-shadow: 0 4px 24px rgba(239,68,68,0.28); }
}
.sub-alert-icon  { font-size: 2rem; flex-shrink: 0; }
.sub-alert-body  { flex: 1; }
.sub-alert-title { font-weight: 800; font-size: 1rem; color: #dc2626; }
.sub-alert-sub   { font-size: 0.82rem; color: #b45309; margin-top: 2px; }

/* ── Check-in Admin Dashboard ─────────────────────────────────── */
.ci-admin-card { background:white; border-radius:20px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,.06); }
.ci-admin-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
.ci-admin-title { font-weight:800; font-size:1.05rem; color:#1e3a5f; }
.ci-date-nav { display:flex; align-items:center; gap:6px; }
.ci-nav-btn { padding:5px 12px; border:1.5px solid #d1d5db; border-radius:8px; background:white; cursor:pointer; font-size:1rem; }
.ci-nav-btn:disabled { opacity:.3; cursor:default; }
.ci-date-label { font-size:.84rem; font-weight:600; color:#374151; }
.ci-nav-today { padding:5px 12px; border:none; background:#1e3a5f; color:white; border-radius:8px; font-size:.78rem; cursor:pointer; }
.ci-stats-row { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
.ci-stat { flex:1; min-width:70px; border-radius:14px; padding:12px 10px; text-align:center; box-shadow:0 4px 14px rgba(0,0,0,.1); }
.ci-stat--green { background:linear-gradient(135deg,#059669,#34d399); }
.ci-stat--amber { background:linear-gradient(135deg,#d97706,#fbbf24); }
.ci-stat--red   { background:linear-gradient(135deg,#dc2626,#f87171); }
.ci-stat--gray  { background:linear-gradient(135deg,#475569,#94a3b8); }
.ci-stat-n { display:block; font-size:1.5rem; font-weight:900; color:#fff; }
.ci-stat-l { display:block; font-size:.68rem; color:rgba(255,255,255,0.85); margin-top:2px; font-weight:600; }
.ci-class-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-bottom:4px; }
.ci-class-card { border-radius:12px; padding:10px; border:1.5px solid; }
.ci-class-card--good    { background:#f0fdf4; border-color:#a7f3d0; }
.ci-class-card--partial { background:#fffbeb; border-color:#fde68a; }
.ci-class-card--low     { background:#fef2f2; border-color:#fca5a5; }
.ci-class-name { font-weight:800; font-size:.9rem; margin-bottom:4px; }
.ci-class-bar  { height:6px; background:#e5e7eb; border-radius:99px; overflow:hidden; margin-bottom:4px; }
.ci-class-fill { height:100%; background:linear-gradient(90deg,#059669,#34d399); border-radius:99px; }
.ci-class-stats { font-size:.78rem; display:flex; align-items:center; gap:4px; }
.ci-class-pct { margin-left:auto; font-weight:700; color:#059669; }
.ci-class-late  { font-size:.72rem; color:#d97706; margin-top:2px; }
.ci-col--green { color:#059669; font-weight:600; text-align:center; }
.ci-col--amber { color:#d97706; font-weight:600; text-align:center; }
.ci-col--red   { color:#dc2626; font-weight:600; text-align:center; }
.ci-col--gray  { color:#6b7280; text-align:center; }
.ci-report-table { width:100%; }
.ci-report-head { display:grid; grid-template-columns:1fr repeat(4,60px); gap:4px; font-size:.72rem; font-weight:700; color:#6b7280; padding:6px 4px; border-bottom:2px solid #e5e7eb; }
.ci-report-row  { display:grid; grid-template-columns:1fr repeat(4,60px); gap:4px; font-size:.8rem; padding:5px 4px; border-bottom:1px solid #f3f4f6; }
.ci-report-row--today { background:#eff6ff; border-radius:6px; font-weight:700; }
.ci-month-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
.ci-month-cell { border-radius:8px; padding:6px 2px; text-align:center; border:1px solid transparent; }
.ci-month-cell--good    { background:#d1fae5; } .ci-month-cell--partial { background:#fef3c7; } .ci-month-cell--none { background:#fee2e2; }
.ci-month-cell--today   { border:2px solid #1e3a5f; }
.ci-month-num { font-size:.8rem; font-weight:700; }
.ci-month-pct { font-size:.65rem; color:#6b7280; }
.ci-empty { text-align:center; padding:20px; color:#d1d5db; font-size:.85rem; }
.package-info-card {
  border-radius: 16px;
  padding: 16px 20px;
  color: white;
}
.pkg-active  { background: linear-gradient(135deg, #0ea5e9, #2563eb); box-shadow: 0 4px 16px rgba(14,165,233,0.2); }
.pkg-expired { background: linear-gradient(135deg, #dc2626, #9f1239); box-shadow: 0 4px 16px rgba(220,38,38,0.2); }
.pkg-icon {
  font-size: 28px; width: 48px; height: 48px;
  background: rgba(255,255,255,0.2); border-radius: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.pkg-badge     { font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; }
.pkg-badge-active  { background: rgba(255,255,255,0.25); color: white; }
.pkg-badge-expired { background: rgba(255,255,255,0.25); color: #fef2f2; }

.dashboard-wrapper { max-width: 1200px; margin: 0 auto; }
.avatar-lg { width: 64px; height: 64px; }

.stat-card-modern { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); border-radius: 24px; }
.stat-card-modern:hover { transform: translateY(-8px); }
.stat-icon-circle {
  width: 50px; height: 50px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 24px;
}

/* ── Attendance redesign ─────────────────────── */

/* Summary card */
.att-summary-card {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%);
  border-radius: 20px;
  padding: 24px 28px;
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
  box-shadow: 0 8px 32px rgba(99,102,241,0.35);
}
.att-summary-left { text-align: center; min-width: 100px; }
.att-big-pct {
  font-size: 52px; font-weight: 900; line-height: 1;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.att-big-pct-unit { font-size: 24px; font-weight: 700; }
.att-big-label { font-size: 13px; color: rgba(255,255,255,0.75); font-weight: 600; margin-top: 4px; }
.att-rooms-badge {
  display: inline-block; margin-top: 8px;
  font-size: 11px; font-weight: 700; color: #c7d2fe;
  background: rgba(255,255,255,0.12); border-radius: 99px; padding: 3px 10px;
}

.att-summary-stats { display: flex; gap: 12px; flex-wrap: wrap; }
.att-stat-pill {
  border-radius: 14px; padding: 12px 18px; text-align: center;
  min-width: 72px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.att-stat-green { background: rgba(16,185,129,0.25); border: 1px solid rgba(16,185,129,0.4); }
.att-stat-amber { background: rgba(245,158,11,0.25); border: 1px solid rgba(245,158,11,0.4); }
.att-stat-red   { background: rgba(239,68,68,0.25);  border: 1px solid rgba(239,68,68,0.4); }
.att-stat-blue  { background: rgba(59,130,246,0.25); border: 1px solid rgba(59,130,246,0.4); }
.att-stat-gray  { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); }
.att-stat-num { font-size: 26px; font-weight: 900; color: #fff; line-height: 1; }
.att-stat-lbl { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); margin-top: 3px; }

.att-summary-bar-wrap { flex: 1; min-width: 200px; }
.att-summary-bar {
  height: 14px; border-radius: 99px; background: rgba(255,255,255,0.1);
  overflow: hidden; display: flex; margin-bottom: 10px;
}
.att-bar-seg { height: 100%; transition: width 0.8s ease; }
.att-bar-green { background: #10b981; }
.att-bar-amber { background: #f59e0b; }
.att-bar-red   { background: #ef4444; }
.att-bar-legend {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  font-size: 11px; color: rgba(255,255,255,0.65); font-weight: 600;
}
.att-leg-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; margin-right: 4px;
}
.att-leg-green { background: #10b981; }
.att-leg-amber { background: #f59e0b; }
.att-leg-red   { background: #ef4444; }
.att-leg-gray  { background: rgba(255,255,255,0.3); }

/* ── Date picker row ─────────────────────────────── */
.dash-date-row {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  background: #f8faff; border: 1px solid #e0e7ff;
  border-radius: 16px; padding: 12px 20px;
}
.dash-date-nav {
  width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #c7d2fe;
  background: white; font-size: 14px; font-weight: 700; color: #4f46e5;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.dash-date-nav:hover:not(:disabled) { background: #eef2ff; }
.dash-date-nav:disabled { opacity: 0.35; cursor: not-allowed; }
.dash-date-center { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
.dash-date-label { font-size: 15px; font-weight: 700; color: #1e293b; }
.dash-date-today-chip {
  font-size: 11px; font-weight: 800; background: #4f46e5; color: white;
  border-radius: 99px; padding: 2px 10px;
}

/* ── Per-class cards ──────────────────────────────── */
.att-class-list {
  display: flex; flex-direction: column; gap: 10px;
}
.att-row {
  background: #fff; border-radius: 16px;
  border: 1.5px solid #e8eaf6;
  padding: 14px 18px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  transition: box-shadow 0.15s, transform 0.12s;
}
.att-row:hover { box-shadow: 0 4px 18px rgba(99,102,241,0.12); transform: translateY(-1px); }
.att-row-unfilled { border-color: #f1f5f9; background: #fafbff; }
.att-row-alert {
  border-color: #fca5a5 !important;
  background: linear-gradient(135deg, #fff5f5, #fff1f1) !important;
  box-shadow: 0 0 0 2px rgba(239,68,68,0.15);
}

/* header: ห้อง + ครู + % */
.att-row-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.att-row-head-left { display: flex; flex-direction: column; gap: 2px; }
.att-room-name  { font-size: 15px; font-weight: 900; color: #1e293b; }
.att-teacher-name { font-size: 12px; color: #94a3b8; }

.att-pct-badge  { font-size: 22px; font-weight: 900; line-height: 1; }
.att-alert-badge {
  font-size: 12px; font-weight: 800; color: #dc2626;
  background: #fee2e2; border: 1.5px solid #fca5a5;
  border-radius: 8px; padding: 4px 12px;
  animation: pulse-red 1.5s ease-in-out infinite;
}
@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
.att-alert-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-top: 6px; flex-wrap: wrap;
}
.att-alert-count { font-size: 12px; color: #ef4444; font-weight: 600; }
.att-nudge-btn {
  font-size: 12px; font-weight: 700; padding: 6px 14px;
  background: #dc2626; color: white; border: none; border-radius: 8px;
  cursor: pointer; white-space: nowrap; transition: background 0.15s;
}
.att-nudge-btn:hover { background: #b91c1c; }
.nudge-body { display: flex; flex-direction: column; gap: 8px; }
.nudge-class { font-size: 20px; font-weight: 900; color: #1e3a5f; }
.nudge-teacher { font-size: 14px; color: #64748b; margin-bottom: 4px; }
.nudge-msg-label { font-size: 13px; font-weight: 700; color: #374151; }

/* bar */
.att-hbar {
  height: 14px; border-radius: 8px; background: #f1f5f9;
  overflow: hidden; display: flex; margin-bottom: 12px;
}
.att-hbar-seg { height: 100%; transition: width 0.7s ease; }

/* stat chips (เหมือนส่วนสรุปบน) */
.att-chips {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.att-chip {
  display: flex; align-items: center; gap: 6px;
  border-radius: 10px; padding: 7px 14px;
  flex: 1; min-width: 70px;
}
.att-chip-num { font-size: 20px; font-weight: 900; line-height: 1; }
.att-chip-lbl { font-size: 12px; font-weight: 700; opacity: 0.85; }

.att-chip-green { background: linear-gradient(135deg,#dcfce7,#bbf7d0); color: #15803d; border:1.5px solid #86efac; }
.att-chip-amber { background: linear-gradient(135deg,#ffedd5,#fed7aa); color: #c2410c; border:1.5px solid #fdba74; }
.att-chip-red   { background: linear-gradient(135deg,#fee2e2,#fecaca); color: #b91c1c; border:1.5px solid #fca5a5; }
.att-chip-blue  { background: linear-gradient(135deg,#ede9fe,#ddd6fe); color: #6d28d9; border:1.5px solid #c4b5fd; }
.att-chip-total { background: linear-gradient(135deg,#dbeafe,#bfdbfe); color: #1d4ed8; border:1.5px solid #93c5fd; }

/* Quick action cards */
.action-card-modern {
  position: relative; height: 240px; border-radius: 28px;
  overflow: hidden; padding: 30px; color: white;
  transition: all 0.4s cubic-bezier(0.4,0,0.2,1);
  box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1);
}
.action-card-modern:hover { transform: scale(1.02); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2); }
.card-bg { position: absolute; inset: 0; z-index: 0; transition: opacity 0.4s; }
.action-card-modern:hover .card-bg { opacity: 0.9; }
.card-content { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; }
.icon-box {
  width: 60px; height: 60px;
  background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
  border-radius: 18px; display: flex; align-items: center; justify-content: center;
}
</style>
