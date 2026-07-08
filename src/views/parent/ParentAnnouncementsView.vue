<template>
  <div class="pa-page">
    <div class="pa-header">
      <button class="pa-back" @click="$router.back()">‹ กลับ</button>
      <h2 class="pa-title">📣 ประกาศประชาสัมพันธ์</h2>
    </div>

    <div v-if="loading" class="pa-loading">กำลังโหลด...</div>
    <div v-else-if="!list.length" class="pa-empty">ยังไม่มีประกาศ</div>
    <div v-else class="pa-list">
      <div v-for="a in list" :key="a.id" class="pa-card" :class="`pa-card--${a.type}`">
        <div class="pa-card-top">
          <span class="pa-chip" :class="`pa-chip--${a.type}`">
            {{ a.type === 'urgent' ? '⚠️ ด่วน' : a.type === 'reminder' ? '🔔 แจ้งเตือน' : 'ℹ️ ประกาศ' }}
          </span>
          <span class="pa-date">{{ fmtDate(a.created_at) }}</span>
        </div>
        <div v-if="a.title" class="pa-card-title">{{ a.title }}</div>
        <div class="pa-card-body">{{ a.content }}</div>
        <div v-if="a.image_urls && a.image_urls.length" class="pa-images">
          <img v-for="(url,i) in a.image_urls" :key="i" :src="url" class="pa-img"
            @click="lightbox=url" @error="e=>e.target.style.display='none'" />
        </div>
        <div class="pa-card-author">{{ a.author_name || 'ผู้บริหาร' }}</div>
      </div>
    </div>
  </div>
  <div v-if="lightbox" class="pa-lightbox" @click="lightbox=''">
    <img :src="lightbox" class="pa-lightbox-img" @click.stop />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useParentStore } from '@/stores/parent'

const parentStore = useParentStore()
const list    = ref([])
const loading = ref(false)
const lightbox = ref('')

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  const schoolId = parentStore.schoolId
  if (!schoolId) return
  loading.value = true
  try {
    const { data } = await supabase.rpc('get_school_announcements_public', {
      p_school_id: String(schoolId),
      p_target:    'parent',
    })
    list.value = Array.isArray(data) ? data : (data ? [data] : [])
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.pa-page   { padding: 16px; max-width: 600px; margin: 0 auto; }
.pa-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.pa-back   { background: none; border: none; font-size: 22px; color: #6d28d9; cursor: pointer; padding: 0; }
.pa-title  { font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0; }
.pa-loading { text-align: center; color: #9ca3af; padding: 40px; }
.pa-empty   { text-align: center; color: #9ca3af; padding: 60px 20px; }
.pa-list { display: flex; flex-direction: column; gap: 12px; }
.pa-card { background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,.07); }
.pa-card--urgent   { border-top: 3px solid #ef4444; }
.pa-card--reminder { border-top: 3px solid #f97316; }
.pa-card--info     { border-top: 3px solid #3b82f6; }
.pa-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.pa-chip { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
.pa-chip--urgent   { background: #fef2f2; color: #b91c1c; }
.pa-chip--reminder { background: #fff7ed; color: #c2410c; }
.pa-chip--info     { background: #eff6ff; color: #1d4ed8; }
.pa-date { font-size: 11px; color: #9ca3af; }
.pa-card-title { font-size: 15px; font-weight: 800; color: #1e1b4b; margin-bottom: 6px; }
.pa-card-body  { font-size: 13px; color: #374151; line-height: 1.65; white-space: pre-wrap; margin-bottom: 8px; }
.pa-images { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.pa-img { width: 100%; max-height: 320px; object-fit: contain; border-radius: 12px; cursor: pointer; background: #f9fafb; display: block; }
.pa-card-author { font-size: 11px; color: #9ca3af; }
.pa-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,.88); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.pa-lightbox-img { max-width: 92vw; max-height: 88vh; object-fit: contain; border-radius: 8px; cursor: default; }
</style>
