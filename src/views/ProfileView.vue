<template>
  <AppLayout>
    <div class="max-w-2xl mx-auto p-6 space-y-6">

      <!-- Header Card -->
      <div class="rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white px-6 py-5 shadow-md">
        <h1 class="text-2xl font-bold tracking-wide">👤 ข้อมูลส่วนตัว</h1>
        <p class="text-purple-200 text-sm mt-1">จัดการโปรไฟล์และความปลอดภัยของบัญชีคุณ</p>
      </div>

      <!-- Section 1: Profile Picture -->
      <el-card shadow="hover">
        <template #header>
          <span class="font-semibold text-gray-700">รูปโปรไฟล์</span>
        </template>

        <div class="flex flex-col items-center gap-4">
          <!-- Avatar circle -->
          <div
            class="w-20 h-20 rounded-full overflow-hidden border-4 border-purple-200 shadow flex items-center justify-center bg-purple-100 select-none"
          >
            <img
              v-if="avatarSrc"
              :src="avatarSrc"
              alt="profile"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-3xl font-bold text-purple-500">
              {{ initialLetter }}
            </span>
          </div>

          <!-- Name + email read-only -->
          <div class="text-center">
            <p class="font-semibold text-gray-800">{{ form.displayName || authStore.profile?.displayName || '—' }}</p>
            <p class="text-sm text-gray-400">{{ authStore.profile?.email }}</p>
          </div>

          <!-- Hidden file input -->
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileSelected"
          />

          <div class="flex gap-3">
            <el-button @click="fileInputRef.click()">📷 เปลี่ยนรูป</el-button>
            <el-button
              v-if="pendingPhotoBase64"
              type="primary"
              :loading="savingPhoto"
              @click="savePhoto"
            >
              บันทึกรูป
            </el-button>
          </div>

          <p v-if="pendingPhotoBase64" class="text-xs text-green-600">
            เลือกรูปแล้ว — กด "บันทึกรูป" เพื่อยืนยัน
          </p>
        </div>
      </el-card>

      <!-- Section 2: Personal Info -->
      <el-card shadow="hover">
        <template #header>
          <span class="font-semibold text-gray-700">ข้อมูลส่วนตัว</span>
        </template>

        <el-form
          ref="infoFormRef"
          :model="form"
          label-position="top"
          class="space-y-1"
        >
          <el-form-item
            label="ชื่อ-นามสกุล"
            prop="displayName"
            :rules="[{ required: true, message: 'กรุณากรอกชื่อ', trigger: 'blur' }]"
          >
            <el-input
              v-model="form.displayName"
              placeholder="ชื่อ-นามสกุล"
              clearable
            />
          </el-form-item>

          <el-form-item label="เบอร์โทรศัพท์" prop="phone">
            <el-input
              v-model="form.phone"
              placeholder="08x-xxx-xxxx"
              clearable
              maxlength="20"
            />
          </el-form-item>

          <div class="pt-2">
            <el-button
              type="primary"
              :loading="savingInfo"
              @click="saveInfo"
            >
              บันทึกข้อมูล
            </el-button>
          </div>
        </el-form>
      </el-card>

      <!-- Section 3: Change Password -->
      <el-card shadow="hover">
        <template #header>
          <span class="font-semibold text-gray-700">เปลี่ยนรหัสผ่าน</span>
        </template>

        <el-form
          ref="pwdFormRef"
          :model="pwdForm"
          label-position="top"
          class="space-y-1"
        >
          <el-form-item
            label="รหัสผ่านปัจจุบัน"
            prop="currentPwd"
            :rules="[{ required: true, message: 'กรุณากรอกรหัสผ่านปัจจุบัน', trigger: 'blur' }]"
          >
            <el-input
              v-model="pwdForm.currentPwd"
              type="password"
              show-password
              placeholder="รหัสผ่านปัจจุบัน"
              autocomplete="current-password"
            />
          </el-form-item>

          <el-form-item
            label="รหัสผ่านใหม่"
            prop="newPwd"
            :rules="[
              { required: true, message: 'กรุณากรอกรหัสผ่านใหม่', trigger: 'blur' },
              { min: 6, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', trigger: 'blur' }
            ]"
          >
            <el-input
              v-model="pwdForm.newPwd"
              type="password"
              show-password
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
              autocomplete="new-password"
            />
          </el-form-item>

          <el-form-item
            label="ยืนยันรหัสผ่านใหม่"
            prop="confirmPwd"
            :rules="[
              { required: true, message: 'กรุณายืนยันรหัสผ่าน', trigger: 'blur' },
              { validator: validateConfirmPwd, trigger: 'blur' }
            ]"
          >
            <el-input
              v-model="pwdForm.confirmPwd"
              type="password"
              show-password
              placeholder="ยืนยันรหัสผ่านใหม่"
              autocomplete="new-password"
            />
          </el-form-item>

          <div class="pt-2">
            <el-button
              type="warning"
              :loading="changingPwd"
              @click="changePassword"
            >
              🔑 เปลี่ยนรหัสผ่าน
            </el-button>
          </div>
        </el-form>
      </el-card>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getSchoolDb, auth } from '@/firebase/db'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { useAuthStore } from '@/stores/auth'

// ─── Store ────────────────────────────────────────────────────────────────────
const authStore = useAuthStore()

// ─── Refs ─────────────────────────────────────────────────────────────────────
const fileInputRef    = ref(null)
const infoFormRef     = ref(null)
const pwdFormRef      = ref(null)

const savingPhoto     = ref(false)
const savingInfo      = ref(false)
const changingPwd     = ref(false)

const pendingPhotoBase64 = ref(null)   // base64 waiting to be saved

// Personal info form
const form = ref({
  displayName: '',
  phone: ''
})

// Password form
const pwdForm = ref({
  currentPwd: '',
  newPwd: '',
  confirmPwd: ''
})

// ─── Computed ─────────────────────────────────────────────────────────────────
// Show pending preview first, then saved photo_url, then nothing
const avatarSrc = computed(() => {
  if (pendingPhotoBase64.value) return pendingPhotoBase64.value
  return authStore.profile?.photo_url || null
})

const initialLetter = computed(() => {
  const name = authStore.profile?.displayName || authStore.profile?.email || '?'
  return name.charAt(0).toUpperCase()
})

// ─── Canvas compression helper ────────────────────────────────────────────────
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

// ─── File select → compress → preview ────────────────────────────────────────
async function onFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  // Reset input so re-selecting the same file triggers change
  event.target.value = ''

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
    return
  }

  try {
    const base64 = await compressToBase64(file)
    pendingPhotoBase64.value = base64
  } catch (err) {
    ElMessage.error('ไม่สามารถโหลดรูปภาพได้: ' + err.message)
  }
}

// ─── Save photo to Firestore ──────────────────────────────────────────────────
async function savePhoto() {
  if (!pendingPhotoBase64.value) return

  const uid = authStore.profile?.uid
  if (!uid) { ElMessage.error('ไม่พบ uid ของผู้ใช้'); return }

  savingPhoto.value = true
  try {
    const db = getSchoolDb()
    await updateDoc(doc(db, 'users', uid), {
      photo_url: pendingPhotoBase64.value,
      updated_at: serverTimestamp()
    })

    // Update store so navbar / avatar updates immediately
    authStore.setProfile({ ...authStore.profile, photo_url: pendingPhotoBase64.value })

    pendingPhotoBase64.value = null
    ElMessage.success('บันทึกรูปโปรไฟล์สำเร็จ')
  } catch (err) {
    ElMessage.error('บันทึกรูปไม่สำเร็จ: ' + err.message)
  } finally {
    savingPhoto.value = false
  }
}

// ─── Save personal info ───────────────────────────────────────────────────────
async function saveInfo() {
  const valid = await infoFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const uid = authStore.profile?.uid
  if (!uid) { ElMessage.error('ไม่พบ uid ของผู้ใช้'); return }

  savingInfo.value = true
  try {
    const db = getSchoolDb()
    await updateDoc(doc(db, 'users', uid), {
      displayName: form.value.displayName.trim(),
      phone:       form.value.phone.trim(),
      updated_at:  serverTimestamp()
    })

    // Update store so navbar display name refreshes immediately
    authStore.setProfile({
      ...authStore.profile,
      displayName: form.value.displayName.trim(),
      phone:       form.value.phone.trim()
    })

    ElMessage.success('บันทึกข้อมูลสำเร็จ')
  } catch (err) {
    ElMessage.error('บันทึกข้อมูลไม่สำเร็จ: ' + err.message)
  } finally {
    savingInfo.value = false
  }
}

// ─── Password validation ──────────────────────────────────────────────────────
function validateConfirmPwd(_rule, value, callback) {
  if (value !== pwdForm.value.newPwd) {
    callback(new Error('รหัสผ่านใหม่ไม่ตรงกัน'))
  } else {
    callback()
  }
}

// ─── Change password ──────────────────────────────────────────────────────────
async function changePassword() {
  const valid = await pwdFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const user = auth.currentUser
  if (!user) { ElMessage.error('ไม่พบผู้ใช้ที่ล็อกอินอยู่'); return }

  changingPwd.value = true
  try {
    // Reauthenticate first
    const credential = EmailAuthProvider.credential(user.email, pwdForm.value.currentPwd)
    await reauthenticateWithCredential(user, credential)

    // Update password
    await updatePassword(user, pwdForm.value.newPwd)

    // Clear all password fields
    pwdForm.value.currentPwd  = ''
    pwdForm.value.newPwd      = ''
    pwdForm.value.confirmPwd  = ''
    pwdFormRef.value?.clearValidate()

    ElMessage.success('เปลี่ยนรหัสผ่านสำเร็จ')
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      ElMessage.error('รหัสผ่านปัจจุบันไม่ถูกต้อง')
    } else if (err.code === 'auth/too-many-requests') {
      ElMessage.error('พยายามล็อกอินหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง')
    } else {
      ElMessage.error('เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + err.message)
    }
  } finally {
    changingPwd.value = false
  }
}

// ─── Load from Firestore on mount ─────────────────────────────────────────────
onMounted(async () => {
  const uid = authStore.profile?.uid
  if (!uid) return

  try {
    const db   = getSchoolDb()
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      const data = snap.data()

      // Pre-fill form fields
      form.value.displayName = data.displayName ?? authStore.profile?.displayName ?? ''
      form.value.phone       = data.phone ?? ''

      // Sync any Firestore-only fields back into store (photo_url, phone)
      authStore.setProfile({
        ...authStore.profile,
        displayName: data.displayName ?? authStore.profile?.displayName,
        phone:       data.phone ?? '',
        photo_url:   data.photo_url ?? authStore.profile?.photo_url ?? null
      })
    } else {
      // Firestore doc might not exist yet — fall back to store values
      form.value.displayName = authStore.profile?.displayName ?? ''
      form.value.phone       = authStore.profile?.phone ?? ''
    }
  } catch (err) {
    ElMessage.error('โหลดข้อมูลโปรไฟล์ไม่สำเร็จ: ' + err.message)
    // Still fill from store as fallback
    form.value.displayName = authStore.profile?.displayName ?? ''
    form.value.phone       = authStore.profile?.phone ?? ''
  }
})
</script>
