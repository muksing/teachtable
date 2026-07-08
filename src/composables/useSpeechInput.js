import { ref } from 'vue'

export function useSpeechInput() {
  const listening = ref(false)
  const supported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  let recognition = null

  function startListening(onResult, onError) {
    if (!supported) {
      onError?.('บราวเซอร์นี้ไม่รองรับการพูด กรุณาใช้ Chrome หรือ Safari')
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition = new SpeechRecognition()
    recognition.lang = 'th-TH'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    let fired = false
    recognition.onstart = () => { listening.value = true }
    recognition.onend = () => { listening.value = false }
    recognition.onerror = e => {
      listening.value = false
      if (e.error === 'no-speech') return
      onError?.('ฟังไม่ได้ยิน: ' + e.error)
    }
    recognition.onresult = e => {
      if (fired) return
      const last = e.results[e.results.length - 1]
      if (!last.isFinal) return
      fired = true
      recognition.stop()
      onResult(last[0].transcript)
    }
    recognition.start()
  }

  function stopListening() {
    recognition?.stop()
    listening.value = false
  }

  return { listening, supported, startListening, stopListening }
}
