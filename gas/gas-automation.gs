/**
 * GAS-3: Automation Engine
 * Timer Triggers:
 *   - runEmailQueue: ทุก 1 นาที (คิวอีเมลแจ้งเตือนการอนุมัติ)
 *   - runNotifyQueue: ทุก 5 นาที
 *   - preGenLogs: 00:01 น. ทุกวัน
 *   - dailySummary: 16:00 น. ทุกวัน
 *   - weeklySummary: ทุกวันศุกร์ 20:00 น.
 */

const SUPERADMIN_EMAIL_FALLBACK = 'muksingapp@gmail.com'
const TOKEN_MAX_AGE_HOURS = 72

// ===== SETUP TRIGGERS (รันครั้งเดียว) =====
function setupTriggers() {
  // ลบ triggers เก่าก่อน
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t))

  ScriptApp.newTrigger('notifyNewSchoolRequests').timeBased().everyMinutes(1).create()
  ScriptApp.newTrigger('runEmailQueue').timeBased().everyMinutes(1).create()
  ScriptApp.newTrigger('processPasswordChangeQueue').timeBased().everyMinutes(1).create()
  ScriptApp.newTrigger('runNotifyQueue').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('preGenLogs').timeBased().atHour(0).everyDays(1).create()
  ScriptApp.newTrigger('dailySummary').timeBased().atHour(16).everyDays(1).create()
  ScriptApp.newTrigger('weeklySummary')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(20)
    .create()

  Logger.log('✅ Triggers ตั้งค่าเรียบร้อย')
}

// ===== MAIN FUNCTIONS =====

/**
 * แจ้ง SuperAdmin เมื่อมีคำขอโรงเรียนใหม่
 */
function notifyNewSchoolRequests() {
  try {
    const requests = firestoreListDocuments('school_requests')
      .filter(item => item.status === 'pending' && !item.superAdminNotifiedAt)

    if (requests.length === 0) return

    const superAdmin = firestoreListDocuments('users')
      .find(item => (item.globalRole === 'superadmin' || item.role === 'superadmin') && item.email)
    const superAdminEmail = (superAdmin && superAdmin.email) || SUPERADMIN_EMAIL_FALLBACK
    if (!superAdminEmail) {
      Logger.log('❌ ไม่พบอีเมล SuperAdmin และ fallback ไม่ถูกตั้งค่า')
      return
    }

    const appUrl = 'https://master-teachtable.web.app'

    requests.forEach(item => {
      const approveUrl = `${appUrl}/email-action?action=approve&token=${item.approvalToken}`
      const rejectUrl = `${appUrl}/email-action?action=reject&token=${item.approvalToken}`

      firestoreCreateDocument('email_queue', {
        to: superAdminEmail,
        subject: `[คำขอใหม่] โรงเรียน "${item.schoolName}" สมัครใช้งาน`,
        htmlBody: `
          <h3 style="color:#303133">มีคำขอสมัครใช้งานใหม่</h3>
          <table style="border-collapse:collapse;width:100%;max-width:500px">
            <tr><td style="padding:8px;font-weight:bold;background:#f5f7fa;border:1px solid #ebeef5">โรงเรียน</td><td style="padding:8px;border:1px solid #ebeef5">${item.schoolName}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f7fa;border:1px solid #ebeef5">ผู้ติดต่อ</td><td style="padding:8px;border:1px solid #ebeef5">${item.contactName} (${item.contactEmail})</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f7fa;border:1px solid #ebeef5">ที่อยู่</td><td style="padding:8px;border:1px solid #ebeef5">${item.schoolAddress || '-'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f7fa;border:1px solid #ebeef5">เบอร์โทร</td><td style="padding:8px;border:1px solid #ebeef5">${item.schoolPhone || '-'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f7fa;border:1px solid #ebeef5">Admin Email</td><td style="padding:8px;border:1px solid #ebeef5">${item.adminEmail || '-'}</td></tr>
          </table>
          <br/>
          <p>กรุณาดำเนินการโดยเข้าสู่ระบบ SuperAdmin ก่อน:</p>
          <div style="margin:16px 0">
            <a href="${approveUrl}" style="background:#67c23a;color:white;padding:12px 28px;text-decoration:none;border-radius:4px;margin-right:12px;display:inline-block;font-size:15px">อนุมัติ</a>
            <a href="${rejectUrl}" style="background:#f56c6c;color:white;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-size:15px">ปฏิเสธ</a>
          </div>
          <p style="color:#909399;font-size:12px">หรือจัดการจากหน้าเว็บ: <a href="${appUrl}/superadmin/school-requests">แผงควบคุม SuperAdmin</a></p>
        `,
        status: 'pending',
        createdAt: new Date().toISOString()
      })

      firestorePatchDocument(item.__name, {
        superAdminNotifiedAt: new Date().toISOString()
      })
    })
  } catch (e) {
    Logger.log(`❌ notifyNewSchoolRequests error: ${e.message}`)
  }
}

/**
 * Endpoint สำหรับอนุมัติ/ปฏิเสธจากลิงก์อีเมล (ไม่ต้องล็อกอิน)
 * payload: { route: 'school-approval', action: 'approve'|'reject', token: '...', reason?: '...' }
 */
function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}')
    if (!payload || !payload.route) {
      return jsonOutput({ success: false, error: 'invalid_route' })
    }

    if (payload.route === 'school-approval') {
      const action = String(payload.action || '').trim()
      const token = String(payload.token || '').trim()
      const reason = String(payload.reason || '').trim()
      if (!token || !['approve', 'reject'].includes(action)) {
        return jsonOutput({ success: false, error: 'invalid_payload' })
      }
      return jsonOutput(processSchoolRequestByToken(action, token, reason))
    }

    if (payload.route === 'upload-student-photo') {
      return handleUploadStudentPhoto(payload)
    }

    if (payload.route === 'bulk-upload-student-photos') {
      return handleBulkUploadStudentPhotos(payload)
    }

    return jsonOutput({ success: false, error: 'invalid_route' })
  } catch (err) {
    return jsonOutput({ success: false, error: err.message || 'unknown_error' })
  }
}

/**
 * อัพโหลดรูปภาพนักเรียนรูปเดียวไปยัง Google Drive
 * payload: { folderId, fileName, mimeType, base64Data, studentId }
 */
function handleUploadStudentPhoto(payload) {
  const { folderId, fileName, mimeType, base64Data, studentId } = payload
  if (!folderId || !fileName || !base64Data) {
    return jsonOutput({ success: false, error: 'missing_fields' })
  }

  const folder = DriveApp.getFolderById(folderId)

  // ลบไฟล์เก่าที่ชื่อเดิม (ถ้ามี)
  const existing = folder.getFilesByName(fileName)
  while (existing.hasNext()) existing.next().setTrashed(true)

  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType || 'image/jpeg',
    fileName
  )
  const file = folder.createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  const fileId = file.getId()
  const url = 'https://drive.google.com/uc?export=view&id=' + fileId

  return jsonOutput({ success: true, url, fileId })
}

/**
 * อัพโหลดรูปภาพนักเรียนหลายรูปพร้อมกัน
 * payload: { folderId, files: [{ fileName, mimeType, base64Data }], overwrite }
 */
function handleBulkUploadStudentPhotos(payload) {
  const { folderId, files, overwrite } = payload
  if (!folderId || !Array.isArray(files) || files.length === 0) {
    return jsonOutput({ success: false, error: 'missing_fields' })
  }

  const folder = DriveApp.getFolderById(folderId)
  const results = []
  let doneCount = 0, failCount = 0

  for (const f of files) {
    const { fileName, mimeType, base64Data } = f
    if (!fileName || !base64Data) {
      results.push({ fileName, success: false, error: 'missing_data' })
      failCount++
      continue
    }
    try {
      // ลบไฟล์เก่าถ้า overwrite
      if (overwrite === 'replace') {
        const existing = folder.getFilesByName(fileName)
        while (existing.hasNext()) existing.next().setTrashed(true)
      }

      const blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        mimeType || 'image/jpeg',
        fileName
      )
      const file = folder.createFile(blob)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

      const fileId = file.getId()
      const url = 'https://drive.google.com/uc?export=view&id=' + fileId
      results.push({ fileName, success: true, url, fileId })
      doneCount++
    } catch (err) {
      results.push({ fileName, success: false, error: err.message })
      failCount++
    }
  }

  return jsonOutput({ success: true, doneCount, failCount, results })
}

function processSchoolRequestByToken(action, token, reason) {
  const requests = firestoreListDocuments('school_requests')
  const req = requests.find(r => String(r.approvalToken || '') === token)

  if (!req) {
    return { success: false, error: 'token_not_found', message: 'ไม่พบคำขอ หรือลิงก์หมดอายุแล้ว' }
  }

  if (req.tokenCreatedAt && isTokenExpired(req.tokenCreatedAt, TOKEN_MAX_AGE_HOURS)) {
    return { success: false, error: 'token_expired', message: 'ลิงก์หมดอายุ กรุณายื่นคำขอใหม่' }
  }

  if (req.status !== 'pending') {
    return {
      success: false,
      alreadyProcessed: true,
      status: req.status,
      schoolName: req.schoolName,
      message: 'คำขอนี้ถูกดำเนินการแล้ว'
    }
  }

  if (action === 'reject') {
    if (!reason) {
      return { success: false, error: 'reason_required', message: 'กรุณาระบุเหตุผลการปฏิเสธ' }
    }
    return rejectSchoolByToken(req, reason)
  }

  return approveSchoolByToken(req)
}

function approveSchoolByToken(requestDoc) {
  const adminEmail = String(requestDoc.adminEmail || '').trim()
  const adminPassword = String(requestDoc.adminPassword || '').trim()
  if (!adminEmail || !adminPassword || adminPassword.length < 6) {
    return { success: false, error: 'invalid_admin_credential', message: 'ข้อมูลบัญชีผู้ดูแลไม่ครบถ้วน' }
  }

  const schoolId = generateSchoolId(requestDoc.schoolName)
  const authRes = createAuthUserWithPassword(adminEmail, adminPassword)
  if (!authRes.success) {
    return authRes
  }

  const uid = authRes.uid
  const nowIso = new Date().toISOString()

  // schools/{schoolId}
  firestoreCreateDocument('schools', {
    schoolId: schoolId,
    schoolName: requestDoc.schoolName || '',
    schoolAddress: requestDoc.schoolAddress || '',
    schoolPhone: requestDoc.schoolPhone || '',
    schoolEmail: requestDoc.schoolEmail || '',
    adminUid: uid,
    adminEmail: adminEmail,
    currentTerm: '2568_1',
    createdAt: nowIso,
    updatedAt: nowIso,
    isActive: true,
    subscriptionStatus: 'active'
  }, schoolId)

  // users/{uid}
  firestoreCreateDocument('users', {
    uid: uid,
    email: adminEmail,
    displayName: requestDoc.contactName || '',
    role: 'school_admin',
    schoolId: schoolId,
    schoolRole: 'admin',
    isActive: true,
    createdAt: nowIso
  }, uid)

  // แจ้งผลไป School Admin
  firestoreCreateDocument('email_queue', {
    to: adminEmail,
    subject: `ยินดีด้วย! โรงเรียน ${requestDoc.schoolName} ได้รับการอนุมัติเข้าใช้งานแล้ว`,
    htmlBody: `
      <h3>การสมัครใช้งานได้รับการอนุมัติ</h3>
      <p>สวัสดีคุณ ${requestDoc.contactName || '-'},</p>
      <p>โรงเรียน <b>${requestDoc.schoolName}</b> ได้รับการอนุมัติเรียบร้อยแล้ว</p>
      <p><b>ข้อมูลเข้าสู่ระบบ:</b></p>
      <ul>
        <li>อีเมล: ${adminEmail}</li>
        <li>รหัสผ่านชั่วคราว: ${adminPassword}</li>
      </ul>
      <p>เข้าสู่ระบบที่ <a href="https://master-teachtable.web.app/">master-teachtable.web.app</a></p>
    `,
    status: 'pending',
    createdAt: nowIso
  })

  firestorePatchDocument(requestDoc.__name, {
    status: 'approved',
    schoolId: schoolId,
    reviewedAt: nowIso,
    reviewedBy: 'email_token_approval',
    approvedAt: nowIso,
    approvalToken: '',
    adminPassword: ''
  })

  return { success: true, status: 'approved', schoolName: requestDoc.schoolName, message: 'อนุมัติสำเร็จ' }
}

function rejectSchoolByToken(requestDoc, reason) {
  const nowIso = new Date().toISOString()

  firestorePatchDocument(requestDoc.__name, {
    status: 'rejected',
    rejectionReason: reason,
    reviewedAt: nowIso,
    reviewedBy: 'email_token_reject',
    approvalToken: '',
    adminPassword: ''
  })

  firestoreCreateDocument('email_queue', {
    to: requestDoc.contactEmail || requestDoc.adminEmail || '',
    subject: `แจ้งผลการสมัครใช้งาน - ${requestDoc.schoolName}`,
    htmlBody: `
      <h3>แจ้งผลการพิจารณา</h3>
      <p>สวัสดีคุณ ${requestDoc.contactName || '-'},</p>
      <p>คำขอสมัครของโรงเรียน <b>${requestDoc.schoolName}</b> ได้รับการ <b>ปฏิเสธ</b></p>
      <p><b>เหตุผล:</b> ${reason}</p>
    `,
    status: 'pending',
    createdAt: nowIso
  })

  return { success: true, status: 'rejected', schoolName: requestDoc.schoolName, message: 'ปฏิเสธสำเร็จ' }
}

function createAuthUserWithPassword(email, password) {
  try {
    const props = PropertiesService.getScriptProperties()
    const webApiKey = props.getProperty('FIREBASE_WEB_API_KEY')
    if (!webApiKey) {
      return { success: false, error: 'missing_web_api_key', message: 'ยังไม่ตั้ง FIREBASE_WEB_API_KEY ใน GAS Script Properties' }
    }

    const resp = UrlFetchApp.fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${webApiKey}`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ email: email, password: password, returnSecureToken: false }),
      muteHttpExceptions: true
    })

    if (resp.getResponseCode() >= 300) {
      const text = resp.getContentText() || ''
      if (text.indexOf('EMAIL_EXISTS') !== -1) {
        return { success: false, error: 'email_exists', message: 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น' }
      }
      return { success: false, error: 'create_auth_failed', message: text }
    }

    const body = JSON.parse(resp.getContentText())
    return { success: true, uid: body.localId }
  } catch (err) {
    return { success: false, error: 'create_auth_exception', message: err.message || 'create auth failed' }
  }
}

function isTokenExpired(tokenTime, maxAgeHours) {
  try {
    const created = new Date(tokenTime).getTime()
    if (!created) return true
    const maxMs = Number(maxAgeHours) * 60 * 60 * 1000
    return Date.now() - created > maxMs
  } catch (err) {
    return true
  }
}

function generateSchoolId(name) {
  const n = String(name || 'school').toLowerCase().trim()
  const cleaned = n
    .replace(/[^a-z0-9\u0E00-\u0E7F\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const short = cleaned.slice(0, 24) || 'school'
  const suffix = new Date().getTime().toString().slice(-4)
  return `${short}-${suffix}`
}

/**
 * Admin ตั้งรหัสผ่านใหม่ให้ครู — อ่านจาก password_change_queue แล้วเรียก Firebase Auth REST API
 * Queue doc: { uid, new_password, teacher_name, admin_email, school_id, status: 'pending' }
 * Trigger: ทุก 1 นาที
 */
function processPasswordChangeQueue() {
  try {
    const queue = firestoreListDocuments('password_change_queue').filter(item => item.status === 'pending')
    if (queue.length === 0) return

    const props = PropertiesService.getScriptProperties()
    const webApiKey = props.getProperty('FIREBASE_WEB_API_KEY')
    if (!webApiKey) {
      Logger.log('❌ processPasswordChangeQueue: ไม่พบ FIREBASE_WEB_API_KEY ใน Script Properties')
      return
    }

    queue.forEach(item => {
      try {
        const uid = String(item.uid || '').trim()
        const newPassword = String(item.new_password || '').trim()
        if (!uid || newPassword.length < 6) {
          firestorePatchDocument(item.__name, {
            status: 'failed',
            error: 'invalid_data',
            updatedAt: new Date().toISOString()
          })
          return
        }

        // เปลี่ยนรหัสผ่านด้วย Firebase Auth REST API
        const resp = UrlFetchApp.fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${webApiKey}`,
          {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({ localId: uid, password: newPassword }),
            muteHttpExceptions: true
          }
        )

        const nowIso = new Date().toISOString()
        if (resp.getResponseCode() >= 300) {
          const errText = resp.getContentText() || 'unknown'
          Logger.log(`❌ เปลี่ยนรหัสผ่านล้มเหลว uid=${uid}: ${errText}`)
          firestorePatchDocument(item.__name, { status: 'failed', error: errText, updatedAt: nowIso })
          return
        }

        // สำเร็จ — ลบรหัสผ่านออกจาก doc ทันที
        firestorePatchDocument(item.__name, {
          status: 'done',
          new_password: '',
          processedAt: nowIso
        })
        Logger.log(`✅ เปลี่ยนรหัสผ่านสำเร็จ uid=${uid} teacher=${item.teacher_name || ''}`)
      } catch (err) {
        firestorePatchDocument(item.__name, {
          status: 'failed',
          error: err.message || 'exception',
          updatedAt: new Date().toISOString()
        })
        Logger.log(`❌ processPasswordChangeQueue exception uid=${item.uid}: ${err.message}`)
      }
    })
  } catch (e) {
    Logger.log(`❌ processPasswordChangeQueue error: ${e.message}`)
  }
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
}

/**
 * ส่ง Email Queue สำหรับการแจ้งเตือนสิทธิ์
 */
function runEmailQueue() {
  try {
    const queue = firestoreListDocuments('email_queue').filter(item => item.status === 'pending')
    if (queue.length === 0) return

    queue.forEach(item => {
      try {
        MailApp.sendEmail({
          to: item.to,
          subject: item.subject,
          htmlBody: item.htmlBody
        })

        firestorePatchDocument(item.__name, {
          status: 'sent',
          sentAt: new Date().toISOString()
        })
        Logger.log(`✅ ส่งอีเมลหา ${item.to} สำเร็จ`)
      } catch (err) {
        firestorePatchDocument(item.__name, {
          status: 'failed',
          errorMessage: err.message || 'unknown error',
          failedAt: new Date().toISOString()
        })
        Logger.log(`❌ ส่งอีเมลหา ${item.to} ล้มเหลว: ${err.message}`)
      }
    })
  } catch (e) {
    Logger.log(`❌ runEmailQueue error: ${e.message}`)
  }
}

/**
 * ส่ง notification queue ทุก 5 นาที
 * ⚠️ GAS รับ payload สำเร็จรูปจาก Vue3 ไม่ต้อง join ข้อมูลเพิ่ม
 */
function runNotifyQueue() {
  try {
    const schools = getActiveSchools()
    schools.forEach(school => {
      const queue = getPendingQueue(school.school_id)
      if (!queue || queue.length === 0) return

      const secrets = getSchoolSecrets(school.school_id)
      queue.forEach(item => {
        try {
          if (item.channel === 'line' || item.channel === 'both') {
            sendLineMessage(secrets.line_channel_token, item.recipient.line_user_id, item.message)
          }
          if (item.channel === 'telegram' || item.channel === 'both') {
            sendTelegramMessage(secrets.telegram_bot_token, item.recipient.telegram_chat_id, item.message)
          }
          updateQueueStatus(school.school_id, item.queue_id, 'sent')
        } catch (e) {
          updateQueueStatus(school.school_id, item.queue_id, 'failed', e.message)
          Logger.log(`❌ ส่งไม่สำเร็จ queue: ${item.queue_id} — ${e.message}`)
        }
      })
    })
  } catch (e) {
    Logger.log(`❌ runNotifyQueue error: ${e.message}`)
  }
}

function preGenLogs() {
  Logger.log('🕐 Pre-gen teaching logs 00:01 น. — ใช้ Firebase Cloud Scheduler แทน')
  // หมายเหตุ: ฟังก์ชันนี้สำรองไว้
  // ระบบหลักใช้ Firebase Cloud Scheduler + Firebase Functions
}

function dailySummary() {
  Logger.log('📊 สร้าง daily summary queue 16:00 น.')
  // TODO: วน schools → สร้าง notification_queue สำหรับ daily_summary
}

function weeklySummary() {
  Logger.log('📅 สร้าง weekly summary queue ทุกศุกร์')
  // TODO: วน schools → สร้าง notification_queue สำหรับ weekly_summary
}

// ===== FIREBASE HELPERS =====

/**
 * อ่าน school_secrets ผ่าน Service Account
 * Client อ่านไม่ได้เพราะ Security Rules: .read = false
 */
function getSchoolSecrets(schoolId) {
  const token = getServiceAccountToken()
  const masterDbUrl = PropertiesService.getScriptProperties().getProperty('MASTER_DB_URL')
  const url = `${masterDbUrl}/school_secrets/${schoolId}.json?access_token=${token}`
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  if (resp.getResponseCode() !== 200) throw new Error(`ไม่สามารถอ่าน school_secrets: ${resp.getContentText()}`)
  return JSON.parse(resp.getContentText())
}

function getActiveSchools() {
  const token = getServiceAccountToken()
  const masterDbUrl = PropertiesService.getScriptProperties().getProperty('MASTER_DB_URL')
  const url = `${masterDbUrl}/registry/schools.json?access_token=${token}&orderBy="is_active"&equalTo=true`
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  const data = JSON.parse(resp.getContentText())
  return data ? Object.values(data) : []
}

function getPendingQueue(schoolId) {
  const token = getServiceAccountToken()
  const schoolDbUrl = getSchoolDbUrl(schoolId)
  const url = `${schoolDbUrl}/notification_queue.json?access_token=${token}&orderBy="status"&equalTo="pending"`
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  const data = JSON.parse(resp.getContentText())
  return data ? Object.entries(data).map(([id, v]) => ({ queue_id: id, ...v })) : []
}

function updateQueueStatus(schoolId, queueId, status, errorMsg = null) {
  const token = getServiceAccountToken()
  const schoolDbUrl = getSchoolDbUrl(schoolId)
  const url = `${schoolDbUrl}/notification_queue/${queueId}.json?access_token=${token}`
  const payload = { status, sent_at: Date.now(), error_msg: errorMsg }
  UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  })
}

function getSchoolDbUrl(schoolId) {
  const secrets = getSchoolSecrets(schoolId)
  return secrets.firebase_school_db_url
}

// ===== OAuth2 Service Account =====

function getServiceAccountToken() {
  const props = PropertiesService.getScriptProperties()
  const saKeyJson = props.getProperty('FIREBASE_SERVICE_ACCOUNT_KEY')
  if (!saKeyJson) throw new Error('ไม่พบ FIREBASE_SERVICE_ACCOUNT_KEY ใน Script Properties')

  const saKey = JSON.parse(saKeyJson)
  const now = Math.floor(Date.now() / 1000)
  const header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: saKey.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }))

  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(`${header}.${claim}`, saKey.private_key)
  )
  const jwt = `${header}.${claim}.${signature}`

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })

  return JSON.parse(resp.getContentText()).access_token
}

function getFirestoreBaseUrl() {
  const props = PropertiesService.getScriptProperties()
  const saKeyJson = props.getProperty('FIREBASE_SERVICE_ACCOUNT_KEY')
  if (!saKeyJson) throw new Error('ไม่พบ FIREBASE_SERVICE_ACCOUNT_KEY ใน Script Properties')
  const saKey = JSON.parse(saKeyJson)
  return `https://firestore.googleapis.com/v1/projects/${saKey.project_id}/databases/(default)/documents`
}

function firestoreListDocuments(collectionName) {
  const token = getServiceAccountToken()
  const url = `${getFirestoreBaseUrl()}/${collectionName}`
  const resp = UrlFetchApp.fetch(url, { headers: { Authorization: `Bearer ${token}` }, muteHttpExceptions: true })
  if (resp.getResponseCode() !== 200) {
    throw new Error(`firestoreListDocuments failed: ${resp.getContentText()}`)
  }
  const data = JSON.parse(resp.getContentText())
  return (data.documents || []).map(decodeFirestoreDocument)
}

function firestoreCreateDocument(collectionName, payload, documentId) {
  const token = getServiceAccountToken()
  const url = documentId
    ? `${getFirestoreBaseUrl()}/${collectionName}?documentId=${encodeURIComponent(documentId)}`
    : `${getFirestoreBaseUrl()}/${collectionName}`
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({ fields: encodeFirestoreFields(payload) }),
    muteHttpExceptions: true
  })
  if (resp.getResponseCode() >= 300) {
    throw new Error(`firestoreCreateDocument failed: ${resp.getContentText()}`)
  }
  return JSON.parse(resp.getContentText())
}

function firestorePatchDocument(documentName, payload) {
  const token = getServiceAccountToken()
  const fieldPaths = Object.keys(payload)
    .map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join('&')
  const url = `https://firestore.googleapis.com/v1/${documentName}?${fieldPaths}`
  const resp = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({ fields: encodeFirestoreFields(payload) }),
    muteHttpExceptions: true
  })
  if (resp.getResponseCode() >= 300) {
    throw new Error(`firestorePatchDocument failed: ${resp.getContentText()}`)
  }
  return JSON.parse(resp.getContentText())
}

function decodeFirestoreDocument(doc) {
  const fields = doc.fields || {}
  const data = { __name: doc.name }
  Object.keys(fields).forEach(key => {
    data[key] = decodeFirestoreValue(fields[key])
  })
  return data
}

function decodeFirestoreValue(value) {
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue)
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue)
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null
  if (value.mapValue) {
    const mapData = {}
    const innerFields = value.mapValue.fields || {}
    Object.keys(innerFields).forEach(key => {
      mapData[key] = decodeFirestoreValue(innerFields[key])
    })
    return mapData
  }
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue)
  }
  return null
}

function encodeFirestoreFields(data) {
  const fields = {}
  Object.keys(data).forEach(key => {
    fields[key] = encodeFirestoreValue(data[key])
  })
  return fields
}

function encodeFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFirestoreFields(value) } }
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return { timestampValue: value }
  }
  return { stringValue: String(value) }
}

// ===== LINE & TELEGRAM =====

function sendLineMessage(token, userId, message) {
  if (!userId || !token) return
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: `${message.title}\n${message.body}\n${message.url}` }]
    }),
    muteHttpExceptions: true
  })
}

function sendTelegramMessage(botToken, chatId, message) {
  if (!chatId || !botToken) return
  UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: `${message.title}\n${message.body}\n${message.url}`,
      parse_mode: 'HTML'
    }),
    muteHttpExceptions: true
  })
}
