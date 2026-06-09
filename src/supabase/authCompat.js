import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseKey, supabaseUrl } from './client'

const authStates = new Map()

function createAuthError(code, message, original) {
  const error = new Error(message)
  error.code = code
  error.cause = original
  return error
}

function mapAuthError(error) {
  if (!error) return null

  const message = String(error.message || '').toLowerCase()
  const code = String(error.code || error.status || '')

  if (message.includes('already registered') || message.includes('already been registered') || code === 'user_already_exists') {
    return createAuthError('auth/email-already-in-use', 'Email already in use', error)
  }
  if (message.includes('password should be at least') || message.includes('weak password')) {
    return createAuthError('auth/weak-password', 'Password is too weak', error)
  }
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return createAuthError('auth/invalid-credential', 'Invalid credentials', error)
  }
  if (message.includes('email not confirmed')) {
    return createAuthError('auth/email-not-verified', 'Email is not verified', error)
  }
  if (message.includes('invalid email')) {
    return createAuthError('auth/invalid-email', 'Invalid email', error)
  }

  const fallback = new Error(error.message || 'Authentication failed')
  fallback.code = error.code || 'auth/unknown'
  fallback.cause = error
  return fallback
}

function createIsolatedClient(name) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: `teachtable-auth-${name}`,
    },
  })
}

function normalizeUser(user, auth) {
  if (!user) return null

  const displayName =
    user.user_metadata?.displayName ||
    user.user_metadata?.display_name ||
    user.email?.split('@')?.[0] ||
    ''

  return {
    ...user,
    uid: user.id,
    displayName,
    __auth: auth,
  }
}

function ensureAuthState(name = '[DEFAULT]') {
  if (authStates.has(name)) return authStates.get(name)

  const client = name === '[DEFAULT]' ? supabase : createIsolatedClient(name)
  const state = {
    name,
    client,
    currentUser: null,
    auth: null,
  }

  state.auth = {
    __name: name,
    __client: client,
    get currentUser() {
      return normalizeUser(state.currentUser, state.auth)
    },
  }

  client.auth.getSession()
    .then(({ data }) => {
      state.currentUser = data.session?.user || null
    })
    .catch(() => {
      state.currentUser = null
    })

  client.auth.onAuthStateChange((_event, session) => {
    state.currentUser = session?.user || null
  })

  authStates.set(name, state)
  return state
}

function resolveAuthName(appOrAuth) {
  if (!appOrAuth) return '[DEFAULT]'
  if (appOrAuth.__name) return appOrAuth.__name
  if (typeof appOrAuth.name === 'string' && appOrAuth.name) return appOrAuth.name
  return '[DEFAULT]'
}

function resolveAuthState(appOrAuth) {
  return ensureAuthState(resolveAuthName(appOrAuth))
}

export function getAuth(app) {
  return resolveAuthState(app).auth
}

export const EmailAuthProvider = {
  credential(email, password) {
    return { email, password }
  },
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  const state = resolveAuthState(auth)
  const { data, error } = await state.client.auth.signUp({ email, password })
  if (error) throw mapAuthError(error)
  state.currentUser = data.user || null
  return { user: normalizeUser(data.user, state.auth) }
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const state = resolveAuthState(auth)
  const { data, error } = await state.client.auth.signInWithPassword({ email, password })
  if (error) throw mapAuthError(error)
  state.currentUser = data.user || null
  return { user: normalizeUser(data.user, state.auth) }
}

export async function sendPasswordResetEmail(auth, email) {
  const state = resolveAuthState(auth)
  const { error } = await state.client.auth.resetPasswordForEmail(email)
  if (error) throw mapAuthError(error)
}

export async function signOut(auth) {
  const state = resolveAuthState(auth)
  const { error } = await state.client.auth.signOut()
  if (error) throw mapAuthError(error)
  state.currentUser = null
}

export async function reauthenticateWithCredential(user, credential) {
  const state = resolveAuthState(user?.__auth)
  const { data, error } = await state.client.auth.signInWithPassword(credential)
  if (error) throw mapAuthError(error)
  state.currentUser = data.user || null
  return data
}

export async function updatePassword(user, password) {
  const state = resolveAuthState(user?.__auth)
  const { data, error } = await state.client.auth.updateUser({ password })
  if (error) throw mapAuthError(error)
  if (data.user) state.currentUser = data.user
  return data
}
