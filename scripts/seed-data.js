import fs from 'fs'
import path from 'path'
import {
  findAuthUserByEmail,
  getSupabaseScriptClient,
  hasServiceRoleCredentials,
  upsertCompatDoc,
} from './supabase-admin.js'

const now = new Date()
const nowIso = now.toISOString()

const TERM = process.env.SEED_TERM || '2568_1'
const SCHOOL_CODE = process.env.SEED_SCHOOL_CODE || 'DEMO001'
const SCHOOL_NAME = process.env.SEED_SCHOOL_NAME || 'โรงเรียนทดสอบระบบ'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin.demo@teachtable.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'DemoAdmin123!'
const CONTACT_NAME = process.env.SEED_CONTACT_NAME || 'ผู้ดูแลระบบทดสอบ'
const CONTACT_PHONE = process.env.SEED_CONTACT_PHONE || '0812345678'
const CONTACT_EMAIL = process.env.SEED_CONTACT_EMAIL || ADMIN_EMAIL
const PLAN_CODE = String(process.env.SEED_PLAN_CODE || '300')
const PLAN_MONTHS = Number(process.env.SEED_PLAN_MONTHS || 12)

const DEFAULTS_PATH = path.resolve(process.cwd(), 'scripts', 'school-defaults.json')

const PACKAGE_CATALOG = [
  { code: '200', name: 'Starter 200', monthly_fee: 200, scheduler_limit: 2, duration_months: 1, is_active: true, sort_order: 1 },
  { code: '300', name: 'School 300', monthly_fee: 300, scheduler_limit: 3, duration_months: 1, is_active: true, sort_order: 2 },
  { code: '500', name: 'School 500', monthly_fee: 500, scheduler_limit: 5, duration_months: 1, is_active: true, sort_order: 3 },
]

const SAMPLE_TEACHERS = [
  {
    teacher_code: 'T001',
    prefix: 'นาย',
    first_name: 'สมชาย',
    last_name: 'ทดลอง',
    academic_rank: 'ครู',
    department: 'คณิตศาสตร์',
    position: 'ครูผู้สอน',
    email: 'teacher1.demo@teachtable.local',
    phone: '0890000001',
    is_dept_head: true,
  },
  {
    teacher_code: 'T002',
    prefix: 'นางสาว',
    first_name: 'สุดา',
    last_name: 'ทดสอบ',
    academic_rank: 'ครู',
    department: 'วิทยาศาสตร์',
    position: 'ครูผู้สอน',
    email: 'teacher2.demo@teachtable.local',
    phone: '0890000002',
    is_dept_head: false,
  },
]

const SAMPLE_SUBJECTS = [
  { subject_code: 'MATH101', name: 'คณิตศาสตร์พื้นฐาน' },
  { subject_code: 'SCI101', name: 'วิทยาศาสตร์พื้นฐาน' },
]

const SAMPLE_CLASSES = [
  { class_name: 'ม.1/1', homeroom_teacher_code: 'T001' },
  { class_name: 'ม.1/2', homeroom_teacher_code: 'T002' },
]

const SAMPLE_ROOMS = [
  { room_id: 'R101', room_name: 'ห้อง 101', room_type: 'classroom', building: 'อาคาร 1', floor: '1', capacity: 40 },
  { room_id: 'LAB1', room_name: 'ห้องวิทย์ 1', room_type: 'lab', building: 'อาคารวิทย์', floor: '2', capacity: 35 },
]

function addMonths(baseDate, months) {
  const d = new Date(baseDate)
  d.setMonth(d.getMonth() + Number(months || 0))
  return d
}

function buildPlan() {
  const catalog = PACKAGE_CATALOG.find(item => item.code === PLAN_CODE) || PACKAGE_CATALOG[1]
  const expiresAt = addMonths(now, PLAN_MONTHS)
  return {
    code: catalog.code,
    name: catalog.name,
    monthly_fee: Number(catalog.monthly_fee || 0),
    scheduler_limit: Number(catalog.scheduler_limit || 0),
    duration_months: PLAN_MONTHS,
    expires_at: expiresAt.toISOString(),
    updated_at: nowIso,
    updated_by: 'seed-script',
    is_active: true,
  }
}

function loadDefaults() {
  return JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'))
}

function isSkippableSchemaError(error, targets = []) {
  const message = String(error?.message || '')
  if (/schema cache|relation .* does not exist|permission denied|row-level security/i.test(message)) {
    return true
  }

  return targets.some(target => {
    const escaped = String(target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(message)
  })
}

async function tryUpdateColumns(supabase, table, matchColumn, matchValue, payload, schemaTargets = []) {
  const { error } = await supabase.from(table).update(payload).eq(matchColumn, matchValue)
  if (!error) return true
  if (isSkippableSchemaError(error, [table, ...schemaTargets])) {
    console.warn(`Skipping optional ${table} columns: ${error.message}`)
    return false
  }
  throw error
}

async function ensurePackageCatalog(supabase) {
  for (const pkg of PACKAGE_CATALOG) {
    const { error } = await supabase.from('package_catalog').upsert(pkg, { onConflict: 'code' })
    if (!error) continue

    if (isSkippableSchemaError(error, ['package_catalog'])) {
      console.warn(`Skipping package_catalog seed: ${error.message}`)
      return false
    }

    throw error
  }

  return true
}

async function ensureAdminAuthUser(supabase) {
  if (hasServiceRoleCredentials()) {
    let user = await findAuthUserByEmail(supabase, ADMIN_EMAIL)
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { displayName: CONTACT_NAME },
      })
      if (error) throw error
      user = data.user
    } else {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { displayName: CONTACT_NAME },
        ban_duration: 'none',
      })
      if (error) throw error
    }
    return user
  }

  const signUpResult = await supabase.auth.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    options: {
      data: { displayName: CONTACT_NAME },
    },
  })

  if (signUpResult.error) {
    const msg = String(signUpResult.error.message || '')
    if (!/already registered|already been registered|User already registered/i.test(msg)) {
      throw signUpResult.error
    }

    const signInResult = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })
    if (signInResult.error || !signInResult.data?.user) {
      throw new Error('Admin auth user already exists but cannot sign in with the configured password. Set SUPABASE_SERVICE_ROLE_KEY or update SEED_ADMIN_PASSWORD to the current password.')
    }
    await supabase.auth.signOut()
    return signInResult.data.user
  }

  if (!signUpResult.data?.user) {
    throw new Error('Supabase signUp did not return a user')
  }

  if (signUpResult.data.session) {
    await supabase.auth.signOut()
  } else {
    // Keep the script stateless even when email confirmation is enabled.
    await supabase.auth.signOut().catch(() => {})
  }
  return signUpResult.data.user
}

async function ensureApprovedSchoolRequest(supabase) {
  const requestId = `seed-request-${SCHOOL_CODE.toLowerCase()}`
  const requestPayload = {
    id: requestId,
    schoolName: SCHOOL_NAME,
    schoolAddress: '99 ถนนสุขุมวิท กรุงเทพฯ 10110',
    schoolPhone: '02-000-0000',
    schoolEmail: `info.${SCHOOL_CODE.toLowerCase()}@teachtable.local`,
    contactName: CONTACT_NAME,
    contactPhone: CONTACT_PHONE,
    contactEmail: CONTACT_EMAIL,
    adminEmail: ADMIN_EMAIL,
    adminPassword: null,
    status: 'approved',
    submittedAt: nowIso,
    reviewedAt: nowIso,
    reviewedBy: 'seed-script',
    rejectionReason: '',
    approvedAt: nowIso,
    approvalToken: `seed-token-${SCHOOL_CODE.toLowerCase()}`,
    tokenCreatedAt: nowIso,
    superAdminNotifiedAt: nowIso,
  }

  const { error } = await supabase.from('school_requests').upsert(requestPayload, { onConflict: 'id' })
  if (error) {
    if (isSkippableSchemaError(error, ['school_requests'])) {
      console.warn(`Skipping school_requests seed: ${error.message}`)
      return null
    }
    throw error
  }
  return requestId
}

async function ensureSchoolRow(supabase, requestId) {
  const plan = buildPlan()
  const settings = {
    feature_flags: {
      teaching_log_enabled: true,
      behavior_system_enabled: true,
      club_module_enabled: true,
    },
    pricing_plan: plan,
    scheduler_limit_override: null,
    timetable_locked: false,
    updated_at: nowIso,
    updated_by: 'seed-script',
  }

  const schoolPayload = {
    code: SCHOOL_CODE,
    name: SCHOOL_NAME,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const { data: existing, error: existingError } = await supabase
    .from('schools')
    .select('id')
    .eq('code', SCHOOL_CODE)
    .maybeSingle()
  if (existingError) throw existingError

  let schoolId = existing?.id
  if (schoolId) {
    const { error } = await supabase.from('schools').update(schoolPayload).eq('id', schoolId)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('schools').insert([schoolPayload]).select('id').single()
    if (error) throw error
    schoolId = data.id
  }

  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { current_term: TERM }, ['current_term'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { year: Number(TERM.split('_')[0] || 2568) }, ['year'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { semester: Number(TERM.split('_')[1] || 1) }, ['semester'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { settings }, ['settings'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { pricing_plan: plan }, ['pricing_plan'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { subscription_status: 'active' }, ['subscription_status'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { admin_email: ADMIN_EMAIL }, ['admin_email'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { isActive: true }, ['isActive'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { currentTerm: TERM }, ['currentTerm'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { subscriptionStatus: 'active' }, ['subscriptionStatus'])
  await tryUpdateColumns(supabase, 'schools', 'id', schoolId, { adminEmail: ADMIN_EMAIL }, ['adminEmail'])

  if (requestId) {
    const { error: requestError } = await supabase
      .from('school_requests')
      .update({ schoolId: schoolId, approvedAt: nowIso, reviewedAt: nowIso, status: 'approved' })
      .eq('id', requestId)

    if (requestError) {
      if (isSkippableSchemaError(requestError, ['school_requests'])) {
        console.warn(`Skipping school_requests update: ${requestError.message}`)
      } else {
        throw requestError
      }
    }
  }

  return { schoolId, plan }
}

async function ensureAdminProfile(supabase, userId, schoolId) {
  const userPayload = {
    id: userId,
    email: ADMIN_EMAIL,
    displayName: CONTACT_NAME,
    firstName: 'Admin',
    lastName: SCHOOL_NAME,
    role: 'school_admin',
    roles: ['school_admin', 'admin'],
    schoolId,
    school_id: schoolId,
    isActive: true,
    is_active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  const { error } = await supabase.from('users').upsert(userPayload, { onConflict: 'id' })
  if (error) throw error

  await tryUpdateColumns(
    supabase,
    'users',
    'id',
    userId,
    {
      uid: userId,
      schoolRole: 'admin',
      school_role: 'admin',
      permissions: ['school:full_access'],
      created_at: nowIso,
      updated_at: nowIso,
      updated_by: 'seed-script',
    },
    ['uid', 'schoolRole', 'school_role', 'permissions', 'created_at', 'updated_at', 'updated_by']
  )
}

async function ensureCompatSchoolInfo(supabase, schoolId, plan) {
  const currentTerm = TERM
  const [year, semester] = currentTerm.split('_')
  await upsertCompatDoc(supabase, `schools/${schoolId}/school_info/main`, {
    name: SCHOOL_NAME,
    name_short: SCHOOL_NAME,
    current_term: currentTerm,
    year: Number(year || 2568),
    semester: Number(semester || 1),
    phone: '02-000-0000',
    email: `info.${SCHOOL_CODE.toLowerCase()}@teachtable.local`,
    principal_name: 'ผู้อำนวยการตัวอย่าง',
    principal_position: 'ผู้อำนวยการโรงเรียน',
    signer_name: 'ผู้อำนวยการตัวอย่าง',
    signer_position: 'ผู้อำนวยการโรงเรียน',
    school_days: [1, 2, 3, 4, 5],
    periods_per_day: 8,
    period_times: [
      { period: 1, start: '08:30', end: '09:20' },
      { period: 2, start: '09:20', end: '10:10' },
      { period: 3, start: '10:30', end: '11:20' },
      { period: 4, start: '11:20', end: '12:10' },
      { period: 5, start: '13:00', end: '13:50' },
      { period: 6, start: '13:50', end: '14:40' },
      { period: 7, start: '14:50', end: '15:40' },
      { period: 0, start: '12:10', end: '13:00', label: 'พักกลางวัน' },
    ],
    timetable_locked: false,
    feature_flags: {
      teaching_log_enabled: true,
      behavior_system_enabled: true,
      club_module_enabled: true,
    },
    pricing_plan: plan,
    updated_at: nowIso,
  })

  await upsertCompatDoc(supabase, `schools/${schoolId}/terms/${currentTerm}`, {
    id: currentTerm,
    created_at: nowIso,
    created_by: 'seed-script',
  })
}

async function seedDefaults(supabase, schoolId) {
  const defaults = loadDefaults()
  for (const status of defaults.attendance_statuses || []) {
    await upsertCompatDoc(
      supabase,
      `schools/${schoolId}/terms/${TERM}/attendance_status_settings/${status.status_code}`,
      { ...status, updated_at: nowIso }
    )
  }

  for (const setting of defaults.behavior_settings || []) {
    await upsertCompatDoc(
      supabase,
      `schools/${schoolId}/terms/${TERM}/behavior_settings/${setting.setting_id}`,
      { ...setting, updated_at: nowIso }
    )
  }
}

async function seedTeachers(supabase, schoolId) {
  const teacherIdByCode = {}

  for (const teacher of SAMPLE_TEACHERS) {
    const payload = {
      school_id: schoolId,
      teacher_code: teacher.teacher_code,
      prefix: teacher.prefix,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      academic_rank: teacher.academic_rank,
      department: teacher.department,
      position: teacher.position,
      email: teacher.email,
      phone: teacher.phone,
      is_dept_head: teacher.is_dept_head === true,
      is_active: true,
    }

    const { data: existing, error: existingError } = await supabase
      .from('teachers')
      .select('id')
      .eq('school_id', schoolId)
      .eq('teacher_code', teacher.teacher_code)
      .maybeSingle()
    if (existingError) throw existingError

    let teacherId = existing?.id
    if (teacherId) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', teacherId)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('teachers').insert([payload]).select('id').single()
      if (error) throw error
      teacherId = data.id
    }

    teacherIdByCode[teacher.teacher_code] = teacherId

    await upsertCompatDoc(supabase, `schools/${schoolId}/terms/${TERM}/teachers/${teacher.teacher_code}`, {
      teacher_id: teacher.teacher_code,
      prefix: teacher.prefix,
      name: teacher.first_name,
      surname: teacher.last_name,
      academic_rank: teacher.academic_rank,
      dept: teacher.department,
      department: teacher.department,
      position: teacher.position,
      email: teacher.email,
      phone: teacher.phone,
      is_dept_head: teacher.is_dept_head === true,
      is_active: true,
      updated_at: nowIso,
    })
  }

  return teacherIdByCode
}

async function seedSubjects(supabase, schoolId) {
  for (const subject of SAMPLE_SUBJECTS) {
    const payload = {
      school_id: schoolId,
      subject_code: subject.subject_code,
      name: subject.name,
    }

    const { data: existing, error: existingError } = await supabase
      .from('subjects')
      .select('id')
      .eq('school_id', schoolId)
      .eq('subject_code', subject.subject_code)
      .maybeSingle()
    if (existingError) throw existingError

    let subjectId = existing?.id
    if (subjectId) {
      const { error } = await supabase.from('subjects').update(payload).eq('id', subjectId)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('subjects').insert([payload]).select('id').single()
      if (error) throw error
      subjectId = data.id
    }

    await upsertCompatDoc(supabase, `schools/${schoolId}/terms/${TERM}/subjects/${subject.subject_code}`, {
      subject_code: subject.subject_code,
      name: subject.name,
      updated_at: nowIso,
    })
  }
}

async function seedClasses(supabase, schoolId, teacherIdByCode) {
  for (const cls of SAMPLE_CLASSES) {
    const payload = {
      school_id: schoolId,
      class_name: cls.class_name,
      homeroom_teacher_id: teacherIdByCode[cls.homeroom_teacher_code] || null,
    }

    const { data: existing, error: existingError } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('class_name', cls.class_name)
      .maybeSingle()
    if (existingError) throw existingError

    let classId = existing?.id
    if (classId) {
      const { error } = await supabase.from('classes').update(payload).eq('id', classId)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('classes').insert([payload]).select('id').single()
      if (error) throw error
      classId = data.id
    }

    await upsertCompatDoc(supabase, `schools/${schoolId}/terms/${TERM}/classes/${cls.class_name.replace(/\//g, '_')}`, {
      class_id: cls.class_name,
      class_name: cls.class_name,
      homeroom_teacher_id: teacherIdByCode[cls.homeroom_teacher_code] || null,
      updated_at: nowIso,
    })
  }
}

async function seedRoomsCompat(supabase, schoolId) {
  const activeRooms = SAMPLE_ROOMS.map(room => ({ ...room, is_active: true }))
  await upsertCompatDoc(supabase, `schools/${schoolId}/terms/${TERM}/lookups/room_catalog`, {
    version: 1,
    active_rooms: activeRooms,
    lab_rooms: activeRooms.filter(room => room.room_type === 'lab'),
    special_rooms: activeRooms.filter(room => room.room_type === 'special'),
    classroom_rooms: activeRooms.filter(room => ['classroom', 'other'].includes(room.room_type || 'other')),
    updated_at: nowIso,
  })
}

async function seedRoomsSql(supabase, schoolId) {
  for (const room of SAMPLE_ROOMS) {
    const payload = {
      school_id: schoolId,
      room_code: room.room_id,
      room_name: room.room_name,
      room_type: room.room_type,
      building: room.building || null,
      floor: room.floor || null,
      capacity: room.capacity || null,
      is_active: true,
    }

    const { data: existing, error: existingError } = await supabase
      .from('rooms')
      .select('id')
      .eq('school_id', schoolId)
      .eq('room_code', room.room_id)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing?.id) {
      const { error } = await supabase.from('rooms').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('rooms').insert([payload])
      if (error) throw error
    }
  }
}

async function main() {
  const supabase = getSupabaseScriptClient()

  console.log('Seeding baseline Supabase data for end-to-end school testing...')
  const packageCatalogSeeded = await ensurePackageCatalog(supabase)
  const authUser = await ensureAdminAuthUser(supabase)
  const requestId = await ensureApprovedSchoolRequest(supabase)
  const { schoolId, plan } = await ensureSchoolRow(supabase, requestId)
  await ensureAdminProfile(supabase, authUser.id, schoolId)
  await ensureCompatSchoolInfo(supabase, schoolId, plan)
  await seedDefaults(supabase, schoolId)
  const teacherIdByCode = await seedTeachers(supabase, schoolId)
  await seedSubjects(supabase, schoolId)
  await seedClasses(supabase, schoolId, teacherIdByCode)
  await seedRoomsSql(supabase, schoolId)
  await seedRoomsCompat(supabase, schoolId)

  console.log('Seed completed successfully.')
  console.log(`School ID: ${schoolId}`)
  console.log(`School Code: ${SCHOOL_CODE}`)
  console.log(`Admin Email: ${ADMIN_EMAIL}`)
  console.log(`Admin Password: ${ADMIN_PASSWORD}`)
  console.log(`Current Term: ${TERM}`)
  console.log(`Plan Code: ${PLAN_CODE}`)
  console.log(`Package Catalog Seeded: ${packageCatalogSeeded ? 'yes' : 'skipped'}`)
}

main().catch((error) => {
  console.error('Failed to seed baseline system data:', error.message)
  process.exit(1)
})
