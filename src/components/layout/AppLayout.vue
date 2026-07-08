<template>
  <div :class="['app-layout', roleThemeClass]">

    <!-- Mobile overlay -->
    <transition name="fade">
      <div v-if="mobileOpen" class="mobile-overlay" @click="mobileOpen = false" />
    </transition>

    <!-- ═══════════════ SIDEBAR ═══════════════ -->
    <aside class="sidebar" :class="{ 'sidebar-open': mobileOpen }">

      <!-- ── Header ── -->
      <div class="sb-header">
        <div class="sb-school">
          <div class="sb-logo">
            <img v-if="schoolStore.settingsObj?.logo_url || schoolStore.schoolInfo?.settings?.logo_url || schoolStore.schoolInfo?.logo_url"
                 :src="schoolStore.settingsObj?.logo_url || schoolStore.schoolInfo?.settings?.logo_url || schoolStore.schoolInfo?.logo_url"
                 class="w-full h-full object-contain rounded-xl" style="background:#fff;padding:2px;border-radius:10px" />
            <span v-else class="text-2xl">🏫</span>
          </div>
          <div class="sb-school-info">
            <div class="sb-app-name">SchoolLOG</div>
            <div class="sb-school-name">{{ schoolStore.schoolName || 'โรงเรียน' }}</div>
            <div class="sb-term">{{ currentTermLabel }}</div>
          </div>
        </div>
        <button class="sb-close" @click="mobileOpen = false">✕</button>
      </div>

      <!-- ── User chip ── -->
      <div class="sb-user-chip">
        <div class="sb-avatar">
          <img v-if="authStore.profile?.photo_url" :src="authStore.profile.photo_url" class="sb-avatar-img" @error="e => e.target.style.display='none'" />
          <span v-else>{{ authStore.profile?.displayName?.charAt(0) || '?' }}</span>
        </div>
        <div class="sb-user-info">
          <div class="sb-user-name">{{ authStore.profile?.displayName || 'ผู้ใช้' }}</div>
          <div class="sb-user-role">{{ roleLabel }}</div>
        </div>
      </div>

      <!-- ── Navigation ── -->
      <nav class="sb-nav">

        <!-- standalone dashboard -->
        <router-link to="/dashboard" class="sb-standalone" @click="mobileOpen = false">
          <span class="sb-si" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">🏠</span>
          <div class="sb-si-text">
            <span class="sb-si-label">แดชบอร์ด</span>
            <span class="sb-si-sub">ภาพรวมระบบ</span>
          </div>
          <span class="sb-arrow">›</span>
        </router-link>

        <!-- ── Groups ── -->
        <template v-for="group in visibleGroups" :key="group.key">
          <button class="sb-group-btn" :class="{ 'sb-group-open': openGroup === group.key }"
            @click="toggleGroup(group.key)">
            <span class="sb-gi" :style="{ background: group.grad }">{{ group.icon }}</span>
            <span class="sb-gl">{{ group.label }}</span>
            <span v-if="group.key === 'schedule' && schoolStore.isTimetableLocked"
              class="sb-lock-badge">🔒</span>
            <span class="sb-chevron" :class="{ 'sb-chevron-open': openGroup === group.key }">›</span>
          </button>

          <transition name="slide-down">
            <div v-if="openGroup === group.key" class="sb-group-items">
              <template v-for="(item, idx) in group.items" :key="item.to || `${group.key}-section-${idx}`">
                <div v-if="item.type === 'section'" class="sb-subsection" :style="item.badgeStyle || ''">
                  <span class="sb-sec-icon">{{ item.icon || '🧩' }}</span>
                  <span class="sb-sec-label">{{ item.label }}</span>
                </div>
                <router-link v-else v-show="itemVisible(item)"
                  :to="item.to" class="sb-item" @click="mobileOpen = false">
                  <span class="sb-ii" :style="{ background: item.bg }">{{ item.icon }}</span>
                  <div class="sb-it">
                    <span class="sb-it-label">{{ item.label }}</span>
                    <span v-if="item.sub" class="sb-it-sub">{{ item.sub }}</span>
                  </div>
                  <span v-if="item.to === '/teacher/teaching-log' && subCount > 0"
                    class="sb-sub-badge">{{ subCount }}</span>
                  <span v-else class="sb-ia">›</span>
                </router-link>
              </template>
            </div>
          </transition>
        </template>

      </nav>

      <!-- ── Term Selector (admin only) ── -->
      <div v-if="authStore.isAdmin && availableTerms.length > 1" class="sb-term-selector">
        <div class="sb-term-label">📅 ดูข้อมูลเทอม</div>
        <div class="sb-term-btns">
          <button v-for="t in availableTerms" :key="t"
            class="sb-term-btn"
            :class="{ active: (schoolStore.viewingTerm || schoolStore.currentTerm) === t,
                      current: t === schoolStore.currentTerm }"
            @click="selectViewingTerm(t)">
            {{ t }}
            <span v-if="t === schoolStore.currentTerm" class="sb-term-now">ปัจจุบัน</span>
          </button>
        </div>
      </div>

      <!-- ── Footer ── -->
      <div class="sb-footer">
        <router-link to="/profile" class="sb-footer-btn" @click="mobileOpen = false">
          ✏️ แก้ไขข้อมูลส่วนตัว
        </router-link>
        <button class="sb-footer-btn" @click="toggleDark" style="letter-spacing:.5px">
          {{ isDark ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด' }}
        </button>
        <button class="sb-footer-btn sb-logout" @click="handleLogout">
          🚪 ออกจากระบบ
        </button>
      </div>

    </aside>

    <!-- ═══════════════ MAIN ═══════════════ -->
    <div class="main-wrapper">

      <!-- mobile top bar -->
      <div class="mobile-topbar">
        <button class="hamburger" @click="mobileOpen = true">
          <span /><span /><span />
        </button>
        <div class="topbar-title-wrap">
          <span class="topbar-title">{{ schoolStore.schoolName || 'SchoolLOG' }}</span>
          <span class="topbar-sub">{{ currentTermLabel }}</span>
        </div>
        <div class="topbar-avatar">{{ authStore.profile?.displayName?.charAt(0) || '?' }}</div>
      </div>

      <!-- banner เตือนเมื่อดูเทอมย้อนหลัง -->
      <div v-if="schoolStore.isViewingOldTerm" class="viewing-old-term-banner">
        <span>📂 กำลังดูข้อมูลเทอม <strong>{{ schoolStore.viewingTerm }}</strong> (ย้อนหลัง — อ่านอย่างเดียว)</span>
        <button class="back-to-current" @click="schoolStore.clearViewingTerm()">
          กลับเทอมปัจจุบัน {{ schoolStore.currentTerm }} ✕
        </button>
      </div>

      <main class="main-content">
        <slot />
      </main>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useMasterAuth } from '@/composables/useMasterAuth'
import { USER_ROLES as AUTH_ROLES } from '@/supabase/schema'
import { supabase } from '@/supabase/client'
import { useDarkMode } from '@/composables/useDarkMode'
const { isDark, toggle: toggleDark } = useDarkMode()

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const router = useRouter()
const route  = useRoute()
const { logout } = useMasterAuth()

const mobileOpen = ref(false)
const openGroup  = ref('')
const subCount   = ref(0)

async function loadSubCount() {
  const tid = authStore.profile?.teacher_id
  const sid = authStore.schoolId
  if (!tid || !sid) return
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  try {
    const { count } = await supabase
      .from('teach_actuals')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', sid)
      .eq('date', today)
      .eq('actual_teacher_id', tid)
      .eq('is_substitute_mandatory', true)
      .eq('is_filled', false)
    subCount.value = count || 0
  } catch { subCount.value = 0 }
}

const roleThemeClass = computed(() => {
  if (authStore.hasAnyRole(['superadmin', 'school_admin', 'admin'])) return 'theme-admin'
  if (authStore.isSchoolDirector) return 'theme-director'
  return 'theme-teacher'
})

const roleLabels = {
  superadmin: 'Super Admin',
  school_admin: 'ผู้ดูแลโรงเรียน',
  admin: 'ผู้ดูแลระบบ',
  school_scheduler: 'นักวิชาการ',
  scheduler: 'นักวิชาการ',
  school_teacher: 'ครูผู้สอน',
  teacher: 'ครูผู้สอน',
  school_director: 'ผู้บริหาร',
  school_student: 'นักเรียน',
  student: 'นักเรียน'
}
const roleLabel  = computed(() => authStore.roles.map(r => roleLabels[r] || r).join(' · ') || '')
const currentTermLabel = computed(() => schoolStore.termLabel)

// ── Term Selector ────────────────────────────────────────────────────
const availableTerms = ref([])

async function loadAvailableTerms() {
  if (!authStore.isAdmin || !authStore.schoolId) return
  try {
    const { data } = await supabase
      .from('academic_terms')
      .select('term_id')
      .eq('school_id', authStore.schoolId)
      .order('term_id', { ascending: false })
    const fromDB = (data || []).map(r => r.term_id)
    // รวมกับ currentTerm ถ้ายังไม่อยู่ใน list
    const current = schoolStore.currentTerm
    const all = current && !fromDB.includes(current) ? [current, ...fromDB] : fromDB
    availableTerms.value = all
  } catch { /* ignore */ }
}

function selectViewingTerm(termId) {
  if (termId === schoolStore.currentTerm) {
    schoolStore.clearViewingTerm()
  } else {
    schoolStore.setViewingTerm(termId)
  }
}

onMounted(() => { loadAvailableTerms(); loadSubCount() })
watch(() => authStore.schoolId, () => { loadAvailableTerms(); loadSubCount() })

// ── กลุ่มเมนูทั้งหมด ──────────────────────────────────────────────
const allGroups = computed(() => {
  const groups = [
    // SuperAdmin Group - Always visible if isSuperAdmin
    ...(authStore.isSuperAdmin ? [{
      key: 'superadmin', icon: '👑', label: 'SuperAdmin',
      grad: 'linear-gradient(135deg,#5a127f,#7e22ce)',
      roles: [AUTH_ROLES.SUPERADMIN],
      items: [
        { to:'/superadmin/dashboard',     icon:'📊', bg:'#f3e8ff', label:'แดชบอร์ด',
          sub:'ภาพรวมระบบ SaaS' },
        { to:'/superadmin/school-requests',icon:'📝', bg:'#e0e7ff', label:'คำขอสมัครโรงเรียน',
          sub:'อนุมัติ/ปฏิเสธ' },
        { to:'/superadmin/schools',       icon:'🏫', bg:'#dbeafe', label:'จัดการโรงเรียน',
          sub:'เปิด/ระงับใช้งาน' },
        { to:'/superadmin/settings',      icon:'⚙️', bg:'#fee2e2', label:'ตั้งค่าระบบ',
          sub:'API Keys, Uptime' },
      ],
    }] : []), // End SuperAdmin Group

    // Director Group — read-only overview & reports
    ...(authStore.isSchoolDirector && !authStore.isAdmin ? [{
      key: 'director', icon: '👔', label: 'เมนูผู้บริหาร',
      grad: 'linear-gradient(135deg,#052e16,#14532d)',
      roles: ['school_director'],
      items: [
        ...(schoolStore.isTeachingLogEnabled ? [
          { to:'/teacher/missed-records', icon:'⚠️', bg:'#fef3c7', label:'รายวิชาที่ลืมบันทึก',      sub:'ภาพรวมทุกครู + ส่งแจ้งเตือน' },
          { to:'/reports/teaching-log',   icon:'📘', bg:'#dbeafe', label:'รายงานบันทึกสอน',          sub:'คาบที่บันทึก/ยังไม่บันทึก' },
          { to:'/reports/attendance',     icon:'📋', bg:'#cffafe', label:'รายงานการมาเรียน',          sub:'สรุปรายคน กรองห้อง/วิชา' },
          { to:'/admin/attendance-maeso', icon:'🚨', bg:'#fee2e2', label:'รายงานสรุป มส.',            sub:'เวลาเรียนต่ำกว่า 80%' },
          { to:'/reports/parent-letter',  icon:'✉️', bg:'#fef9c3', label:'จดหมายแจ้งผู้ปกครอง',     sub:'พิมพ์ PDF รายห้อง/ทั้งหมด' },
          { to:'/admin/substitute-manage',icon:'🔄', bg:'#ede9fe', label:'ดูการจัดสอนแทน',           sub:'ตารางสอนแทนรายวัน' },
        ] : []),
      ],
    }] : []),

    // Admin (School Admin) Group
    {
      key: 'admin', icon: '⚙️', label: 'ตั้งค่าระบบ',
      grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN],
      items: [
        { to:'/admin/school-settings',   icon:'🏫', bg:'#ede9fe', label:'ข้อมูลโรงเรียน',    sub:'ชื่อ โลโก้ ปีการศึกษา' },
        { to:'/admin/terms',             icon:'📅', bg:'#e0e7ff', label:'จัดการเทอม',         sub:'ภาคเรียน ช่วงเวลา' },
        { to:'/admin/signatures',        icon:'✍️', bg:'#fce7f3', label:'ตั้งค่าลายเซ็น',     sub:'ผู้ลงนาม ภาพลายเซ็น' },
        { to:'/admin/renewal',           icon:'💳', bg:'#fce7f3', label:'ต่ออายุการใช้งาน',   sub:'ส่งหลักฐานชำระเงิน' },
      ],
    },
    // Timetable & Scheduling Group
    {
      key: 'schedule', icon: '📅', label: 'ตารางสอน',
      grad: 'linear-gradient(135deg,#f59e0b,#ef4444)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'],
      items: [
        { type:'section', label:'ข้อมูลพื้นฐาน', icon:'📚', badgeStyle:'background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/admin/teachers',         icon:'👨‍🏫', bg:'#dbeafe', label:'จัดการครู',      sub:'ข้อมูล กลุ่มสาระ บัญชี สิทธิ์', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        { to:'/admin/students',         icon:'🎓',  bg:'#ede9fe', label:'จัดการนักเรียน',   sub:'ข้อมูล ห้องเรียน', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/admin/classes',          icon:'🏫',  bg:'#dcfce7', label:'จัดการห้องเรียน',  sub:'ระดับชั้น ครูที่ปรึกษา', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        { to:'/admin/subjects',         icon:'📚',  bg:'#fef3c7', label:'จัดการวิชา',      sub:'รหัส ชั่วโมง หน่วยกิต', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/admin/rooms',            icon:'🚪',  bg:'#f0fdf4', label:'ห้อง/Lab',         sub:'ห้องเรียน ห้องปฏิบัติการ', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { type:'section', label:'งานตารางสอน', icon:'⚡', badgeStyle:'background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/planning/assignments',    icon:'📋', bg:'#fef9c3', label:'มอบหมายภาระงาน',   sub:'วิชา ครู ห้อง', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/planning/activity-booking',icon:'🎯',bg:'#ffedd5', label:'กิจกรรม/ครูคุม',   sub:'คาบกิจกรรม ครูประจำ', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/planning/timetable',      icon:'📅', bg:'#dbeafe', label:'จัดตารางสอน',      sub:'ลาก-วาง ตรวจสอบ', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/planning/print',          icon:'🖨️', bg:'#e0e7ff', label:'พิมพ์ตารางสอน',    sub:'PDF Excel รายห้อง/ครู', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/my-timetable',    icon:'👤', bg:'#ecfeff', label:'ตารางสอนของฉัน',   sub:'อ่านจากตารางที่เผยแพร่', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/timetable-lookup',icon:'🔍', bg:'#fef9c3', label:'ค้นหาตารางสอน',    sub:'ดูตารางห้อง/ครูอื่น (อ่านอย่างเดียว จากฉบับเผยแพร่)', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
      ],
    },
    // Check-in Group
    {
      key: 'checkin', icon: '📍', label: 'การเช็คอิน',
      grad: 'linear-gradient(135deg,#0891b2,#06b6d4)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN],
      items: [
        { to:'/admin/checkin-settings', icon:'⚙️', bg:'#cffafe', label:'ตั้งค่าการเช็คอิน', sub:'พิกัดโรงเรียน รัศมี คะแนนอัตโนมัติ' },
      ],
    },
    // Announcements — เห็นเฉพาะผู้มีสิทธิ์ (ไม่ขึ้น feature gate)
    ...(authStore.isAnnouncer ? [{
      key: 'announcements', icon: '📣', label: 'ประชาสัมพันธ์',
      grad: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
      roles: ['announcer', AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, 'school_director', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'],
      items: [
        { to:'/teacher/announcements', icon:'📣', bg:'#fef3c7', label:'จัดการประกาศ', sub:'สร้าง แก้ไข ลบ · ส่งถึงครู นักเรียน ผู้ปกครอง' },
      ],
    }] : []),

    // Teaching log module (SuperAdmin feature-gated)
    ...(schoolStore.isTeachingLogEnabled ? [{
      key: 'teaching-log', icon: '🧾', label: 'บันทึกเข้าสอน',
      grad: 'linear-gradient(135deg,#0284c7,#0ea5e9)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'],
      items: [
        ...(authStore.hasAnyRole([AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN]) ? [
          { type:'section', label:'ตั้งค่าโดยผู้ดูแล', icon:'⚙️', badgeStyle:'background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;' },
          { to:'/admin/attendance-status', icon:'✅', bg:'#ecfccb', label:'ตั้งค่าการมาเรียน', sub:'สถานะมาเรียนและคะแนนแนะนำ', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
          { to:'/admin/behavior-settings', icon:'📚', bg:'#fef3c7', label:'ตั้งค่าพฤติกรรมการเรียน', sub:'การเรียนและพฤติกรรมทั่วไป', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
          { to:'/admin/teaching-log-settings', icon:'🧾', bg:'#e0f2fe', label:'ตั้งค่าบันทึกเข้าสอน', sub:'Google Drive วันหยุด บันทึกล่วงหน้า', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
          { to:'/admin/teach-actuals', icon:'🗑️', bg:'#fee2e2', label:'จัดการบันทึกเข้าสอน', sub:'ตรวจสอบ ลบข้อมูล', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
          { to:'/admin/import-teach-actuals', icon:'📥', bg:'#e0f2fe', label:'นำเข้าข้อมูล (จากระบบเดิม)', sub:'อัพโหลด Excel 2 Sheet → import', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
          { to:'/admin/generate-teach-actuals', icon:'🔧', bg:'#fef3c7', label:'สร้างคาบที่หาย', sub:'สแกนและสร้าง teach_actuals ที่ยังไม่มีใน DB', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
          { to:'/admin/makeup-days', icon:'📆', bg:'#dbeafe', label:'วันเรียนชดเชย', sub:'กำหนดวันชดเชย · ใช้ตารางวันอื่น · สร้างคาบอัตโนมัติ', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
          { to:'/admin/notification-settings', icon:'📩', bg:'#ede9fe', label:'ตั้งค่าจดหมายแจ้งผู้ปกครอง', sub:'เกณฑ์กลุ่มเสี่ยง ข้อความ นัดหมาย', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        ] : []),
        { type:'section', label:'ทำรายการบันทึกการสอน', icon:'📝', badgeStyle:'background:linear-gradient(90deg,#059669,#10b981);' },
        { to:'/teacher/teaching-log', icon:'📝', bg:'#e0f2fe', label:'บันทึกเข้าสอน (รวมเช็คชื่อ)', sub:'เลือกวัน บันทึกสอนและเช็คชื่อ', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/leave-requests', icon:'🗓️', bg:'#fef3c7', label:'ยื่นคำขอลา', sub:'แจ้งลาและดูสถานะจัดสอนแทน', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'sub_coordinator'] },
        { to:'/admin/substitute-manage', icon:'🔄', bg:'#ede9fe', label:'จัดสอนแทน', sub:'มอบหมายครูสอนแทน (หัวหน้ากลุ่มสาระ/ผู้ดูแล)', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, 'sub_coordinator', 'subject_head'] },
        { to:'/teacher/missed-records', icon:'⚠️', bg:'#fef3c7', label:'รายวิชาที่ลืมบันทึก', sub:'คาบค้างบันทึกในช่วงย้อนหลัง', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/daily-attendance', icon:'📋', bg:'#f0fdf4', label:'เช็คชื่อรายวัน / สรุปส่ง ผปค.', sub:'ครูประจำชั้น · บันทึกรายวัน · แจ้งผู้ปกครอง', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/homeroom-dashboard', icon:'🏫', bg:'#e0f2fe', label:'Dashboard ห้องประจำชั้น', sub:'สรุปการมาเรียน · เฝ้าระวัง · คัดกรองอัตโนมัติ', roles:[AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/score-entry', icon:'🔢', bg:'#f0fdf4', label:'บันทึกคะแนนเก็บ', sub:'กรอกคะแนนรายหน่วย · Paste จาก Excel', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        ...(schoolStore.isClubModuleEnabled ? [
          { to:'/teacher/club-open', icon:'🎯', bg:'#ffedd5', label:'เปิดชุมนุม', sub:'ครูเปิดชุมนุมปกติและพิเศษ', roles:[AUTH_ROLES.SCHOOL_TEACHER, 'teacher', AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        ] : []),
        { type:'section', label:'รายงานการสอน', icon:'📊', badgeStyle:'background:linear-gradient(135deg,#0284c7,#0891b2);color:#fff;' },
        { to:'/reports/teaching-log', icon:'📘', bg:'#dbeafe', label:'รายงานบันทึกสอน', sub:'คาบที่บันทึก/ยังไม่บันทึก', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/reports/attendance', icon:'📋', bg:'#cffafe', label:'รายงานการมาเรียน (รายวิชา)', sub:'สรุปรายคน กรองห้อง/วิชา', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/admin/attendance-maeso', icon:'🚨', bg:'#fee2e2', label:'รายงานสรุป มส.', sub:'นักเรียนเวลาเรียนต่ำกว่า 80% · PDF รายห้อง/ทั้งหมด', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/reports/parent-letter', icon:'✉️', bg:'#fef9c3', label:'จดหมายแจ้งคะแนนและเวลาเรียน', sub:'พิมพ์ PDF · ส่ง LINE รายคน', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
      ],
    }] : []),
    // Exam module — separate from teaching log
    ...(schoolStore.isTeachingLogEnabled ? [{
      key: 'exam', icon: '📋', label: 'ระบบสอบ',
      grad: 'linear-gradient(135deg,#7c3aed,#a855f7)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'],
      items: [
        { to:'/admin/exam-overview',   icon:'📊', bg:'#ede9fe', label:'ภาพรวมข้อสอบ',            sub:'ทุกวิชา · ทุกครู · ติดตามปลายภาค', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        { to:'/admin/exam-checklist',  icon:'✅', bg:'#dcfce7', label:'ตรวจสอบการออกข้อสอบ',     sub:'ภาระงาน vs ข้อสอบ · ดูรายวิชา · ห้อง', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        { to:'/admin/exam-anticheat',  icon:'🛡️', bg:'#fee2e2', label:'ตั้งค่าตรวจจับทุจริต',  sub:'ความไวในการตรวจจับ · อนุโลมกลับเข้า', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        { to:'/teacher/exams',   icon:'📋', bg:'#ede9fe', label:'ออกข้อสอบ',  sub:'สร้างข้อสอบ · ออกข้อสอบ · รายวิชา', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/proctor', icon:'👁',  bg:'#dbeafe', label:'คุมสอบในตาราง', sub:'คุมสอบตามตาราง · เลือกห้อง · อนุมัติ', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
      ],
    }] : []),
    // Student Affairs Group
    ...(schoolStore.isTeachingLogEnabled ? [{
      key: 'student-affairs', icon: '🎓', label: 'ฝ่ายกิจการนักเรียน',
      grad: 'linear-gradient(135deg,#b45309,#d97706)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'student_affairs'],
      items: [
        { type:'section', label:'บันทึกกิจการนักเรียน', icon:'📝', badgeStyle:'background:linear-gradient(135deg,#b45309,#d97706);color:#fff;' },
        { to:'/teacher/behavior-entry', icon:'😊', bg:'#fdf4ff', label:'บันทึกพฤติกรรม', sub:'เลือกนักเรียน · แนบรูปภาพประกอบ', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'student_affairs'], featureGate: 'behavior_system_enabled' },
        { to:'/admin/hair-inspection', icon:'💇', bg:'#ccfbf1', label:'บันทึกการตรวจทรงผม', sub:'ผ่าน / ไม่ผ่าน / ตรวจซ้ำ · แนบรูปถ่าย', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'student_affairs'] },
        { to:'/admin/probation', icon:'⚠️', bg:'#fee2e2', label:'บันทึกทัณฑ์บน', sub:'กรณีความผิดร้ายแรง · ชดเชยคะแนนไม่ได้', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'student_affairs'] },
        { type:'section', label:'รายงานฝ่ายกิจการ', icon:'📊', badgeStyle:'background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;' },
        { to:'/reports/behavior', icon:'📈', bg:'#fae8ff', label:'รายงานพฤติกรรม', sub:'คะแนนสะสมและเหตุการณ์', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'student_affairs'], featureGate: 'behavior_system_enabled' },
        { to:'/teacher/homeroom-dashboard', icon:'📸', bg:'#e0f2fe', label:'รายงานเช็คอิน', sub:'สรุปการมาเรียน · เช็คอินรายห้อง', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'student_affairs'] },
      ],
    }] : []),

    // Student support system
    {
      key: 'student-support', icon: '🤝', label: 'ระบบดูแลช่วยเหลือนักเรียน',
      grad: 'linear-gradient(135deg,#065f46,#059669)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'],
      items: [
        { to:'/teacher/home-visits', icon:'🏠', bg:'#d1fae5', label:'เยี่ยมบ้านนักเรียน', sub:'ดูพิกัดบ้าน · นำทาง · บันทึกการเยี่ยม', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
      ],
    },
  ];

  return groups;
})

// filter ตาม role
const visibleGroups = computed(() => allGroups.value.filter(g => {
  if (!g.roles || g.roles.length === 0) return true;
  // ต้องใช้ hasAnyRole เพื่อรองรับทั้ง role เก่าและใหม่ (admin/school_admin)
  if (!authStore.hasAnyRole(g.roles)) return false;
  // school_admin และ superadmin เห็นได้ทุก group แม้ subscription หมดอายุ
  if (!schoolStore.isViewOnlyMode || authStore.isAdmin) return true;
  return g.items.some(i => isAllowedWhenViewOnly(i));
}))

function isAllowedWhenViewOnly(item) {
  if (!item.to) return true;
  return item.to === '/planning/print' || item.to === '/teacher/my-timetable' || item.to === '/admin/school-settings' || item.to === '/admin/renewal';
}

function isDeniedByTimetableLock(item) {
  if (!item.to) return false;
  return ['/planning/assignments', '/planning/activity-booking', '/planning/timetable', '/reports/assignments'].includes(item.to);
}

function isSchedulerRole() {
  return authStore.hasAnyRole([AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'])
    && !authStore.hasAnyRole([AUTH_ROLES.SCHOOL_TEACHER, 'teacher']);
}

function itemVisible(item) {
  if (!item) return false;
  // school_admin และ superadmin เห็นได้ทุก item แม้ subscription หมดอายุ
  if (schoolStore.isViewOnlyMode && !authStore.isAdmin && !isAllowedWhenViewOnly(item)) {
    return false;
  }
  if (schoolStore.isTimetableLocked && !authStore.isAdmin && isDeniedByTimetableLock(item)) {
    return false;
  }
  if (item.featureGate) {
    if (item.featureGate === 'behavior_system_enabled' && !schoolStore.isBehaviorSystemEnabled) {
      return false;
    }
  }
  if (item.roles) return authStore.hasAnyRole(item.roles);
  if (item.adminOnly) return authStore.hasAnyRole([AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN]);
  return true;
}

// auto-open group ที่มี route ปัจจุบัน
function findGroupByRoute(path) {
  return visibleGroups.value.find(g => g.items.some(i => i?.to && path.startsWith(i.to)))?.key || ''
}
openGroup.value = findGroupByRoute(route.path)
watch(() => route.path, (p) => {
  const gk = findGroupByRoute(p)
  if (gk) openGroup.value = gk
})

function toggleGroup(key) {
  openGroup.value = openGroup.value === key ? '' : key
}

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>

<style scoped>
/* ── Layout shell ─────────────────────────────────────────────────── */
.app-layout {
  display: flex;
  height: 100dvh;
  background: #f1f5f9;
  overflow: hidden;
}

/* ── Sidebar ──────────────────────────────────────────────────────── */
.sidebar {
  width: 272px;
  min-width: 272px;
  background: white;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e2e8f0;
  box-shadow: 4px 0 24px rgba(0,0,0,0.06);
  z-index: 200;
  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
  overflow: hidden;
}

/* ── Sidebar header ───────────────────────────────────────────────── */
.sb-header {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #db2777 100%);
  padding: 18px 16px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.sb-school { display: flex; align-items: center; gap: 10px; }
.sb-logo {
  width: 44px; height: 44px;
  background: rgba(255,255,255,0.2);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
}
.sb-app-name  { font-size: 14px; font-weight: 800; color: white; }
.sb-school-name { font-size: 11px; color: rgba(255,255,255,0.75); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-term { font-size: 10px; color: rgba(255,255,255,0.85); margin-top: 2px; font-weight: 600; }
.sb-close { display: none; background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 13px; }

/* ── User chip ────────────────────────────────────────────────────── */
.sb-user-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px 8px;
  background: #fafafa;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}
.sb-avatar {
  width: 34px; height: 34px;
  background: linear-gradient(135deg,#4f46e5,#7c3aed);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; font-size: 14px; flex-shrink: 0;
  overflow: hidden;
}
.sb-avatar-img {
  width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
}
.topbar-title-wrap { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
.topbar-sub { font-size: 11px; color: #64748b; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.sb-user-name { font-size: 13px; font-weight: 600; color: #1e293b; }
.sb-user-role { font-size: 11px; color: #64748b; }

/* ── Nav ──────────────────────────────────────────────────────────── */
.sb-nav { flex: 1; overflow-y: auto; padding: 10px 10px 4px; }
.sb-nav::-webkit-scrollbar { width: 3px; }
.sb-nav::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

/* standalone item (dashboard) */
.sb-standalone {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 12px;
  text-decoration: none; margin-bottom: 4px;
  transition: background 0.15s; color: #1e293b;
  border: 1.5px solid #e2e8f0;
}
.sb-standalone:hover { background: #f8fafc; }
.sb-standalone.router-link-active {
  background: linear-gradient(135deg,#ede9fe,#e0e7ff);
  border-color: #a5b4fc;
}

/* group button */
.sb-group-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 9px 12px; border-radius: 12px;
  border: none; background: transparent; cursor: pointer;
  text-align: left; margin-bottom: 2px;
  transition: background 0.15s;
  color: #334155;
}

.sb-subsection {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  margin: 10px -8px 5px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  color: white;
  letter-spacing: 0.3px;
  text-transform: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.sb-sec-icon  { font-size: 13px; flex-shrink: 0; }
.sb-sec-label { flex: 1; }
.sb-group-btn:hover { background: #f8fafc; }
.sb-group-open { background: #f8fafc; }

/* group icon */
.sb-gi {
  width: 32px; height: 32px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.sb-si {
  width: 36px; height: 36px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.sb-gl { font-size: 13px; font-weight: 700; flex: 1; color: #1e293b; }
.sb-lock-badge { font-size: 10px; background: #fee2e2; color: #b91c1c; border-radius: 99px; padding: 1px 6px; margin-right: 2px; flex-shrink: 0; }
.sb-si-text { flex: 1; }
.sb-si-label { display: block; font-size: 13px; font-weight: 700; color: #1e293b; }
.sb-si-sub   { display: block; font-size: 10px; color: #94a3b8; }

/* chevron */
.sb-chevron {
  font-size: 16px; color: #94a3b8; font-weight: 700;
  transition: transform 0.2s; display: inline-block;
  line-height: 1; flex-shrink: 0;
}
.sb-chevron-open { transform: rotate(90deg); color: #6366f1; }
.sb-arrow { font-size: 16px; color: #94a3b8; font-weight: 700; line-height: 1; flex-shrink: 0; }

/* group items container */
.sb-group-items {
  padding: 2px 0 4px 8px;
  border-left: 2px solid #e2e8f0;
  margin-left: 15px; margin-bottom: 4px;
}

/* nav item */
.sb-item {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 10px; border-radius: 10px;
  text-decoration: none; color: #334155;
  transition: background 0.12s; margin-bottom: 2px;
}
.sb-item:hover { background: #f8fafc; }
.sb-item.router-link-active {
  background: #ede9fe; color: #4f46e5;
  border-left: 3px solid #6366f1;
}

.sb-ii {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
}
.sb-it { flex: 1; min-width: 0; }
.sb-it-label { display: block; font-size: 12px; font-weight: 600; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-it-sub   { display: block; font-size: 10px; color: #94a3b8; }
.sb-ia { font-size: 13px; color: #cbd5e1; flex-shrink: 0; }
.sb-sub-badge {
  flex-shrink: 0;
  min-width: 20px; height: 20px;
  border-radius: 10px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  padding: 0 5px;
  animation: pulse-badge 1.5s infinite;
}
@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.65; }
}

/* ── Footer ──────────────────────────────────────────────────────── */
.sb-footer {
  padding: 10px; border-top: 1px solid #f1f5f9;
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.sb-footer-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 10px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  border: 1.5px solid #e2e8f0; background: white; color: #475569;
  text-decoration: none; transition: background 0.15s;
}
.sb-footer-btn:hover { background: #f8fafc; }
.sb-logout { color: #dc2626; border-color: #fecaca; }
.sb-logout:hover { background: #fff1f2; }

/* ── Main ─────────────────────────────────────────────────────────── */
.main-wrapper {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0;
}
.mobile-topbar { display: none; }
.main-content  { flex: 1; overflow-y: auto; }

/* ── Animations ───────────────────────────────────────────────────── */
.mobile-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 199; backdrop-filter: blur(2px);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }

.slide-down-enter-active { transition: all 0.22s ease; }
.slide-down-leave-active { transition: all 0.18s ease; }
.slide-down-enter-from   { opacity: 0; transform: translateY(-8px); }
.slide-down-leave-to     { opacity: 0; transform: translateY(-4px); }

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed; top: 0; left: 0; height: 100dvh;
    transform: translateX(-100%);
  }
  .sidebar-open {
    transform: translateX(0);
    box-shadow: 8px 0 40px rgba(0,0,0,0.18);
  }
  .sb-close { display: flex; align-items: center; justify-content: center; }
  .mobile-topbar {
    display: flex; align-items: center; gap: 12px;
    padding: 0 16px; height: 56px; flex-shrink: 0;
    background: white; border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 6px rgba(0,0,0,0.06); z-index: 10;
  }
  .topbar-title { flex: 1; font-size: 16px; font-weight: 800; color: #4f46e5; }
  .topbar-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg,#4f46e5,#7c3aed);
    color: white; font-weight: 700; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .hamburger {
    display: flex; flex-direction: column; gap: 5px;
    background: none; border: none; cursor: pointer; padding: 4px;
  }
  .hamburger span {
    width: 22px; height: 2.5px; background: #4f46e5; border-radius: 2px; display: block;
  }
}
@media (min-width: 1024px) {
  .mobile-overlay { display: none !important; }
}

/* ── Term Selector ───────────────────────────────────────────────── */
.sb-term-selector {
  padding: 8px 10px 6px; border-top: 1px solid #f1f5f9; flex-shrink: 0;
}
.sb-term-label {
  font-size: 10px; font-weight: 700; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;
}
.sb-term-btns {
  display: flex; flex-wrap: wrap; gap: 4px;
}
.sb-term-btn {
  padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600;
  border: 1.5px solid #e2e8f0; background: white; color: #64748b; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 4px;
}
.sb-term-btn:hover { border-color: #6366f1; color: #6366f1; }
.sb-term-btn.active { background: #6366f1; color: white; border-color: #6366f1; }
.sb-term-now {
  font-size: 9px; background: rgba(255,255,255,0.3);
  border-radius: 99px; padding: 1px 5px;
}
.sb-term-btn:not(.active) .sb-term-now {
  background: #dcfce7; color: #16a34a;
}

/* ── Viewing Old Term Banner ─────────────────────────────────────── */
.viewing-old-term-banner {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  padding: 8px 16px; background: #fef9c3; border-bottom: 2px solid #fbbf24;
  font-size: 13px; color: #78350f; flex-shrink: 0;
}
.back-to-current {
  padding: 4px 12px; border-radius: 99px; border: 1.5px solid #f59e0b;
  background: white; color: #b45309; font-size: 12px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
}
.back-to-current:hover { background: #fef3c7; }

/* topbar sub-label */
.topbar-title-wrap { flex: 1; display: flex; flex-direction: column; }
.topbar-sub { font-size: 10px; color: #94a3b8; }

/* main content responsive padding */
@media (max-width: 640px) {
  :deep(.print-page),
  :deep(.page-content),
  :deep([class*="-page"]) {
    padding: 12px !important;
  }
}

/* ═══════════════════════════════════════════════════════════════
   🎨 ADMIN THEME — Dark sidebar, gold accent
   ═══════════════════════════════════════════════════════════════ */
.theme-admin { background: #f1f5f9; }
.theme-admin .sidebar {
  background: #0f172a;
  border-right-color: rgba(255,255,255,0.06);
}
.theme-admin .sb-header {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e3a5f 100%);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.theme-admin .sb-user-chip {
  background: rgba(255,255,255,0.04);
  border-bottom-color: rgba(255,255,255,0.07);
}
.theme-admin .sb-user-name { color: #f1f5f9; }
.theme-admin .sb-user-role { color: #64748b; }
.theme-admin .sb-avatar    { background: linear-gradient(135deg,#fbbf24,#f59e0b); color: #0f172a; }
.theme-admin .sb-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
.theme-admin .sb-standalone {
  border-color: rgba(255,255,255,0.1);
  color: #cbd5e1;
}
.theme-admin .sb-standalone:hover { background: rgba(255,255,255,0.06); }
.theme-admin .sb-standalone.router-link-active {
  background: rgba(251,191,36,0.14);
  border-color: rgba(251,191,36,0.5);
  color: #fbbf24;
}
.theme-admin .sb-group-btn  { color: #94a3b8; }
.theme-admin .sb-group-btn:hover { background: rgba(255,255,255,0.06); }
.theme-admin .sb-group-open { background: rgba(255,255,255,0.05); }
.theme-admin .sb-gl         { color: #e2e8f0; }
.theme-admin .sb-chevron    { color: rgba(255,255,255,0.25); }
.theme-admin .sb-chevron-open { color: #fbbf24; }
.theme-admin .sb-arrow      { color: rgba(255,255,255,0.25); }
.theme-admin .sb-group-items { border-left-color: rgba(255,255,255,0.1); }
.theme-admin .sb-item       { color: #94a3b8; }
.theme-admin .sb-item:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
.theme-admin .sb-item.router-link-active {
  background: rgba(251,191,36,0.14);
  color: #fbbf24;
  border-left-color: #fbbf24;
}
.theme-admin .sb-it-label   { color: inherit; }
.theme-admin .sb-it-sub     { color: #475569; }
.theme-admin .sb-ia         { color: rgba(255,255,255,0.15); }
.theme-admin .sb-si-label   { color: #e2e8f0; }
.theme-admin .sb-si-sub     { color: #475569; }
.theme-admin .sb-footer     { border-top-color: rgba(255,255,255,0.07); }
.theme-admin .sb-footer-btn { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: #64748b; }
.theme-admin .sb-footer-btn:hover { background: rgba(255,255,255,0.09); color: #94a3b8; }
.theme-admin .sb-logout     { color: #f87171; border-color: rgba(248,113,113,0.25); }
.theme-admin .sb-logout:hover { background: rgba(248,113,113,0.1); }
.theme-admin .sb-term-selector { border-top-color: rgba(255,255,255,0.07); }
.theme-admin .sb-term-label { color: #475569; }
.theme-admin .sb-term-btn   { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: #64748b; }
.theme-admin .sb-term-btn:hover { border-color: #fbbf24; color: #fbbf24; }
.theme-admin .sb-term-btn.active { background: #fbbf24; color: #0f172a; border-color: #fbbf24; }
@media (max-width: 1023px) {
  .theme-admin .mobile-topbar  { background: #0f172a; border-bottom-color: rgba(255,255,255,0.08); }
  .theme-admin .topbar-title   { color: #fbbf24; }
  .theme-admin .topbar-sub     { color: #475569; }
  .theme-admin .topbar-avatar  { background: linear-gradient(135deg,#fbbf24,#f59e0b); color: #0f172a; }
  .theme-admin .hamburger span { background: #fbbf24; }
}

/* ═══════════════════════════════════════════════════════════════
   🎨 TEACHER THEME — Teal sidebar header, green accent
   ═══════════════════════════════════════════════════════════════ */
.theme-teacher { background: #f0fdf9; }
.theme-teacher .sidebar { background: #fff; }
.theme-teacher .sb-header {
  background: linear-gradient(135deg, #0f766e 0%, #0369a1 100%);
}
.theme-teacher .sb-avatar { background: linear-gradient(135deg,#0f766e,#0369a1); }
.theme-teacher .sb-standalone.router-link-active {
  background: linear-gradient(135deg,#f0fdf4,#e0f2fe);
  border-color: #5eead4;
  color: #0f766e;
}
.theme-teacher .sb-chevron-open { color: #0f766e; }
.theme-teacher .sb-item.router-link-active {
  background: #e0f2fe;
  color: #0e7490;
  border-left-color: #0f766e;
}
.theme-teacher .sb-term-btn:hover { border-color: #0f766e; color: #0f766e; }
.theme-teacher .sb-term-btn.active { background: #0f766e; border-color: #0f766e; color: white; }
.theme-teacher .main-wrapper { background: #f0fdf9; }
@media (max-width: 1023px) {
  .theme-teacher .mobile-topbar  { background: linear-gradient(135deg,#0f766e,#0369a1); border-bottom-color: transparent; }
  .theme-teacher .topbar-title   { color: white; }
  .theme-teacher .topbar-sub     { color: rgba(255,255,255,0.7); }
  .theme-teacher .topbar-avatar  { background: rgba(255,255,255,0.25); color: white; }
  .theme-teacher .hamburger span { background: white; }
}

/* ═══════════════════════════════════════════════════════════════
   🎨 DIRECTOR THEME — Dark forest green sidebar, emerald accent
   ═══════════════════════════════════════════════════════════════ */
.theme-director { background: #f0fdf4; }
.theme-director .sidebar {
  background: #052e16;
  border-right-color: rgba(255,255,255,0.06);
}
.theme-director .sb-header {
  background: linear-gradient(135deg, #14532d 0%, #065f46 60%, #064e3b 100%);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.theme-director .sb-user-chip {
  background: rgba(255,255,255,0.04);
  border-bottom-color: rgba(255,255,255,0.07);
}
.theme-director .sb-user-name { color: #f1f5f9; }
.theme-director .sb-user-role { color: #4ade80; }
.theme-director .sb-avatar    { background: linear-gradient(135deg,#34d399,#10b981); color: #052e16; }
.theme-director .sb-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
.theme-director .sb-standalone {
  border-color: rgba(255,255,255,0.1);
  color: #a7f3d0;
}
.theme-director .sb-standalone:hover { background: rgba(255,255,255,0.06); }
.theme-director .sb-standalone.router-link-active {
  background: rgba(52,211,153,0.16);
  border-color: rgba(52,211,153,0.5);
  color: #34d399;
}
.theme-director .sb-group-btn  { color: #86efac; }
.theme-director .sb-group-btn:hover { background: rgba(255,255,255,0.06); }
.theme-director .sb-group-open { background: rgba(255,255,255,0.05); }
.theme-director .sb-gl         { color: #d1fae5; }
.theme-director .sb-chevron    { color: rgba(255,255,255,0.25); }
.theme-director .sb-chevron-open { color: #34d399; }
.theme-director .sb-arrow      { color: rgba(255,255,255,0.25); }
.theme-director .sb-group-items { border-left-color: rgba(255,255,255,0.1); }
.theme-director .sb-item       { color: #86efac; }
.theme-director .sb-item:hover { background: rgba(255,255,255,0.06); color: #d1fae5; }
.theme-director .sb-item.router-link-active {
  background: rgba(52,211,153,0.16);
  color: #34d399;
  border-left-color: #34d399;
}
.theme-director .sb-it-label   { color: inherit; }
.theme-director .sb-it-sub     { color: #166534; }
.theme-director .sb-ia         { color: rgba(255,255,255,0.15); }
.theme-director .sb-footer     { border-top-color: rgba(255,255,255,0.07); }
.theme-director .sb-footer-btn { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: #64748b; }
.theme-director .sb-footer-btn:hover { background: rgba(255,255,255,0.09); color: #86efac; }
.theme-director .sb-logout     { color: #f87171; border-color: rgba(248,113,113,0.25); }
.theme-director .sb-logout:hover { background: rgba(248,113,113,0.1); }
@media (max-width: 1023px) {
  .theme-director .mobile-topbar  { background: linear-gradient(135deg,#14532d,#065f46); border-bottom-color: transparent; }
  .theme-director .topbar-title   { color: #34d399; }
  .theme-director .topbar-sub     { color: rgba(255,255,255,0.6); }
  .theme-director .topbar-avatar  { background: linear-gradient(135deg,#34d399,#10b981); color: #052e16; }
  .theme-director .hamburger span { background: #34d399; }
}
</style>
