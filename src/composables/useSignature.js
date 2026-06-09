// src/composables/useSignature.js
// โมดูลลายเซ็น — ตั้งค่าแยกตามงาน ใช้ร่วมกันทุก report
import { ref } from 'vue'
import { doc, setDoc } from '@/supabase/firestore'
import { getSchoolDb } from '@/supabase/db'
import { useSchoolStore } from '@/stores/school'

// ===== นิยาม module ทั้งหมดในระบบ =====
export const SIGNATURE_MODULES = [
  { key: 'timetable',    label: '📅 ตารางสอน',         icon: '📅' },
  { key: 'teaching_log', label: '📝 บันทึกการสอน',      icon: '📝' },
  { key: 'behavior',     label: '⭐ พฤติกรรมนักเรียน',  icon: '⭐' },
  { key: 'attendance',   label: '✅ การมาเรียน',         icon: '✅' },
]

// ค่า default เมื่อยังไม่ได้ตั้งค่า
export const DEFAULT_SIGNATURES = {
  timetable: [
    { role: 'principal', label: 'ผู้อำนวยการ', name: '', position: 'ผู้อำนวยการโรงเรียน', auto_from: '' },
  ],
  teaching_log: [
    { role: 'teacher',   label: 'ครูผู้สอน',    name: '', position: '',                  auto_from: 'teacher.name' },
    { role: 'principal', label: 'ผู้อำนวยการ',  name: '', position: 'ผู้อำนวยการโรงเรียน', auto_from: '' },
  ],
  behavior: [
    { role: 'teacher',   label: 'ครูผู้รายงาน', name: '', position: '',                  auto_from: 'teacher.name' },
    { role: 'principal', label: 'ผู้อำนวยการ',  name: '', position: 'ผู้อำนวยการโรงเรียน', auto_from: '' },
  ],
  attendance: [
    { role: 'teacher',   label: 'ครูผู้รายงาน', name: '', position: '',                  auto_from: 'teacher.name' },
    { role: 'principal', label: 'ผู้อำนวยการ',  name: '', position: 'ผู้อำนวยการโรงเรียน', auto_from: '' },
  ],
}

// ===== Composable =====
export function useSignature() {
  const schoolStore = useSchoolStore()
  const saving = ref(false)

  // ดึง signatures ของ module นั้น (fallback ไป default)
  function getModuleSignatures(moduleKey) {
    const saved = schoolStore.schoolInfo?.signatures?.[moduleKey]
    if (saved && Array.isArray(saved) && saved.length) return saved
    return DEFAULT_SIGNATURES[moduleKey] || [
      { role: 'principal', label: 'ผู้อำนวยการ', name: '', position: 'ผู้อำนวยการโรงเรียน', auto_from: '' },
    ]
  }

  // บันทึก signatures ทั้งหมดลง Firestore
  async function saveAllSignatures(allSigs) {
    saving.value = true
    try {
      const db = getSchoolDb()
      await setDoc(doc(db, 'school_info', 'main'), {
        signatures: allSigs,
      }, { merge: true })
      // อัพเดท store ด้วย
      if (schoolStore.schoolInfo) {
        schoolStore.schoolInfo.signatures = allSigs
      }
    } finally {
      saving.value = false
    }
  }

  /**
   * สร้าง HTML block ลายเซ็น
   * @param {string}  moduleKey    - key ของ module เช่น 'timetable'
   * @param {object}  dynamicVals  - { advisor: 'นางสาวมาลี', teacher: 'นายสมศักดิ์' }
   * @param {boolean} showLine     - แสดงเส้นขีดใต้ช่องลงนาม
   * @param {string}  color        - สีหลัก
   * @param {boolean} showImg      - แสดงภาพลายเซ็น (false = ซ่อนภาพแต่ยังแสดงเส้น+ชื่อ+ตำแหน่ง)
   */
  function buildSignatureHTML(moduleKey, dynamicVals = {}, showLine = true, color = '#4f46e5', showImg = true) {
    const sigs = getModuleSignatures(moduleKey)

    const cols = sigs.map(sig => {
      // resolve ชื่อ: dynamic > static > เว้นว่าง
      let name = sig.name || ''
      if (!name && sig.auto_from) {
        const path = sig.auto_from.split('.')
        const ctx = dynamicVals[path[0]]
        if (ctx && path[1]) name = ctx[path[1]] || dynamicVals[sig.role] || ''
        else name = dynamicVals[sig.role] || dynamicVals[sig.auto_from] || ''
      }
      if (!name) name = dynamicVals[sig.role] || ''

      // ส่วนบน: ภาพลายเซ็น (ถ้ามีและเปิด) หรือเส้น หรือช่องว่าง
      let lineHTML = ''
      if (sig.sig_img && showImg) {
        // แสดงภาพเต็มขนาด ไม่บีบ — ผู้ใช้ควรอัพโหลดภาพขนาดที่เหมาะสม (~120×50px)
        lineHTML = `<img src="${sig.sig_img}" style="max-width:100%;max-height:56px;object-fit:contain;display:block;margin:0 auto 2px;">`
      } else if (showLine) {
        // เส้นให้ลงนาม
        lineHTML = `<div style="border-bottom:1.5px solid #9ca3af;height:36px;margin-bottom:3px;"></div>`
      } else {
        // ไม่มีภาพ ไม่มีเส้น — เว้นช่องไว้ให้ลงนามด้วยมือ
        lineHTML = `<div style="height:36px;"></div>`
      }

      return `
        <td style="text-align:center;padding:0 8px;vertical-align:bottom;">
          ${lineHTML}
          <div style="font-size:8pt;font-weight:600;color:#1f2937;line-height:1.8;min-height:14px;">
            ${name ? `(${name})` : '&nbsp;'}
          </div>
          <div style="font-size:8pt;font-weight:700;color:${color};line-height:1.6;">${sig.label}</div>
          ${sig.position ? `<div style="font-size:7.5pt;color:#6b7280;line-height:1.6;">${sig.position}</div>` : ''}
        </td>`
    }).join('<td style="width:16px;"></td>')

    return `<table style="width:100%;border:none;border-collapse:collapse;margin-top:16px;">
      <tr style="vertical-align:bottom;">${cols}</tr>
    </table>`
  }

  return { getModuleSignatures, saveAllSignatures, saving, buildSignatureHTML }
}
