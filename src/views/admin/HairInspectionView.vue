<template>
  <AppLayout>
    <div class="hi-page">

      <!-- ══ Hero ══ -->
      <div class="hi-hero">
        <div class="hi-hero-left">
          <div class="hi-hero-icon">💇</div>
          <div>
            <h1 class="hi-title">บันทึกการตรวจทรงผม</h1>
            <p class="hi-sub">ฝ่ายกิจการนักเรียน · ตรวจ บันทึก และรายงานผลการตรวจทรงผม</p>
          </div>
        </div>
        <button class="hi-btn-create" @click="openCreate">+ สร้างรายการตรวจ</button>
      </div>

      <!-- ══ Summary cards ══ -->
      <div class="hi-summary-row">
        <div class="hi-sc hi-sc--blue">
          <div class="hi-sc-icon">📋</div>
          <div class="hi-sc-num">{{ sessions.length }}</div>
          <div class="hi-sc-label">รายการตรวจทั้งหมด</div>
        </div>
        <div class="hi-sc hi-sc--green">
          <div class="hi-sc-icon">✅</div>
          <div class="hi-sc-num">{{ totalPass }}</div>
          <div class="hi-sc-label">ผ่านทั้งหมด</div>
        </div>
        <div class="hi-sc hi-sc--red">
          <div class="hi-sc-icon">❌</div>
          <div class="hi-sc-num">{{ totalFail }}</div>
          <div class="hi-sc-label">ไม่ผ่านทั้งหมด</div>
        </div>
        <div class="hi-sc hi-sc--amber">
          <div class="hi-sc-icon">🔄</div>
          <div class="hi-sc-num">{{ totalRecheck }}</div>
          <div class="hi-sc-label">ตรวจซ้ำ</div>
        </div>
      </div>

      <!-- ══ Filter ══ -->
      <div class="hi-filter-bar">
        <el-date-picker v-model="filterMonth" type="month" placeholder="กรองตามเดือน" clearable style="width:160px" value-format="YYYY-MM" />
        <el-select v-model="filterClass" placeholder="ทุกห้อง" clearable style="width:140px">
          <el-option v-for="c in classes" :key="c.class_id" :label="c.class_name||c.class_id" :value="c.class_id" />
        </el-select>
      </div>

      <!-- ══ Session List ══ -->
      <div v-if="!filteredSessions.length && !loading" class="hi-empty">
        <div style="font-size:3rem">💇</div>
        <div class="hi-empty-text">ยังไม่มีรายการตรวจทรงผม</div>
      </div>

      <div v-loading="loading" class="hi-sessions">
        <div v-for="s in filteredSessions" :key="s.id" class="hi-session-card" @click="openDetail(s)">
          <div class="hi-session-date-col">
            <div class="hi-session-day">{{ dayOf(s.date) }}</div>
            <div class="hi-session-month">{{ monthOf(s.date) }}</div>
          </div>
          <div class="hi-session-body">
            <div class="hi-session-title">ตรวจทรงผม · {{ fmtDate(s.date) }}</div>
            <div class="hi-session-by">ผู้ตรวจ: {{ s.inspector_name || '—' }}</div>
            <div class="hi-session-stats">
              <span class="hi-badge hi-badge--green">✅ ผ่าน {{ s._pass }}</span>
              <span class="hi-badge hi-badge--red">❌ ไม่ผ่าน {{ s._fail }}</span>
              <span v-if="s._recheck" class="hi-badge hi-badge--amber">🔄 ตรวจซ้ำ {{ s._recheck }}</span>
            </div>
          </div>
          <div class="hi-session-total">{{ s._total }} คน</div>
          <div class="hi-session-arrow">›</div>
        </div>
      </div>

    </div>

    <!-- ══════════════════════════════════════
         CREATE DIALOG
    ══════════════════════════════════════ -->
    <el-dialog v-model="createDialog" width="95vw" :style="{maxWidth:'1100px'}" :close-on-click-modal="false" class="hi-dialog">
      <template #header>
        <div class="hi-dlg-header">
          <span>💇</span>
          <div>
            <div class="hi-dlg-title">สร้างรายการตรวจทรงผม</div>
            <div class="hi-dlg-sub">เลือกนักเรียน → กำหนดผล → บันทึก</div>
          </div>
        </div>
      </template>

      <div class="hi-create-body">

        <!-- ── Session info ── -->
        <div class="hi-info-section">
          <div class="hi-info-row">
            <div class="hi-info-field">
              <label class="hi-label">วันที่ตรวจ <span class="req">*</span></label>
              <el-date-picker v-model="newSession.date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="เลือกวันที่" />
            </div>
            <div class="hi-info-field">
              <label class="hi-label">ผู้ตรวจ / ครูที่รับผิดชอบ</label>
              <el-input v-model="newSession.inspector_name" placeholder="ชื่อครูผู้ตรวจ" />
            </div>
            <div class="hi-info-field">
              <label class="hi-label">คะแนนที่เพิ่มเมื่อ "ผ่าน"</label>
              <el-input-number v-model="newSession.pass_score" :min="0" :max="10" style="width:100%" />
            </div>
            <div class="hi-info-field">
              <label class="hi-label">หมายเหตุ</label>
              <el-input v-model="newSession.notes" placeholder="(ไม่บังคับ)" />
            </div>
          </div>
        </div>

        <!-- ── Student selector ── -->
        <div class="hi-selector-layout">

          <!-- Left: student pool -->
          <div class="hi-pool">
            <div class="hi-pool-header">
              <div class="hi-pool-title">เลือกนักเรียน</div>
              <div class="hi-pool-filters">
                <el-select v-model="poolClass" placeholder="ทุกห้อง" clearable style="width:120px" size="small">
                  <el-option v-for="c in classes" :key="c.class_id" :label="c.class_name||c.class_id" :value="c.class_id" />
                </el-select>
                <el-input v-model="poolSearch" placeholder="รหัส / ชื่อ / นามสกุล" clearable size="small" style="width:180px" />
              </div>
            </div>
            <div class="hi-pool-count">{{ filteredPool.length }} คน · คลิกเพื่อเลือก</div>
            <div class="hi-pool-grid">
              <div v-for="s in filteredPool" :key="s.student_code"
                class="hi-stu-card" :class="{ selected: isSelected(s.student_code) }"
                @click="toggleSelect(s)">
                <div class="hi-stu-photo">
                  <span>{{ (s.first_name||'?')[0] }}</span>
                  <img v-if="s.photo_url" :src="fixPhotoUrl(s.photo_url)" class="hi-abs-img" @error="e=>e.target.style.display='none'" />
                </div>
                <div class="hi-stu-info">
                  <div class="hi-stu-name">{{ s.prefix }}{{ s.first_name }} {{ s.last_name }}</div>
                  <div class="hi-stu-meta">{{ s.class_id }} · {{ s.student_code }}</div>
                </div>
                <div v-if="isSelected(s.student_code)" class="hi-stu-check">✓</div>
              </div>
              <div v-if="!filteredPool.length" class="hi-pool-empty">ไม่พบนักเรียน</div>
            </div>
            <div class="hi-pool-actions">
              <button class="hi-btn-sel-all" @click="selectAll">เลือกทั้งหมด {{ filteredPool.length }} คน</button>
              <button class="hi-btn-clear-sel" @click="clearSelection">ยกเลิกทั้งหมด</button>
            </div>
          </div>

          <!-- Right: result entry -->
          <div class="hi-results">
            <div class="hi-results-header">
              <div class="hi-pool-title">บันทึกผลการตรวจ</div>
              <div class="hi-pool-count">เลือกแล้ว {{ selectedStudents.length }} คน</div>
            </div>

            <div v-if="!selectedStudents.length" class="hi-results-empty">
              ← เลือกนักเรียนจากด้านซ้าย
            </div>

            <div v-else class="hi-results-list">
              <!-- Bulk actions -->
              <div class="hi-bulk-bar">
                <span class="hi-bulk-label">ตั้งผลทั้งหมด:</span>
                <button class="hi-bulk-btn hi-bulk--pass" @click="setAllResult('pass')">✅ ผ่านทั้งหมด</button>
                <button class="hi-bulk-btn hi-bulk--fail" @click="setAllResult('fail')">❌ ไม่ผ่านทั้งหมด</button>
              </div>

              <div v-for="sr in selectedStudents" :key="sr.student_code" class="hi-result-row">
                <div class="hi-result-photo">
                  <span>{{ (sr.first_name||'?')[0] }}</span>
                  <img v-if="sr.photo_url" :src="fixPhotoUrl(sr.photo_url)" class="hi-abs-img" @error="e=>e.target.style.display='none'" />
                </div>
                <div class="hi-result-name">
                  <div class="hi-result-fullname">{{ sr.prefix }}{{ sr.first_name }} {{ sr.last_name }}</div>
                  <div class="hi-result-meta">{{ sr.class_id }} · {{ sr.student_code }}</div>
                </div>
                <div class="hi-result-radios">
                  <label class="hi-radio hi-radio--pass" :class="{ active: sr.result==='pass' }">
                    <input type="radio" :value="'pass'" v-model="sr.result" /> ✅ ผ่าน
                  </label>
                  <label class="hi-radio hi-radio--fail" :class="{ active: sr.result==='fail' }">
                    <input type="radio" :value="'fail'" v-model="sr.result" /> ❌ ไม่ผ่าน
                  </label>
                  <label class="hi-radio hi-radio--recheck" :class="{ active: sr.result==='recheck' }">
                    <input type="radio" :value="'recheck'" v-model="sr.result" /> 🔄 ตรวจซ้ำ
                  </label>
                </div>
                <div class="hi-result-actions">
                  <button v-if="sr.result !== 'pass'" class="hi-photo-btn" @click="pickPhoto(sr)">
                    📷 {{ sr.photos.length ? `${sr.photos.length} รูป` : 'แนบรูป' }}
                  </button>
                  <el-input v-if="sr.result !== 'pass'" v-model="sr.notes" placeholder="หมายเหตุ" size="small" style="width:120px" />
                  <button class="hi-remove-btn" @click="removeStudent(sr.student_code)">✕</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <template #footer>
        <div class="hi-dlg-footer">
          <button class="hi-btn-cancel" @click="createDialog=false">ยกเลิก</button>
          <button class="hi-btn-save" :disabled="saving" @click="saveSession">
            {{ saving ? '⏳ กำลังบันทึก...' : `💾 บันทึก (${selectedStudents.length} คน)` }}
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- ══ Detail / Report Dialog ══ -->
    <el-dialog v-model="detailDialog" width="92vw" :style="{maxWidth:'900px'}" :title="detailSession ? `ผลการตรวจทรงผม · ${fmtDate(detailSession.date)}` : ''">
      <div v-if="detailSession" id="hi-print-area" class="hi-report">

        <!-- Print header -->
        <div class="hi-report-header">
          <div class="hi-report-logo-wrap">
            <img v-if="schoolStore.settingsObj?.logo_url" :src="schoolStore.settingsObj.logo_url" class="hi-report-logo" />
            <div v-else class="hi-report-logo-ph">🏫</div>
          </div>
          <div class="hi-report-school-info">
            <div class="hi-report-school-name">{{ schoolStore.schoolName }}</div>
            <div class="hi-report-doc-title">รายงานผลการตรวจทรงผมนักเรียน</div>
            <div class="hi-report-meta-row">
              <span>📅 วันที่ {{ fmtDateThai(detailSession.date) }}</span>
              <span>⏰ พิมพ์เมื่อ {{ nowThai() }}</span>
            </div>
            <div class="hi-report-meta-row">
              <span>👤 ผู้ตรวจ: {{ detailSession.inspector_name || '—' }}</span>
              <span>📊 รวม {{ detailRecords.length }} คน</span>
            </div>
          </div>
        </div>

        <!-- Summary boxes -->
        <div class="hi-report-summary">
          <div class="hi-rsb hi-rsb--green">
            <div class="hi-rsb-num">{{ detailRecords.filter(r=>r.result==='pass').length }}</div>
            <div class="hi-rsb-label">✅ ผ่าน</div>
          </div>
          <div class="hi-rsb hi-rsb--red">
            <div class="hi-rsb-num">{{ detailRecords.filter(r=>r.result==='fail').length }}</div>
            <div class="hi-rsb-label">❌ ไม่ผ่าน</div>
          </div>
          <div class="hi-rsb hi-rsb--amber">
            <div class="hi-rsb-num">{{ detailRecords.filter(r=>r.result==='recheck').length }}</div>
            <div class="hi-rsb-label">🔄 ตรวจซ้ำ</div>
          </div>
          <div class="hi-rsb hi-rsb--blue">
            <div class="hi-rsb-num">{{ detailRecords.length }}</div>
            <div class="hi-rsb-label">👥 รวมทั้งหมด</div>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="hi-report-tabs no-print">
          <button v-for="t in reportTabs" :key="t.key"
            class="hi-tab" :class="{ active: reportTab === t.key }"
            @click="reportTab = t.key">
            {{ t.label }} ({{ tabCount(t.key) }})
          </button>
        </div>

        <!-- ผ่าน table -->
        <template v-if="reportTab === 'all' || reportTab === 'pass'">
          <div class="hi-report-section-title hi-rt--green">✅ รายชื่อนักเรียนที่ผ่านการตรวจ</div>
          <table class="hi-report-table">
            <thead><tr><th>ที่</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ห้อง</th><th>คะแนนที่เพิ่ม</th></tr></thead>
            <tbody>
              <tr v-for="(r,i) in detailRecords.filter(r=>r.result==='pass')" :key="r.id">
                <td>{{ i+1 }}</td><td>{{ r.student_code }}</td>
                <td>{{ r.student_name }}</td><td>{{ r.class_id }}</td>
                <td style="color:#16a34a;font-weight:700">+{{ r.score_change }}</td>
              </tr>
              <tr v-if="!detailRecords.filter(r=>r.result==='pass').length"><td colspan="5" class="hi-no-data">—</td></tr>
            </tbody>
          </table>
        </template>

        <!-- ไม่ผ่าน table -->
        <template v-if="reportTab === 'all' || reportTab === 'fail'">
          <div class="hi-report-section-title hi-rt--red">❌ รายชื่อนักเรียนที่ไม่ผ่านการตรวจ</div>
          <table class="hi-report-table">
            <thead><tr><th>ที่</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ห้อง</th><th>ครั้งที่</th><th>หมายเหตุ</th><th>รูป</th></tr></thead>
            <tbody>
              <tr v-for="(r,i) in detailRecords.filter(r=>r.result==='fail')" :key="r.id">
                <td>{{ i+1 }}</td><td>{{ r.student_code }}</td>
                <td>{{ r.student_name }}</td><td>{{ r.class_id }}</td>
                <td>{{ r.inspection_count }}</td>
                <td>{{ r.notes||'—' }}</td>
                <td>
                  <div class="hi-report-photos">
                    <img v-for="(p,pi) in (r.photos||[])" :key="pi" :src="p.data" class="hi-report-photo-thumb" @click="viewImg=p.data" />
                  </div>
                </td>
              </tr>
              <tr v-if="!detailRecords.filter(r=>r.result==='fail').length"><td colspan="7" class="hi-no-data">—</td></tr>
            </tbody>
          </table>
        </template>

        <!-- ตรวจซ้ำ table -->
        <template v-if="reportTab === 'all' || reportTab === 'recheck'">
          <div class="hi-report-section-title hi-rt--amber">🔄 รายชื่อนักเรียนที่ตรวจซ้ำ</div>
          <table class="hi-report-table">
            <thead><tr><th>ที่</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ห้อง</th><th>ครั้งที่</th><th>หมายเหตุ</th><th>รูป</th></tr></thead>
            <tbody>
              <tr v-for="(r,i) in detailRecords.filter(r=>r.result==='recheck')" :key="r.id">
                <td>{{ i+1 }}</td><td>{{ r.student_code }}</td>
                <td>{{ r.student_name }}</td><td>{{ r.class_id }}</td>
                <td>{{ r.inspection_count }}</td>
                <td>{{ r.notes||'—' }}</td>
                <td>
                  <div class="hi-report-photos">
                    <img v-for="(p,pi) in (r.photos||[])" :key="pi" :src="p.data" class="hi-report-photo-thumb" @click="viewImg=p.data" />
                  </div>
                </td>
              </tr>
              <tr v-if="!detailRecords.filter(r=>r.result==='recheck').length"><td colspan="7" class="hi-no-data">—</td></tr>
            </tbody>
          </table>
        </template>

        <!-- Signature row -->
        <div class="hi-sig-row">
          <div v-for="l in ['ครูผู้ตรวจ','หัวหน้าฝ่ายกิจการนักเรียน','ผู้อำนวยการ']" :key="l" class="hi-sig-col">
            <div class="hi-sig-line"></div>
            <div class="hi-sig-label">( ................................ )</div>
            <div class="hi-sig-role">{{ l }}</div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="hi-dlg-footer">
          <button class="hi-btn-cancel" @click="detailDialog=false">ปิด</button>
          <button class="hi-btn-print" @click="printReport">🖨 พิมพ์รายงาน</button>
          <button class="hi-btn-danger" @click="deleteSession(detailSession)">🗑 ลบรายการนี้</button>
        </div>
      </template>
    </el-dialog>

    <!-- Image viewer -->
    <el-dialog v-model="imgViewerOpen" width="auto" :show-close="true" @close="viewImg=null">
      <img v-if="viewImg" :src="viewImg" style="max-width:90vw;max-height:80vh;display:block;margin:auto" />
    </el-dialog>

    <input ref="photoInputRef" type="file" accept="image/*" multiple class="hidden" @change="onPhotoSelected" />

  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import AppLayout from '@/components/layout/AppLayout.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getClasses } = useSchoolDb()
const schoolId    = () => authStore.schoolId

// ── State ──
const loading        = ref(false)
const saving         = ref(false)
const sessions       = ref([])
const allStudents    = ref([])
const classes        = ref([])
const createDialog   = ref(false)
const detailDialog   = ref(false)
const detailSession  = ref(null)
const detailRecords  = ref([])
const reportTab      = ref('all')
const filterMonth    = ref('')
const filterClass    = ref('')
const poolSearch     = ref('')
const poolClass      = ref('')
const viewImg        = ref(null)
const imgViewerOpen  = computed({ get: () => !!viewImg.value, set: v => { if (!v) viewImg.value = null } })
const photoInputRef  = ref(null)
let   pickingPhotoFor = null

const newSession = ref({ date: new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}), inspector_name: authStore.profile?.displayName || '', notes: '', pass_score: 1 })
const selectedStudents = ref([])

const reportTabs = [
  { key: 'all', label: '📋 ทั้งหมด' },
  { key: 'pass', label: '✅ ผ่าน' },
  { key: 'fail', label: '❌ ไม่ผ่าน' },
  { key: 'recheck', label: '🔄 ตรวจซ้ำ' },
]

// ── Computed ──
const totalPass    = computed(() => sessions.value.reduce((s,x)=>s+(x._pass||0), 0))
const totalFail    = computed(() => sessions.value.reduce((s,x)=>s+(x._fail||0), 0))
const totalRecheck = computed(() => sessions.value.reduce((s,x)=>s+(x._recheck||0), 0))

const filteredSessions = computed(() => {
  let r = sessions.value
  if (filterMonth.value) r = r.filter(s => s.date?.startsWith(filterMonth.value))
  return r
})

const filteredPool = computed(() => {
  let r = allStudents.value
  if (poolClass.value) r = r.filter(s => s.class_id === poolClass.value)
  if (poolSearch.value) {
    const q = poolSearch.value.toLowerCase()
    r = r.filter(s =>
      String(s.student_code).includes(poolSearch.value) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      (s.prefix||'').toLowerCase().includes(q)
    )
  }
  return r
})

function tabCount(key) {
  if (!detailRecords.value) return 0
  if (key === 'all') return detailRecords.value.length
  return detailRecords.value.filter(r => r.result === key).length
}

// ── Load ──
onMounted(async () => {
  loading.value = true
  await Promise.all([loadSessions(), loadStudents(), loadClasses()])
  loading.value = false
})

async function loadSessions() {
  const { data: sesData } = await supabase.from('hair_inspections').select('*').eq('school_id', schoolId()).order('date', { ascending: false })
  const { data: recData } = await supabase.from('hair_inspection_records').select('inspection_id,result').eq('school_id', schoolId())
  const countMap = {}
  for (const r of recData || []) {
    if (!countMap[r.inspection_id]) countMap[r.inspection_id] = { pass:0, fail:0, recheck:0, total:0 }
    countMap[r.inspection_id][r.result] = (countMap[r.inspection_id][r.result] || 0) + 1
    countMap[r.inspection_id].total++
  }
  sessions.value = (sesData || []).map(s => ({
    ...s,
    _pass: countMap[s.id]?.pass || 0,
    _fail: countMap[s.id]?.fail || 0,
    _recheck: countMap[s.id]?.recheck || 0,
    _total: countMap[s.id]?.total || 0,
  }))
}

async function loadStudents() {
  const { data } = await supabase.from('students')
    .select('student_code,prefix,first_name,last_name,class_id,photo_url')
    .eq('school_id', schoolId())
    .or('student_status.eq.เรียนอยู่,student_status.is.null')
    .order('class_id').order('first_name')
  allStudents.value = data || []
}

async function loadClasses() {
  classes.value = await getClasses()
}

// ── Create ──
function openCreate() {
  newSession.value = { date: new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}), inspector_name: authStore.profile?.displayName || '', notes: '', pass_score: 1 }
  selectedStudents.value = []
  poolSearch.value = ''
  poolClass.value = ''
  createDialog.value = true
}

function isSelected(code) { return selectedStudents.value.some(s => s.student_code === code) }

function toggleSelect(stu) {
  const idx = selectedStudents.value.findIndex(s => s.student_code === stu.student_code)
  if (idx >= 0) selectedStudents.value.splice(idx, 1)
  else selectedStudents.value.push(reactive({ ...stu, result: 'pass', photos: [], notes: '' }))
}

function removeStudent(code) {
  const idx = selectedStudents.value.findIndex(s => s.student_code === code)
  if (idx >= 0) selectedStudents.value.splice(idx, 1)
}

function selectAll() {
  for (const s of filteredPool.value) {
    if (!isSelected(s.student_code))
      selectedStudents.value.push(reactive({ ...s, result: 'pass', photos: [], notes: '' }))
  }
}

function clearSelection() { selectedStudents.value = [] }

function setAllResult(result) {
  for (const s of selectedStudents.value) s.result = result
}

// ── Photo ──
function pickPhoto(sr) { pickingPhotoFor = sr; photoInputRef.value.value = ''; photoInputRef.value.click() }

function onPhotoSelected(e) {
  const files = [...e.target.files]
  if (!pickingPhotoFor || !files.length) return
  files.slice(0, 5).forEach(file => {
    if (file.size > 5 * 1024 * 1024) { ElMessage.warning(`${file.name} เกิน 5MB`); return }
    const r = new FileReader()
    r.onload = ev => pickingPhotoFor.photos.push({ name: file.name, data: ev.target.result })
    r.readAsDataURL(file)
  })
}

// ── Save ──
async function saveSession() {
  if (!newSession.value.date) { ElMessage.error('กรุณาเลือกวันที่'); return }
  if (!selectedStudents.value.length) { ElMessage.error('กรุณาเลือกนักเรียนอย่างน้อย 1 คน'); return }
  saving.value = true
  try {
    // 1. Insert session
    const { data: sesRow, error: sesErr } = await supabase.from('hair_inspections').insert([{
      school_id: schoolId(), date: newSession.value.date,
      term_id: schoolStore.currentTerm || '',
      inspector_name: newSession.value.inspector_name,
      notes: newSession.value.notes || null,
      created_by: authStore.profile?.displayName || '',
    }]).select('id').single()
    if (sesErr) throw sesErr

    // 2. Insert records
    const records = selectedStudents.value.map(s => ({
      inspection_id: sesRow.id,
      school_id: schoolId(),
      student_code: s.student_code,
      student_name: `${s.prefix||''}${s.first_name} ${s.last_name}`,
      class_id: s.class_id,
      result: s.result,
      inspection_count: 1,
      score_change: s.result === 'pass' ? (newSession.value.pass_score || 0) : 0,
      photos: s.photos,
      notes: s.notes || null,
    }))
    const { error: recErr } = await supabase.from('hair_inspection_records').insert(records)
    if (recErr) throw recErr

    // 3. Add behavior scores for passing students
    const passStudents = selectedStudents.value.filter(s => s.result === 'pass' && newSession.value.pass_score > 0)
    for (const s of passStudents) {
      const { data: stuRow } = await supabase.from('students')
        .select('general_behavior_score,total_behavior_score,behavior_carry_over,attendance_behavior_score,learning_behavior_score,probation_score')
        .eq('school_id', schoolId()).eq('student_code', s.student_code).maybeSingle()
      if (stuRow) {
        const newGen   = (stuRow.general_behavior_score||0) + newSession.value.pass_score
        const newTotal = (stuRow.behavior_carry_over||0) + newGen + (stuRow.attendance_behavior_score||0) + (stuRow.learning_behavior_score||0) + (stuRow.probation_score||0)
        await supabase.from('students').update({ general_behavior_score: newGen, total_behavior_score: newTotal }).eq('school_id', schoolId()).eq('student_code', s.student_code)
        await supabase.from('behavior_logs').insert({
          school_id: schoolId(), term_id: schoolStore.currentTerm || '',
          student_id: s.student_code, class_id: s.class_id,
          behavior_type: 'general',
          label_snapshot: `ผ่านการตรวจทรงผม (${newSession.value.date})`,
          points_change: newSession.value.pass_score, score_after: newTotal,
          source_type: 'hair_inspection', date: newSession.value.date,
          recorded_by_name_snapshot: authStore.profile?.displayName || '',
          created_at: new Date().toISOString(), image_urls: [],
        })
      }
    }

    ElMessage.success(`บันทึกเรียบร้อย · ${selectedStudents.value.length} คน`)
    createDialog.value = false
    await loadSessions()
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

// ── Detail ──
async function openDetail(session) {
  detailSession.value = session
  reportTab.value = 'all'
  const { data } = await supabase.from('hair_inspection_records').select('*').eq('inspection_id', session.id).order('class_id').order('student_name')
  detailRecords.value = data || []
  detailDialog.value = true
}

async function deleteSession(session) {
  await ElMessageBox.confirm(`ลบรายการตรวจวันที่ ${fmtDate(session.date)}?`, 'ยืนยัน', { type: 'warning', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' })
  await supabase.from('hair_inspections').delete().eq('id', session.id)
  detailDialog.value = false
  ElMessage.success('ลบเรียบร้อย')
  await loadSessions()
}

// ── Print ──
function printReport() {
  const style = `
    body{font-family:'Sarabun',sans-serif;font-size:13px;margin:20px}
    .hi-report-header{display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:2px solid #000;margin-bottom:16px}
    .hi-report-logo{width:72px;height:72px;object-fit:contain}
    .hi-report-logo-ph{font-size:3rem}
    .hi-report-school-name{font-size:1.2rem;font-weight:800;color:#1e293b}
    .hi-report-doc-title{font-size:1rem;font-weight:700;color:#475569;margin:2px 0}
    .hi-report-meta-row{font-size:.82rem;color:#64748b;display:flex;gap:20px;margin-top:3px}
    .hi-report-summary{display:flex;gap:12px;margin-bottom:16px}
    .hi-rsb{border-radius:8px;padding:10px 16px;text-align:center;min-width:70px}
    .hi-rsb--green{background:#dcfce7;color:#15803d}
    .hi-rsb--red{background:#fee2e2;color:#dc2626}
    .hi-rsb--amber{background:#fef3c7;color:#b45309}
    .hi-rsb--blue{background:#dbeafe;color:#1d4ed8}
    .hi-rsb-num{font-size:1.5rem;font-weight:800}
    .hi-rsb-label{font-size:.72rem}
    .hi-report-section-title{font-weight:700;font-size:.9rem;padding:6px 10px;border-radius:4px;margin:12px 0 6px;color:#fff}
    .hi-rt--green{background:#16a34a}.hi-rt--red{background:#dc2626}.hi-rt--amber{background:#d97706}
    .hi-report-table{width:100%;border-collapse:collapse;font-size:.83rem;margin-bottom:12px}
    .hi-report-table th,.hi-report-table td{border:1px solid #e2e8f0;padding:5px 8px}
    .hi-report-table th{background:#f1f5f9;font-weight:700}
    .hi-report-photo-thumb{width:48px;height:48px;object-fit:cover;border-radius:4px;margin:2px}
    .hi-sig-row{display:flex;gap:24px;margin-top:48px;justify-content:space-around}
    .hi-sig-col{display:flex;flex-direction:column;align-items:center;flex:1}
    .hi-sig-line{width:160px;border-bottom:1px solid #000;margin-bottom:4px;margin-top:40px}
    .hi-sig-label{font-size:.78rem}.hi-sig-role{font-size:.74rem;color:#475569}
    .no-print{display:none!important}
  `
  const content = document.getElementById('hi-print-area')?.innerHTML || ''
  const win = window.open('', '_blank')
  win.document.write(`<html><head><title>รายงานตรวจทรงผม</title><style>${style}</style></head><body>${content}</body></html>`)
  win.document.close(); win.print()
}

// ── Utils ──
function fixPhotoUrl(url) {
  if (!url) return ''
  const m = url.match(/\/d\/([^/]+)\//)
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w120`
  return url
}
function fmtDate(d) { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}) }
function fmtDateThai(d) { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}) }
function dayOf(d) { if(!d) return ''; return new Date(d+'T00:00:00').getDate() }
function monthOf(d) { if(!d) return ''; return new Date(d+'T00:00:00').toLocaleDateString('th-TH',{month:'short',year:'2-digit'}) }
function nowThai() { return new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}) }
</script>

<style scoped>
/* ── Page ── */
.hi-page { padding: 24px; max-width: 1100px; margin: 0 auto; }

/* ── Hero ── */
.hi-hero { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,#0f766e,#0d9488,#06b6d4); border-radius: 16px; padding: 20px 24px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.hi-hero-left { display: flex; align-items: center; gap: 14px; }
.hi-hero-icon { font-size: 2.2rem; }
.hi-title { font-size: 1.4rem; font-weight: 800; color: #fff; margin: 0 0 2px; }
.hi-sub   { color: #a7f3f0; font-size: .82rem; margin: 0; }
.hi-btn-create { background: #fff; color: #0f766e; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 700; cursor: pointer; font-size: .9rem; }

/* ── Summary ── */
.hi-summary-row { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.hi-sc { flex: 1; min-width: 120px; border-radius: 14px; padding: 16px 18px; color: #fff; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,.12); }
.hi-sc--blue   { background: linear-gradient(135deg,#3b82f6,#2563eb); }
.hi-sc--green  { background: linear-gradient(135deg,#22c55e,#16a34a); }
.hi-sc--red    { background: linear-gradient(135deg,#ef4444,#dc2626); }
.hi-sc--amber  { background: linear-gradient(135deg,#f59e0b,#d97706); }
.hi-sc-icon { font-size: 1.4rem; }
.hi-sc-num  { font-size: 2rem; font-weight: 800; line-height: 1.1; }
.hi-sc-label{ font-size: .74rem; opacity: .85; }

/* ── Filter bar ── */
.hi-filter-bar { display: flex; gap: 10px; align-items: center; background: #fff; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.07); flex-wrap: wrap; }

/* ── Empty ── */
.hi-empty { text-align: center; padding: 60px 20px; }
.hi-empty-text { color: #94a3b8; margin-top: 8px; }

/* ── Session Cards ── */
.hi-sessions { display: flex; flex-direction: column; gap: 10px; }
.hi-session-card { display: flex; align-items: center; gap: 16px; background: #fff; border-radius: 12px; padding: 14px 18px; box-shadow: 0 2px 8px rgba(0,0,0,.07); cursor: pointer; transition: box-shadow .15s, transform .15s; border-left: 4px solid #0d9488; }
.hi-session-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); transform: translateY(-1px); }
.hi-session-date-col { text-align: center; min-width: 48px; }
.hi-session-day { font-size: 1.5rem; font-weight: 800; color: #0f766e; line-height: 1; }
.hi-session-month { font-size: .72rem; color: #64748b; }
.hi-session-body { flex: 1; }
.hi-session-title { font-weight: 700; color: #1e293b; }
.hi-session-by { font-size: .78rem; color: #64748b; margin: 2px 0; }
.hi-session-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.hi-badge { font-size: .73rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.hi-badge--green  { background: #dcfce7; color: #16a34a; }
.hi-badge--red    { background: #fee2e2; color: #dc2626; }
.hi-badge--amber  { background: #fef3c7; color: #b45309; }
.hi-session-total { font-size: 1.2rem; font-weight: 800; color: #0f766e; min-width: 48px; text-align: right; }
.hi-session-arrow { font-size: 1.4rem; color: #94a3b8; }

/* ── Dialog ── */
.hi-dlg-header { display: flex; align-items: center; gap: 12px; }
.hi-dlg-header span { font-size: 1.6rem; }
.hi-dlg-title { font-size: 1.1rem; font-weight: 800; color: #1e293b; }
.hi-dlg-sub   { font-size: .78rem; color: #64748b; }
.hi-label { font-size: .78rem; font-weight: 700; color: #374151; }
.hi-label .req { color: #dc2626; }

/* ── Create body ── */
.hi-create-body { display: flex; flex-direction: column; gap: 14px; max-height: 72vh; overflow-y: auto; }
.hi-info-section { background: linear-gradient(135deg,#f0fdfa,#e0f7f4); border: 1px solid #99f6e4; border-radius: 12px; padding: 14px 16px; }
.hi-info-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.hi-info-field { display: flex; flex-direction: column; gap: 5px; }

/* ── Selector layout ── */
.hi-selector-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; min-height: 400px; }

/* ── Pool (left) ── */
.hi-pool { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
.hi-pool-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: linear-gradient(135deg,#0f766e,#0d9488); }
.hi-pool-title { font-weight: 800; color: #fff; font-size: .9rem; }
.hi-pool-filters { display: flex; gap: 6px; }
.hi-pool-count { font-size: .75rem; color: #64748b; padding: 6px 14px; background: #f1f5f9; }
.hi-pool-grid { flex: 1; overflow-y: auto; max-height: 340px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.hi-pool-empty { text-align: center; padding: 20px; color: #94a3b8; font-size: .85rem; }
.hi-pool-actions { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #e2e8f0; background: #fff; }

/* ── Student card in pool ── */
.hi-stu-card { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; transition: all .12s; border: 1px solid transparent; background: #fff; }
.hi-stu-card:hover { background: #f0fdfa; border-color: #5eead4; }
.hi-stu-card.selected { background: #ccfbf1; border-color: #0d9488; }
.hi-stu-photo { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#0d9488,#06b6d4); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: .9rem; overflow: hidden; flex-shrink: 0; position: relative; }
.hi-stu-photo img { width: 100%; height: 100%; object-fit: cover; }
.hi-stu-info { flex: 1; min-width: 0; }
.hi-stu-name { font-size: .82rem; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hi-stu-meta { font-size: .72rem; color: #64748b; }
.hi-stu-check { width: 22px; height: 22px; border-radius: 50%; background: #0d9488; color: #fff; display: flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 800; flex-shrink: 0; }

/* ── Results (right) ── */
.hi-results { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
.hi-results-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: linear-gradient(135deg,#7c3aed,#8b5cf6); }
.hi-pool-count { font-size: .75rem; color: rgba(255,255,255,.8); }
.hi-results-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: .85rem; padding: 40px; }
.hi-results-list { flex: 1; overflow-y: auto; max-height: 380px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }

/* ── Bulk bar ── */
.hi-bulk-bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; flex-wrap: wrap; }
.hi-bulk-label { font-size: .75rem; color: #64748b; }
.hi-bulk-btn { border: none; border-radius: 6px; padding: 4px 12px; font-size: .78rem; font-weight: 600; cursor: pointer; }
.hi-bulk--pass { background: #dcfce7; color: #16a34a; }
.hi-bulk--fail { background: #fee2e2; color: #dc2626; }

/* ── Result row ── */
.hi-result-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; flex-wrap: wrap; }
.hi-result-photo { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg,#7c3aed,#8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: .85rem; overflow: hidden; flex-shrink: 0; position: relative; }
.hi-abs-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.hi-result-photo img { width: 100%; height: 100%; object-fit: cover; }
.hi-result-name { min-width: 0; flex: 1; }
.hi-result-fullname { font-size: .82rem; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hi-result-meta { font-size: .7rem; color: #94a3b8; }
.hi-result-radios { display: flex; gap: 4px; flex-wrap: wrap; }
.hi-radio { display: flex; align-items: center; gap: 4px; font-size: .75rem; font-weight: 600; padding: 3px 8px; border-radius: 6px; border: 1.5px solid #e2e8f0; cursor: pointer; transition: all .12s; white-space: nowrap; }
.hi-radio input { display: none; }
.hi-radio--pass.active  { background: #dcfce7; border-color: #22c55e; color: #16a34a; }
.hi-radio--fail.active  { background: #fee2e2; border-color: #ef4444; color: #dc2626; }
.hi-radio--recheck.active { background: #fef3c7; border-color: #f59e0b; color: #b45309; }
.hi-result-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.hi-photo-btn { background: #e0f2fe; border: none; color: #0369a1; border-radius: 6px; padding: 4px 10px; font-size: .75rem; cursor: pointer; font-weight: 600; }
.hi-remove-btn { background: #fee2e2; border: none; color: #dc2626; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: center; }

/* ── Buttons ── */
.hi-btn-sel-all { background: #0d9488; color: #fff; border: none; border-radius: 6px; padding: 5px 12px; font-size: .78rem; font-weight: 600; cursor: pointer; }
.hi-btn-clear-sel { background: #f1f5f9; border: none; color: #475569; border-radius: 6px; padding: 5px 12px; font-size: .78rem; cursor: pointer; }
.hi-dlg-footer { display: flex; justify-content: flex-end; gap: 10px; }
.hi-btn-cancel { background: #f1f5f9; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; color: #475569; }
.hi-btn-save   { background: linear-gradient(135deg,#0f766e,#0d9488); color: #fff; border: none; border-radius: 8px; padding: 10px 22px; font-weight: 700; cursor: pointer; }
.hi-btn-save:disabled { opacity: .6; cursor: not-allowed; }
.hi-btn-print  { background: linear-gradient(135deg,#2563eb,#3b82f6); color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; }
.hi-btn-danger { background: linear-gradient(135deg,#dc2626,#b91c1c); color: #fff; border: none; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }

/* ── Report ── */
.hi-report-header { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #1e293b; margin-bottom: 16px; }
.hi-report-logo { width: 72px; height: 72px; object-fit: contain; }
.hi-report-logo-ph { font-size: 3rem; }
.hi-report-school-name { font-size: 1.2rem; font-weight: 800; color: #1e293b; }
.hi-report-doc-title   { font-size: 1rem; font-weight: 700; color: #0f766e; margin: 2px 0; }
.hi-report-meta-row    { display: flex; gap: 20px; font-size: .82rem; color: #64748b; margin-top: 3px; flex-wrap: wrap; }
.hi-report-summary { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.hi-rsb { border-radius: 8px; padding: 10px 16px; text-align: center; min-width: 70px; }
.hi-rsb--green { background: #dcfce7; color: #16a34a; }
.hi-rsb--red   { background: #fee2e2; color: #dc2626; }
.hi-rsb--amber { background: #fef3c7; color: #b45309; }
.hi-rsb--blue  { background: #dbeafe; color: #1d4ed8; }
.hi-rsb-num   { font-size: 1.5rem; font-weight: 800; }
.hi-rsb-label { font-size: .72rem; }
.hi-report-tabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.hi-tab { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 14px; font-size: .82rem; cursor: pointer; font-weight: 600; color: #475569; }
.hi-tab.active { background: #0d9488; color: #fff; border-color: #0d9488; }
.hi-report-section-title { font-weight: 700; font-size: .88rem; padding: 6px 12px; border-radius: 6px; margin: 12px 0 6px; color: #fff; }
.hi-rt--green { background: #16a34a; }
.hi-rt--red   { background: #dc2626; }
.hi-rt--amber { background: #d97706; }
.hi-report-table { width: 100%; border-collapse: collapse; font-size: .83rem; margin-bottom: 12px; }
.hi-report-table th, .hi-report-table td { border: 1px solid #e2e8f0; padding: 6px 10px; }
.hi-report-table th { background: #f1f5f9; font-weight: 700; color: #374151; }
.hi-no-data { text-align: center; color: #94a3b8; padding: 12px; }
.hi-report-photos { display: flex; gap: 4px; flex-wrap: wrap; }
.hi-report-photo-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; cursor: pointer; }
.hi-sig-row { display: flex; gap: 24px; margin-top: 48px; justify-content: space-around; }
.hi-sig-col { display: flex; flex-direction: column; align-items: center; flex: 1; }
.hi-sig-line { width: 160px; border-bottom: 1px solid #000; margin-bottom: 4px; margin-top: 40px; }
.hi-sig-label { font-size: .78rem; color: #374151; }
.hi-sig-role  { font-size: .74rem; color: #64748b; margin-top: 2px; }

@media (max-width: 768px) {
  .hi-selector-layout { grid-template-columns: 1fr; }
  .hi-info-row { grid-template-columns: 1fr 1fr; }
}
</style>
