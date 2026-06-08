<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">
      <!-- Header -->
      <div class="club-hero mb-6">
        <div class="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">🎯 {{ isAdmin ? 'ชุมนุมทั้งหมด' : 'ชุมนุมของฉัน' }}</h1>
            <p class="text-white/80 text-sm mt-1">ภาคเรียน {{ term }}{{ isAdmin ? ' — ดูและจัดการทุกชุมนุม (Admin)' : ' — ชุมนุมปกติ 1 ต่อเทอม / ชุมนุมพิเศษไม่จำกัด' }}</p>
          </div>
          <el-button type="primary" @click="openDialog()" style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
            + เปิดชุมนุมใหม่
          </el-button>
        </div>
      </div>

      <!-- Stat Strip -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
          <div class="stat-value" style="color:#1d4ed8">{{ clubs.length }}</div>
          <div class="stat-label">ชุมนุมทั้งหมด</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="stat-value" style="color:#15803d">{{ clubs.filter(c=>c.type==='normal').length }}</div>
          <div class="stat-label">ชุมนุมปกติ</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fef9c3,#fef08a)">
          <div class="stat-value" style="color:#b45309">{{ clubs.filter(c=>c.type==='special').length }}</div>
          <div class="stat-label">ชุมนุมพิเศษ</div>
        </div>
      </div>

      <!-- Club Cards -->
      <div v-if="clubs.length === 0" class="text-center py-16 text-gray-400">
        <div class="text-5xl mb-4">🎭</div>
        <div class="text-lg">ยังไม่มีชุมนุม กด "เปิดชุมนุมใหม่" เพื่อเริ่มต้น</div>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="club in clubs" :key="club.club_id" class="club-card">
          <div class="flex justify-between items-start mb-2">
            <el-tag :type="club.type === 'normal' ? 'success' : 'warning'" size="small">
              {{ club.type === 'normal' ? 'ชุมนุมปกติ' : 'ชุมนุมพิเศษ' }}
            </el-tag>
            <el-tag v-if="!club.is_active" type="danger" size="small">ปิดแล้ว</el-tag>
          </div>
          <h3 class="font-bold text-lg text-gray-800 mb-1">{{ club.name }}</h3>
          <p v-if="isAdmin && club.teacher_name" class="text-indigo-600 text-xs font-medium mb-1">👤 {{ club.teacher_name }}</p>
          <p v-if="club.description" class="text-gray-500 text-sm mb-3 line-clamp-2">{{ club.description }}</p>
          <div class="flex gap-4 text-sm text-gray-600 mb-4">
            <span>👥 {{ club.member_count || 0 }} / {{ club.max_capacity || '∞' }} คน</span>
            <span>📋 {{ club.session_count || 0 }} ครั้ง</span>
          </div>
          <div class="flex gap-2">
            <el-button size="small" type="primary" @click="goDetail(club)">เข้าจัดการ</el-button>
            <el-button size="small" @click="openDialog(club)">แก้ไข</el-button>
            <el-button size="small" type="danger" plain @click="deleteClub(club)">ลบ</el-button>
          </div>
        </div>
      </div>

      <!-- Create/Edit Dialog -->
      <el-dialog v-model="dialogVisible" :title="editingClub ? 'แก้ไขชุมนุม' : 'เปิดชุมนุมใหม่'" width="500px">
        <el-form :model="form" ref="formRef" label-width="120px" v-loading="dialogLoading">
          <el-form-item label="ชื่อชุมนุม" prop="name" :rules="[{ required: true, message: 'กรุณากรอกชื่อชุมนุม' }]">
            <el-input v-model="form.name" placeholder="เช่น ชุมนุมวิทยาศาสตร์, ดนตรี" />
          </el-form-item>
          <el-form-item label="ประเภท">
            <el-radio-group v-model="form.type">
              <el-radio-button value="normal">ชุมนุมปกติ (1 ต่อเทอม)</el-radio-button>
              <el-radio-button value="special">ชุมนุมพิเศษ</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="form.type === 'normal' && hasNormalClub && !editingClub" label="">
            <el-alert type="warning" :closable="false" title="คุณมีชุมนุมปกติแล้ว 1 ชุมนุมในเทอมนี้" show-icon />
          </el-form-item>
          <el-form-item label="รับสูงสุด">
            <el-input-number v-model="form.max_capacity" :min="1" :max="500" :step="5" />
            <span class="ml-2 text-gray-400 text-sm">คน</span>
          </el-form-item>
          <el-form-item label="คำอธิบาย">
            <el-input v-model="form.description" type="textarea" :rows="2" placeholder="รายละเอียดกิจกรรมของชุมนุม..." />
          </el-form-item>
          <el-form-item label="เปิดรับสมัคร">
            <el-switch v-model="form.is_active" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="dialogLoading" @click="saveClub"
            :disabled="form.type === 'normal' && hasNormalClub && !editingClub">
            บันทึก
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'

const schoolStore = useSchoolStore()
const authStore = useAuthStore()
const router = useRouter()

const db = () => getSchoolDb()
const term = computed(() => schoolStore.currentTerm || '2568_1')
const teacherId   = computed(() => authStore.profile?.uid || '')
const teacherName = computed(() => authStore.profile?.displayName || authStore.profile?.email || '')
const isAdmin     = computed(() => authStore.isAdmin)

const loading = ref(false)
const dialogLoading = ref(false)
const dialogVisible = ref(false)
const editingClub = ref(null)
const formRef = ref()
const clubs = ref([])

// hasNormalClub only checks the current teacher's own clubs (not all clubs in admin view)
const hasNormalClub = computed(() =>
  clubs.value.some(c => c.type === 'normal' && c.teacher_id === teacherId.value)
)

const form = reactive({
  name: '',
  type: 'normal',
  max_capacity: 30,
  description: '',
  is_active: true,
})

function openDialog(club = null) {
  editingClub.value = club
  if (club) {
    Object.assign(form, {
      name: club.name,
      type: club.type || 'normal',
      max_capacity: club.max_capacity || 30,
      description: club.description || '',
      is_active: club.is_active !== false,
    })
  } else {
    Object.assign(form, { name: '', type: 'normal', max_capacity: 30, description: '', is_active: true })
  }
  dialogVisible.value = true
}

async function saveClub() {
  try {
    await formRef.value?.validate()
  } catch {
    return // validation failed — form will show inline errors
  }
  if (!teacherId.value) {
    ElMessage.error('ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่')
    return
  }
  dialogLoading.value = true
  try {
    if (editingClub.value) {
      const clubRef = doc(db(), `terms/${term.value}/clubs`, editingClub.value.club_id)
      await setDoc(clubRef, {
        name: form.name,
        type: form.type,
        max_capacity: form.max_capacity,
        description: form.description,
        is_active: form.is_active,
        updated_at: serverTimestamp(),
      }, { merge: true })
      Object.assign(editingClub.value, { name: form.name, type: form.type, max_capacity: form.max_capacity, description: form.description, is_active: form.is_active })
    } else {
      const clubId = `club_${teacherId.value}_${Date.now()}`
      const data = {
        club_id: clubId,
        name: form.name,
        type: form.type,
        max_capacity: form.max_capacity,
        description: form.description,
        is_active: form.is_active,
        teacher_id: teacherId.value,
        teacher_name: teacherName.value,
        member_count: 0,
        session_count: 0,
        members: {},   // embedded map: { [student_id]: memberData }
        sessions: {},  // embedded map: { [session_id]: sessionData }
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }
      await setDoc(doc(db(), `terms/${term.value}/clubs`, clubId), data)
      clubs.value.push({ ...data })
    }
    ElMessage.success('บันทึกชุมนุมสำเร็จ')
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    dialogLoading.value = false
  }
}

async function deleteClub(club) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบชุมนุม "${club.name}" ? ข้อมูลสมาชิกและบันทึกทั้งหมดจะหายไป`,
      'ลบชุมนุม',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    loading.value = true
    await deleteDoc(doc(db(), `terms/${term.value}/clubs`, club.club_id))
    clubs.value = clubs.value.filter(c => c.club_id !== club.club_id)
    ElMessage.success('ลบชุมนุมแล้ว')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    loading.value = false
  }
}

function goDetail(club) {
  router.push({ name: 'ClubDetail', params: { clubId: club.club_id } })
}

async function loadClubs() {
  loading.value = true
  try {
    const col = collection(db(), `terms/${term.value}/clubs`)
    const q = isAdmin.value
      ? col
      : query(col, where('teacher_id', '==', teacherId.value))
    const snap = await getDocs(q)
    clubs.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

onMounted(loadClubs)
</script>

<style scoped>
.club-page {
  min-height: 100%;
  padding: 24px;
  background:
    radial-gradient(circle at 10% 10%, rgba(6, 182, 212, 0.1), transparent 40%),
    radial-gradient(circle at 90% 20%, rgba(14, 116, 144, 0.1), transparent 35%),
    linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%);
}

.club-shell {
  max-width: 1080px;
  margin: 0 auto;
}

.club-hero {
  padding: 24px;
  border-radius: 18px;
  color: #ffffff;
  background: linear-gradient(135deg, #0d9488 0%, #0891b2 48%, #1d4ed8 100%);
  box-shadow: 0 14px 32px rgba(8, 145, 178, 0.22);
}

.club-title {
  margin: 0;
  font-size: clamp(1.4rem, 2.8vw, 2rem);
  line-height: 1.2;
  font-weight: 800;
}

.club-subtitle {
  margin: 8px 0 0;
  font-size: 0.98rem;
  color: rgba(255, 255, 255, 0.9);
}

.club-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.club-card {
  border-radius: 16px;
  padding: 18px;
  border: 1px solid transparent;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(2, 6, 23, 0.08);
}

.club-card-regular {
  border-color: #99f6e4;
  background: linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%);
}

.club-card-special {
  border-color: #bae6fd;
  background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
}

.club-card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f172a;
  background: rgba(15, 23, 42, 0.08);
}

.club-card-title {
  margin: 12px 0 8px;
  font-size: 1.08rem;
  font-weight: 800;
  color: #0f172a;
}

.club-card-text {
  margin: 0;
  color: #334155;
  line-height: 1.55;
  font-size: 0.95rem;
}

.club-alert {
  margin-top: 16px;
  border-radius: 14px;
  padding: 14px 16px;
  border: 1px solid #fde68a;
  background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
  color: #78350f;
  line-height: 1.5;
  box-shadow: 0 8px 18px rgba(217, 119, 6, 0.12);
}

@media (max-width: 820px) {
  .club-page {
    padding: 16px;
  }

  .club-hero {
    padding: 18px;
  }

  .club-grid {
    grid-template-columns: 1fr;
  }
}
</style>
