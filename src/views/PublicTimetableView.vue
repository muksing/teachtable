<template>
  <div class="public-view">
    <div class="header">
      <div class="container">
        <div class="flex items-center gap-3">
          <div class="logo">🏫</div>
          <div>
            <h1 class="text-xl font-bold">{{ schoolInfo?.name || 'Loading school...' }}</h1>
            <p class="text-sm opacity-80">ระบบตารางสอนออนไลน์ (สำหรับนักเรียน/ผู้ปกครอง)</p>
          </div>
        </div>
      </div>
    </div>

    <div class="container main-content">
      <div class="search-box">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">📅 ค้นหาตามห้องเรียน</label>
            <el-select v-model="selectedClass" placeholder="เลือกห้องเรียน" class="w-full" filterable clearable>
              <el-option v-for="c in classes" :key="c.class_name" :label="c.class_name" :value="c.class_name" />
            </el-select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">👨‍🏫 ค้นหาตามชื่อครู</label>
            <el-select v-model="selectedTeacher" placeholder="เลือกชื่อครู" class="w-full" filterable clearable>
              <el-option v-for="t in teachers" :key="t.teacher_code" :label="`${t.prefix||''}${t.first_name} ${t.last_name}`" :value="t.teacher_code" />
            </el-select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="py-20 text-center">
        <el-icon class="is-loading text-4xl text-blue-500"><Loading /></el-icon>
        <p class="mt-4 text-gray-500">กำลังโหลดข้อมูลตารางสอน...</p>
      </div>

      <div v-else-if="publishedMissing" class="empty-state">
        <div class="text-6xl mb-4">📢</div>
        <h2 class="text-xl font-bold text-gray-700">Admin ยังไม่ได้ Publish</h2>
        <p class="text-gray-500">{{ publishedMissingText || 'กรุณาติดต่อผู้ดูแลระบบโรงเรียน' }}</p>
      </div>

      <div v-else-if="!selectedClass && !selectedTeacher" class="empty-state">
        <div class="text-6xl mb-4">🔍</div>
        <h2 class="text-xl font-bold text-gray-700">กรุณาเลือกห้องเรียนหรือชื่อครู</h2>
        <p class="text-gray-500">เพื่อแสดงตารางสอนที่ต้องการ</p>
      </div>

      <!-- Timetable Display -->
      <div v-else class="timetable-card">
        <div class="card-header">
          <h3 class="font-bold text-lg">
            {{ selectedClass ? `ตารางสอนห้อง ${selectedClass}` : `ตารางสอนครู ${selectedTeacherName}` }}
          </h3>
          <p class="text-xs opacity-70">ภาคเรียน: {{ currentTerm }}</p>
          <p class="text-xs opacity-70 mt-1">
            เวอร์ชันเผยแพร่: {{ publishVersion || '-' }} | วันที่เผยแพร่: {{ publishAtLabel || '-' }}
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="public-table">
            <thead>
              <tr>
                <th class="w-16">วัน</th>
                <th v-for="p in 8" :key="p" class="text-center">
                  <div class="text-xs">คาบ {{ p }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in DAYS" :key="day.value">
                <td class="day-cell" :style="`background: ${day.color}`">{{ day.short }}</td>
                <td v-for="p in 8" :key="p" class="slot-cell">
                  <div v-if="getSlot(day.value, p)" class="slot-content">
                    <div class="subject">{{ getSlot(day.value, p).subject_name }}</div>
                    <div class="sub-info">
                      <span v-if="selectedClass">{{ getSlot(day.value, p).teacher_name }}</span>
                      <span v-else>{{ getSlot(day.value, p).class_id }}</span>
                    </div>
                    <div v-if="getSlot(day.value, p).preferred_room" class="room">
                      🏛 {{ getSlot(day.value, p).preferred_room }}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="container text-center">
        <p>© 2026 Master-teachtable SaaS Platform</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/supabase/client'
import { Loading } from '@element-plus/icons-vue'

const route = useRoute()
const schoolId = route.params.schoolId

const loading = ref(false)
const schoolInfo = ref(null)
const classes = ref([])
const teachers = ref([])
const timetable = ref([])
const currentTerm = ref('')
const publishVersion = ref('')
const publishAtLabel = ref('')
const publishedMissing = ref(false)
const publishedMissingText = ref('')

const selectedClass = ref('')
const selectedTeacher = ref('')

const DAYS = [
  { label: 'จันทร์', short: 'จ.', value: 1, color: '#FFD700' },
  { label: 'อังคาร', short: 'อ.', value: 2, color: '#FF69B4' },
  { label: 'พุธ', short: 'พ.', value: 3, color: '#32CD32' },
  { label: 'พฤหัสบดี', short: 'พฤ.', value: 4, color: '#FFA500' },
  { label: 'ศุกร์', short: 'ศ.', value: 5, color: '#1E90FF' }
]

const selectedTeacherName = computed(() => {
  const t = teachers.value.find(x => x.teacher_code === selectedTeacher.value)
  return t ? `${t.prefix||''}${t.first_name} ${t.last_name}` : selectedTeacher.value
})

async function loadSchoolData() {
  if (!schoolId) return
  loading.value = true
  publishedMissing.value = false
  publishedMissingText.value = ''
  try {
    const { data: schoolRow, error } = await supabase
      .from('schools')
      .select('name, settings')
      .eq('id', schoolId)
      .maybeSingle()

    if (error) throw error

    if (schoolRow) {
      schoolInfo.value = { name: schoolRow.name }
      const settings = schoolRow.settings || {}
      currentTerm.value = settings.current_term || '2568_1'

      const snapshot = settings.public_timetable_snapshot || null
      if (snapshot) {
        classes.value = Array.isArray(snapshot.classes) ? snapshot.classes : []
        teachers.value = Array.isArray(snapshot.teachers) ? snapshot.teachers : []
        timetable.value = Array.isArray(snapshot.timetable) ? snapshot.timetable : []
        currentTerm.value = snapshot.current_term || currentTerm.value
        publishVersion.value = snapshot.version || ''
        if (snapshot.published_at_iso) {
          publishAtLabel.value = new Date(snapshot.published_at_iso).toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        }
        return
      }
    }

    publishedMissing.value = true
    publishedMissingText.value = 'Admin ยังไม่ได้ Publish'
    classes.value = []
    teachers.value = []
    timetable.value = []

  } catch (error) {
    console.error('Error loading public timetable:', error)
    publishedMissing.value = true
    publishedMissingText.value = 'Admin ยังไม่ได้ Publish'
  } finally {
    loading.value = false
  }
}

function getSlot(day, period) {
  if (selectedClass.value) {
    return timetable.value.find(s => Number(s.day_of_week) === day && Number(s.period_number) === period && s.class_id === selectedClass.value)
  }
  if (selectedTeacher.value) {
    return timetable.value.find(s => Number(s.day_of_week) === day && Number(s.period_number) === period && String(s.teacher_id) === String(selectedTeacher.value))
  }
  return null
}

watch(selectedClass, (val) => { if (val) selectedTeacher.value = '' })
watch(selectedTeacher, (val) => { if (val) selectedClass.value = '' })

onMounted(loadSchoolData)
</script>

<style scoped>
.public-view {
  min-height: 100vh;
  background-color: #f8fafc;
  font-family: 'Sarabun', sans-serif;
}

.header {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: white;
  padding: 24px 0;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 20px;
}

.logo {
  font-size: 40px;
  background: rgba(255,255,255,0.1);
  padding: 10px;
  border-radius: 12px;
}

.main-content {
  padding-top: 30px;
  padding-bottom: 60px;
}

.search-box {
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  margin-bottom: 24px;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  background: white;
  border-radius: 16px;
  border: 2px dashed #e2e8f0;
}

.timetable-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  overflow: hidden;
}

.card-header {
  background-color: #3b82f6;
  color: white;
  padding: 16px 24px;
}

.public-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

.public-table th {
  background-color: #f1f5f9;
  padding: 12px;
  font-size: 13px;
  color: #64748b;
  border-bottom: 2px solid #e2e8f0;
}

.day-cell {
  padding: 12px;
  text-align: center;
  font-weight: bold;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
}

.slot-cell {
  height: 80px;
  width: 110px;
  border: 1px solid #f1f5f9;
  vertical-align: top;
  padding: 4px;
}

.slot-content {
  height: 100%;
  background: #f0f9ff;
  border-radius: 6px;
  padding: 6px;
  display: flex;
  flex-direction: column;
}

.subject {
  font-weight: bold;
  font-size: 11px;
  color: #1e40af;
  line-height: 1.2;
  margin-bottom: 4px;
}

.sub-info {
  font-size: 10px;
  color: #64748b;
}

.room {
  font-size: 9px;
  color: #3b82f6;
  margin-top: auto;
}

.footer {
  padding: 40px 0;
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 640px) {
  .container { padding: 0 12px; }
  .logo { font-size: 32px; }
  .slot-cell { width: 90px; }
}
</style>
