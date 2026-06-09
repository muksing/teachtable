<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">
      <!-- Header -->
      <div class="header-card mb-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-lg">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">📝 จัดการข้อมูลบันทึกเข้าสอน</h1>
            <p class="text-white/80 text-sm mt-1">ดูรายการบันทึกเข้าสอนทั้งหมด และลบข้อมูลที่ผิดพลาด</p>
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <el-card class="mb-4 shadow-sm" style="border-radius:12px">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📆 เลือกวันที่</div>
            <el-date-picker
              v-model="filterDate"
              type="date"
              placeholder="วันที่สอน"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              clearable
              style="width:180px"
            />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">🏫 ห้องเรียน</div>
            <el-select v-model="filterClass" placeholder="เลือกห้อง" clearable filterable style="width:140px">
              <el-option v-for="c in classesList" :key="c.class_id" :label="c.class_name || c.class_id" :value="c.class_id" />
            </el-select>
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">👨‍🏫 ชื่อครู</div>
            <el-select v-model="filterTeacher" placeholder="เลือกครู" clearable filterable style="width:160px">
              <el-option v-for="t in teachersList" :key="t.teacher_id" :label="`${t.prefix || ''}${t.name} ${t.surname}`" :value="t.teacher_id" />
            </el-select>
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📚 วิชา</div>
            <el-select v-model="filterSubject" placeholder="เลือกวิชา" clearable filterable style="width:160px">
              <el-option v-for="s in subjectsList" :key="s.subject_code" :label="`${s.subject_code} ${s.name}`" :value="s.subject_code" />
            </el-select>
          </div>
          <div class="flex items-center pb-1">
            <el-button type="primary" :loading="loading" @click="loadData">
              🔍 ค้นหา
            </el-button>
          </div>
          <div class="ml-auto flex items-center gap-2 pb-1">
             <el-button type="danger" :disabled="!selectedRows.length" @click="deleteSelected">
              🗑️ ลบที่เลือก ({{ selectedRows.length }})
            </el-button>
            <el-button type="danger" plain @click="deleteAll">
              ❌ ลบทั้งหมด
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- Table -->
      <el-table
        ref="tableRef"
        :data="displayData"
        border stripe
        v-loading="loading"
        @selection-change="rows => selectedRows = rows"
        :header-cell-style="{ background:'#4f46e5', color:'white', fontWeight:'600', fontSize:'13px' }"
        style="width:100%; border-radius:8px; overflow:hidden;"
      >
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column prop="date" label="วันที่" width="110" align="center">
          <template #default="{ row }">
            <span class="font-medium text-gray-700">{{ formatDate(row.date) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="period" label="คาบ" width="70" align="center" />
        <el-table-column prop="class_id" label="ห้อง" width="100" align="center" />
        <el-table-column prop="subject_name" label="วิชา" min-width="180" />
        <el-table-column prop="teacher_plan_name" label="ครูผู้สอน" min-width="160" />
        <el-table-column label="สถานะ" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_filled ? 'success' : 'info'" size="small">
              {{ row.is_filled ? 'บันทึกแล้ว' : 'ยังไม่บันทึก' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="จัดการ" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="danger" plain @click="confirmDelete(row)">ลบ</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { getClasses, getTeachers, getSubjects } = useSchoolDb()

const loading = ref(false)
const filterDate = ref('')
const filterClass = ref('')
const filterTeacher = ref('')
const filterSubject = ref('')

const allData = ref([])
const displayData = ref([])
const selectedRows = ref([])
const classesList = ref([])
const teachersList = ref([])
const subjectsList = ref([])

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

async function loadData() {
  if (!filterDate.value && !filterClass.value && !filterTeacher.value && !filterSubject.value) {
    ElMessage.warning('กรุณาเลือกตัวกรองอย่างน้อย 1 อย่าง เพื่อประหยัดการดึงข้อมูล')
    return
  }
  loading.value = true
  try {
    const schoolId = authStore.schoolId
    const term = schoolStore.currentTerm || '2568_1'

    let query = supabase
      .from('teach_actuals')
      .select('*')
      .eq('school_id', schoolId)
      .eq('term_id', term)

    // Apply primary filter server-side; secondary filters applied in memory
    if (filterDate.value) {
      query = query.eq('date', filterDate.value)
    } else if (filterClass.value) {
      query = query.eq('class_id', filterClass.value)
    } else if (filterSubject.value) {
      query = query.eq('subject_id', filterSubject.value)
    }

    const { data, error } = await query
    if (error) throw error

    allData.value = (data || [])
      .map(row => ({
        ...row,
        period: row.period_number,
        teacher_plan_name: row.planned_teacher_id,
        subject_name: row.subject_id,
        teacher_plan_id: row.planned_teacher_id,
        subject_plan_id: row.subject_id,
        subject_actual_teacher_id: row.actual_teacher_id,
        subject_actual_id: row.subject_id,
      }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date > b.date ? -1 : 1
        if (a.class_id !== b.class_id) return a.class_id > b.class_id ? 1 : -1
        return (a.period_number || 0) - (b.period_number || 0)
      })

    filterData()
  } catch (error) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + error.message)
  } finally {
    loading.value = false
  }
}

function filterData() {
  displayData.value = allData.value.filter(item => {
    const matchDate = !filterDate.value || item.date === filterDate.value
    const matchClass = !filterClass.value || item.class_id === filterClass.value
    const matchTeacher = !filterTeacher.value || item.planned_teacher_id === filterTeacher.value || item.actual_teacher_id === filterTeacher.value
    const matchSubject = !filterSubject.value || item.subject_id === filterSubject.value
    return matchDate && matchClass && matchTeacher && matchSubject
  })
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบข้อมูลบันทึกเข้าสอน คาบ ${row.period_number} ห้อง ${row.class_id} ของ ${row.planned_teacher_id}?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    loading.value = true
    const { error } = await supabase.from('teach_actuals').delete().eq('id', row.id)
    if (error) throw error
    ElMessage.success('ลบข้อมูลเรียบร้อยแล้ว')
    await loadData()
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function deleteSelected() {
  if (!selectedRows.value.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบข้อมูลที่เลือกจำนวน ${selectedRows.value.length} รายการ?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'danger' }
    )
    loading.value = true
    const ids = selectedRows.value.map(row => row.id)
    const { error } = await supabase.from('teach_actuals').delete().in('id', ids)
    if (error) throw error
    ElMessage.success('ลบข้อมูลที่เลือกเรียบร้อยแล้ว')
    await loadData()
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function deleteAll() {
  try {
    await ElMessageBox.confirm(
      'ยืนยันการลบข้อมูลบันทึกเข้าสอน ทั้งหมด ในระบบ? (ไม่สามารถกู้คืนได้)',
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    const schoolId = authStore.schoolId
    const term = schoolStore.currentTerm || '2568_1'
    const { error } = await supabase
      .from('teach_actuals')
      .delete()
      .eq('school_id', schoolId)
      .eq('term_id', term)
    if (error) throw error
    ElMessage.success('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว')
    allData.value = []
    displayData.value = []
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const [cls, tch, subj] = await Promise.all([getClasses(), getTeachers(), getSubjects()])
    classesList.value = cls
    teachersList.value = tch
    subjectsList.value = subj
  } catch (e) {
    console.error('โหลดรายชื่อตัวเลือกไม่สำเร็จ:', e)
  }
})
</script>
