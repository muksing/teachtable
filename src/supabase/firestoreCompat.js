import { supabase } from './client'

const TABLE = 'firestore_documents'

function cleanSegment(value) {
  return String(value ?? '').replace(/^\/+|\/+$/g, '')
}

function joinPath(...parts) {
  return parts.flatMap(p => String(p ?? '').split('/')).map(cleanSegment).filter(Boolean).join('/')
}

function parentPath(path) {
  const parts = cleanSegment(path).split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

function docId(path) {
  const parts = cleanSegment(path).split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

function randomId() {
  return (crypto?.randomUUID?.() || `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`)
}

function makeDocRef(path) {
  const normalized = cleanSegment(path)
  return {
    __type: 'doc',
    path: normalized,
    id: docId(normalized),
    firestore: db(),
  }
}

function makeCollectionRef(path) {
  return {
    __type: 'collection',
    path: cleanSegment(path),
    id: docId(path),
    firestore: db(),
  }
}

export function db() {
  return { __type: 'db', path: '' }
}

export function getFirestore() {
  return db()
}

export function collection(base, ...segments) {
  const basePath = typeof base === 'string' ? base : base?.path || ''
  return makeCollectionRef(joinPath(basePath, ...segments))
}

export function doc(base, ...segments) {
  if (base?.__type === 'collection' && segments.length === 0) {
    return makeDocRef(joinPath(base.path, randomId()))
  }
  const basePath = typeof base === 'string' ? base : base?.path || ''
  return makeDocRef(joinPath(basePath, ...segments))
}

export function serverTimestamp() {
  return new Date().toISOString()
}

export class Timestamp {
  static now() {
    return new Date().toISOString()
  }

  static fromDate(date) {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString()
  }
}

export class FieldPath {
  constructor(...segments) {
    this.segments = segments
  }
}

const DELETE_FIELD = Symbol('deleteField')

export function deleteField() {
  return DELETE_FIELD
}

function valueAt(data, field) {
  if (field instanceof FieldPath) {
    return field.segments.reduce((obj, key) => obj?.[key], data)
  }
  return String(field).split('.').reduce((obj, key) => obj?.[key], data)
}

function setValueAt(data, field, value) {
  const segments = field instanceof FieldPath ? field.segments : String(field).split('.')
  let cursor = data
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}
    cursor = cursor[key]
  }
  cursor[segments[segments.length - 1]] = value
}

function deleteValueAt(data, field) {
  const segments = field instanceof FieldPath ? field.segments : String(field).split('.')
  let cursor = data
  for (let i = 0; i < segments.length - 1; i += 1) {
    cursor = cursor?.[segments[i]]
    if (!cursor || typeof cursor !== 'object') return
  }
  delete cursor[segments[segments.length - 1]]
}

function matchesWhere(row, filter) {
  const actual = valueAt(row, filter.field)
  const expected = filter.value
  if (filter.op === '==') return actual === expected
  if (filter.op === '!=') return actual !== expected
  if (filter.op === 'in') return Array.isArray(expected) && expected.includes(actual)
  if (filter.op === 'array-contains') return Array.isArray(actual) && actual.includes(expected)
  if (filter.op === '>=') return actual >= expected
  if (filter.op === '<=') return actual <= expected
  if (filter.op === '>') return actual > expected
  if (filter.op === '<') return actual < expected
  return true
}

function applyQuery(rows, constraints = []) {
  let result = rows
  for (const c of constraints) {
    if (c.type === 'where') result = result.filter(row => matchesWhere(row.data, c))
  }
  for (const c of constraints) {
    if (c.type === 'orderBy') {
      const direction = c.direction === 'desc' ? -1 : 1
      result = [...result].sort((a, b) => {
        const av = valueAt(a.data, c.field)
        const bv = valueAt(b.data, c.field)
        if (av === bv) return 0
        return av > bv ? direction : -direction
      })
    }
  }
  const limiter = constraints.find(c => c.type === 'limit')
  if (limiter) result = result.slice(0, limiter.count)
  return result
}

function snapshotDoc(row, refPath = row?.path) {
  const data = row?.data || {}
  return {
    id: docId(refPath),
    ref: makeDocRef(refPath),
    exists: () => Boolean(row),
    data: () => ({ ...data }),
  }
}

function snapshotQuery(rows) {
  const docs = rows.map(row => ({
    id: row.id,
    ref: makeDocRef(row.path),
    data: () => ({ ...row.data }),
  }))
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb) => docs.forEach(cb),
  }
}

export function where(field, op, value) {
  return { type: 'where', field, op, value }
}

export function orderBy(field, direction = 'asc') {
  return { type: 'orderBy', field, direction }
}

export function limit(count) {
  return { type: 'limit', count }
}

export function query(ref, ...constraints) {
  return { ...ref, constraints }
}

export async function getDoc(ref) {
  const { data, error } = await supabase.from(TABLE).select('path,data').eq('path', ref.path).maybeSingle()
  if (error) throw error
  return snapshotDoc(data, ref.path)
}

export async function getDocs(ref) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('path,id,data')
    .eq('parent_path', ref.path)
  if (error) throw error
  return snapshotQuery(applyQuery(data || [], ref.constraints || []))
}

export async function setDoc(ref, value, options = {}) {
  let nextData = { ...(value || {}) }
  if (options.merge) {
    const existing = await getDoc(ref)
    nextData = { ...(existing.exists() ? existing.data() : {}), ...nextData }
  }
  const { error } = await supabase.from(TABLE).upsert({
    path: ref.path,
    parent_path: parentPath(ref.path),
    id: ref.id,
    data: nextData,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'path' })
  if (error) throw error
}

export async function addDoc(colRef, value) {
  const ref = doc(colRef)
  await setDoc(ref, value)
  return ref
}

export async function updateDoc(ref, ...args) {
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`Document does not exist: ${ref.path}`)
  const nextData = snap.data()
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !(args[0] instanceof FieldPath)) {
    for (const [field, value] of Object.entries(args[0])) {
      if (value === DELETE_FIELD) deleteValueAt(nextData, field)
      else setValueAt(nextData, field, value)
    }
  } else {
    for (let i = 0; i < args.length; i += 2) {
      if (args[i + 1] === DELETE_FIELD) deleteValueAt(nextData, args[i])
      else setValueAt(nextData, args[i], args[i + 1])
    }
  }
  await setDoc(ref, nextData)
}

export async function deleteDoc(ref) {
  const { error } = await supabase.from(TABLE).delete().eq('path', ref.path)
  if (error) throw error
}

export function writeBatch() {
  const ops = []
  return {
    set: (ref, value, options) => ops.push(() => setDoc(ref, value, options)),
    update: (ref, value) => ops.push(() => updateDoc(ref, value)),
    delete: (ref) => ops.push(() => deleteDoc(ref)),
    commit: async () => {
      for (const op of ops) await op()
    },
  }
}

export async function getCountFromServer(ref) {
  const snap = await getDocs(ref)
  return { data: () => ({ count: snap.size }) }
}

export function onSnapshot(ref, onData, onError) {
  let active = true
  const emit = async () => {
    try {
      if (!active) return
      const snap = ref.__type === 'doc' ? await getDoc(ref) : await getDocs(ref)
      if (active) onData(snap)
    } catch (error) {
      onError?.(error)
    }
  }
  emit()
  const channel = supabase
    .channel(`firestore-compat:${ref.path}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, emit)
    .subscribe()
  return () => {
    active = false
    supabase.removeChannel(channel)
  }
}
