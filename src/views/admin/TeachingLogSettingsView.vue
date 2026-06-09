<template>
  <AppLayout>
    <div class="p-6 tl-settings-surface" v-loading="loading">
      <div class="header-card mb-6">
        <h1 class="text-2xl font-bold text-white">🧾 ตั้งค่าบันทึกเข้าสอน</h1>
        <p class="text-white/80 text-sm mt-1">Google Drive, ควบคุมการบันทึก และวันหยุด</p>
      </div>

      <el-card class="section-card section-card-drive mb-4">
        <template #header>
          <span class="section-title">🔗 ตั้งค่า Google Drive</span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <el-form-item label="Google OAuth Client ID">
            <el-input
              v-model="form.gdrive_client_id"
              placeholder="เช่น 1234567890-xxxx.apps.googleusercontent.com"
              clearable
            />
          </el-form-item>
          <el-form-item label="Google Drive Folder ID">
            <el-input
              v-model="form.gdrive_folder_id"
              placeholder="เช่น 1AbCdEfGhIjKlMnOpQrStUv"
              clearable
            />
          </el-form-item>
          <el-form-item label="GAS Web App URL" class="md:col-span-2">
            <el-input
              v-model="form.gas_web_app_url"
              placeholder="เช่น https://script.google.com/macros/s/xxxx/exec"
              clearable
            />
          </el-form-item>
          <el-form-item label="GAS Upload Web App URL (แยกสำหรับอัพรูปนักเรียน)" class="md:col-span-2">
            <el-input
              v-model="form.gas_upload_web_app_url"
              placeholder="เช่น https://script.google.com/macros/s/xxxx/exec"
              clearable
            />
          </el-form-item>
        </div>
        <div class="text-xs text-gray-500 mt-1">
          แนะนำ: ถ้าต้องการแยกบัญชี ให้ใส่ URL อัพรูปในช่อง GAS Upload Web App URL
          <br>
          ถ้าไม่ใส่ ระบบจะ fallback ไปใช้ GAS Web App URL ช่องหลัก
        </div>
      </el-card>

      <el-card class="section-card section-card-controls mb-4">
        <template #header>
          <span class="section-title">📝 ควบคุมการบันทึกการสอน</span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div>
            <div class="font-semibold text-gray-700 mb-1">อนุญาตบันทึกย้อนหลัง</div>
            <el-switch
              v-model="form.backdating_enabled"
              active-text="เปิด"
              inactive-text="ปิด"
              active-color="#10b981"
              inactive-color="#94a3b8"
            />
            <div class="text-xs text-gray-400 mt-2">
              ถ้าปิด ครูบันทึกได้เฉพาะวันปัจจุบัน
              <br>
              ถ้าเปิด ครูย้อนหลังได้ตามจำนวนวันที่กำหนด
            </div>
          </div>

          <div v-if="form.backdating_enabled">
            <div class="font-semibold text-gray-700 mb-1">จำนวนวันที่ย้อนหลังได้</div>
            <el-input-number
              v-model="form.backdating_days"
              :min="1"
              :max="30"
              :step="1"
              style="width:140px"
            />
            <div class="text-xs text-gray-400 mt-2">วัน (แนะนำ 3-7 วัน)</div>
          </div>
        </div>

        <div class="mt-4 pt-4" style="border-top:1px solid #e2e8f0">
          <div class="font-semibold text-gray-700 mb-2">สร้างบันทึกล่วงหน้าจากตารางสอน</div>
          <div class="text-sm text-gray-500 mb-3">
            เลือกสัปดาห์เพื่อสร้างรายการบันทึก teach_actual อัตโนมัติสำหรับทุกครู
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <el-date-picker
              v-model="generateWeekDate"
              type="week"
              format="[สัปดาห์ที่] ww · YYYY"
              value-format="YYYY-MM-DD"
              placeholder="เลือกสัปดาห์"
              style="width:260px"
            />
            <el-button
              type="success"
              :loading="generatingRecords"
              @click="generateWeekRecords"
              :disabled="!generateWeekDate || schoolStore.isViewOnlyMode"
            >
              ⚡ สร้างบันทึกล่วงหน้า
            </el-button>
          </div>
          <div v-if="generateResult" class="mt-2 text-sm text-green-600 font-medium">
            {{ generateResult }}
          </div>
        </div>
      </el-card>

      <!-- ── คาบพิเศษสำหรับครูที่ปรึกษา ── -->
      <el-card class="section-card section-card-homeroom mb-4">
        <template #header>
          <span class="section-title">🏫 คาบพิเศษรายวันสำหรับครูที่ปรึกษา</span>
        </template>

        <div class="text-sm text-gray-500 mb-3">
          กำหนดคาบพิเศษที่ให้ครูที่ปรึกษาของทุกห้องต้องบันทึก เช่น กิจกรรมหน้าเสาธง หรือ คาบโฮมรูม
          ระบบจะสร้างรายการบันทึกให้ครูที่ปรึกษาของแต่ละห้องโดยอัตโนมัติเมื่อสร้างคาบล่วงหน้า
        </div>

        <!-- Add row form -->
        <div class="flex flex-wrap gap-3 items-end mb-3">
          <el-form-item label="คาบที่" style="margin-bottom:0">
            <el-input-number
              v-model="newHomeroomPeriod.period"
              :min="0" :max="20" :step="1"
              style="width:100px"
              placeholder="0"
            />
          </el-form-item>
          <el-form-item label="ชื่อกิจกรรม" style="margin-bottom:0">
            <el-input
              v-model="newHomeroomPeriod.name"
              placeholder="เช่น กิจกรรมหน้าเสาธง"
              style="width:220px"
              clearable
            />
          </el-form-item>
          <el-form-item label="วันที่ใช้" style="margin-bottom:0">
            <el-select
              v-model="newHomeroomPeriod.days"
              multiple
              collapse-tags
              placeholder="ทุกวัน (ไม่เลือก = ทุกวัน)"
              style="width:220px"
            >
              <el-option value="all" label="ทุกวัน" />
              <el-option v-for="d in THAI_DAY_OPTIONS" :key="d" :value="d" :label="d" />
            </el-select>
          </el-form-item>
          <el-button
            type="primary"
            plain
            :disabled="!newHomeroomPeriod.name.trim()"
            @click="addHomeroomPeriod"
          >
            ➕ เพิ่ม
          </el-button>
        </div>

        <el-table
          :data="form.homeroom_special_periods"
          size="small"
          border
          empty-text="ยังไม่มีคาบพิเศษที่กำหนด"
        >
          <el-table-column label="คาบที่" width="80" align="center" prop="period" sortable />
          <el-table-column label="ชื่อกิจกรรม" min-width="200">
            <template #default="{ $index }">
              <el-input
                v-model="form.homeroom_special_periods[$index].name"
                size="small"
                placeholder="ชื่อกิจกรรม"
              />
            </template>
          </el-table-column>
          <el-table-column label="วันที่ใช้" min-width="200">
            <template #default="{ row }">
              <span v-if="!row.days || !row.days.length || row.days.includes('all')" class="text-gray-500 text-sm">
                ทุกวัน
              </span>
              <div v-else class="flex flex-wrap gap-1">
                <el-tag
                  v-for="d in row.days.filter(x => x !== 'all')"
                  :key="d"
                  size="small"
                  type="info"
                >{{ d }}</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="จัดการ" width="100" align="center">
            <template #default="{ $index }">
              <el-button type="danger" text size="small" @click="form.homeroom_special_periods.splice($index, 1)">
                ลบ
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="text-xs text-gray-400 mt-2">
          💡 คาบที่ 0 = ก่อนคาบแรก (เช้า) · ID ของรายการจะใช้รูปแบบ <code>date_class_hrN</code> เพื่อไม่ชนกับคาบสอนปกติ
        </div>
      </el-card>

      <!-- ── ระบบคะแนนความประพฤติ ── -->
      <el-card class="section-card section-card-behavior mb-4">
        <template #header>
          <span class="section-title">⭐ ตั้งค่าระบบคะแนนความประพฤติ</span>
        </template>
        <div class="flex items-center gap-3 mb-2">
          <el-switch
            v-model="form.behavior_system_enabled"
            active-text="เปิดใช้งานระบบความประพฤติ"
            inactive-text="ปิด"
            active-color="#10b981"
            inactive-color="#94a3b8"
          />
        </div>
        <div class="text-sm text-gray-500">
          หากปิด: จะซ่อนรายงานความประพฤติ ซ่อนการกรอกคะแนนรวมในหน้าจัดการนักเรียน (จะกรอกพฤติกรรมได้เฉพาะในหน้าบันทึกเข้าสอนรายคาบเท่านั้น)
        </div>
      </el-card>

      <!-- ── การแจ้งเตือนอัตโนมัติ ── -->
      <el-card class="section-card section-card-notify mb-4">
        <template #header>
          <span class="section-title">🔔 ตั้งค่าการแจ้งเตือนอัตโนมัติ</span>
        </template>
        <div class="text-sm text-gray-500 mb-4">
          ระบบจะส่งสรุปการมาเรียนประจำวันไปยังครูประจำชั้น ผ่านช่องทางที่เลือก (ต้องตั้งค่า GAS เพื่อส่ง LINE/Email/Telegram)
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="flex items-center gap-3">
            <el-switch
              v-model="form.notification_settings.enabled"
              active-text="เปิดแจ้งเตือน"
              inactive-text="ปิด"
              active-color="#10b981"
              inactive-color="#94a3b8"
            />
          </div>
          <div v-if="form.notification_settings.enabled">
            <div class="text-xs text-gray-500 mb-1 font-medium">⏰ เวลาส่งอัตโนมัติ (ต้องตั้งค่า GAS Trigger)</div>
            <el-time-picker
              v-model="form.notification_settings.daily_summary_time"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="เช่น 08:30"
              style="width:150px"
            />
            <div class="text-xs text-gray-400 mt-1">เวลาที่ GAS จะส่งรายงานอัตโนมัติ</div>
          </div>
        </div>

        <div v-if="form.notification_settings.enabled" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- LINE Notify -->
          <div class="notify-channel-card">
            <div class="flex items-center gap-2 mb-2">
              <el-switch v-model="form.notification_settings.channels.line_notify.enabled" active-color="#10b981" />
              <span class="font-semibold text-sm">LINE Notify</span>
            </div>
            <el-input
              v-model="form.notification_settings.channels.line_notify.token"
              placeholder="LINE Notify Token"
              size="small"
              :disabled="!form.notification_settings.channels.line_notify.enabled"
              show-password
            />
          </div>
          <!-- Email (GAS MailApp) -->
          <div class="notify-channel-card">
            <div class="flex items-center gap-2 mb-2">
              <el-switch v-model="form.notification_settings.channels.email.enabled" active-color="#10b981" />
              <span class="font-semibold text-sm">Email (GAS MailApp)</span>
            </div>
            <div class="text-xs text-gray-400">
              ส่งผ่าน MailApp ของ GAS ไปยัง email ครูประจำชั้น (ดึงจากข้อมูลครู)
            </div>
          </div>
          <!-- Telegram -->
          <div class="notify-channel-card">
            <div class="flex items-center gap-2 mb-2">
              <el-switch v-model="form.notification_settings.channels.telegram.enabled" active-color="#10b981" />
              <span class="font-semibold text-sm">Telegram Bot</span>
            </div>
            <el-input
              v-model="form.notification_settings.channels.telegram.bot_token"
              placeholder="Bot Token"
              size="small"
              class="mb-2"
              :disabled="!form.notification_settings.channels.telegram.enabled"
              show-password
            />
            <el-input
              v-model="form.notification_settings.channels.telegram.chat_id"
              placeholder="Chat ID (กลุ่มหรือช่อง)"
              size="small"
              :disabled="!form.notification_settings.channels.telegram.enabled"
            />
          </div>
        </div>
      </el-card>

      <el-card class="section-card section-card-holidays mb-4">
        <template #header>
          <span class="section-title">🗓 ตั้งค่าวันหยุด</span>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-3">
          <el-form-item label="เลือกวันหยุดจากปฏิทิน">
            <el-date-picker
              v-model="holidayPickerDates"
              type="dates"
              value-format="YYYY-MM-DD"
              format="DD/MM/YYYY"
              placeholder="เลือกหลายวัน"
              style="width:100%"
            />
          </el-form-item>

          <el-form-item label="ชื่อวันหยุด">
            <el-input
              v-model="holidayName"
              placeholder="เช่น วันเข้าพรรษา / วันกีฬาสี"
              clearable
            />
          </el-form-item>

          <div class="pb-1">
            <el-button type="primary" plain @click="addHolidayDates" :disabled="!holidayPickerDates.length">
              ➕ เพิ่มวันหยุด
            </el-button>
          </div>
        </div>

        <el-table :data="form.holidays" size="small" border empty-text="ยังไม่มีวันหยุดที่กำหนด">
          <el-table-column label="วันที่" min-width="140">
            <template #default="scope">{{ formatDateDisplay(scope.row.date) }}</template>
          </el-table-column>
          <el-table-column prop="name" label="ชื่อวันหยุด" min-width="200" />
          <el-table-column label="จัดการ" width="100" align="center">
            <template #default="scope">
              <el-button type="danger" text @click="removeHoliday(scope.$index)">ลบ</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <div class="flex justify-end">
        <el-button
          type="primary"
          size="large"
          :loading="saving"
          @click="saveSettings"
          :disabled="schoolStore.isViewOnlyMode"
          style="min-width:180px;background:linear-gradient(135deg,#ff7a00,#ff2f6d);border:none;font-size:15px;box-shadow:0 12px 24px rgba(255,47,109,0.28)"
        >
          💾 บันทึกการตั้งค่า
        </el-button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { doc, getDoc, setDoc, serverTimestamp } from '@/supabase/firestore'
import AppLayout from '@/components/layout/AppLayout.vue'
import { getSchoolDb } from '@/supabase/db'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'

const schoolStore = useSchoolStore()
const { getPublishedTimetableSlots, generateTeachActualsForDate } = useSchoolDb()

const loading = ref(false)
const saving = ref(false)
const generateWeekDate = ref('')
const generatingRecords = ref(false)
const generateResult = ref('')
const holidayPickerDates = ref([])
const holidayName = ref('')

const form = reactive({
  gdrive_client_id: '',
  gdrive_folder_id: '',
  gas_web_app_url: '',
  gas_upload_web_app_url: '',
  backdating_enabled: true,
  backdating_days: 3,
  behavior_system_enabled: true,
  holidays: [],
  homeroom_special_periods: [],
  notification_settings: {
    enabled: false,
    daily_summary_time: '08:30',
    channels: {
      line_notify: { enabled: false, token: '' },
      email:       { enabled: false },
      telegram:    { enabled: false, bot_token: '', chat_id: '' },
    },
  },
})

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_DAY_OPTIONS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']

const newHomeroomPeriod = reactive({ period: 0, name: '', days: [] })

const db = () => getSchoolDb()

function normalizeHolidays(raw) {
  if (!Array.isArray(raw)) return []
  const map = new Map()

  for (const item of raw) {
    if (typeof item === 'string') {
      if (item) map.set(item, { date: item, name: '' })
      continue
    }
    if (item && typeof item === 'object' && item.date) {
      map.set(item.date, {
        date: item.date,
        name: item.name || '',
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function formatDateDisplay(iso) {
  if (!iso) return '-'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function addHolidayDates() {
  if (!holidayPickerDates.value.length) return
  const existing = new Map(form.holidays.map(h => [h.date, h]))

  holidayPickerDates.value.forEach(date => {
    existing.set(date, {
      date,
      name: holidayName.value?.trim() || existing.get(date)?.name || '',
    })
  })

  form.holidays = Array.from(existing.values()).sort((a, b) => a.date.localeCompare(b.date))
  holidayPickerDates.value = []
  holidayName.value = ''
}

function removeHoliday(index) {
  form.holidays.splice(index, 1)
}

function addHomeroomPeriod() {
  if (!newHomeroomPeriod.name.trim()) return
  form.homeroom_special_periods.push({
    period: Number(newHomeroomPeriod.period),
    name: newHomeroomPeriod.name.trim(),
    days: [...newHomeroomPeriod.days],
  })
  form.homeroom_special_periods.sort((a, b) => a.period - b.period)
  newHomeroomPeriod.period = 0
  newHomeroomPeriod.name = ''
  newHomeroomPeriod.days = []
}

function normalizeHomeroomPeriods(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(p => p && typeof p === 'object' && p.name)
    .map(p => ({
      period: Number(p.period ?? 0),
      name: String(p.name || ''),
      days: Array.isArray(p.days) ? p.days : [],
    }))
    .sort((a, b) => a.period - b.period)
}

async function generateWeekRecords() {
  if (schoolStore.isViewOnlyMode) {
    ElMessage.warning('แพ็กเกจหมดอายุ: ใช้งานได้เฉพาะดูตารางและส่งคำขอต่ออายุ')
    return
  }
  if (!generateWeekDate.value) return

  generatingRecords.value = true
  generateResult.value = ''
  try {
    const startD = new Date(`${generateWeekDate.value}T00:00:00`)
    const day = startD.getDay()
    const monday = new Date(startD)
    if (day !== 1) monday.setDate(startD.getDate() + (day === 0 ? 1 : 1 - day))

    const schoolDays = schoolStore.schoolInfo?.school_days || ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']
    const holidays = normalizeHolidays(form.holidays)
    const holidaySet = new Set(holidays.map(h => h.date))
    const timetable = await getPublishedTimetableSlots()

    let total = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dayName = THAI_DAYS[d.getDay()]
      if (!schoolDays.includes(dayName)) continue

      const dateStr = d.toISOString().split('T')[0]
      if (holidaySet.has(dateStr)) continue

      const count = await generateTeachActualsForDate(dateStr, dayName, timetable)
      total += count
    }

    generateResult.value = `สร้างบันทึกล่วงหน้า ${total} คาบ เรียบร้อยแล้ว`
    ElMessage.success(generateResult.value)
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    generatingRecords.value = false
  }
}

async function loadSettings() {
  loading.value = true
  try {
    const snap = await getDoc(doc(db(), 'school_info', 'main'))
    if (snap.exists()) {
      const data = snap.data()
      form.gdrive_client_id = data.gdrive_client_id || ''
      form.gdrive_folder_id = data.gdrive_folder_id || ''
      form.gas_web_app_url = data.gas_web_app_url || ''
      form.gas_upload_web_app_url = data.gas_upload_web_app_url || ''
      form.backdating_enabled = data.backdating_enabled !== false
      form.backdating_days = Number(data.backdating_days || 3)
      form.behavior_system_enabled = data.behavior_system_enabled !== false
      form.holidays = normalizeHolidays(data.holidays)
      form.homeroom_special_periods = normalizeHomeroomPeriods(data.homeroom_special_periods)
      const ns = data.notification_settings || {}
      const ch = ns.channels || {}
      form.notification_settings.enabled = ns.enabled === true
      form.notification_settings.daily_summary_time = ns.daily_summary_time || '08:30'
      form.notification_settings.channels.line_notify.enabled = ch.line_notify?.enabled === true
      form.notification_settings.channels.line_notify.token = ch.line_notify?.token || ''
      form.notification_settings.channels.email.enabled = ch.email?.enabled === true
      form.notification_settings.channels.telegram.enabled = ch.telegram?.enabled === true
      form.notification_settings.channels.telegram.bot_token = ch.telegram?.bot_token || ''
      form.notification_settings.channels.telegram.chat_id = ch.telegram?.chat_id || ''
    }
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (schoolStore.isViewOnlyMode) {
    ElMessage.warning('แพ็กเกจหมดอายุ: ไม่สามารถบันทึกการตั้งค่าได้')
    return
  }

  saving.value = true
  try {
    const payload = {
      gdrive_client_id: form.gdrive_client_id?.trim() || '',
      gdrive_folder_id: form.gdrive_folder_id?.trim() || '',
      gas_web_app_url: form.gas_web_app_url?.trim() || '',
      gas_upload_web_app_url: form.gas_upload_web_app_url?.trim() || '',
      backdating_enabled: form.backdating_enabled !== false,
      backdating_days: Number(form.backdating_days || 3),
      behavior_system_enabled: form.behavior_system_enabled !== false,
      holidays: normalizeHolidays(form.holidays),
      homeroom_special_periods: normalizeHomeroomPeriods(form.homeroom_special_periods),
      notification_settings: {
        enabled: form.notification_settings.enabled,
        daily_summary_time: form.notification_settings.daily_summary_time || '08:30',
        channels: {
          line_notify: {
            enabled: form.notification_settings.channels.line_notify.enabled,
            token: form.notification_settings.channels.line_notify.token?.trim() || '',
          },
          email: {
            enabled: form.notification_settings.channels.email.enabled,
          },
          telegram: {
            enabled: form.notification_settings.channels.telegram.enabled,
            bot_token: form.notification_settings.channels.telegram.bot_token?.trim() || '',
            chat_id: form.notification_settings.channels.telegram.chat_id?.trim() || '',
          },
        },
      },
      updated_at: serverTimestamp(),
    }

    await setDoc(doc(db(), 'school_info', 'main'), payload, { merge: true })
    schoolStore.setSchool({
      ...(schoolStore.schoolInfo || {}),
      ...payload,
    })

    ElMessage.success('บันทึกการตั้งค่าเรียบร้อยแล้ว')
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.tl-settings-surface {
  min-height: calc(100vh - 88px);
  background: radial-gradient(circle at 0% 0%, #f0f9ff 0, #f8fafc 45%, #eef2ff 100%);
}

.header-card {
  border-radius: 16px;
  padding: 18px 20px;
  background: linear-gradient(120deg, #ff7a00 0%, #ff3d81 52%, #00d4ff 100%);
  box-shadow: 0 16px 30px rgba(255, 61, 129, 0.30);
}

.section-card {
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.section-card-drive {
  border-top: 4px solid #00b8ff;
}

.section-card-controls {
  border-top: 4px solid #ff7a00;
}

.section-card-homeroom {
  border-top: 4px solid #8b5cf6;
}

.section-card-behavior {
  border-top: 4px solid #eab308;
}

.section-card-notify {
  border-top: 4px solid #f59e0b;
}

.section-card-holidays {
  border-top: 4px solid #29d97f;
}

.notify-channel-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
}

.section-title {
  font-weight: 700;
  color: #1f2937;
}
</style>
