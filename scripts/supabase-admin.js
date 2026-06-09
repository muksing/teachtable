import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

let envLoaded = false

export function loadScriptEnv() {
  if (envLoaded) return
  envLoaded = true

  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

export function getSupabaseAdmin() {
  loadScriptEnv()
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL')
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function hasServiceRoleCredentials() {
  loadScriptEnv()
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getSupabaseScriptClient() {
  loadScriptEnv()
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL')
  }
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function findAuthUserByEmail(supabase, email) {
  let page = 1
  const perPage = 100

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) return null
    page += 1
  }
}

export async function upsertCompatDoc(supabase, path, data) {
  const parts = path.split('/').filter(Boolean)
  const id = parts[parts.length - 1]
  const parentPath = parts.slice(0, -1).join('/')
  const { error } = await supabase.from('firestore_documents').upsert({
    path,
    parent_path: parentPath,
    id,
    data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'path' })
  if (error) throw error
}

export async function getCompatDoc(supabase, path) {
  const { data, error } = await supabase
    .from('firestore_documents')
    .select('data')
    .eq('path', path)
    .maybeSingle()
  if (error) throw error
  return data?.data || null
}

export async function listCompatChildren(supabase, parentPath) {
  const { data, error } = await supabase
    .from('firestore_documents')
    .select('path,id,data')
    .eq('parent_path', parentPath)
  if (error) throw error
  return data || []
}
