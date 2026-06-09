// src/composables/cascadeService.js
// Migrated to native Supabase — no Firestore compat imports
import { supabase } from '@/supabase/client'

/**
 * Cascade service: when a subject or teacher code/name changes, update all
 * related Supabase rows across timetable_slots and teach_actuals.
 *
 * NOTE: Unlike the old Firestore version, we cannot use doc references.
 * We run targeted UPDATE queries per table. For large datasets this may be
 * multiple round trips; consider wrapping in a Supabase Edge Function for
 * strict atomicity.
 */

export const cascadeService = {
  /**
   * When a subject is renamed/re-coded:
   * - Update timetable_slots.subject_id
   * - Update teach_actuals.subject_id
   *
   * @param {string} termId    - term string like '2568_1'
   * @param {string} oldId     - old subject_code (used as subject_id in slots)
   * @param {object} oldData   - { subject_code, name }
   * @param {object} newData   - { subject_code, name }
   */
  async updateSubject(termId, oldId, oldData, newData) {
    const newCode = newData.subject_code || newData.subject_id
    const oldCode = oldData.subject_code || oldData.subject_id || oldId
    const isCodeChanged = oldCode !== newCode
    const isNameChanged = (newData.name || newData.subject_name) !== (oldData.name || oldData.subject_name)

    if (!isCodeChanged && !isNameChanged) return true

    // Check for duplicate subject_code in subjects table (same school)
    if (isCodeChanged) {
      const { data: existing } = await supabase
        .from('subjects')
        .select('id')
        .eq('subject_code', newCode)
        .maybeSingle()
      if (existing) {
        throw new Error(`รหัสวิชา "${newCode}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`)
      }
    }

    // 1. Update subjects table
    const subjectUpdates = {}
    if (isCodeChanged) subjectUpdates.subject_code = newCode
    if (isNameChanged) subjectUpdates.name = newData.name || newData.subject_name

    if (Object.keys(subjectUpdates).length > 0) {
      const { error } = await supabase
        .from('subjects')
        .update(subjectUpdates)
        .eq('subject_code', oldCode)
      if (error) throw error
    }

    // 2. Update timetable_slots.subject_id
    if (isCodeChanged) {
      const { error } = await supabase
        .from('timetable_slots')
        .update({ subject_id: newCode })
        .eq('term_id', termId)
        .eq('subject_id', oldCode)
      if (error) throw error
    }

    // 3. Update teach_actuals.subject_id
    if (isCodeChanged) {
      const { error } = await supabase
        .from('teach_actuals')
        .update({ subject_id: newCode })
        .eq('term_id', termId)
        .eq('subject_id', oldCode)
      if (error) throw error
    }

    return true
  },

  /**
   * When a teacher is renamed/re-coded:
   * - Update timetable_slots.teacher_id
   * - Update teach_actuals.planned_teacher_id and actual_teacher_id
   *
   * @param {string} termId    - term string like '2568_1'
   * @param {string} oldId     - old teacher_code
   * @param {object} oldData   - { teacher_id, prefix, name/firstName, surname/lastName }
   * @param {object} newData   - { teacher_id, prefix, name/firstName, surname/lastName }
   */
  async updateTeacher(termId, oldId, oldData, newData) {
    const newTeacherId = newData.teacher_id || newData.teacherId || newData.id
    const oldTeacherId = oldData.teacher_id || oldData.teacherId || oldData.id || oldId
    const isIdChanged = oldTeacherId !== newTeacherId

    const newFullName = `${newData.prefix || ''}${newData.firstName || newData.name || ''} ${newData.lastName || newData.surname || ''}`.trim()
    const oldFullName = `${oldData.prefix || ''}${oldData.firstName || oldData.name || ''} ${oldData.lastName || oldData.surname || ''}`.trim()
    const isNameChanged = newFullName !== oldFullName

    if (!isIdChanged && !isNameChanged) return true

    // Check for duplicate teacher_code
    if (isIdChanged) {
      const { data: existing } = await supabase
        .from('teachers')
        .select('id')
        .eq('teacher_code', newTeacherId)
        .maybeSingle()
      if (existing) {
        throw new Error(`รหัสครู "${newTeacherId}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`)
      }
    }

    // 1. Update teachers table
    const teacherUpdates = {}
    if (isIdChanged) teacherUpdates.teacher_code = newTeacherId
    if (isNameChanged) {
      teacherUpdates.first_name = newData.firstName || newData.name || oldData.first_name || ''
      teacherUpdates.last_name = newData.lastName || newData.surname || oldData.last_name || ''
      if (newData.prefix) teacherUpdates.prefix = newData.prefix
    }
    if (Object.keys(teacherUpdates).length > 0) {
      const { error } = await supabase
        .from('teachers')
        .update(teacherUpdates)
        .eq('teacher_code', oldTeacherId)
      if (error) throw error
    }

    // 2. Update timetable_slots.teacher_id
    if (isIdChanged) {
      const { error } = await supabase
        .from('timetable_slots')
        .update({ teacher_id: newTeacherId })
        .eq('term_id', termId)
        .eq('teacher_id', oldTeacherId)
      if (error) throw error
    }

    // 3. Update teach_actuals.planned_teacher_id
    if (isIdChanged) {
      const { error } = await supabase
        .from('teach_actuals')
        .update({ planned_teacher_id: newTeacherId })
        .eq('term_id', termId)
        .eq('planned_teacher_id', oldTeacherId)
      if (error) throw error
    }

    // 4. Update teach_actuals.actual_teacher_id (substitute teacher field)
    if (isIdChanged) {
      const { error } = await supabase
        .from('teach_actuals')
        .update({ actual_teacher_id: newTeacherId })
        .eq('term_id', termId)
        .eq('actual_teacher_id', oldTeacherId)
      if (error) throw error
    }

    // 5. Update leave_requests.teacher_id
    if (isIdChanged) {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          teacher_id: newTeacherId,
          ...(isNameChanged ? { teacher_name: newFullName } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('term_id', termId)
        .eq('teacher_id', oldTeacherId)
      if (error) throw error
    } else if (isNameChanged) {
      const { error } = await supabase
        .from('leave_requests')
        .update({ teacher_name: newFullName, updated_at: new Date().toISOString() })
        .eq('term_id', termId)
        .eq('teacher_id', oldTeacherId)
      if (error) throw error
    }

    // 6. Update classes.homeroom_teacher_id
    if (isIdChanged) {
      const { error } = await supabase
        .from('classes')
        .update({ homeroom_teacher_id: newTeacherId })
        .eq('homeroom_teacher_id', oldTeacherId)
      if (error) throw error
    }

    return true
  },
}
