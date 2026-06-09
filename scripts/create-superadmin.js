import { getSupabaseAdmin, findAuthUserByEmail } from './supabase-admin.js'

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'muksingapp@gmail.com'
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperMuksing'
const SUPERADMIN_DISPLAY_NAME = process.env.SUPERADMIN_DISPLAY_NAME || 'Super Admin'

async function main() {
  const supabase = getSupabaseAdmin()

  let user = await findAuthUserByEmail(supabase, SUPERADMIN_EMAIL)
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { displayName: SUPERADMIN_DISPLAY_NAME },
    })
    if (error) throw error
    user = data.user
    console.log('Created Supabase auth user:', user.id)
  } else {
    console.log('SuperAdmin auth user already exists:', user.id)
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('users').upsert({
    id: user.id,
    uid: user.id,
    email: SUPERADMIN_EMAIL,
    displayName: SUPERADMIN_DISPLAY_NAME,
    display_name: SUPERADMIN_DISPLAY_NAME,
    firstName: 'Super',
    first_name: 'Super',
    lastName: 'Admin',
    last_name: 'Admin',
    globalRole: 'superadmin',
    global_role: 'superadmin',
    role: 'superadmin',
    roles: ['superadmin'],
    isActive: true,
    is_active: true,
    permissions: ['all'],
    createdAt: now,
    created_at: now,
    lastLoginAt: null,
    last_login: null,
  }, { onConflict: 'id' })
  if (error) throw error

  console.log('SuperAdmin setup complete.')
}

main().catch((error) => {
  console.error('Failed to create SuperAdmin:', error.message)
  process.exit(1)
})
