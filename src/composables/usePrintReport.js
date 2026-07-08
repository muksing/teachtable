// src/composables/usePrintReport.js
// สร้างรายงานทางการแบบ popup window พร้อมโลโก้โรงเรียน — พิมพ์ / บันทึก PDF ได้
import { useSchoolStore } from '@/stores/school'

export function usePrintReport() {
  const schoolStore = useSchoolStore()

  /**
   * @param {Object} opts
   * @param {string}   opts.title       - ชื่อรายงาน
   * @param {string}   [opts.subtitle]  - คำอธิบายเพิ่มเติม
   * @param {Array}    opts.columns     - [{ label, key, render(row)? }]
   * @param {Array}    opts.rows        - ข้อมูลแต่ละแถว
   * @param {Array}    [opts.extraInfo] - [[label, value], ...] แสดงใต้หัว
   * @param {string}   [opts.orient]    - 'portrait' | 'landscape' (default portrait)
   */
  function printReport({ title, subtitle = '', columns, rows, extraInfo = [], orient = 'portrait' }) {
    const school = schoolStore.schoolInfo || {}
    const logo = school.logo_url || ''
    const schoolName = school.name || 'โรงเรียน'
    const address = [school.address, school.district, school.province].filter(Boolean).join(' ')
    const now = new Date()
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

    const headerHtml = logo
      ? `<img src="${logo}" class="logo" alt="logo">`
      : `<div class="logo-placeholder">🏫</div>`

    const extraInfoHtml = extraInfo.length
      ? `<div class="extra-info">${extraInfo.map(([k, v]) =>
          `<span><strong>${k}</strong> ${v}</span>`).join('<span class="sep">|</span>')}</div>`
      : ''

    const theadHtml = `<tr>${columns.map(c =>
      `<th style="${c.width ? `width:${c.width}` : ''}">${c.label}</th>`
    ).join('')}</tr>`

    const tbodyHtml = rows.map((row, i) =>
      `<tr class="${i % 2 === 0 ? '' : 'alt'}">
        ${columns.map(c => {
          const val = typeof c.render === 'function'
            ? c.render(row)
            : (row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '—')
          return `<td>${val}</td>`
        }).join('')}
      </tr>`
    ).join('')

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${title} — ${schoolName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    @page { size: A4 ${orient}; margin: 12mm 10mm 10mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Sarabun', 'TH Sarabun New', 'Tahoma', sans-serif;
      font-size: 13px; color: #1a1a2e; background: white;
    }

    /* ===== Header ===== */
    .report-header {
      display: flex; align-items: center; gap: 14px;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 12px; margin-bottom: 10px;
    }
    .logo { width: 72px; height: 72px; object-fit: contain; border-radius: 8px; }
    .logo-placeholder {
      width: 72px; height: 72px; display: flex; align-items: center;
      justify-content: center; font-size: 36px;
      background: #f0f0ff; border-radius: 8px;
    }
    .header-text { flex: 1; }
    .school-name { font-size: 17px; font-weight: 700; color: #4f46e5; line-height: 1.2; }
    .school-address { font-size: 11px; color: #666; margin-top: 2px; }
    .report-title { font-size: 15px; font-weight: 700; margin-top: 4px; }
    .report-subtitle { font-size: 12px; color: #555; margin-top: 2px; }
    .header-meta { text-align: right; font-size: 11px; color: #777; min-width: 100px; line-height: 1.8; }

    /* ===== Extra Info Bar ===== */
    .extra-info {
      background: #f5f3ff; border-left: 4px solid #4f46e5;
      border-radius: 0 6px 6px 0; padding: 6px 12px;
      font-size: 12px; color: #333; margin-bottom: 8px;
      display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
    }
    .extra-info .sep { color: #aaa; margin: 0 4px; }
    .count-row { font-size: 12px; color: #4f46e5; font-weight: 600; margin-bottom: 6px; }

    /* ===== Table ===== */
    table { width: 100%; border-collapse: collapse; }
    thead tr {
      background: linear-gradient(90deg, #4f46e5, #7c3aed);
      color: white;
    }
    th {
      padding: 8px 10px; text-align: left;
      font-size: 12px; font-weight: 600;
      border: 1px solid rgba(255,255,255,0.2);
    }
    td {
      padding: 7px 10px; font-size: 12px;
      border-bottom: 1px solid #e8e8f0;
      vertical-align: top;
    }
    tr.alt td { background: #f9f8ff; }
    tr:hover td { background: #eef2ff; }

    /* ===== Footer ===== */
    .report-footer {
      margin-top: 14px; font-size: 11px; color: #888;
      display: flex; justify-content: space-between;
      border-top: 1px solid #ddd; padding-top: 8px;
    }

    /* ===== Print Button (hidden on print) ===== */
    .print-actions {
      position: fixed; bottom: 20px; right: 20px;
      display: flex; gap: 10px; z-index: 999;
    }
    .btn-print {
      background: #4f46e5; color: white; border: none;
      padding: 10px 22px; border-radius: 8px;
      font-size: 14px; font-family: inherit;
      cursor: pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.4);
    }
    .btn-close {
      background: #e5e7eb; color: #333; border: none;
      padding: 10px 18px; border-radius: 8px;
      font-size: 14px; font-family: inherit; cursor: pointer;
    }
    @media print {
      .print-actions { display: none; }
      tr:hover td { background: unset; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    ${headerHtml}
    <div class="header-text">
      <div class="school-name">${schoolName}</div>
      ${address ? `<div class="school-address">${address}</div>` : ''}
      <div class="report-title">${title}</div>
      ${subtitle ? `<div class="report-subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="header-meta">
      <div>วันที่พิมพ์</div>
      <div><strong>${dateStr}</strong></div>
      <div>${timeStr} น.</div>
    </div>
  </div>

  ${extraInfoHtml}
  <div class="count-row">รายการทั้งหมด: <strong>${rows.length}</strong> รายการ</div>

  <table>
    <thead>${theadHtml}</thead>
    <tbody>${tbodyHtml || '<tr><td colspan="' + columns.length + '" style="text-align:center;color:#aaa;padding:20px">ไม่มีข้อมูล</td></tr>'}</tbody>
  </table>

  <div class="report-footer">
    <span>ระบบ SchoolLOG — ${schoolName}</span>
    <span>ภาคเรียน: ${schoolStore.currentTerm || '-'}</span>
  </div>

  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button>
    <button class="btn-close" onclick="window.close()">✕ ปิด</button>
  </div>

  <script>
    window.onload = function() {
      // auto-focus เพื่อ Ctrl+P ใช้งานได้เลย
      window.focus()
    }
  <\/script>
</body>
</html>`

    const win = window.open('', '_blank', `width=${orient === 'landscape' ? 1100 : 850},height=700,scrollbars=yes`)
    if (!win) {
      alert('กรุณาอนุญาต popup เพื่อแสดงรายงาน')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  return { printReport }
}
