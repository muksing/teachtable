import { ref, watchEffect } from 'vue'

const KEY = 'tt_dark_mode'
const isDark = ref(localStorage.getItem(KEY) === '1')

watchEffect(() => {
  document.documentElement.classList.toggle('dark-mode', isDark.value)
  localStorage.setItem(KEY, isDark.value ? '1' : '0')
})

export function useDarkMode() {
  function toggle() { isDark.value = !isDark.value }
  return { isDark, toggle }
}
