<template>
  <AppLayout>
    <div class="sig-page">

      <!-- Header -->
      <div class="sig-header mb-5">
        <div class="flex items-center gap-4">
          <div class="sig-header-icon">✍️</div>
          <div>
            <h1 class="text-2xl font-bold text-white">ตั้งค่าลายเซ็น</h1>
            <p class="text-white/75 text-sm mt-0.5">กำหนดผู้ลงนามแต่ละงาน — ใช้ร่วมกันทุกรายงานในงานนั้น</p>
          </div>
        </div>
      </div>

      <!-- Module cards -->
      <div class="space-y-4">
        <div v-for="mod in SIGNATURE_MODULES" :key="mod.key" class="mod-card">
          <!-- Module header -->
          <div class="mod-header" :style="`border-left: 4px solid ${modColor(mod.key)}`">
            <div class="flex items-center gap-2">
              <span class="mod-icon" :style="`background:${modColor(mod.key)}18;color:${modColor(mod.key)}`">{{ mod.icon }}</span>
              <span class="mod-label">{{ mod.label }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="signer-count">{{ (allSigs[mod.key]||[]).length }} คน</span>
              <button class="btn-add" :style="`background:${modColor(mod.key)}`" @click="addSigner(mod.key)">
                + เพิ่มผู้ลงนาม
              </button>
            </div>
          </div>

          <!-- Signer rows -->
          <div class="signer-list">
            <div v-if="!(allSigs[mod.key]||[]).length" class="empty-sig">
              ยังไม่มีผู้ลงนาม — กด "+ เพิ่มผู้ลงนาม"
            </div>
            <div v-for="(sig, idx) in (allSigs[mod.key]||[])" :key="idx" class="signer-row">
              <!-- ลำดับ -->
              <div class="signer-num" :style="`background:${modColor(mod.key)};color:white`">{{ idx+1 }}</div>

              <!-- ตำแหน่งที่แสดง (label) -->
              <div class="signer-field">
                <div class="field-label">ชื่อตำแหน่ง (แสดงใต้เส้น)</div>
                <el-input v-model="sig.label" size="small" placeholder="เช่น ครูที่ปรึกษา" />
              </div>

              <!-- ชื่อ -->
              <div class="signer-field">
                <div class="field-label">
                  ชื่อ-นามสกุล
                  <el-tooltip content="เว้นว่าง = ดึงอัตโนมัติจาก context (เช่น ชื่อครูแต่ละห้อง)" placement="top">
                    <span class="field-hint" style="cursor:help">(?)</span>
                  </el-tooltip>
                </div>
                <el-input v-model="sig.name" size="small" placeholder="เว้นว่าง = auto" />
              </div>

              <!-- ตำแหน่งงาน -->
              <div class="signer-field">
                <div class="field-label">ตำแหน่งงาน</div>
                <el-input v-model="sig.position" size="small" placeholder="เช่น ผู้อำนวยการโรงเรียน..." />
              </div>

              <!-- Auto from -->
              <div class="signer-field" style="max-width:160px">
                <div class="field-label">ดึงชื่อจาก</div>
                <el-select v-model="sig.auto_from" size="small" placeholder="— ตายตัว —">
                  <el-option label="— ตายตัว —"       value="" />
                  <el-option label="ครูผู้สอน"         value="teacher.name" />
                  <el-option label="ครูที่ปรึกษา"      value="class.advisor_name" />
                  <el-option label="ผู้อำนวยการ"       value="principal" />
                </el-select>
              </div>

              <!-- รูปลายเซ็น -->
              <div class="signer-field" style="max-width:120px">
                <div class="field-label">รูปลายเซ็น</div>
                <div class="sig-img-wrap">
                  <img v-if="sig.sig_img" :src="sig.sig_img" class="sig-img-preview" />
                  <div v-else class="sig-img-empty">ไม่มีรูป</div>
                  <label class="btn-upload" :style="`border-color:${modColor(mod.key)};color:${modColor(mod.key)}`">
                    📎 อัปโหลด
                    <input type="file" accept="image/*" style="display:none"
                      @change="onSigImgUpload($event, mod.key, idx)" />
                  </label>
                  <button v-if="sig.sig_img" class="btn-icon btn-del" style="margin-top:2px;width:100%"
                    @click="sig.sig_img = ''">ลบรูป</button>
                </div>
              </div>

              <!-- Actions -->
              <div class="signer-actions">
                <button class="btn-icon" :disabled="idx===0" @click="moveSig(mod.key, idx, -1)" title="ขึ้น">↑</button>
                <button class="btn-icon" :disabled="idx===(allSigs[mod.key]||[]).length-1" @click="moveSig(mod.key, idx, 1)" title="ลง">↓</button>
                <button class="btn-icon btn-del" @click="removeSig(mod.key, idx)" title="ลบ">✕</button>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div class="preview-area">
            <div class="preview-label">ตัวอย่างลายเซ็น:</div>
            <div v-html="previewSig(mod.key, mod.label)" class="preview-html"></div>
          </div>
        </div>
      </div>

      <!-- Save button -->
      <div class="save-bar">
        <el-button type="primary" size="large" :loading="saving" @click="saveAll"
          style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border:none;padding:0 40px;font-weight:700;font-size:15px;">
          💾 บันทึกการตั้งค่าลายเซ็นทั้งหมด
        </el-button>
        <span v-if="lastSaved" class="text-sm text-green-500 ml-3">✅ บันทึกแล้ว {{ lastSaved }}</span>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { SIGNATURE_MODULES, DEFAULT_SIGNATURES, useSignature } from '@/composables/useSignature'
import { useSchoolStore } from '@/stores/school'

const schoolStore = useSchoolStore()
const { saveAllSignatures, saving, buildSignatureHTML } = useSignature()
const lastSaved = ref('')

// deep clone signatures ทั้งหมดสำหรับ edit
const allSigs = reactive({})

onMounted(() => {
  SIGNATURE_MODULES.forEach(mod => {
    const saved = schoolStore.schoolInfo?.signatures?.[mod.key]
    allSigs[mod.key] = JSON.parse(JSON.stringify(
      (saved && saved.length) ? saved : (DEFAULT_SIGNATURES[mod.key] || [])
    ))
  })
})

const MODULE_COLORS = {
  timetable:    '#4f46e5',
  teaching_log: '#0891b2',
  behavior:     '#d97706',
  attendance:   '#059669',
}
function modColor(key) { return MODULE_COLORS[key] || '#6b7280' }

function addSigner(moduleKey) {
  if (!allSigs[moduleKey]) allSigs[moduleKey] = []
  allSigs[moduleKey].push({ role: `sig_${Date.now()}`, label: 'ผู้ลงนาม', name: '', position: '', auto_from: '' })
}

function removeSig(moduleKey, idx) {
  allSigs[moduleKey].splice(idx, 1)
}

function moveSig(moduleKey, idx, dir) {
  const arr = allSigs[moduleKey]
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= arr.length) return
  const tmp = arr[idx]; arr[idx] = arr[newIdx]; arr[newIdx] = tmp
}

// อัปโหลดรูปลายเซ็น — แปลงเป็น base64 เก็บใน sig.sig_img
function onSigImgUpload(event, moduleKey, idx) {
  const file = event.target.files?.[0]
  if (!file) return
  if (file.size > 500 * 1024) {
    ElMessage.warning('รูปขนาดใหญ่เกินไป (สูงสุด 500KB) — ลดขนาดรูปก่อนอัปโหลด')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    allSigs[moduleKey][idx].sig_img = e.target.result
  }
  reader.readAsDataURL(file)
}

function previewSig(moduleKey) {
  const sigs = allSigs[moduleKey] || []
  const color = modColor(moduleKey)

  const cols = sigs.map((sig) => {
    const name = sig.name || (sig.auto_from ? `(auto: ${sig.auto_from})` : '...................................')
    const imgHtml = sig.sig_img
      ? `<img src="${sig.sig_img}" style="height:28px;max-width:80px;object-fit:contain;display:block;margin:0 auto 2px;">`
      : `<div style="border-bottom:1.5px solid #9ca3af;height:28px;margin-bottom:3px;"></div>`
    return `<td style="text-align:center;padding:0 8px;vertical-align:bottom;">
      ${imgHtml}
      <div style="font-size:8pt;font-weight:600;color:#1f2937;line-height:1.8;">(${name})</div>
      <div style="font-size:8pt;font-weight:700;color:${color};line-height:1.6;">${sig.label}</div>
      ${sig.position ? `<div style="font-size:7.5pt;color:#6b7280;line-height:1.6;">${sig.position}</div>` : ''}
    </td>`
  }).join('<td style="width:12px;"></td>')

  if (!cols) return '<div style="color:#9ca3af;font-size:12px;padding:8px;">ยังไม่มีผู้ลงนาม</div>'

  return `<table style="border:none;border-collapse:collapse;margin:0 auto;max-width:600px;">
    <tr style="vertical-align:bottom;">${cols}</tr>
  </table>`
}

async function saveAll() {
  try {
    await saveAllSignatures(JSON.parse(JSON.stringify(allSigs)))
    const now = new Date().toLocaleTimeString('th-TH')
    lastSaved.value = `เวลา ${now} น.`
    ElMessage.success('บันทึกการตั้งค่าลายเซ็นเรียบร้อย')
  } catch (e) {
    console.error(e)
    ElMessage.error('บันทึกไม่สำเร็จ')
  }
}
</script>

<style scoped>
.sig-page { padding: 24px; min-height: 100vh; background: #f1f5f9; }

.sig-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 50%, #4f46e5 100%);
  border-radius: 16px; padding: 22px 28px;
  box-shadow: 0 8px 32px rgba(29,78,216,0.25);
}
.sig-header-icon {
  font-size: 2rem; background: rgba(255,255,255,0.2);
  border-radius: 12px; padding: 8px 12px;
}

.mod-card {
  background: white; border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07); overflow: hidden;
}
.mod-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; background: #f9fafb; border-bottom: 1px solid #f1f5f9;
}
.mod-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.mod-label { font-size: 15px; font-weight: 700; color: #1f2937; }
.signer-count { font-size: 12px; color: #9ca3af; }
.btn-add {
  padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
  color: white; border: none; cursor: pointer;
  transition: opacity 0.15s;
}
.btn-add:hover { opacity: 0.85; }

.signer-list { padding: 12px 16px; }
.empty-sig {
  text-align: center; padding: 16px; color: #9ca3af; font-size: 13px;
  border: 1.5px dashed #e5e7eb; border-radius: 8px;
}
.signer-row {
  display: flex; align-items: flex-end; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid #f1f5f9;
}
.signer-row:last-child { border-bottom: none; }
.signer-num {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0; margin-bottom: 2px;
}
.signer-field { flex: 1; min-width: 100px; }
.field-label { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
.field-hint { color: #94a3b8; font-size: 10px; }

.sig-img-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.sig-img-preview {
  height: 36px; max-width: 100px; object-fit: contain;
  border: 1px solid #e5e7eb; border-radius: 4px; background: #f9fafb;
}
.sig-img-empty {
  height: 36px; width: 100%; border: 1.5px dashed #d1d5db;
  border-radius: 4px; display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: #9ca3af;
}
.btn-upload {
  font-size: 11px; font-weight: 600; padding: 3px 8px;
  border: 1.5px solid; border-radius: 6px;
  cursor: pointer; background: white; transition: opacity 0.15s;
  text-align: center; white-space: nowrap;
}
.btn-upload:hover { opacity: 0.75; }

.signer-actions {
  display: flex; gap: 4px; align-items: center; flex-shrink: 0; margin-bottom: 2px;
}
.btn-icon {
  width: 26px; height: 26px; border-radius: 6px; border: 1px solid #e5e7eb;
  background: white; cursor: pointer; font-size: 11px; color: #6b7280;
  transition: all 0.15s; display: flex; align-items: center; justify-content: center;
}
.btn-icon:hover:not(:disabled) { background: #f1f5f9; }
.btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
.btn-del { color: #ef4444; border-color: #fca5a5; }
.btn-del:hover { background: #fef2f2; }

.preview-area {
  background: #f8fafc; border-top: 1px solid #f1f5f9;
  padding: 12px 20px;
}
.preview-label { font-size: 11px; color: #9ca3af; font-weight: 600; margin-bottom: 8px; }
.preview-html { overflow-x: auto; }

.save-bar {
  position: sticky; bottom: 16px; z-index: 10;
  background: white; border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  padding: 14px 20px; margin-top: 20px;
  display: flex; align-items: center;
}
</style>
