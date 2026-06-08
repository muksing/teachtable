// src/utils/atomicWrite.js
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'

/**
 * Batch Write สำหรับ School DB
 * แทน multi-path update ของ Realtime DB
 */
export async function batchWrite(operations) {
  const db = getSchoolDb()
  const batch = writeBatch(db)
  operations.forEach(op => {
    if (op.type === 'set')    batch.set(doc(db, op.path, op.id), op.data, { merge: op.merge || false })
    if (op.type === 'update') batch.update(doc(db, op.path, op.id), op.data)
    if (op.type === 'delete') batch.delete(doc(db, op.path, op.id))
  })
  await batch.commit()
}

export function buildBehaviorSummaryOp(term, studentId, type, scoreDelta, currentSummary) {
  const typeKey = `${type}_score`
  return {
    type: 'set',
    path: `terms/${term}/behavior_summary`,
    id: studentId,
    merge: true,
    data: {
      total_score: (currentSummary.total_score || 0) + scoreDelta,
      [typeKey]: (currentSummary[typeKey] || 0) + scoreDelta,
      last_updated: serverTimestamp()
    }
  }
}
