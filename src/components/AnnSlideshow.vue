<template>
  <div v-if="items.length" class="ass-wrap">
    <!-- Header row -->
    <div class="ass-header">
      <span class="ass-title">
        📣 <slot name="title">ประกาศประชาสัมพันธ์</slot>
      </span>
      <span class="ass-counter">{{ current + 1 }} / {{ items.length }}</span>
    </div>

    <!-- Slide viewport -->
    <div
      class="ass-viewport"
      @mouseenter="pause"
      @mouseleave="resume"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- Cards (absolute stack, only current visible) -->
      <transition :name="slideDir === 'left' ? 'slide-left' : 'slide-right'" mode="out-in">
        <div :key="current" class="ass-card" :class="cardClass(items[current])">
          <!-- Type chip + new badge + meta -->
          <div class="ass-card-top">
            <span class="ass-chip" :class="`ass-chip--${items[current].type}`">
              {{ typeLabel(items[current].type) }}
            </span>
            <span v-if="isNew(items[current])" class="ass-new-dot">● ใหม่</span>
            <span class="ass-meta">{{ items[current].author_name || 'ผู้บริหาร' }} · {{ fmtDate(items[current].created_at) }}</span>
          </div>

          <!-- Title -->
          <div v-if="items[current].title" class="ass-card-title">{{ items[current].title }}</div>

          <!-- Body -->
          <div class="ass-card-body">{{ items[current].content }}</div>

          <!-- Images -->
          <div v-if="items[current].image_urls && items[current].image_urls.length" class="ass-images">
            <img
              v-for="(url, i) in items[current].image_urls" :key="i"
              :src="url"
              class="ass-img"
              @click.stop="lightbox = url"
              @error="e => e.target.style.display='none'"
            />
          </div>
        </div>
      </transition>

      <!-- Prev / Next arrows -->
      <button v-if="items.length > 1" class="ass-arrow ass-arrow--prev" @click="prev">‹</button>
      <button v-if="items.length > 1" class="ass-arrow ass-arrow--next" @click="next">›</button>
    </div>

    <!-- Dots -->
    <div v-if="items.length > 1" class="ass-dots">
      <button
        v-for="(_, i) in items" :key="i"
        class="ass-dot"
        :class="{ active: i === current }"
        @click="goTo(i)"
      />
    </div>

    <!-- Slot for extra link (e.g. "see all") -->
    <div v-if="$slots.footer" class="ass-footer">
      <slot name="footer" />
    </div>

    <!-- Lightbox -->
    <teleport to="body">
      <div v-if="lightbox" class="ass-lightbox" @click="lightbox = ''">
        <img :src="lightbox" class="ass-lightbox-img" @click.stop />
        <button class="ass-lightbox-close" @click="lightbox = ''">✕</button>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  items:        { type: Array,  default: () => [] },
  newThreshold: { type: Number, default: 86400000 },  // 24h in ms
  interval:     { type: Number, default: 5000 },
})

const current  = ref(0)
const lightbox = ref('')
const slideDir = ref('left')
let timer      = null
let touchX     = 0

const THAI_MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getDate()} ${THAI_MONTHS[dt.getMonth()+1]}`
}

function typeLabel(t) {
  if (t === 'urgent')   return '⚠️ ด่วน'
  if (t === 'reminder') return '🔔 แจ้งเตือน'
  return 'ℹ️ ประกาศ'
}

function cardClass(ann) {
  return `ass-card--${ann?.type || 'info'}`
}

function isNew(ann) {
  if (!ann?.created_at) return false
  return Date.now() - new Date(ann.created_at).getTime() < props.newThreshold
}

function goTo(i) {
  slideDir.value = i > current.value ? 'left' : 'right'
  current.value = i
  restart()
}

function next() {
  slideDir.value = 'left'
  current.value = (current.value + 1) % props.items.length
  restart()
}

function prev() {
  slideDir.value = 'right'
  current.value = (current.value - 1 + props.items.length) % props.items.length
  restart()
}

function startTimer() {
  if (props.items.length <= 1) return
  timer = setInterval(() => {
    slideDir.value = 'left'
    current.value = (current.value + 1) % props.items.length
  }, props.interval)
}

function pause()   { clearInterval(timer); timer = null }
function resume()  { if (!timer) startTimer() }
function restart() { pause(); startTimer() }

function onTouchStart(e) { touchX = e.changedTouches[0].clientX }
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchX
  if (Math.abs(dx) < 40) return
  if (dx < 0) next(); else prev()
}

watch(() => props.items.length, () => { current.value = 0; restart() })
onMounted(startTimer)
onUnmounted(pause)
</script>

<style scoped>
.ass-wrap {
  background: white;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.08);
  margin-bottom: 14px;
  overflow: hidden;
}

.ass-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.ass-title { font-size: 14px; font-weight: 800; color: #374151; }
.ass-counter { font-size: 12px; color: #9ca3af; font-weight: 600; }

/* ── Viewport ── */
.ass-viewport {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
}

/* ── Card ── */
.ass-card {
  border-radius: 12px;
  padding: 14px 16px;
  min-height: 80px;
  position: relative;
}
.ass-card--info     { background: #eff6ff; border-left: 4px solid #3b82f6; }
.ass-card--urgent   { background: #fff7ed; border-left: 4px solid #f97316; }
.ass-card--reminder { background: #f0fdf4; border-left: 4px solid #22c55e; }

/* top row */
.ass-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.ass-chip {
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  padding: 2px 8px;
}
.ass-chip--info     { background: #dbeafe; color: #1d4ed8; }
.ass-chip--urgent   { background: #ffedd5; color: #c2410c; }
.ass-chip--reminder { background: #dcfce7; color: #15803d; }

.ass-new-dot {
  font-size: 11px;
  font-weight: 700;
  background: #fbbf24;
  color: #78350f;
  border-radius: 6px;
  padding: 2px 7px;
  animation: pulse-badge .9s ease-in-out infinite alternate;
}
@keyframes pulse-badge {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: .75; transform: scale(.95); }
}

.ass-meta {
  font-size: 11px;
  color: #6b7280;
  margin-left: auto;
}

.ass-card-title {
  font-size: 16px;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 4px;
  line-height: 1.35;
}

.ass-card-body {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  white-space: pre-line;
}

/* images */
.ass-images {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ass-img {
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  border-radius: 8px;
  cursor: zoom-in;
  display: block;
  background: #f3f4f6;
}

/* ── Arrows ── */
.ass-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  background: rgba(255,255,255,.85);
  border: none;
  border-radius: 50%;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  transition: background .15s;
  z-index: 2;
}
.ass-arrow:hover { background: white; }
.ass-arrow--prev { left: 6px; }
.ass-arrow--next { right: 6px; }

/* ── Dots ── */
.ass-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}
.ass-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: #d1d5db;
  cursor: pointer;
  padding: 0;
  transition: all .2s;
}
.ass-dot.active {
  background: #6d28d9;
  width: 20px;
  border-radius: 4px;
}

/* ── Footer slot ── */
.ass-footer {
  text-align: center;
  margin-top: 10px;
}

/* ── Slide transitions (fade + subtle shift, no layout collapse) ── */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}
.slide-left-enter-from  { opacity: 0; transform: translateX(32px); }
.slide-left-leave-to    { opacity: 0; transform: translateX(-32px); }
.slide-right-enter-from { opacity: 0; transform: translateX(-32px); }
.slide-right-leave-to   { opacity: 0; transform: translateX(32px); }

/* ── Lightbox ── */
.ass-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ass-lightbox-img {
  max-width: 95vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}
.ass-lightbox-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255,255,255,.2);
  border: none;
  color: white;
  font-size: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
