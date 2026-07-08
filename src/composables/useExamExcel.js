import * as XLSX from 'xlsx'

export function useExamExcel() {

  // ===== Export blank template =====
  function exportTemplate(examTitle = 'ข้อสอบ') {
    const wb = XLSX.utils.book_new()

    // คำชี้แจง
    const instr = XLSX.utils.aoa_to_sheet([
      ['คำชี้แจงการกรอกข้อสอบ'],
      [''],
      ['แต่ละ sheet = 1 ประเภทข้อสอบ ไม่ต้องกรอก sheet ที่ไม่ใช้'],
      ['ห้ามเปลี่ยนชื่อ sheet หรือชื่อหัวคอลัมน์'],
      ['ลำดับ: ระบบจะเรียงตามลำดับที่กรอกในแต่ละ sheet → ปรนัย → ถูกผิด → เติมคำ → อัตนัย'],
      [''],
      ['ปรนัย  : ตัวเลือก A-D, กรอก A/B/C/D ในช่อง "เฉลย"'],
      ['ถูก/ผิด : กรอก "ถูก" หรือ "ผิด" ในช่อง "เฉลย"'],
      ['เติมคำ : กรอกคำตอบในช่อง "เฉลย" (ตรวจอัตโนมัติ)'],
      ['อัตนัย : ไม่ต้องกรอกเฉลย — ครูตรวจ/AI ตรวจให้คะแนนเอง'],
    ])
    XLSX.utils.book_append_sheet(wb, instr, 'คำชี้แจง')

    // ปรนัย
    const choiceWS = XLSX.utils.aoa_to_sheet([
      ['ลำดับ', 'คำถาม', 'URL รูปภาพ (ถ้ามี)', 'ตัวเลือก A', 'ตัวเลือก B', 'ตัวเลือก C', 'ตัวเลือก D', 'เฉลย (A/B/C/D)', 'คะแนน'],
      [1, 'ตัวอย่าง: 2 + 2 = ?', '', '3', '4', '5', '6', 'B', 1],
    ])
    XLSX.utils.book_append_sheet(wb, choiceWS, 'ปรนัย')

    // ถูกผิด
    const tfWS = XLSX.utils.aoa_to_sheet([
      ['ลำดับ', 'คำถาม', 'เฉลย (ถูก/ผิด)', 'คะแนน'],
      [1, 'ตัวอย่าง: โลกกลม', 'ถูก', 1],
    ])
    XLSX.utils.book_append_sheet(wb, tfWS, 'ถูกผิด')

    // เติมคำ
    const fillWS = XLSX.utils.aoa_to_sheet([
      ['ลำดับ', 'คำถาม', 'เฉลย', 'คะแนน'],
      [1, 'ตัวอย่าง: เมืองหลวงของไทยคือ...', 'กรุงเทพมหานคร', 1],
    ])
    XLSX.utils.book_append_sheet(wb, fillWS, 'เติมคำ')

    // อัตนัย
    const essayWS = XLSX.utils.aoa_to_sheet([
      ['ลำดับ', 'คำถาม', 'เฉลย/แนวคำตอบ (ใช้สำหรับให้ AI ตรวจ)', 'คะแนนเต็ม'],
      [1, 'ตัวอย่าง: อธิบายวัฏจักรน้ำ', 'น้ำระเหย → กลายเป็นเมฆ → ฝนตก → ไหลกลับสู่แหล่งน้ำ', 5],
    ])
    XLSX.utils.book_append_sheet(wb, essayWS, 'อัตนัย')

    XLSX.writeFile(wb, `เทมเพลต_${examTitle}.xlsx`)
  }

  // ===== Import from Excel =====
  function importFromExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const questions = []
          let orderNum = 1

          // ปรนัย
          if (wb.SheetNames.includes('ปรนัย')) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets['ปรนัย'])
            for (const row of rows) {
              if (!row['คำถาม']) continue
              const choices = [
                row['ตัวเลือก A'], row['ตัวเลือก B'],
                row['ตัวเลือก C'], row['ตัวเลือก D'],
              ].filter(Boolean).map(t => ({ text: String(t) }))
              questions.push({
                order_num: orderNum++,
                question_type: 'choice',
                question_text: String(row['คำถาม']),
                question_image: row['URL รูปภาพ (ถ้ามี)'] || null,
                choices,
                correct_answer: String(row['เฉลย (A/B/C/D)'] || '').toUpperCase(),
                match_pairs: [],
                points: Number(row['คะแนน'] || 1),
              })
            }
          }

          // ถูกผิด
          if (wb.SheetNames.includes('ถูกผิด')) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets['ถูกผิด'])
            for (const row of rows) {
              if (!row['คำถาม']) continue
              const ans = String(row['เฉลย (ถูก/ผิด)'] || '').trim()
              questions.push({
                order_num: orderNum++,
                question_type: 'truefalse',
                question_text: String(row['คำถาม']),
                question_image: null,
                choices: [],
                correct_answer: ans === 'ถูก' ? 'true' : 'false',
                match_pairs: [],
                points: Number(row['คะแนน'] || 1),
              })
            }
          }

          // เติมคำ
          if (wb.SheetNames.includes('เติมคำ')) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets['เติมคำ'])
            for (const row of rows) {
              if (!row['คำถาม']) continue
              questions.push({
                order_num: orderNum++,
                question_type: 'fill',
                question_text: String(row['คำถาม']),
                question_image: null,
                choices: [],
                correct_answer: String(row['เฉลย'] || ''),
                match_pairs: [],
                points: Number(row['คะแนน'] || 1),
              })
            }
          }

          // อัตนัย
          if (wb.SheetNames.includes('อัตนัย')) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets['อัตนัย'])
            for (const row of rows) {
              if (!row['คำถาม']) continue
              questions.push({
                order_num: orderNum++,
                question_type: 'essay',
                question_text: String(row['คำถาม']),
                question_image: null,
                choices: [],
                correct_answer: row['เฉลย/แนวคำตอบ (ใช้สำหรับให้ AI ตรวจ)'] ? String(row['เฉลย/แนวคำตอบ (ใช้สำหรับให้ AI ตรวจ)']) : null,
                match_pairs: [],
                points: Number(row['คะแนนเต็ม'] || 5),
              })
            }
          }

          resolve(questions)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  // ===== Export scores =====
  function exportScores(sessions, questions, examTitle = 'ข้อสอบ') {
    const wb = XLSX.utils.book_new()
    const statusTH = { submitted: 'ส่งแล้ว', locked: 'ถูกล็อก', in_progress: 'กำลังสอบ', pending_approval: 'รออนุมัติ' }

    // Sheet 1: สรุปคะแนน
    const summaryRows = sessions.map(s => ({
      'เลขที่':        s.seat_number || '',
      'คำนำหน้า':     s.prefix      || '',
      'ชื่อ':         s.first_name  || s.student_name || '',
      'นามสกุล':      s.last_name   || '',
      'รหัสนักเรียน': s.student_code || '',
      'ห้อง':         s.class_id    || '',
      'ครั้งที่':     s.attempt_number || 1,
      'คะแนนที่ได้':  s.score ?? '',
      'คะแนนเต็ม':    s.max_score ?? '',
      'สถานะ':        statusTH[s.status] || s.status,
      'ทุจริต (ครั้ง)': s.violation_count || 0,
      'เวลาส่ง':      s.submitted_at ? new Date(s.submitted_at).toLocaleString('th-TH') : '',
    }))
    const summaryWS = XLSX.utils.json_to_sheet(summaryRows)
    XLSX.utils.book_append_sheet(wb, summaryWS, 'สรุปคะแนน')

    // Sheet 2: คำตอบรายข้อ
    if (questions.length) {
      const header = ['เลขที่', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'รหัส', 'ห้อง', 'ครั้งที่', ...questions.map((q, i) => `ข้อ${i + 1}`), 'คะแนนรวม']
      const dataRows = sessions.map(s => {
        const ans = (() => { try { return typeof s.answers === 'string' ? JSON.parse(s.answers) : (s.answers || {}) } catch { return {} } })()
        return [
          s.seat_number || '', s.prefix || '', s.first_name || s.student_name || '', s.last_name || '',
          s.student_code || '', s.class_id || '', s.attempt_number || 1,
          ...questions.map(q => ans[q.id] || ''),
          s.score ?? '',
        ]
      })
      const detailWS = XLSX.utils.aoa_to_sheet([header, ...dataRows])
      XLSX.utils.book_append_sheet(wb, detailWS, 'คำตอบรายข้อ')
    }

    XLSX.writeFile(wb, `คะแนน_${examTitle}.xlsx`)
  }

  // ===== AI grading via Gemini =====
  async function gradeWithAI(questionText, modelAnswer, studentAnswer, points) {
    const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) throw new Error('NO_KEY')

    const prompt = `คุณเป็นผู้ช่วยตรวจข้อสอบภาษาไทย ให้คะแนนคำตอบนักเรียนอย่างยุติธรรม

คำถาม: ${questionText}
แนวคำตอบ/เฉลย: ${modelAnswer || '(ไม่มี — ใช้ดุลยพินิจตามความถูกต้อง)'}
คำตอบนักเรียน: ${studentAnswer || '(ว่างเปล่า)'}
คะแนนเต็ม: ${points} คะแนน

ตอบเป็น JSON เท่านั้น ไม่ต้องอธิบายเพิ่มเติม: {"score": <ตัวเลข 0 ถึง ${points}>, "reason": "<เหตุผลสั้นๆ ภาษาไทย>"}`

    const callGemini = async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      )
      if (res.status === 429) throw new Error('RATE_LIMIT')
      if (!res.ok) throw new Error(`Gemini error ${res.status}`)
      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const match = text.match(/\{[\s\S]*?\}/)
      if (!match) throw new Error('Invalid response')
      return JSON.parse(match[0])
    }

    try {
      return await callGemini()
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        await new Promise(r => setTimeout(r, 15000))
        return await callGemini()
      }
      throw err
    }
  }

  return { exportTemplate, importFromExcel, exportScores, gradeWithAI }
}
