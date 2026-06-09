// src/utils/atomicWrite.js
// Migrated to native Supabase — no Firestore compat imports
import { supabase } from '@/supabase/client'

/**
 * Execute a list of table-level operations atomically using Supabase RPC
 * (or sequentially if no RPC is available).
 *
 * Each operation has the shape:
 *   { type: 'set'|'insert'|'update'|'delete', table: string, id?: string, data?: object, match?: object }
 *
 * For backward compat with the old Firestore batch API:
 *   { type: 'set',    path: 'terms/2568_1/behavior_summary', id: studentId, data: {...}, merge: true }
 *   { type: 'update', path: '...', id: '...', data: {...} }
 *   { type: 'delete', path: '...', id: '...' }
 *
 * NOTE: Supabase doesn't support true multi-table transactions from the client
 * without a stored procedure. Operations are executed sequentially here.
 * For transactional safety, move critical multi-table writes to a Supabase
 * Edge Function or PostgreSQL stored procedure.
 */
export async function batchWrite(operations) {
  for (const op of operations) {
    // Support both new (table) and legacy (path) shape
    const table = op.table || extractTableFromPath(op.path)
    if (!table) {
      console.warn('batchWrite: no table/path for operation', op)
      continue
    }

    if (op.type === 'set' || op.type === 'upsert') {
      const { error } = await supabase.from(table).upsert([{ ...op.data, ...(op.id ? { id: op.id } : {}) }])
      if (error) throw error
    } else if (op.type === 'insert') {
      const { error } = await supabase.from(table).insert([op.data])
      if (error) throw error
    } else if (op.type === 'update') {
      const match = op.match || (op.id ? { id: op.id } : null)
      if (!match) throw new Error(`batchWrite update: no match for table ${table}`)
      let q = supabase.from(table).update(op.data)
      for (const [col, val] of Object.entries(match)) {
        q = q.eq(col, val)
      }
      const { error } = await q
      if (error) throw error
    } else if (op.type === 'delete') {
      const match = op.match || (op.id ? { id: op.id } : null)
      if (!match) throw new Error(`batchWrite delete: no match for table ${table}`)
      let q = supabase.from(table).delete()
      for (const [col, val] of Object.entries(match)) {
        q = q.eq(col, val)
      }
      const { error } = await q
      if (error) throw error
    }
  }
}

/**
 * Extract a Supabase table name from a legacy Firestore path.
 * e.g. "terms/2568_1/behavior_summary" → "behavior_summary"
 *      "terms/2568_1/teach_actual"     → "teach_actuals"
 */
function extractTableFromPath(path) {
  if (!path) return null
  const LEGACY_MAP = {
    behavior_summary: 'students',         // scores are on the students row
    behavior_logs: 'behavior_logs',
    teach_actual: 'teach_actuals',
    timetable_grid: 'timetable_slots',
    teaching_assignments: 'timetable_slots',
    leave_requests: 'leave_requests',
    attendance_daily_class: null,         // stored in schools.settings
    attendance_status_settings: null,     // stored in schools.settings
    behavior_settings: null,              // stored in schools.settings
  }
  const parts = path.split('/')
  const last = parts[parts.length - 1]
  return LEGACY_MAP[last] !== undefined ? LEGACY_MAP[last] : last
}

/**
 * Build a behavior summary update operation.
 * In the Supabase model, behavior scores live on the `students` row.
 * This returns an operation object compatible with batchWrite above.
 */
export function buildBehaviorSummaryOp(term, studentId, type, scoreDelta, currentSummary) {
  const typeKey = `${type}_score`
  const newTotal = (currentSummary.total_score || 0) + scoreDelta
  const newTypeScore = (currentSummary[typeKey] || 0) + scoreDelta

  // Map legacy score keys to student columns
  const SCORE_COLUMN_MAP = {
    attendance_score: 'attendance_behavior_score',
    learning_score: 'learning_behavior_score',
    general_score: null, // general = total - attendance - learning; update total only
  }

  const updateData = {
    total_behavior_score: newTotal,
  }
  const col = SCORE_COLUMN_MAP[typeKey]
  if (col) updateData[col] = newTypeScore

  return {
    type: 'update',
    table: 'students',
    match: { id: studentId },
    data: updateData,
  }
}
