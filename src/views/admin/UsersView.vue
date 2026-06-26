<template>
  <AppLayout>
    <div class="p-6">

      <!-- Header Card -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">👤 จัดการสิทธิ์ผู้ใช้</h1>
            <p class="text-white/80 text-sm mt-1">กำหนดสิทธิ์การเข้าถึงระบบสำหรับครูและบุคลากร</p>
          </div>
          <el-button @click="openAddAdminDialog"
            style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
            + เพิ่มบัญชีผู้ดูแล
          </el-button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="stat-card">
          <div class="stat-icon" style="background:#f3f0ff;color:#7c3aed">👨‍🏫</div>
          <div>
            <div class="stat-value">{{ teachers.length }}</div>
            <div class="stat-label">ครูทั้งหมด</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#ecfdf5;color:#059669">✅</div>
          <div>
            <div class="stat-value">{{ linkedCount }}</div>
            <div class="stat-label">มีบัญชีแล้ว</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#faf5ff;color:#7c3aed">👑</div>
          <div>
            <div class="stat-value">{{ adminCount }}</div>
            <div class="stat-label">สิทธิ์ Admin</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#eff6ff;color:#2563eb">📅</div>
          <div>
            <div class="stat-value">{{ schedulerCount }}</div>
            <div class="stat-label">สิทธิ์ Scheduler</div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-4">
        <el-input v-model="search" placeholder="ค้นหาชื่อ, อีเมล..." clearable style="width:260px">
          <template #prefix>🔍</template>
        </el-input>
        <el-select v-model="filterRole" placeholder="ทุกสิทธิ์" clearable style="width:160px">
          <el-option label="👑 Admin" value="admin" />
          <el-option label="📅 Scheduler" value="scheduler" />
          <el-option label="👨‍🏫 Teacher" value="teacher" />
        </el-select>
        <el-select v-model="filterAccount" placeholder="ทุกสถานะบัญชี" clearable style="width:180px">
          <el-option label="มีบัญชีแล้ว" value="linked" />
          <el-option label="ยังไม่มีบัญชี" value="unlinked" />
        </el-select>
      </div>

      <!-- Main Table -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <el-table :data="filteredRows" border stripe v-loading="loading" table-layout="auto" :header-cell-style="{ background: '#1d4ed8', color: 'white', fontWeight: '600' }">

          <!-- ชื่อ-นามสกุล -->
          <el-table-column label="ชื่อ-นามสกุล" min-width="200">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <div class="avatar-circle" :style="`background:${row.user ? getRoleColor(row.user.displayRole || row.user.role) : '#9ca3af'}`">
                  {{ avatarLetter(row) }}
                </div>
                <div>
                  <div class="font-medium text-gray-800">
                    {{ row.teacher.prefix || '' }}{{ row.teacher.name }} {{ row.teacher.surname }}
                  </div>
                  <div class="text-xs text-gray-400">รหัส: {{ row.teacher.teacher_id }}</div>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- ตำแหน่ง -->
          <el-table-column label="ตำแหน่ง" width="130">
            <template #default="{ row }">
              <span class="text-sm text-gray-600">{{ row.teacher.position || '—' }}</span>
            </template>
          </el-table-column>

          <!-- อีเมล -->
          <el-table-column label="อีเมล" min-width="200">
            <template #default="{ row }">
              <span v-if="row.user" class="text-sm text-gray-700">{{ row.user.email }}</span>
              <span v-else class="text-gray-300 text-sm">—</span>
            </template>
          </el-table-column>

          <!-- สิทธิ์ -->
          <el-table-column label="สิทธิ์" width="200" align="center">
            <template #default="{ row }">
              <template v-if="row.user">
                <el-select
                  v-model="row.user.displayRole"
                  size="small"
                  style="width:140px"
                  @change="val => changeRole(row, val)"
                  :loading="row._roleLoading"
                  :disabled="row.user?.displayRole === 'admin'"
                >
                  <el-option v-if="row.user?.displayRole === 'admin'" label="👑 Admin" value="admin" />
                  <el-option label="📅 Scheduler" value="scheduler" />
                  <el-option label="👨‍🏫 Teacher" value="teacher" />
                </el-select>
                <div v-if="row.user.displayRole === 'teacher'" class="mt-1 flex flex-col gap-0.5">
                  <el-checkbox
                    :model-value="hasExtraRole(row.user, 'subject_head')"
                    size="small"
                    @change="val => toggleExtraRole(row, 'subject_head', val)">
                    🏫 จัดสอนแทนกลุ่มสาระ
                  </el-checkbox>
                  <el-checkbox
                    :model-value="hasExtraRole(row.user, 'sub_coordinator')"
                    size="small"
                    @change="val => toggleExtraRole(row, 'sub_coordinator', val)">
                    🔄 จัดสอนแทนโรงเรียน
                  </el-checkbox>
                  <el-checkbox
                    :model-value="hasExtraRole(row.user, 'school_director')"
                    size="small"
                    @change="val => toggleExtraRole(row, 'school_director', val)">
                    👔 ผู้บริหาร (ดูรายงาน)
                  </el-checkbox>
                </div>
              </template>
              <span v-else class="text-gray-300 text-sm">—</span>
            </template>
          </el-table-column>

          <!-- สถานะ -->
          <el-table-column label="สถานะ" width="100" align="center">
            <template #default="{ row }">
              <el-switch
                v-if="row.user"
                v-model="row.user.is_active"
                :active-value="true"
                :inactive-value="false"
                :loading="row._activeLoading"
                @change="val => toggleActive(row, val)"
              />
              <span v-else class="text-gray-300 text-sm">—</span>
            </template>
          </el-table-column>

          <!-- บัญชี -->
          <el-table-column label="บัญชี" width="140" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.user" type="success" size="small" style="font-weight:600">
                ✅ มีบัญชีแล้ว
              </el-tag>
              <el-tag v-else type="info" size="small" effect="plain" style="color:#9ca3af;border-color:#d1d5db">
                ยังไม่มีบัญชี
              </el-tag>
            </template>
          </el-table-column>

          <!-- จัดการ -->
          <el-table-column label="จัดการ" width="170" align="center" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="!row.user"
                size="small"
                type="primary"
                @click="openCreateDialog(row.teacher)"
              >สร้างบัญชี</el-button>
              <el-button
                v-else
                size="small"
                type="warning"
                plain
                @click="openResetDialog(row)"
              >รีเซตรหัสผ่าน</el-button>
            </template>
          </el-table-column>

        </el-table>
      </el-card>

      <!-- Permission Reference -->
      <el-collapse class="mt-6 perm-collapse" v-model="permCollapseActive">
        <el-collapse-item name="1">
          <template #title>
            <span class="font-bold text-gray-700 text-sm">📋 ตารางสิทธิ์การใช้งาน</span>
          </template>
          <el-table :data="PERMISSION_TABLE" border size="small" class="mt-2" :header-cell-style="{ background: '#6d28d9', color: 'white', fontWeight: '600' }">
            <el-table-column prop="feature" label="ฟีเจอร์" min-width="180" />
            <el-table-column label="👑 Admin" width="110" align="center">
              <template #default="{ row }"><span class="text-base">{{ row.admin ? '✅' : '❌' }}</span></template>
            </el-table-column>
            <el-table-column label="📅 Scheduler" width="120" align="center">
              <template #default="{ row }"><span class="text-base">{{ row.scheduler ? '✅' : '❌' }}</span></template>
            </el-table-column>
            <el-table-column label="👨‍🏫 Teacher" width="110" align="center">
              <template #default="{ row }"><span class="text-base">{{ row.teacher ? '✅' : '❌' }}</span></template>
            </el-table-column>
          </el-table>
        </el-collapse-item>
      </el-collapse>

      <!-- Create Account Dialog -->
      <el-dialog v-model="createDialogVisible" title="➕ สร้างบัญชีผู้ใช้" width="480px" destroy-on-close :close-on-click-modal="false">
        <div v-if="createTarget" class="mb-4 p-3 rounded-lg" style="background:#f5f3ff;border:1px solid #ddd6fe">
          <div class="text-xs text-purple-500 font-semibold mb-1">สร้างบัญชีให้กับครู</div>
          <div class="font-bold text-gray-800">{{ createTarget.prefix || '' }}{{ createTarget.name }} {{ createTarget.surname }}</div>
          <div class="text-xs text-gray-500">รหัสครู: {{ createTarget.teacher_id }}</div>
        </div>
        <div v-else class="mb-4 p-3 rounded-lg" style="background:#faf5ff;border:1px solid #e9d5ff">
          <div class="text-xs text-purple-500 font-semibold">บัญชีผู้ดูแลระบบ (ไม่ผูกกับครู)</div>
        </div>
        <el-alert v-if="createTarget" type="success" :closable="false" class="mb-4">
          <template #default><span>สิทธิ์จะถูกกำหนดเป็น <strong>👨‍🏫 ครู (Teacher)</strong> โดยอัตโนมัติ</span></template>
        </el-alert>
        <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-position="top">
          <el-form-item label="อีเมล (ใช้ล็อกอิน)" prop="email">
            <el-input v-model="createForm.email" type="email" placeholder="teacher@school.ac.th">
              <template #prefix>✉️</template>
            </el-input>
          </el-form-item>
          <el-form-item label="รหัสผ่านเริ่มต้น" prop="password">
            <el-input v-model="createForm.password" :type="showPwd ? 'text' : 'password'" placeholder="อย่างน้อย 6 ตัวอักษร">
              <template #suffix>
                <span class="cursor-pointer text-gray-400 select-none" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁' }}</span>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item v-if="!createTarget" label="สิทธิ์การใช้งาน" prop="role">
            <el-select v-model="createForm.role" class="w-full">
              <el-option value="admin"><span style="color:#7c3aed;font-weight:600">👑 Admin</span></el-option>
              <el-option value="scheduler"><span style="color:#2563eb;font-weight:600">📅 Scheduler</span></el-option>
              <el-option value="teacher"><span style="color:#059669;font-weight:600">👨‍🏫 Teacher</span></el-option>
            </el-select>
          </el-form-item>
          <el-form-item v-if="!createTarget" label="ชื่อที่แสดง" prop="displayName">
            <el-input v-model="createForm.displayName" placeholder="เช่น นายสมชาย ใจดี" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="createDialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="creating" @click="handleCreate">สร้างบัญชี</el-button>
        </template>
      </el-dialog>

      <!-- Reset Password Dialog -->
      <el-dialog v-model="resetDialogVisible" title="🔑 รีเซตรหัสผ่าน" width="420px" destroy-on-close>
        <div v-if="resetTarget" class="mb-4 p-3 bg-gray-50 rounded-lg">
          <div class="font-medium text-gray-800">
            {{ resetTarget.teacher.prefix || '' }}{{ resetTarget.teacher.name }} {{ resetTarget.teacher.surname }}
          </div>
          <div class="text-sm text-gray-500 mt-0.5">{{ resetTarget.user?.email }}</div>
        </div>
        <el-alert type="warning" :closable="false">
          ระบบจะส่ง <strong>อีเมลรีเซ็ตรหัสผ่าน</strong> ไปยังอีเมลของผู้ใช้<br>
          ผู้ใช้จะได้รับลิงก์เพื่อตั้งรหัสผ่านใหม่ด้วยตนเอง
        </el-alert>
        <template #footer>
          <el-button @click="resetDialogVisible = false">ยกเลิก</el-button>
          <el-button type="warning" :loading="resetSending" @click="sendResetEmail">📧 ส่งอีเมลรีเซ็ตรหัสผ่าน</el-button>
        </template>
      </el-dialog>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { buildRolePayload, normalizeUserAccessRecord, toDisplayRole } from '@/utils/userRoles'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { getTeachers } = useSchoolDb()

const loading = ref(false)
const creating = ref(false)
const resetSending = ref(false)
const teachers = ref([])
const users = ref([])

const search = ref('')
const filterRole = ref('')
const filterAccount = ref('')
const permCollapseActive = ref([])

const createDialogVisible = ref(false)
const createTarget = ref(null)
const createFormRef = ref()
const showPwd = ref(false)

const resetDialogVisible = ref(false)
const resetTarget = ref(null)

const createForm = reactive({ email: '', password: '', role: 'teacher', displayName: '' })

const createRules = {
  email: [
    { required: true, message: 'กรุณากรอกอีเมล', trigger: 'blur' },
    { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'กรุณากรอกรหัสผ่าน', trigger: 'blur' },
    { min: 6, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', trigger: 'blur' },
  ],
  role: [{ required: true, message: 'กรุณาเลือกสิทธิ์', trigger: 'change' }],
  displayName: [{ required: true, message: 'กรุณากรอกชื่อที่แสดง', trigger: 'blur' }],
}

const PERMISSION_TABLE = [
  { feature: '⚙️ ตั้งค่าโรงเรียน',    admin: true,  scheduler: false, teacher: false },
  { feature: '📅 จัดตารางสอน',         admin: true,  scheduler: true,  teacher: false },
  { feature: '📝 บันทึกการสอน',        admin: true,  scheduler: false, teacher: true  },
  { feature: '📊 ดูรายงาน',            admin: true,  scheduler: true,  teacher: true  },
]

const ROLE_MAP = {
  school_admin: 'admin', admin: 'admin',
  school_scheduler: 'scheduler', scheduler: 'scheduler',
  school_teacher: 'teacher', teacher: 'teacher',
}

function normalizeDisplayRole(user) {
  if (user.displayRole) return user.displayRole
  const r = user.role || (Array.isArray(user.roles) ? user.roles[0] : '')
  return ROLE_MAP[r] || toDisplayRole(r) || 'teacher'
}

const userByTeacherId = computed(() => {
  const map = {}
  for (const u of users.value) {
    if (u.teacher_id) map[u.teacher_id] = u
  }
  return map
})

const rows = computed(() =>
  teachers.value.map(teacher => ({
    teacher,
    user: userByTeacherId.value[teacher.teacher_id] || null,
    _roleLoading: false,
    _activeLoading: false,
  }))
)

const filteredRows = computed(() => rows.value.filter(row => {
  const teacher = row.teacher
  const user = row.user
  if (search.value) {
    const q = search.value.toLowerCase()
    const name = `${teacher.prefix || ''}${teacher.name} ${teacher.surname}`.toLowerCase()
    const email = (user?.email || '').toLowerCase()
    if (!name.includes(q) && !email.includes(q)) return false
  }
  if (filterRole.value) {
    if (!user || normalizeDisplayRole(user) !== filterRole.value) return false
  }
  if (filterAccount.value === 'linked' && !user) return false
  if (filterAccount.value === 'unlinked' && user) return false
  return true
}))

const linkedCount = computed(() => rows.value.filter(r => r.user).length)
const adminCount = computed(() => users.value.filter(u => normalizeDisplayRole(u) === 'admin').length)
const schedulerCount = computed(() => users.value.filter(u => normalizeDisplayRole(u) === 'scheduler').length)

function getRoleColor(role) {
  return { admin: '#7c3aed', scheduler: '#2563eb', teacher: '#059669', superadmin: '#dc2626' }[ROLE_MAP[role] || role] || '#9ca3af'
}

function avatarLetter(row) {
  return (row.teacher.name || '').charAt(0).toUpperCase() || '?'
}

// Load data from Supabase
async function loadData() {
  loading.value = true
  try {
    const sid = authStore.schoolId
    const [teacherData, usersRes] = await Promise.all([
      getTeachers(),
      supabase.from('users').select('*').eq('school_id', sid),
    ])
    teachers.value = teacherData
    const normalized = (usersRes.data || []).map(u => {
      const rec = normalizeUserAccessRecord(u)
      return {
        ...rec,
        displayRole: normalizeDisplayRole(rec),
      }
    })
    users.value = normalized
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function openCreateDialog(teacher, defaultRole = 'scheduler') {
  createTarget.value = teacher || null
  Object.assign(createForm, {
    email: teacher?.email || '',
    password: '',
    role: teacher ? 'teacher' : defaultRole,
    displayName: '',
  })
  showPwd.value = false
  createDialogVisible.value = true
}

function openAddAdminDialog() { openCreateDialog(null, 'admin') }

function openResetDialog(row) {
  resetTarget.value = row
  resetDialogVisible.value = true
}

// Create account using Supabase Auth signUp
async function handleCreate() {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  creating.value = true
  try {
    const teacher = createTarget.value
    const sid = authStore.schoolId

    const displayName = teacher
      ? `${teacher.prefix || ''}${teacher.name} ${teacher.surname}`
      : createForm.displayName

    // Create auth user via Supabase
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: createForm.email,
      password: createForm.password,
      options: {
        data: {
          displayName,
          school_id: sid,
        }
      }
    })
    if (signUpError) throw signUpError

    const newUid = signUpData.user?.id
    if (!newUid) throw new Error('ไม่สามารถสร้างบัญชีได้')

    // Build role payload
    const rolePayload = buildRolePayload(teacher ? 'teacher' : createForm.role)

    // Write user record to users table
    const { error: upsertError } = await supabase.from('users').upsert({
      id: newUid,
      uid: newUid,
      email: createForm.email,
      display_name: displayName,
      displayName,
      school_id: sid,
      schoolId: sid,
      teacher_id: teacher?.teacher_id || null,
      teacherId: teacher?.teacher_id || null,
      is_active: true,
      isActive: true,
      created_at: new Date().toISOString(),
      created_by: authStore.profile?.uid || '',
      ...rolePayload,
    }, { onConflict: 'id' })
    if (upsertError) throw upsertError

    ElMessage.success(`สร้างบัญชี "${displayName}" เรียบร้อย`)
    createDialogVisible.value = false
    await loadData()
  } catch (e) {
    const msg = e.message?.includes('already registered') || e.message?.includes('already been registered')
      ? 'อีเมลนี้มีบัญชีอยู่แล้ว'
      : e.message
    ElMessage.error('สร้างบัญชีไม่สำเร็จ: ' + msg)
  } finally {
    creating.value = false
  }
}

// Change role inline
async function changeRole(row, newRole) {
  if (!row.user?.id && !row.user?.uid) return
  row._roleLoading = true
  try {
    const uid = row.user.id || row.user.uid
    const currentRoles = Array.isArray(row.user.roles) ? row.user.roles : []
    const extraRoles = currentRoles.filter(r => EXTRA_ROLES.includes(r))
    const rolePayload = buildRolePayload([newRole, ...extraRoles])

    const { error } = await supabase.from('users').update({
      ...rolePayload,
      updated_at: new Date().toISOString(),
    }).eq('id', uid)
    if (error) throw error

    const u = users.value.find(u => (u.id || u.uid) === uid)
    if (u) {
      Object.assign(u, normalizeUserAccessRecord({ ...u, ...rolePayload }))
      u.displayRole = newRole
    }
    ElMessage.success('อัปเดตสิทธิ์เรียบร้อย')
  } catch (e) {
    ElMessage.error('อัปเดตสิทธิ์ไม่สำเร็จ: ' + e.message)
    await loadData()
  } finally {
    row._roleLoading = false
  }
}

const EXTRA_ROLES = ['subject_head', 'sub_coordinator', 'school_director']

function hasExtraRole(user, roleName) {
  return Array.isArray(user?.roles) && user.roles.includes(roleName)
}

async function toggleExtraRole(row, roleName, checked) {
  if (!row.user?.id && !row.user?.uid) return
  try {
    const uid = row.user.id || row.user.uid
    const current = Array.isArray(row.user.roles) ? [...row.user.roles] : ['school_teacher']
    const base = current.filter(r => !EXTRA_ROLES.includes(r))
    if (!base.includes(row.user.role)) base.push(row.user.role || 'school_teacher')
    const newRoles = checked ? [...new Set([...base, roleName])] : base.filter(r => r !== roleName)
    const rolePayload = buildRolePayload(newRoles)
    const { error } = await supabase.from('users').update({
      ...rolePayload,
      updated_at: new Date().toISOString(),
    }).eq('id', uid)
    if (error) throw error
    Object.assign(row.user, normalizeUserAccessRecord({ ...row.user, ...rolePayload }))
    const labels = { subject_head: 'จัดสอนแทนกลุ่มสาระ', sub_coordinator: 'จัดสอนแทนโรงเรียน', school_director: 'ผู้บริหาร' }
    ElMessage.success((checked ? 'เพิ่ม' : 'ยกเลิก') + 'สิทธิ์ ' + (labels[roleName] || roleName))
  } catch (e) {
    ElMessage.error('อัปเดตสิทธิ์ไม่สำเร็จ: ' + e.message)
  }
}

async function toggleActive(row, newVal) {
  if (!row.user?.id && !row.user?.uid) return
  row._activeLoading = true
  try {
    const uid = row.user.id || row.user.uid
    const { error } = await supabase.from('users').update({
      is_active: newVal,
      isActive: newVal,
      updated_at: new Date().toISOString(),
    }).eq('id', uid)
    if (error) throw error
    const u = users.value.find(u => (u.id || u.uid) === uid)
    if (u) u.is_active = newVal
    ElMessage.success(newVal ? 'เปิดใช้งานบัญชีแล้ว' : 'ระงับบัญชีแล้ว')
  } catch (e) {
    if (row.user) row.user.is_active = !newVal
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    row._activeLoading = false
  }
}

async function sendResetEmail() {
  const email = resetTarget.value?.user?.email
  if (!email) return
  resetSending.value = true
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
    ElMessage.success(`ส่งอีเมลรีเซ็ตรหัสผ่านไปยัง ${email} แล้ว`)
    resetDialogVisible.value = false
  } catch (e) {
    ElMessage.error('ส่งอีเมลไม่สำเร็จ: ' + e.message)
  } finally {
    resetSending.value = false
  }
}
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 60%, #6d28d9 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(109, 40, 217, 0.30);
}
.stat-card {
  background: white;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.stat-value { font-size: 22px; font-weight: 700; color: #1f2937; line-height: 1.1; }
.stat-label { font-size: 12px; color: #6b7280; margin-top: 2px; }
.avatar-circle {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.perm-collapse :deep(.el-collapse-item__header) {
  padding: 14px 16px; font-size: 14px; background: white; border-radius: 12px;
}
.perm-collapse :deep(.el-collapse-item__wrap) {
  padding: 0 16px 16px; background: white;
}
</style>
