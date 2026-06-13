<template>
  <AppLayout>
    <!-- ถ้าปิดระบบความประพฤติ ให้แสดงข้อความเตือนและซ่อนเนื้อหา -->
    <div v-if="schoolStore.schoolInfo?.behavior_system_enabled === false" class="p-10 text-center">
      <el-empty description="ระบบคะแนนความประพฤติถูกปิดใช้งานโดยผู้ดูแลระบบ" />
    </div>

    <div v-else class="brv-page" v-loading="loading">

      <!-- Header -->
      <div class="brv-header">
        <div>
          <h1 class="brv-title">📊 รายงานพฤติกรรมนักเรียน</h1>
          <p class="brv-sub">สรุปคะแนนพฤติกรรมรายบุคคล พร้อมประวัติและหลักฐานภาพ</p>
        </div>
        <div class="brv-header-actions" v-if="hasData">
          <el-button plain @click="printReport">🖨 พิมพ์รายงาน</el-button>
          <el-button plain type="success" @click="exportExcel">📥 ส่งออก Excel</el-button>
        </div>
      </div>

      <!-- Filters -->
      <el-card class="brv-filter-card mb-5">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="brv-filter-group">
            <div class="brv-filter-label">ห้องเรียน</div>
            <el-select v-model="filterClassId" placeholder="ทุกห้อง" clearable style="width:180px">
              <el-option v-for="cls in classes" :key="cls.class_id" :label="cls.class_name||cls.class_id" :value="cls.class_id" />
            </el-select>
          </div>
          <div class="brv-filter-group">
            <div class="brv-filter-label">ประเภทพฤติกรรม</div>
            <el-select v-model="filterType" style="width:190px">
              <el-option label="ทั้งหมด"              value="" />
              <el-option label="ความประพฤติทั่วไป"    value="general" />
              <el-option label="พฤติกรรมในห้องเรียน"  value="inclass" />
            </el-select>
          </div>
          <div class="brv-filter-group">
            <div class="brv-filter-label">คะแนนรวม ≥</div>
            <el-input-number v-model="scoreMin" :min="-9999" :max="9999" :step="10" style="width:110px" controls-position="right" />
          </div>
          <div class="brv-filter-group">
            <div class="brv-filter-label">คะแนนรวม ≤</div>
            <el-input-number v-model="scoreMax" :min="-9999" :max="9999" :step="10" style="width:110px" controls-position="right" />
          </div>
          <el-button type="primary" :loading="loading" @click="loadReport">ดูรายงาน</el-button>
          <el-button v-if="hasData" plain @click="resetFilters">รีเซ็ต</el-button>
        </div>
      </el-card>

      <!-- Empty state -->
      <el-empty v-if="!loading && !hasData" description="เลือกตัวกรองแล้วกด 'ดูรายงาน'" />

      <!-- Report area -->
      <div v-if="hasData" id="brv-print-area">

        <!-- Filter context banner -->
        <div class="brv-context-banner mb-4">
          <div class="brv-context-left">
            <span class="brv-context-label">📋 รายงานพฤติกรรมนักเรียน</span>
            <span class="brv-context-sep">·</span>
            <span class="brv-context-item">🏫 {{ className || 'ทุกห้องเรียน' }}</span>
            <template v-if="filterType">
              <span class="brv-context-sep">·</span>
              <span class="brv-context-item">{{ filterTypeLabel }}</span>
            </template>
            <template v-if="scoreMin != null || scoreMax != null">
              <span class="brv-context-sep">·</span>
              <span class="brv-context-item brv-context-score">
                คะแนน
                <template v-if="scoreMin != null"> ≥ {{ scoreMin }}</template>
                <template v-if="scoreMin != null && scoreMax != null"> และ</template>
                <template v-if="scoreMax != null"> ≤ {{ scoreMax }}</template>
              </span>
            </template>
          </div>
          <div class="brv-context-right">
            <span class="brv-context-count">แสดง {{ filteredRows.length }} / {{ reportRows.length }} คน</span>
            <span class="brv-context-term">ภาคเรียน {{ currentTerm }}</span>
          </div>
        </div>

        <!-- Summary table -->
        <el-table
          :data="filteredRows"
          border stripe
          row-key="student_id"
          :header-cell-style="{ background:'#db2777', color:'white', fontWeight:'600' }"
          class="brv-main-table"
        >
          <el-table-column label="ที่" width="52" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column prop="student_id" label="รหัส" width="90" />
          <el-table-column label="ชื่อ-นามสกุล" min-width="160">
            <template #default="{ row }">{{ row.prefix || '' }}{{ row.name }} {{ row.surname }}</template>
          </el-table-column>
          <el-table-column label="ยกมา" width="75" align="center">
            <template #default="{ row }">
              <span class="text-gray-500 font-medium">{{ row.summary?.carry_over_score ?? 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="รวม" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="scoreTagType(row.summary?.total_score)" size="small" effect="dark">
                {{ row.summary?.total_score ?? 0 }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="ทั่วไป" width="80" align="center">
            <template #default="{ row }">
              <span :class="scoreClass(row.summary?.general_score)">{{ row.summary?.general_score ?? 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ในห้องเรียน" width="100" align="center">
            <template #default="{ row }">
              <span :class="scoreClass(row.summary?.inclass_score)">{{ row.summary?.inclass_score ?? 0 }}</span>
            </template>
          </el-table-column>
          <!-- Detail icon column -->
          <el-table-column label="รายละเอียด" width="96" align="center" class-name="brv-no-print">
            <template #default="{ row }">
              <el-button
                size="small"
                :type="expandedStudentId === row.student_id ? 'primary' : 'default'"
                :plain="expandedStudentId !== row.student_id"
                circle
                @click.stop="openDetail(row)"
                title="ดูรายละเอียด"
                style="font-size:15px"
              >{{ expandedStudentId === row.student_id ? '▲' : '📋' }}</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- Individual student detail panel -->
        <div ref="detailAreaRef">
          <el-card
            v-if="expandedStudentId"
            class="mt-5 brv-no-print brv-detail-card"
            shadow="never"
            id="brv-detail-area"
          >
            <!-- Detail header -->
            <div class="brv-detail-head">
              <div class="brv-detail-head-left">
                <!-- photo + info row -->
                <div class="flex items-center gap-3">
                  <el-avatar
                    :size="64"
                    :src="expandedStudentRow?.photo_url || ''"
                    :style="{ border: '2px solid #db2777', flexShrink: 0 }"
                  >
                    <span style="font-size:22px">👤</span>
                  </el-avatar>
                  <div>
                    <div class="brv-detail-name">{{ expandedStudentName }}</div>
                    <div class="brv-detail-meta">
                      <span>🆔 {{ expandedStudentId }}</span>
                      <span v-if="className">🏫 {{ className }}</span>
                      <span>ภาคเรียน {{ currentTerm }}</span>
                    </div>
                    <div class="brv-detail-scores" v-if="expandedStudentRow">
                      <el-tag type="info" size="small" plain class="mr-1">
                        ยกมา {{ expandedStudentRow.summary?.carry_over_score ?? 0 }}
                      </el-tag>
                      <el-tag :type="scoreTagType(expandedStudentRow.summary?.total_score)" size="small" effect="dark" class="mr-1">
                        รวม {{ expandedStudentRow.summary?.total_score ?? 0 }}
                      </el-tag>
                    </div>
                  </div>
                </div>
                <!-- filter ตารางรายละเอียด -->
                <div class="mt-2 flex gap-2" v-if="detailLogs.length">
                  <el-button
                    v-for="opt in [{label:'รวม',value:''},{label:'ทั่วไป',value:'general'},{label:'ในห้องเรียน',value:'inclass'}]"
                    :key="opt.value"
                    size="small"
                    :type="detailFilterType === opt.value ? 'primary' : ''"
                    :plain="detailFilterType !== opt.value"
                    @click="detailFilterType = opt.value"
                  >{{ opt.label }}</el-button>
                </div>
              </div>
              <div class="brv-detail-head-right">
                <el-button size="small" type="primary" plain @click="printDetail">🖨 พิมพ์หน้าจอ</el-button>
                <el-button size="small" type="warning" plain @click="printDetailPdf">📄 PDF</el-button>
                <el-button size="small" type="success" plain @click="exportDetailExcel">📥 Excel</el-button>
                <el-button size="small" @click="expandedStudentId=null">✕ ปิด</el-button>
              </div>
            </div>

            <!-- Detail log table with images inline + summary row -->
            <div v-loading="loadingDetail">
              <el-empty v-if="!loadingDetail && !detailLogs.length" description="ไม่มีประวัติพฤติกรรม" />
              <el-table
                v-else
                :data="filteredDetailLogs"
                size="small"
                border
                show-summary
                :summary-method="detailSummaryMethod"
                :header-cell-style="{ background:'#1e3a8a', color:'white', fontWeight:'600' }"
                class="brv-detail-table"
              >
                <el-table-column type="index" label="ที่" width="44" align="center" />
                <el-table-column label="วันที่" width="118">
                  <template #default="{ row }">{{ thaiDate(row.date || row.created_at?.substring(0, 10)) }}</template>
                </el-table-column>
                <el-table-column label="พฤติกรรม" min-width="140">
                  <template #default="{ row }">{{ row.label_snapshot || '—' }}</template>
                </el-table-column>
                <el-table-column label="ประเภท" width="140">
                  <template #default="{ row }">{{ row.behavior_type_label_snapshot || BEHAVIOR_TYPE_LABELS[row.behavior_type] || row.behavior_type || '—' }}</template>
                </el-table-column>
                <el-table-column label="คะแนน" width="78" align="center">
                  <template #default="{ row }">
                    <span :class="row.points_change>=0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'">
                      {{ row.points_change>=0 ? '+' : '' }}{{ row.points_change }}
                    </span>
                  </template>
                </el-table-column>
                <!-- Image thumbnails column (inline in table) -->
                <el-table-column label="ภาพประกอบ" width="240" align="center">
                  <template #default="{ row }">
                    <div v-if="row.image_urls?.length" class="brv-cell-imgs">
                      <a
                        v-for="img in row.image_urls"
                        :key="imgUrl(img)"
                        :href="getGDriveViewUrl(imgUrl(img))"
                        target="_blank"
                        rel="noopener"
                        class="brv-cell-img-link"
                        title="เปิดใน Google Drive"
                      >
                        <img
                          :src="getGDriveDisplayUrl(imgUrl(img))"
                          class="brv-cell-thumb"
                          :alt="row.label_snapshot"
                          referrerpolicy="no-referrer"
                        />
                      </a>
                    </div>
                    <span v-else class="text-gray-300 text-xs">–</span>
                  </template>
                </el-table-column>
                <el-table-column prop="note" label="หมายเหตุ" min-width="110" />
                <el-table-column label="บันทึกโดย" width="110">
                  <template #default="{ row }">{{ row.recorded_by_name_snapshot || '—' }}</template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
        </div>

      </div><!-- /report area -->
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useSchoolStore } from '@/stores/school'

const { getClasses, getStudents, getBehaviorSummary, getBehaviorLogs } = useSchoolDb()
const schoolStore = useSchoolStore()

const BEHAVIOR_TYPE_LABELS = {
  general: 'ความประพฤติทั่วไป',
  attendance: 'พฤติกรรมในห้องเรียน',
  learning: 'พฤติกรรมในห้องเรียน',
  inclass: 'พฤติกรรมในห้องเรียน',
}
const currentTerm = computed(() => schoolStore.termLabel || schoolStore.currentTerm || '')

// ─── Filter state ──────────────────────────────────────────────
const classes       = ref([])
const filterClassId = ref(null)
const filterType    = ref('')
const scoreMin      = ref(null)
const scoreMax      = ref(null)
const loading       = ref(false)
const reportRows    = ref([])

const className = computed(() => {
  const c = classes.value.find(c => c.class_id === filterClassId.value)
  return c ? (c.class_name || c.class_id) : ''
})

const filterTypeLabel = computed(() => {
  const map = { general: 'ความประพฤติทั่วไป', inclass: 'พฤติกรรมในห้องเรียน' }
  return map[filterType.value] || ''
})

const hasData = computed(() => reportRows.value.length > 0)

const filteredRows = computed(() => {
  let rows = reportRows.value
  if (scoreMin.value != null) rows = rows.filter(r => (r.summary?.total_score ?? 0) >= scoreMin.value)
  if (scoreMax.value != null) rows = rows.filter(r => (r.summary?.total_score ?? 0) <= scoreMax.value)
  return rows
})

// ─── Expand / detail state ─────────────────────────────────────
const detailAreaRef       = ref(null)
const expandedStudentId   = ref(null)
const expandedStudentName = ref('')
const detailLogs          = ref([])
const loadingDetail       = ref(false)
const detailFilterType    = ref('')

const expandedStudentRow = computed(() =>
  filteredRows.value.find(r => r.student_id === expandedStudentId.value) || null
)

const filteredDetailLogs = computed(() => {
  if (!detailFilterType.value) return detailLogs.value
  if (detailFilterType.value === 'inclass') return detailLogs.value.filter(r => ['attendance', 'learning'].includes(r.behavior_type))
  return detailLogs.value.filter(r => r.behavior_type === detailFilterType.value)
})

// ─── Load classes ──────────────────────────────────────────────
onMounted(async () => {
  try { classes.value = await getClasses() }
  catch (e) { ElMessage.error('โหลดห้องเรียนไม่สำเร็จ: ' + e.message) }
})

// ─── Load report ───────────────────────────────────────────────
async function loadReport() {
  loading.value = true
  expandedStudentId.value = null
  try {
    const [students, allLogs] = await Promise.all([
      getStudents(filterClassId.value || null),
      getBehaviorLogs(filterClassId.value ? { classId: filterClassId.value } : {}),
    ])

    // Compute scores from actual log entries
    const logSums = {}
    for (const log of allLogs) {
      const sid = log.student_id
      if (!logSums[sid]) logSums[sid] = { general: 0, attendance: 0, learning: 0 }
      if (log.behavior_type === 'general')    logSums[sid].general    += (log.points_change || 0)
      else if (log.behavior_type === 'attendance') logSums[sid].attendance += (log.points_change || 0)
      else if (log.behavior_type === 'learning')   logSums[sid].learning   += (log.points_change || 0)
    }

    reportRows.value = students.map((s) => {
      const sums        = logSums[s.student_id] || { general: 0, attendance: 0, learning: 0 }
      const carryOver   = s.behavior_carry_over ?? 0
      const general     = sums.general
      const attendance  = sums.attendance
      const learning    = sums.learning
      return {
        ...s,
        summary: {
          carry_over_score: carryOver,
          general_score:    general,
          attendance_score: attendance,
          learning_score:   learning,
          total_score:      carryOver + general + attendance + learning,
          inclass_score:    attendance + learning,
        }
      }
    })
  } catch (e) {
    ElMessage.error('โหลดรายงานไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filterClassId.value = null
  filterType.value    = ''
  scoreMin.value      = null
  scoreMax.value      = null
}

// ─── Open detail + scroll ──────────────────────────────────────
async function openDetail(row) {
  // Toggle close
  if (expandedStudentId.value === row.student_id) {
    expandedStudentId.value = null
    detailLogs.value = []
    return
  }
  expandedStudentId.value   = row.student_id
  expandedStudentName.value = `${row.prefix || ''}${row.name || ''} ${row.surname || ''}`.trim()
  detailLogs.value          = []
  detailFilterType.value    = ''
  loadingDetail.value       = true

  // Wait for detail panel to mount then scroll
  await nextTick()
  detailAreaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  try {
    detailLogs.value = await getBehaviorLogs({ studentId: row.student_id })
  } catch (e) {
    ElMessage.error('โหลดประวัติไม่สำเร็จ: ' + e.message)
  } finally {
    loadingDetail.value = false
  }
}

// ─── Detail table summary row ──────────────────────────────────
function detailSummaryMethod({ columns }) {
  const data = filteredDetailLogs.value
  const totalChange = data.reduce((s, r) => s + (r.points_change || 0), 0)
  return columns.map(col => {
    if (col.label === 'ที่')    return '📊 รวม'
    if (col.label === 'คะแนน') return (totalChange >= 0 ? '+' : '') + totalChange + ' คะแนน'
    return ''
  })
}

// ─── Image URL helpers ─────────────────────────────────────────
function imgUrl(img) {
  if (typeof img === 'string') {
    // Handle JSON-encoded object strings (stored as TEXT[] instead of JSONB)
    try { const p = JSON.parse(img); if (p?.url) return p.url } catch {}
    return img
  }
  return img?.url || ''
}

function extractGDriveFileId(url) {
  if (!url) return null
  // Strict char class: only valid Drive ID chars (alphanumeric, hyphen, underscore)
  const patterns = [
    /lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/,
    /\/file\/d\/([A-Za-z0-9_-]+)/,
    /[?&]id=([A-Za-z0-9_-]+)/,
    /\/d\/([A-Za-z0-9_-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

function getGDriveDisplayUrl(url) {
  const id = extractGDriveFileId(url)
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w200-h200` : url
}

function getGDriveViewUrl(url) {
  const id = extractGDriveFileId(url)
  return id ? `https://drive.google.com/file/d/${id}/view` : url
}

// ─── Print summary ─────────────────────────────────────────────
function printReport() {
  document.body.classList.add('brv-printing')
  window.print()
  setTimeout(() => document.body.classList.remove('brv-printing'), 1000)
}

// ─── Print detail ──────────────────────────────────────────────
function printDetail() {
  document.body.classList.add('brv-printing-detail')
  window.print()
  setTimeout(() => document.body.classList.remove('brv-printing-detail'), 1000)
}

// ─── PDF print (table only, no images) ────────────────────────
function printDetailPdf() {
  const logs = filteredDetailLogs.value
  const total = logs.reduce((s, r) => s + (r.points_change || 0), 0)
  const typeLabel = { '': 'ทั้งหมด', general: 'ความประพฤติทั่วไป', inclass: 'พฤติกรรมในห้องเรียน' }[detailFilterType.value] || 'ทั้งหมด'
  const rows = logs.map((r, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${thaiDate(r.date || r.created_at?.substring(0, 10))}</td>
      <td>${r.label_snapshot || '—'}</td>
      <td>${r.behavior_type_label_snapshot || BEHAVIOR_TYPE_LABELS[r.behavior_type] || r.behavior_type || '—'}</td>
      <td style="text-align:center;color:${r.points_change >= 0 ? 'green' : 'red'}">${r.points_change >= 0 ? '+' : ''}${r.points_change}</td>
      <td>${r.note || ''}</td>
      <td>${r.recorded_by_name_snapshot || '—'}</td>
    </tr>`).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>ประวัติพฤติกรรม ${expandedStudentName.value}</title>
    <style>
      body { font-family: 'Sarabun', Arial, sans-serif; font-size: 13px; margin: 20px; }
      h2 { margin: 0 0 4px; font-size: 16px; }
      .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #1e3a8a; color: white; padding: 6px 8px; text-align: left; }
      td { border: 1px solid #ddd; padding: 5px 8px; }
      tr:nth-child(even) td { background: #f5f5f5; }
      .sum-row td { background: #1e3a8a; color: white; font-weight: bold; }
      @media print { body { margin: 10px; } }
    </style></head><body>
    <h2>ประวัติพฤติกรรม: ${expandedStudentName.value}</h2>
    <div class="meta">รหัส: ${expandedStudentId.value} | ห้อง: ${className.value || '—'} | ภาคเรียน ${currentTerm.value} | ประเภท: ${typeLabel}</div>
    <table>
      <thead><tr><th>ที่</th><th>วันที่</th><th>พฤติกรรม</th><th>ประเภท</th><th>คะแนน</th><th>หมายเหตุ</th><th>บันทึกโดย</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="sum-row"><td colspan="4">รวม</td><td style="text-align:center">${total >= 0 ? '+' : ''}${total} คะแนน</td><td colspan="2"></td></tr></tfoot>
    </table>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`
  const w = window.open('', '_blank', 'width=900,height=700')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Excel summary ─────────────────────────────────────────────
function exportExcel() {
  const filterDesc = []
  if (className.value)     filterDesc.push(`ห้อง: ${className.value}`)
  if (scoreMin.value != null) filterDesc.push(`คะแนน ≥ ${scoreMin.value}`)
  if (scoreMax.value != null) filterDesc.push(`คะแนน ≤ ${scoreMax.value}`)

  const title = ['รายงานพฤติกรรมนักเรียน', filterDesc.join(' | ') || 'ทุกห้องเรียน', `ภาคเรียน ${currentTerm.value}`]
  const headers = ['ที่', 'รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'คะแนนรวม', 'ความประพฤติ', 'การมาเรียน', 'ในห้องเรียน']
  const data = filteredRows.value.map((r, i) => [
    i + 1, r.student_id, r.name || '', r.surname || '',
    r.summary?.total_score ?? 0, r.summary?.general_score ?? 0,
    r.summary?.attendance_score ?? 0, r.summary?.learning_score ?? 0,
  ])
  const ws = XLSX.utils.aoa_to_sheet([title, [], headers, ...data])
  ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 13 }, { wch: 13 }, { wch: 13 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'พฤติกรรม')
  XLSX.writeFile(wb, `behavior_${filterClassId.value || 'all'}_${currentTerm.value}.xlsx`)
}

// ─── Excel detail ──────────────────────────────────────────────
function exportDetailExcel() {
  const data = filteredDetailLogs.value
  const totalChange = data.reduce((s, r) => s + (r.points_change || 0), 0)
  const title   = [`ประวัติพฤติกรรม: ${expandedStudentName.value}`, `รหัส: ${expandedStudentId.value} | ภาคเรียน ${currentTerm.value}`]
  const headers = ['ที่', 'วันที่', 'พฤติกรรม', 'ประเภท', 'คะแนน', 'หมายเหตุ', 'บันทึกโดย']
  const rows = data.map((r, i) => [
    i + 1,
    thaiDate(r.date || r.created_at?.substring(0, 10)),
    r.label_snapshot || '—',
    r.behavior_type_label_snapshot || BEHAVIOR_TYPE_LABELS[r.behavior_type] || r.behavior_type || '—',
    r.points_change >= 0 ? `+${r.points_change}` : r.points_change,
    r.note || '', r.recorded_by_name_snapshot || '—',
  ])
  const sumRow = ['📊 รวม', '', '', '', (totalChange >= 0 ? '+' : '') + totalChange + ' คะแนน', '', '']

  const ws = XLSX.utils.aoa_to_sheet([title, [], headers, ...rows, [], sumRow])
  ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ประวัติพฤติกรรม')
  XLSX.writeFile(wb, `behavior_detail_${expandedStudentId.value}_${currentTerm.value}.xlsx`)
}

// ─── Helpers ───────────────────────────────────────────────────
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
function thaiDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

function scoreClass(score) {
  const s = score ?? 0
  if (s >= 80) return 'text-green-600 font-bold'
  if (s >= 60) return 'text-yellow-500 font-bold'
  return 'text-red-500 font-bold'
}

function scoreTagType(score) {
  const s = score ?? 0
  if (s >= 80) return 'success'
  if (s >= 60) return 'warning'
  return 'danger'
}
</script>

<style scoped>
.brv-page  { padding: 24px; max-width: 1400px; margin: 0 auto; }

/* Header */
.brv-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.brv-header-actions { display: flex; gap: 8px; }
.brv-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; }
.brv-sub   { font-size: 13px; color: #64748b; margin: 4px 0 0; }

/* Filter card */
.brv-filter-card :deep(.el-card__body) { padding: 16px; }
.brv-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.brv-filter-group { display: flex; flex-direction: column; gap: 4px; }
.brv-filter-label { font-size: 12px; color: #64748b; font-weight: 600; }

/* Context banner */
.brv-context-banner {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
  background: linear-gradient(135deg,#fdf2f8,#fce7f3);
  border: 1px solid #f9a8d4; border-radius: 10px; padding: 10px 16px;
}
.brv-context-left  { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.brv-context-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.brv-context-label { font-size: 14px; font-weight: 800; color: #be185d; }
.brv-context-sep   { color: #f9a8d4; font-size: 16px; }
.brv-context-item  { font-size: 13px; color: #4b5563; background: #fff; border-radius: 6px; padding: 2px 10px; border: 1px solid #f3e8ff; }
.brv-context-score { color: #7c3aed; font-weight: 700; border-color: #ddd6fe; }
.brv-context-count { font-size: 13px; font-weight: 700; color: #db2777; }
.brv-context-term  { font-size: 12px; color: #64748b; }

/* Detail panel */
.brv-detail-card :deep(.el-card__body) { padding: 16px; }
.brv-detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
.brv-detail-head-left  { display: flex; flex-direction: column; gap: 6px; }
.brv-detail-head-right { display: flex; gap: 6px; align-items: flex-start; flex-shrink: 0; }
.brv-detail-name   { font-size: 20px; font-weight: 800; color: #db2777; }
.brv-detail-meta   { display: flex; gap: 12px; font-size: 12px; color: #64748b; }
.brv-detail-scores { display: flex; flex-wrap: wrap; gap: 4px; }

/* Inline image thumbnails in detail table */
.brv-cell-imgs {
  display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;
  padding: 4px 0;
}
.brv-cell-img-link { display: block; flex-shrink: 0; }
.brv-cell-thumb {
  width: 90px; height: 90px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #e2e8f0;
  transition: border-color .15s, transform .15s;
  display: block;
}
.brv-cell-img-link:hover .brv-cell-thumb {
  border-color: #db2777;
  transform: scale(1.06);
}

/* Print-only hidden */
.brv-print-title { display: none; }
.brv-print-meta  { display: none; }
</style>

<style>
/* Summary row styling */
.brv-detail-table .el-table__footer-wrapper td {
  background: #1e3a8a !important;
  color: #fff !important;
  font-weight: 700 !important;
  font-size: 13px !important;
}

/* Print: summary report */
@media print {
  body.brv-printing .brv-no-print,
  body.brv-printing .el-header,
  body.brv-printing .el-aside,
  body.brv-printing .el-footer,
  body.brv-printing .brv-header-actions,
  body.brv-printing .brv-filter-card,
  body.brv-printing .brv-detail-card { display: none !important; }

  body.brv-printing .brv-context-banner { background: none !important; border: 1px solid #ccc; }
  body.brv-printing #brv-print-area     { display: block !important; }
}

/* Print: individual detail */
@media print {
  body.brv-printing-detail .el-header,
  body.brv-printing-detail .el-aside,
  body.brv-printing-detail .el-footer,
  body.brv-printing-detail .brv-header,
  body.brv-printing-detail .brv-filter-card,
  body.brv-printing-detail .brv-context-banner,
  body.brv-printing-detail .brv-main-table,
  body.brv-printing-detail .brv-detail-head-right { display: none !important; }

  body.brv-printing-detail .brv-detail-card { box-shadow: none !important; border: none !important; }
  body.brv-printing-detail #brv-detail-area { display: block !important; }
  body.brv-printing-detail .brv-cell-thumb  { width: 80px !important; height: 80px !important; }
}
</style>
