import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElNotification } from 'element-plus'
import 'element-plus/dist/index.css'
import router from './router'
import App from './App.vue'
import './style.css'
import { useMasterAuth } from '@/composables/useMasterAuth'
import TeacherSelect from '@/components/TeacherSelect.vue'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.component('TeacherSelect', TeacherSelect)
app.mount('#app')

const { initAuthListener } = useMasterAuth()
initAuthListener(router)

// แจ้งเตือน (ไม่ auto-reload) เมื่อมี service worker เวอร์ชันใหม่พร้อมใช้งาน
// ห้าม force reload ทันที เพราะจะทำฟอร์มที่ครูกำลังกรอกอยู่ (เช่นบันทึกเข้าสอน) หายได้
if ('serviceWorker' in navigator) {
  let notified = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (notified) return
    notified = true
    ElNotification({
      title: 'มีเวอร์ชันใหม่',
      message: 'ระบบมีการอัปเดต กดที่นี่เพื่อโหลดเวอร์ชันล่าสุด (บันทึกงานที่ทำค้างไว้ก่อนนะครับ)',
      type: 'info',
      duration: 0,
      onClick: () => window.location.reload(),
    })
  })
}
