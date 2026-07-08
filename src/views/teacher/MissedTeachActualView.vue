<template>
  <AppLayout>
    <div :class="['mta-page', isAdmin && 'mta-page--wide']">

      <!-- ══ Header ══ -->
      <div class="mta-header">
        <div class="mta-title-row">
          <div>
            <h1 class="mta-title">⚠️ รายวิชาที่ลืมบันทึก</h1>
            <p class="mta-sub">
              {{ isAdmin ? 'สรุปคาบที่ครูยังไม่ได้บันทึกในช่วงย้อนหลัง' : 'คาบของฉันที่ยังไม่ได้กรอกข้อมูล' }}
            </p>
          </div>
          <el-tag v-if="!loading" :type="displayCount ? 'danger' : 'success'" size="large" class="mta-badge">
            {{ displayCount ? `ค้างอยู่ ${displayCount} คาบ` : '✅ ครบทุกคาบ' }}
          </el-tag>
        </div>

        <!-- Controls row -->
        <div class="mta-controls">
          <span class="mta-range-label">ย้อนหลัง {{ maxDays }} วัน</span>
          <el-button size="small" :loading="loading" @click="loadData">🔄 รีเฟรช</el-button>
        </div>
      </div>

      <!-- ══ ADMIN: summary stats + filter bar + table ══ -->
      <template v-if="isAdmin">

        <!-- Summary stats -->
        <div class="mta-stats">
          <div class="mta-stat-card mta-stat-danger">
            <div class="mta-stat-num">{{ adminUnfilled.length }}</div>
            <div class="mta-stat-label">คาบค้างทั้งหมด</div>
          </div>
          <div class="mta-stat-card mta-stat-warning">
            <div class="mta-stat-num">{{ uniqueTeacherCount }}</div>
            <div class="mta-stat-label">ครูที่มีค้าง</div>
          </div>
          <div class="mta-stat-card mta-stat-info">
            <div class="mta-stat-num">{{ uniqueDateCount }}</div>
            <div class="mta-stat-label">วันที่มีค้าง</div>
          </div>
          <div class="mta-stat-card mta-stat-neutral">
            <div class="mta-stat-num">{{ filteredRows.length }}</div>
            <div class="mta-stat-label">แสดงอยู่ (หลังกรอง)</div>
          </div>
        </div>

        <!-- Teacher summary report -->
        <div class="mta-teacher-summary">
          <div class="mta-teacher-summary-title-row">
            <div class="mta-teacher-summary-title">📊 สรุปการลืมบันทึก รายครู</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <el-button size="small" type="success" :loading="notifySending"
                :disabled="!teacherSummary.length"
                @click="openNotifyAll">
                📨 แจ้งเตือนทุกคน
              </el-button>
              <el-button size="small" type="warning" @click="printSummary">🖨️ พิมพ์ตารางสรุป</el-button>
              <el-button size="small" type="danger" @click="printAllTeachers">🖨️ พิมพ์ทุกคน</el-button>
            </div>
          </div>
          <el-table
            :data="teacherSummary"
            size="small"
            border
            class="mta-summary-table"
            :header-cell-style="{ background:'#1e40af', color:'white', fontWeight:'700', fontSize:'12px' }"
          >
            <el-table-column label="ที่" width="50" align="center">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column label="รหัสครู" width="90" prop="id" align="center">
              <template #default="{ row }">
                <span class="summary-code">{{ row.id || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="ชื่อ-สกุล" min-width="160" prop="name" />
            <el-table-column label="คาบค้าง" width="80" align="center" prop="count">
              <template #default="{ row }">
                <el-tag type="danger" size="small" effect="dark">{{ row.count }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="รายงาน" width="90" align="center">
              <template #default="{ row }">
                <el-button size="small" type="primary" plain @click="printOneTeacher(row)">🖨️ พิมพ์</el-button>
              </template>
            </el-table-column>
            <el-table-column label="แจ้งเตือน" width="110" align="center">
              <template #default="{ row }">
                <el-button size="small" type="success" plain @click="openNotifyOne(row)">📨 ส่ง</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- ── Notify Dialog ── -->
        <el-dialog v-model="notifyDlg.show" title="📨 ส่งข้อความแจ้งเตือนครู" width="480px" destroy-on-close>
          <div class="notify-target-row">
            <el-tag :type="notifyDlg.targetAll ? 'success' : 'info'" size="large" effect="light">
              {{ notifyDlg.targetAll
                ? `ครูทุกคนที่มีค้าง (${teacherSummary.length} คน)`
                : `เฉพาะ ${notifyDlg.targetName}` }}
            </el-tag>
          </div>
          <div class="mt-3 mb-1 text-xs font-bold text-gray-600">ประเภทข้อความ</div>
          <el-radio-group v-model="notifyDlg.type" class="mb-3">
            <el-radio-button value="reminder">🔔 แจ้งเตือน</el-radio-button>
            <el-radio-button value="urgent">⚠️ เร่งด่วน</el-radio-button>
            <el-radio-button value="info">ℹ️ ทั่วไป</el-radio-button>
          </el-radio-group>
          <div class="mt-1 mb-1 text-xs font-bold text-gray-600">ข้อความแจ้งเตือน (แก้ไขได้)</div>
          <el-input
            v-model="notifyDlg.message"
            type="textarea" :rows="4"
            style="font-size:13px"
          />
          <el-button size="small" plain class="mt-1" @click="copyNotifyMsg">📋 คัดลอก</el-button>
          <template #footer>
            <el-button @click="notifyDlg.show = false">ยกเลิก</el-button>
            <el-button type="success" :loading="notifySending" @click="sendNotify">
              📨 ส่งข้อความ
            </el-button>
          </template>
        </el-dialog>

        <!-- Filter bar -->
        <div class="mta-filter-bar">
          <TeacherSelect
            v-model="filterTeacher"
            :teachers="teacherOptions"
            placeholder="ครูทั้งหมด"
            clearable
            size="small"
            style="min-width:200px"
          />

          <el-date-picker
            v-model="filterDate"
            type="date"
            placeholder="เลือกวันที่"
            size="small"
            clearable
            style="width:160px"
            value-format="YYYY-MM-DD"
          />

          <el-button
            v-if="filterTeacher || filterDate"
            size="small"
            plain
            @click="filterTeacher = ''; filterDate = ''"
          >✕ ล้างตัวกรอง</el-button>

          <span class="mta-filter-result" v-if="filterTeacher || filterDate">
            แสดง {{ filteredRows.length }} รายการ
          </span>

          <el-button size="small" type="warning" class="ml-auto" @click="printDetail" :disabled="!filteredRows.length">
            🖨️ พิมพ์รายละเอียด
          </el-button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="mta-loading"><el-skeleton :rows="6" animated /></div>

        <!-- Empty -->
        <div v-else-if="!filteredRows.length" class="mta-empty">
          <div class="mta-empty-icon">🎉</div>
          <div class="mta-empty-title">ไม่พบรายการค้างบันทึก</div>
          <div class="mta-empty-sub">{{ filterTeacher || filterDate ? 'ไม่มีข้อมูลตามเงื่อนไขที่เลือก' : `ทุกคาบใน ${maxDays} วันที่ผ่านมาบันทึกครบแล้ว` }}</div>
        </div>

        <!-- Table -->
        <div v-else class="mta-table-wrap">
          <el-table
            :data="filteredRows"
            stripe
            border
            size="small"
            row-class-name="mta-trow"
            class="mta-table"
          >
            <el-table-column label="วันที่" width="160" sortable prop="date">
              <template #default="{ row }">
                <div class="tbl-date">{{ thaiDateLabel(row.date) }}</div>
                <div class="tbl-relative">{{ relativeLabel(row.date) }}</div>
              </template>
            </el-table-column>

            <el-table-column label="คาบ" width="60" sortable prop="period" align="center">
              <template #default="{ row }">
                <el-tag type="danger" size="small" effect="dark">{{ row.period }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="ครูผู้สอน" min-width="170" sortable prop="teacher_plan_name">
              <template #default="{ row }">
                <div class="tbl-teacher">{{ row.teacher_plan_name || '—' }}</div>
                <div class="tbl-code" v-if="row.teacher_plan_id">{{ row.teacher_plan_id }}</div>
              </template>
            </el-table-column>

            <el-table-column label="วิชา" min-width="160">
              <template #default="{ row }">
                <div class="tbl-subject">{{ row.subject_name || '—' }}</div>
                <div class="tbl-code" v-if="row.subject_plan_id">{{ row.subject_plan_id }}</div>
              </template>
            </el-table-column>

            <el-table-column label="ห้องเรียน" width="100" sortable prop="class_id">
              <template #default="{ row }">
                <span class="tbl-class">{{ row.class_name || row.class_id || '—' }}</span>
              </template>
            </el-table-column>

          </el-table>
        </div>

      </template>

      <!-- ══ TEACHER: card view ══ -->
      <template v-else>

        <!-- Loading -->
        <div v-if="loading" class="mta-loading"><el-skeleton :rows="4" animated /></div>

        <!-- Empty -->
        <div v-else-if="!groups.length" class="mta-empty">
          <div class="mta-empty-icon">🎉</div>
          <div class="mta-empty-title">ไม่มีรายวิชาที่ค้างบันทึก</div>
          <div class="mta-empty-sub">ทุกคาบใน {{ maxDays }} วันที่ผ่านมาบันทึกครบแล้ว</div>
        </div>

        <!-- Groups -->
        <div v-else class="mta-groups">
          <div v-for="group in groups" :key="group.dateKey" class="mta-group">

            <div class="mta-date-header">
              <span class="mta-date-label">{{ group.dateLabel }}</span>
              <el-tag size="small" :type="group.daysAgo <= 1 ? 'warning' : 'danger'" effect="dark" class="mta-relative-tag">
                {{ group.relativeLabel }}
              </el-tag>
              <span class="mta-count-chip">{{ group.items.length }} คาบ</span>
            </div>

            <div class="mta-cards">
              <div v-for="item in group.items" :key="item.id" class="mta-card">
                <div class="mta-card-left">
                  <div class="mta-period-badge">
                    <div class="mta-period-num">{{ item.period }}</div>
                    <div class="mta-period-lbl">คาบ</div>
                  </div>
                  <div class="mta-card-info">
                    <div class="mta-subject">{{ item.subject_name || item.subject_plan_id || '—' }}</div>
                    <div class="mta-meta">
                      <span class="mta-class-chip">{{ item.class_name || item.class_id }}</span>
                      <span v-if="item.subject_plan_id" class="mta-code">{{ item.subject_plan_id }}</span>
                    </div>
                  </div>
                </div>
                <el-button type="danger" size="small" class="mta-fill-btn" @click="goToDetail(item)">
                  กรอก
                </el-button>
              </div>
            </div>

          </div>
        </div>

      </template>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { supabase } from '@/supabase/client'

const router      = useRouter()
const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getUnfilledTeachActuals } = useSchoolDb()

const loading      = ref(false)
const allData      = ref([])
const filterTeacher = ref('')
const filterDate    = ref('')

// ── Notify dialog ──────────────────────────────────────────────────────────
const notifySending = ref(false)
const notifyDlg = reactive({
  show:       false,
  targetAll:  false,
  targetId:   '',
  targetName: '',
  type:       'reminder',
  message:    '',
})

function defaultMessage(teacherName, count) {
  return `เรียน ${teacherName || 'คุณครู'}\nขณะนี้ท่านมีรายการบันทึกการสอนค้างอยู่ ${count || ''} คาบ กรุณาดำเนินการให้เป็นปัจจุบัน\nขอบคุณครับ/ค่ะ`
}

function openNotifyOne(row) {
  notifyDlg.targetAll  = false
  notifyDlg.targetId   = row.id || ''
  notifyDlg.targetName = row.name || ''
  notifyDlg.type       = 'reminder'
  notifyDlg.message    = defaultMessage(row.name, row.count)
  notifyDlg.show       = true
}

function openNotifyAll() {
  notifyDlg.targetAll  = true
  notifyDlg.targetId   = ''
  notifyDlg.targetName = ''
  notifyDlg.type       = 'reminder'
  notifyDlg.message    = `เรียน คณะครูที่มีรายการค้างบันทึก\nขณะนี้ท่านมีรายการบันทึกการสอนค้างอยู่ กรุณาดำเนินการให้เป็นปัจจุบัน\nขอบคุณครับ/ค่ะ`
  notifyDlg.show       = true
}

function copyNotifyMsg() {
  navigator.clipboard.writeText(notifyDlg.message).catch(() => {})
  ElMessage.success('คัดลอกแล้ว')
}

async function sendNotify() {
  if (!notifyDlg.message.trim()) { ElMessage.warning('กรุณาพิมพ์ข้อความ'); return }
  notifySending.value = true
  try {
    const schoolId   = authStore.schoolId
    const authorId   = authStore.profile?.uid || authStore.profile?.teacher_id || ''
    const authorName = authStore.profile?.displayName || authStore.profile?.name || 'ผู้บริหาร'
    if (notifyDlg.targetAll) {
      // ส่งทุกครูที่มีค้าง — insert แยกแต่ละคนเพื่อให้ filter per-teacher ใช้งานได้
      const rows = teacherSummary.value.map(t => ({
        school_id:        schoolId,
        author_id:        authorId,
        author_name:      authorName,
        author_role:      'admin',
        content:          defaultMessage(t.name, t.count),
        type:             notifyDlg.type,
        target_teacher_id: t.id || null,
      }))
      const { error } = await supabase.from('school_announcements').insert(rows)
      if (error) throw error
      ElMessage.success(`ส่งข้อความถึงครู ${rows.length} คน เรียบร้อย`)
    } else {
      const { error } = await supabase.from('school_announcements').insert({
        school_id:        schoolId,
        author_id:        authorId,
        author_name:      authorName,
        author_role:      'admin',
        content:          notifyDlg.message,
        type:             notifyDlg.type,
        target_teacher_id: notifyDlg.targetId || null,
      })
      if (error) throw error
      ElMessage.success('ส่งข้อความเรียบร้อย')
    }
    notifyDlg.show = false
  } catch (e) {
    ElMessage.error('ส่งข้อความไม่สำเร็จ: ' + e.message)
  } finally {
    notifySending.value = false
  }
}

// ── Role ──────────────────────────────────────────────────────────────────
const isAdmin = computed(() =>
  authStore.hasAnyRole(['school_admin', 'admin', 'superadmin', 'school_director'])
)

const myTeacherId = computed(() =>
  String(authStore.profile?.teacher_id || authStore.profile?.uid || '')
)

// ── School info ──────────────────────────────────────────────────────────
const schoolName = computed(() =>
  schoolStore.settingsObj?.school_info?.school_name_th ||
  schoolStore.schoolInfo?.name || 'โรงเรียน'
)
const schoolLogo = computed(() =>
  schoolStore.schoolInfo?.settings?.logo_url ||
  schoolStore.settingsObj?.logo_url || ''
)

// ── Config ────────────────────────────────────────────────────────────────
const maxDays = computed(() => {
  const tl = schoolStore.schoolInfo?.settings?.teaching_log_settings || {}
  return Number(tl.backdating_days ?? schoolStore.schoolInfo?.backdating_days ?? 14)
})

// ── Helpers ───────────────────────────────────────────────────────────────
function toDateKey(d) {
  return d.toISOString().split('T')[0]
}

function thaiDateLabel(dateKey) {
  const [y, m, day] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, day)
    .toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function relativeLabel(dateKey) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const daysAgo = Math.round((today - dt) / 86400000)
  if (daysAgo === 0) return 'วันนี้'
  if (daysAgo === 1) return 'เมื่อวาน'
  return `${daysAgo} วันที่แล้ว`
}

// ── Teacher view data ─────────────────────────────────────────────────────
const unfilled = computed(() => {
  const myId = myTeacherId.value
  return allData.value.filter(r => {
    // ถ้ามีครูสอนแทนรับมอบหมายแล้ว (is_substitute_mandatory=true) → ให้ครูสอนแทนรับผิดชอบ
    // ครูเจ้าของคาบ (teacher_plan_id) ที่ลาอยู่ ไม่ต้องแสดงในรายการของตัวเอง
    if (r.is_substitute_mandatory && r.subject_actual_teacher_id) {
      return String(r.subject_actual_teacher_id) === myId
    }
    return String(r.teacher_plan_id) === myId
  })
})

const groups = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const byDate = {}
  for (const item of unfilled.value) {
    if (!byDate[item.date]) byDate[item.date] = []
    byDate[item.date].push(item)
  }
  return Object.keys(byDate)
    .sort((a, b) => b.localeCompare(a))
    .map(dateKey => {
      const [y, m, d] = dateKey.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      const daysAgo = Math.round((today - dt) / 86400000)
      const rel = daysAgo === 0 ? 'วันนี้' : daysAgo === 1 ? 'เมื่อวาน' : `${daysAgo} วันที่แล้ว`
      const items = byDate[dateKey].slice().sort((a, b) => (a.period || 0) - (b.period || 0))
      return { dateKey, dateLabel: thaiDateLabel(dateKey), daysAgo, relativeLabel: rel, items }
    })
})

// ── Admin view data ───────────────────────────────────────────────────────
const adminUnfilled = computed(() => allData.value)

const teacherOptions = computed(() => {
  const map = {}
  for (const r of adminUnfilled.value) {
    const id = r.teacher_plan_id
    if (id && !map[id]) map[id] = r.teacher_plan_name || id
  }
  return Object.entries(map)
    .map(([teacher_id, fullName]) => ({ teacher_id, name: fullName, surname: '', prefix: '', photo_url: '' }))
    .sort((a, b) => String(a.teacher_id).localeCompare(String(b.teacher_id), 'th', { numeric: true }))
})

const filteredRows = computed(() => {
  let rows = adminUnfilled.value
  if (filterTeacher.value) {
    rows = rows.filter(r => r.teacher_plan_id === filterTeacher.value)
  }
  if (filterDate.value) {
    rows = rows.filter(r => r.date === filterDate.value)
  }
  return rows.slice().sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    if (a.teacher_plan_id !== b.teacher_plan_id) return (a.teacher_plan_name || '').localeCompare(b.teacher_plan_name || '', 'th')
    return (a.period || 0) - (b.period || 0)
  })
})

const uniqueTeacherCount = computed(() =>
  new Set(adminUnfilled.value.map(r => r.teacher_plan_id).filter(Boolean)).size
)
const uniqueDateCount = computed(() =>
  new Set(adminUnfilled.value.map(r => r.date).filter(Boolean)).size
)

const teacherSummary = computed(() => {
  const map = {}
  for (const r of adminUnfilled.value) {
    const id = r.teacher_plan_id || '—'
    if (!map[id]) map[id] = { id, name: r.teacher_plan_name || id, count: 0 }
    map[id].count++
  }
  return Object.values(map).sort((a, b) => b.count - a.count)
})

const displayCount = computed(() =>
  isAdmin.value ? filteredRows.value.length : unfilled.value.length
)

// ── Data loading ──────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    allData.value = await getUnfilledTeachActuals()
  } catch (e) {
    console.error('loadData error', e)
    allData.value = []
  } finally {
    loading.value = false
  }
}

async function goToDetail(item) {
  let taId = item.teach_actual_id || item.id
  if (!taId) {
    // คาบที่ยังไม่มี record ใน DB → upsert ก่อน แล้วค่อย navigate
    const { data, error } = await supabase
      .from('teach_actuals')
      .upsert([{
        school_id:          authStore.schoolId,
        term_id:            schoolStore.currentTerm || '2568_1',
        class_id:           item.class_id,
        date:               item.date,
        period_number:      item.period_number || item.period,
        slot_type:          item.slot_type || 'regular',
        planned_teacher_id: item.teacher_plan_id || '',
        subject_id:         item.subject_plan_id || item.subject_id || null,
        is_filled:          false,
      }], { onConflict: 'school_id,term_id,class_id,date,period_number' })
      .select('id')
      .single()
    if (error || !data) {
      ElMessage.error('สร้างบันทึกไม่สำเร็จ: ' + (error?.message || 'ไม่ทราบสาเหตุ'))
      return
    }
    taId = data.id
  }
  router.push({
    name: 'TeachActualDetail',
    params: { id: taId },
    query: {
      sn:  item.subject_name      || '',
      si:  item.subject_plan_id   || '',
      tpi: item.teacher_plan_id   || '',
      tpn: item.teacher_plan_name || '',
    },
  })
}

function printBaseStyle() {
  return `@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap');
  @page { margin: 15mm; }
  * { font-family: 'Sarabun','TH Sarabun New','Tahoma',sans-serif; font-size: 14px; }
  body { color: #000; }
  h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 15px; text-align: center; margin: 0 0 6px; font-weight: 700; }
  .meta { text-align:center; font-size:12px; color:#555; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead { display:table-header-group; }
  thead th { background:#1e40af; color:white; padding:6px 10px; border:1px solid #1e40af; font-weight:700; }
  tbody td { padding:5px 10px; border:1px solid #ddd; }
  tr { page-break-inside:avoid; }
  .sign-row { display:flex; justify-content:flex-end; margin-top:40px; text-align:center; }
  .sign-box { width:220px; }
  .sign-line { border-top:1px solid #000; margin-top:60px; margin-bottom:4px; }`
}

function openPrint(title, html) {
  const win = window.open('', '_blank', 'width=860,height=700')
  if (!win) { ElMessage.warning('กรุณาอนุญาต popup เพื่อพิมพ์รายงาน'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

function printSummary() {
  const sName = schoolName.value
  const now = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const rangeLabel = `${maxDays.value} วันล่าสุด`

  const rows = teacherSummary.value.map((t, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center;font-weight:700">${t.id || '—'}</td>
      <td>${t.name || '—'}</td>
      <td style="text-align:center;font-weight:800;color:#dc2626">${t.count}</td>
    </tr>`).join('')

  openPrint('สรุปการลืมบันทึก', `<!DOCTYPE html><html lang="th">
<head><meta charset="UTF-8"><title>สรุปการลืมบันทึก</title>
<style>${printBaseStyle()}</style></head>
<body>
<h1>${sName}</h1>
<h2>รายงานสรุปการลืมบันทึกเข้าสอน</h2>
<p class="meta">ช่วงเวลา: ${rangeLabel}&ensp;|&ensp;วันที่พิมพ์: ${now}&ensp;|&ensp;คาบค้างรวม: <strong>${adminUnfilled.value.length}</strong> คาบ จาก <strong>${uniqueTeacherCount.value}</strong> ครู</p>
<table>
  <thead><tr>
    <th style="width:40px">ที่</th>
    <th style="width:90px">รหัสครู</th>
    <th>ชื่อ-สกุล</th>
    <th style="width:110px">จำนวนคาบค้าง</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="sign-row">
  <div class="sign-box">
    <div class="sign-line"></div>
    <div>ผู้อำนวยการโรงเรียน</div>
    <div style="font-size:12px;color:#555">(ลงนามรับทราบ)</div>
  </div>
</div>
</body></html>`)
}

function subjectLabel(r) {
  return r.subject_name || r.subject_plan_id || r.subject_id || '—'
}

function buildTeacherSection(id, name, rows) {
  const ths = 'background:#475569;color:white;padding:5px 8px;border:1px solid #475569;font-weight:700'
  return `
    <h3 style="font-size:14px;margin:18px 0 0;padding:6px 10px;background:#f1f5f9;border-left:4px solid #dc2626;page-break-after:avoid">
      ${id !== '—' ? id + '&ensp;' : ''}${name}&ensp;<span style="color:#dc2626">(${rows.length} คาบ)</span>
    </h3>
    <table style="font-size:13px;margin-top:0">
      <thead><tr>
        <th style="${ths};width:36px;text-align:center">ลำดับ</th>
        <th style="${ths}">วันที่</th>
        <th style="${ths};width:44px;text-align:center">คาบ</th>
        <th style="${ths};width:70px;text-align:center">ห้อง</th>
        <th style="${ths};width:90px">รหัสวิชา</th>
        <th style="${ths}">ชื่อวิชา</th>
      </tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td style="text-align:center;color:#6b7280">${i + 1}</td>
        <td>${thaiDateLabel(r.date)}</td>
        <td style="text-align:center">${r.period ?? ''}</td>
        <td style="text-align:center">${r.class_id || ''}</td>
        <td style="color:#7c3aed;font-weight:700">${r.subject_plan_id || r.subject_id || '—'}</td>
        <td>${subjectLabel(r)}</td>
      </tr>`).join('')}</tbody>
    </table>`
}

function printDetail() {
  const sName = schoolName.value
  const now = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const rangeLabel = `${maxDays.value} วันล่าสุด`
  const filterLabel = filterTeacher.value
    ? (teacherOptions.value.find(t => t.teacher_id === filterTeacher.value)?.name || filterTeacher.value)
    : 'ครูทุกคน'

  const detailByTeacher = {}
  for (const r of filteredRows.value) {
    const id = r.teacher_plan_id || '—'
    if (!detailByTeacher[id]) detailByTeacher[id] = { name: r.teacher_plan_name || id, rows: [] }
    detailByTeacher[id].rows.push(r)
  }
  const sections = Object.entries(detailByTeacher)
    .map(([id, { name, rows }]) => buildTeacherSection(id, name, rows)).join('')

  openPrint('รายละเอียดการลืมบันทึก', `<!DOCTYPE html><html lang="th">
<head><meta charset="UTF-8"><title>รายละเอียดการลืมบันทึก</title>
<style>${printBaseStyle()}</style></head>
<body>
<h1>${sName}</h1>
<h2>รายละเอียดการลืมบันทึกเข้าสอน (จำแนกตามครู)</h2>
<p class="meta">ช่วงเวลา: ${rangeLabel}&ensp;|&ensp;กรอง: ${filterLabel}&ensp;|&ensp;วันที่พิมพ์: ${now}&ensp;|&ensp;รวม <strong>${filteredRows.value.length}</strong> คาบ</p>
${sections}
</body></html>`)
}

function sortedTeacherRows(teacherId) {
  return adminUnfilled.value
    .filter(r => (r.teacher_plan_id || '—') === teacherId)
    .slice()
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.period || 0) - (b.period || 0))
}

function buildOneTeacherPage(schoolName, logoUrl, t, rows, rangeLabel, now) {
  const teacherLabel = `${t.id !== '—' ? t.id + ' ' : ''}${t.name}`
  const TH = (txt, extra = '') =>
    `<th style="background:#1e40af;color:white;padding:6px 10px;border:1px solid #1e40af;font-weight:700;${extra}">${txt}</th>`
  const dataRows = rows.map((r, i) => `<tr>
    <td style="text-align:center;color:#6b7280;border:1px solid #ddd;padding:4px 8px">${i + 1}</td>
    <td style="border:1px solid #ddd;padding:4px 8px">${thaiDateLabel(r.date)}</td>
    <td style="text-align:center;border:1px solid #ddd;padding:4px 8px">${r.period ?? ''}</td>
    <td style="text-align:center;border:1px solid #ddd;padding:4px 8px">${r.class_id || ''}</td>
    <td style="color:#7c3aed;font-weight:700;border:1px solid #ddd;padding:4px 8px">${r.subject_plan_id || r.subject_id || '—'}</td>
    <td style="border:1px solid #ddd;padding:4px 8px">${r.subject_name || '—'}</td>
  </tr>`).join('')
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" style="height:56px;object-fit:contain;display:block;margin:0 auto 4px" />`
    : '<div style="font-size:40px;text-align:center">🏫</div>'
  return `<div style="page-break-after:always">
<table style="width:100%;border-collapse:collapse;font-size:13px">
  <thead>
    <tr>
      <td colspan="6" style="border:none;text-align:center;padding:4px 0 10px">
        ${logoHtml}
        <div style="font-size:17px;font-weight:900">${schoolName}</div>
        <div style="font-size:14px;font-weight:700;margin:3px 0">รายงานการลืมบันทึกเข้าสอน</div>
        <div style="font-size:11px;color:#555">ครูผู้สอน: <b>${teacherLabel}</b>&ensp;|&ensp;ช่วง: ${rangeLabel}&ensp;|&ensp;วันที่พิมพ์: ${now}&ensp;|&ensp;รวม ${rows.length} คาบ</div>
      </td>
    </tr>
    <tr>
      ${TH('ลำดับ', 'width:36px;text-align:center')}
      ${TH('วันที่', 'text-align:left')}
      ${TH('คาบ', 'width:44px;text-align:center')}
      ${TH('ห้อง', 'width:64px;text-align:center')}
      ${TH('รหัสวิชา', 'width:90px;text-align:left')}
      ${TH('ชื่อวิชา', 'text-align:left')}
    </tr>
  </thead>
  <tbody>${dataRows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:12px">ไม่มีรายการ</td></tr>'}</tbody>
</table>
<div class="sign-row">
  <div class="sign-box">
    <div class="sign-line"></div>
    <div>(........................................)</div>
    <div style="font-size:12px;color:#555">ลายมือชื่อครู</div>
  </div>
</div>
</div>`
}

function printOneTeacher(t) {
  const sName = schoolName.value
  const sLogo = schoolLogo.value
  const now = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const rangeLabel = `${maxDays.value} วันล่าสุด`
  const rows = sortedTeacherRows(t.id)
  const page = buildOneTeacherPage(sName, sLogo, t, rows, rangeLabel, now)
  openPrint('รายงานลืมบันทึก ' + t.name, `<!DOCTYPE html><html lang="th">
<head><meta charset="UTF-8"><title>รายงานลืมบันทึก</title>
<style>${printBaseStyle()}</style></head>
<body>${page}</body></html>`)
}

function printAllTeachers() {
  const sName = schoolName.value
  const sLogo = schoolLogo.value
  const now = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const rangeLabel = `${maxDays.value} วันล่าสุด`
  const pages = teacherSummary.value
    .map(t => buildOneTeacherPage(sName, sLogo, t, sortedTeacherRows(t.id), rangeLabel, now))
    .join('')
  openPrint('รายงานลืมบันทึก ทุกคน', `<!DOCTYPE html><html lang="th">
<head><meta charset="UTF-8"><title>รายงานลืมบันทึก ทุกคน</title>
<style>${printBaseStyle()}</style></head>
<body>${pages}</body></html>`)
}

onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.mta-page {
  max-width: 780px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.mta-page--wide {
  max-width: 1100px;
}

/* ── Header ── */
.mta-header {
  background: linear-gradient(135deg, #b91c1c 0%, #dc2626 30%, #ea580c 65%, #f97316 100%);
  border-radius: 18px;
  padding: 22px 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(185,28,28,0.35);
}
.mta-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.mta-title { font-size: 22px; font-weight: 900; color: #fff; margin: 0 0 4px; text-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.mta-sub   { font-size: 13px; color: rgba(255,255,255,0.85); margin: 0; }
.mta-badge { font-weight: 800 !important; font-size: 13px !important; }
.mta-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mta-range-label { font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 600; }

/* ── Admin: Summary stats ── */
.mta-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.mta-stat-card {
  border-radius: 14px;
  padding: 16px;
  text-align: center;
  color: white;
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
}
.mta-stat-danger  { background: linear-gradient(135deg, #dc2626, #ef4444); }
.mta-stat-warning { background: linear-gradient(135deg, #d97706, #f97316); }
.mta-stat-info    { background: linear-gradient(135deg, #2563eb, #3b82f6); }
.mta-stat-neutral { background: linear-gradient(135deg, #475569, #64748b); }
.mta-stat-num {
  font-size: 32px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 5px;
}
.mta-stat-label { font-size: 11px; font-weight: 700; opacity: 0.9; }

/* ── Admin: Teacher summary ── */
.mta-teacher-summary {
  background: white;
  border: 2px solid #bfdbfe;
  border-radius: 14px;
  padding: 14px 16px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.mta-teacher-summary-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.mta-teacher-summary-title {
  font-size: 13px;
  font-weight: 800;
  color: #1e40af;
}
.mta-summary-table { border-radius: 8px; overflow: hidden; }
.summary-code { font-weight: 800; color: #7c3aed; font-size: 12px; }

/* ── Admin: Filter bar ── */
.mta-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.mta-filter-result {
  font-size: 12px;
  color: #64748b;
  font-weight: 700;
}

/* ── Table ── */
.mta-table-wrap {
  background: white;
  border-radius: 14px;
  border: 2px solid #fecaca;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(239,68,68,0.1);
}
.mta-table { width: 100%; }
:deep(.mta-trow td) { font-size: 13px; }

.tbl-date     { font-weight: 700; color: #1e293b; font-size: 12px; }
.tbl-relative { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.tbl-teacher  { font-weight: 700; color: #1e293b; }
.tbl-subject  { font-weight: 700; color: #1e293b; }
.tbl-code     { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.tbl-class    { font-weight: 800; color: #7c3aed; }

/* ── Loading / Empty ── */
.mta-loading { padding: 24px 0; }
.mta-empty {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 18px;
  border: 2px dashed #86efac;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.mta-empty-icon  { font-size: 52px; margin-bottom: 14px; }
.mta-empty-title { font-size: 20px; font-weight: 800; color: #15803d; margin-bottom: 8px; }
.mta-empty-sub   { font-size: 14px; color: #6b7280; }

/* ── Teacher: Groups ── */
.mta-groups { display: flex; flex-direction: column; gap: 20px; }
.mta-group {
  background: white;
  border-radius: 16px;
  border: 2px solid #fecaca;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(239,68,68,0.1);
}
.mta-date-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
}
.mta-date-label  { font-size: 14px; font-weight: 800; color: #fff; flex: 1; }
.mta-relative-tag { font-weight: 700; }
.mta-count-chip {
  font-size: 11px; font-weight: 800; color: #7c3aed;
  background: rgba(255,255,255,0.95); border-radius: 99px; padding: 2px 10px;
}
.mta-cards { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
.mta-card {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px; border-radius: 12px;
  border: 2px solid #fee2e2;
  background: linear-gradient(135deg, #fff5f5, #fff);
  transition: all 0.15s;
}
.mta-card:hover {
  border-color: #fca5a5;
  background: #fff5f5;
  box-shadow: 0 2px 8px rgba(239,68,68,0.12);
  transform: translateX(2px);
}
.mta-card-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.mta-period-badge {
  width: 54px; height: 54px; border-radius: 14px;
  background: linear-gradient(135deg, #dc2626, #ea580c);
  color: white;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 3px 8px rgba(220,38,38,0.4);
}
.mta-period-num { font-size: 20px; font-weight: 900; line-height: 1; }
.mta-period-lbl { font-size: 9px; font-weight: 700; opacity: 0.85; margin-top: 1px; }
.mta-card-info { min-width: 0; }
.mta-subject {
  font-size: 15px; font-weight: 800; color: #1e293b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mta-meta { font-size: 12px; color: #64748b; margin-top: 3px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.mta-class-chip {
  font-weight: 800; color: white;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  border-radius: 6px; padding: 1px 8px; font-size: 11px;
}
.mta-code  { color: #94a3b8; font-size: 11px; }
.mta-fill-btn { flex-shrink: 0; font-weight: 800 !important; min-width: 68px; }

/* ── Responsive ── */
@media (max-width: 640px) {
  .mta-stats { grid-template-columns: repeat(2, 1fr); }
  .mta-title-row { flex-direction: column; }
  .mta-badge { align-self: flex-start; }
}
@media (max-width: 480px) {
  .mta-stats { grid-template-columns: 1fr 1fr; }
}
</style>
