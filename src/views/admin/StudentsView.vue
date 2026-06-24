<template>
  <AppLayout>
    <div class="p-6 students-surface" v-loading="loading">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">👨‍🎓 นักเรียน</h1>
            <p class="text-white/80 text-sm mt-1">จัดการข้อมูลนักเรียนทั้งหมด</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <el-button @click="triggerImport"
              style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า Excel
            </el-button>
            <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleImportFile" />
            <el-button @click="exportExcel"
              style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก Excel
            </el-button>
            <el-button @click="handlePrint"
              style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              🖨️ พิมพ์
            </el-button>
            <el-button @click="openBulkPhotoDialog"
              style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white">
              🖼 Bulk อัพภาพ
            </el-button>
            <el-button v-if="canAddStudent" type="primary" @click="openDialog()"
              style="background:rgba(255,255,255,0.3);border-color:rgba(255,255,255,0.6);color:white;font-weight:600">
              + เพิ่มนักเรียน
            </el-button>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-4 md:grid-cols-7 gap-3 mb-5">
        <div class="stat-card" style="background:linear-gradient(135deg,#667eea,#764ba2)">
          <div class="stat-value">{{ students.length }}</div>
          <div class="stat-label">ทั้งหมด</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#11998e,#38ef7d)">
          <div class="stat-value">{{ countByStatus('เรียนอยู่') }}</div>
          <div class="stat-label">เรียนอยู่</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#f7971e,#ffd200)">
          <div class="stat-value">{{ countByStatus('พักการเรียน') }}</div>
          <div class="stat-label">พักการเรียน</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#f953c6,#b91d73)">
          <div class="stat-value">{{ countByStatus('ย้ายออก') }}</div>
          <div class="stat-label">ย้ายออก</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#606c88,#3f4c6b)">
          <div class="stat-value">{{ countByStatus('จบ/ออก') }}</div>
          <div class="stat-label">จบ/ออก</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">
          <div class="stat-value">{{ activeStudents.filter(s => s.gender === 'ชาย').length }}</div>
          <div class="stat-label">ชาย (active)</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#f093fb,#f5576c)">
          <div class="stat-value">{{ activeStudents.filter(s => s.gender === 'หญิง').length }}</div>
          <div class="stat-label">หญิง (active)</div>
        </div>
      </div>

      <!-- Status Filter Chips -->
      <div v-if="isAdmin" class="flex gap-2 mb-4 flex-wrap">
        <el-tag
          v-for="s in STATUS_FILTER_OPTIONS" :key="s.value"
          :type="filterStatus === s.value ? '' : 'info'"
          :effect="filterStatus === s.value ? 'dark' : 'plain'"
          class="cursor-pointer select-none"
          size="large"
          @click="filterStatus = s.value"
        >{{ s.label }}</el-tag>
      </div>

      <!-- Filter Bar -->
      <div class="flex gap-3 mb-4 flex-wrap">
        <el-input v-model="searchText" placeholder="ค้นหาชื่อ, รหัส..." clearable style="width:260px">
          <template #prefix><span class="text-gray-400">🔍</span></template>
        </el-input>
        <el-select v-model="filterClass" placeholder="ทุกห้อง" clearable style="width:160px" filterable>
          <el-option v-for="c in classes" :key="c.class_id" :label="c.class_id" :value="c.class_id" />
        </el-select>
        <el-select v-model="filterGender" placeholder="ทุกเพศ" clearable style="width:120px">
          <el-option label="ชาย" value="ชาย" />
          <el-option label="หญิง" value="หญิง" />
        </el-select>
      </div>

      <!-- Bulk Actions -->
      <div v-if="isAdmin" class="flex items-center gap-2 mb-3 flex-wrap">
        <el-button size="small" @click="tableRef?.toggleAllSelection()">เลือกทั้งหมด</el-button>
        <el-button size="small" @click="tableRef?.clearSelection()">ยกเลิกเลือก</el-button>
        <el-button size="small" type="warning" plain @click="openResetBehaviorScoreDialog">
          ⭐ เซ็ตคะแนนความประพฤติ {{ selectedRows.length ? `(${selectedRows.length} คน)` : '(ทั้งหมดตามตัวกรอง)' }}
        </el-button>
        <el-button size="small" type="danger" :disabled="!selectedRows.length" @click="deleteSelected">
          🗑️ ลบที่เลือก ({{ selectedRows.length }})
        </el-button>
        <el-button size="small" type="danger" plain @click="deleteAll">❌ ลบทั้งหมด</el-button>
      </div>

      <!-- Table -->
      <el-table
        ref="tableRef"
        :data="filteredStudents"
        border stripe
        v-loading="loading"
        @selection-change="onSelectionChange"
        :header-cell-style="{ background:'#4f46e5', color:'white', fontWeight:'600', fontSize:'13px' }"
        style="width:100%"
        row-key="student_id"
      >
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column label="รูป" width="64" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.photo_url"
              :src="fixPhotoUrl(row.photo_url)"
              :preview-src-list="[fixPhotoUrl(row.photo_url)]"
              :preview-teleported="true"
              fit="cover"
              class="w-9 h-9 rounded-full mx-auto border border-gray-200 block"
              style="cursor:zoom-in"
            >
              <template #error>
                <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-400 text-xs font-bold">
                  {{ (row.name || '?').charAt(0) }}
                </div>
              </template>
            </el-image>
            <div
              v-else
              class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-400 text-xs font-bold"
            >
              {{ (row.name || '?').charAt(0) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="seat_number" label="เลขที่" width="64" align="center" />
        <el-table-column prop="student_id" label="รหัส" width="110" />
        <el-table-column label="ชื่อ-นามสกุล" min-width="200">
          <template #default="{ row }">
            <span class="font-medium">{{ row.prefix }}{{ row.name }} {{ row.surname }}</span>
          </template>
        </el-table-column>
        <el-table-column label="เพศ" width="72" align="center">
          <template #default="{ row }">
            <el-tag :type="row.gender === 'ชาย' ? 'primary' : 'danger'" size="small">{{ row.gender }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="class_id" label="ห้อง" width="90" align="center" />
        <el-table-column label="ความประพฤติ" width="100" align="center">
          <template #default="{ row }">
            <span :class="(row.total_behavior_score ?? 0) < -50 ? 'text-red-500 font-bold' : 'text-green-600 font-medium'">
              {{ row.total_behavior_score ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="สถานะ" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.student_status)" size="small">
              {{ row.student_status || 'เรียนอยู่' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="จัดการ" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <template v-if="canManageStudent(row)">
              <el-button size="small" type="primary" plain @click="openDialog(row)">แก้ไข</el-button>
              <el-button size="small" type="warning" plain @click="openStatusDialog(row)">สถานะ</el-button>
              <el-button size="small" type="danger" plain @click="confirmDelete(row)">ลบ</el-button>
            </template>
            <span v-else class="text-xs text-gray-400">เฉพาะที่ปรึกษา</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- ==================== Add/Edit Dialog ==================== -->
      <el-dialog
        v-model="dialogVisible"
        :title="editingStudent ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'"
        width="680px"
        destroy-on-close
      >
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
          <el-tabs v-model="activeTab" class="dialog-tabs">

            <!-- Tab 1: ข้อมูลทั่วไป -->
            <el-tab-pane label="📋 ข้อมูลทั่วไป" name="general">
              <div class="grid grid-cols-2 gap-x-4">
                <el-form-item label="ห้องเรียน" prop="class_id" class="col-span-2">
                  <el-select v-model="form.class_id" class="w-full" filterable placeholder="เลือกห้องเรียน" @change="onClassChange">
                    <el-option v-for="c in manageableClasses" :key="c.class_id" :label="c.class_id" :value="c.class_id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="สถานะนักเรียน">
                  <el-select v-model="form.student_status" class="w-full">
                    <el-option v-for="s in STUDENT_STATUS_OPTIONS" :key="s" :label="s" :value="s" />
                  </el-select>
                </el-form-item>
                <el-form-item label="เลขที่">
                  <el-input-number v-model="form.seat_number" :min="1" :max="60" class="w-full" />
                </el-form-item>
                <el-form-item label="รหัสนักเรียน" prop="student_id">
                  <el-input v-model="form.student_id" :disabled="!!editingStudent" placeholder="เช่น 35123" />
                </el-form-item>
                <el-form-item label="คำนำหน้า" prop="prefix">
                  <el-select v-model="form.prefix" class="w-full" @change="v => { const g = genderFromPrefix(v); if (g) form.gender = g }">
                    <el-option v-for="p in STUDENT_PREFIXES" :key="p" :label="p" :value="p" />
                  </el-select>
                </el-form-item>
                <el-form-item label="ชื่อ" prop="name">
                  <el-input v-model="form.name" placeholder="ชื่อจริง" />
                </el-form-item>
                <el-form-item label="นามสกุล" prop="surname">
                  <el-input v-model="form.surname" placeholder="นามสกุล" />
                </el-form-item>
                <el-form-item label="เพศ" prop="gender">
                  <el-radio-group v-model="form.gender">
                    <el-radio value="ชาย">ชาย</el-radio>
                    <el-radio value="หญิง">หญิง</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="วันเกิด">
                  <el-date-picker v-model="form.birth_date" type="date" placeholder="วันเกิด" class="w-full" value-format="YYYY-MM-DD" />
                </el-form-item>
                <el-form-item label="เลขบัตรประชาชน">
                  <el-input v-model="form.national_id" placeholder="13 หลัก" maxlength="13" />
                </el-form-item>
                <el-form-item label="คะแนนความประพฤติปัจจุบัน">
                  <el-input-number v-model="form.total_behavior_score" :disabled="!isAdmin" class="w-full" />
                </el-form-item>
              </div>

              <!-- รูปภาพ -->
              <div class="photo-section mt-2 mb-3">
                <div class="font-semibold text-gray-700 mb-2 text-sm">📷 รูปภาพนักเรียน</div>
                <div class="flex items-center gap-4">
                  <div class="photo-preview-box">
                    <el-image v-if="photoPreviewUrl || form.photo_url"
                      :src="fixPhotoUrl(photoPreviewUrl || form.photo_url)"
                      :preview-src-list="[fixPhotoUrl(photoPreviewUrl || form.photo_url)]"
                      :preview-teleported="true"
                      fit="cover"
                      class="w-20 h-20 rounded-lg border border-gray-200"
                      style="cursor:zoom-in"
                    >
                      <template #error>
                        <div class="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 border border-dashed border-gray-300">
                          <span class="text-2xl">👤</span>
                        </div>
                      </template>
                    </el-image>
                    <div v-else class="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 border border-dashed border-gray-300">
                      <span class="text-2xl">👤</span>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2">
                    <el-button size="small" @click="triggerPhotoUpload" :loading="uploadingPhoto">
                      📁 เลือกรูปภาพ
                    </el-button>
                    <el-button v-if="photoPreviewUrl || form.photo_url" size="small" type="danger" plain @click="clearPhoto">
                      ✕ ล้างรูป
                    </el-button>
                    <span class="text-xs text-gray-400">ขนาดสูงสุด 800px, JPEG</span>
                  </div>
                </div>
                <input ref="photoInputRef" type="file" accept="image/*" class="hidden" @change="onPhotoSelected" />
              </div>

              <el-form-item label="หมายเหตุ">
                <el-input v-model="form.note" type="textarea" :rows="2" placeholder="หมายเหตุเพิ่มเติม" />
              </el-form-item>
            </el-tab-pane>

            <!-- Tab 2: ข้อมูลติดต่อ -->
            <el-tab-pane label="📞 ข้อมูลติดต่อ" name="contact">
              <div class="grid grid-cols-2 gap-x-4">
                <el-form-item label="โทรศัพท์">
                  <el-input v-model="form.contact.phone" placeholder="0xx-xxx-xxxx" />
                </el-form-item>
                <el-form-item label="LINE ID">
                  <el-input v-model="form.contact.line_id" placeholder="LINE ID" />
                </el-form-item>
                <el-form-item label="อีเมล">
                  <el-input v-model="form.contact.email" placeholder="email@example.com" type="email" />
                </el-form-item>
                <el-form-item label="Telegram">
                  <el-input v-model="form.contact.telegram" placeholder="@username" />
                </el-form-item>
                <el-form-item label="ที่อยู่" class="col-span-2">
                  <el-input v-model="form.contact.address" type="textarea" :rows="2" placeholder="ที่อยู่" />
                </el-form-item>
              </div>
            </el-tab-pane>

            <!-- Tab 3: ผู้ปกครอง -->
            <el-tab-pane label="👨‍👩‍👧 ผู้ปกครอง" name="guardian">
              <!-- ผู้ปกครองหลัก -->
              <div class="guardian-section mb-4">
                <div class="guardian-header">
                  <span class="guardian-title">ผู้ปกครองหลัก</span>
                </div>
                <div class="grid grid-cols-2 gap-x-4 mt-3">
                  <el-form-item label="ชื่อ-นามสกุล">
                    <el-input v-model="form.guardian_primary.name" placeholder="ชื่อผู้ปกครอง" />
                  </el-form-item>
                  <el-form-item label="ความสัมพันธ์">
                    <el-select v-model="form.guardian_primary.relationship" class="w-full" allow-create filterable>
                      <el-option v-for="r in RELATIONSHIP_OPTIONS" :key="r" :label="r" :value="r" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="โทรศัพท์">
                    <el-input v-model="form.guardian_primary.phone" placeholder="0xx-xxx-xxxx" />
                  </el-form-item>
                  <el-form-item label="LINE ID">
                    <el-input v-model="form.guardian_primary.line_id" placeholder="LINE ID" />
                  </el-form-item>
                  <el-form-item label="อีเมล">
                    <el-input v-model="form.guardian_primary.email" placeholder="email@example.com" />
                  </el-form-item>
                  <el-form-item label="Telegram">
                    <el-input v-model="form.guardian_primary.telegram" placeholder="@username" />
                  </el-form-item>
                </div>
              </div>

              <!-- ผู้ปกครองที่ 2 -->
              <div class="guardian-section">
                <div class="guardian-header" style="background:linear-gradient(135deg,#f8f4ff,#ede9fe);border-left-color:#7c3aed">
                  <span class="guardian-title" style="color:#7c3aed">ผู้ปกครองที่ 2 (ไม่บังคับ)</span>
                </div>
                <div class="grid grid-cols-2 gap-x-4 mt-3">
                  <el-form-item label="ชื่อ-นามสกุล">
                    <el-input v-model="form.guardian_secondary.name" placeholder="ชื่อผู้ปกครอง" />
                  </el-form-item>
                  <el-form-item label="ความสัมพันธ์">
                    <el-select v-model="form.guardian_secondary.relationship" class="w-full" allow-create filterable>
                      <el-option v-for="r in RELATIONSHIP_OPTIONS" :key="r" :label="r" :value="r" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="โทรศัพท์">
                    <el-input v-model="form.guardian_secondary.phone" placeholder="0xx-xxx-xxxx" />
                  </el-form-item>
                  <el-form-item label="LINE ID">
                    <el-input v-model="form.guardian_secondary.line_id" placeholder="LINE ID" />
                  </el-form-item>
                  <el-form-item label="อีเมล">
                    <el-input v-model="form.guardian_secondary.email" placeholder="email@example.com" />
                  </el-form-item>
                  <el-form-item label="Telegram">
                    <el-input v-model="form.guardian_secondary.telegram" placeholder="@username" />
                  </el-form-item>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">💾 บันทึก</el-button>
        </template>
      </el-dialog>

      <!-- ==================== Status Change Dialog ==================== -->
      <el-dialog v-model="statusDialogVisible" title="เปลี่ยนสถานะนักเรียน" width="360px" destroy-on-close>
        <div v-if="statusTargetStudent" class="text-center py-2">
          <div class="font-semibold text-lg mb-4">
            {{ statusTargetStudent.prefix }}{{ statusTargetStudent.name }} {{ statusTargetStudent.surname }}
          </div>
          <div class="grid grid-cols-2 gap-3">
            <el-button
              v-for="s in STUDENT_STATUS_OPTIONS" :key="s"
              :type="statusTargetStudent.student_status === s ? 'primary' : 'default'"
              @click="changeStatus(s)"
              :loading="saving"
              class="h-12"
            >{{ s }}</el-button>
          </div>
        </div>
      </el-dialog>

      <!-- ==================== Bulk Photo Upload Dialog ==================== -->
      <el-dialog v-model="bulkPhotoDialogVisible" title="🖼 Bulk อัพโหลดรูปภาพนักเรียน" width="760px" destroy-on-close>
        <div class="mb-4">
          <div class="text-sm text-gray-600 mb-3">
            ตั้งชื่อไฟล์รูปภาพให้ตรงกับ <strong>รหัสนักเรียน</strong> (ไม่รวมนามสกุล)<br>
            เช่น <code class="bg-gray-100 px-1 rounded">12703.jpg</code>, <code class="bg-gray-100 px-1 rounded">35456.png</code>
          </div>
          <div class="flex gap-4 flex-wrap items-end mb-3">
            <div>
              <div class="text-sm font-medium text-gray-700 mb-1">เลือกไฟล์รูปภาพ (หลายไฟล์)</div>
              <input ref="bulkPhotoInputRef" type="file" accept="image/*" multiple @change="onBulkPhotoSelected" />
            </div>
            <el-form-item label="กรณีนักเรียนมีรูปอยู่แล้ว" class="mb-0">
              <el-radio-group v-model="bulkOverwriteMode">
                <el-radio value="replace">แทนที่ทั้งหมด</el-radio>
                <el-radio value="skip">ข้ามที่มีรูปแล้ว</el-radio>
              </el-radio-group>
            </el-form-item>
          </div>
          <div v-if="bulkPhotoFiles.length" class="text-sm text-gray-500 mb-2">
            เลือก {{ bulkPhotoFiles.length }} ไฟล์ · ตรงกัน {{ bulkMatchedCount }} รายการ · ไม่ตรง {{ bulkUnmatchedCount }} รายการ
          </div>
        </div>

        <el-table v-if="bulkPhotoFiles.length" :data="bulkPhotoPreview" border size="small" max-height="320">
          <el-table-column label="ไฟล์" min-width="160" prop="fileName" />
          <el-table-column label="รหัสนักเรียน" width="120" prop="studentId" />
          <el-table-column label="ชื่อนักเรียน" min-width="160">
            <template #default="{ row }">
              <span v-if="row.student">{{ row.student.prefix }}{{ row.student.name }} {{ row.student.surname }}</span>
              <span v-else class="text-red-400 text-xs">ไม่พบในระบบ</span>
            </template>
          </el-table-column>
          <el-table-column label="มีรูปแล้ว" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.student?.photo_url" type="warning" size="small">มีรูป</el-tag>
              <el-tag v-else-if="row.student" type="success" size="small">ไม่มีรูป</el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="สถานะ" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.uploadStatus === 'done'" type="success" size="small">✓ สำเร็จ</el-tag>
              <el-tag v-else-if="row.uploadStatus === 'skipped'" type="info" size="small">ข้าม</el-tag>
              <el-tag v-else-if="row.uploadStatus === 'error'" type="danger" size="small">ผิดพลาด</el-tag>
              <el-tag v-else-if="row.uploadStatus === 'uploading'" type="warning" size="small">กำลังอัพ...</el-tag>
              <el-tag v-else-if="!row.student" type="danger" size="small">ไม่ตรง</el-tag>
              <el-tag v-else type="info" size="small">รอ</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="!bulkPhotoFiles.length" class="text-center text-gray-400 py-8">
          เลือกไฟล์รูปภาพเพื่อดูตัวอย่าง
        </div>

        <template #footer>
          <el-button @click="bulkPhotoDialogVisible = false">ปิด</el-button>
          <el-button
            type="primary"
            :loading="bulkUploading"
            :disabled="!bulkMatchedCount"
            @click="startBulkUpload"
          >
            ⬆️ อัพโหลด {{ bulkMatchedCount }} ไฟล์
          </el-button>
        </template>
      </el-dialog>

      <!-- ==================== Import Preview Dialog ==================== -->
      <el-dialog v-model="importDialogVisible" title="ตรวจสอบข้อมูลนักเรียนนำเข้า" width="900px" destroy-on-close>
        <div class="mb-3 text-sm text-gray-600">
          พบข้อมูล <strong>{{ importRows.length }}</strong> รายการ
          <span v-if="importErrors.length" class="ml-2 text-red-500">มีข้อผิดพลาด {{ importErrors.length }} รายการ</span>
        </div>
        <div v-if="saving && importTotal > 0" class="mb-3">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>กำลังนำเข้า...</span>
            <span>{{ importProgress }} / {{ importTotal }} รายการ</span>
          </div>
          <el-progress :percentage="Math.round(importProgress / importTotal * 100)" :stroke-width="10" />
        </div>
        <el-table :data="importRows" border stripe max-height="400" size="small">
          <el-table-column prop="class_id" label="ห้อง" width="80" align="center" />
          <el-table-column prop="student_id" label="รหัส" width="100" />
          <el-table-column prop="seat_number" label="เลขที่" width="65" align="center" />
          <el-table-column label="ชื่อ-นามสกุล" min-width="160">
            <template #default="{ row }">{{ row.prefix }}{{ row.name }} {{ row.surname }}</template>
          </el-table-column>
          <el-table-column prop="gender" label="เพศ" width="70" align="center" />
          <el-table-column prop="parent_name" label="ผู้ปกครอง" width="130" />
          <el-table-column prop="total_behavior_score" label="คะแนน" width="70" align="center" />
          <el-table-column prop="gov_id" label="เลขบัตร" width="130" />
          <el-table-column label="สถานะ" width="140" align="center">
            <template #default="{ row }">
              <el-tag v-if="row._error" type="danger" size="small">❌ {{ row._error }}</el-tag>
              <template v-else-if="row._isUpdate">
                <el-tag type="warning" size="small">อัปเดต</el-tag>
                <span class="text-xs text-gray-400 ml-1">(match {{ row._matchedBy }})</span>
              </template>
              <el-tag v-else type="success" size="small">✅ ใหม่</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <template #footer>
          <el-button @click="importDialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" :disabled="importRows.every(r => r._error)" @click="confirmImport">
            นำเข้าข้อมูลที่ถูกต้อง ({{ importRows.filter(r => !r._error).length }} รายการ)
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>


<script setup>
function genderFromPrefix(prefix) {
  if (['เด็กชาย', 'นาย'].includes(prefix)) return 'ชาย'
  if (['เด็กหญิง', 'นางสาว', 'นาง'].includes(prefix)) return 'หญิง'
  return ''
}

function fixPhotoUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  let id = ''
  let match = url.match(/[?&]id=([\w-]{20,})/)
  if (match) id = match[1]
  if (!id) {
    match = url.match(/\/d\/([\w-]{20,})/)
    if (match) id = match[1]
  }
  if (id) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w400`
  }
  return url
}

import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { STUDENT_PREFIXES } from '@/utils/constants'
import { usePrintReport } from '@/composables/usePrintReport'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

const { getStudents, saveStudent, getClasses } = useSchoolDb()
const { printReport } = usePrintReport()

const authStore = useAuthStore()
const schoolStore = useSchoolStore()

const isAdmin = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))
const myTeacherId = computed(() => authStore.profile?.teacher_id || authStore.profile?.uid)

const manageableClasses = computed(() => {
  if (isAdmin.value) return classes.value
  return classes.value.filter(c => {
    const inArray = Array.isArray(c.homeroom_teacher_ids) && c.homeroom_teacher_ids.includes(myTeacherId.value)
    const isOldString = c.homeroom_teacher_id === myTeacherId.value
    return inArray || isOldString
  })
})

const canAddStudent = computed(() => isAdmin.value || manageableClasses.value.length > 0)

function canManageStudent(student) {
  if (isAdmin.value) return true
  return manageableClasses.value.some(c => c.class_id === student.class_id)
}

// ==================== Constants ====================
const STUDENT_STATUS_OPTIONS = ['เรียนอยู่', 'พักการเรียน', 'ย้ายออก', 'จบ/ออก']
const RELATIONSHIP_OPTIONS = ['บิดา', 'มารดา', 'บิดา/มารดา', 'ปู่/ย่า', 'ตา/ยาย', 'พี่/น้อง', 'อื่นๆ']
const STATUS_FILTER_OPTIONS = [
  { label: 'ทั้งหมด', value: '' },
  { label: 'เรียนอยู่', value: 'เรียนอยู่' },
  { label: 'พักการเรียน', value: 'พักการเรียน' },
  { label: 'ย้ายออก', value: 'ย้ายออก' },
  { label: 'จบ/ออก', value: 'จบ/ออก' },
]

// ==================== State ====================
const students = ref([])
const classes = ref([])
const loading = ref(false)
const saving = ref(false)

// Dialog state
const dialogVisible = ref(false)
const editingStudent = ref(null)
const formRef = ref()
const activeTab = ref('general')

// Status dialog
const statusDialogVisible = ref(false)
const statusTargetStudent = ref(null)

// Import
const fileInputRef = ref()
const importDialogVisible = ref(false)
const importRows = ref([])
const importErrors = ref([])
const importProgress = ref(0)
const importTotal = ref(0)

// Photo upload (in dialog)
const photoInputRef = ref()
const photoPreviewUrl = ref('')
const pendingPhotoFile = ref(null)
const uploadingPhoto = ref(false)

// Bulk photo upload
const bulkPhotoDialogVisible = ref(false)
const bulkPhotoInputRef = ref()
const bulkPhotoFiles = ref([])
const bulkOverwriteMode = ref('skip')
const bulkUploading = ref(false)
const bulkPhotoPreview = ref([])

// Filters
const searchText = ref('')
const filterClass = ref('')
const filterGender = ref('')
const filterStatus = ref('')
const tableRef = ref()
const selectedRows = ref([])

// ==================== Form Model ====================
const emptyForm = () => ({
  class_id: '',
  class_name_snapshot: '',
  student_id: '',
  seat_number: null,
  prefix: 'เด็กชาย',
  name: '',
  surname: '',
  gender: 'ชาย',
  birth_date: '',
  national_id: '',
  behavior_carry_over: 0,
  total_behavior_score: 0,
  general_behavior_score: 0,
  attendance_behavior_score: 0,
  learning_behavior_score: 0,
  note: '',
  is_active: true,
  // Backward compat
  parent_name: '',
  parent_phone: '',
  // New fields
  student_status: 'เรียนอยู่',
  photo_url: '',
  contact: { phone: '', line_id: '', email: '', telegram: '', address: '' },
  guardian_primary: { name: '', relationship: 'บิดา/มารดา', phone: '', line_id: '', email: '', telegram: '' },
  guardian_secondary: { name: '', relationship: '', phone: '', line_id: '', email: '', telegram: '' },
})

const form = reactive(emptyForm())

const rules = {
  class_id: [{ required: true, message: 'กรุณาเลือกห้องเรียน', trigger: 'change' }],
  student_id: [{ required: true, message: 'กรุณากรอกรหัสนักเรียน', trigger: 'blur' }],
  prefix: [{ required: true, message: 'กรุณาเลือกคำนำหน้า', trigger: 'change' }],
  name: [{ required: true, message: 'กรุณากรอกชื่อ', trigger: 'blur' }],
  surname: [{ required: true, message: 'กรุณากรอกนามสกุล', trigger: 'blur' }],
  gender: [{ required: true, message: 'กรุณาเลือกเพศ', trigger: 'change' }],
}

// ==================== Computed ====================
const activeStudents = computed(() => students.value.filter(s => s.student_status === 'เรียนอยู่' || !s.student_status))
const countByStatus = (status) => students.value.filter(s => (s.student_status || 'เรียนอยู่') === status).length

const filteredStudents = computed(() => {
  return students.value.filter(s => {
    const isStudentActive = (s.student_status || 'เรียนอยู่') === 'เรียนอยู่'
    
    // ถ้าไม่ใช่ Admin ให้เห็นเฉพาะเด็กที่เรียนอยู่เท่านั้น
    if (!isAdmin.value && !isStudentActive) {
      return false
    }

    const fullName = `${s.prefix || ''}${s.name || ''} ${s.surname || ''}`
    const matchSearch = !searchText.value ||
      fullName.includes(searchText.value) ||
      (s.student_id || '').includes(searchText.value)
    const matchClass = !filterClass.value || s.class_id === filterClass.value
    const matchGender = !filterGender.value || s.gender === filterGender.value
    const matchStatus = !filterStatus.value || (s.student_status || 'เรียนอยู่') === filterStatus.value
    return matchSearch && matchClass && matchGender && matchStatus
  }).sort((a, b) => {
    // 1. เรียงตามห้องเรียนก่อน (แบบรองรับตัวเลข เช่น ม.1/2 มาก่อน ม.1/10)
    const classA = String(a.class_id || '')
    const classB = String(b.class_id || '')
    const classCompare = classA.localeCompare(classB, 'th', { numeric: true })
    if (classCompare !== 0) return classCompare
    // 2. ถ้าห้องเดียวกัน เรียงตามเลขที่
    const numA = parseInt(a.seat_number, 10); const valA = isNaN(numA) ? 999 : numA
    const numB = parseInt(b.seat_number, 10); const valB = isNaN(numB) ? 999 : numB
    return valA - valB
  })
})

const bulkMatchedCount = computed(() =>
  bulkPhotoPreview.value.filter(r => r.student && (bulkOverwriteMode.value === 'replace' || !r.student.photo_url)).length
)
const bulkUnmatchedCount = computed(() => bulkPhotoPreview.value.filter(r => !r.student).length)

// ==================== Helpers ====================
function statusTagType(status) {
  const map = { 'เรียนอยู่': 'success', 'พักการเรียน': 'warning', 'ย้ายออก': 'danger', 'จบ/ออก': 'info' }
  return map[status] || 'success'
}

function compressToBase64(file, maxW = 800, maxH = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('โหลดรูปภาพไม่สำเร็จ')) }
    img.src = url
  })
}

async function loadGasSettings() {
  const { data, error } = await supabase.from('schools').select('settings').eq('id', authStore.schoolId).single()
  if (error || !data) throw new Error('ไม่พบการตั้งค่า กรุณาตั้งค่า GAS Upload Web App URL หรือ GAS Web App URL ในหน้าตั้งค่าบันทึกเข้าสอน')
  const tl = data.settings?.teaching_log_settings || {}
  const gasUrl = (tl.gas_upload_web_app_url || tl.gas_web_app_url || '').trim()
  const folderId = (tl.gdrive_folder_id || '').trim()
  if (!gasUrl) throw new Error('กรุณาตั้งค่า GAS Upload Web App URL หรือ GAS Web App URL ในหน้าตั้งค่าบันทึกเข้าสอน')
  if (!folderId) throw new Error('กรุณาตั้งค่า Google Drive Folder ID ในหน้าตั้งค่าบันทึกเข้าสอน')
  return { gasUrl, folderId }
}

async function uploadPhotoViaGAS(studentId, base64DataUrl, folderId, gasUrl) {
  const base64Data = base64DataUrl.split(',')[1]
  const res = await fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      route: 'upload-student-photo',
      folderId,
      fileName: studentId + '.jpg',
      mimeType: 'image/jpeg',
      base64Data,
      studentId,
    })
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error('GAS ตอบกลับผิดรูปแบบ') }
  if (!data.success) throw new Error(data.error || 'อัพโหลดไม่สำเร็จ')
  return data.url
}

// ==================== Photo Upload in Dialog ====================
function triggerPhotoUpload() {
  photoInputRef.value?.click()
}

async function onPhotoSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  uploadingPhoto.value = true
  try {
    const dataUrl = await compressToBase64(file)
    photoPreviewUrl.value = dataUrl
    pendingPhotoFile.value = dataUrl
  } catch (err) {
    ElMessage.error('ไม่สามารถโหลดรูปภาพ: ' + err.message)
  } finally {
    uploadingPhoto.value = false
  }
}

function clearPhoto() {
  photoPreviewUrl.value = ''
  pendingPhotoFile.value = null
  form.photo_url = ''
}

// ==================== Bulk Photo Upload ====================
function openBulkPhotoDialog() {
  bulkPhotoFiles.value = []
  bulkPhotoPreview.value = []
  bulkUploading.value = false
  bulkPhotoDialogVisible.value = true
}

async function onBulkPhotoSelected(e) {
  const files = Array.from(e.target.files || [])
  bulkPhotoFiles.value = files
  const studentMap = new Map(students.value.map(s => [String(s.student_id), s]))
  bulkPhotoPreview.value = files.map(f => {
    const studentId = f.name.replace(/\.[^.]+$/, '')
    return {
      fileName: f.name,
      studentId,
      student: studentMap.get(studentId) || null,
      file: f,
      uploadStatus: null,
    }
  })
}

async function startBulkUpload() {
  if (!bulkMatchedCount.value) return
  bulkUploading.value = true

  let settings
  try {
    settings = await loadGasSettings()
  } catch (err) {
    ElMessage.error(err.message)
    bulkUploading.value = false
    return
  }

  let doneCount = 0, failCount = 0

  for (const row of bulkPhotoPreview.value) {
    if (!row.student) continue
    if (bulkOverwriteMode.value === 'skip' && row.student.photo_url) {
      row.uploadStatus = 'skipped'
      continue
    }
    row.uploadStatus = 'uploading'
    try {
      const base64DataUrl = await compressToBase64(row.file)
      const photoUrl = await uploadPhotoViaGAS(row.studentId, base64DataUrl, settings.folderId, settings.gasUrl)
      // บันทึก URL ลง Firestore
      const idx = students.value.findIndex(s => s.student_id === row.studentId)
      if (idx !== -1) {
        const updated = { ...students.value[idx], photo_url: photoUrl }
        await saveStudent(updated)
        students.value[idx] = updated
        row.student = updated
      }
      row.uploadStatus = 'done'
      doneCount++
    } catch (err) {
      row.uploadStatus = 'error'
      failCount++
    }
  }

  bulkUploading.value = false
  ElMessage.success(`อัพโหลดสำเร็จ ${doneCount} ไฟล์${failCount ? ` · ล้มเหลว ${failCount} ไฟล์` : ''}`)
  if (doneCount > 0) students.value = await getStudents()
}

// ==================== CRUD ====================
let _studentChannel = null

async function reloadStudents() {
  students.value = await getStudents()
}

onMounted(async () => {
  loading.value = true
  try {
    const [studentsData, classesData] = await Promise.all([getStudents(), getClasses()])
    students.value = studentsData
    classes.value = classesData
  } finally {
    loading.value = false
  }

  // Realtime: อัปเดตทันทีเมื่อ students table เปลี่ยนจากอุปกรณ์อื่น
  _studentChannel = supabase
    .channel('admin_students_live')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'students',
      filter: `school_id=eq.${authStore.schoolId}`,
    }, () => { reloadStudents() })
    .subscribe()
})

onUnmounted(() => {
  if (_studentChannel) { supabase.removeChannel(_studentChannel); _studentChannel = null }
})

function onClassChange(classId) {
  const cls = classes.value.find(c => c.class_id === classId)
  form.class_name_snapshot = cls ? (cls.class_name || cls.class_id) : classId
}

function openDialog(student = null) {
  editingStudent.value = student
  activeTab.value = 'general'
  photoPreviewUrl.value = ''
  pendingPhotoFile.value = null

  if (student) {
    Object.assign(form, {
      class_id: student.class_id || '',
      class_name_snapshot: student.class_name_snapshot || '',
      student_id: student.student_id || '',
      seat_number: student.seat_number || null,
      prefix: student.prefix || 'เด็กชาย',
      name: student.name || '',
      surname: student.surname || '',
      gender: student.gender || 'ชาย',
      birth_date: student.birth_date || '',
      national_id: student.gov_id || student.national_id || '',
      behavior_carry_over: student.behavior_carry_over ?? 0,
      total_behavior_score: student.total_behavior_score ?? 0,
      general_behavior_score: student.general_behavior_score ?? 0,
      attendance_behavior_score: student.attendance_behavior_score ?? 0,
      learning_behavior_score: student.learning_behavior_score ?? 0,
      note: student.note || '',
      is_active: student.is_active !== false,
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      student_status: student.student_status || 'เรียนอยู่',
      photo_url: student.photo_url || '',
      contact: {
        phone: student.contact?.phone || '',
        line_id: student.contact?.line_id || '',
        email: student.contact?.email || '',
        telegram: student.contact?.telegram || '',
        address: student.contact?.address || '',
      },
      guardian_primary: {
        name: student.guardian_primary?.name || student.parent_name || '',
        relationship: student.guardian_primary?.relationship || 'บิดา/มารดา',
        phone: student.guardian_primary?.phone || student.parent_phone || '',
        line_id: student.guardian_primary?.line_id || '',
        email: student.guardian_primary?.email || '',
        telegram: student.guardian_primary?.telegram || '',
      },
      guardian_secondary: {
        name: student.guardian_secondary?.name || '',
        relationship: student.guardian_secondary?.relationship || '',
        phone: student.guardian_secondary?.phone || '',
        line_id: student.guardian_secondary?.line_id || '',
        email: student.guardian_secondary?.email || '',
        telegram: student.guardian_secondary?.telegram || '',
      },
    })
  } else {
    Object.assign(form, emptyForm())
  }
  dialogVisible.value = true
}

async function handleSave() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    const classExists = classes.value.find(c => c.class_id === form.class_id)
    if (!classExists) { ElMessage.error(`ไม่พบห้อง ${form.class_id} ในระบบ`); return }
    if (!editingStudent.value) {
      const exists = students.value.find(s => s.student_id === form.student_id)
      if (exists) { ElMessage.error('รหัสนักเรียนซ้ำ กรุณาใช้รหัสอื่น'); return }
    }

    saving.value = true
    try {
      // Upload photo if pending
      let photoUrl = form.photo_url
      if (pendingPhotoFile.value && form.student_id) {
        try {
          const settings = await loadGasSettings()
          photoUrl = await uploadPhotoViaGAS(form.student_id, pendingPhotoFile.value, settings.folderId, settings.gasUrl)
        } catch (err) {
          const confirmed = await ElMessageBox.confirm(
            `อัพโหลดรูปภาพไม่สำเร็จ: ${err.message}\nบันทึกข้อมูลต่อโดยไม่มีรูปภาพ?`,
            'แจ้งเตือน', { confirmButtonText: 'บันทึกต่อ', cancelButtonText: 'ยกเลิก', type: 'warning' }
          ).catch(() => false)
          if (!confirmed) { saving.value = false; return }
        }
      }

      // Build payload — backward compat: write parent_name/phone from guardian_primary
      const payload = {
        class_id: form.class_id,
        class_name_snapshot: form.class_name_snapshot,
        student_id: form.student_id,
        seat_number: form.seat_number,
        prefix: form.prefix,
        name: form.name,
        surname: form.surname,
        gender: form.gender,
        birth_date: form.birth_date,
        national_id: form.national_id,
        total_behavior_score: form.total_behavior_score,
        general_behavior_score: form.general_behavior_score ?? form.total_behavior_score,
        attendance_behavior_score: form.attendance_behavior_score ?? 0,
        learning_behavior_score: form.learning_behavior_score ?? 0,
        note: form.note,
        is_active: form.is_active,
        student_status: form.student_status || 'เรียนอยู่',
        photo_url: photoUrl || '',
        // Backward compat
        parent_name: form.guardian_primary.name || form.parent_name || '',
        parent_phone: form.guardian_primary.phone || form.parent_phone || '',
        // New fields
        contact: { ...form.contact },
        guardian_primary: { ...form.guardian_primary },
        guardian_secondary: { ...form.guardian_secondary },
      }

      await saveStudent(payload)

      ElMessage.success('บันทึกข้อมูลนักเรียนเรียบร้อย')
      students.value = await getStudents()
      dialogVisible.value = false
    } catch (e) {
      if (e !== 'cancel') ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      saving.value = false
    }
  })
}

function openStatusDialog(student) {
  statusTargetStudent.value = student
  statusDialogVisible.value = true
}

async function changeStatus(newStatus) {
  if (!statusTargetStudent.value) return
  saving.value = true
  try {
    const updated = { ...statusTargetStudent.value, student_status: newStatus }
    await saveStudent(updated)
    ElMessage.success(`เปลี่ยนสถานะเป็น "${newStatus}" เรียบร้อย`)
    students.value = await getStudents()
    statusTargetStudent.value = { ...statusTargetStudent.value, student_status: newStatus }
    statusDialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบนักเรียน "${row.prefix}${row.name} ${row.surname}" (${row.student_id})?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    loading.value = true
    await saveStudent({ ...row, is_active: false })
    ElMessage.success('ลบนักเรียนเรียบร้อย')
    students.value = await getStudents()
  } catch { /* cancelled */ } finally { loading.value = false }
}

function onSelectionChange(rows) { selectedRows.value = rows }

async function deleteSelected() {
  if (!selectedRows.value.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบ ${selectedRows.value.length} รายการที่เลือก?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    loading.value = true
    for (const row of selectedRows.value) await saveStudent({ ...row, is_active: false })
    selectedRows.value = []
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
    students.value = await getStudents()
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function openResetBehaviorScoreDialog() {
  const targetStudents = selectedRows.value.length > 0 ? selectedRows.value : filteredStudents.value
  if (!targetStudents.length) return
  try {
    const { value } = await ElMessageBox.prompt(
      `ตั้งค่าคะแนนความประพฤติให้นักเรียนที่เลือก (${targetStudents.length} คน)`,
      'ยืนยันการตั้งค่าคะแนน',
      {
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        inputPattern: /^-?\d+$/,
        inputErrorMessage: 'กรุณากรอกตัวเลขจำนวนเต็ม',
        inputValue: '0'
      }
    )
    const newScore = parseInt(value, 10)
    loading.value = true

    for (const row of targetStudents) {
      await saveStudent({
        ...row,
        behavior_carry_over: newScore,
        total_behavior_score: newScore,
        general_behavior_score: 0,
        attendance_behavior_score: 0,
        learning_behavior_score: 0,
      })
    }

    selectedRows.value = []
    ElMessage.success(`ตั้งค่าคะแนนเป็น ${newScore} เรียบร้อย`)
    students.value = await getStudents()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally { loading.value = false }
}

async function deleteAll() {
  const allRows = filteredStudents.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    for (const row of [...allRows]) await saveStudent({ ...row, is_active: false })
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
    students.value = await getStudents()
  } catch { /* cancelled */ } finally { loading.value = false }
}

// ==================== Import / Export ====================
function triggerImport() { fileInputRef.value?.click() }

function handleImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    if (rows.length < 2) { ElMessage.warning('ไม่พบข้อมูลในไฟล์'); return }
    const classSet = new Set(classes.value.map(c => c.class_id))

    // helper: คืน import value ถ้ามี ไม่งั้นใช้ค่าเดิม
    const pick = (importVal, existing) => {
      const v = importVal !== undefined && importVal !== null ? String(importVal).trim() : ''
      return v !== '' ? v : (existing ?? '')
    }
    const pickNum = (importVal, existing) => {
      const n = Number(importVal)
      return !isNaN(n) && String(importVal).trim() !== '' ? n : (existing ?? null)
    }
    const pickJson = (importVal, existing) => {
      const v = importVal !== undefined && importVal !== null ? String(importVal).trim() : ''
      if (!v) return existing || null
      try { return JSON.parse(v) } catch { return existing || null }
    }

    const parsed = rows.slice(1).filter(r => r.some(c => c)).map(r => {
      const student_id = String(r[1] || '').trim()
      const govIdRaw   = String(r[17] || '').trim()   // col 17 = เลขบัตรประชาชน

      // match ด้วย student_code ก่อน ถ้าไม่เจอให้ลอง gov_id
      let existingStudent = student_id
        ? students.value.find(s => s.student_id === student_id)
        : null
      if (!existingStudent && govIdRaw) {
        existingStudent = students.value.find(s => s.gov_id === govIdRaw)
      }

      const classId = pick(r[0], existingStudent?.class_id)
      const prefixRaw = pick(r[3], existingStudent?.prefix)

      const obj = {
        // ถ้า import ไม่มี student_id แต่เจอ existing ด้วย gov_id → ใช้ student_id เดิม
        student_id: student_id || existingStudent?.student_id || '',
        class_id: classId,
        class_name_snapshot: classId,
        seat_number: pickNum(r[2], existingStudent?.seat_number),
        prefix:      prefixRaw,
        name:        pick(r[4], existingStudent?.name),
        surname:     pick(r[5], existingStudent?.surname),
        gender:      genderFromPrefix(prefixRaw) || pick(r[6], existingStudent?.gender),
        birth_date:  pick(r[7], existingStudent?.birth_date),
        parent_name:  pick(r[8], existingStudent?.parent_name),
        parent_phone: pick(r[9], existingStudent?.parent_phone),
        general_behavior_score:    pickNum(r[10], existingStudent?.general_behavior_score ?? 0),
        attendance_behavior_score: pickNum(r[11], existingStudent?.attendance_behavior_score ?? 0),
        learning_behavior_score:   pickNum(r[12], existingStudent?.learning_behavior_score ?? 0),
        total_behavior_score:      pickNum(r[13], existingStudent?.total_behavior_score ?? 0),
        behavior_carry_over:       pickNum(r[14], existingStudent?.behavior_carry_over ?? 0),
        note:           pick(r[15], existingStudent?.note),
        student_status: pick(r[16], existingStudent?.student_status) || 'เรียนอยู่',
        gov_id: govIdRaw || existingStudent?.gov_id || null,
        photo_url:          pick(r[18], existingStudent?.photo_url),
        guardian_primary:   pickJson(r[19], existingStudent?.guardian_primary),
        guardian_secondary: pickJson(r[20], existingStudent?.guardian_secondary),
        contact:            pickJson(r[21], existingStudent?.contact),
        is_active: true,
        _isUpdate: !!existingStudent,
        _matchedBy: existingStudent
          ? (student_id && students.value.find(s => s.student_id === student_id) ? 'รหัส' : 'บัตรประชาชน')
          : null,
      }

      // คงข้อมูลที่ Excel ไม่ได้ส่งมา (ไฟล์เก่า < 22 คอลัมน์)
      if (existingStudent) {
        obj.id = existingStudent.id
      }

      let error = ''
      if (!obj.class_id) error = 'ไม่มีห้องเรียน'
      else if (!classSet.has(obj.class_id)) error = `ไม่พบห้อง ${obj.class_id}`
      else if (!obj.student_id) error = 'ไม่มีรหัสนักเรียน'
      else if (!obj.name) error = 'ไม่มีชื่อ'
      else if (!obj.surname) error = 'ไม่มีนามสกุล'
      if (error) obj._error = error
      return obj
    })
    importRows.value = parsed
    importErrors.value = parsed.filter(r => r._error)
    importDialogVisible.value = true
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function confirmImport() {
  const validRows = importRows.value.filter(r => !r._error)
  if (!validRows.length) return
  saving.value = true
  importProgress.value = 0
  importTotal.value = validRows.length
  let imported = 0
  const rowErrors = []
  try {
    for (const row of validRows) {
      const { _error, _isUpdate, _matchedBy, ...data } = row
      try {
        await saveStudent(data)
        imported++
      } catch (e) {
        rowErrors.push(`${data.student_id || '?'}: ${e.message}`)
      }
      importProgress.value++
    }

    students.value = await getStudents()
    importDialogVisible.value = false
    if (rowErrors.length) {
      ElMessage.warning({
        message: `นำเข้า ${imported} รายการ — ล้มเหลว ${rowErrors.length} รายการ\n${rowErrors.slice(0, 3).join('\n')}${rowErrors.length > 3 ? '...' : ''}`,
        duration: 8000,
      })
    } else {
      ElMessage.success(`นำเข้าข้อมูล ${imported} รายการเรียบร้อย`)
    }
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    saving.value = false
    importProgress.value = 0
    importTotal.value = 0
  }
}

function exportExcel() {
  const headers = [
    'ห้อง', 'รหัสนักเรียน', 'เลขที่', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'เพศ', 'วันเกิด',
    'ผู้ปกครอง', 'เบอร์ผู้ปกครอง',
    'คะแนนทั่วไป', 'คะแนนมาเรียน', 'คะแนนเรียนรู้', 'คะแนนรวม', 'สะสมยกมา',
    'หมายเหตุ', 'สถานะ', 'เลขบัตรประชาชน', 'รูปภาพ URL',
    'ผู้ปกครองหลัก', 'ผู้ปกครองรอง', 'ติดต่ออื่น',
  ]
  const rows = filteredStudents.value.map(s => [
    s.class_id, s.student_id, s.seat_number,
    s.prefix, s.name, s.surname, s.gender, s.birth_date,
    s.parent_name, s.parent_phone,
    s.general_behavior_score ?? 0,
    s.attendance_behavior_score ?? 0,
    s.learning_behavior_score ?? 0,
    s.total_behavior_score ?? 0,
    s.behavior_carry_over ?? 0,
    s.note, s.student_status || 'เรียนอยู่', s.gov_id || '', s.photo_url || '',
    s.guardian_primary ? JSON.stringify(s.guardian_primary) : '',
    s.guardian_secondary ? JSON.stringify(s.guardian_secondary) : '',
    s.contact ? JSON.stringify(s.contact) : '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน')
  XLSX.writeFile(wb, 'students.xlsx')
}

function handlePrint() {
  printReport({
    title: 'รายงานข้อมูลนักเรียน',
    columns: [
      { label: 'เลขประจำตัว', key: 'student_id', width: '110px' },
      { label: 'คำนำหน้า', key: 'prefix', width: '80px' },
      { label: 'ชื่อ', key: 'name' },
      { label: 'นามสกุล', key: 'surname' },
      { label: 'ห้องเรียน', key: 'class_id', width: '100px' },
      { label: 'เลขที่', key: 'seat_number', width: '70px' },
      { 
        label: 'คะแนนความประพฤติ', 
        render: row => row.total_behavior_score ?? 0
      },
    ],
    rows: filteredStudents.value,
  })
}
</script>

<style scoped>
.students-surface {
  min-height: calc(100vh - 88px);
  background: radial-gradient(circle at 0% 0%, #f0f9ff 0, #f8fafc 45%, #eef2ff 100%);
}

.header-card {
  border-radius: 16px;
  padding: 18px 20px;
  background: linear-gradient(120deg, #667eea 0%, #764ba2 52%, #f5576c 100%);
  box-shadow: 0 16px 30px rgba(102, 126, 234, 0.30);
}

.stat-card {
  border-radius: 14px;
  padding: 14px 16px;
  color: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.10);
}
.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
}
.stat-label {
  font-size: 0.75rem;
  opacity: 0.85;
  margin-top: 4px;
}

.photo-section {
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  padding: 14px;
  background: #fafafa;
}

.guardian-section {
  border-radius: 10px;
  overflow: hidden;
}
.guardian-header {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border-left: 4px solid #16a34a;
  padding: 8px 14px;
}
.guardian-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #15803d;
}

.dialog-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
</style>
