import { supabase } from './client'

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'public'

export function getStorage() {
  return { bucket: BUCKET }
}

export function ref(storage, path) {
  return {
    bucket: storage?.bucket || BUCKET,
    path: String(path || '').replace(/^\/+/, ''),
  }
}

export async function uploadString(storageRef, data, _format = 'raw', options = {}) {
  const contentType = options.contentType || 'text/plain'
  const body = typeof data === 'string' ? new Blob([data], { type: contentType }) : data
  const { error } = await supabase.storage
    .from(storageRef.bucket)
    .upload(storageRef.path, body, { contentType, upsert: true })
  if (error) throw error
  return { ref: storageRef }
}

export async function getDownloadURL(storageRef) {
  const { data } = supabase.storage.from(storageRef.bucket).getPublicUrl(storageRef.path)
  return data.publicUrl
}
