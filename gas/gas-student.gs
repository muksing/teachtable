/**
 * GAS-2: Student Portal Host
 * ⚠️ มีแค่นี้เท่านั้น — ห้ามเพิ่มโค้ดอื่น
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index-student')
    .setTitle('Student Portal — School ERP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
}
