<template>
  <AppLayout>
    <div class="p-6 school-settings-surface" v-loading="loading">
      <!-- Header Card -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">⚙️ ตั้งค่าโรงเรียน</h1>
            <p class="text-white/80 text-sm mt-1">กำหนดข้อมูลโรงเรียน ปีการศึกษา และตารางเรียน</p>
          </div>
          <div class="flex gap-2">
            <el-button @click="handleImport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า
            </el-button>
            <el-button @click="handleExport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก
            </el-button>
            <input ref="importFileRef" type="file" accept=".json,.xlsx" style="display:none" @change="onImportFile" />
          </div>
        </div>
      </div>

      <el-card class="section-card sec-plan mb-4">
        <template #header>
          <span class="section-title">💳 แพ็กเกจการใช้งาน</span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
          <div class="p-3 rounded-lg" style="background:#eff6ff;border:1px solid #bfdbfe">
            <div class="text-gray-500">ราคา/เดือน</div>
            <div class="font-semibold text-blue-700">{{ currentPlanFeeLabel }}</div>
          </div>
          <div class="p-3 rounded-lg" style="background:#f0fdf4;border:1px solid #bbf7d0">
            <div class="text-gray-500">จัดพร้อมกันสูงสุด</div>
            <div class="font-semibold text-green-700">{{ currentPlanLimitLabel }}</div>
          </div>
          <div class="p-3 rounded-lg" :style="planStatusBoxStyle">
            <div class="text-gray-500">สถานะ/หมดอายุ</div>
            <div class="font-semibold" :style="{ color: schoolStore.isViewOnlyMode ? '#b91c1c' : '#92400e' }">{{ currentPlanStatusLabel }}</div>
          </div>
        </div>

        <el-alert
          v-if="schoolStore.planNotice"
          type="warning"
          :closable="false"
          show-icon
          class="mb-2"
          :title="schoolStore.planNotice.title || 'มีการอัปเดตแพ็กเกจ'"
          :description="schoolStore.planNotice.message || ''"
        />
        <div v-if="schoolStore.planNotice?.unread" class="text-right">
          <el-button size="small" type="primary" plain @click="markPlanNoticeRead">รับทราบแล้ว</el-button>
        </div>

        <el-alert
          v-if="schoolStore.isViewOnlyMode"
          type="error"
          :closable="false"
          show-icon
          class="mt-3 mb-3"
          title="แพ็กเกจหมดอายุแล้ว"
          description="ระบบอยู่ในโหมดดูอย่างเดียว กรุณาส่งคำขอต่ออายุด้านล่าง"
        />

        <div class="mt-4 flex justify-end">
          <router-link to="/admin/renewal">
            <el-button type="primary" size="large">💳 ต่ออายุ / ส่งหลักฐานชำระเงิน →</el-button>
          </router-link>
        </div>

      </el-card>

      <!-- Section 0: โลโก้โรงเรียน -->
      <el-card class="section-card sec-logo mb-4">
        <template #header>
          <span class="section-title">🖼 โลโก้โรงเรียน</span>
        </template>
        <div class="flex items-center gap-6">
          <div class="logo-preview">
            <img v-if="form.logo_url" :src="form.logo_url" alt="โลโก้" class="w-24 h-24 object-contain rounded-xl border border-gray-200 bg-white p-1" />
            <div v-else class="w-24 h-24 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-3xl">🏫</div>
          </div>
          <div>
            <el-button type="primary" plain :loading="logoUploading" @click="triggerLogoUpload">
              {{ form.logo_url ? '🔄 เปลี่ยนโลโก้' : '📤 อัปโหลดโลโก้' }}
            </el-button>
            <el-button v-if="form.logo_url" type="danger" plain @click="removeLogo">ลบโลโก้</el-button>
            <input ref="logoFileRef" type="file" accept="image/*" style="display:none" @change="onLogoFile" />
            <div class="text-xs text-gray-400 mt-2">รองรับ JPG, PNG, SVG ขนาดไม่เกิน 2MB</div>
          </div>
        </div>
      </el-card>

      <!-- Section 1: ข้อมูลโรงเรียน -->
      <el-card class="section-card sec-school mb-4">
        <template #header>
          <span class="section-title">🏫 ข้อมูลโรงเรียน</span>
        </template>
        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="ชื่อโรงเรียน" required>
            <el-input v-model="form.name" placeholder="ชื่อโรงเรียนเต็ม" />
          </el-form-item>
          <el-form-item label="ชื่อย่อ / ภาษาอังกฤษ">
            <div class="flex gap-2">
              <el-input v-model="form.name_short" placeholder="ชื่อย่อ" class="flex-1" />
              <el-input v-model="form.name_en" placeholder="ภาษาอังกฤษ" class="flex-1" />
            </div>
          </el-form-item>
          <el-form-item label="ตำบล/แขวง">
            <el-input v-model="form.tambon" placeholder="ตำบล/แขวง" />
          </el-form-item>
          <el-form-item label="อำเภอ/เขต">
            <el-input v-model="form.amphoe" placeholder="อำเภอ/เขต" />
          </el-form-item>
          <el-form-item label="จังหวัด">
            <el-select v-model="form.changwat" placeholder="เลือกจังหวัด" filterable class="w-full">
              <el-option v-for="p in PROVINCES" :key="p" :label="p" :value="p" />
            </el-select>
          </el-form-item>
          <el-form-item label="รหัสไปรษณีย์">
            <el-input v-model="form.postal_code" placeholder="เช่น 10200" maxlength="5" />
          </el-form-item>
          <el-form-item label="โทรศัพท์">
            <el-input v-model="form.phone" placeholder="เช่น 02-xxx-xxxx" />
          </el-form-item>
          <el-form-item label="โทรสาร">
            <el-input v-model="form.fax" placeholder="เช่น 02-xxx-xxxx" />
          </el-form-item>
          <el-form-item label="อีเมลโรงเรียน">
            <el-input v-model="form.email" type="email" placeholder="school@example.com" />
          </el-form-item>
          <el-form-item label="เว็บไซต์">
            <el-input v-model="form.website" placeholder="https://www.school.ac.th" />
          </el-form-item>
        </div>
      </el-card>

      <!-- Section 2: ผู้บริหาร -->
      <el-card class="section-card sec-admin mb-4">
        <template #header>
          <span class="section-title">👤 ผู้บริหาร</span>
        </template>
        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="ชื่อ-นามสกุล ผู้อำนวยการ">
            <el-input v-model="form.principal_name" placeholder="เช่น นายสมชาย ใจดี" />
          </el-form-item>
          <el-form-item label="ตำแหน่ง ผู้อำนวยการ">
            <el-input v-model="form.principal_position" placeholder="ผู้อำนวยการโรงเรียน" />
          </el-form-item>
          <el-form-item label="ชื่อ-นามสกุล ผู้ลงนามตาราง">
            <el-input v-model="form.signer_name" placeholder="อาจต่างจากผู้อำนวยการ" />
          </el-form-item>
          <el-form-item label="ตำแหน่ง ผู้ลงนาม">
            <el-input v-model="form.signer_position" placeholder="เช่น รองผู้อำนวยการฝ่ายวิชาการ" />
          </el-form-item>
        </div>
      </el-card>

      <!-- Section 3: ปีการศึกษา -->
      <el-card class="section-card sec-academic mb-4">
        <template #header>
          <span class="section-title">📅 ปีการศึกษา</span>
        </template>
        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="ปีการศึกษา">
            <el-input-number v-model="form.year" :min="2560" :max="2580" :step="1" class="w-full" />
          </el-form-item>
          <el-form-item label="ภาคเรียนที่">
            <el-radio-group v-model="form.semester">
              <el-radio :label="1">ภาคเรียนที่ 1</el-radio>
              <el-radio :label="2">ภาคเรียนที่ 2</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="วันเปิดภาคเรียน">
            <el-date-picker
              v-model="form.term_start"
              type="date"
              placeholder="เลือกวันที่"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              class="w-full"
            />
          </el-form-item>
          <el-form-item label="วันสิ้นสุดภาคเรียน">
            <el-date-picker
              v-model="form.term_end"
              type="date"
              placeholder="เลือกวันที่"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              class="w-full"
            />
          </el-form-item>
        </div>
      </el-card>

      <!-- Section 4: ตั้งค่าตารางสอน -->
      <el-card class="section-card sec-schedule mb-4">
        <template #header>
          <span class="section-title">📋 ตั้งค่าตารางสอน</span>
        </template>
        <div class="mb-4">
          <div class="form-label mb-2">วันเรียน</div>
          <el-checkbox-group v-model="form.school_days">
            <el-checkbox v-for="d in DAY_OPTIONS" :key="d" :label="d">{{ d }}</el-checkbox>
          </el-checkbox-group>
        </div>
        <div class="flex items-center gap-4">
          <div class="form-label">จำนวนคาบต่อวัน</div>
          <el-input-number
            v-model="form.periods_per_day"
            :min="1"
            :max="12"
            @change="onPeriodsChange"
          />
          <span class="text-gray-500 text-sm">คาบ</span>
        </div>
      </el-card>

      <!-- Section 5: เวลาแต่ละคาบ -->
      <el-card class="section-card sec-period mb-6">
        <template #header>
          <span class="section-title">🕐 เวลาแต่ละคาบ</span>
        </template>
        <el-table :data="periodTimesDisplay" border stripe size="small" :header-cell-style="{ background: '#0891b2', color: 'white', fontWeight: '600' }">
          <el-table-column label="คาบที่" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.period === 0" class="text-red-600 font-bold">เลิกเรียน</span>
              <span v-else class="font-semibold">{{ row.period }}</span>
            </template>
          </el-table-column>
          <el-table-column label="เวลาเริ่ม" width="160">
            <template #default="{ row }">
              <el-time-picker
                v-if="row.period !== 0"
                v-model="row.startObj"
                format="HH:mm"
                value-format="HH:mm"
                :disabled="false"
                placeholder="HH:mm"
                size="small"
                class="w-full"
                @change="val => updatePeriodTime(row, 'start', val)"
              />
              <el-time-picker
                v-else
                v-model="row.startObj"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="HH:mm"
                size="small"
                class="w-full"
                @change="val => updatePeriodTime(row, 'start', val)"
              />
            </template>
          </el-table-column>
          <el-table-column label="เวลาสิ้นสุด" width="160">
            <template #default="{ row }">
              <el-time-picker
                v-if="row.period !== 0"
                v-model="row.endObj"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="HH:mm"
                size="small"
                class="w-full"
                @change="val => updatePeriodTime(row, 'end', val)"
              />
              <span v-else class="text-gray-400 text-sm">-</span>
            </template>
          </el-table-column>
          <el-table-column label="หมายเหตุ">
            <template #default="{ row }">
              <el-input
                v-if="row.period !== 0"
                v-model="row.note"
                placeholder="เช่น พักกลางวัน"
                size="small"
                @change="val => updatePeriodNote(row, val)"
              />
              <span v-else class="text-gray-400 text-sm">เลิกเรียน</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Save Button -->
      <!-- Section: AI Mode -->
      <el-card class="section-card sec-ai mb-4">
        <template #header>
          <span class="section-title">🤖 AI ช่วยจัดตารางสอน (ไม่บังคับ)</span>
        </template>
        <el-alert type="info" :closable="false" class="mb-4" style="font-size:12px">
          ใส่ Anthropic API Key เพื่อเปิดใช้งาน AI Mode — ช่วยจัดวิชาที่ยังลงไม่ได้ให้ลงได้ครบ<br>
          ถ้าไม่มี Key ระบบจะใช้ Retry Algorithm แทน (ไม่มีผลต่อการทำงานปกติ)
        </el-alert>
        <el-form-item label="Anthropic API Key">
          <el-input
            v-model="form.anthropic_api_key"
            placeholder="sk-ant-..."
            show-password
            style="max-width:480px"
          >
            <template #prefix>🔑</template>
          </el-input>
        </el-form-item>
        <div class="text-xs text-gray-400 mt-1">
          Key นี้จะถูกเก็บใน Firestore ของโรงเรียนท่านเท่านั้น ไม่ได้ส่งไปที่ใด
          <a href="https://console.anthropic.com" target="_blank" class="text-blue-500 ml-1">ขอ API Key ได้ที่นี่ →</a>
        </div>
      </el-card>

      <!-- Section: ควบคุมระบบจัดตารางสอน -->
      <el-card class="section-card sec-lock mb-4">
        <template #header>
          <span class="section-title">🔒 ควบคุมระบบจัดตารางสอน</span>
        </template>
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="font-semibold text-gray-700">สถานะระบบจัดตารางสอน</div>
            <div class="text-sm text-gray-500 mt-1">
              <span v-if="timetableLocked">🔒 <b class="text-red-500">ล็อคแล้ว</b> — ทุกคนดูและพิมพ์ได้ แต่เพิ่ม/ลบ/แก้ไขไม่ได้</span>
              <span v-else>✏️ <b class="text-green-600">เปิดแก้ไขได้</b> — ผู้มีสิทธิ์จัดตารางสอนแก้ไขข้อมูลได้</span>
            </div>
          </div>
          <el-switch
            v-model="timetableLocked"
            :active-text="timetableLocked ? '🔒 ล็อคแล้ว' : ''"
            :inactive-text="!timetableLocked ? '✏️ แก้ไขได้' : ''"
            active-color="#ef4444"
            inactive-color="#10b981"
            :loading="lockSaving"
            :disabled="schoolStore.isViewOnlyMode"
            style="--el-switch-on-color:#ef4444;--el-switch-off-color:#10b981"
            @change="saveLockState"
          />
        </div>
        <div v-if="timetableLocked" class="mt-3 p-3 rounded-lg text-sm"
          style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c">
          ⚠️ ระบบล็อคอยู่ — ครูและนักวิชาการไม่สามารถเพิ่ม ลบ หรือแก้ไขตารางสอนได้ กด toggle เพื่อเปิดใหม่
        </div>
      </el-card>

      <el-card class="section-card sec-publish mb-4">
        <template #header>
          <span class="section-title">🚀 เผยแพร่ตารางสอนสาธารณะ</span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
          <div class="p-3 rounded-lg" style="background:#ecfeff;border:1px solid #a5f3fc">
            <div class="text-gray-500">สถานะ</div>
            <div class="font-semibold text-sky-700">{{ publishMeta.status || 'ยังไม่เผยแพร่' }}</div>
          </div>
          <div class="p-3 rounded-lg" style="background:#f0fdf4;border:1px solid #bbf7d0">
            <div class="text-gray-500">เวอร์ชันล่าสุด</div>
            <div class="font-semibold text-green-700">{{ publishMeta.version || '-' }}</div>
          </div>
          <div class="p-3 rounded-lg" style="background:#fff7ed;border:1px solid #fed7aa">
            <div class="text-gray-500">เผยแพร่เมื่อ</div>
            <div class="font-semibold text-orange-700">{{ publishMeta.published_at_iso ? formatThaiDateTime(publishMeta.published_at_iso) : '-' }}</div>
          </div>
        </div>
        <div class="text-xs text-gray-500 mb-3">
          เมื่อกดเผยแพร่ ระบบจะสร้างไฟล์ JSON สำหรับหน้า public โดยผู้ใช้ทั่วไปจะเห็นเฉพาะข้อมูลที่เผยแพร่ล่าสุดเท่านั้น
        </div>
        <div class="flex items-center gap-3">
          <el-button
            type="warning"
            :loading="publishing"
            @click="publishTimetableSnapshot"
            :disabled="publishing || schoolStore.isViewOnlyMode"
          >
            🚀 เผยแพร่ตารางล่าสุด
          </el-button>
          <span v-if="publishMeta.current_path" class="text-xs text-gray-500">{{ publishMeta.current_path }}</span>
        </div>
      </el-card>

      <div class="flex justify-end">
        <el-button
          type="primary"
          size="large"
          :loading="saving"
          @click="saveSettings"
          :disabled="schoolStore.isViewOnlyMode"
          style="min-width:160px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;font-size:15px"
        >
          💾 บันทึกการตั้งค่า
        </el-button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { doc, getDoc, setDoc, serverTimestamp, collection, query, getDocs, orderBy } from '@/supabase/firestore'
import { ref as storageRef, uploadString } from '@/supabase/storage'
import { getSchoolDb, storage } from '@/supabase/db'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import * as XLSX from 'xlsx'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const publishMeta = reactive({
  status: '',
  version: '',
  current_path: '',
  versioned_path: '',
  published_at_iso: '',
})
const importFileRef = ref(null)
const logoFileRef = ref(null)
const logoUploading = ref(false)

const currentPlanFeeLabel = computed(() => {
  const fee = Number(schoolStore.pricingPlan?.monthly_fee || 0)
  return fee > 0 ? `${fee} บาท` : 'ยังไม่กำหนด'
})

const currentPlanLimitLabel = computed(() => {
  const limit = Number(schoolStore.schedulerLimit || 0)
  return limit > 0 ? `${limit} คน` : '-'
})

const currentPlanStatusLabel = computed(() => {
  const exp = schoolStore.subscriptionExpiry
  if (!exp) return 'ยังไม่กำหนดวันหมดอายุ'
  const dateLabel = exp.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  return schoolStore.isViewOnlyMode ? `หมดอายุแล้ว (${dateLabel})` : `ใช้งานได้ถึง ${dateLabel}`
})

const planStatusBoxStyle = computed(() => {
  if (schoolStore.isViewOnlyMode) {
    return { background: '#fef2f2', border: '1px solid #fecaca' }
  }
  return { background: '#fff7ed', border: '1px solid #fed7aa' }
})

async function markPlanNoticeRead() {
  const notice = schoolStore.planNotice
  if (!notice) return
  try {
    await setDoc(doc(db(), 'school_info', 'main'), {
      plan_notice: {
        title: notice.title || '',
        message: notice.message || '',
        unread: false,
        updated_at: serverTimestamp(),
      },
      updated_at: serverTimestamp(),
    }, { merge: true })
    schoolStore.setSchool({
      ...schoolStore.schoolInfo,
      plan_notice: {
        title: notice.title || '',
        message: notice.message || '',
        unread: false,
      },
    })
    ElMessage.success('รับทราบการแจ้งเตือนแล้ว')
  } catch (e) {
    ElMessage.error('ไม่สามารถอัปเดตสถานะการแจ้งเตือนได้: ' + e.message)
  }
}

// submitRenewalRequest moved to RenewalView.vue

// ===== ระบบล็อคตารางสอน =====
const timetableLocked = ref(false)
const lockSaving = ref(false)

function formatThaiDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

async function saveLockState(val) {
  if (schoolStore.isViewOnlyMode) {
    ElMessage.warning('แพ็กเกจหมดอายุ: ไม่สามารถแก้ไขการตั้งค่าได้')
    timetableLocked.value = !val
    return
  }
  lockSaving.value = true
  try {
    await setDoc(doc(db(), 'school_info', 'main'), {
      timetable_locked: val,
      timetable_locked_at: serverTimestamp(),
    }, { merge: true })
    schoolStore.setSchool({ ...schoolStore.schoolInfo, timetable_locked: val })
    ElMessage.success(val ? '🔒 ล็อคระบบจัดตารางสอนเรียบร้อย' : '✅ เปิดระบบจัดตารางสอนเรียบร้อย')
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
    timetableLocked.value = !val
  } finally {
    lockSaving.value = false
  }
}

const db = () => getSchoolDb()

async function publishTimetableSnapshot() {
  if (schoolStore.isViewOnlyMode) {
    ElMessage.warning('แพ็กเกจหมดอายุ: ไม่สามารถเผยแพร่ได้')
    return
  }
  publishing.value = true
  try {
    const currentTerm = `${form.year}_${form.semester}`
    if (!currentTerm) {
      ElMessage.warning('ไม่พบภาคเรียนปัจจุบัน')
      return
    }

    const schoolId = authStore.schoolId
    if (!schoolId) {
      ElMessage.error('ไม่พบ schoolId ของผู้ใช้')
      return
    }

    const [classesSnap, teachersSnap, gridSnap] = await Promise.all([
      getDocs(query(collection(db(), `terms/${currentTerm}/classes`), orderBy('class_id'))),
      getDocs(query(collection(db(), `terms/${currentTerm}/teachers`), orderBy('name'))),
      getDocs(collection(db(), `terms/${currentTerm}/timetable_grid`)),
    ])

    const classes = classesSnap.docs.map(d => d.data())
    const teachers = teachersSnap.docs.map(d => d.data())
    const timetable = gridSnap.docs.map(d => d.data())

    const now = new Date()
    const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
    const version = `v${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

    const payload = {
      school_id: schoolId,
      current_term: currentTerm,
      version,
      published_at_iso: now.toISOString(),
      classes,
      teachers,
      timetable,
    }
    const payloadJson = JSON.stringify(payload)

    const basePath = `public_timetables/${schoolId}`
    const currentPath = `${basePath}/current.json`
    const versionedPath = `${basePath}/versions/${stamp}.json`

    let storagePublished = true
    try {
      await Promise.all([
        uploadString(storageRef(storage, currentPath), payloadJson, 'raw', { contentType: 'application/json' }),
        uploadString(storageRef(storage, versionedPath), payloadJson, 'raw', { contentType: 'application/json' }),
      ])
    } catch (storageError) {
      storagePublished = false
      console.warn('Storage publish failed, fallback to Firestore snapshot only:', storageError)

      // Proceed with Firestore update regardless of Storage outcome
    }

    await setDoc(doc(db(), 'public_timetable_snapshots', 'current'), {
      ...payload,

        // Update school_info with publish metadata
      updated_at: serverTimestamp(),
    }, { merge: true })

    await setDoc(doc(db(), 'school_info', 'main'), {
      timetable_publish: {
        status: 'published',
        version,
        current_term: currentTerm,
        current_path: storagePublished ? currentPath : '',
        versioned_path: storagePublished ? versionedPath : '',
        channel: storagePublished ? 'storage+firestore' : 'firestore',
        class_count: classes.length,
        teacher_count: teachers.length,
        slot_count: timetable.length,
        published_at_iso: now.toISOString(),
        published_at: serverTimestamp(),
        published_by_uid: authStore.profile?.uid || null,
      },
      timetable_publish_version: version,
      timetable_publish_at_iso: now.toISOString(),
      timetable_publish_status: 'published',

        // Update UI state
      updated_at: serverTimestamp(),
    }, { merge: true })

    publishMeta.status = 'published'
    publishMeta.version = version
    publishMeta.current_path = storagePublished ? currentPath : 'firestore:public_timetable_snapshots/current'
    publishMeta.versioned_path = storagePublished ? versionedPath : ''
    publishMeta.published_at_iso = now.toISOString()


    const msg = storagePublished 
      ? `เผยแพร่ตารางสอนสำเร็จ (${version})`
      : `เผยแพร่ตารางสอนสำเร็จแต่ Storage ล้มเหลว (${version}) — ข้อมูลเก็บใน Firestore`
    ElMessage.success(msg)
  } catch (e) {
    console.error(e)
    ElMessage.error('เผยแพร่ไม่สำเร็จ: ' + e.message)
  } finally {
    publishing.value = false
  }
}

const PROVINCES = ['กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี']

const DAY_OPTIONS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

const DEFAULT_PERIOD_TIMES = [
  { period: 1, start: '08:30', end: '09:20', note: '' },
  { period: 2, start: '09:20', end: '10:10', note: '' },
  { period: 3, start: '10:10', end: '11:00', note: '' },
  { period: 4, start: '11:00', end: '11:50', note: '' },
  { period: 5, start: '12:40', end: '13:30', note: '' },
  { period: 6, start: '13:30', end: '14:20', note: '' },
  { period: 7, start: '14:20', end: '15:10', note: '' },
  { period: 8, start: '15:10', end: '16:00', note: '' },
]

const form = reactive({
  name: '',
  name_short: '',
  name_en: '',
  tambon: '',
  amphoe: '',
  changwat: '',
  postal_code: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  principal_name: '',
  principal_position: 'ผู้อำนวยการโรงเรียน',
  signer_name: '',
  signer_position: '',
  year: 2568,
  semester: 1,
  term_start: '',
  term_end: '',
  school_days: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'],
  periods_per_day: 8,
  period_times: JSON.parse(JSON.stringify(DEFAULT_PERIOD_TIMES)),
  logo_url: '',
  anthropic_api_key: '',
})

// period_times includes a row with period=0 (เลิกเรียน) at bottom
// internal: form.period_times = array of { period, start, end, note }
// period 0 = เลิกเรียน row

function ensureEndRow() {
  const hasEnd = form.period_times.find(t => t.period === 0)
  if (!hasEnd) {
    form.period_times.push({ period: 0, start: '16:00', end: '', note: 'เลิกเรียน' })
  }
}

// Reactive display array for the table (periods 1..N + เลิกเรียน row)
const periodTimesDisplay = computed(() => {
  const n = form.periods_per_day
  const regularRows = []
  for (let i = 1; i <= n; i++) {
    const existing = form.period_times.find(t => t.period === i)
    regularRows.push({
      period: i,
      startObj: existing?.start || '',
      endObj: existing?.end || '',
      note: existing?.note || '',
      _ref: existing
    })
  }
  const endRow = form.period_times.find(t => t.period === 0)
  regularRows.push({
    period: 0,
    startObj: endRow?.start || '16:00',
    endObj: '',
    note: 'เลิกเรียน',
    _ref: endRow
  })
  return regularRows
})

function updatePeriodTime(row, field, val) {
  let entry = form.period_times.find(t => t.period === row.period)
  if (!entry) {
    entry = { period: row.period, start: '', end: '', note: '' }
    form.period_times.push(entry)
  }
  if (field === 'start') entry.start = val || ''
  if (field === 'end') entry.end = val || ''
  row._ref = entry
}

function updatePeriodNote(row, val) {
  let entry = form.period_times.find(t => t.period === row.period)
  if (entry) entry.note = val
}

function onPeriodsChange(n) {
  // Ensure we have entries for all periods 1..n
  for (let i = 1; i <= n; i++) {
    if (!form.period_times.find(t => t.period === i)) {
      const def = DEFAULT_PERIOD_TIMES.find(d => d.period === i)
      form.period_times.push(def ? { ...def } : { period: i, start: '', end: '', note: '' })
    }
  }
  // Remove entries beyond n (keep period 0)
  form.period_times = form.period_times.filter(t => t.period === 0 || t.period <= n)
  ensureEndRow()
}

// ===== Logo Upload (Base64 via canvas compress — no Firebase Storage needed) =====
function triggerLogoUpload() {
  logoFileRef.value?.click()
}

function compressToBase64(file, maxW = 240, maxH = 240, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

async function onLogoFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)')
    e.target.value = ''
    return
  }
  logoUploading.value = true
  try {
    // Compress to max 240×240 JPEG ~20-40KB → safe for Firestore 1MB limit
    const base64 = await compressToBase64(file)
    form.logo_url = base64
    await setDoc(doc(getSchoolDb(), 'school_info', 'main'), { logo_url: base64, updated_at: serverTimestamp() }, { merge: true })
    schoolStore.setSchool({ ...schoolStore.schoolInfo, logo_url: base64 })
    ElMessage.success('อัปโหลดโลโก้สำเร็จ')
  } catch (err) {
    ElMessage.error('อัปโหลดไม่สำเร็จ: ' + err.message)
  } finally {
    logoUploading.value = false
    e.target.value = ''
  }
}

async function removeLogo() {
  form.logo_url = ''
  try {
    await setDoc(doc(getSchoolDb(), 'school_info', 'main'), { logo_url: '', updated_at: serverTimestamp() }, { merge: true })
    schoolStore.setSchool({ ...schoolStore.schoolInfo, logo_url: '' })
    ElMessage.success('ลบโลโก้แล้ว')
  } catch (err) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + err.message)
  }
}

function buildSaveData() {
  const current_term = `${form.year}_${form.semester}`
  // Build period_times array sorted
  const pts = form.period_times.slice().sort((a, b) => {
    if (a.period === 0) return 1
    if (b.period === 0) return -1
    return a.period - b.period
  })
  return {
    name: form.name,
    name_short: form.name_short,
    name_en: form.name_en,
    tambon: form.tambon,
    amphoe: form.amphoe,
    changwat: form.changwat,
    postal_code: form.postal_code,
    phone: form.phone,
    fax: form.fax,
    email: form.email,
    website: form.website,
    principal_name: form.principal_name,
    principal_position: form.principal_position,
    signer_name: form.signer_name,
    signer_position: form.signer_position,
    year: form.year,
    semester: form.semester,
    current_term,
    term_start: form.term_start,
    term_end: form.term_end,
    school_days: form.school_days,
    periods_per_day: form.periods_per_day,
    period_times: pts,
    logo_url: form.logo_url || '',
    anthropic_api_key: form.anthropic_api_key || '',
    updated_at: serverTimestamp()
  }
}

async function saveSettings() {
  if (schoolStore.isViewOnlyMode) {
    ElMessage.warning('แพ็กเกจหมดอายุ: ไม่สามารถบันทึกการตั้งค่าได้')
    return
  }
  if (!form.name) {
    ElMessage.warning('กรุณากรอกชื่อโรงเรียน')
    return
  }
  saving.value = true
  try {
    const data = buildSaveData()
    await setDoc(doc(db(), 'school_info', 'main'), data, { merge: true })
    schoolStore.setSchool({ ...data, updated_at: new Date() })
    schoolStore.setCurrentTerm(data.current_term)
    ElMessage.success('บันทึกการตั้งค่าเรียบร้อยแล้ว')
  } catch (e) {
    console.error(e)
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function loadSettings() {
  loading.value = true
  try {
    const snap = await getDoc(doc(db(), 'school_info', 'main'))
    if (snap.exists()) {
      const data = snap.data()
      Object.keys(form).forEach(key => {
        if (data[key] !== undefined) {
          if (key === 'period_times') {
            form.period_times = Array.isArray(data.period_times) ? data.period_times : JSON.parse(JSON.stringify(DEFAULT_PERIOD_TIMES))
          } else {
            form[key] = data[key]
          }
        }
      })
      ensureEndRow()
      timetableLocked.value = data.timetable_locked === true
      const p = data.timetable_publish || {}
      publishMeta.status = p.status || data.timetable_publish_status || ''
      publishMeta.version = p.version || data.timetable_publish_version || ''
      publishMeta.current_path = p.current_path || ''
      publishMeta.versioned_path = p.versioned_path || ''
      publishMeta.published_at_iso = p.published_at_iso || data.timetable_publish_at_iso || ''
    } else {
      form.period_times = JSON.parse(JSON.stringify(DEFAULT_PERIOD_TIMES))
      ensureEndRow()
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}

// Export
function handleExport() {
  const data = buildSaveData()
  // Build flat rows for Excel
  const rows = [
    ['ชื่อโรงเรียน', data.name],
    ['ชื่อย่อ', data.name_short],
    ['ชื่อภาษาอังกฤษ', data.name_en],
    ['ตำบล/แขวง', data.tambon],
    ['อำเภอ/เขต', data.amphoe],
    ['จังหวัด', data.changwat],
    ['รหัสไปรษณีย์', data.postal_code],
    ['โทรศัพท์', data.phone],
    ['โทรสาร', data.fax],
    ['อีเมล', data.email],
    ['เว็บไซต์', data.website],
    ['ผู้อำนวยการ', data.principal_name],
    ['ตำแหน่งผู้อำนวยการ', data.principal_position],
    ['ผู้ลงนามตาราง', data.signer_name],
    ['ตำแหน่งผู้ลงนาม', data.signer_position],
    ['ปีการศึกษา', data.year],
    ['ภาคเรียน', data.semester],
    ['ภาคเรียนปัจจุบัน', data.current_term],
    ['วันเปิดภาคเรียน', data.term_start],
    ['วันสิ้นสุดภาคเรียน', data.term_end],
    ['วันเรียน', (data.school_days || []).join(', ')],
    ['จำนวนคาบต่อวัน', data.periods_per_day],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet([['รายการ', 'ค่า'], ...rows])
  ws1['!cols'] = [{ wch: 25 }, { wch: 40 }]

  const ptRows = (data.period_times || []).map(t => ([
    t.period === 0 ? 'เลิกเรียน' : `คาบที่ ${t.period}`,
    t.start, t.end, t.note
  ]))
  const ws2 = XLSX.utils.aoa_to_sheet([['คาบ', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'หมายเหตุ'], ...ptRows])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'ข้อมูลโรงเรียน')
  XLSX.utils.book_append_sheet(wb, ws2, 'เวลาคาบ')
  XLSX.writeFile(wb, `school_settings_${data.current_term || 'export'}.xlsx`)
  ElMessage.success('ส่งออกข้อมูลสำเร็จ')
}

// Import
function handleImport() {
  importFileRef.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    if (file.name.endsWith('.json')) {
      const text = await file.text()
      const data = JSON.parse(text)
      applyImportData(data)
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const data = {}
      rows.slice(1).forEach(r => {
        const keyMap = {
          'ชื่อโรงเรียน': 'name', 'ชื่อย่อ': 'name_short', 'ชื่อภาษาอังกฤษ': 'name_en',
          'ตำบล/แขวง': 'tambon', 'อำเภอ/เขต': 'amphoe', 'จังหวัด': 'changwat',
          'รหัสไปรษณีย์': 'postal_code', 'โทรศัพท์': 'phone', 'โทรสาร': 'fax',
          'อีเมล': 'email', 'เว็บไซต์': 'website',
          'ผู้อำนวยการ': 'principal_name', 'ตำแหน่งผู้อำนวยการ': 'principal_position',
          'ผู้ลงนามตาราง': 'signer_name', 'ตำแหน่งผู้ลงนาม': 'signer_position',
          'ปีการศึกษา': 'year', 'ภาคเรียน': 'semester',
          'วันเปิดภาคเรียน': 'term_start', 'วันสิ้นสุดภาคเรียน': 'term_end',
          'จำนวนคาบต่อวัน': 'periods_per_day'
        }
        if (keyMap[r[0]]) data[keyMap[r[0]]] = r[1]
      })
      applyImportData(data)
    }
    ElMessage.success('นำเข้าข้อมูลสำเร็จ')
  } catch (err) {
    ElMessage.error('นำเข้าไม่สำเร็จ: ' + err.message)
  }
  e.target.value = ''
}

function applyImportData(data) {
  Object.keys(form).forEach(key => {
    if (data[key] !== undefined) {
      if (key === 'period_times') {
        form.period_times = Array.isArray(data.period_times) ? data.period_times : form.period_times
      } else {
        form[key] = data[key]
      }
    }
  })
  ensureEndRow()
}

onMounted(async () => {
  await loadSettings()
})
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(124,58,237,0.18);
}

.renewal-card {
  border: 1px solid #c7d2fe;
  background: linear-gradient(180deg, #f8fafc, #eef2ff);
}

.renewal-history-card {
  border: 1px solid #cbd5e1;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.latest-renewal-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
}

.latest-renewal-meta {
  display: grid;
  gap: 10px;
}

.latest-renewal-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}

.latest-renewal-row .label,
.proof-label {
  color: #64748b;
  font-weight: 600;
}

.latest-renewal-note {
  align-items: flex-start;
}

.latest-renewal-proof {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 960px) {
  .latest-renewal-grid {
    grid-template-columns: 1fr;
  }
}

.renewal-proof-box {
  width: 100%;
}

.renewal-proof-preview {
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #fff;
  padding: 10px;
  max-width: 360px;
}

.renewal-proof-image {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  border-radius: 10px;
}

.section-card {
  border-radius: 16px;
  border: 1px solid #dbeafe;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}

.form-label {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  color: #334155;
  font-weight: 600;
}

:deep(.el-card__header) {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.22);
}

:deep(.el-card__body) {
  padding: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-textarea__inner),
:deep(.el-input-number .el-input__wrapper),
:deep(.el-date-editor.el-input__wrapper),
:deep(.el-date-editor .el-input__wrapper),
:deep(.el-time-editor.el-input__wrapper),
:deep(.el-time-editor .el-input__wrapper) {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  box-shadow: none !important;
  border-radius: 10px;
  transition: all 0.2s ease;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-select__wrapper.is-focused),
:deep(.el-textarea__inner:focus),
:deep(.el-input-number .el-input__wrapper.is-focus),
:deep(.el-date-editor.is-focus .el-input__wrapper),
:deep(.el-time-editor.is-focus .el-input__wrapper) {
  border-color: #22c55e;
  background: #ecfdf5;
}

:deep(.el-input__wrapper:hover),
:deep(.el-select__wrapper:hover),
:deep(.el-textarea__inner:hover) {
  border-color: #38bdf8;
}

.sec-logo {
  border-color: #fde68a;
}

.sec-school {
  border-color: #d8b4fe;
}

.sec-admin {
  border-color: #93c5fd;
}

.sec-academic {
  border-color: #86efac;
}

.sec-schedule {
  border-color: #fdba74;
}

.sec-period {
  border-color: #fca5a5;
}

.sec-ai {
  border-color: #67e8f9;
}

.sec-lock {
  border-color: #fca5a5;
}

.sec-publish {
  border-color: #a5f3fc;
}

.sec-teachlog {
  border-color: #6ee7b7;
}

.sec-logo :deep(.el-card__header) {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.sec-school :deep(.el-card__header) {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.sec-admin :deep(.el-card__header) {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.sec-academic :deep(.el-card__header) {
  background: linear-gradient(135deg, #10b981, #059669);
}

.sec-schedule :deep(.el-card__header) {
  background: linear-gradient(135deg, #f59e0b, #ea580c);
}

.sec-period :deep(.el-card__header) {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.sec-ai :deep(.el-card__header) {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
}

.sec-lock :deep(.el-card__header) {
  background: linear-gradient(135deg, #f43f5e, #e11d48);
}

.sec-teachlog :deep(.el-card__header) {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.logo-preview img {
  border-radius: 12px;
}

@media (max-width: 768px) {
  .school-settings-surface {
    padding: 12px !important;
  }

  :deep(.el-card__body) {
    padding: 14px;
  }
}
</style>
