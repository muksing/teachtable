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
