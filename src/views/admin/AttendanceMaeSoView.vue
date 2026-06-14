<template>
  <AppLayout>
    <div class="ms-page">

      <!-- Header -->
      <div class="ms-header">
        <div class="ms-school-banner">
          <img v-if="schoolLogo" :src="schoolLogo" class="ms-school-logo" alt="ตราโรงเรียน" />
          <div v-else class="ms-school-logo-placeholder">🏫</div>
          <div>
            <div class="ms-school-name">{{ schoolName }}</div>
            <h1 class="ms-title">📊 รายงานสรุป มส. รายวิชา</h1>
            <p class="ms-sub">สรุปเวลาเรียนแยกแต่ละวิชา · ผ่าน = มาเรียน ≥ 80% · มส. = ขาดเรียนเกิน 20%</p>
          </div>
        </div>
      </div>

      <!-- Filter -->
      <el-card class="mb-4 no-print" shadow="never" style="border-radius:14px">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📅 วันเริ่มต้น (ต้นภาคเรียน)</div>
            <el-date-picker
              v-model="startDate" type="date" placeholder="วันเริ่มต้น"
              format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:165px"
            />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📅 ณ วันที่รายงาน</div>
            <el-date-picker
              v-model="reportDate" type="date" placeholder="วันรายงาน"
              format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:165px"
            />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">🏫 กรองห้อง (ไม่บังคับ)</div>
            <el-select v-model="filterClassId" clearable placeholder="ทุกห้อง" style="width:160px">
              <el-option v-for="c in allClassesList" :key="c.class_id" :label="c.class_name || c.class_id" :value="c.class_id" />
            </el-select>
          </div>
          <el-button type="primary" :loading="loading" @click="loadReport">🔍 สร้างรายงาน</el-button>
          <el-button v-if="hasData" type="warning" :disabled="loading" @click="printAll">
            🖨️ พิมพ์ทุกห้องรวมกัน
          </el-button>
        </div>
      </el-card>

      <!-- Summary stats -->
      <div v-if="hasData && !loading" class="ms-stats-row mb-4">
        <div class="ms-stat-card" style="background:linear-gradient(135deg,#2563eb,#3b82f6)">
          <div class="ms-stat-num">{{ classList.length }}</div>
          <div class="ms-stat-lbl">ห้องเรียน</div>
        </div>
        <div class="ms-stat-card" style="background:linear-gradient(135deg,#059669,#10b981)">
          <div class="ms-stat-num">{{ totalStudents }}</div>
          <div class="ms-stat-lbl">นักเรียนทั้งหมด</div>
        </div>
        <div class="ms-stat-card" style="background:linear-gradient(135deg,#dc2626,#ef4444)">
          <div class="ms-stat-num">{{ totalMaeSoStudents }}</div>
          <div class="ms-stat-lbl">คนที่มีมส. ≥ 1 วิชา</div>
        </div>
        <div class="ms-stat-card" style="background:linear-gradient(135deg,#b45309,#d97706)">
          <div class="ms-stat-num">{{ totalMaeSoCases }}</div>
          <div class="ms-stat-lbl">รายการ มส. ทั้งหมด</div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="py-12"><el-skeleton :rows="10" animated /></div>

      <!-- Per class sections -->
      <div v-else-if="hasData" class="ms-classes">
        <div v-for="cls in classList" :key="cls.class_id" class="ms-class-section">

          <!-- Class header -->
          <div class="ms-class-header">
            <div class="ms-class-info">
              <span class="ms-class-name">{{ cls.class_name || cls.class_id }}</span>
              <span class="ms-class-meta">{{ cls.students.length }} คน · {{ cls.subjects.length }} วิชา</span>
              <el-tag v-if="cls.maeSoStudentCount > 0" type="danger" size="small" effect="dark">
                มส. {{ cls.maeSoStudentCount }} คน / {{ cls.maeSoCaseCount }} รายการ
              </el-tag>
              <el-tag v-else type="success" size="small" effect="dark">ผ่านทุกคนทุกวิชา ✓</el-tag>
            </div>
            <el-button size="small" type="warning" @click="printClass(cls)">🖨️ พิมพ์ห้องนี้</el-button>
          </div>

          <!-- Matrix table -->
          <div class="ms-table-scroll">
            <table class="ms-matrix">
              <colgroup>
                <col style="width:44px;min-width:44px" />
                <col style="width:95px;min-width:95px" />
                <col style="min-width:160px" />
                <template v-for="_ in cls.subjects" :key="'cg-'+_">
                  <col style="width:54px;min-width:54px" />
                  <col style="width:50px;min-width:50px" />
                </template>
                <col style="width:50px;min-width:50px" />
              </colgroup>
              <thead>
                <!-- Row 1: fixed cols + subject headers (colspan=2) + summary -->
                <tr>
                  <th class="ms-th ms-th-fix" rowspan="2">เลขที่</th>
                  <th class="ms-th ms-th-fix" rowspan="2">รหัสนักเรียน</th>
                  <th class="ms-th ms-th-fix ms-th-name" rowspan="2" style="text-align:left;padding-left:8px">ชื่อ-นามสกุล</th>
                  <th
                    v-for="subj in cls.subjects"
                    :key="'h1-'+subj.id"
                    class="ms-th ms-th-subj"
                    colspan="2"
                  >
                    <div class="ms-subj-code">{{ subj.code }}</div>
                    <div class="ms-subj-name">{{ subj.name }}</div>
                    <div v-if="subj.credits" class="ms-subj-credit">{{ subj.credits }} นก.</div>
                    <div v-if="subj.teacher_name" class="ms-subj-teacher">{{ subj.teacher_name }}</div>
                  </th>
                  <th class="ms-th ms-th-sum" rowspan="2">มส.<br/>ทั้งหมด</th>
                </tr>
                <!-- Row 2: sub-headers per subject -->
                <tr>
                  <template v-for="subj in cls.subjects" :key="'h2-'+subj.id">
                    <th class="ms-th ms-th-sub">% เวลา</th>
                    <th class="ms-th ms-th-sub">ผล</th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(stu, idx) in cls.students"
                  :key="stu.student_id"
                  :class="[idx % 2 === 0 ? 'ms-tr-even' : 'ms-tr-odd', stu.hasMaeSo ? 'ms-tr-maeso' : '']"
                >
                  <td class="ms-td ms-td-center">{{ stu.seat_number || (idx + 1) }}</td>
                  <td class="ms-td ms-td-center ms-td-id">{{ stu.student_id }}</td>
                  <td class="ms-td ms-td-name">{{ stu.prefix || '' }}{{ stu.name }} {{ stu.surname }}</td>
                  <!-- Subject cells: % + ผล -->
                  <template v-for="subj in cls.subjects" :key="subj.id+'-'+stu.student_id">
                    <td class="ms-td ms-td-center ms-td-pct">
                      <span v-if="(stu.bySubject[subj.id]?.total || 0) > 0"
                        :class="stu.bySubject[subj.id]?.isMaeSo ? 'ms-pct-bad' : 'ms-pct-ok'"
                      >{{ stu.bySubject[subj.id]?.pct.toFixed(0) }}%</span>
                      <span v-else class="ms-td-empty">—</span>
                    </td>
                    <td class="ms-td ms-td-center ms-td-result">
                      <span v-if="(stu.bySubject[subj.id]?.total || 0) > 0">
                        <span v-if="stu.bySubject[subj.id]?.isMaeSo" class="ms-badge-maeso">มส.</span>
                        <span v-else class="ms-badge-pass">ผ่าน</span>
                      </span>
                      <span v-else class="ms-td-empty">—</span>
                    </td>
                  </template>
                  <!-- Total มส. count for this student -->
                  <td class="ms-td ms-td-center ms-td-sum">
                    <span v-if="stu.maeSoCount > 0" class="ms-sum-maeso">{{ stu.maeSoCount }}</span>
                    <span v-else class="ms-td-empty">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Class summary legend -->
          <div class="ms-class-footer no-print">
            <span class="ms-legend-item"><span class="ms-badge-pass">ผ่าน</span> = มาเรียน ≥ 80%</span>
            <span class="ms-legend-item"><span class="ms-badge-maeso">มส.</span> = ขาดเรียนเกิน 20%</span>
            <span class="ms-legend-item ms-legend-dash">— = ยังไม่มีข้อมูลในช่วงนี้</span>
          </div>

        </div>
      </div>

      <el-empty v-else description="เลือกช่วงวันที่แล้วกด 'สร้างรายงาน'" :image-size="80" />

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useTimetableSource } from '@/composables/useTimetableSource'
import { supabase } from '@/supabase/client'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getClasses, getStudents, getTeachActualsRangeByClass } = useSchoolDb()
const { slotTable } = useTimetableSource()

const loading       = ref(false)
const startDate     = ref('')
const reportDate    = ref('')
const filterClassId = ref('')
const classList     = ref([])
const allClassesList = ref([])

const hasData = computed(() => classList.value.length > 0)

const totalStudents     = computed(() => classList.value.reduce((s, c) => s + c.students.length, 0))
const totalMaeSoStudents = computed(() => classList.value.reduce((s, c) => s + c.maeSoStudentCount, 0))
const totalMaeSoCases    = computed(() => classList.value.reduce((s, c) => s + c.maeSoCaseCount, 0))

const schoolName = computed(() => schoolStore.settingsObj?.school_info?.school_name_th || schoolStore.schoolInfo?.school_name || schoolStore.schoolName || 'โรงเรียน')
const schoolLogo = computed(() => schoolStore.schoolInfo?.settings?.logo_url || schoolStore.schoolInfo?.logo_url || schoolStore.settingsObj?.logo_url || '')
const termLabel  = computed(() => schoolStore.termLabel || '')

function categorizeStatus(st) {
  if (!st || st === 'ไม่บันทึก') return 'absent'
  if (st.includes('ขาด') || ['โดดเรียน', 'หนีเรียน', 'absent'].includes(st)) return 'absent'
  if (['ลากิจ', 'ลาป่วย', 'leave', 'sick'].includes(st)) return 'leave'
  if (['ไปราชการ', 'official'].includes(st)) return 'official'
  return 'present'
}

async function loadReport() {
  if (!startDate.value || !reportDate.value) {
    ElMessage.warning('กรุณาเลือกวันเริ่มต้นและวันรายงาน')
    return
  }
  loading.value = true
  classList.value = []
  try {
    const schoolId = authStore.schoolId
    const termId   = schoolStore.currentTerm || '2568_1'

    // โหลดทุกอย่างพร้อมกัน
    const [allClasses, allStudents, allActuals, subjectsRes, slotsRes] = await Promise.all([
      getClasses(),
      getStudents(),
      getTeachActualsRangeByClass(startDate.value, reportDate.value),
      supabase.from('subjects')
        .select('subject_code, name, credits')
        .eq('school_id', schoolId),
      supabase.from(slotTable.value)
        .select('class_id, subject_id, subject_name, teacher_name')
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .neq('slot_type', 'activity'),
    ])

    // Map credit ต่อ subject_code
    const creditMap = {}
    for (const s of subjectsRes.data || []) {
      creditMap[s.subject_code] = { name: s.name || '', credits: s.credits || 0 }
    }

    // Build subject list per class from timetable_slots (dedup by subject_id)
    const classSubjectsMap = {}
    for (const slot of slotsRes.data || []) {
      if (!slot.subject_id) continue
      const cid = slot.class_id
      if (!classSubjectsMap[cid]) classSubjectsMap[cid] = {}
      if (!classSubjectsMap[cid][slot.subject_id]) {
        const meta = creditMap[slot.subject_id] || {}
        classSubjectsMap[cid][slot.subject_id] = {
          id:           slot.subject_id,
          code:         slot.subject_id,
          name:         meta.name || slot.subject_name || slot.subject_id,
          credits:      meta.credits || 0,
          teacher_name: slot.teacher_name || '',
        }
      }
    }

    // กลุ่ม students ตาม class_id
    const studentsByClass = {}
    for (const s of allStudents) {
      const cid = s.class_id
      if (!studentsByClass[cid]) studentsByClass[cid] = []
      studentsByClass[cid].push(s)
    }

    // กลุ่ม teach_actuals ตาม class_id
    const actualsByClass = {}
    for (const ta of allActuals) {
      const cid = ta.class_id
      if (!actualsByClass[cid]) actualsByClass[cid] = []
      actualsByClass[cid].push(ta)
    }

    // กรองตาม class ถ้ามี
    const targetClasses = filterClassId.value
      ? allClasses.filter(c => (c.class_id || c.class_name) === filterClassId.value)
      : allClasses

    const result = []
    for (const cls of targetClasses) {
      const cid      = cls.class_id || cls.class_name
      const students = (studentsByClass[cid] || []).sort((a, b) => {
        const na = parseInt(a.seat_number, 10), nb = parseInt(b.seat_number, 10)
        return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb)
      })
      if (!students.length) continue

      const classActuals = actualsByClass[cid] || []
      const subjects     = Object.values(classSubjectsMap[cid] || {}).sort((a, b) => a.code.localeCompare(b.code))
      if (!subjects.length) continue

      // init attendance tracker: student_id → subject_id → counts
      const tracker = {}
      for (const s of students) {
        tracker[s.student_id] = {}
        for (const subj of subjects) {
          tracker[s.student_id][subj.id] = { present: 0, absent: 0, leave: 0, official: 0, total: 0 }
        }
      }

      for (const ta of classActuals) {
        const subjId = ta.subject_plan_id || ta.subject_actual_id
        if (!subjId) continue

        if (!ta.is_filled) {
          for (const s of students) {
            const t = tracker[s.student_id]?.[subjId]
            if (!t) continue
            t.total++; t.absent++
          }
        } else {
          const recs = ta.student_records || {}
          for (const [sid, rec] of Object.entries(recs)) {
            const t = tracker[sid]?.[subjId]
            if (!t) continue
            const cat = categorizeStatus(rec?.status || 'มาเรียน')
            t.total++; t[cat]++
          }
        }
      }

      // Build student rows
      let maeSoCaseCount = 0
      const studentRows = students.map(s => {
        const bySubject = {}
        let maeSoCount = 0
        for (const subj of subjects) {
          const c   = tracker[s.student_id]?.[subj.id] || { present: 0, absent: 0, leave: 0, official: 0, total: 0 }
          const pct = c.total > 0 ? (c.present / c.total) * 100 : 100
          const isMaeSo = c.total > 0 && pct < 80
          if (isMaeSo) { maeSoCount++; maeSoCaseCount++ }
          bySubject[subj.id] = { ...c, pct, isMaeSo }
        }
        return { ...s, bySubject, maeSoCount, hasMaeSo: maeSoCount > 0 }
      })

      result.push({
        ...cls,
        subjects,
        students:          studentRows,
        maeSoStudentCount: studentRows.filter(s => s.hasMaeSo).length,
        maeSoCaseCount,
      })
    }

    classList.value = result
    if (!result.length) ElMessage.warning('ไม่พบข้อมูลในช่วงวันที่เลือก')
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

// ── Print ──────────────────────────────────────────────────────────────────

function formatDateThai(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
}

function buildClassHtml(cls) {
  const n    = cls.subjects.length
  // คำนวณ % width ให้เต็มหน้า A4 landscape
  // fixed data cols: เลขที่3% รหัส7% ชื่อ12% = 22%; sum col: มส.4%; subjects: 74%
  const dataPct   = 22  // 3+7+12
  const sumPct    = 4
  const subjTotal = 100 - dataPct - sumPct  // 74%
  const eachSubj  = (subjTotal / n).toFixed(2)
  const pctW      = (parseFloat(eachSubj) * 0.55).toFixed(2)
  const resultW   = (parseFloat(eachSubj) * 0.45).toFixed(2)
  const fs        = n > 12 ? 7 : n > 9 ? 8 : n > 6 ? 9 : 10  // adaptive font

  const TH  = (s, extra = '', rs = 1) => `<th rowspan="${rs}" style="background:#134e4a;color:white;padding:3px 2px;border:1px solid #0f766e;text-align:center;font-size:${fs}px;font-weight:700${extra}">${s}</th>`
  const THs = (s, extra = '') => `<th style="background:#0f766e;color:white;padding:2px 1px;border:1px solid #0d9488;text-align:center;font-size:${Math.max(fs-1,6)}px${extra}">${s}</th>`

  const subjHeaders = cls.subjects.map(s => `
    <th colspan="2" style="background:#134e4a;color:white;padding:3px 2px;border:1px solid #0f766e;text-align:center;font-size:${fs}px;width:${eachSubj}%">
      <div style="font-weight:800">${s.code}</div>
      <div style="font-size:${Math.max(fs-1,6)}px;opacity:.9;white-space:nowrap;overflow:hidden;max-width:100%">${s.name}</div>
      ${s.credits ? `<div style="font-size:${Math.max(fs-1,6)}px;opacity:.75">${s.credits} นก.</div>` : ''}
      ${s.teacher_name ? `<div style="font-size:${Math.max(fs-1,6)}px;opacity:.85;white-space:nowrap;overflow:hidden">👤 ${s.teacher_name}</div>` : ''}
    </th>`).join('')

  const subHeaders = cls.subjects.map(() =>
    `${THs('%เวลา', `;width:${pctW}%`)}${THs('ผล', `;width:${resultW}%`)}`
  ).join('')

  const rows = cls.students.map((stu, i) => {
    const rowBg  = stu.hasMaeSo ? '#fff5f5' : i % 2 === 0 ? '#ffffff' : '#f8fafc'
    const subCells = cls.subjects.map(subj => {
      const d = stu.bySubject[subj.id]
      if (!d || d.total === 0) {
        return `<td style="text-align:center;border:1px solid #e2e8f0;font-size:${fs}px;color:#cbd5e1">—</td>
                <td style="text-align:center;border:1px solid #e2e8f0;font-size:${fs}px;color:#cbd5e1">—</td>`
      }
      const pc = d.isMaeSo ? '#dc2626' : '#15803d'
      const result = d.isMaeSo
        ? `<b style="color:#dc2626">มส.</b>`
        : `<span style="color:#15803d">ผ่าน</span>`
      return `<td style="text-align:center;border:1px solid #e2e8f0;font-size:${fs}px;font-weight:700;color:${pc}">${d.pct.toFixed(0)}%</td>
              <td style="text-align:center;border:1px solid #e2e8f0;font-size:${fs}px">${result}</td>`
    }).join('')

    const maeSoSum = stu.maeSoCount > 0
      ? `<td style="text-align:center;border:1px solid #e2e8f0;font-size:${fs+1}px;font-weight:900;color:#dc2626">${stu.maeSoCount}</td>`
      : `<td style="text-align:center;border:1px solid #e2e8f0;font-size:${fs}px;color:#cbd5e1">—</td>`

    return `<tr style="background:${rowBg}">
      <td style="text-align:center;padding:2px 3px;border:1px solid #e2e8f0;font-size:${fs}px;width:3%">${stu.seat_number || (i + 1)}</td>
      <td style="text-align:center;padding:2px 3px;border:1px solid #e2e8f0;font-size:${Math.max(fs-1,6)}px;width:7%;font-family:monospace">${stu.student_id || ''}</td>
      <td style="padding:2px 5px;border:1px solid #e2e8f0;font-size:${fs}px;font-weight:600;width:12%;white-space:nowrap">${stu.prefix || ''}${stu.name || ''} ${stu.surname || ''}</td>
      ${subCells}
      ${maeSoSum}
    </tr>`
  }).join('')

  const totalCols = 3 + n * 2 + 1  // เลขที่ + รหัส + ชื่อ + (subj×2) + มส.
  const logoHtml  = schoolLogo.value
    ? `<img src="${schoolLogo.value}" style="height:48px;object-fit:contain;vertical-align:middle;margin-right:8px" />`
    : ''

  return `
    <div style="margin-bottom:14px">
    <table style="border-collapse:collapse;width:100%;table-layout:fixed">
      <colgroup>
        <col style="width:3%"/>
        <col style="width:7%"/>
        <col style="width:12%"/>
        ${cls.subjects.map(() => `<col style="width:${pctW}%"/><col style="width:${resultW}%"/>`).join('')}
        <col style="width:${sumPct}%"/>
      </colgroup>
      <thead>
        <tr>
          <th colspan="${totalCols}" style="background:#ffffff;padding:6px 8px;border:1px solid #e2e8f0;text-align:center">
            ${logoHtml}
            <span style="font-size:14px;font-weight:800;color:#0f766e;vertical-align:middle">${schoolName.value}</span>
            <span style="font-size:11px;color:#374151;vertical-align:middle;margin-left:12px">ภาคเรียน: ${termLabel.value}</span>
          </th>
        </tr>
        <tr>
          <th colspan="${totalCols}" style="background:#0f766e;color:white;padding:4px 8px;border:1px solid #0d9488;font-size:${fs+1}px;font-weight:800;text-align:left">
            ชั้น ${cls.class_name || cls.class_id}
            &ensp;—&ensp; ${cls.students.length} คน · ${n} วิชา
            &ensp;|&ensp; มส. <span style="color:#fca5a5">${cls.maeSoStudentCount}</span> คน / ${cls.maeSoCaseCount} รายการ
          </th>
        </tr>
        <tr>
          ${TH('เลขที่', ';width:3%', 2)}
          ${TH('รหัสนักเรียน', ';width:7%', 2)}
          ${TH('ชื่อ-นามสกุล', ';width:12%;text-align:left;padding-left:5px', 2)}
          ${subjHeaders}
          <th rowspan="2" style="background:#1e3a8a;color:white;padding:3px 2px;border:1px solid #1e40af;text-align:center;font-size:${fs}px;width:${sumPct}%">มส.<br/>ทั้งหมด</th>
        </tr>
        <tr>${subHeaders}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="font-size:8px;color:#6b7280;margin-top:3px">
      ผ่าน = มาเรียน ≥ 80% &nbsp;|&nbsp; มส. = ขาดเรียนเกิน 20% &nbsp;|&nbsp; — = ยังไม่มีข้อมูลในช่วงนี้
    </div>
    </div>`
}

function printCss() {
  return `
  @page { margin: 10mm; size: A4 landscape; }
  * { font-family: 'Sarabun','TH Sarabun New','Tahoma',sans-serif; box-sizing:border-box; }
  body { font-size: 12px; color: #000; margin: 0; }
  table { border-collapse:collapse; width:100%; }
  thead { display:table-header-group; }
  `
}

function buildFullHtml(classes) {
  const now      = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const sections = classes.map((cls, i) =>
    `${i > 0 ? '<div style="page-break-before:always"></div>' : ''}${buildClassHtml(cls)}`
  ).join('')

  return `<!DOCTYPE html><html lang="th">
<head><meta charset="UTF-8"><title>รายงาน มส.</title>
<style>${printCss()}</style>
</head>
<body>
<p style="text-align:center;font-size:10px;color:#555;margin:0 0 4px">
  ช่วง: ${formatDateThai(startDate.value)} – ${formatDateThai(reportDate.value)}
  &ensp;|&ensp; วันที่พิมพ์: ${now}
  &ensp;|&ensp; รวม ${totalStudents.value} คน · มส. ${totalMaeSoStudents.value} คน
</p>
${sections}
</body></html>`
}

function openPrint(html) {
  const win = window.open('', '_blank', 'width=1100,height=750')
  if (!win) { ElMessage.warning('กรุณาอนุญาต popup เพื่อพิมพ์รายงาน'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

function printClass(cls) {
  const now = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  openPrint(`<!DOCTYPE html><html lang="th">
<head><meta charset="UTF-8"><title>รายงาน มส. ชั้น ${cls.class_name || cls.class_id}</title>
<style>${printCss()}</style>
</head>
<body>
<p style="text-align:center;font-size:10px;color:#555;margin:0 0 4px">
  ช่วง: ${formatDateThai(startDate.value)} – ${formatDateThai(reportDate.value)}
  &ensp;|&ensp; วันที่พิมพ์: ${now}
</p>
${buildClassHtml(cls)}
</body></html>`)
}

function printAll() {
  openPrint(buildFullHtml(classList.value))
}

// ── Init ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  const termId     = schoolStore.currentTerm || '2568_1'
  const [buddhYear, sem] = termId.split('_')
  const christYear = parseInt(buddhYear) - 543
  startDate.value  = sem === '2' ? `${christYear}-11-01` : `${christYear}-05-01`
  reportDate.value = new Date().toISOString().split('T')[0]

  allClassesList.value = await getClasses()
})
</script>

<style scoped>
.ms-page { padding: 24px; max-width: 100%; margin: 0 auto; }

.ms-header {
  background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #059669 100%);
  border-radius: 18px;
  padding: 22px 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(15,118,110,0.35);
}
.ms-title { font-size: 22px; font-weight: 900; color: #fff; margin: 0 0 4px; }
.ms-sub   { font-size: 13px; color: rgba(255,255,255,0.85); margin: 0; }

/* Stats */
.ms-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.ms-stat-card {
  border-radius: 14px; padding: 16px;
  text-align: center; color: white;
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
}
.ms-stat-num { font-size: 28px; font-weight: 900; line-height: 1; margin-bottom: 5px; }
.ms-stat-lbl { font-size: 11px; font-weight: 700; opacity: 0.9; }

/* Class section */
.ms-classes { display: flex; flex-direction: column; gap: 24px; }
.ms-class-section {
  background: white;
  border-radius: 14px;
  border: 2px solid #ccfbf1;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(15,118,110,0.08);
}
.ms-class-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #0f766e, #0d9488);
}
.ms-class-info  { display: flex; align-items: center; gap: 10px; flex: 1; flex-wrap: wrap; }
.ms-class-name  { font-size: 17px; font-weight: 900; color: #fff; }
.ms-class-meta  { font-size: 12px; color: rgba(255,255,255,0.8); }

/* Scrollable table wrapper */
.ms-table-scroll { overflow-x: auto; }

/* Matrix table */
.ms-matrix {
  border-collapse: collapse;
  width: 100%;
  font-size: 11px;
  font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
}

/* Sticky columns */
.ms-th-fix { position: sticky; z-index: 3; }
.ms-th-fix:nth-child(1) { left: 0; }
.ms-th-fix:nth-child(2) { left: 44px; }
.ms-th-fix.ms-th-name   { left: 139px; box-shadow: 2px 0 4px rgba(0,0,0,0.08); }

.ms-th {
  background: #0f766e; color: #fff;
  padding: 5px 4px; border: 1px solid #0d9488;
  font-weight: 700; font-size: 11px;
  text-align: center; white-space: nowrap;
}
.ms-th-subj { background: #0e7490; padding: 4px 3px; min-width: 96px; }
.ms-th-sub  { background: #155e75; font-size: 10px; font-weight: 600; padding: 3px 2px; }
.ms-th-sum  { background: #1e3a8a; min-width: 50px; }

.ms-subj-code    { font-size: 11px; font-weight: 800; }
.ms-subj-name    { font-size: 9px; opacity: .9; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
.ms-subj-credit  { font-size: 9px; opacity: .75; margin-top: 1px; }
.ms-subj-teacher { font-size: 9px; opacity: .85; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }

.ms-td        { padding: 4px 3px; border: 1px solid #e2e8f0; vertical-align: middle; }
.ms-td-center { text-align: center; }
.ms-td-name   { padding: 4px 8px; font-weight: 600; color: #1e293b; white-space: nowrap; min-width: 150px; }
.ms-td-id     { font-family: monospace; font-size: 10px; color: #64748b; }
.ms-td-pct    { font-size: 11px; font-weight: 700; }
.ms-td-result { font-size: 11px; }
.ms-td-sum    { background: #f8fafc; border-left: 2px solid #cbd5e1 !important; }
.ms-td-empty  { color: #cbd5e1; font-size: 10px; }

.ms-tr-even       { background: #ffffff; }
.ms-tr-odd        { background: #f8fafc; }
.ms-tr-maeso td   { background: #fff5f5 !important; }
.ms-tr-even:hover td, .ms-tr-odd:hover td, .ms-tr-maeso:hover td { background: #f0fdfa !important; }

/* td fix sticky columns */
.ms-td:nth-child(1) { position: sticky; left: 0;     z-index: 1; background: inherit; }
.ms-td:nth-child(2) { position: sticky; left: 44px;  z-index: 1; background: inherit; }
.ms-td:nth-child(3) { position: sticky; left: 139px; z-index: 1; background: inherit; box-shadow: 2px 0 4px rgba(0,0,0,0.06); }

.ms-pct-ok  { color: #15803d; font-weight: 800; }
.ms-pct-bad { color: #dc2626; font-weight: 800; }

.ms-badge-pass  { display:inline-block; padding:1px 6px; border-radius:4px; background:#dcfce7; color:#15803d; font-size:10px; font-weight:700; }
.ms-badge-maeso { display:inline-block; padding:1px 6px; border-radius:4px; background:#fee2e2; color:#dc2626; font-size:10px; font-weight:800; }
.ms-sum-maeso   { font-size:13px; font-weight:900; color:#dc2626; }

/* Footer legend */
.ms-class-footer {
  display: flex; gap: 20px; padding: 8px 16px;
  background: #f8fafc; border-top: 1px solid #e2e8f0;
  font-size: 11px; color: #64748b;
}
.ms-legend-item { display: flex; align-items: center; gap: 6px; }
.ms-legend-dash { color: #94a3b8; }

@media (max-width: 640px) {
  .ms-stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
