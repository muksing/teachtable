import { collection, doc, query, where, getDocs, writeBatch, getDoc } from 'firebase/firestore'
import { db, getSchoolDb } from '@/firebase/db'

async function commitInChunks(dbInstance, operations) {
  const CHUNK_SIZE = 400
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(dbInstance)
    chunk.forEach(op => {
      if (op.type === 'set') batch.set(op.ref, op.data)
      else if (op.type === 'update') batch.update(op.ref, op.data)
      else if (op.type === 'delete') batch.delete(op.ref)
    })
    await batch.commit()
  }
}

export const cascadeService = {
  async updateSubject(termId, oldId, oldData, newData) {
    const schoolDb = getSchoolDb()
    const termRef = doc(schoolDb, 'terms', termId)
    const subjectsRef = collection(termRef, 'subjects')
    const timetableRef = collection(termRef, 'timetable')
    const timetableGridRef = collection(termRef, 'timetable_grid')
    const assignmentsRef = collection(termRef, 'teaching_assignments')
    const teachActualRef = collection(termRef, 'teach_actual')

    const ops = []
    
    const newCode = newData.subject_code || newData.subject_id
    const oldCode = oldData.subject_code || oldData.subject_id
    const isIdChanged = oldId !== newCode
    const isCodeChanged = oldCode !== newCode

    if (isIdChanged || isCodeChanged) {
      const newDocRef = doc(subjectsRef, newCode)
      const newDocSnap = await getDoc(newDocRef)
      if (newDocSnap.exists()) {
        throw new Error(`รหัสวิชา "${newCode}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`)
      }
    }

    if (isIdChanged) {
      const newDocRef = doc(subjectsRef, newCode)
      ops.push({ type: 'set', ref: newDocRef, data: newData })
      const oldDocRef = doc(subjectsRef, oldId)
      ops.push({ type: 'delete', ref: oldDocRef })
    } else {
      const subjectRef = doc(subjectsRef, oldId)
      ops.push({ type: 'update', ref: subjectRef, data: newData })
    }

    const updateSlots = async (collectionRef) => {
      const q = query(collectionRef, where('subject_code', '==', oldCode))
      const snap = await getDocs(q)
      snap.forEach(docSnap => {
        const updates = {}
        if (isCodeChanged) updates.subject_code = newCode
        if (newData.subject_name && newData.subject_name !== oldData.subject_name) {
          updates.subject_name = newData.subject_name
        }
        if (Object.keys(updates).length > 0) ops.push({ type: 'update', ref: docSnap.ref, data: updates })
      })
    }
    
    await updateSlots(timetableRef)
    await updateSlots(timetableGridRef)

    const assignQuery = query(assignmentsRef, where('subject_code', '==', oldCode))
    const assignSnap = await getDocs(assignQuery)
    assignSnap.forEach(assignDoc => {
      const updates = {}
      if (isCodeChanged) updates.subject_code = newCode
      if (newData.subject_name && newData.subject_name !== oldData.subject_name) {
        updates.subject_name = newData.subject_name
      }
      if (Object.keys(updates).length > 0) ops.push({ type: 'update', ref: assignDoc.ref, data: updates })
    })

    if (isIdChanged || isCodeChanged || (newData.subject_name && newData.subject_name !== oldData.subject_name)) {
      // อัปเดตตารางสอนจริง (teacher_plan)
      const taPlanQuery = query(teachActualRef, where('subject_plan_id', '==', oldCode))
      const taPlanSnap = await getDocs(taPlanQuery)
      taPlanSnap.forEach(taDoc => {
        const updates = {}
        if (isCodeChanged) updates.subject_plan_id = newCode
        if (newData.subject_name && newData.subject_name !== oldData.subject_name) {
          updates.subject_name = newData.subject_name
        }
        if (Object.keys(updates).length > 0) ops.push({ type: 'update', ref: taDoc.ref, data: updates })
      })

      // อัปเดตตารางสอนจริง (teacher_actual)
      if (isCodeChanged) {
        const taActQuery = query(teachActualRef, where('subject_actual_id', '==', oldCode))
        const taActSnap = await getDocs(taActQuery)
        taActSnap.forEach(taDoc => {
          ops.push({ type: 'update', ref: taDoc.ref, data: { subject_actual_id: newCode } })
        })
      }
    }

    await commitInChunks(db, ops)
    return true
  },

  async updateTeacher(termId, oldId, oldData, newData) {
    const schoolDb = getSchoolDb()
    const termRef = doc(schoolDb, 'terms', termId)
    const teachersRef = collection(termRef, 'teachers')
    const timetableRef = collection(termRef, 'timetable')
    const timetableGridRef = collection(termRef, 'timetable_grid')
    const assignmentsRef = collection(termRef, 'teaching_assignments')
    const teachActualRef = collection(termRef, 'teach_actual')
    const supervisionRef = collection(termRef, 'activity_supervision')

    const ops = []

    const newId = newData.teacher_id || newData.teacherId || newData.id
    const oldTeacherId = oldData.teacher_id || oldData.teacherId || oldData.id
    const isIdChanged = oldId !== newId
    
    const newFullName = `${newData.prefix || ''}${newData.firstName || newData.name || ''} ${newData.lastName || newData.surname || ''}`.trim()
    const oldFullName = `${oldData.prefix || ''}${oldData.firstName || oldData.name || ''} ${oldData.lastName || oldData.surname || ''}`.trim()
    const isNameChanged = newFullName !== oldFullName

    if (isIdChanged) {
      const newDocRef = doc(teachersRef, newId)
      const newDocSnap = await getDoc(newDocRef)
      if (newDocSnap.exists()) {
        throw new Error(`รหัสครู "${newId}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`)
      }
    }

    if (isIdChanged) {
      const newDocRef = doc(teachersRef, newId)
      ops.push({ type: 'set', ref: newDocRef, data: newData })
      const oldDocRef = doc(teachersRef, oldId)
      ops.push({ type: 'delete', ref: oldDocRef })
    } else {
      const teacherRef = doc(teachersRef, oldId)
      ops.push({ type: 'update', ref: teacherRef, data: newData })
    }

    if (isIdChanged || isNameChanged) {
      const updateTeacherSlots = async (collectionRef) => {
        const q = query(collectionRef, where('teacher_id', '==', oldTeacherId))
        const snap = await getDocs(q)
        snap.forEach(docSnap => {
          const updates = {}
          if (isIdChanged) updates.teacher_id = newId
          if (isNameChanged) updates.teacher_name = newFullName
          ops.push({ type: 'update', ref: docSnap.ref, data: updates })
        })
      }
      
      await updateTeacherSlots(timetableRef)
      await updateTeacherSlots(timetableGridRef)
      await updateTeacherSlots(supervisionRef)

      const assignQuery = query(assignmentsRef, where('teacher_id', '==', oldTeacherId))
      const assignSnap = await getDocs(assignQuery)
      assignSnap.forEach(assignDoc => {
        const updates = {}
        if (isIdChanged) updates.teacher_id = newId
        if (isNameChanged) updates.teacher_name = newFullName
        ops.push({ type: 'update', ref: assignDoc.ref, data: updates })
      })

      // อัปเดตตารางสอนจริง (teacher_plan)
      const taPlanQuery = query(teachActualRef, where('teacher_plan_id', '==', oldTeacherId))
      const taPlanSnap = await getDocs(taPlanQuery)
      taPlanSnap.forEach(taDoc => {
        const updates = {}
        if (isIdChanged) updates.teacher_plan_id = newId
        if (isNameChanged) updates.teacher_plan_name = newFullName
        ops.push({ type: 'update', ref: taDoc.ref, data: updates })
      })

      // อัปเดตตารางสอนจริงสำหรับครูสอนแทน (subject_actual_teacher_id)
      const taSubQuery = query(teachActualRef, where('subject_actual_teacher_id', '==', oldTeacherId))
      const taSubSnap = await getDocs(taSubQuery)
      taSubSnap.forEach(taDoc => {
        const updates = {}
        if (isIdChanged) updates.subject_actual_teacher_id = newId
        if (isNameChanged) updates.sub_teacher_name = newFullName
        ops.push({ type: 'update', ref: taDoc.ref, data: updates })
      })
    }

    if (isIdChanged) {
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('schoolId', '==', schoolDb.id), where('teacherId', '==', oldTeacherId))
      const userSnap = await getDocs(q)
      userSnap.forEach(userDoc => {
        ops.push({ type: 'update', ref: userDoc.ref, data: { teacherId: newId, teacher_id: newId } })
      })
    }

    await commitInChunks(db, ops)
    return true
  }
}