import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import router from './router'
import App from './App.vue'

// 1. นำเข้า CSS (ต้องอยู่บนสุดเพื่อให้ UI ไม่เละ)
import './style.css'

// 2. นำเข้า Logic การล็อกอินเดิมของคุณ (ห้ามลบ!)
import { useMasterAuth } from '@/composables/useMasterAuth'

// 3. นำเข้า Firebase จากโฟลเดอร์ที่ถูกต้อง
// หมายเหตุ: @/ คือ src ถ้ามีปัญหาให้เปลี่ยนเป็น './firebase/db'
import { db, auth } from '@/firebase/db' 

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// 4. เริ่มระบบ
app.mount('#app')

// 5. คืนค่า Listener ที่ทำให้ Session ไม่หลุด
const { initAuthListener } = useMasterAuth()
initAuthListener(router)