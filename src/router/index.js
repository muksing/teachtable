import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { authReady } from '@/composables/useMasterAuth'
import LoginView from '@/views/LoginView.vue'
import PublicHomeView from '@/views/PublicHomeView.vue'
import DashboardView from '@/views/DashboardView.vue'

const routes = [
  { path: '/', name: 'PublicHome', component: PublicHomeView, meta: { public: true } },
  { path: '/login', name: 'Login', component: LoginView, meta: { public: true } },
  { path: '/register-school', name: 'SchoolRegistration', component: () => import('@/views/SchoolRegistrationView.vue'), meta: { public: true } },
  { path: '/pricing-calculator', name: 'PricingCalculator', component: () => import('@/views/PricingCalculatorView.vue'), meta: { public: true } },
  { path: '/v/:schoolId', name: 'PublicTimetable', component: () => import('@/views/PublicTimetableView.vue'), meta: { public: true } },
  { path: '/dashboard', name: 'Dashboard', component: DashboardView, meta: { requireAuth: true } },

  // SuperAdmin routes
  {
    path: '/superadmin',
    component: () => import('@/views/superadmin/SuperAdminLayout.vue'),
    meta: { requireAuth: true, roles: ['superadmin'] },
    children: [
      { path: '', redirect: '/superadmin/dashboard' },
      { path: 'dashboard', name: 'SuperAdminDashboard', component: () => import('@/views/superadmin/SuperAdminDashboardView.vue') },
      { path: 'school-requests', name: 'SchoolRequests', component: () => import('@/views/superadmin/SchoolRequestsView.vue') },
      { path: 'schools', name: 'ActiveSchools', component: () => import('@/views/superadmin/ActiveSchoolsView.vue') },
      { path: 'packages', name: 'PackageCatalog', component: () => import('@/views/superadmin/PackageCatalogView.vue') },
      { path: 'pricing-formula', name: 'PricingFormulaSettings', component: () => import('@/views/superadmin/PricingFormulaSettingsView.vue') },
      { path: 'renewal-approval', name: 'RenewalApproval', component: () => import('@/views/superadmin/RenewalApprovalView.vue') },
      { path: 'settings', name: 'SuperAdminSettings', component: () => import('@/views/superadmin/SuperAdminSettingsView.vue') }
    ]
  },

  // Admin routes
  { path: '/admin/users', name: 'Users', component: () => import('@/views/admin/UsersView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/teachers', name: 'Teachers', component: () => import('@/views/admin/TeachersView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/subjects', name: 'Subjects', component: () => import('@/views/admin/SubjectsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/admin/classes', name: 'Classes', component: () => import('@/views/admin/ClassesView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/students', name: 'Students', component: () => import('@/views/admin/StudentsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/admin/behavior-settings', name: 'BehaviorSettings', component: () => import('@/views/admin/BehaviorSettingsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/attendance-status', name: 'AttendanceStatus', component: () => import('@/views/admin/AttendanceStatusView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/attendance-maeso', name: 'AttendanceMaeSo', component: () => import('@/views/admin/AttendanceMaeSoView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/admin/teaching-log-settings', name: 'TeachingLogSettings', component: () => import('@/views/admin/TeachingLogSettingsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/school-settings', name: 'SchoolSettings', component: () => import('@/views/admin/SchoolSettingsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/renewal', name: 'Renewal', component: () => import('@/views/admin/RenewalView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/terms', name: 'TermManagement', component: () => import('@/views/admin/TermManagementView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/rooms', name: 'Rooms', component: () => import('@/views/admin/RoomsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/admin/signatures', name: 'SignatureSettings', component: () => import('@/views/admin/SignatureSettingsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/teach-actuals', name: 'AdminTeachActuals', component: () => import('@/views/admin/AdminTeachActualsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },

  // Scheduler routes
  { path: '/planning/assignments', name: 'Assignments', component: () => import('@/views/scheduler/AssignmentsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/planning/timetable', name: 'Timetable', component: () => import('@/views/scheduler/TimetableView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/planning/print', name: 'PrintTimetable', component: () => import('@/views/scheduler/PrintTimetableView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/planning/activity-booking', name: 'ActivityBooking', component: () => import('@/views/scheduler/ActivityBookingView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/planning/package-renewal', name: 'PackageRenewal', component: () => import('@/views/scheduler/PackageRenewalView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/teacher/my-timetable', name: 'MyTimetable', component: () => import('@/views/teacher/MyTimetableView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler', 'school_teacher', 'teacher'] } },
  { path: '/teacher/teaching-log', name: 'TeachingLog', component: () => import('@/views/teacher/TeachingLogView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/teacher/attendance', redirect: '/teacher/teaching-log', meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/teacher/behavior', name: 'Behavior', component: () => import('@/views/teacher/BehaviorView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'behavior_system_enabled' } },
  { path: '/teacher/behavior-entry', name: 'BehaviorEntry', component: () => import('@/views/teacher/BehaviorEntryView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'behavior_system_enabled' } },
  { path: '/teacher/club-open', name: 'TeacherClubOpen', component: () => import('@/views/teacher/TeacherClubView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'club_module_enabled' } },
  { path: '/teacher/club/:clubId', name: 'ClubDetail', component: () => import('@/views/teacher/TeacherClubDetailView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'club_module_enabled' } },
  { path: '/teacher/daily-attendance', name: 'DailyAttendance', component: () => import('@/views/teacher/DailyAttendanceSummaryView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/teacher/leave-requests', name: 'LeaveRequests', component: () => import('@/views/teacher/LeaveRequestView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher', 'sub_coordinator'], featureGate: 'teaching_log_enabled' } },
  { path: '/admin/substitute-manage', name: 'SubstituteManage', component: () => import('@/views/admin/SubstituteManageView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'sub_coordinator', 'subject_head'], featureGate: 'teaching_log_enabled' } },

  // Reports
  { path: '/reports/assignments', name: 'AssignmentReport', component: () => import('@/views/reports/AssignmentReportView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/reports/teaching-log', name: 'TeachingLogReport', component: () => import('@/views/reports/TeachingLogReportView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/reports/attendance', name: 'AttendanceReport', component: () => import('@/views/reports/AttendanceReportView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/reports/daily-attendance', name: 'DailyAttendanceReport', component: () => import('@/views/teacher/DailyAttendanceSummaryView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/reports/behavior', name: 'BehaviorReport', component: () => import('@/views/reports/BehaviorReportView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'behavior_system_enabled' } },

  { path: '/profile', name: 'Profile', component: () => import('@/views/ProfileView.vue'), meta: { requireAuth: true } },

  // หน้าอนุมัติ/ปฏิเสธโรงเรียนจากลิงก์ในอีเมล
  { path: '/email-action', name: 'EmailAction', component: () => import('@/views/EmailActionView.vue'), meta: { public: true } },

  { path: '/teacher/teach-actual/:id', name: 'TeachActualDetail', component: () => import('@/views/teacher/TeachActualDetailView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/teacher/missed-records', name: 'MissedTeachActual', component: () => import('@/views/teacher/MissedTeachActualView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },

  // คะแนนเก็บ
  { path: '/teacher/score-entry', name: 'ScoreEntry', component: () => import('@/views/teacher/ScoreEntryView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/admin/notification-settings', name: 'NotificationSettings', component: () => import('@/views/admin/NotificationTargetSettingsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/reports/parent-letter', name: 'ParentLetter', component: () => import('@/views/reports/ParentLetterView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },

  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const EXPIRED_ALLOWLIST = ['/dashboard', '/planning/print', '/teacher/my-timetable', '/profile', '/admin/school-settings', '/admin/renewal']

const LOCKED_SCHEDULE_DENYLIST = ['/planning/assignments', '/planning/activity-booking', '/planning/timetable', '/reports/assignments']

function isAllowedInExpiredMode(path) {
  return EXPIRED_ALLOWLIST.some(p => path === p || path.startsWith(`${p}/`))
}

function getExpiredRedirectTarget(authStore) {
  return authStore.hasAnyRole(['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'])
    ? '/planning/print'
    : '/teacher/my-timetable'
}

function isDeniedByTimetableLock(path) {
  return LOCKED_SCHEDULE_DENYLIST.some(p => path === p || path.startsWith(`${p}/`))
}

function isSchedulerRole(authStore) {
  return authStore.hasAnyRole(['school_scheduler', 'scheduler']) && !authStore.hasAnyRole(['school_teacher', 'teacher'])
}

function isRouteFeatureEnabled(schoolStore, gateName) {
  if (!gateName) return true
  if (gateName === 'behavior_system_enabled') {
    return schoolStore.isBehaviorSystemEnabled
  }
  if (gateName === 'teaching_log_enabled') {
    return schoolStore.isTeachingLogEnabled !== false
  }
  if (gateName === 'club_module_enabled') {
    return schoolStore.isClubModuleEnabled === true
  }
  if (typeof schoolStore.isFeatureEnabled === 'function') {
    return schoolStore.isFeatureEnabled(gateName)
  }
  return true
}

// Navigation Guard — Role-based (รอ auth restore ก่อนเสมอ)
router.beforeEach(async (to, from, next) => {
  await authReady
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  if (to.meta.public) return next()
  if (!authStore.isLoggedIn) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }
  if (authStore.isSuperAdmin && to.path === '/dashboard') {
    return next('/superadmin/dashboard')
  }
  if (to.meta.roles && !authStore.hasAnyRole(to.meta.roles)) {
    return next('/dashboard')
  }

  if (!authStore.isSuperAdmin && !isRouteFeatureEnabled(schoolStore, to.meta?.featureGate)) {
    return next('/dashboard')
  }

  // ถ้าระบบล็อคตาราง: scheduler เข้าหน้าพิมพ์ได้อย่างเดียว
  if (schoolStore.isTimetableLocked && !authStore.isAdmin) {
    if (isDeniedByTimetableLock(to.path)) {
      return next('/teacher/my-timetable')
    }
  }

  // แพ็กเกจหมดอายุ: login ได้ แต่ใช้งานได้แค่ดูตารางสอน (view-only)
  if (!authStore.isSuperAdmin && schoolStore.isViewOnlyMode && !isAllowedInExpiredMode(to.path)) {
    return next(getExpiredRedirectTarget(authStore))
  }

  next()
})

export default router
