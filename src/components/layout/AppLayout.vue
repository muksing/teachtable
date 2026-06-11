<template>
  <div class="app-layout">

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
            <img v-if="schoolStore.schoolInfo?.logo_url" :src="schoolStore.schoolInfo.logo_url" class="w-full h-full object-cover rounded-xl" />
            <span v-else class="text-2xl">🏫</span>
          </div>
          <div class="sb-school-info">
            <div class="sb-app-name">TeachTable</div>
            <div class="sb-school-name">{{ schoolStore.schoolName || 'โรงเรียน' }}</div>
            <div class="sb-term">{{ currentTermLabel }}</div>
          </div>
        </div>
        <button class="sb-close" @click="mobileOpen = false">✕</button>
      </div>

      <!-- ── User chip ── -->
      <div class="sb-user-chip">
        <div class="sb-avatar">{{ authStore.profile?.displayName?.charAt(0) || '?' }}</div>
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
                  <span class="sb-ia">›</span>
                </router-link>
              </template>
            </div>
          </transition>
        </template>

      </nav>

      <!-- ── Footer ── -->
      <div class="sb-footer">
        <router-link to="/profile" class="sb-footer-btn" @click="mobileOpen = false">
          ✏️ แก้ไขข้อมูลส่วนตัว
        </router-link>
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
          <span class="topbar-title">{{ schoolStore.schoolName || 'TeachTable' }}</span>
          <span class="topbar-sub">{{ currentTermLabel }}</span>
        </div>
        <div class="topbar-avatar">{{ authStore.profile?.displayName?.charAt(0) || '?' }}</div>
      </div>

      <main class="main-content">
        <slot />
      </main>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useMasterAuth } from '@/composables/useMasterAuth'
import { USER_ROLES as AUTH_ROLES } from '@/supabase/schema'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const router = useRouter()
const route  = useRoute()
const { logout } = useMasterAuth()

const mobileOpen = ref(false)
const openGroup  = ref('')

const roleLabels = {
  superadmin: 'Super Admin',
  school_admin: 'ผู้ดูแลโรงเรียน',
  admin: 'ผู้ดูแลระบบ',
  school_scheduler: 'นักวิชาการ',
  scheduler: 'นักวิชาการ',
  school_teacher: 'ครูผู้สอน',
  teacher: 'ครูผู้สอน',
  school_student: 'นักเรียน',
  student: 'นักเรียน'
}
const roleLabel  = computed(() => authStore.roles.map(r => roleLabels[r] || r).join(' · ') || '')
const currentTermLabel = computed(() => schoolStore.termLabel)

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

    // Admin (School Admin) Group
    {
      key: 'admin', icon: '⚙️', label: 'ตั้งค่าระบบ',
      grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN],
      items: [
        { to:'/admin/school-settings',   icon:'🏫', bg:'#ede9fe', label:'ข้อมูลโรงเรียน',    sub:'ชื่อ โลโก้ ปีการศึกษา' },
        { to:'/admin/terms',             icon:'📅', bg:'#e0e7ff', label:'จัดการเทอม',         sub:'ภาคเรียน ช่วงเวลา' },
        { to:'/admin/users',             icon:'👤', bg:'#dbeafe', label:'จัดการสิทธิ์ผู้ใช้',  sub:'บัญชีครู บุคลากร สิทธิ์' },
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
        { to:'/admin/teachers',         icon:'👨‍🏫', bg:'#dbeafe', label:'จัดการครู',      sub:'ข้อมูล กลุ่มสาระ', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        { to:'/admin/students',         icon:'🎓',  bg:'#ede9fe', label:'จัดการนักเรียน',   sub:'ข้อมูล ห้องเรียน', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/admin/classes',          icon:'🏫',  bg:'#dcfce7', label:'จัดการห้องเรียน',  sub:'ระดับชั้น ครูที่ปรึกษา', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        { to:'/admin/subjects',         icon:'📚',  bg:'#fef3c7', label:'จัดการวิชา',      sub:'รหัส ชั่วโมง หน่วยกิต', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/admin/rooms',            icon:'🚪',  bg:'#f0fdf4', label:'ห้อง/Lab',         sub:'ห้องเรียน ห้องปฏิบัติการ', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { type:'section', label:'งานตารางสอน', icon:'⚡', badgeStyle:'background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/planning/assignments',    icon:'📋', bg:'#fef9c3', label:'มอบหมายภาระงาน',   sub:'วิชา ครู ห้อง', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/planning/activity-booking',icon:'🎯',bg:'#ffedd5', label:'กิจกรรม/ครูคุม',   sub:'คาบกิจกรรม ครูประจำ', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/reports/assignments',     icon:'📊', bg:'#fce7f3', label:'รายงานภาระงาน',    sub:'สรุปชั่วโมง ครู', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/planning/timetable',      icon:'📅', bg:'#dbeafe', label:'จัดตารางสอน',      sub:'ลาก-วาง ตรวจสอบ', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/planning/print',          icon:'🖨️', bg:'#e0e7ff', label:'พิมพ์ตารางสอน',    sub:'PDF Excel รายห้อง/ครู', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
        { to:'/teacher/my-timetable',    icon:'👤', bg:'#ecfeff', label:'ตารางสอนของฉัน',   sub:'อ่านจากตารางที่เผยแพร่', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler', AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
      ],
    },
    // Reports Group
    {
      key: 'report', icon: '📈', label: 'รายงาน',
      grad: 'linear-gradient(135deg,#14b8a6,#0891b2)',
      roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'],
      items: [
        { to:'/reports/assignments',     icon:'📊', bg:'#fce7f3', label:'รายงานภาระงาน',    sub:'สรุปชั่วโมง ครู', roles: [AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_SCHEDULER, 'scheduler'] },
      ],
    },
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
        ] : []),
        { type:'section', label:'ทำรายการบันทึกการสอน', icon:'📝', badgeStyle:'background:linear-gradient(90deg,#059669,#10b981);' },
        { to:'/teacher/teaching-log', icon:'📝', bg:'#e0f2fe', label:'บันทึกเข้าสอน (รวมเช็คชื่อ)', sub:'เลือกวัน บันทึกสอนและเช็คชื่อ', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/leave-requests', icon:'🗓️', bg:'#fef3c7', label:'ยื่นคำขอลา', sub:'แจ้งลาและดูสถานะจัดสอนแทน', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher', 'sub_coordinator'] },
        { to:'/admin/substitute-manage', icon:'🔄', bg:'#ede9fe', label:'จัดสอนแทน', sub:'มอบหมายครูสอนแทน (หัวหน้ากลุ่มสาระ/ผู้ดูแล)', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, 'sub_coordinator', 'subject_head'] },
        { to:'/teacher/missed-records', icon:'⚠️', bg:'#fef3c7', label:'รายวิชาที่ลืมบันทึก', sub:'คาบค้างบันทึกในช่วงย้อนหลัง', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/daily-attendance', icon:'📋', bg:'#f0fdf4', label:'เช็คชื่อรายวัน / สรุปส่ง ผปค.', sub:'ครูประจำชั้น · บันทึกรายวัน · แจ้งผู้ปกครอง', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/teacher/behavior-entry', icon:'📝', bg:'#fdf4ff', label:'บันทึกพฤติกรรม', sub:'เลือกนักเรียน · แนบรูปภาพประกอบ', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'], featureGate: 'behavior_system_enabled' },
        ...(schoolStore.isClubModuleEnabled ? [
          { to:'/teacher/club-open', icon:'🎯', bg:'#ffedd5', label:'เปิดชุมนุม', sub:'ครูเปิดชุมนุมปกติและพิเศษ', roles:[AUTH_ROLES.SCHOOL_TEACHER, 'teacher', AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN] },
        ] : []),
        { type:'section', label:'รายงานการสอน', icon:'📊', badgeStyle:'background:linear-gradient(135deg,#0284c7,#0891b2);color:#fff;' },
        { to:'/reports/teaching-log', icon:'📘', bg:'#dbeafe', label:'รายงานบันทึกสอน', sub:'คาบที่บันทึก/ยังไม่บันทึก', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/reports/attendance', icon:'📋', bg:'#cffafe', label:'รายงานการมาเรียน (รายวิชา)', sub:'สรุปรายคน กรองห้อง/วิชา', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'] },
        { to:'/reports/behavior', icon:'📈', bg:'#fae8ff', label:'รายงานพฤติกรรม', sub:'คะแนนสะสมและเหตุการณ์', roles:[AUTH_ROLES.SCHOOL_ADMIN, 'admin', AUTH_ROLES.SUPERADMIN, AUTH_ROLES.SCHOOL_TEACHER, 'teacher'], featureGate: 'behavior_system_enabled' },
      ],
    }] : []),
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
    if (item.featureGate === 'behavior_system_enabled' && schoolStore.schoolInfo?.behavior_system_enabled === false) {
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

/* main content responsive padding */
@media (max-width: 640px) {
  :deep(.print-page),
  :deep(.page-content),
  :deep([class*="-page"]) {
    padding: 12px !important;
  }
}
</style>
