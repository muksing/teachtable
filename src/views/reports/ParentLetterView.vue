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
const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const schoolId    = computed(() => authStore.schoolId)
const termId      = computed(() => schoolStore.currentTerm || '')
const isAdmin     = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))

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

    // paginate teach_actuals (Supabase hard cap 1000 rows/request)
    const fetchTeachActuals = async () => {
      const PAGE = 1000, rows = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('teach_actuals')
          .select('student_records, is_filled, subject_id, planned_teacher_id')
          .eq('school_id', schoolId.value).eq('term_id', termId.value).eq('class_id', classId)
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...(data || []))
        if ((data || []).length < PAGE) break
      }
      return { data: rows }
    }
    const [
      { data: stuData },
      { data: scoreData },
      { data: taData },
      { data: subjectMasterData },
    ] = await Promise.all([
      supabase.from('students').select('*')
        .eq('school_id', schoolId.value).eq('class_id', classId),
      supabase.from('score_records').select('student_id, subject_code, scores')
        .eq('school_id', schoolId.value).eq('term_id', termId.value).eq('class_id', classId),
      fetchTeachActuals(),
      supabase.from('subjects').select('subject_code, name').eq('school_id', schoolId.value),
    ])

    // ชื่อวิชาจาก subjects table (authoritative)
    const subjectNameMap = {}
    for (const s of (subjectMasterData || [])) {
      if (s.subject_code) subjectNameMap[s.subject_code] = s.name
    }

    // สร้าง subject list เฉพาะจาก FILLED records เท่านั้น (ป้องกัน code เก่าจาก unfilled)
    const subjectMapObj = {}
    const subjectTeacherMap = {}
    for (const ta of (taData || [])) {
      if (!ta.is_filled) continue
      const subjId = (ta.subject_id || '').trim()
      if (!subjId) continue
      if (!subjectMapObj[subjId]) {
        subjectMapObj[subjId] = {
          subject_code: subjId,
          subject_name: subjectNameMap[subjId] || subjId,
          teacher_name: '',
        }
      }
      if (ta.planned_teacher_id) subjectTeacherMap[subjId] = ta.planned_teacher_id
    }

    // ดึงชื่อครูจาก teachers table
    const teacherIds = [...new Set(Object.values(subjectTeacherMap).filter(Boolean))]
    if (teacherIds.length) {
      const { data: teacherData } = await supabase.from('teachers')
        .select('teacher_code, prefix, first_name, last_name')
        .eq('school_id', schoolId.value).in('teacher_code', teacherIds)
      const teacherNameLookup = {}
      for (const t of (teacherData || [])) {
        teacherNameLookup[t.teacher_code] = `${t.prefix || ''}${t.first_name || ''} ${t.last_name || ''}`.trim()
      }
      for (const [subjId, tid] of Object.entries(subjectTeacherMap)) {
        if (teacherNameLookup[tid]) subjectMapObj[subjId].teacher_name = teacherNameLookup[tid]
      }
    }

    const classSubjects = Object.values(subjectMapObj)
      .sort((a, b) => a.subject_code.localeCompare(b.subject_code, 'th'))

    const students = (stuData || [])
      .filter(s => !s.student_status || s.student_status === 'เรียนอยู่')
      .sort((a, b) => (parseInt(a.seat_number) || 999) - (parseInt(b.seat_number) || 999))
    const studentIds = students.map(s => s.student_code)

    // นับเวลาเรียน: logic เดียวกับ AttendanceReportView
    // unfilled = ทุกคนขาด, filled = ใช้ student_records จริง
    function categorizeStatus(st) {
      if (!st || st === 'ไม่บันทึก') return 'absent'
      if (st.includes('ขาด') || ['โดดเรียน', 'หนีเรียน', 'absent'].includes(st)) return 'absent'
      return 'present'
    }

    const attendSubj = {}
    const attendCount = {}
    for (const sid of studentIds) { attendSubj[sid] = {}; attendCount[sid] = { present: 0, total: 0 } }

    for (const ta of (taData || [])) {
      const subjId = (ta.subject_id || '').trim() || null
      // นับ per-subject เฉพาะ subject ที่อยู่ใน list (filled-based) เท่านั้น
      const trackSubj = subjId && subjectMapObj[subjId]

      if (!ta.is_filled) {
        // ครูไม่บันทึก → ทุกคนขาดคาบนี้
        for (const sid of studentIds) {
          if (trackSubj) {
            if (!attendSubj[sid][subjId]) attendSubj[sid][subjId] = { present: 0, total: 0 }
            attendSubj[sid][subjId].total++
          }
          attendCount[sid].total++
        }
      } else {
        const recs = ta.student_records || {}
        for (const [sid, rec] of Object.entries(recs)) {
          if (!attendCount[sid]) continue
          const isPresent = categorizeStatus(rec.status || 'มาเรียน') === 'present'
          if (trackSubj) {
            if (!attendSubj[sid][subjId]) attendSubj[sid][subjId] = { present: 0, total: 0 }
            attendSubj[sid][subjId].total++
            if (isPresent) attendSubj[sid][subjId].present++
          }
          attendCount[sid].total++
          if (isPresent) attendCount[sid].present++
        }
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

      // All subjects with scores + attendance
      const subjectScores = classSubjects.map(subj => {
        const sc = scoreRecMap[subj.subject_code] || {}
        let sum = 0
        for (let u = 1; u <= scoreSettings.num_units; u++) {
          const v = parseFloat(sc[`u${u}`])
          if (!isNaN(v)) sum += v
        }
        const scorePct  = totalMax ? Math.round(sum / totalMax * 100) : 0
        const subjAtt   = attendSubj[sid]?.[subj.subject_code] || { present: 0, total: 0 }
        const attPct    = subjAtt.total > 0 ? Math.round(subjAtt.present / subjAtt.total * 100) : 100
        const isPassed  = attPct >= targets.min_attendance_pct
        return {
          subject_code:    subj.subject_code,
          subject_name:    subj.subject_name,
          teacher_name:    subj.teacher_name,
          total:           Math.round(sum * 10) / 10,
          max:             totalMax,
          pct:             scorePct,
          att_present:     subjAtt.present,
          att_total:       subjAtt.total,
          att_pct:         attPct,
          isPassed,
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
        attend_present: present,
        attend_total: total,
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

  const th = (txt, extra='') =>
    `<th style="border:1px solid #cbd5e1;padding:4px 6px;background:#1e3a8a;color:#fff;text-align:center;white-space:nowrap;font-size:11px;${extra}">${txt}</th>`
  const td = (txt, extra='') =>
    `<td style="border:1px solid #cbd5e1;padding:4px 6px;${extra}">${txt}</td>`

  const scoresTable = row.subjectScores.length
    ? `<table style="border-collapse:collapse;width:100%;font-size:11px;margin:8px 0">
        <thead><tr>
          ${th('ที่','width:28px')}
          ${th('รหัสวิชา','text-align:left')}
          ${th('ชื่อวิชา','text-align:left;min-width:100px')}
          ${th('ครูผู้สอน','text-align:left')}
          ${th('คะแนน<br>ที่ได้')}
          ${th('คะแนน<br>เต็ม')}
          ${th('เวลาเรียน<br>มา/ทั้งหมด')}
          ${th('ร้อยละ<br>เวลาเรียน')}
          ${th('ประเมิน')}
        </tr></thead>
        <tbody>${row.subjectScores.map((s, i) => {
          const rowBg    = i % 2 === 0 ? '#fff' : '#f8fafc'
          const failScore = s.pct < targets.min_score_pct
          const failAtt   = s.att_pct < targets.min_attendance_pct
          const assessColor = s.isPassed ? '#15803d' : '#dc2626'
          const assessText  = s.isPassed ? 'ผ่าน' : 'มส.'
          const attRatio    = s.att_total > 0 ? `${s.att_present}/${s.att_total}` : '—'
          const attPctTxt   = s.att_total > 0 ? `${s.att_pct}%` : '—'
          return `<tr style="background:${rowBg}">
            ${td(i + 1, 'text-align:center;color:#6b7280')}
            ${td(s.subject_code, 'white-space:nowrap')}
            ${td(s.subject_name)}
            ${td(s.teacher_name || '—', 'white-space:nowrap;font-size:10px')}
            ${td(`<b>${s.total}</b>`, 'text-align:center;color:' + (failScore ? '#dc2626' : '#111'))}
            ${td(s.max, 'text-align:center;color:#6b7280')}
            ${td(attRatio, 'text-align:center')}
            ${td(`<b>${attPctTxt}</b>`, 'text-align:center;color:' + (failAtt ? '#dc2626' : '#15803d') + ';font-weight:700')}
            ${td(`<b>${assessText}</b>`, 'text-align:center;color:' + assessColor + ';font-weight:800')}
          </tr>`
        }).join('')}</tbody>
       </table>`
    : '<p style="color:#9ca3af;font-style:italic">ยังไม่มีข้อมูลวิชาในตาราง</p>'

  const logoHtml = schoolLogo.value
    ? `<img src="${schoolLogo.value}" style="height:60px;object-fit:contain;display:block;margin:0 auto 4px" />`
    : `<div style="font-size:36px;text-align:center">🏫</div>`

  return `
    <div style="page-break-after:always;padding:20px 28px;font-family:'Sarabun','TH Sarabun New',sans-serif;font-size:15px;max-width:700px;margin:0 auto">
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
        <div style="margin-top:10px;font-size:13px">
          คะแนนความประพฤติ: <b style="color:${row.behavior_score < targets.min_behavior_score ? '#dc2626' : '#15803d'}">${row.behavior_score} คะแนน</b>
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
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  body { font-family:'Sarabun','TH Sarabun New',sans-serif; margin:0; background:#fff; }
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
