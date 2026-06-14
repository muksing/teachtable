<template>
  <AppLayout>
    <div class="pl-page">

      <!-- ── Title ── -->
      <div class="pl-title-bar">
        <div>
          <h1 class="pl-title">📨 จดหมายแจ้งคะแนนและเวลาเรียน</h1>
          <p class="pl-sub">สรุปคะแนน · เวลาเรียน · พฤติกรรม แยกกลุ่มเสี่ยง/ปกติ</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <el-button plain @click="printAll">🖨️ พิมพ์ทั้งห้อง</el-button>
          <el-button plain @click="printSelected" :disabled="!checkedIds.size">
            🖨️ พิมพ์ที่เลือก ({{ checkedIds.size }})
          </el-button>
        </div>
      </div>

      <!-- ── Filters ── -->
      <el-card shadow="never" class="mb-4" style="border-radius:14px">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">🏫 ห้องเรียน</div>
            <el-select v-model="selectedClass" placeholder="เลือกห้อง"
              filterable style="min-width:180px" @change="loadData">
              <el-option v-for="c in availableClasses" :key="c.class_id"
                :label="c.class_name || c.class_id" :value="c.class_id" />
            </el-select>
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">👥 กลุ่ม</div>
            <el-select v-model="filterGroup" style="width:140px">
              <el-option label="ทั้งหมด" value="" />
              <el-option label="กลุ่มเสี่ยง" value="risk" />
              <el-option label="กลุ่มปกติ" value="normal" />
            </el-select>
          </div>
          <el-button type="primary" :loading="loading" :disabled="!selectedClass" @click="loadData">
            🔍 โหลดข้อมูล
          </el-button>
        </div>
      </el-card>

      <!-- ── Summary badges ── -->
      <div v-if="rows.length" class="pl-summary">
        <div class="pl-badge pl-badge-total">นักเรียนทั้งหมด {{ rows.length }} คน</div>
        <div class="pl-badge pl-badge-risk">กลุ่มเสี่ยง {{ riskCount }} คน</div>
        <div class="pl-badge pl-badge-normal">กลุ่มปกติ {{ rows.length - riskCount }} คน</div>
      </div>

      <!-- ── Student list ── -->
      <el-card v-if="rows.length" shadow="never" style="border-radius:14px">
        <el-table :data="filteredRows" stripe size="small" style="width:100%"
          @selection-change="onSelectionChange">
          <el-table-column type="selection" width="44" />
          <el-table-column label="ที่" width="46" align="center">
            <template #default="{ row }">{{ row.seat }}</template>
          </el-table-column>
          <el-table-column label="รหัส" width="90" align="center" prop="student_id" />
          <el-table-column label="ชื่อ–สกุล" min-width="160">
            <template #default="{ row }">{{ row.prefix }}{{ row.name }} {{ row.surname }}</template>
          </el-table-column>
          <el-table-column label="คะแนนเฉลี่ย%" width="115" align="center">
            <template #default="{ row }">
              <el-tag :type="row.score_pct < targets.min_score_pct ? 'danger' : 'success'" size="small">
                {{ row.score_pct }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="เวลาเรียน%" width="105" align="center">
            <template #default="{ row }">
              <el-tag :type="row.attend_pct < targets.min_attendance_pct ? 'danger' : 'success'" size="small">
                {{ row.attend_pct }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="พฤติกรรม" width="95" align="center">
            <template #default="{ row }">
              <el-tag :type="row.behavior_score < targets.min_behavior_score ? 'danger' : 'success'" size="small">
                {{ row.behavior_score }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="กลุ่ม" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isRisk ? 'danger' : 'success'" size="small" effect="dark">
                {{ row.isRisk ? '🔴 เสี่ยง' : '✅ ปกติ' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="LINE ID" width="120" align="center">
            <template #default="{ row }">
              <span class="text-xs text-gray-500">{{ row.line_id || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ดำเนินการ" width="160" align="center">
            <template #default="{ row }">
              <div class="flex gap-1 justify-center">
                <el-button size="small" plain @click="printOne(row)">🖨️</el-button>
                <el-button size="small" plain @click="copyMsg(row)" title="คัดลอกข้อความ LINE">📋</el-button>
                <a v-if="row.line_id" :href="`line://ti/p/~${row.line_id}`" target="_blank">
                  <el-button size="small" plain>LINE</el-button>
                </a>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-empty v-else-if="!loading && selectedClass" description="ไม่พบข้อมูล กรุณากดโหลดข้อมูล" />

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetableSource } from '@/composables/useTimetableSource'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const schoolId    = computed(() => authStore.schoolId)
const termId      = computed(() => schoolStore.currentTerm || '')
const isAdmin     = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))
const { slotTable } = useTimetableSource()

const loading       = ref(false)
const selectedClass = ref('')
const filterGroup   = ref('')
const rows          = ref([])
const checkedIds    = ref(new Set())
const targets       = reactive({ min_score_pct: 50, min_attendance_pct: 80, min_behavior_score: 0 })
const messages      = reactive({ normal_body: '', risk_body: '', meeting_date: '', meeting_time: '', meeting_place: '', closing: 'ขอแสดงความนับถือ', signer_name: '', signer_position: 'ผู้อำนวยการโรงเรียน' })
const scoreSettings = reactive({ num_units: 8, max_scores: [20,20,20,20,20,20,20,20], pass_pct: 50 })
const availableClasses = ref([])

const riskCount   = computed(() => rows.value.filter(r => r.isRisk).length)
const filteredRows = computed(() => {
  if (!filterGroup.value) return rows.value
  return rows.value.filter(r => filterGroup.value === 'risk' ? r.isRisk : !r.isRisk)
})

const schoolInfo = computed(() => schoolStore.schoolInfo || {})
const schoolName = computed(() => schoolInfo.value?.settings?.name || schoolInfo.value?.name || 'โรงเรียน')
const schoolLogo = computed(() => schoolInfo.value?.settings?.logo_url || schoolInfo.value?.logo_url || '')
const termLabel  = computed(() => schoolStore.termLabel || termId.value)

function onSelectionChange(selection) {
  checkedIds.value = new Set(selection.map(r => r.student_id))
}

async function loadSettings() {
  const { data } = await supabase.from('schools').select('settings').eq('id', schoolId.value).maybeSingle()
  const s = data?.settings || {}
  if (s.notification_targets)  Object.assign(targets, s.notification_targets)
  if (s.notification_messages) Object.assign(messages, s.notification_messages)
  if (s.score_settings)        Object.assign(scoreSettings, s.score_settings)
}

async function loadClasses() {
  // ทุก role เห็นทุกห้อง — ครูไม่จำกัดแค่ห้องที่ปรึกษา
  const { data } = await supabase.from('classes').select('class_name').eq('school_id', schoolId.value).order('class_name')
  availableClasses.value = (data || []).map(c => ({ class_id: c.class_name, class_name: c.class_name }))
  if (availableClasses.value.length === 1) selectedClass.value = availableClasses.value[0].class_id
}

async function loadData() {
  if (!selectedClass.value) return
  loading.value = true
  try {
    const classId = selectedClass.value
    const totalMax = scoreSettings.max_scores.slice(0, scoreSettings.num_units).reduce((a, b) => a + b, 0)

    // Load all data in parallel
    const [
      { data: stuData },
      { data: scoreData },
      { data: taData },
      { data: slotData },
    ] = await Promise.all([
      supabase.from('students').select('*')
        .eq('school_id', schoolId.value).eq('class_id', classId),
      supabase.from('score_records').select('student_id, subject_code, scores')
        .eq('school_id', schoolId.value).eq('term_id', termId.value).eq('class_id', classId),
      supabase.from('teach_actuals').select('student_records, is_filled')
        .eq('school_id', schoolId.value).eq('term_id', termId.value)
        .eq('class_id', classId).eq('is_filled', true),
      supabase.from(slotTable.value).select('subject_id, subject_name, teacher_id, teacher_name')
        .eq('school_id', schoolId.value).eq('term_id', termId.value)
        .eq('class_id', classId).neq('slot_type', 'activity'),
    ])

    // Build deduplicated subject list for this class
    const subjectMapObj = {}
    for (const s of (slotData || [])) {
      if (!subjectMapObj[s.subject_id]) {
        subjectMapObj[s.subject_id] = {
          subject_code: s.subject_id,
          subject_name: s.subject_name || s.subject_id,
          teacher_name: s.teacher_name || '',
        }
      }
    }
    const classSubjects = Object.values(subjectMapObj)

    const students = (stuData || []).sort((a, b) =>
      (parseInt(a.seat_number) || 999) - (parseInt(b.seat_number) || 999)
    )
    const studentIds = students.map(s => s.student_code)

    // Attendance
    const attendCount = {}
    for (const sid of studentIds) attendCount[sid] = { present: 0, total: 0 }
    const PRESENT_STATUSES = new Set(['มาเรียน', 'มาสาย', 'ป่วย', 'กิจ', 'ราชการ'])
    for (const ta of (taData || [])) {
      const recs = ta.student_records || {}
      for (const [sid, rec] of Object.entries(recs)) {
        if (!attendCount[sid]) continue
        attendCount[sid].total++
        if (PRESENT_STATUSES.has(rec.status || 'มาเรียน')) attendCount[sid].present++
      }
    }

    // Build rows
    rows.value = students.map((stu, idx) => {
      const sid = stu.student_code

      // Map score records for this student
      const scoreRecMap = {}
      for (const rec of (scoreData || [])) {
        if (rec.student_id === sid) scoreRecMap[rec.subject_code] = rec.scores || {}
      }

      // All subjects with scores (default 0 if no record)
      const subjectScores = classSubjects.map(subj => {
        const sc = scoreRecMap[subj.subject_code] || {}
        let sum = 0
        for (let u = 1; u <= scoreSettings.num_units; u++) {
          const v = parseFloat(sc[`u${u}`])
          if (!isNaN(v)) sum += v
        }
        return {
          subject_code: subj.subject_code,
          subject_name: subj.subject_name,
          teacher_name: subj.teacher_name,
          total: Math.round(sum * 10) / 10,
          max: totalMax,
          pct: totalMax ? Math.round(sum / totalMax * 100) : 0,
        }
      })

      const avgScorePct = classSubjects.length
        ? Math.round(subjectScores.reduce((a, b) => a + b.pct, 0) / classSubjects.length)
        : 0
      const { present, total } = attendCount[sid] || { present: 0, total: 0 }
      const attendPct = total ? Math.round(present / total * 100) : 100
      const behaviorScore = stu.total_behavior_score ?? 0
      const isRisk = avgScorePct < targets.min_score_pct
        || attendPct < targets.min_attendance_pct
        || behaviorScore < targets.min_behavior_score

      return {
        student_id: sid,
        seat: stu.seat_number || idx + 1,
        prefix: stu.prefix || '',
        name: stu.first_name || '',
        surname: stu.last_name || '',
        class_id: classId,
        score_pct: avgScorePct,
        attend_pct: attendPct,
        behavior_score: behaviorScore,
        isRisk,
        line_id: stu.guardian_primary?.line_id || '',
        parent_name: stu.guardian_primary?.name || stu.parent_name || '',
        parent_phone: stu.guardian_primary?.phone || stu.parent_phone || '',
        subjectScores,
      }
    })
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

function buildLetterHtml(row) {
  const isRisk = row.isRisk
  const body = isRisk ? (messages.risk_body || '') : (messages.normal_body || '')
  const riskFactors = []
  if (row.score_pct < targets.min_score_pct)         riskFactors.push(`คะแนนเฉลี่ยรายวิชา ${row.score_pct}% (เกณฑ์ ${targets.min_score_pct}%)`)
  if (row.attend_pct < targets.min_attendance_pct)   riskFactors.push(`เวลาเรียน ${row.attend_pct}% (เกณฑ์ ${targets.min_attendance_pct}%)`)
  if (row.behavior_score < targets.min_behavior_score) riskFactors.push(`คะแนนความประพฤติ ${row.behavior_score} คะแนน (เกณฑ์ ${targets.min_behavior_score})`)

  const meetingHtml = (isRisk && messages.meeting_date)
    ? `<div style="margin:12px 0;padding:10px 14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;font-size:13px">
        📅 <b>นัดหมาย:</b> วันที่ ${thaiDate(messages.meeting_date)} เวลา ${messages.meeting_time || '—'} น. ณ ${messages.meeting_place || '—'}
       </div>`
    : ''

  const scoresTable = row.subjectScores.length
    ? `<table style="border-collapse:collapse;width:100%;font-size:12px;margin:8px 0">
        <thead><tr>
          <th style="border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;text-align:center;white-space:nowrap;width:36px">ที่</th>
          <th style="border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;text-align:left;white-space:nowrap">รหัสวิชา</th>
          <th style="border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;text-align:left">ชื่อวิชา</th>
          <th style="border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;text-align:left">ครูผู้สอน</th>
          <th style="border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;text-align:center;white-space:nowrap">คะแนนที่ได้</th>
          <th style="border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;text-align:center;white-space:nowrap">คะแนนเต็ม</th>
          <th style="border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;text-align:center;white-space:nowrap">ร้อยละ</th>
        </tr></thead>
        <tbody>${row.subjectScores.map((s, i) =>
          `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
            <td style="border:1px solid #cbd5e1;padding:4px 8px;text-align:center;color:#6b7280">${i + 1}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 8px;white-space:nowrap">${s.subject_code}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 8px">${s.subject_name}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 8px;white-space:nowrap">${s.teacher_name || '—'}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 8px;text-align:center;font-weight:700">${s.total}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 8px;text-align:center">${s.max}</td>
            <td style="border:1px solid #cbd5e1;padding:4px 8px;text-align:center;font-weight:700;color:${s.pct < targets.min_score_pct ? '#dc2626' : '#15803d'}">${s.pct}%</td>
          </tr>`
        ).join('')}</tbody>
       </table>`
    : '<p style="color:#9ca3af;font-style:italic">ยังไม่มีข้อมูลวิชาในตาราง</p>'

  const logoHtml = schoolLogo.value
    ? `<img src="${schoolLogo.value}" style="height:60px;object-fit:contain;display:block;margin:0 auto 4px" />`
    : `<div style="font-size:36px;text-align:center">🏫</div>`

  return `
    <div style="page-break-after:always;padding:20px 28px;font-family:'TH Sarabun New',Sarabun,sans-serif;font-size:14px;max-width:680px;margin:0 auto">
      <div style="text-align:center;margin-bottom:16px">
        ${logoHtml}
        <div style="font-size:16px;font-weight:800;color:#1e3a8a">${schoolName.value}</div>
        <div style="font-size:13px;font-weight:700;margin-top:4px">จดหมายแจ้งผลการเรียน · ${termLabel.value}</div>
      </div>

      <p>เรียน คุณ${row.parent_name || 'ผู้ปกครอง'}</p>
      <p>ด้วยโรงเรียนขอแจ้งผลการเรียนของ <b>${row.prefix}${row.name} ${row.surname}</b> ชั้น <b>${row.class_id}</b> เลขที่ <b>${row.seat}</b></p>

      <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:12px 0">
        <div style="font-weight:700;margin-bottom:8px;color:#1e3a8a">สรุปผลการเรียน</div>
        ${scoresTable}
        <div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap">
          <div>เวลาเรียน: <b style="color:${row.attend_pct < targets.min_attendance_pct ? '#dc2626' : '#15803d'}">${row.attend_pct}%</b></div>
          <div>คะแนนความประพฤติ: <b style="color:${row.behavior_score < targets.min_behavior_score ? '#dc2626' : '#15803d'}">${row.behavior_score} คะแนน</b></div>
        </div>
        ${riskFactors.length ? `<div style="margin-top:8px;color:#dc2626;font-size:12px"><b>ต่ำกว่าเกณฑ์:</b> ${riskFactors.join(' · ')}</div>` : ''}
      </div>

      <p style="white-space:pre-wrap">${body}</p>
      ${meetingHtml}

      <div style="margin-top:40px;text-align:center">
        <p style="margin:0">${messages.closing || 'ขอแสดงความนับถือ'}</p>
        <div style="margin-top:48px">
          <div style="border-bottom:1px solid #374151;width:200px;margin:0 auto 4px"></div>
          <div style="font-weight:700">(${messages.signer_name || '..............................'})</div>
          <div>${messages.signer_position || 'ผู้อำนวยการโรงเรียน'}</div>
        </div>
      </div>
    </div>`
}

function openPrintWindow(htmlBodies) {
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(`<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<title>จดหมายแจ้งผู้ปกครอง</title>
<style>
  body { font-family:'TH Sarabun New',Sarabun,sans-serif; margin:0; background:#fff; }
  @page { margin:1.5cm; }
</style></head>
<body>${htmlBodies.join('')}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`)
  win.document.close()
}

function printAll()  { openPrintWindow(filteredRows.value.map(buildLetterHtml)) }
function printOne(row) { openPrintWindow([buildLetterHtml(row)]) }
function printSelected() {
  const sel = filteredRows.value.filter(r => checkedIds.value.has(r.student_id))
  if (sel.length) openPrintWindow(sel.map(buildLetterHtml))
}

function thaiDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}

function buildLineMsg(row) {
  const isRisk = row.isRisk
  const body = isRisk ? messages.risk_body : messages.normal_body
  let msg = `แจ้งผลการเรียน ${termLabel.value}\n`
  msg += `นักเรียน: ${row.prefix}${row.name} ${row.surname} ชั้น ${row.class_id}\n`
  msg += `คะแนนเฉลี่ย: ${row.score_pct}% | เวลาเรียน: ${row.attend_pct}% | พฤติกรรม: ${row.behavior_score}\n`
  msg += `\n${body}`
  if (isRisk && messages.meeting_date) msg += `\n\nนัดหมาย: ${thaiDate(messages.meeting_date)} ${messages.meeting_time || ''} น. ณ ${messages.meeting_place || ''}`
  return msg
}

function copyMsg(row) {
  navigator.clipboard.writeText(buildLineMsg(row)).then(() => {
    ElMessage.success('คัดลอกข้อความแล้ว — วางใน LINE ได้เลย')
  })
}

onMounted(async () => {
  await Promise.all([loadSettings(), loadClasses()])
})
</script>

<style scoped>
.pl-page { padding: 20px 24px; max-width: 1100px; }
.pl-title-bar { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
.pl-title { font-size:22px; font-weight:800; color:#1e3a8a; margin:0; }
.pl-sub { font-size:13px; color:#6b7280; margin:2px 0 0; }
.pl-summary { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
.pl-badge { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:700; }
.pl-badge-total   { background:#e0e7ff; color:#3730a3; }
.pl-badge-risk    { background:#fee2e2; color:#991b1b; }
.pl-badge-normal  { background:#dcfce7; color:#14532d; }
</style>
