/**
 * GAS-1: Main App Host
 * ⚠️ มีแค่นี้เท่านั้น — ห้ามเพิ่มโค้ดอื่น
 * ห้าม UrlFetch ห้ามอ่าน Firebase ห้าม SpreadsheetApp
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('School ERP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
}
