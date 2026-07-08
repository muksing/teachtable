<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">
      <div class="header-card mb-6">
        <h1 class="text-2xl font-bold text-white">📍 ตั้งค่าการเช็คอิน</h1>
        <p class="text-white/80 text-sm mt-1">พิกัดโรงเรียน รัศมีอนุญาต และคะแนนความประพฤติอัตโนมัติ</p>
      </div>

      <el-card class="section-card mb-4" style="border:2px solid #6366f1">
        <template #header>
          <span class="section-title">📍 ระบบเช็คอินนักเรียน</span>
        </template>
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="font-semibold text-gray-700">เปิดใช้ระบบเช็คอินรายวัน</div>
            <div class="text-xs text-gray-400">นักเรียนเช็คอินผ่านแอปเมื่อมาถึงโรงเรียน</div>
          </div>
          <el-switch v-model="checkinForm.enabled" active-color="#6366f1" />
        </div>

        <div v-if="checkinForm.enabled">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div class="text-sm font-medium text-gray-600 mb-1">📍 พิกัดโรงเรียน</div>
              <div class="flex gap-2 items-center mb-2">
                <el-button size="small" type="primary" plain :loading="gpsLoading" @click="useCurrentLocationForSchool">
                  🎯 ใช้ตำแหน่งปัจจุบัน
                </el-button>
                <span v-if="checkinForm.lat" class="text-xs text-green-600">✅ บันทึกแล้ว</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <div class="text-xs text-gray-400 mb-1">Latitude</div>
                  <el-input v-model.number="checkinForm.lat" placeholder="13.7563" size="small" />
                </div>
                <div>
                  <div class="text-xs text-gray-400 mb-1">Longitude</div>
                  <el-input v-model.number="checkinForm.lng" placeholder="100.5018" size="small" />
                </div>
              </div>
              <div v-if="checkinForm.lat && checkinForm.lng" class="mt-2">
                <a :href="`https://www.google.com/maps?q=${checkinForm.lat},${checkinForm.lng}`"
                   target="_blank" class="text-xs text-indigo-500 underline">ดูบน Google Maps →</a>
              </div>
              <div v-if="checkinForm.lat && checkinForm.lng" class="mt-3 text-xs text-gray-400">
                💡 ลากหมุดหรือคลิกบนแผนที่เพื่อเปลี่ยนตำแหน่ง
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-600 mb-1">⚙️ การตั้งค่า</div>
              <div class="mb-3">
                <div class="text-xs text-gray-400 mb-1">รัศมีอนุญาต (เมตร)</div>
                <el-input-number v-model="checkinForm.radius_meters" :min="50" :max="1000" :step="10" size="small" style="width:140px" />
                <span class="text-xs text-gray-400 ml-2">เมตร</span>
              </div>
              <div class="mb-3">
                <div class="text-xs text-gray-400 mb-1">เวลา cutoff (แจ้งเตือนถ้ายังไม่เช็คอิน)</div>
                <el-time-picker v-model="checkinForm.cutoff_time" format="HH:mm" value-format="HH:mm"
                  placeholder="08:00" size="small" style="width:140px" />
              </div>
              <div>
                <div class="text-xs text-gray-400 mb-1">Telegram Bot Token (สำหรับแจ้งผปค.)</div>
                <el-input v-model="checkinForm.telegram_bot_token" size="small" show-password
                  placeholder="110201543:AAHdqTcvChiUJRRBjwI5sYHVGJgnDz9CYjY" />
              </div>
            </div>
          </div>
          <!-- Leaflet Map -->
          <div v-if="checkinForm.lat && checkinForm.lng" ref="mapEl" class="ci-settings-map"></div>
        </div>
      </el-card>

      <!-- ─── Auto behavior points on check-in ─────────────── -->
      <el-card class="section-card mb-4" style="border:2px solid #f59e0b">
        <template #header>
          <span class="section-title">⭐ คะแนนความประพฤติอัตโนมัติเมื่อเช็คอิน</span>
        </template>
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="font-semibold text-gray-700">เพิ่มคะแนนความประพฤติอัตโนมัติเมื่อเช็คอินสำเร็จ</div>
            <div class="text-xs text-gray-400">บันทึกเป็นความประพฤติทั่วไป — เพิ่มให้ครั้งเดียวต่อวันต่อคน</div>
          </div>
          <el-switch v-model="checkinForm.auto_points_enabled" active-color="#f59e0b" />
        </div>
        <div v-if="checkinForm.auto_points_enabled">
          <div class="text-xs text-gray-400 mb-1">จำนวนคะแนนที่เพิ่มให้ต่อการเช็คอิน</div>
          <el-input-number v-model="checkinForm.auto_points_amount" :min="0" :max="100" :step="1" size="small" style="width:140px" />
          <span class="text-xs text-gray-400 ml-2">คะแนน</span>
          <div class="mt-2 text-xs text-gray-500">
            นักเรียนจะเห็นข้อความ "คุณได้รับคะแนนเพิ่ม {{ checkinForm.auto_points_amount || 0 }} คะแนน" หลังเช็คอินสำเร็จ
          </div>
        </div>
      </el-card>

      <div class="flex justify-end">
        <el-button type="primary" size="large" :loading="checkinSaving" @click="saveCheckinConfig"
          :disabled="schoolStore.isViewOnlyMode"
          style="min-width:160px;background:linear-gradient(135deg,#6366f1,#4f46e5);border:none;font-size:15px">
          💾 บันทึกการตั้งค่าเช็คอิน
        </el-button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const schoolId = ref(authStore.schoolId)

const loading = ref(false)
const checkinSaving = ref(false)
const gpsLoading = ref(false)

const checkinForm = reactive({
  enabled: false,
  lat: null,
  lng: null,
  radius_meters: 150,
  cutoff_time: '08:00',
  telegram_bot_token: '',
  auto_points_enabled: false,
  auto_points_amount: 1,
})

// ── Leaflet map ───────────────────────────────────────────────
const mapEl = ref(null)
let _map = null, _marker = null, _circle = null

function initMap() {
  if (!mapEl.value || !checkinForm.lat || !checkinForm.lng) return
  if (_map) { _map.remove(); _map = null }
  _map = L.map(mapEl.value, { center: [checkinForm.lat, checkinForm.lng], zoom: 17 })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(_map)
  const icon = L.divIcon({ html: '📍', className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
  _marker = L.marker([checkinForm.lat, checkinForm.lng], { icon, draggable: true }).addTo(_map)
  _circle = L.circle([checkinForm.lat, checkinForm.lng], {
    radius: checkinForm.radius_meters || 150,
    color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.15, weight: 2,
  }).addTo(_map)
  _marker.on('dragend', e => {
    const { lat, lng } = e.target.getLatLng()
    checkinForm.lat = parseFloat(lat.toFixed(6))
    checkinForm.lng = parseFloat(lng.toFixed(6))
    _circle.setLatLng([lat, lng])
  })
  _map.on('click', e => {
    const { lat, lng } = e.latlng
    checkinForm.lat = parseFloat(lat.toFixed(6))
    checkinForm.lng = parseFloat(lng.toFixed(6))
    _marker.setLatLng([lat, lng])
    _circle.setLatLng([lat, lng])
  })
}

watch([() => checkinForm.lat, () => checkinForm.lng], async ([lat, lng]) => {
  if (!lat || !lng) return
  if (!_map) { await nextTick(); initMap(); return }
  _marker?.setLatLng([lat, lng])
  _circle?.setLatLng([lat, lng])
  _map.setView([lat, lng])
})
watch(() => checkinForm.radius_meters, r => { _circle?.setRadius(r || 150) })
watch(() => checkinForm.enabled, async v => {
  if (v && checkinForm.lat && checkinForm.lng) { await nextTick(); initMap() }
})
onUnmounted(() => { _map?.remove(); _map = null })

async function useCurrentLocationForSchool() {
  if (!navigator.geolocation) { ElMessage.warning('เบราว์เซอร์นี้ไม่รองรับ GPS'); return }
  gpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      checkinForm.lat = parseFloat(pos.coords.latitude.toFixed(6))
      checkinForm.lng = parseFloat(pos.coords.longitude.toFixed(6))
      gpsLoading.value = false
      ElMessage.success(`บันทึกพิกัด ${checkinForm.lat}, ${checkinForm.lng}`)
    },
    err => { gpsLoading.value = false; ElMessage.error('ไม่สามารถดึง GPS: ' + err.message) },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

async function readSchoolSettings() {
  const sid = schoolId.value
  if (!sid) return {}
  const { data } = await supabase.from('schools').select('settings').eq('id', sid).single()
  return data?.settings || {}
}

async function writeSchoolSettings(patch) {
  const sid = schoolId.value
  if (!sid) throw new Error('ไม่พบ schoolId')
  const settings = await readSchoolSettings()
  const { error } = await supabase.from('schools').update({
    settings: { ...settings, ...patch }
  }).eq('id', sid)
  if (error) throw error
}

async function loadSettings() {
  loading.value = true
  try {
    const settings = await readSchoolSettings()
    const cc = settings.checkin_config || {}
    if (cc.enabled !== undefined) checkinForm.enabled = cc.enabled
    if (cc.lat)            checkinForm.lat            = cc.lat
    if (cc.lng)            checkinForm.lng            = cc.lng
    if (cc.radius_meters)  checkinForm.radius_meters  = cc.radius_meters
    if (cc.cutoff_time)    checkinForm.cutoff_time    = cc.cutoff_time
    if (cc.telegram_bot_token) checkinForm.telegram_bot_token = cc.telegram_bot_token
    if (cc.auto_points_enabled !== undefined) checkinForm.auto_points_enabled = cc.auto_points_enabled
    if (cc.auto_points_amount !== undefined)  checkinForm.auto_points_amount  = cc.auto_points_amount
  } catch (e) {
    console.error(e)
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}

async function saveCheckinConfig() {
  checkinSaving.value = true
  try {
    await writeSchoolSettings({ checkin_config: { ...checkinForm } })
    ElMessage.success('บันทึกการตั้งค่าเช็คอินแล้ว')
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    checkinSaving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 16px;
  padding: 20px 24px;
}
.section-title { font-weight: 700; font-size: 15px; }
.ci-settings-map { width: 100%; height: 260px; border-radius: 12px; overflow: hidden; margin-top: 12px; }
</style>
