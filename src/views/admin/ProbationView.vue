<template>
  <AppLayout>
    <div class="pb-page" v-loading="loading">

      <!-- ══ Header ══ -->
      <div class="pb-hero">
        <div class="pb-hero-left">
          <div class="pb-hero-icon">📋</div>
          <div>
            <h1 class="pb-title">บันทึกทัณฑ์บนนักเรียน</h1>
            <p class="pb-sub">ความผิดร้ายแรง — คะแนนที่หักไม่สามารถชดเชยด้วยคะแนนความประพฤติทั่วไป</p>
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <el-button v-if="allRows.length" @click="printReport" class="pb-btn-print">🖨 พิมพ์รายงาน</el-button>
          <button v-if="canManage" class="pb-btn-create" @click="openCreate">+ สร้างบันทึกทัณฑ์บน</button>
        </div>
      </div>

      <!-- ══ Summary cards ══ -->
      <div class="pb-summary-row">
        <div class="pb-sc pb-sc--red">
          <div class="pb-sc-icon">⚠️</div>
          <div class="pb-sc-num">{{ stats.activeStudents }}</div>
          <div class="pb-sc-label">นักเรียนที่มีทัณฑ์บน</div>
        </div>
        <div class="pb-sc pb-sc--amber">
          <div class="pb-sc-icon">📝</div>
          <div class="pb-sc-num">{{ stats.totalRecords }}</div>
          <div class="pb-sc-label">รายการทั้งหมด</div>
        </div>
        <div class="pb-sc pb-sc--purple">
          <div class="pb-sc-icon">📉</div>
          <div class="pb-sc-num">{{ stats.totalDeducted }}</div>
          <div class="pb-sc-label">คะแนนที่หักรวม</div>
        </div>
      </div>

      <!-- ══ Filters ══ -->
      <div class="pb-filter-bar">
        <div class="pb-filter-group">
          <label class="pb-flabel">ห้องเรียน</label>
          <el-select v-model="filterClass" placeholder="ทุกห้อง" clearable style="width:140px" @change="loadRows">
            <el-option v-for="c in classes" :key="c.class_id" :label="c.class_name||c.class_id" :value="c.class_id" />
          </el-select>
        </div>
        <div class="pb-filter-group">
          <label class="pb-flabel">รหัส / ชื่อนักเรียน</label>
          <el-input v-model="filterName" placeholder="ค้นหา..." style="width:190px" clearable />
        </div>
        <div class="pb-filter-group">
          <label class="pb-flabel">สถานะ</label>
          <el-select v-model="filterStatus" style="width:125px">
            <el-option label="ทั้งหมด" value="" />
            <el-option label="มีผลอยู่" value="active" />
            <el-option label="ยกเลิกแล้ว" value="lifted" />
          </el-select>
        </div>
        <button class="pb-btn-search" @click="loadRows">🔍 ค้นหา</button>
      </div>

      <!-- ══ Permission notice for read-only teachers ══ -->
      <div v-if="!canManage && myHomeroomClass" class="pb-readonly-notice">
        <span>👁 คุณมีสิทธิ์ดูรายการทัณฑ์บนของห้อง <b>{{ myHomeroomClass }}</b> เท่านั้น (ดูได้อย่างเดียว)</span>
      </div>

      <!-- ══ Empty ══ -->
      <div v-if="!studentGroups_.length && !loading" class="pb-empty-state">
        <div class="pb-empty-icon">📭</div>
        <div class="pb-empty-text">ไม่พบข้อมูลทัณฑ์บน</div>
      </div>

      <!-- ══ Student Groups ══ -->
      <div v-for="(group, gi) in studentGroups_" :key="group.student_code" class="pb-card"
        :style="`--accent:${groupColors[gi % groupColors.length]}`">

        <div class="pb-card-header" @click="openStudentHistory(group, gi)">
          <div class="pb-card-left">
            <div class="pb-card-avatar" :style="`background:${groupColors[gi % groupColors.length]}22;color:${groupColors[gi % groupColors.length]}`">
              {{ (group.student_name||'?')[0] }}
            </div>
            <div>
              <div class="pb-card-name">{{ group.student_name }}</div>
              <div class="pb-card-meta">🏫 {{ group.class_id }} &nbsp;·&nbsp; {{ group.records.length }} บันทึก</div>
            </div>
          </div>
          <div class="pb-card-right">
            <div class="pb-card-score-badge" :class="group.totalDeducted < 0 ? 'red' : 'gray'">
              {{ group.totalDeducted > 0 ? '+' : '' }}{{ group.totalDeducted }} คะแนน
            </div>
            <span class="pb-status-dot" :class="group.hasActive ? 'active' : 'lifted'">
              {{ group.hasActive ? 'มีผลอยู่' : 'ยกเลิก' }}
            </span>
            <span class="pb-chevron-arrow">›</span>
          </div>
        </div>

      </div>

    </div>

    <!-- ══ Student History Dialog ══ -->
    <el-dialog v-model="historyDialog" width="800px" :close-on-click-modal="true" class="pb-dialog">
      <template #header>
        <div class="pb-dlg-header" :style="`border-left:4px solid ${historyColor};padding-left:12px`">
          <div class="pb-hist-avatar" :style="`background:${historyColor}22;color:${historyColor}`">
            {{ (historyGroup?.student_name||'?')[0] }}
          </div>
          <div>
            <div class="pb-dlg-title">{{ historyGroup?.student_name }}</div>
            <div style="font-size:.8rem;color:#64748b">🏫 {{ historyGroup?.class_id }} &nbsp;·&nbsp; {{ historyGroup?.records?.length }} บันทึก &nbsp;·&nbsp; คะแนนหักรวม <b style="color:#dc2626">{{ historyGroup?.totalDeducted }}</b></div>
          </div>
        </div>
      </template>

      <div v-if="historyGroup" class="pb-hist-body">
        <!-- Summary strip -->
        <div class="pb-hist-summary" :style="`background:${historyColor}11;border:1px solid ${historyColor}33`">
          <div class="pb-hist-sum-item">
            <div class="pb-hist-sum-num" style="color:#dc2626">{{ historyGroup.records.filter(r=>r.status==='active').length }}</div>
            <div class="pb-hist-sum-label">รายการมีผล</div>
          </div>
          <div class="pb-hist-sum-item">
            <div class="pb-hist-sum-num" style="color:#64748b">{{ historyGroup.records.filter(r=>r.status==='lifted').length }}</div>
            <div class="pb-hist-sum-label">ยกเลิกแล้ว</div>
          </div>
          <div class="pb-hist-sum-item">
            <div class="pb-hist-sum-num" style="color:#7c3aed">{{ historyGroup.totalDeducted }}</div>
            <div class="pb-hist-sum-label">คะแนนหักรวม</div>
          </div>
        </div>

        <!-- Timeline records -->
        <div class="pb-hist-timeline">
          <div v-for="(r, ri) in historyGroup.records" :key="r.id"
            class="pb-hist-rec" :class="r.status==='lifted'?'lifted':''"
            @click="openDetail(r)">
            <div class="pb-hist-dot" :style="`background:${r.status==='active'?historyColor:'#cbd5e1'}`">
              {{ ri + 1 }}
            </div>
            <div class="pb-hist-line" v-if="ri < historyGroup.records.length-1" :style="`background:${historyColor}33`"></div>
            <div class="pb-hist-card">
              <div class="pb-hist-card-top">
                <span class="pb-hist-date">{{ fmtDateThai(r.date) }}</span>
                <el-tag size="small" :type="r.status==='active'?'danger':'info'" effect="light">
                  {{ r.status==='active'?'มีผลอยู่':'ยกเลิก' }}
                </el-tag>
                <span class="pb-hist-pts" :class="(r.score_deduction||0)<0?'minus':''">{{ r.score_deduction||0 }} คะแนน</span>
              </div>
              <div class="pb-hist-incident">{{ r.incident }}</div>
              <div class="pb-hist-penalty">📌 {{ r.penalty }}</div>
              <div class="pb-hist-meta">
                <span>บันทึกโดย {{ r.created_by_name||'—' }}</span>
                <span v-if="(r.images||[]).length">🖼 {{ r.images.length }}</span>
                <span v-if="(r.documents||[]).length">📄 {{ r.documents.length }}</span>
              </div>
              <div class="pb-hist-click-hint">คลิกเพื่อดูรายละเอียดเต็ม →</div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="pb-dlg-footer">
          <button class="pb-btn-cancel" @click="historyDialog=false">ปิด</button>
          <button v-if="canManage" class="pb-btn-save" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)"
            @click="historyDialog=false; openCreateFor(historyGroup)">
            + เพิ่มบันทึกทัณฑ์บน
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- ══════════════════════════════════════
         CREATE DIALOG
    ══════════════════════════════════════ -->
    <el-dialog v-model="createDialog" width="760px" :close-on-click-modal="false" class="pb-dialog">
      <template #header>
        <div class="pb-dlg-header">
          <span class="pb-dlg-icon">📋</span>
          <span class="pb-dlg-title">สร้างบันทึกทัณฑ์บน</span>
        </div>
      </template>

      <div class="pb-form">

        <!-- ── นักเรียน ── -->
        <div class="pb-section pb-section--blue">
          <div class="pb-section-label">👤 ข้อมูลนักเรียน</div>
          <div class="pb-row2">
            <div class="pb-field">
              <label class="pb-label">ห้องเรียน <span class="req">*</span></label>
              <el-select v-model="form.class_id" placeholder="เลือกห้อง" style="width:100%"
                @change="onClassChange" :disabled="form._locked">
                <el-option v-for="c in classes" :key="c.class_id" :label="c.class_name||c.class_id" :value="c.class_id" />
              </el-select>
            </div>
            <div class="pb-field">
              <label class="pb-label">นักเรียน <span class="req">*</span></label>
              <el-select v-model="form.student_code" filterable placeholder="เลือกหรือพิมพ์ชื่อ"
                style="width:100%" :disabled="!form.class_id || form._locked" @change="onStudentChange">
                <el-option v-for="s in studentsInClass" :key="s.student_code"
                  :label="`${s.student_code} · ${s.prefix||''}${s.first_name} ${s.last_name}`"
                  :value="s.student_code" />
              </el-select>
              <div v-if="form.class_id && !studentsInClass.length" class="pb-field-hint">⚠️ ไม่พบนักเรียนในห้องนี้</div>
            </div>
          </div>
          <div class="pb-row2">
            <div class="pb-field">
              <label class="pb-label">วันที่ <span class="req">*</span></label>
              <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </div>
            <div class="pb-field">
              <label class="pb-label">คะแนนที่หัก (ตัวเลขลบ เช่น -10) <span class="req">*</span></label>
              <el-input-number v-model="form.score_deduction" :max="0" :step="1" style="width:100%" />
            </div>
          </div>
        </div>

        <!-- ── ความผิด ── -->
        <div class="pb-section pb-section--red">
          <div class="pb-section-label">⚠️ รายละเอียดความผิดและทัณฑ์บน</div>
          <div class="pb-field">
            <label class="pb-label">เหตุการณ์ / ความผิดที่กระทำ <span class="req">*</span></label>
            <el-input v-model="form.incident" type="textarea" :rows="3"
              placeholder="ระบุเหตุการณ์และความผิดโดยละเอียด..." />
          </div>
          <div class="pb-field mt-3">
            <label class="pb-label">ทัณฑ์บน / บทลงโทษ <span class="req">*</span></label>
            <el-input v-model="form.penalty" type="textarea" :rows="3"
              placeholder="ระบุรายละเอียดทัณฑ์บน เงื่อนไข ระยะเวลา..." />
          </div>
          <div class="pb-field mt-3">
            <label class="pb-label">หมายเหตุเพิ่มเติม</label>
            <el-input v-model="form.details" type="textarea" :rows="2" placeholder="(ไม่บังคับ)" />
          </div>
        </div>

        <!-- ── รูปภาพ ── -->
        <div class="pb-section pb-section--green">
          <div class="pb-section-label">🖼 รูปภาพประกอบ (สูงสุด 2 ภาพ)</div>
          <div class="pb-img-row">
            <div v-for="n in 2" :key="n" class="pb-img-slot">
              <div class="pb-img-label">ภาพที่ {{ n }}</div>
              <div class="pb-img-box" @click="pickImage(n-1)">
                <img v-if="form.images[n-1]" :src="form.images[n-1].data" class="pb-img-preview" />
                <div v-else class="pb-img-empty">
                  <span class="pb-img-plus">+</span>
                  <span class="pb-img-hint">คลิกเลือกภาพ</span>
                </div>
              </div>
              <button v-if="form.images[n-1]" class="pb-img-remove" @click.stop="removeImage(n-1)">✕ ลบ</button>
            </div>
          </div>
        </div>

        <!-- ── เอกสาร ── -->
        <div class="pb-section pb-section--amber">
          <div class="pb-section-label">📄 เอกสารแนบ — ไฟล์ที่ 1 บังคับ (สูงสุด 3 ไฟล์)</div>
          <div class="pb-doc-list">
            <div v-for="n in 3" :key="n" class="pb-doc-row">
              <div class="pb-doc-num" :class="n===1?'required':''">{{ n }}{{ n===1?' ★':'' }}</div>
              <div v-if="form.documents[n-1]" class="pb-doc-file">
                <span class="pb-doc-icon">{{ docIcon(form.documents[n-1].type) }}</span>
                <span class="pb-doc-name">{{ form.documents[n-1].name }}</span>
                <button class="pb-doc-remove" @click="removeDoc(n-1)">✕</button>
              </div>
              <button v-else class="pb-doc-pick" :class="n===1?'required':''"
                @click="pickDoc(n-1)">
                {{ n === 1 ? '+ เลือกเอกสาร (บังคับ)' : '+ เลือกเอกสาร' }}
              </button>
            </div>
          </div>
        </div>

      </div>

      <template #footer>
        <div class="pb-dlg-footer">
          <button class="pb-btn-cancel" @click="createDialog = false">ยกเลิก</button>
          <button class="pb-btn-save" :disabled="saving" @click="saveRecord">
            <span v-if="saving">⏳ กำลังบันทึก...</span>
            <span v-else>💾 บันทึกทัณฑ์บน</span>
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- ══ Detail Dialog ══ -->
    <el-dialog v-model="detailDialog" width="700px" :title="`ทัณฑ์บน — ${detail?.student_name}`">
      <div v-if="detail" class="pb-detail">
        <div class="pb-detail-header">
          <div class="pb-detail-school">{{ schoolStore.schoolName }}</div>
          <div class="pb-detail-title">บันทึกทัณฑ์บนนักเรียน</div>
          <div class="pb-detail-warning">⚠️ ความผิดร้ายแรง — ไม่สามารถชดเชยด้วยคะแนนความประพฤติทั่วไป</div>
        </div>
        <table class="pb-dtable">
          <tr><th>ชื่อ-นามสกุล</th><td>{{ detail.student_name }}</td><th>ห้องเรียน</th><td>{{ detail.class_id }}</td></tr>
          <tr><th>วันที่</th><td>{{ fmtDateThai(detail.date) }}</td><th>คะแนนหัก</th><td><b class="text-red-600">{{ detail.score_deduction||0 }}</b></td></tr>
          <tr><th>ผู้บันทึก</th><td>{{ detail.created_by_name||'—' }}</td><th>สถานะ</th>
            <td><span :class="detail.status==='active'?'pb-badge-danger':'pb-badge-gray'">{{ detail.status==='active'?'มีผลอยู่':'ยกเลิก' }}</span></td>
          </tr>
        </table>
        <div class="pb-dblock"><div class="pb-dblock-title">เหตุการณ์ / ความผิด</div><div class="pb-dblock-body">{{ detail.incident }}</div></div>
        <div class="pb-dblock"><div class="pb-dblock-title">ทัณฑ์บน / บทลงโทษ</div><div class="pb-dblock-body">{{ detail.penalty }}</div></div>
        <div v-if="detail.details" class="pb-dblock"><div class="pb-dblock-title">หมายเหตุ</div><div class="pb-dblock-body">{{ detail.details }}</div></div>
        <div v-if="detail.images?.length" class="pb-dblock">
          <div class="pb-dblock-title">รูปภาพ</div>
          <div class="pb-dimgs">
            <img v-for="(img,i) in detail.images" :key="i" :src="img.data" class="pb-dimg" @click="viewImg=img.data" />
          </div>
        </div>
        <div v-if="detail.documents?.length" class="pb-dblock">
          <div class="pb-dblock-title">เอกสาร</div>
          <div v-for="(doc,i) in detail.documents" :key="i" class="pb-ddoc">
            <span>{{ docIcon(doc.type) }}</span>
            <span class="flex-1 truncate">{{ doc.name }}</span>
            <el-button size="small" text @click="downloadDoc(doc)">⬇ ดาวน์โหลด</el-button>
          </div>
        </div>
        <div class="pb-sig-row print-only">
          <div v-for="l in ['ผู้บันทึก / ครูที่ปรึกษา','หัวหน้าฝ่ายปกครอง','ผู้อำนวยการ']" :key="l" class="pb-sig-col">
            <div class="pb-sig-line"></div><div class="pb-sig-label">{{ l }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button v-if="canManage && detail?.status==='active'" type="warning" @click="liftProbation(detail)">ยกเลิกทัณฑ์บน</el-button>
        <el-button @click="printDetail">🖨 พิมพ์</el-button>
        <el-button @click="detailDialog=false">ปิด</el-button>
      </template>
    </el-dialog>

    <!-- Image viewer -->
    <el-dialog v-model="imgViewerOpen" width="auto" :show-close="true" @close="viewImg=null">
      <img v-if="viewImg" :src="viewImg" style="max-width:90vw;max-height:80vh;display:block;margin:auto" />
    </el-dialog>

    <input ref="imgInputRef" type="file" accept="image/*" class="hidden" @change="onImageSelected" />
    <input ref="docInputRef" type="file"
      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
      class="hidden" @change="onDocSelected" />
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
const schoolId    = () => authStore.schoolId
const { getClasses } = useSchoolDb()

const groupColors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316']

// ── State ──
const loading  = ref(false)
const saving   = ref(false)
const allRows  = ref([])
const students = ref([])
const classes  = ref([])

// ── Permission state ──
const myHomeroomClass = ref(null)

const filterClass  = ref('')
const filterName   = ref('')
const filterStatus = ref('')

const createDialog  = ref(false)
const detailDialog  = ref(false)
const detail        = ref(null)
const historyDialog = ref(false)
const historyGroup  = ref(null)
const historyColor  = ref('#ef4444')
const viewImg       = ref(null)
const imgViewerOpen = computed({ get: () => !!viewImg.value, set: v => { if (!v) viewImg.value = null } })
const imgInputRef   = ref(null)
const docInputRef   = ref(null)
let pickingImgIdx = 0
let pickingDocIdx = 0

function blankForm() {
  return { class_id:'', student_code:'', date: new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}),
    score_deduction:0, incident:'', penalty:'', details:'', images:[], documents:[], _student:null, _locked:false }
}
const form = ref(blankForm())

// ── Computed ──
const studentsInClass = computed(() =>
  form.value.class_id ? students.value.filter(s => s.class_id === form.value.class_id) : []
)

const filteredRows = computed(() => {
  let r = allRows.value
  if (filterClass.value)  r = r.filter(x => x.class_id === filterClass.value)
  if (filterStatus.value) r = r.filter(x => x.status === filterStatus.value)
  if (filterName.value) {
    const q = filterName.value.toLowerCase()
    r = r.filter(x => (x.student_name||'').toLowerCase().includes(q) || String(x.student_code).includes(filterName.value))
  }
  return r
})

const studentGroups_ = computed(() => {
  const map = new Map()
  for (const r of visibleRows.value) {
    if (!map.has(r.student_code)) {
      map.set(r.student_code, reactive({ student_code:r.student_code, student_name:r.student_name, class_id:r.class_id, records:[], open:false }))
    }
    map.get(r.student_code).records.push(r)
  }
  return [...map.values()]
    .map(g => ({
      ...g,
      totalDeducted: g.records.reduce((s,r) => s+(r.score_deduction||0), 0),
      hasActive: g.records.some(r => r.status === 'active'),
    }))
    .sort((a,b) => a.class_id.localeCompare(b.class_id) || a.student_name.localeCompare(b.student_name))
})

const stats = computed(() => ({
  activeStudents: studentGroups_.value.filter(g => g.hasActive).length,
  totalRecords: visibleRows.value.length,
  totalDeducted: visibleRows.value.reduce((s,r) => s+(r.score_deduction||0), 0),
}))

// ── Permission computed ──
const isAdmin = computed(() => ['school_admin','admin','superadmin'].includes(authStore.profile?.role))
const canManage = computed(() => {
  if (isAdmin.value) return true
  const roles = authStore.profile?.roles || []
  return roles.includes('student_affairs')
})
const visibleRows = computed(() => {
  if (canManage.value) return filteredRows.value
  // ครูที่ปรึกษา: เห็นเฉพาะห้องของตัวเอง
  const hc = myHomeroomClass.value
  if (!hc) return []
  return filteredRows.value.filter(r => r.class_id === hc)
})

// ── Load ──
onMounted(() => Promise.all([loadRows(), loadClasses(), loadStudents(), loadMyHomeroom()]))

async function loadRows() {
  loading.value = true
  const { data } = await supabase.from('student_probations').select('*').eq('school_id', schoolId()).order('date',{ascending:false})
  allRows.value = data || []
  loading.value = false
}

async function loadClasses() {
  classes.value = await getClasses()
}

async function loadMyHomeroom() {
  if (isAdmin.value) return
  const teacherId = authStore.profile?.teacher_id
  if (!teacherId) return
  const { data } = await supabase.from('classes').select('class_name')
    .eq('school_id', schoolId())
    .filter('homeroom_teacher_ids', 'cs', `{"${teacherId}"}`)
    .limit(1).maybeSingle()
  myHomeroomClass.value = data?.class_name || null
}


async function loadStudents() {
  // Try with probation_score first; fall back without it if column doesn't exist
  let { data, error } = await supabase.from('students')
    .select('student_code,prefix,first_name,last_name,class_id,probation_score,total_behavior_score,general_behavior_score,attendance_behavior_score,learning_behavior_score,behavior_carry_over')
    .eq('school_id', schoolId())
    .or('student_status.eq.เรียนอยู่,student_status.is.null')
    .order('class_id').order('first_name')
  if (error) {
    // probation_score might not exist yet — retry without it
    const res = await supabase.from('students')
      .select('student_code,prefix,first_name,last_name,class_id,total_behavior_score,general_behavior_score,attendance_behavior_score,learning_behavior_score,behavior_carry_over')
      .eq('school_id', schoolId())
      .or('student_status.eq.เรียนอยู่,student_status.is.null')
      .order('class_id').order('first_name')
    data = res.data
  }
  students.value = (data || []).map(s => ({ ...s, probation_score: s.probation_score ?? 0 }))
}

// ── Dialog ──
function openStudentHistory(group, gi) {
  historyGroup.value = group
  historyColor.value = groupColors[gi % groupColors.length]
  historyDialog.value = true
}
function openCreate() { form.value = blankForm(); createDialog.value = true }
function openCreateFor(group) {
  form.value = blankForm()
  form.value.class_id = group.class_id
  form.value.student_code = group.student_code
  form.value._student = students.value.find(x => x.student_code === group.student_code) || null
  form.value._locked = true
  createDialog.value = true
}
function openDetail(row) { detail.value = row; detailDialog.value = true }
function onClassChange() { form.value.student_code = ''; form.value._student = null }
function onStudentChange(code) { form.value._student = students.value.find(x => x.student_code === code) || null }

// ── Images ──
function pickImage(idx) { pickingImgIdx = idx; imgInputRef.value.value = ''; imgInputRef.value.click() }
function onImageSelected(e) {
  const file = e.target.files[0]; if (!file) return
  if (file.size > 5*1024*1024) { ElMessage.error('ภาพต้องไม่เกิน 5MB'); return }
  const r = new FileReader()
  r.onload = ev => { const imgs=[...form.value.images]; imgs[pickingImgIdx]={name:file.name,data:ev.target.result}; form.value.images=imgs }
  r.readAsDataURL(file)
}
function removeImage(idx) { const imgs=[...form.value.images]; imgs.splice(idx,1); form.value.images=imgs }

// ── Docs ──
function pickDoc(idx) { pickingDocIdx = idx; docInputRef.value.value = ''; docInputRef.value.click() }
function onDocSelected(e) {
  const file = e.target.files[0]; if (!file) return
  if (file.size > 10*1024*1024) { ElMessage.error('เอกสารต้องไม่เกิน 10MB'); return }
  const r = new FileReader()
  r.onload = ev => { const docs=[...form.value.documents]; while(docs.length<=pickingDocIdx) docs.push(undefined); docs[pickingDocIdx]={name:file.name,type:file.type,data:ev.target.result}; form.value.documents=docs }
  r.readAsDataURL(file)
}
function removeDoc(idx) { const docs=[...form.value.documents]; docs.splice(idx,1); form.value.documents=docs }

// ── Save ──
async function saveRecord() {
  const f = form.value
  if (!f.student_code)    { ElMessage.error('กรุณาเลือกนักเรียน'); return }
  if (!f.date)            { ElMessage.error('กรุณาระบุวันที่'); return }
  if (!f.incident.trim()) { ElMessage.error('กรุณาระบุเหตุการณ์/ความผิด'); return }
  if (!f.penalty.trim())  { ElMessage.error('กรุณาระบุทัณฑ์บน/บทลงโทษ'); return }
  if (!f.documents[0])    { ElMessage.error('กรุณาแนบเอกสาร (ไฟล์ที่ 1 บังคับ)'); return }
  if (f.score_deduction > 0) { ElMessage.error('คะแนนที่หักต้องเป็นตัวเลขลบหรือ 0'); return }

  const s = f._student
  const studentName = s ? `${s.prefix||''}${s.first_name} ${s.last_name}` : String(f.student_code)
  const deduction = f.score_deduction || 0

  saving.value = true
  try {
    const { error: pbErr } = await supabase.from('student_probations').insert([{
      school_id: schoolId(), student_code: f.student_code,
      class_id: s?.class_id || f.class_id || '', student_name: studentName,
      date: f.date, score_deduction: deduction,
      incident: f.incident.trim(), penalty: f.penalty.trim(),
      details: f.details.trim() || null,
      images: f.images.filter(Boolean), documents: f.documents.filter(Boolean),
      created_by: authStore.profile?.uid || authStore.profile?.id || '',
      created_by_name: authStore.profile?.displayName || '', status: 'active',
    }])
    if (pbErr) throw pbErr

    if (deduction !== 0 && s) {
      const cur = s.probation_score ?? 0
      const newProb  = cur + deduction
      const carryOver  = s.behavior_carry_over ?? 0
      const general    = s.general_behavior_score ?? 0
      const attendance = s.attendance_behavior_score ?? 0
      const learning   = s.learning_behavior_score ?? 0
      const newTotal   = carryOver + general + attendance + learning + newProb
      const term = schoolStore.currentTerm
      const { data: { user: authUser } } = await supabase.auth.getUser()

      await supabase.from('behavior_logs').insert({
        school_id: schoolId(), term_id: term,
        student_id: f.student_code, class_id: s.class_id,
        behavior_type: 'probation',
        behavior_type_label_snapshot: 'ทัณฑ์บน (ความผิดร้ายแรง)',
        label_snapshot: `ทัณฑ์บน: ${f.incident.trim().slice(0,60)}`,
        points_change: deduction, score_after: newTotal,
        note: f.penalty.trim().slice(0,200),
        recorded_by: authUser?.id || null,
        recorded_by_name_snapshot: authStore.profile?.displayName || '',
        source_type: 'probation', date: f.date,
        created_at: new Date().toISOString(), image_urls: [],
      })

      // Try to update probation_score; fall back without it if column doesn't exist
      const { error: updErr } = await supabase.from('students')
        .update({ total_behavior_score: newTotal, probation_score: newProb })
        .eq('student_code', f.student_code).eq('school_id', schoolId())
      if (updErr) {
        await supabase.from('students')
          .update({ total_behavior_score: newTotal })
          .eq('student_code', f.student_code).eq('school_id', schoolId())
      }

      const idx = students.value.findIndex(x => x.student_code === f.student_code)
      if (idx >= 0) students.value[idx] = { ...students.value[idx], probation_score: newProb, total_behavior_score: newTotal }
    }

    ElMessage.success('บันทึกทัณฑ์บนเรียบร้อย')
    createDialog.value = false
    await loadRows()
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function liftProbation(row) {
  await ElMessageBox.confirm(`ยืนยันยกเลิกทัณฑ์บนของ ${row.student_name}?`, 'ยืนยัน',
    { confirmButtonText:'ยืนยัน', cancelButtonText:'ยกเลิก', type:'warning' })
  await supabase.from('student_probations').update({ status:'lifted' }).eq('id', row.id)
  if (row.score_deduction) {
    const s = students.value.find(x => x.student_code === row.student_code)
    if (s) {
      const newProb  = (s.probation_score ?? 0) - row.score_deduction
      const newTotal = (s.total_behavior_score ?? 0) - row.score_deduction
      const { error: liftErr } = await supabase.from('students')
        .update({ total_behavior_score: newTotal, probation_score: newProb })
        .eq('student_code', row.student_code).eq('school_id', schoolId())
      if (liftErr) {
        await supabase.from('students')
          .update({ total_behavior_score: newTotal })
          .eq('student_code', row.student_code).eq('school_id', schoolId())
      }
    }
  }
  ElMessage.success('ยกเลิกทัณฑ์บนแล้ว')
  detailDialog.value = false
  await Promise.all([loadRows(), loadStudents()])
}

function downloadDoc(doc) { const a=document.createElement('a'); a.href=doc.data; a.download=doc.name; a.click() }
function printDetail() { window.print() }
function printReport() {
  const win = window.open('', '_blank')
  const body = studentGroups_.value.map(g =>
    `<tr style="background:#fff0f0;font-weight:bold"><td colspan="5">${g.student_name} — ห้อง ${g.class_id} | รวม ${g.records.length} บันทึก | คะแนนหัก ${g.totalDeducted}</td></tr>` +
    g.records.map(r=>`<tr><td></td><td>${fmtDateThai(r.date)}</td><td>${r.incident}</td><td>${r.score_deduction||0}</td><td>${r.status==='active'?'มีผลอยู่':'ยกเลิก'}</td></tr>`).join('')
  ).join('')
  win.document.write(`<html><head><title>รายงานทัณฑ์บน</title><style>body{font-family:'Sarabun',sans-serif;font-size:13px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px}th{background:#f5f5f5}h2{text-align:center}</style></head><body>
    <h2>${schoolStore.schoolName||'โรงเรียน'}</h2><p style="text-align:center">รายงานทัณฑ์บน | ${fmtDateThai(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}))}</p>
    <table><thead><tr><th>ชื่อ-นามสกุล</th><th>วันที่</th><th>ความผิด</th><th>คะแนน</th><th>สถานะ</th></tr></thead><tbody>${body}</tbody></table></body></html>`)
  win.document.close(); win.print()
}

function fmtDate(d) { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}) }
function fmtDateThai(d) { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}) }
function docIcon(t) { if(!t) return '📄'; if(t.includes('pdf')) return '📕'; if(t.includes('word')||t.includes('doc')) return '📝'; if(t.includes('sheet')||t.includes('excel')||t.includes('xls')) return '📊'; if(t.includes('image')) return '🖼'; return '📄' }
</script>

<style scoped>
/* ── Page ── */
.pb-page { padding: 24px; max-width: 1200px; margin: 0 auto; }

/* ── Hero header ── */
.pb-hero { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,#7f1d1d,#dc2626); border-radius: 16px; padding: 20px 24px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.pb-hero-left { display: flex; align-items: center; gap: 14px; }
.pb-hero-icon { font-size: 2rem; }
.pb-title { font-size: 1.4rem; font-weight: 800; color: #fff; margin: 0 0 2px; }
.pb-sub   { color: #fca5a5; font-size: .82rem; margin: 0; }
.pb-btn-create { background: #fff; color: #dc2626; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; font-size: .9rem; transition: transform .15s; }
.pb-btn-create:hover { transform: scale(1.03); }
.pb-btn-print { background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.3) !important; }
.pb-btn-perm { background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.4); border-radius: 8px; padding: 8px 14px; font-size: .85rem; cursor: pointer; }
.pb-btn-perm:hover { background: rgba(255,255,255,.25); }
.pb-readonly-notice { background: #fef9c3; border: 1px solid #fde047; border-radius: 10px; padding: 10px 16px; font-size: .85rem; color: #713f12; margin-bottom: 12px; }

/* ── Summary cards ── */
.pb-summary-row { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.pb-sc { flex: 1; min-width: 130px; border-radius: 14px; padding: 18px 20px; color: #fff; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,.15); }
.pb-sc--red    { background: linear-gradient(135deg,#ef4444,#dc2626); }
.pb-sc--amber  { background: linear-gradient(135deg,#f59e0b,#d97706); }
.pb-sc--purple { background: linear-gradient(135deg,#8b5cf6,#7c3aed); }
.pb-sc-icon { font-size: 1.5rem; }
.pb-sc-num  { font-size: 2.2rem; font-weight: 800; line-height: 1.1; }
.pb-sc-label{ font-size: .75rem; opacity: .85; margin-top: 2px; }

/* ── Filter bar ── */
.pb-filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; background: white; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.07); }
.pb-filter-group { display: flex; flex-direction: column; gap: 4px; }
.pb-flabel { font-size: .75rem; font-weight: 700; color: #64748b; }
.pb-btn-search { background: linear-gradient(135deg,#6366f1,#4f46e5); color: #fff; border: none; border-radius: 8px; padding: 8px 18px; font-weight: 600; cursor: pointer; align-self: flex-end; }

/* ── Empty ── */
.pb-empty-state { text-align: center; padding: 60px 20px; }
.pb-empty-icon { font-size: 3rem; }
.pb-empty-text { color: #94a3b8; margin-top: 8px; }

/* ── Student cards ── */
.pb-card { background: white; border-radius: 14px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08); overflow: hidden; border-left: 4px solid var(--accent); }
.pb-card-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; cursor: pointer; transition: background .15s; }
.pb-card-header:hover { background: #fafafa; }
.pb-card-left { display: flex; align-items: center; gap: 12px; }
.pb-card-avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0; }
.pb-card-name { font-weight: 700; color: #1e293b; font-size: .95rem; }
.pb-card-meta { font-size: .75rem; color: #64748b; margin-top: 2px; }
.pb-card-right { display: flex; align-items: center; gap: 10px; }
.pb-card-score-badge { font-size: .82rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
.pb-card-score-badge.red  { background: #fee2e2; color: #dc2626; }
.pb-card-score-badge.gray { background: #f1f5f9; color: #64748b; }
.pb-status-dot { font-size: .75rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.pb-status-dot.active { background: #fee2e2; color: #dc2626; }
.pb-status-dot.lifted { background: #f1f5f9; color: #64748b; }
.pb-chevron-arrow { font-size: 1.4rem; color: #94a3b8; transition: transform .15s; display: inline-block; }
.pb-card-header:hover .pb-chevron-arrow { color: #475569; transform: translateX(3px); }

/* ── History Dialog ── */
.pb-hist-avatar { width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.15rem;flex-shrink:0; }
.pb-hist-body { max-height:65vh;overflow-y:auto;padding:4px 2px; }
.pb-hist-summary { display:flex;gap:24px;justify-content:center;border-radius:12px;padding:14px 20px;margin-bottom:20px;text-align:center; }
.pb-hist-sum-num { font-size:1.8rem;font-weight:800;line-height:1.1; }
.pb-hist-sum-label { font-size:.74rem;color:#64748b;margin-top:2px; }
.pb-hist-timeline { position:relative;padding-left:44px; }
.pb-hist-rec { position:relative;margin-bottom:20px;cursor:pointer; }
.pb-hist-rec.lifted { opacity:.6; }
.pb-hist-dot { position:absolute;left:-44px;top:0;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;color:#fff;z-index:1; }
.pb-hist-line { position:absolute;left:-29px;top:30px;width:2px;bottom:-20px;border-radius:2px; }
.pb-hist-card { background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;transition:box-shadow .15s,transform .15s; }
.pb-hist-rec:hover .pb-hist-card { box-shadow:0 4px 16px rgba(0,0,0,.1);transform:translateX(3px); }
.pb-hist-card-top { display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap; }
.pb-hist-date { font-size:.78rem;color:#64748b; }
.pb-hist-pts { font-size:.85rem;font-weight:700;color:#64748b;margin-left:auto; }
.pb-hist-pts.minus { color:#dc2626; }
.pb-hist-incident { font-weight:600;color:#1e293b;margin-bottom:5px;font-size:.9rem; }
.pb-hist-penalty { color:#7c3aed;font-size:.83rem;margin-bottom:6px; }
.pb-hist-meta { display:flex;gap:12px;font-size:.74rem;color:#94a3b8;margin-bottom:4px; }
.pb-hist-click-hint { font-size:.72rem;color:#94a3b8;text-align:right;margin-top:4px; }
.pb-hist-rec:hover .pb-hist-click-hint { color:#6366f1; }

/* ── Records ── */
.pb-records { border-top: 1px solid #f1f5f9; }
.pb-rec { display: flex; align-items: center; gap: 10px; padding: 10px 18px 10px 14px; border-bottom: 1px solid #f8fafc; font-size: .84rem; position: relative; }
.pb-rec.lifted { opacity: .55; }
.pb-rec-stripe { width: 4px; height: 100%; position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; }
.pb-rec-date { min-width: 82px; color: #64748b; font-size: .76rem; flex-shrink: 0; }
.pb-rec-body { flex: 1; min-width: 0; }
.pb-rec-incident { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.pb-rec-by { font-size: .72rem; color: #94a3b8; }
.pb-rec-pts { min-width: 72px; text-align: right; font-weight: 700; flex-shrink: 0; color: #64748b; }
.pb-rec-pts.minus { color: #dc2626; }
.pb-rec-files { display: flex; gap: 6px; font-size: .72rem; color: #94a3b8; flex-shrink: 0; }
.pb-rec-view { background: #f1f5f9; border: none; border-radius: 6px; padding: 4px 10px; font-size: .78rem; cursor: pointer; color: #475569; flex-shrink: 0; }
.pb-rec-view:hover { background: #e2e8f0; }
.pb-add-more { padding: 10px 18px; }
.pb-btn-add-more { background: none; border: 1.5px dashed #fca5a5; color: #dc2626; border-radius: 8px; padding: 7px 16px; font-size: .82rem; cursor: pointer; font-weight: 600; transition: all .15s; }
.pb-btn-add-more:hover { background: #fee2e2; }

/* ── Form Dialog ── */
.pb-dlg-header { display: flex; align-items: center; gap: 10px; }
.pb-dlg-icon  { font-size: 1.4rem; }
.pb-dlg-title { font-size: 1.15rem; font-weight: 800; color: #1e293b; }
.pb-form { display: flex; flex-direction: column; gap: 12px; max-height: 65vh; overflow-y: auto; padding: 4px 2px; }
.pb-section { border-radius: 12px; padding: 16px; }
.pb-section--blue  { background: linear-gradient(135deg,#eff6ff,#dbeafe); border: 1px solid #bfdbfe; }
.pb-section--red   { background: linear-gradient(135deg,#fff5f5,#fee2e2); border: 1px solid #fecaca; }
.pb-section--green { background: linear-gradient(135deg,#f0fdf4,#dcfce7); border: 1px solid #bbf7d0; }
.pb-section--amber { background: linear-gradient(135deg,#fffbeb,#fef3c7); border: 1px solid #fde68a; }
.pb-section-label { font-size: .8rem; font-weight: 800; color: #374151; margin-bottom: 12px; letter-spacing: .02em; }
.pb-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pb-field { display: flex; flex-direction: column; gap: 5px; }
.pb-label { font-size: .78rem; font-weight: 700; color: #374151; }
.pb-label .req { color: #dc2626; }
.pb-field-hint { font-size: .72rem; color: #f59e0b; margin-top: 2px; }
.mt-3 { margin-top: 12px; }
.pb-dlg-footer { display: flex; justify-content: flex-end; gap: 10px; }
.pb-btn-cancel { background: #f1f5f9; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; color: #475569; }
.pb-btn-save { background: linear-gradient(135deg,#dc2626,#b91c1c); color: #fff; border: none; border-radius: 8px; padding: 10px 22px; font-weight: 700; cursor: pointer; font-size: .9rem; }
.pb-btn-save:disabled { opacity: .6; cursor: not-allowed; }

/* ── Image slots ── */
.pb-img-row { display: flex; gap: 20px; }
.pb-img-slot { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pb-img-label { font-size: .75rem; font-weight: 700; color: #374151; }
.pb-img-box { width: 130px; height: 130px; border: 2px dashed #86efac; border-radius: 12px; cursor: pointer; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f0fdf4; transition: border-color .2s; }
.pb-img-box:hover { border-color: #22c55e; background: #dcfce7; }
.pb-img-preview { width: 100%; height: 100%; object-fit: cover; }
.pb-img-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.pb-img-plus { font-size: 2rem; color: #86efac; line-height: 1; }
.pb-img-hint { font-size: .7rem; color: #6b7280; }
.pb-img-remove { background: #fee2e2; border: none; color: #dc2626; border-radius: 6px; padding: 2px 10px; font-size: .75rem; cursor: pointer; }

/* ── Doc list ── */
.pb-doc-list { display: flex; flex-direction: column; gap: 8px; }
.pb-doc-row { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.7); border-radius: 8px; padding: 8px 12px; }
.pb-doc-num { font-size: .8rem; font-weight: 800; color: #6b7280; min-width: 22px; }
.pb-doc-num.required { color: #dc2626; }
.pb-doc-file { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.pb-doc-icon { font-size: 1.2rem; }
.pb-doc-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .83rem; }
.pb-doc-remove { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 1rem; }
.pb-doc-pick { background: white; border: 1.5px dashed #fde68a; color: #92400e; border-radius: 7px; padding: 6px 12px; font-size: .8rem; cursor: pointer; font-weight: 600; transition: all .15s; }
.pb-doc-pick:hover { background: #fffbeb; }
.pb-doc-pick.required { border-color: #f59e0b; color: #b45309; }

/* ── Detail ── */
.pb-detail { font-family: 'Sarabun', sans-serif; }
.pb-detail-header { text-align: center; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 2px solid #1e293b; }
.pb-detail-school { font-size: .9rem; font-weight: 600; color: #475569; }
.pb-detail-title  { font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 4px 0; }
.pb-detail-warning { font-size: .78rem; color: #dc2626; }
.pb-dtable { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: .86rem; }
.pb-dtable th { background: #f1f5f9; color: #475569; font-weight: 700; padding: 6px 10px; border: 1px solid #e2e8f0; white-space: nowrap; }
.pb-dtable td { padding: 6px 10px; border: 1px solid #e2e8f0; }
.pb-dblock { margin-bottom: 14px; }
.pb-dblock-title { font-weight: 700; color: #1e293b; border-left: 4px solid #dc2626; padding-left: 8px; margin-bottom: 6px; }
.pb-dblock-body  { background: #f8fafc; border-radius: 8px; padding: 12px; font-size: .88rem; line-height: 1.7; white-space: pre-wrap; }
.pb-dimgs { display: flex; gap: 10px; flex-wrap: wrap; }
.pb-dimg  { width: 160px; height: 160px; object-fit: cover; border-radius: 8px; cursor: pointer; }
.pb-ddoc  { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 6px; font-size: .84rem; }
.pb-badge-danger { background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 99px; font-size: .78rem; font-weight: 700; }
.pb-badge-gray   { background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 99px; font-size: .78rem; }
.pb-sig-row { display: none; gap: 24px; margin-top: 40px; }
.pb-sig-col { display: flex; flex-direction: column; align-items: center; flex: 1; }
.pb-sig-line  { width: 150px; border-bottom: 1px solid #000; margin-top: 40px; }
.pb-sig-label { font-size: .78rem; color: #475569; margin-top: 4px; }
@media print { .pb-sig-row { display: flex !important; } }

/* ── Permission Dialog ── */
.pb-perm-body { display:flex;flex-direction:column;gap:12px; }
.pb-perm-notice { background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;font-size:.82rem;color:#0c4a6e;line-height:1.7; }

.pb-perm-list { max-height:340px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px; }
.pb-perm-empty { padding:20px;text-align:center;color:#94a3b8;font-size:.85rem; }
.pb-perm-row { display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f8fafc;transition:background .12s; }
.pb-perm-row:hover { background:#f8fafc; }
.pb-perm-row.selected { background:#fef0ff; }
.pb-perm-avatar { width:36px;height:36px;border-radius:50%;background:#e2e8f0;color:#475569;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0;transition:all .15s; }
.pb-perm-avatar.active { background:#8b5cf6;color:#fff; }
.pb-perm-info { flex:1;min-width:0; }
.pb-perm-name { font-size:.86rem;font-weight:600;color:#1e293b; }
.pb-perm-sub { font-size:.74rem;color:#94a3b8; }
.pb-perm-check { width:24px;height:24px;border-radius:50%;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;transition:all .15s;flex-shrink:0; }
.pb-perm-check.on { background:#8b5cf6;border-color:#8b5cf6;color:#fff; }
</style>
