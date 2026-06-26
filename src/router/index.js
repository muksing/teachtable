import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useStudentStore } from '@/stores/student'
import { authReady } from '@/composables/useMasterAuth'
import LoginView from '@/views/LoginView.vue'
import PublicHomeView from '@/views/PublicHomeView.vue'
import DashboardView from '@/views/DashboardView.vue'

const routes = [
  { path: '/', name: 'SchoolPicker', component: () => import('@/views/SchoolPickerView.vue'), meta: { public: true } },
  { path: '/s/:schoolId', name: 'SchoolPortal', component: () => import('@/views/SchoolPortalView.vue'), meta: { public: true } },
  { path: '/login', name: 'Login', component: PublicHomeView, meta: { public: true } },
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
  { path: '/admin/import-teach-actuals', name: 'ImportTeachActuals', component: () => import('@/views/admin/ImportTeachActualsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/generate-teach-actuals', name: 'GenerateTeachActuals', component: () => import('@/views/admin/GenerateTeachActualsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },

  // Scheduler routes
  { path: '/planning/assignments', name: 'Assignments', component: () => import('@/views/scheduler/AssignmentsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/planning/timetable', name: 'Timetable', component: () => import('@/views/scheduler/TimetableView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'] } },
  { path: '/planning/print', name: 'PrintTimetable', component: () => import('@/views/scheduler/PrintTimetableView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler', 'school_teacher', 'teacher'] } },
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
  { path: '/reports/teaching-log', name: 'TeachingLogReport', component: () => import('@/views/reports/TeachingLogReportView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/reports/attendance', name: 'AttendanceReport', component: () => import('@/views/reports/AttendanceReportView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/reports/daily-attendance', name: 'DailyAttendanceReport', component: () => import('@/views/teacher/DailyAttendanceSummaryView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/reports/behavior', name: 'BehaviorReport', component: () => import('@/views/reports/BehaviorReportView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'behavior_system_enabled' } },

  { path: '/profile', name: 'Profile', component: () => import('@/views/ProfileView.vue'), meta: { requireAuth: true } },

  // หน้าอนุมัติ/ปฏิเสธโรงเรียนจากลิงก์ในอีเมล
  { path: '/email-action', name: 'EmailAction', component: () => import('@/views/EmailActionView.vue'), meta: { public: true } },

  { path: '/teacher/teach-actual/:id', name: 'TeachActualDetail', component: () => import('@/views/teacher/TeachActualDetailView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/teacher/missed-records', name: 'MissedTeachActual', component: () => import('@/views/teacher/MissedTeachActualView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'], featureGate: 'teaching_log_enabled' } },
  { path: '/teacher/homeroom-dashboard', name: 'HomeroomDashboard', component: () => import('@/views/teacher/HomeroomDashboardView.vue'), meta: { requireAuth: true, roles: ['school_teacher', 'teacher'] } },

  // คะแนนเก็บ
  { path: '/teacher/score-entry', name: 'ScoreEntry', component: () => import('@/views/teacher/ScoreEntryView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },

  // ระบบสอบ (teacher)
  { path: '/teacher/exams', name: 'ExamList', component: () => import('@/views/teacher/ExamListView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/teacher/exams/create', name: 'ExamCreate', component: () => import('@/views/teacher/ExamCreateView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/teacher/exams/:id/edit', name: 'ExamEdit', component: () => import('@/views/teacher/ExamCreateView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/teacher/exams/:id/questions', name: 'ExamQuestions', component: () => import('@/views/teacher/ExamQuestionsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/teacher/proctor', name: 'ExamProctoringSelect', component: () => import('@/views/teacher/ExamProctoringSelectView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/teacher/exams/:id/proctor', name: 'ExamProctor', component: () => import('@/views/teacher/ExamProctoringView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/teacher/exams/:id/grade', name: 'ExamGrading', component: () => import('@/views/teacher/ExamGradingView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/teacher/exams/:id/preview', name: 'ExamPreview', component: () => import('@/views/teacher/ExamPreviewView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },
  { path: '/admin/notification-settings', name: 'NotificationSettings', component: () => import('@/views/admin/NotificationTargetSettingsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/exam-overview', name: 'AdminExamOverview', component: () => import('@/views/admin/ExamOverviewView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/exam-checklist', name: 'AdminExamChecklist', component: () => import('@/views/admin/ExamChecklistView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/admin/exam-anticheat', name: 'AdminExamAntiCheat', component: () => import('@/views/admin/ExamAntiCheatSettingsView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin'] } },
  { path: '/reports/parent-letter', name: 'ParentLetter', component: () => import('@/views/reports/ParentLetterView.vue'), meta: { requireAuth: true, roles: ['school_admin', 'admin', 'superadmin', 'school_teacher', 'teacher'] } },

  // Student portal
  { path: '/student/login', name: 'StudentLogin',
    component: () => import('@/views/student/StudentLoginView.vue'),
    meta: { public: true } },
  {
    path: '/student',
    component: () => import('@/components/layout/StudentLayout.vue'),
    meta: { studentPortal: true },
    children: [
      { path: '', redirect: '/student/dashboard' },
      { path: 'dashboard',  name: 'StudentDashboard',  component: () => import('@/views/student/StudentDashboardView.vue') },
      { path: 'behavior',   name: 'StudentBehavior',   component: () => import('@/views/student/StudentBehaviorView.vue') },
      { path: 'scores',     name: 'StudentScores',     component: () => import('@/views/student/StudentScoresView.vue') },
      { path: 'attendance', name: 'StudentAttendance', component: () => import('@/views/student/StudentAttendanceView.vue') },
      { path: 'club',       name: 'StudentClub',       component: () => import('@/views/student/StudentClubView.vue') },
      { path: 'change-pin',  name: 'StudentChangePin',   component: () => import('@/views/student/StudentChangePinView.vue') },
      { path: 'health',      name: 'StudentHealth',      component: () => import('@/views/student/StudentHealthView.vue') },
      { path: 'good-deeds',  name: 'StudentGoodDeeds',   component: () => import('@/views/student/StudentGoodDeedsView.vue') },
      { path: 'gratitude',   name: 'StudentGratitude',   component: () => import('@/views/student/StudentGratitudeView.vue') },
      { path: 'messages',    name: 'StudentMessages',    component: () => import('@/views/student/StudentMessagesView.vue') },
      { path: 'exams',       name: 'StudentExamList',    component: () => import('@/views/student/StudentExamListView.vue') },
      { path: 'exams/:id',   name: 'StudentExamTaking',  component: () => import('@/views/student/StudentExamTakingView.vue'), meta: { examMode: true } },
    ]
  },

  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// cache homeroom class: { teacherId, className } | null (ยังไม่ตรวจ)
let _homeroomCache = null

const EXPIRED_ALLOWLIST = ['/dashboard', '/planning/print', '/teacher/my-timetable', '/profile', '/admin/school-settings', '/admin/renewal']

const LOCKED_SCHEDULE_DENYLIST = ['/planning/assignments', '/planning/activity-booking', '/planning/timetable']

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
  // Student portal: ใช้ custom session แยกจาก Supabase auth
  if (to.meta.studentPortal) {
    const studentStore = useStudentStore()
    if (!studentStore.isLoggedIn) return next({ name: 'StudentLogin' })
    return next()
  }

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

  // ครูที่ปรึกษา → ไปหน้า homeroom dashboard อัตโนมัติเมื่อเข้า /dashboard
  if (
    to.path === '/dashboard' &&
    authStore.hasAnyRole(['school_teacher', 'teacher']) &&
    !authStore.hasAnyRole(['school_admin', 'admin', 'superadmin'])
  ) {
    const teacherId = authStore.profile?.teacher_id
    if (teacherId) {
      if (!_homeroomCache || _homeroomCache.teacherId !== teacherId) {
        try {
          const { supabase: sb } = await import('@/supabase/client')
          const { data } = await sb
            .from('classes')
            .select('class_name')
            .eq('school_id', authStore.schoolId)
            .filter('homeroom_teacher_ids', 'cs', `{"${teacherId}"}`)
            .limit(1)
            .maybeSingle()
          _homeroomCache = { teacherId, className: data?.class_name || null }
        } catch {
          _homeroomCache = { teacherId, className: null }
        }
      }
      if (_homeroomCache.className) return next('/teacher/homeroom-dashboard')
    }
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
