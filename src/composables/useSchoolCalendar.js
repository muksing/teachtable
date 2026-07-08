// ปฏิทินกลาง — รวมเหตุการณ์จากหลายแหล่งข้อมูลที่มีอยู่แล้ว (ไม่ก็อปข้อมูลมาเก็บซ้ำ)
// อ่านสดจากต้นทางทุกครั้ง: วันหยุด (teaching_log_settings), วันชดเชย (makeup_days),
// วันสอบ (exams), และเหตุการณ์กำหนดเอง (school_events)
import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

const EVENT_TYPE_META = {
  holiday:   { label: 'วันหยุด',      color: '#ef4444', icon: '🔴' },
  makeup:    { label: 'วันเรียนชดเชย', color: '#f59e0b', icon: '🟠' },
  exam:      { label: 'สอบ',          color: '#7c3aed', icon: '📝' },
  meeting:   { label: 'ประชุม',        color: '#0ea5e9', icon: '🗓️' },
  activity:  { label: 'กิจกรรม',       color: '#10b981', icon: '🎯' },
  important: { label: 'วันสำคัญ',      color: '#db2777', icon: '⭐' },
  other:     { label: 'อื่น ๆ',        color: '#6b7280', icon: '📌' },
}

export function useSchoolCalendar() {
  const authStore = useAuthStore()
  const events = ref([])
  const loading = ref(false)

  function typeMeta(type) {
    return EVENT_TYPE_META[type] || EVENT_TYPE_META.other
  }

  async function loadEvents(fromDate, toDate) {
    const schoolId = authStore.schoolId
    if (!schoolId) return
    loading.value = true
    try {
      const results = []

      // 1. เหตุการณ์กำหนดเอง (school_events)
      const { data: customEvents } = await supabase
        .from('school_events')
        .select('*')
        .eq('school_id', schoolId)
        .gte('event_date', fromDate)
        .lte('event_date', toDate)
      for (const e of (customEvents || [])) {
        results.push({
          id: `event_${e.id}`,
          raw_id: e.id,
          date: e.event_date,
          end_date: e.end_date,
          title: e.title,
          description: e.description,
          type: e.event_type,
          source: 'school_events',
          editable: true,
        })
      }

      // 2. วันหยุด (schools.settings.teaching_log_settings.holidays)
      const { data: schoolRow } = await supabase
        .from('schools').select('settings').eq('id', schoolId).maybeSingle()
      const holidays = schoolRow?.settings?.teaching_log_settings?.holidays || []
      for (const h of holidays) {
        const date = typeof h === 'string' ? h : h?.date
        if (!date || date < fromDate || date > toDate) continue
        results.push({
          id: `holiday_${date}`,
          date,
          title: (typeof h === 'object' && h.name) ? h.name : 'วันหยุด',
          type: 'holiday',
          source: 'holidays',
          editable: false,
        })
      }

      // 3. วันเรียนชดเชย (makeup_days)
      const { data: makeupDays } = await supabase
        .from('makeup_days')
        .select('makeup_date, reason')
        .eq('school_id', schoolId)
        .gte('makeup_date', fromDate)
        .lte('makeup_date', toDate)
      for (const m of (makeupDays || [])) {
        results.push({
          id: `makeup_${m.makeup_date}`,
          date: m.makeup_date,
          title: m.reason ? `เรียนชดเชย: ${m.reason}` : 'วันเรียนชดเชย',
          type: 'makeup',
          source: 'makeup_days',
          editable: false,
        })
      }

      // 4. วันสอบ (exams)
      const { data: exams } = await supabase
        .from('exams')
        .select('id, title, subject_name, exam_date, start_time, end_time')
        .eq('school_id', schoolId)
        .gte('exam_date', fromDate)
        .lte('exam_date', toDate)
      for (const ex of (exams || [])) {
        results.push({
          id: `exam_${ex.id}`,
          date: ex.exam_date,
          title: `${ex.title || 'สอบ'}${ex.subject_name ? ' — ' + ex.subject_name : ''}`,
          description: ex.start_time && ex.end_time ? `${ex.start_time}–${ex.end_time}` : '',
          type: 'exam',
          source: 'exams',
          editable: false,
        })
      }

      results.sort((a, b) => a.date.localeCompare(b.date))
      events.value = results
    } finally {
      loading.value = false
    }
  }

  async function createEvent({ title, description, eventDate, endDate, eventType, targetAudience }) {
    const schoolId = authStore.schoolId
    const { error } = await supabase.from('school_events').insert({
      school_id: schoolId,
      title,
      description: description || '',
      event_date: eventDate,
      end_date: endDate || null,
      event_type: eventType || 'other',
      target_audience: targetAudience?.length ? targetAudience : ['all'],
      created_by: authStore.profile?.uid || null,
      created_by_name: authStore.profile?.displayName || authStore.profile?.email || '',
    })
    if (error) throw error
  }

  async function updateEvent(id, patch) {
    const { error } = await supabase.from('school_events')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async function deleteEvent(id) {
    const { error } = await supabase.from('school_events').delete().eq('id', id)
    if (error) throw error
  }

  return { events, loading, loadEvents, createEvent, updateEvent, deleteEvent, typeMeta, EVENT_TYPE_META }
}
