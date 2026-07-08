<template>
  <AppLayout>
    <div class="cal-page">
      <div class="header-card">
        <div class="header-row">
          <div>
            <h1 class="title">🗓️ ปฏิทินโรงเรียน</h1>
            <p class="subtitle">รวมวันหยุด วันเรียนชดเชย วันสอบ และเหตุการณ์อื่น ๆ ไว้ในที่เดียว</p>
          </div>
          <el-button v-if="canEdit" type="primary" @click="openCreateDialog"
            style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
            + เพิ่มเหตุการณ์
          </el-button>
        </div>
      </div>

      <el-card class="mb-4" shadow="never">
        <div class="month-nav">
          <el-button size="small" @click="shiftMonth(-1)">‹ เดือนก่อน</el-button>
          <div class="month-label">{{ monthLabel }}</div>
          <el-button size="small" @click="shiftMonth(1)">เดือนถัดไป ›</el-button>
          <el-button size="small" plain @click="goToday">วันนี้</el-button>
        </div>
        <div class="legend">
          <span v-for="(meta, key) in EVENT_TYPE_META" :key="key" class="legend-item">
            <span class="legend-dot" :style="{ background: meta.color }"></span>{{ meta.label }}
          </span>
        </div>
      </el-card>

      <el-card v-loading="loading" shadow="never">
        <div class="cal-grid">
          <div v-for="d in ['อา','จ','อ','พ','พฤ','ศ','ส']" :key="d" class="cal-dow">{{ d }}</div>
          <div v-for="(cell, idx) in gridCells" :key="idx" class="cal-cell" :class="{ 'cal-cell--pad': !cell, 'cal-cell--today': cell && cell.isToday }">
            <template v-if="cell">
              <div class="cal-daynum">{{ cell.day }}</div>
              <div class="cal-events">
                <div v-for="ev in cell.events" :key="ev.id" class="cal-ev"
                  :style="{ background: typeMeta(ev.type).color + '22', color: typeMeta(ev.type).color, borderLeftColor: typeMeta(ev.type).color }"
                  @click="ev.editable && openEditDialog(ev)">
                  {{ typeMeta(ev.type).icon }} {{ ev.title }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </el-card>

      <!-- Create/Edit Dialog -->
      <el-dialog v-model="dialogVisible" :title="editing ? 'แก้ไขเหตุการณ์' : 'เพิ่มเหตุการณ์'" width="480px">
        <el-form :model="form" label-width="110px">
          <el-form-item label="หัวข้อ" required>
            <el-input v-model="form.title" placeholder="เช่น ประชุมครูประจำเดือน" />
          </el-form-item>
          <el-form-item label="รายละเอียด">
            <el-input v-model="form.description" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="วันที่" required>
            <el-date-picker v-model="form.eventDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
          </el-form-item>
          <el-form-item label="ถึงวันที่">
            <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="ถ้าเป็นเหตุการณ์วันเดียวไม่ต้องกรอก" />
          </el-form-item>
          <el-form-item label="ประเภท">
            <el-select v-model="form.eventType" style="width:100%">
              <el-option v-for="(meta, key) in customTypeOptions" :key="key" :value="key" :label="meta.label" />
            </el-select>
          </el-form-item>
          <el-form-item label="แสดงให้เห็น">
            <el-checkbox-group v-model="form.targetAudience">
              <el-checkbox value="teacher">ครู</el-checkbox>
              <el-checkbox value="student">นักเรียน</el-checkbox>
              <el-checkbox value="parent">ผู้ปกครอง</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button v-if="editing" type="danger" plain @click="handleDelete">🗑️ ลบ</el-button>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">บันทึก</el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolCalendar } from '@/composables/useSchoolCalendar'

const authStore = useAuthStore()
const { events, loading, loadEvents, createEvent, updateEvent, deleteEvent, typeMeta, EVENT_TYPE_META } = useSchoolCalendar()

const canEdit = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin', 'school_director', 'announcer']))

const customTypeOptions = { meeting: EVENT_TYPE_META.meeting, activity: EVENT_TYPE_META.activity, important: EVENT_TYPE_META.important, other: EVENT_TYPE_META.other }

const viewDate = ref(new Date())
const monthLabel = computed(() => {
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
  return `${thaiMonths[viewDate.value.getMonth()]} ${viewDate.value.getFullYear() + 543}`
})

function pad(n) { return String(n).padStart(2, '0') }
function toDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const monthRange = computed(() => {
  const y = viewDate.value.getFullYear(), m = viewDate.value.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return { from: toDateKey(first), to: toDateKey(last), first, last }
})

const gridCells = computed(() => {
  const { first, last } = monthRange.value
  const todayKey = toDateKey(new Date())
  const cells = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(first.getFullYear(), first.getMonth(), day)
    const key = toDateKey(d)
    const dayEvents = events.value.filter(ev => {
      if (ev.end_date) return key >= ev.date && key <= ev.end_date
      return ev.date === key
    })
    cells.push({ day, key, events: dayEvents, isToday: key === todayKey })
  }
  return cells
})

function shiftMonth(delta) {
  const d = new Date(viewDate.value)
  d.setMonth(d.getMonth() + delta)
  viewDate.value = d
}
function goToday() { viewDate.value = new Date() }

watch(monthRange, (r) => loadEvents(r.from, r.to), { immediate: true })

// ── Dialog ──────────────────────────────────────────────
const dialogVisible = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = reactive({ title: '', description: '', eventDate: '', endDate: '', eventType: 'other', targetAudience: ['all'] })

function resetForm() {
  Object.assign(form, { title: '', description: '', eventDate: toDateKey(new Date()), endDate: '', eventType: 'other', targetAudience: ['all'] })
}
function openCreateDialog() {
  editing.value = null
  resetForm()
  dialogVisible.value = true
}
function openEditDialog(ev) {
  editing.value = ev
  Object.assign(form, {
    title: ev.title, description: ev.description || '', eventDate: ev.date, endDate: ev.end_date || '',
    eventType: ev.type, targetAudience: ['all'],
  })
  dialogVisible.value = true
}
async function handleSave() {
  if (!form.title.trim() || !form.eventDate) {
    ElMessage.warning('กรุณากรอกหัวข้อและวันที่')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateEvent(editing.value.raw_id, {
        title: form.title, description: form.description, event_date: form.eventDate,
        end_date: form.endDate || null, event_type: form.eventType, target_audience: form.targetAudience,
      })
      ElMessage.success('แก้ไขเรียบร้อย')
    } else {
      await createEvent({ title: form.title, description: form.description, eventDate: form.eventDate, endDate: form.endDate, eventType: form.eventType, targetAudience: form.targetAudience })
      ElMessage.success('เพิ่มเหตุการณ์เรียบร้อย')
    }
    dialogVisible.value = false
    await loadEvents(monthRange.value.from, monthRange.value.to)
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}
async function handleDelete() {
  try {
    await ElMessageBox.confirm(`ลบเหตุการณ์ "${form.title}"?`, 'ยืนยันการลบ', { type: 'warning' })
  } catch { return }
  try {
    await deleteEvent(editing.value.raw_id)
    ElMessage.success('ลบเรียบร้อย')
    dialogVisible.value = false
    await loadEvents(monthRange.value.from, monthRange.value.to)
  } catch (e) {
    ElMessage.error('ลบไม่สำเร็จ: ' + e.message)
  }
}
</script>

<style scoped>
.header-card { background: linear-gradient(135deg, #0ea5e9, #6366f1); border-radius: 16px; padding: 20px 24px; margin-bottom: 16px; color: white; }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.title { font-size: 20px; font-weight: 800; margin: 0; }
.subtitle { font-size: 13px; opacity: .85; margin: 6px 0 0; }

.month-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.month-label { font-size: 16px; font-weight: 700; color: #1e293b; min-width: 160px; text-align: center; }

.legend { display: flex; gap: 14px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #6b7280; }
.legend-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-dow { text-align: center; font-weight: 700; font-size: 12px; color: #6b7280; padding: 6px 0; }
.cal-cell { min-height: 90px; border-radius: 8px; background: #f8fafc; padding: 4px; }
.cal-cell--pad { background: transparent; }
.cal-cell--today { background: #eff6ff; border: 1.5px solid #3b82f6; }
.cal-daynum { font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 3px; }
.cal-events { display: flex; flex-direction: column; gap: 2px; }
.cal-ev { font-size: 10px; padding: 2px 4px; border-radius: 4px; border-left: 3px solid; cursor: pointer; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 640px) {
  .cal-cell { min-height: 60px; }
  .cal-ev { font-size: 9px; }
}
</style>
