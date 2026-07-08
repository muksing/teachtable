import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
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

// รีโหลดหน้าอัตโนมัติครั้งเดียวเมื่อ service worker เวอร์ชันใหม่เข้าควบคุมหน้า
// (ป้องกันแท็บเก่าค้างแสดงโค้ด/แบรนด์เวอร์ชันก่อนหน้าหลัง deploy)
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}
