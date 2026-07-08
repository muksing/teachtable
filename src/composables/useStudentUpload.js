import { supabase } from '@/supabase/client'

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function resizeImage(file, maxSide = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      let w = width, h = height
      if (width > maxSide || height > maxSide) {
        if (width >= height) { w = maxSide; h = Math.round(height * maxSide / width) }
        else                  { h = maxSide; w = Math.round(width  * maxSide / height) }
      }
      if (w === width && h === height) { resolve(file); return }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return }
        resolve(new File([blob], file.name, { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('โหลดภาพไม่สำเร็จ')) }
    img.src = url
  })
}

async function loadGasSettings(schoolId) {
  const { data, error } = await supabase
    .from('schools')
    .select('settings')
    .eq('id', schoolId)
    .single()
  if (error || !data) throw new Error('ไม่พบการตั้งค่าโรงเรียน')
  const tl = data.settings?.teaching_log_settings || {}
  const gasUrl   = (tl.gas_upload_web_app_url || tl.gas_web_app_url || '').trim()
  const folderId = (tl.gdrive_folder_id || '').trim()
  if (!gasUrl)   throw new Error('ยังไม่ได้ตั้งค่า GAS Upload URL ในหน้าตั้งค่าบันทึกเข้าสอน')
  if (!folderId) throw new Error('ยังไม่ได้ตั้งค่า Google Drive Folder ID ในหน้าตั้งค่าบันทึกเข้าสอน')
  return { gasUrl, folderId }
}

async function uploadViaGAS(file, schoolId, folder = 'student', customFileName = null) {
  const { gasUrl, folderId } = await loadGasSettings(schoolId)
  const resized = await resizeImage(file)
  const dataUrl = await toBase64(resized)
  const base64Data = dataUrl.split(',')[1]
  const ext = file.name.split('.').pop().toLowerCase() || 'jpg'
  const fileName = customFileName || `${folder}_${Date.now()}.${ext}`
  const mimeType = file.type || 'image/jpeg'

  const res = await fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ route: 'upload-student-photo', folderId, fileName, mimeType, base64Data }),
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error('GAS ตอบกลับผิดรูปแบบ') }
  if (!data.url) throw new Error(data.error || 'อัปโหลดไม่สำเร็จ')
  return data.url
}

export function fixPhotoUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  let id = ''
  let match = url.match(/[?&]id=([\w-]{20,})/)
  if (match) id = match[1]
  if (!id) {
    match = url.match(/\/d\/([\w-]{20,})/)
    if (match) id = match[1]
  }
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`
  return url
}

export { uploadViaGAS }

export function useStudentUpload() {
  async function uploadFile(file, schoolId, studentCode, folder = 'photos') {
    return uploadViaGAS(file, schoolId, `${folder}_${studentCode}`)
  }
  return { uploadFile, fixPhotoUrl }
}
