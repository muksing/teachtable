<template>
  <AppLayout>
    <div class="ns-page">

      <div class="ns-title-bar">
        <div>
          <h1 class="ns-title">⚙️ ตั้งค่าระบบแจ้งผลการเรียน</h1>
          <p class="ns-sub">กำหนดเกณฑ์ตรวจสอบ + ข้อความจดหมายถึงผู้ปกครอง</p>
        </div>
        <el-button type="primary" :loading="saving" @click="saveSettings">💾 บันทึกการตั้งค่า</el-button>
      </div>

      <div class="ns-grid">

        <!-- ── Section 1: Score config ── -->
        <el-card shadow="never" class="ns-card">
          <template #header>
            <span class="ns-card-title">📊 การตั้งค่าคะแนนเก็บ</span>
          </template>

          <el-form label-position="top" label-width="auto">
            <el-form-item label="จำนวนหน่วยการเรียน (1–8)">
              <el-input-number v-model="form.score.num_units" :min="1" :max="8" controls-position="right" style="width:120px" />
            </el-form-item>

            <el-form-item :label="`คะแนนสูงสุดแต่ละหน่วย (${form.score.num_units} หน่วย)`">
              <div class="flex flex-wrap gap-2">
                <div v-for="u in form.score.num_units" :key="u" class="flex flex-col items-center">
                  <span class="text-xs text-gray-500 mb-1">หน่วย {{ u }}</span>
                  <el-input-number
                    v-model="form.score.max_scores[u-1]"
                    :min="1" :max="200"
                    controls-position="right" style="width:90px"
                  />
                </div>
              </div>
              <div class="mt-2 text-sm text-blue-700 font-semibold">
                คะแนนเต็มรวม: {{ totalMax }} คะแนน
              </div>
            </el-form-item>

            <el-form-item label="เกณฑ์ผ่าน (% ของคะแนนรวม)">
              <el-slider v-model="form.score.pass_pct" :min="0" :max="100" :step="5"
                show-input :input-size="'small'" style="max-width:320px" />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- ── Section 2: Notification thresholds ── -->
        <el-card shadow="never" class="ns-card">
          <template #header>
            <span class="ns-card-title">⚠️ เกณฑ์กลุ่มเสี่ยง</span>
            <span class="text-xs text-gray-500 ml-2">(ต่ำกว่าเกณฑ์ใดเกณฑ์หนึ่ง = กลุ่มเสี่ยง)</span>
          </template>

          <el-form label-position="top">
            <el-form-item label="คะแนนรวมรายวิชา (%) ต่ำกว่า">
              <div class="flex items-center gap-3">
                <el-input-number v-model="form.targets.min_score_pct" :min="0" :max="100"
                  controls-position="right" style="width:120px" />
                <span class="text-gray-500 text-sm">%  จะถูกจัดเป็นกลุ่มเสี่ยง</span>
              </div>
            </el-form-item>

            <el-form-item label="เวลาเรียน (%) ต่ำกว่า">
              <div class="flex items-center gap-3">
                <el-input-number v-model="form.targets.min_attendance_pct" :min="0" :max="100"
                  controls-position="right" style="width:120px" />
                <span class="text-gray-500 text-sm">%  จะถูกจัดเป็นกลุ่มเสี่ยง</span>
              </div>
            </el-form-item>

            <el-form-item label="คะแนนความประพฤติ (คะแนนสุทธิ) ต่ำกว่า">
              <div class="flex items-center gap-3">
                <el-input-number v-model="form.targets.min_behavior_score" :min="-999" :max="999"
                  controls-position="right" style="width:120px" />
                <span class="text-gray-500 text-sm">คะแนน  จะถูกจัดเป็นกลุ่มเสี่ยง</span>
              </div>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- ── Section 3: Message – Normal ── -->
        <el-card shadow="never" class="ns-card">
          <template #header>
            <div class="flex items-center gap-2">
              <span class="ns-card-title">✅ ข้อความกลุ่มปกติ</span>
              <el-tag type="success" size="small">ผ่านเกณฑ์ทุกข้อ</el-tag>
            </div>
          </template>

          <el-form label-position="top">
            <el-form-item label="ข้อความเนื้อหาจดหมาย (ส่วนบน)">
              <el-input v-model="form.messages.normal_body" type="textarea" :rows="5"
                placeholder="เช่น: ขอรายงานผลการเรียนของนักเรียน ซึ่งมีผลการเรียนอยู่ในเกณฑ์ที่น่าพอใจ..." />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- ── Section 4: Message – Risk ── -->
        <el-card shadow="never" class="ns-card">
          <template #header>
            <div class="flex items-center gap-2">
              <span class="ns-card-title">🔴 ข้อความกลุ่มเสี่ยง</span>
              <el-tag type="danger" size="small">มีข้อที่ต่ำกว่าเกณฑ์</el-tag>
            </div>
          </template>

          <el-form label-position="top">
            <el-form-item label="ข้อความเนื้อหาจดหมาย (ส่วนบน)">
              <el-input v-model="form.messages.risk_body" type="textarea" :rows="5"
                placeholder="เช่น: นักเรียนของท่านมีผลการเรียนและ/หรือพฤติกรรมที่ต่ำกว่าเกณฑ์ที่กำหนด จึงขอเชิญท่านมาพบเพื่อร่วมหาแนวทางแก้ไข..." />
            </el-form-item>

            <el-form-item label="วันนัดหมายประชุมผู้ปกครอง">
              <el-date-picker v-model="form.messages.meeting_date" type="date"
                format="DD/MM/YYYY" value-format="YYYY-MM-DD"
                placeholder="เลือกวันนัดหมาย" style="width:180px" />
            </el-form-item>

            <el-form-item label="เวลา">
              <el-time-picker v-model="form.messages.meeting_time"
                format="HH:mm" value-format="HH:mm"
                placeholder="เลือกเวลา" style="width:140px" />
            </el-form-item>

            <el-form-item label="สถานที่">
              <el-input v-model="form.messages.meeting_place"
                placeholder="เช่น: ห้องประชุม ชั้น 2 อาคาร 1" />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- ── Section 5: Signature ── -->
        <el-card shadow="never" class="ns-card">
          <template #header>
            <span class="ns-card-title">✍️ ส่วนท้ายจดหมาย</span>
          </template>
          <el-form label-position="top">
            <el-form-item label="คำลงท้าย">
              <el-input v-model="form.messages.closing"
                placeholder="เช่น: ขอแสดงความนับถือ" />
            </el-form-item>
            <el-form-item label="ชื่อผู้ลงนาม (ผู้อำนวยการ)">
              <el-input v-model="form.messages.signer_name"
                placeholder="เช่น: นาย ก ข ค" />
            </el-form-item>
            <el-form-item label="ตำแหน่ง">
              <el-input v-model="form.messages.signer_position"
                placeholder="เช่น: ผู้อำนวยการโรงเรียน" />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- ── Preview ── -->
        <el-card shadow="never" class="ns-card ns-card-full">
          <template #header><span class="ns-card-title">👁 ตัวอย่างจดหมาย</span></template>
          <div class="ns-preview">
            <div class="ns-preview-label">กลุ่มปกติ</div>
            <div class="ns-preview-box">
              <p>เรียน ผู้ปกครองของ [ชื่อนักเรียน]</p>
              <p style="white-space:pre-wrap">{{ form.messages.normal_body || '...' }}</p>
              <p>{{ form.messages.closing }}</p>
              <p><b>{{ form.messages.signer_name }}</b><br />{{ form.messages.signer_position }}</p>
            </div>

            <div class="ns-preview-label mt-4" style="color:#dc2626">กลุ่มเสี่ยง</div>
            <div class="ns-preview-box" style="border-color:#fca5a5">
              <p>เรียน ผู้ปกครองของ [ชื่อนักเรียน]</p>
              <p style="white-space:pre-wrap">{{ form.messages.risk_body || '...' }}</p>
              <p v-if="form.messages.meeting_date">
                📅 นัดหมายวันที่ {{ thaiDate(form.messages.meeting_date) }}
                เวลา {{ form.messages.meeting_time || '—' }} น.
                สถานที่ {{ form.messages.meeting_place || '—' }}
              </p>
              <p>{{ form.messages.closing }}</p>
              <p><b>{{ form.messages.signer_name }}</b><br />{{ form.messages.signer_position }}</p>
            </div>
          </div>
        </el-card>

      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { reactive, computed, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const saving = ref(false)

const form = reactive({
  score: {
    num_units: 8,
    max_scores: [20, 20, 20, 20, 20, 20, 20, 20],
    pass_pct: 50,
  },
  targets: {
    min_score_pct: 50,
    min_attendance_pct: 80,
    min_behavior_score: 0,
  },
  messages: {
    normal_body: 'ขอรายงานผลการเรียนของนักเรียน ซึ่งผ่านเกณฑ์ทุกด้าน โรงเรียนขอขอบคุณที่ท่านให้ความร่วมมือในการดูแลนักเรียน',
    risk_body: 'นักเรียนของท่านมีผลการเรียนและ/หรือพฤติกรรมที่ต่ำกว่าเกณฑ์ที่โรงเรียนกำหนด โรงเรียนจึงขอเรียนเชิญท่านมาพบปะเพื่อร่วมหาแนวทางแก้ไขและพัฒนา',
    meeting_date: '',
    meeting_time: '',
    meeting_place: '',
    closing: 'ขอแสดงความนับถือ',
    signer_name: '',
    signer_position: 'ผู้อำนวยการโรงเรียน',
  },
})

const totalMax = computed(() =>
  form.score.max_scores.slice(0, form.score.num_units).reduce((a, b) => a + b, 0)
)

function thaiDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function loadSettings() {
  const { data } = await supabase.from('schools').select('settings')
    .eq('id', authStore.schoolId).maybeSingle()
  const s = data?.settings || {}
  if (s.score_settings) Object.assign(form.score, s.score_settings)
  if (s.notification_targets) Object.assign(form.targets, s.notification_targets)
  if (s.notification_messages) Object.assign(form.messages, s.notification_messages)
}

async function saveSettings() {
  saving.value = true
  try {
    const { data } = await supabase.from('schools').select('settings')
      .eq('id', authStore.schoolId).maybeSingle()
    const settings = { ...(data?.settings || {}) }
    settings.score_settings = { ...form.score }
    settings.notification_targets = { ...form.targets }
    settings.notification_messages = { ...form.messages }
    const { error } = await supabase.from('schools')
      .update({ settings }).eq('id', authStore.schoolId)
    if (error) throw error
    ElMessage.success('บันทึกการตั้งค่าสำเร็จ')
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.ns-page { padding: 20px 24px; max-width: 1100px; }
.ns-title-bar { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
.ns-title { font-size:22px; font-weight:800; color:#1e3a8a; margin:0; }
.ns-sub { font-size:13px; color:#6b7280; margin:2px 0 0; }
.ns-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.ns-card { border-radius:14px; }
.ns-card-full { grid-column:1/-1; }
.ns-card-title { font-weight:700; font-size:14px; }
.ns-preview { font-size:13px; line-height:1.7; }
.ns-preview-label { font-weight:700; margin-bottom:6px; color:#1e3a8a; }
.ns-preview-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; }
.ns-preview-box p { margin:0 0 8px; }
@media (max-width:700px) { .ns-grid { grid-template-columns:1fr; } }
</style>
