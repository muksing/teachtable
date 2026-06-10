import {
  findAuthUserByEmail,
  getSupabaseScriptClient,
  hasServiceRoleCredentials,
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
  { room_code: 'R101', room_name: 'ห้อง 101', room_type: 'classroom', building: 'อาคาร 1', floor: 1, capacity: 40 },
  { room_code: 'LAB1', room_name: 'ห้องวิทย์ 1', room_type: 'lab', building: 'อาคารวิทย์', floor: 2, capacity: 35 },
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
    const { data: existing } = await supabase.from('package_catalog').select('id').eq('code', pkg.code).maybeSingle()
    if (existing?.id) {
      const { error } = await supabase.from('package_catalog').update(pkg).eq('id', existing.id)
      if (!error) continue
      if (isSkippableSchemaError(error, ['package_catalog'])) {
        console.warn(`Skipping package_catalog seed: ${error.message}`)
        return false
      }
      throw error
    } else {
      const { error } = await supabase.from('package_catalog').insert([pkg])
      if (!error) continue
      if (isSkippableSchemaError(error, ['package_catalog'])) {
        console.warn(`Skipping package_catalog seed: ${error.message}`)
        return false
      }
      throw error
    }
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
    options: { data: { displayName: CONTACT_NAME } },
  })

  if (signUpResult.error) {
    const msg = String(signUpResult.error.message || '')
    if (!/already registered|already been registered|User already registered/i.test(msg)) {
      throw signUpResult.error
    }
    const signInResult = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    if (signInResult.error || !signInResult.data?.user) {
      throw new Error('Admin auth user already exists but cannot sign in with the configured password.')
    }
    await supabase.auth.signOut()
    return signInResult.data.user
  }

  if (!signUpResult.data?.user) throw new Error('Supabase signUp did not return a user')
  if (signUpResult.data.session) await supabase.auth.signOut()
  else await supabase.auth.signOut().catch(() => {})
  return signUpResult.data.user
}

async function ensureApprovedSchoolRequest(supabase) {
  const requestPayload = {
    school_name: SCHOOL_NAME,
    school_address: '99 ถนนสุขุมวิท กรุงเทพฯ 10110',
    school_phone: '02-000-0000',
    school_email: `info.${SCHOOL_CODE.toLowerCase()}@teachtable.local`,
    contact_name: CONTACT_NAME,
    contact_phone: CONTACT_PHONE,
    contact_email: CONTACT_EMAIL,
    admin_email: ADMIN_EMAIL,
    status: 'approved',
    submitted_at: nowIso,
    reviewed_at: nowIso,
    reviewed_by: 'seed-script',
    rejection_reason: '',
    approved_at: nowIso,
    approval_token: `seed-token-${SCHOOL_CODE.toLowerCase()}`,
  }

  // Check if a request already exists for this admin email
  const { data: existing } = await supabase
    .from('school_requests').select('id').eq('admin_email', ADMIN_EMAIL).maybeSingle()

  let requestId = existing?.id
  if (requestId) {
    const { error } = await supabase.from('school_requests').update(requestPayload).eq('id', requestId)
    if (error) {
      if (isSkippableSchemaError(error, ['school_requests'])) {
        console.warn(`Skipping school_requests seed: ${error.message}`)
        return null
      }
      throw error
    }
  } else {
    const { data, error } = await supabase.from('school_requests').insert([requestPayload]).select('id').single()
    if (error) {
      if (isSkippableSchemaError(error, ['school_requests'])) {
        console.warn(`Skipping school_requests seed: ${error.message}`)
        return null
      }
      throw error
    }
    requestId = data.id
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
    settings,
    current_term: TERM,
    year: Number(TERM.split('_')[0] || 2568),
    created_at: nowIso,
    updated_at: nowIso,
  }

  const { data: existing, error: existingError } = await supabase
    .from('schools').select('id').eq('code', SCHOOL_CODE).maybeSingle()
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
    roles: ['school_admin'],
    schoolId,
    school_id: schoolId,
    isActive: true,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const { error } = await supabase.from('users').upsert(userPayload, { onConflict: 'id' })
  if (error) throw error
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
      phone: teacher.phone,
      is_dept_head: teacher.is_dept_head === true,
      is_active: true,
    }

    const { data: existing } = await supabase
      .from('teachers').select('id').eq('school_id', schoolId).eq('teacher_code', teacher.teacher_code).maybeSingle()

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
  }

  return teacherIdByCode
}

async function seedSubjects(supabase, schoolId) {
  for (const subject of SAMPLE_SUBJECTS) {
    const payload = { school_id: schoolId, subject_code: subject.subject_code, name: subject.name }

    const { data: existing } = await supabase
      .from('subjects').select('id').eq('school_id', schoolId).eq('subject_code', subject.subject_code).maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from('subjects').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('subjects').insert([payload])
      if (error) throw error
    }
  }
}

async function seedClasses(supabase, schoolId, teacherIdByCode) {
  for (const cls of SAMPLE_CLASSES) {
    const payload = {
      school_id: schoolId,
      class_name: cls.class_name,
      homeroom_teacher_id: teacherIdByCode[cls.homeroom_teacher_code] || null,
    }

    const { data: existing } = await supabase
      .from('classes').select('id').eq('school_id', schoolId).eq('class_name', cls.class_name).maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from('classes').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('classes').insert([payload])
      if (error) throw error
    }
  }
}

async function seedRooms(supabase, schoolId) {
  for (const room of SAMPLE_ROOMS) {
    const payload = {
      school_id: schoolId,
      room_code: room.room_code,
      room_name: room.room_name,
      room_type: room.room_type,
      building: room.building || null,
      floor: room.floor || null,
      capacity: room.capacity || null,
      is_active: true,
    }

    const { data: existing } = await supabase
      .from('rooms').select('id').eq('school_id', schoolId).eq('room_code', room.room_code).maybeSingle()

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

  console.log('Seeding baseline Supabase data...')
  const packageCatalogSeeded = await ensurePackageCatalog(supabase)
  const authUser = await ensureAdminAuthUser(supabase)
  const requestId = await ensureApprovedSchoolRequest(supabase)
  const { schoolId, plan } = await ensureSchoolRow(supabase, requestId)
  await ensureAdminProfile(supabase, authUser.id, schoolId)
  const teacherIdByCode = await seedTeachers(supabase, schoolId)
  await seedSubjects(supabase, schoolId)
  await seedClasses(supabase, schoolId, teacherIdByCode)
  await seedRooms(supabase, schoolId)

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
