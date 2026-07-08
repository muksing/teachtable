<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">
      <!-- Header Card -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">🛡️ ตั้งค่าตรวจจับทุจริต</h1>
            <p class="text-white/80 text-sm mt-1">ปรับความไวในการตรวจจับ และระยะเวลาอนุโลมกลับเข้า</p>
          </div>
        </div>
      </div>

      <el-card class="settings-card mb-6">
        <template #header>
          <span class="card-title">🛡️ ความไวในการตรวจจับทุจริต</span>
        </template>

        <el-alert type="info" :closable="false" show-icon class="mb-5"
          description="ค่าต่ำ = ตรวจจับเร็วและเข้มงวด / ค่าสูง = ผ่อนปรนกว่า  (หน่วย: มิลลิวินาที)" />

        <div class="grid grid-cols-1 gap-4" style="max-width:560px">

          <!-- ac_split_grace_ms -->
          <div class="ac-row">
            <div class="ac-label">
              <span class="ac-title">⏱ เวลาตรวจจับเมาส์ออกด้านข้าง / ล่าง</span>
              <span class="ac-hint">เมาส์ออกนอกหน้าต่างฝั่งข้าง (Split-screen) → นับทุจริตหลัง</span>
            </div>
            <div class="ac-input-wrap">
              <el-input-number
                v-model="form.split_grace_ms"
                :min="50" :max="2000" :step="50"
              />
              <span class="ac-unit">ms</span>
              <el-tag v-if="form.split_grace_ms <= 150" type="danger" size="small">เข้มงวด</el-tag>
              <el-tag v-else-if="form.split_grace_ms <= 400" type="warning" size="small">ปกติ</el-tag>
              <el-tag v-else type="info" size="small">ผ่อนปรน</el-tag>
            </div>
          </div>

          <!-- ac_top_grace_ms -->
          <div class="ac-row">
            <div class="ac-label">
              <span class="ac-title">⏱ เวลาตรวจจับเมาส์ออกด้านบน</span>
              <span class="ac-hint">เมาส์ขึ้น Address bar / Toolbar → นับทุจริตหลัง</span>
            </div>
            <div class="ac-input-wrap">
              <el-input-number
                v-model="form.top_grace_ms"
                :min="100" :max="3000" :step="50"
              />
              <span class="ac-unit">ms</span>
              <el-tag v-if="form.top_grace_ms <= 300" type="danger" size="small">เข้มงวด</el-tag>
              <el-tag v-else-if="form.top_grace_ms <= 600" type="warning" size="small">ปกติ</el-tag>
              <el-tag v-else type="info" size="small">ผ่อนปรน</el-tag>
            </div>
          </div>

          <!-- ac_return_grace_ms -->
          <div class="ac-row">
            <div class="ac-label">
              <span class="ac-title">↩️ เวลาอนุโลมกลับเข้า (สลับแท็บ / หน้าต่าง)</span>
              <span class="ac-hint">กลับมาภายในเวลานี้ → ไม่นับครั้งทุจริต</span>
            </div>
            <div class="ac-input-wrap">
              <el-input-number
                v-model="form.return_grace_ms"
                :min="200" :max="2000" :step="100"
              />
              <span class="ac-unit">ms</span>
              <el-tag v-if="form.return_grace_ms <= 300" type="danger" size="small">เข้มงวด</el-tag>
              <el-tag v-else-if="form.return_grace_ms <= 700" type="warning" size="small">ปกติ</el-tag>
              <el-tag v-else type="info" size="small">ผ่อนปรน</el-tag>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between pt-2">
            <el-button size="small" plain @click="resetDefaults">
              ↺ คืนค่าตั้งต้น (120 / 350 / 500 ms)
            </el-button>
            <el-button
              type="primary"
              :loading="saving"
              @click="saveSettings"
              style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;min-width:120px"
            >
              💾 บันทึก
            </el-button>
          </div>

        </div>
      </el-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const saving = ref(false)

const DEFAULTS = { split_grace_ms: 120, top_grace_ms: 350, return_grace_ms: 500 }

const form = reactive({ ...DEFAULTS })

// ===== Supabase helpers =====
async function readSchoolSettings() {
  const sid = authStore.schoolId
  if (!sid) return {}
  const { data } = await supabase.from('schools').select('settings').eq('id', sid).single()
  return data?.settings || {}
}

async function writeSchoolSettings(patch) {
  const sid = authStore.schoolId
  if (!sid) throw new Error('ไม่พบ schoolId')
  const settings = await readSchoolSettings()
  const { error } = await supabase.from('schools').update({
    settings: { ...settings, ...patch }
  }).eq('id', sid)
  if (error) throw error
}

// ===== Load =====
async function loadSettings() {
  loading.value = true
  try {
    const settings = await readSchoolSettings()
    const ac = settings.anti_cheat_detection || {}
    if (ac.split_grace_ms  != null) form.split_grace_ms  = ac.split_grace_ms
    if (ac.top_grace_ms    != null) form.top_grace_ms    = ac.top_grace_ms
    if (ac.return_grace_ms != null) form.return_grace_ms = ac.return_grace_ms
  } catch (e) {
    console.error(e)
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

// ===== Save =====
async function saveSettings() {
  saving.value = true
  try {
    await writeSchoolSettings({
      anti_cheat_detection: {
        split_grace_ms:  Number(form.split_grace_ms)  || DEFAULTS.split_grace_ms,
        top_grace_ms:    Number(form.top_grace_ms)    || DEFAULTS.top_grace_ms,
        return_grace_ms: Number(form.return_grace_ms) || DEFAULTS.return_grace_ms,
      }
    })
    ElMessage.success('บันทึกการตั้งค่าตรวจจับทุจริตเรียบร้อยแล้ว')
  } catch (e) {
    console.error(e)
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

function resetDefaults() {
  form.split_grace_ms  = DEFAULTS.split_grace_ms
  form.top_grace_ms    = DEFAULTS.top_grace_ms
  form.return_grace_ms = DEFAULTS.return_grace_ms
}

onMounted(loadSettings)
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(124,58,237,0.18);
}

.settings-card {
  border-radius: 16px;
  border: 1px solid #fca5a5;
  box-shadow: 0 10px 24px rgba(15,23,42,0.08);
  overflow: hidden;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}

:deep(.el-card__header) {
  padding: 12px 20px;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  border-bottom: 1px solid rgba(255,255,255,0.22);
}
:deep(.el-card__body) {
  padding: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.ac-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.ac-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ac-title {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}
.ac-hint {
  font-size: 11px;
  color: #64748b;
}
.ac-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.ac-unit {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}
</style>
