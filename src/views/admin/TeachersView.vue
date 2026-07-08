<template>
  <AppLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">👨‍🏫 ครูและบุคลากร</h1>
            <p class="text-white/80 text-sm mt-1">จัดการข้อมูลครู และบัญชีผู้ใช้ระบบ</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <el-button v-if="!isTeacherOrScheduler" @click="openPullDialog" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📚 ดึงจากเทอมอื่น
            </el-button>
            <el-button v-if="!isTeacherOrScheduler" @click="triggerImport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า Excel
            </el-button>
            <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleImportFile" />
            <el-button @click="exportExcel" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก Excel
            </el-button>
            <el-button @click="handlePrint" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              🖨️ พิมพ์รายงาน
            </el-button>
            <el-button v-if="!isTeacherOrScheduler" @click="openAuditDialog" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              🔎 ตรวจผู้ใช้จริง
            </el-button>
            <el-button v-if="!isTeacherOrScheduler" type="primary" @click="openDialog()"
              style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
              + เพิ่มครู
            </el-button>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#667eea,#764ba2)">
          <div class="stat-value text-white">{{ teachers.length }}</div>
          <div class="stat-label text-white/80">ครูทั้งหมด</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">
          <div class="stat-value text-white">{{ accountCount }}</div>
          <div class="stat-label text-white/80">มีบัญชีระบบ</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">
          <div class="stat-value text-white">{{ uniqueDepts }}</div>
          <div class="stat-label text-white/80">กลุ่มสาระ</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fa709a,#fee140)">
          <div class="stat-value text-white">{{ deptHeadCount }}</div>
          <div class="stat-label text-white/80">หัวหน้ากลุ่ม</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="flex gap-3 mb-4 flex-wrap">
        <el-input v-model="searchText" placeholder="ค้นหาชื่อ, รหัส, อีเมล..." clearable style="width:260px">
          <template #prefix><span class="text-gray-400">🔍</span></template>
        </el-input>
        <el-select v-model="filterDept" placeholder="กลุ่มสาระทั้งหมด" clearable style="width:200px">
          <el-option v-for="d in DEPT_OPTIONS" :key="d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="filterAccount" placeholder="บัญชีทั้งหมด" clearable style="width:160px">
          <el-option label="✅ มีบัญชีแล้ว" value="linked" />
          <el-option label="⭕ ยังไม่มีบัญชี" value="unlinked" />
        </el-select>
      </div>

      <!-- Table -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <!-- Bulk Actions Bar -->
        <div v-if="!isTeacherOrScheduler" class="flex items-center gap-2 mb-3 flex-wrap">
          <el-button size="small" @click="tableRef?.toggleAllSelection()">เลือกทั้งหมด</el-button>
          <el-button size="small" @click="tableRef?.clearSelection()">ยกเลิกเลือก</el-button>
          <el-button size="small" type="danger"
            :disabled="!selectedRows.length"
            @click="deleteSelected">
            🗑️ ลบที่เลือก ({{ selectedRows.length }})
          </el-button>
          <el-button size="small" type="danger" plain @click="deleteAll">
            ❌ ลบทั้งหมด
          </el-button>
        </div>
        <el-table ref="tableRef" :data="filteredTeachers" border stripe v-loading="loading"
          @selection-change="onSelectionChange"
          :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }"
          style="width:100%" row-key="teacher_id">
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column prop="teacher_id" label="รหัส" width="80" align="center" />
          <el-table-column label="ชื่อ-นามสกุล" min-width="180">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <div class="avatar-sm" :style="`background:${userByTeacher[row.teacher_id] ? getRoleColor(userByTeacher[row.teacher_id].role) : '#9ca3af'}`" style="overflow:hidden">
                  <img v-if="userByTeacher[row.teacher_id]?.photo_url" :src="userByTeacher[row.teacher_id].photo_url" style="width:100%;height:100%;object-fit:cover;border-radius:50%" @error="e => e.target.style.display='none'" />
                  <span v-else>{{ (row.name||'?').charAt(0) }}</span>
                </div>
                <div>
                  <div class="font-medium text-sm">{{ row.prefix }}{{ row.name }} {{ row.surname }}</div>
                  <div class="text-xs text-gray-400">{{ row.dept || '—' }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="academic_rank" label="วิทยฐานะ" width="130" />
          <el-table-column prop="email" label="อีเมล" min-width="180">
            <template #default="{ row }">
              <span class="text-sm text-gray-600">{{ row.email || '—' }}</span>
            </template>
          </el-table-column>
          <!-- บัญชี/สิทธิ์ -->
          <el-table-column v-if="!isTeacherOrScheduler" label="บัญชี / สิทธิ์" width="230" align="left">
            <template #default="{ row }">
              <div v-if="userByTeacher[row.teacher_id]">
                <el-tag size="small" type="success" effect="dark" style="margin-bottom:6px">✅ มีบัญชี</el-tag>
                <div class="role-check-group">
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('school_admin')"
                    @change="val => toggleRole(row.teacher_id, 'school_admin', val)">
                    👑 Admin
                  </el-checkbox>
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('school_scheduler')"
                    @change="val => toggleRole(row.teacher_id, 'school_scheduler', val)">
                    📅 Scheduler
                  </el-checkbox>
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('school_teacher')"
                    @change="val => toggleRole(row.teacher_id, 'school_teacher', val)">
                    👨‍🏫 ครู
                  </el-checkbox>
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('subject_head')"
                    @change="val => toggleRole(row.teacher_id, 'subject_head', val)">
                    🏫 จัดสอนแทนสาระ
                  </el-checkbox>
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('sub_coordinator')"
                    @change="val => toggleRole(row.teacher_id, 'sub_coordinator', val)">
                    🔄 จัดสอนแทนโรงเรียน
                  </el-checkbox>
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('school_director')"
                    @change="val => toggleRole(row.teacher_id, 'school_director', val)">
                    👔 ผู้บริหาร
                  </el-checkbox>
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('student_affairs')"
                    @change="val => toggleRole(row.teacher_id, 'student_affairs', val)">
                    🎓 ฝ่ายกิจการผู้เรียน
                  </el-checkbox>
                  <el-checkbox size="small"
                    :model-value="(userByTeacher[row.teacher_id].roles||[]).includes('announcer')"
                    @change="val => toggleRole(row.teacher_id, 'announcer', val)">
                    📣 ประชาสัมพันธ์
                  </el-checkbox>
                </div>
              </div>
              <el-tag v-else size="small" type="info" effect="plain">⭕ ยังไม่มีบัญชี</el-tag>
            </template>
          </el-table-column>
          <!-- สถานะบัญชี switch -->
          <el-table-column v-if="!isTeacherOrScheduler" label="เปิดใช้" width="80" align="center">
            <template #default="{ row }">
              <el-switch
                v-if="userByTeacher[row.teacher_id]"
                v-model="userByTeacher[row.teacher_id].is_active"
                @change="val => toggleActive(row.teacher_id, val)"
                size="small"
              />
              <span v-else class="text-gray-300 text-xs">—</span>
            </template>
          </el-table-column>
          <!-- จัดการ -->
          <el-table-column v-if="!isTeacherOrScheduler" label="จัดการ" width="160" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" plain @click="openDialog(row)">แก้ไข</el-button>
              <el-button
                v-if="!userByTeacher[row.teacher_id]"
                size="small" type="success" plain
                @click="openAccountDialog(row)">
                🔑 บัญชี
              </el-button>
              <el-button
                v-else
                size="small" type="warning" plain
                @click="openResetDialog(row)">
                🔑 รีเซต
              </el-button>
              <el-button size="small" type="danger" plain @click="confirmDelete(row)">ลบ</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- ===== Add/Edit Teacher Dialog ===== -->
      <el-dialog
        v-model="dialogVisible"
        :title="editingTeacher ? '✏️ แก้ไขข้อมูลครู' : '➕ เพิ่มครูใหม่'"
        width="620px"
        destroy-on-close
      >
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
          <!-- ===== ข้อมูลครู ===== -->
          <div class="section-title">👨‍🏫 ข้อมูลครู</div>
          <div class="grid grid-cols-2 gap-x-4">
            <el-form-item label="คำนำหน้า" prop="prefix">
              <el-select v-model="form.prefix" class="w-full">
                <el-option v-for="p in TEACHER_PREFIXES" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
            <el-form-item label="รหัสครู" prop="teacher_id">
              <el-input v-model="form.teacher_id" :placeholder="nextTeacherId" />
            </el-form-item>
            <el-form-item label="ชื่อ" prop="name">
              <el-input v-model="form.name" placeholder="ชื่อจริง" />
            </el-form-item>
            <el-form-item label="นามสกุล" prop="surname">
              <el-input v-model="form.surname" placeholder="นามสกุล" />
            </el-form-item>
            <el-form-item label="วิทยฐานะ" prop="academic_rank">
              <el-select v-model="form.academic_rank" class="w-full">
                <el-option v-for="r in ACADEMIC_RANKS" :key="r" :label="r" :value="r" />
              </el-select>
            </el-form-item>
            <el-form-item label="กลุ่มสาระ" prop="dept">
              <el-select v-model="form.dept" class="w-full">
                <el-option v-for="d in DEPT_OPTIONS" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
            <el-form-item label="ตำแหน่ง">
              <el-select v-model="form.position" class="w-full" clearable>
                <el-option v-for="p in POSITION_OPTIONS" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
            <el-form-item label="เบอร์โทร">
              <el-input v-model="form.phone" placeholder="0xx-xxx-xxxx" />
            </el-form-item>
            <el-form-item label="อีเมล" class="col-span-2">
              <el-input v-model="form.email" type="email" placeholder="teacher@school.ac.th">
                <template #prefix>✉️</template>
              </el-input>
            </el-form-item>
            <el-form-item label="หัวหน้ากลุ่มสาระ" class="col-span-2">
              <el-switch v-model="form.is_dept_head" active-text="ใช่" inactive-text="ไม่" />
            </el-form-item>
          </div>

          <!-- ===== บัญชีระบบ (เฉพาะเพิ่มครูใหม่ หรือยังไม่มีบัญชี) ===== -->
          <template v-if="!editingTeacher || !userByTeacher[form.teacher_id]">
            <div class="section-title mt-4">🔑 บัญชีผู้ใช้ระบบ</div>
            <el-alert type="info" :closable="false" class="mb-2" style="font-size:12px">
              <span v-if="form.email && form.phone">
                ✅ มีอีเมลและเบอร์โทรครบ — ระบบจะ<strong>สร้างบัญชีอัตโนมัติ</strong> โดยใช้เบอร์โทร <strong>{{ form.phone }}</strong> เป็นรหัสผ่านเริ่มต้น สิทธิ์ = 👨‍🏫 ครู
              </span>
              <span v-else-if="form.email && !form.phone">
                ⚠️ มีอีเมลแต่ยังไม่มีเบอร์โทร — กรุณากรอกเบอร์โทรเพื่อสร้างบัญชี
              </span>
              <span v-else>
                ℹ️ กรอก <strong>อีเมล</strong> และ <strong>เบอร์โทร</strong> เพื่อให้ระบบสร้างบัญชีอัตโนมัติ
              </span>
            </el-alert>
          </template>

          <!-- ===== ถ้าแก้ไขครูที่มีบัญชีแล้ว ===== -->
          <template v-if="editingTeacher && userByTeacher[form.teacher_id]">
            <div class="section-title mt-4">🔑 บัญชีผู้ใช้ระบบ</div>
            <div class="p-3 rounded-lg bg-green-50 border border-green-200 text-sm flex items-center gap-2">
              <span class="text-green-600">✅</span>
              <div>
                <div class="font-medium text-green-700">มีบัญชีระบบแล้ว</div>
                <div class="text-xs text-gray-500 mt-0.5">
                  อีเมล: {{ userByTeacher[form.teacher_id]?.email }} •
                  สิทธิ์: {{ roleLabel((userByTeacher[form.teacher_id]?.roles || [])[0]) }}
                </div>
              </div>
            </div>
          </template>
        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">บันทึก</el-button>
        </template>
      </el-dialog>

      <!-- ===== Create Account Dialog (for existing teacher without account) ===== -->
      <el-dialog v-model="accountDialogVisible" title="🔑 สร้างบัญชีผู้ใช้" width="460px" destroy-on-close>
        <div v-if="accountTarget" class="mb-4 p-3 rounded-lg" style="background:#f5f3ff;border:1px solid #ddd6fe">
          <div class="text-xs text-purple-500 font-semibold mb-1">สร้างบัญชีให้กับ</div>
          <div class="font-bold text-gray-800">{{ accountTarget.prefix }}{{ accountTarget.name }} {{ accountTarget.surname }}</div>
          <div class="text-xs text-gray-500">รหัสครู: {{ accountTarget.teacher_id }}</div>
        </div>
        <el-alert type="success" :closable="false" class="mb-3">
          สิทธิ์จะถูกกำหนดเป็น <strong>👨‍🏫 ครู</strong> โดยอัตโนมัติ — เปลี่ยนได้ในตารางหลังสร้างบัญชีแล้ว
        </el-alert>
        <el-form :model="accountForm" :rules="accountRules" ref="accountFormRef" label-position="top">
          <el-form-item label="อีเมล (ใช้ล็อกอิน)" prop="email">
            <el-input v-model="accountForm.email" type="email" placeholder="teacher@school.ac.th">
              <template #prefix>✉️</template>
            </el-input>
          </el-form-item>
          <el-form-item label="รหัสผ่านเริ่มต้น" prop="password">
            <el-input v-model="accountForm.password" :type="showAccPwd ? 'text' : 'password'" placeholder="อย่างน้อย 6 ตัวอักษร">
              <template #suffix>
                <span class="cursor-pointer text-gray-400 select-none" @click="showAccPwd = !showAccPwd">
                  {{ showAccPwd ? '🙈' : '👁' }}
                </span>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="สิทธิ์ (เลือกได้หลายบทบาท)">
            <el-select v-model="accountForm.roles" multiple class="w-full">
              <el-option value="school_teacher" label="👨‍🏫 ครูผู้สอน" />
              <el-option value="school_scheduler" label="📅 Scheduler (จัดตารางสอน)" />
              <el-option value="sub_coordinator" label="🔄 ผู้จัดสอนแทน" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="accountDialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="creatingAccount" @click="handleCreateAccount">สร้างบัญชี</el-button>
        </template>
      </el-dialog>

      <!-- ===== Reset Password Dialog ===== -->
      <el-dialog v-model="resetDialogVisible" title="🔑 จัดการรหัสผ่าน" width="460px" destroy-on-close>
        <div v-if="resetTarget" class="mb-4 p-3 bg-gray-50 rounded-lg">
          <div class="font-medium text-gray-800">{{ resetTarget.prefix }}{{ resetTarget.name }} {{ resetTarget.surname }}</div>
          <div class="text-sm text-gray-500 mt-0.5">{{ userByTeacher[resetTarget.teacher_id]?.email }}</div>
        </div>

        <el-radio-group v-model="resetMode" class="mb-4">
          <el-radio-button value="email">📧 ส่งลิงก์รีเซ็ต</el-radio-button>
          <el-radio-button value="admin">🔑 Admin ตั้งรหัสใหม่</el-radio-button>
          <el-radio-button value="unlink">🔌 ตัดการเชื่อมบัญชี</el-radio-button>
        </el-radio-group>

        <!-- Mode: ส่งอีเมล -->
        <div v-if="resetMode === 'email'">
          <el-alert type="warning" :closable="false">
            ระบบจะส่ง <strong>อีเมลรีเซ็ตรหัสผ่าน</strong> ไปยังอีเมลของครู<br>
            ครูจะได้รับลิงก์เพื่อตั้งรหัสผ่านใหม่ด้วยตนเอง
          </el-alert>
        </div>

        <!-- Mode: Admin ตั้งรหัสให้ -->
        <div v-else-if="resetMode === 'admin'">
          <el-alert type="info" :closable="false" class="mb-3">
            ระบบจะตั้งรหัสผ่านใหม่ทันที ครูจะล็อกอินด้วยรหัสผ่านที่ Admin กำหนด<br>
            <strong>การเปลี่ยนแปลงจะมีผลภายใน 1 นาที</strong> (ผ่าน GAS queue)
          </el-alert>
          <el-form-item label="รหัสผ่านใหม่" required>
            <el-input
              v-model="resetNewPassword"
              :type="showResetPwd ? 'text' : 'password'"
              placeholder="อย่างน้อย 6 ตัวอักษร"
            >
              <template #suffix>
                <span class="cursor-pointer text-gray-400 select-none" @click="showResetPwd = !showResetPwd">
                  {{ showResetPwd ? '🙈' : '👁' }}
                </span>
              </template>
            </el-input>
          </el-form-item>
        </div>
        
        <!-- Mode: ตัดการเชื่อมบัญชี -->
        <div v-else-if="resetMode === 'unlink'">
          <el-alert type="error" :closable="false">
            <strong>ต้องการล้างข้อมูลบัญชีเก่าของครูท่านนี้?</strong><br>
            เมื่อตัดการเชื่อมต่อ ครูจะไม่สามารถใช้บัญชีเดิมล็อกอินได้อีก และคุณจะสามารถกด <strong>"🔑 บัญชี"</strong> เพื่อผูกอีเมลใหม่หรือรหัสใหม่ให้ครูได้
          </el-alert>
        </div>

        <template #footer>
          <el-button @click="resetDialogVisible = false">ยกเลิก</el-button>
          <el-button v-if="resetMode === 'email'" type="warning" :loading="resetSending" @click="sendResetEmail">
            📧 ส่งอีเมลรีเซ็ตรหัสผ่าน
          </el-button>
          <el-button v-else-if="resetMode === 'admin'" type="primary" :loading="resetChanging" @click="changePasswordByAdmin">
            🔑 ตั้งรหัสผ่านใหม่
          </el-button>
          <el-button v-else-if="resetMode === 'unlink'" type="danger" :loading="resetChanging" @click="unlinkAccount">
            🔌 ยืนยันตัดการเชื่อมต่อ
          </el-button>
        </template>
      </el-dialog>

      <!-- ===== Import Preview Dialog ===== -->
      <el-dialog v-model="importDialogVisible" title="📥 ตรวจสอบข้อมูลนำเข้า" width="820px" destroy-on-close>
        <!-- Summary chips -->
        <div class="flex gap-2 flex-wrap mb-3">
          <el-tag type="success">✅ ใหม่ {{ importRows.filter(r => !r._error && !r._duplicate).length }} คน</el-tag>
          <el-tag type="warning" v-if="importRows.filter(r => r._duplicate).length">
            🔄 อัปเดตซ้ำ {{ importRows.filter(r => r._duplicate).length }} คน
          </el-tag>
          <el-tag type="info">
            🔑 จะสร้างบัญชี {{ importRows.filter(r => !r._error && !r._duplicate && r.email && r.phone).length }} คน
          </el-tag>
          <el-tag type="danger" v-if="importErrors.length">❌ ข้อผิดพลาด {{ importErrors.length }} คน</el-tag>
        </div>
        <el-table :data="importRows" border stripe max-height="360" size="small">
          <el-table-column prop="teacher_id" label="รหัสครู" width="80" />
          <el-table-column label="ชื่อ-นามสกุล" min-width="150">
            <template #default="{ row }">{{ row.prefix }}{{ row.name }} {{ row.surname }}</template>
          </el-table-column>
          <el-table-column prop="dept" label="กลุ่มสาระ" min-width="130" />
          <el-table-column prop="email" label="อีเมล" min-width="150" />
          <el-table-column prop="phone" label="เบอร์โทร" width="110" />
          <el-table-column label="บัญชี" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row._error" size="small" type="info">—</el-tag>
              <el-tag v-else-if="row._duplicate" size="small" type="info">—</el-tag>
              <el-tag v-else-if="row.email && row.phone" size="small" type="success">สร้าง</el-tag>
              <el-tag v-else size="small" type="warning">ข้าม</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="สถานะ" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row._error" size="small" type="danger">{{ row._error }}</el-tag>
              <el-tag v-else-if="row._duplicate" size="small" type="warning">🔄 อัปเดต</el-tag>
              <el-tag v-else size="small" type="success">✅ ใหม่</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <template #footer>
          <el-button @click="importDialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving"
            :disabled="importRows.filter(r => !r._error).length === 0"
            @click="confirmImport">
            ดำเนินการ {{ importRows.filter(r => !r._error).length }} รายการ
          </el-button>
        </template>
      </el-dialog>

      <!-- ===== Pull Teachers From Another Term ===== -->
      <el-dialog v-model="pullDialogVisible" title="📚 ดึงครูจากเทอมอื่น" width="860px" destroy-on-close>
        <div class="flex gap-3 items-end mb-3 flex-wrap">
          <div style="min-width:220px">
            <div class="text-xs text-gray-500 mb-1">เลือกเทอมต้นทาง</div>
            <el-select v-model="pullSourceTerm" placeholder="เลือกเทอม" class="w-full" @change="loadPullSourceTeachers">
              <el-option v-for="t in availableTerms" :key="t" :label="t" :value="t" />
            </el-select>
          </div>
          <div style="min-width:220px">
            <div class="text-xs text-gray-500 mb-1">โหมดนำเข้า</div>
            <el-select v-model="pullMode" class="w-full">
              <el-option label="เพิ่มเฉพาะครูใหม่ (ข้ามรหัสซ้ำ)" value="skip" />
              <el-option label="อัปเดตข้อมูลครูที่รหัสซ้ำด้วย" value="overwrite" />
            </el-select>
          </div>
          <el-button :loading="pullLoading" @click="loadPullSourceTeachers">รีเฟรชรายการ</el-button>
        </div>

        <div class="flex gap-2 flex-wrap mb-3" v-if="pullRows.length">
          <el-tag type="success">ใหม่ {{ pullRows.filter(r => !r._duplicate).length }} คน</el-tag>
          <el-tag type="warning">ซ้ำ {{ pullRows.filter(r => r._duplicate).length }} คน</el-tag>
          <el-tag type="info">ทั้งหมด {{ pullRows.length }} คน</el-tag>
        </div>

        <el-table :data="pullRows" border stripe max-height="360" v-loading="pullLoading" size="small">
          <el-table-column prop="teacher_id" label="รหัสครู" width="90" />
          <el-table-column label="ชื่อ-นามสกุล" min-width="170">
            <template #default="{ row }">{{ row.prefix }}{{ row.name }} {{ row.surname }}</template>
          </el-table-column>
          <el-table-column prop="dept" label="กลุ่มสาระ" min-width="140" />
          <el-table-column prop="email" label="อีเมล" min-width="170" />
          <el-table-column label="สถานะ" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row._duplicate" type="warning" size="small">รหัสซ้ำ</el-tag>
              <el-tag v-else type="success" size="small">ใหม่</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <template #footer>
          <el-button @click="pullDialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="pullApplying" :disabled="!pullRows.length" @click="applyPullTeachers">
            นำเข้าข้อมูลครู
          </el-button>
        </template>
      </el-dialog>

      <!-- ===== Real Users Audit ===== -->
      <el-dialog v-model="auditDialogVisible" title="🔎 ตรวจสอบผู้ใช้จริงในระบบ" width="760px" destroy-on-close>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="p-3 rounded-lg border" style="border-color:#e2e8f0;background:#f8fafc">
            <div class="text-xs text-gray-500">ครูในเทอมนี้</div>
            <div class="text-2xl font-bold text-gray-700">{{ auditData.teacherCount }}</div>
          </div>
          <div class="p-3 rounded-lg border" style="border-color:#e2e8f0;background:#f8fafc">
            <div class="text-xs text-gray-500">ผู้ใช้จริงในโรงเรียน</div>
            <div class="text-2xl font-bold text-gray-700">{{ auditData.userCount }}</div>
          </div>
          <div class="p-3 rounded-lg border" style="border-color:#fecaca;background:#fef2f2">
            <div class="text-xs text-red-500">ครูยังไม่มีบัญชี</div>
            <div class="text-2xl font-bold text-red-600">{{ auditData.teacherWithoutUser.length }}</div>
          </div>
          <div class="p-3 rounded-lg border" style="border-color:#fde68a;background:#fffbeb">
            <div class="text-xs text-yellow-600">บัญชีไม่มีครูในเทอม</div>
            <div class="text-2xl font-bold text-yellow-700">{{ auditData.userWithoutTeacher.length }}</div>
          </div>
        </div>

        <el-alert type="warning" :closable="false" class="mb-3" v-if="auditData.missingSchoolId.length || auditData.legacyRole.length">
          <div>พบข้อมูลสิทธิ์แบบเก่า/ไม่ครบ กรุณาใช้ปุ่มซ่อมข้อมูลหรือแก้ไขสิทธิ์ใหม่จากตารางครู</div>
        </el-alert>

        <el-collapse>
          <el-collapse-item name="1" :title="`ครูยังไม่มีบัญชี (${auditData.teacherWithoutUser.length})`">
            <div class="text-sm text-gray-600" v-if="!auditData.teacherWithoutUser.length">ไม่พบ</div>
            <div v-for="t in auditData.teacherWithoutUser" :key="t.teacher_id" class="text-sm py-1">
              {{ t.teacher_id }} - {{ t.prefix }}{{ t.name }} {{ t.surname }}
            </div>
          </el-collapse-item>
          <el-collapse-item name="2" :title="`บัญชีไม่มีครูในเทอม (${auditData.userWithoutTeacher.length})`">
            <div class="text-sm text-gray-600" v-if="!auditData.userWithoutTeacher.length">ไม่พบ</div>
            <div v-for="u in auditData.userWithoutTeacher" :key="u.uid" class="text-sm py-1">
              {{ u.email }} ({{ u.teacher_id || 'ไม่มี teacher_id' }})
            </div>
          </el-collapse-item>
          <el-collapse-item name="3" :title="`บัญชีที่ไม่มี schoolId (${auditData.missingSchoolId.length})`">
            <div class="text-sm text-gray-600" v-if="!auditData.missingSchoolId.length">ไม่พบ</div>
            <div v-for="u in auditData.missingSchoolId" :key="u.uid" class="text-sm py-1">{{ u.email }}</div>
          </el-collapse-item>
          <el-collapse-item name="4" :title="`บัญชี role แบบเก่า (${auditData.legacyRole.length})`">
            <div class="text-sm text-gray-600" v-if="!auditData.legacyRole.length">ไม่พบ</div>
            <div v-for="u in auditData.legacyRole" :key="u.uid" class="text-sm py-1">{{ u.email }} - {{ u.role }}</div>
          </el-collapse-item>
        </el-collapse>

        <template #footer>
          <el-button @click="auditDialogVisible = false">ปิด</el-button>
          <el-button type="primary" @click="openAuditDialog">รีเฟรช</el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useSchoolStore } from '@/stores/school'
import { DEPT_OPTIONS, ACADEMIC_RANKS, TEACHER_PREFIXES, POSITION_OPTIONS } from '@/utils/constants'
import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseUrl, supabaseKey } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { usePrintReport } from '@/composables/usePrintReport'
import { cascadeService } from '@/composables/cascadeService'
import { buildRolePayload, normalizeUserAccessRecord, toDisplayRole } from '@/utils/userRoles'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { printReport } = usePrintReport()
const { getTeachers, saveTeacher: saveTeacherDb, deleteTeacher: deleteTeacherDb } = useSchoolDb()
const schoolId = computed(() => authStore.schoolId || authStore.profile?.schoolId || authStore.profile?.school_id || null)
const isTeacherOrScheduler = computed(() => {
  if (authStore.hasAnyRole(['school_admin', 'admin', 'superadmin'])) return false
  return authStore.hasAnyRole(['school_teacher', 'teacher', 'school_scheduler', 'scheduler'])
})

// ─── State ────────────────────────────────────────────────────────────────
const loading = ref(false)
const saving = ref(false)
const creatingAccount = ref(false)
const resetSending = ref(false)
const teachers = ref([])
const users = ref([])  // user documents for this school
const searchText = ref('')
const filterDept = ref('')
const filterAccount = ref('')
const showAccPwd = ref(false)

const dialogVisible = ref(false)
const editingTeacher = ref(null)
const formRef = ref()

const accountDialogVisible = ref(false)
const accountTarget = ref(null)
const accountFormRef = ref()
const accountForm = reactive({ email: '', password: '', roles: ['school_teacher'] })
const accountRules = {
  email: [
    { required: true, message: 'กรุณากรอกอีเมล', trigger: 'blur' },
    { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'กรุณากรอกรหัสผ่าน', trigger: 'blur' },
    { min: 6, message: 'ต้องมีอย่างน้อย 6 ตัวอักษร', trigger: 'blur' },
  ],
}

const resetDialogVisible = ref(false)
const resetTarget = ref(null)
const resetMode = ref('email') // 'email' | 'admin'
const resetNewPassword = ref('')
const showResetPwd = ref(false)
const resetChanging = ref(false)

const importDialogVisible = ref(false)
const importRows = ref([])
const importErrors = ref([])
const fileInputRef = ref()
const tableRef = ref()
const selectedRows = ref([])
const availableTerms = ref([])

const pullDialogVisible = ref(false)
const pullSourceTerm = ref('')
const pullRows = ref([])
const pullLoading = ref(false)
const pullApplying = ref(false)
const pullMode = ref('skip')

const auditDialogVisible = ref(false)
const auditData = reactive({
  teacherCount: 0,
  userCount: 0,
  teacherWithoutUser: [],
  userWithoutTeacher: [],
  missingSchoolId: [],
  legacyRole: [],
})

const form = reactive({
  teacher_id: '', prefix: 'นาย', name: '', surname: '',
  academic_rank: 'ครู', dept: '', position: '',
  is_dept_head: false, email: '', phone: '',
})

const rules = {
  prefix:        [{ required: true, message: 'กรุณาเลือกคำนำหน้า', trigger: 'change' }],
  teacher_id:    [{ required: true, message: 'กรุณากรอกรหัสครู', trigger: 'blur' }],
  name:          [{ required: true, message: 'กรุณากรอกชื่อ', trigger: 'blur' }],
  surname:       [{ required: true, message: 'กรุณากรอกนามสกุล', trigger: 'blur' }],
  academic_rank: [{ required: true, message: 'กรุณาเลือกวิทยฐานะ', trigger: 'change' }],
  dept:          [{ required: true, message: 'กรุณาเลือกกลุ่มสาระ', trigger: 'change' }],
  phone:         [{ required: true, message: 'กรุณากรอกเบอร์โทร (ใช้เป็นรหัสผ่านเริ่มต้น)', trigger: 'blur' }],
}

// ─── Computed ─────────────────────────────────────────────────────────────
const userByTeacher = computed(() => {
  const map = {}
  for (const u of users.value) {
    if (u.teacher_id) {
      map[u.teacher_id] = u
    }
  }
  return map
})

const uniqueDepts = computed(() => new Set(teachers.value.map(t => t.dept).filter(Boolean)).size)
const deptHeadCount = computed(() => teachers.value.filter(t => t.is_dept_head).length)
const accountCount = computed(() => Object.keys(userByTeacher.value).length)

const filteredTeachers = computed(() => {
  return teachers.value.filter(t => {
    const fullName = `${t.prefix || ''}${t.name || ''} ${t.surname || ''}`
    const matchSearch = !searchText.value ||
      fullName.includes(searchText.value) ||
      (t.teacher_id || '').includes(searchText.value) ||
      (t.email || '').includes(searchText.value)
    const matchDept = !filterDept.value || t.dept === filterDept.value
    const matchAcc = !filterAccount.value ||
      (filterAccount.value === 'linked' && !!userByTeacher.value[t.teacher_id]) ||
      (filterAccount.value === 'unlinked' && !userByTeacher.value[t.teacher_id])
    return matchSearch && matchDept && matchAcc
  })
})

const nextTeacherId = computed(() => {
  const ids = teachers.value.map(t => t.teacher_id).filter(id => /^T\d+$/.test(id))
  if (!ids.length) return 'T001'
  const maxNum = Math.max(...ids.map(id => parseInt(id.slice(1))))
  return `T${String(maxNum + 1).padStart(3, '0')}`
})

// ─── Helpers ──────────────────────────────────────────────────────────────
function getRoleColor(role) {
  const r = toDisplayRole(role) || role
  return {
    admin: '#7c3aed',
    scheduler: '#2563eb',
    teacher: '#059669',
    superadmin: '#dc2626',
    sub_coordinator: '#f59e0b',
  }[r] || '#9ca3af'
}
function roleLabel(role) {
  const r = toDisplayRole(role) || role
  return {
    admin: '👑 Admin',
    scheduler: '📅 Scheduler',
    teacher: '👨‍🏫 ครู',
    superadmin: '🛡️ Super Admin',
    sub_coordinator: '🔄 ผู้จัดสอนแทน',
  }[r] || role || '—'
}

// ─── Load ──────────────────────────────────────────────────────────────────
async function loadAll() {
  loading.value = true
  try {
    const sid = schoolId.value
    const [teacherData, usersRes, termIdsRes] = await Promise.all([
      getTeachers(),
      sid ? supabase.from('users').select('*').eq('school_id', sid) : Promise.resolve({ data: [] }),
      sid ? supabase.from('teachers').select('term_id').eq('school_id', sid) : Promise.resolve({ data: [] }),
    ])
    teachers.value = teacherData

    // Collect distinct term_ids for the pull dialog
    const termSet = new Set([schoolStore.currentTerm])
    ;(termIdsRes.data || []).forEach(r => r.term_id && termSet.add(r.term_id))
    availableTerms.value = Array.from(termSet).sort((a, b) => b.localeCompare(a))

    const map = new Map()
    ;(usersRes.data || []).forEach(u => {
      const data = normalizeUserAccessRecord(u)
      map.set(u.id || u.uid, data)
    })
    users.value = Array.from(map.values())
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}
onMounted(loadAll)

// ─── Open Dialog ───────────────────────────────────────────────────────────
function openDialog(teacher = null) {
  editingTeacher.value = teacher
  if (teacher) {
    Object.assign(form, {
      teacher_id: teacher.teacher_id || '',
      prefix: teacher.prefix || 'นาย',
      name: teacher.name || '',
      surname: teacher.surname || '',
      academic_rank: teacher.academic_rank || 'ครู',
      dept: teacher.dept || '',
      position: teacher.position || '',
      is_dept_head: teacher.is_dept_head || false,
      email: teacher.email || '',
      phone: teacher.phone || '',
    })
  } else {
    Object.assign(form, {
      teacher_id: '', prefix: 'นาย', name: '', surname: '',
      academic_rank: 'ครู', dept: '', position: '',
      is_dept_head: false, email: '', phone: '',
    })
  }
  dialogVisible.value = true
}

// ─── Save Teacher (+ auto account creation) ───────────────────────────────
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const duplicateTeacher = teachers.value.find(t => t.teacher_id === form.teacher_id && t.id !== editingTeacher.value?.id)
  if (!editingTeacher.value) {
    const exists = teachers.value.find(t => t.teacher_id === form.teacher_id)
    if (exists) { ElMessage.error('รหัสครูซ้ำ'); return }
  } else if (duplicateTeacher) {
    ElMessage.error('รหัสครูซ้ำ')
    return
  }

  saving.value = true
  try {
    const teacherData = {
      id: editingTeacher.value?.id || null,
      teacher_id: form.teacher_id, prefix: form.prefix,
      name: form.name, surname: form.surname,
      academic_rank: form.academic_rank, dept: form.dept,
      position: form.position, is_dept_head: form.is_dept_head,
      email: form.email, phone: form.phone,
    }

    // 1. จัดการเรื่อง Auth และ Account ก่อนที่จะบันทึกลงฐานข้อมูล เพื่อป้องกันข้อมูลไม่ตรงกัน
    const existingUser = userByTeacher.value[form.teacher_id]
    const alreadyHasAccount = !!existingUser
    const shouldCreateAccount = !editingTeacher.value && form.email && form.phone && !alreadyHasAccount
    const autoRoles = form.is_dept_head ? ['school_teacher', 'subject_head'] : ['school_teacher']
    
    let currentUid = existingUser?.uid
    let authWarning = ''

    if (shouldCreateAccount) {
      try {
        let pwdToUse = (form.phone || '').replace(/[^0-9a-zA-Z]/g, '')
        if (pwdToUse.length < 6) pwdToUse = '123456'
        currentUid = await createAccountForTeacher(teacherData, pwdToUse, autoRoles)
      } catch (err) {
        authWarning = err.message
      }
    } else if (editingTeacher.value && alreadyHasAccount && form.email && form.email !== editingTeacher.value.email) {
      // 3. กรณีแก้ไขและอีเมลเปลี่ยน -> สร้างบัญชี Auth ใหม่ให้ตรงกับอีเมลใหม่ และลบ Document สิทธิ์เก่า
      let newUid = null
      try {
        const curRoles = Array.isArray(existingUser.roles) ? [...existingUser.roles] : [existingUser.role || 'school_teacher']
        let pwdToUse = (form.phone || '').replace(/[^0-9a-zA-Z]/g, '')
        if (pwdToUse.length < 6) pwdToUse = '123456'

        newUid = await createAccountForTeacher(teacherData, pwdToUse, curRoles, form.email)
        
        // ลบข้อมูลสิทธิ์เชื่อมโยงของ UID เก่าทิ้ง เพื่อป้องกันใช้บัญชีเก่าเข้าใช้งาน
        if (existingUser.uid && existingUser.uid !== newUid) {
          const { error: delErr } = await supabase.from('users').delete().eq('id', existingUser.uid)
          if (delErr) {
            await supabase.from('users').update({ teacher_id: null, "teacherId": null, is_active: false, "isActive": false }).eq('id', existingUser.uid)
          }
        }
        
        currentUid = newUid
      } catch (err) {
        authWarning = err.message
        
        // บังคับตัดการเชื่อมต่อบัญชีเก่าทิ้ง เพื่อให้แอดมินไปกดผูกบัญชีใหม่เองได้จากปุ่ม "🔑 บัญชี"
        if (existingUser.uid && existingUser.uid !== newUid) {
          const { error: delErr2 } = await supabase.from('users').delete().eq('id', existingUser.uid)
          if (delErr2) {
            await supabase.from('users').update({ teacher_id: null, "teacherId": null, is_active: false, "isActive": false }).eq('id', existingUser.uid)
          }
        }
        currentUid = null
      }
    }

    // 2. Sync subject_head role when is_dept_head changes (for existing account)
    if (currentUid && !authWarning) {
      let curRoles = []
      if (existingUser) {
        curRoles = Array.isArray(existingUser.roles) ? [...existingUser.roles] : [existingUser.role || 'school_teacher']
      } else {
        curRoles = [...autoRoles]
      }
      const hasSubjectHead = curRoles.includes('subject_head')
      if (form.is_dept_head && !hasSubjectHead) {
        const newRoles = [...new Set([...curRoles, 'subject_head'])]
        await supabase.from('users').update({ roles: newRoles }).eq('id', currentUid)
      } else if (!form.is_dept_head && hasSubjectHead) {
        const newRoles = curRoles.filter(r => r !== 'subject_head')
        await supabase.from('users').update({ roles: newRoles }).eq('id', currentUid)
      }
    }

    // 3. Save teacher data
    // ตรวจสอบว่าเป็นการแก้ไขหรือเพิ่มใหม่
    const savedTeacherId = await saveTeacherDb(teacherData)
    teacherData.id = savedTeacherId
    if (editingTeacher.value) {
      const isTeacherIdChanged = editingTeacher.value.teacher_id !== teacherData.teacher_id
      const oldFullName = `${editingTeacher.value.prefix || ''}${editingTeacher.value.name || ''} ${editingTeacher.value.surname || ''}`.trim()
      const newFullName = `${teacherData.prefix || ''}${teacherData.name || ''} ${teacherData.surname || ''}`.trim()
      const isTeacherNameChanged = oldFullName !== newFullName
      if (isTeacherIdChanged || isTeacherNameChanged) {
        await cascadeService.updateTeacher(schoolStore.currentTerm, editingTeacher.value.teacher_id, editingTeacher.value, teacherData)
      }
    }

    if (authWarning) {
      ElMessage.warning({ message: `บันทึกข้อมูลครูแล้ว แต่พบปัญหาการเชื่อมบัญชี: ${authWarning}`, duration: 5000 })
    } else {
      ElMessage.success(shouldCreateAccount || (editingTeacher.value && alreadyHasAccount && form.email !== editingTeacher.value.email)
        ? 'บันทึกข้อมูลครูและอัปเดตบัญชีเรียบร้อย'
        : 'บันทึกข้อมูลครูเรียบร้อย')
    }
    dialogVisible.value = false
    setTimeout(() => loadAll(), 300)
  } catch (e) {
    const msg = {
      'auth/email-already-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว',
      'auth/weak-password': 'รหัสผ่านอ่อนเกินไป',
      'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
    }[e.code] || e.message
    ElMessage.error('ระบบขัดข้อง: ' + msg)
  } finally {
    saving.value = false
  }
}

// ─── Helper: Create auth account + user document using Supabase ─────────────
async function createAccountForTeacher(teacher, password, role = 'school_teacher', emailOverride = '') {
  const emailForAccount = (emailOverride || teacher.email || '').trim()
  if (!emailForAccount) throw new Error('กรุณาระบุอีเมลสำหรับบัญชีผู้ใช้')

  const sid = schoolId.value || ''
  const displayName = `${teacher.prefix || ''}${teacher.name} ${teacher.surname}`

  // Check if user with this email already exists in users table
  const { data: existing } = await supabase.from('users').select('id').eq('email', emailForAccount).eq('school_id', sid).maybeSingle()
  let uid

  if (existing?.id) {
    uid = existing.id
  } else {
    // Also check in-memory
    const local = users.value.find(u => u.email === emailForAccount)
    if (local?.id || local?.uid) {
      uid = local.id || local.uid
    } else {
      // Create new auth user via signUp
      const { data, error } = await supabase.auth.signUp({
        email: emailForAccount,
        password,
        options: { data: { displayName, school_id: sid } }
      })
      if (error) {
        if (error.message?.includes('already registered') || error.message?.includes('already been registered')) {
          // Email exists in Auth but not in users table — try to recover by signing in
          const tempClient = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false }
          })
          const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
            email: emailForAccount, password
          })
          if (signInError || !signInData?.user) {
            throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว แต่รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่าน')
          }
          uid = signInData.user.id
        } else {
          throw error
        }
      } else {
        uid = data.user?.id
        if (!uid) throw new Error('ไม่สามารถสร้างบัญชีได้')
      }
    }
  }

  // Upsert user record in users table
  const rolePayload = buildRolePayload(role)
  const { error: upsertErr } = await supabase.from('users').upsert({
    id: uid,
    uid,
    email: emailForAccount,
    displayName,
    display_name: displayName,
    ...rolePayload,
    teacher_id: teacher.teacher_id,
    teacherId: teacher.teacher_id,
    school_id: sid,
    schoolId: sid,
    is_active: true,
    isActive: true,
    updated_at: new Date().toISOString(),
    created_by: authStore.profile?.uid || '',
  }, { onConflict: 'id' })
  if (upsertErr) throw upsertErr

  return uid
}

// ─── Open Account Dialog (for existing teacher without account) ────────────
function openAccountDialog(teacher) {
  accountTarget.value = teacher
  Object.assign(accountForm, {
    email: teacher.email || '',
    password: '',
    roles: ['school_teacher'],
  })
  showAccPwd.value = false
  accountDialogVisible.value = true
}

async function handleCreateAccount() {
  const valid = await accountFormRef.value?.validate().catch(() => false)
  if (!valid) return
  creatingAccount.value = true
  try {
    await createAccountForTeacher(accountTarget.value, accountForm.password, accountForm.roles, accountForm.email)
    // Also update teacher email if changed
    if (accountForm.email !== accountTarget.value.email) {
      await saveTeacherDb({ ...accountTarget.value, email: accountForm.email })
    }
    ElMessage.success(`สร้างบัญชีสำหรับ ${accountTarget.value.name} เรียบร้อย`)
    accountDialogVisible.value = false
    setTimeout(() => loadAll(), 300)
  } catch (e) {
    const msg = {
      'auth/email-already-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว',
      'auth/weak-password': 'รหัสผ่านอ่อนเกินไป',
      'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
    }[e.code] || e.message
    ElMessage.error('สร้างบัญชีไม่สำเร็จ: ' + msg)
  } finally {
    creatingAccount.value = false
  }
}

// ─── Change Roles inline (multi-role) ─────────────────────────────────────
async function changeRoles(teacherId, newRoles) {
  const user = userByTeacher.value[teacherId]
  if (!user?.uid) return
  if (!newRoles.length) { ElMessage.warning('ต้องมีสิทธิ์อย่างน้อย 1 อย่าง'); return }
  const finalRoles = [...new Set(newRoles)]
  try {
    const payload = buildRolePayload(finalRoles)
    await supabase.from('users').update(payload).eq('id', user.uid)
    Object.assign(user, normalizeUserAccessRecord({ ...user, ...payload }))
    ElMessage.success('อัปเดตสิทธิ์เรียบร้อย')
  } catch (e) {
    ElMessage.error('อัปเดตสิทธิ์ไม่สำเร็จ: ' + e.message)
    await loadAll()
  }
}

async function toggleRole(teacherId, roleName, checked) {
  const user = userByTeacher.value[teacherId]
  if (!user?.uid) return
  const current = Array.isArray(user.roles) ? [...user.roles] : []
  const newRoles = checked
    ? [...new Set([...current, roleName])]
    : current.filter(r => r !== roleName)
  await changeRoles(teacherId, newRoles)
}

// ─── Toggle is_active ──────────────────────────────────────────────────────
async function toggleActive(teacherId, newVal) {
  const user = userByTeacher.value[teacherId]
  if (!user?.uid) return
  try {
    await supabase.from('users').update({ is_active: newVal, "isActive": newVal }).eq('id', user.uid)
    ElMessage.success(newVal ? 'เปิดใช้งานบัญชีแล้ว' : 'ระงับบัญชีแล้ว')
  } catch (e) {
    user.is_active = !newVal
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
}

// ─── Reset Password ────────────────────────────────────────────────────────
function openResetDialog(teacher) {
  resetTarget.value = teacher
  resetMode.value = 'email'
  resetNewPassword.value = ''
  showResetPwd.value = false
  resetDialogVisible.value = true
}

async function sendResetEmail() {
  const email = userByTeacher.value[resetTarget.value?.teacher_id]?.email
  if (!email) {
    ElMessage.warning('ไม่พบอีเมลของครูท่านนี้ในระบบ กรุณาใช้วิธีให้ Admin ตั้งรหัสใหม่')
    return
  }
  resetSending.value = true
  try {
    await supabase.auth.resetPasswordForEmail(email)
    ElMessage.success(`ส่งอีเมลรีเซ็ตรหัสผ่านไปยัง ${email} แล้ว`)
    resetDialogVisible.value = false
  } catch (e) {
    ElMessage.error('ส่งอีเมลไม่สำเร็จ: ' + e.message)
  } finally {
    resetSending.value = false
  }
}

async function changePasswordByAdmin() {
  const user = userByTeacher.value[resetTarget.value?.teacher_id]
  if (!user?.uid) { ElMessage.error('ไม่พบ UID ของครู'); return }
  const pwd = resetNewPassword.value.trim()
  if (pwd.length < 6) { ElMessage.warning('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }

  resetChanging.value = true
  try {
    const teacher = resetTarget.value
    const teacherName = `${teacher.prefix || ''}${teacher.name} ${teacher.surname}`
    await supabase.from('password_change_queue').insert([{
      uid: user.uid,
      new_password: pwd,
      teacher_name: teacherName,
      admin_email: authStore.profile?.email || '',
      school_id: schoolId.value || null
    }])
    ElMessage.success(`ส่งคำขอเปลี่ยนรหัสผ่านสำหรับ ${teacherName} แล้ว — จะมีผลภายใน 1 นาที`)
    resetDialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    resetChanging.value = false
  }
}

async function unlinkAccount() {
  const user = userByTeacher.value[resetTarget.value?.teacher_id]
  if (!user?.uid) return
  resetChanging.value = true
  try {
    try {
      const { error: delErr } = await supabase.from('users').delete().eq('id', user.uid)
      if (delErr) throw delErr
    } catch (delErr) {
      await supabase.from('users').update({ teacher_id: null, "teacherId": null, is_active: false, "isActive": false }).eq('id', user.uid)
    }
    ElMessage.success('ตัดการเชื่อมต่อบัญชีเก่าเรียบร้อยแล้ว ตอนนี้คุณสามารถสร้าง/ผูกบัญชีใหม่ได้')
    resetDialogVisible.value = false
    setTimeout(() => loadAll(), 300)
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    resetChanging.value = false
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────
async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบครู "${row.prefix}${row.name} ${row.surname}"?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    loading.value = true
    await deleteTeacherDb(row.teacher_id)
    ElMessage.success('ลบข้อมูลครูเรียบร้อย')
    await loadAll()
  } catch {
    // cancelled
  } finally {
    loading.value = false
  }
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
    for (const row of selectedRows.value) {
      await deleteTeacherDb(row.teacher_id)
    }
    selectedRows.value = []
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
    await loadAll()
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function deleteAll() {
  const allRows = filteredTeachers.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    for (const row of [...allRows]) {
      await deleteTeacherDb(row.teacher_id)
    }
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
    await loadAll()
  } catch { /* cancelled */ } finally { loading.value = false }
}

// ─── Import ────────────────────────────────────────────────────────────────
function triggerImport() { fileInputRef.value?.click() }

function handleImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result)
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (rows.length < 2) { ElMessage.warning('ไม่พบข้อมูลในไฟล์'); return }
    const existingIds = new Set(teachers.value.map(t => t.teacher_id))
    importRows.value = rows.slice(1).filter(r => r.some(c => c)).map(r => {
      const obj = {
        teacher_id: String(r[0] || '').trim(),
        prefix: String(r[1] || '').trim(),
        name: String(r[2] || '').trim(),
        surname: String(r[3] || '').trim(),
        academic_rank: String(r[4] || '').trim(),
        dept: String(r[5] || '').trim(),
        position: String(r[6] || '').trim(),
        is_dept_head: false,
        email: String(r[7] || '').trim(),
        phone: String(r[8] || '').trim(),
        _duplicate: false,
        _error: '',
      }
      if (!obj.teacher_id)      obj._error = 'ไม่มีรหัสครู'
      else if (!obj.name)        obj._error = 'ไม่มีชื่อ'
      else if (!obj.surname)     obj._error = 'ไม่มีนามสกุล'
      else if (existingIds.has(obj.teacher_id)) obj._duplicate = true
      return obj
    })
    importErrors.value = importRows.value.filter(r => r._error)
    importDialogVisible.value = true
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function confirmImport() {
  const allValid = importRows.value.filter(r => !r._error)
  if (!allValid.length) return

  const newRows = allValid.filter(r => !r._duplicate)
  const dupRows = allValid.filter(r => r._duplicate)
  const willCreateAccount = newRows.filter(r => r.email && r.phone)

  // แจ้งสรุปก่อน import
  const summary = [
    `ครูใหม่: ${newRows.length} คน`,
    dupRows.length ? `อัปเดตซ้ำ: ${dupRows.length} คน` : '',
    willCreateAccount.length ? `สร้างบัญชีอัตโนมัติ: ${willCreateAccount.length} คน` : '',
    newRows.filter(r => !r.email || !r.phone).length
      ? `ไม่สร้างบัญชี (ไม่มีอีเมล/เบอร์): ${newRows.filter(r => !r.email || !r.phone).length} คน`
      : '',
  ].filter(Boolean).join('\n')

  try {
    await ElMessageBox.confirm(summary, 'ยืนยันการนำเข้า', {
      confirmButtonText: 'ดำเนินการ', cancelButtonText: 'ยกเลิก', type: 'info',
    })
  } catch { return }

  saving.value = true
  let accountCreated = 0, accountFailed = 0
  try {
    for (const row of allValid) {
      const { _error, _duplicate, ...data } = row
      await saveTeacherDb(data)

      // สร้างบัญชีเฉพาะครูใหม่ที่มีอีเมล+เบอร์ และยังไม่มีบัญชี
      if (!_duplicate && data.email && data.phone && !userByTeacher.value[data.teacher_id]) {
        try {
          await createAccountForTeacher(data, data.phone, 'school_teacher')
          accountCreated++
        } catch (e) {
          // auth/email-already-in-use = มีบัญชีอยู่แล้ว ถือว่า OK
          if (e.code !== 'auth/email-already-in-use') accountFailed++
        }
      }
    }
    const msg = [
      `นำเข้าข้อมูล ${allValid.length} รายการเรียบร้อย`,
      accountCreated ? `สร้างบัญชี ${accountCreated} บัญชี` : '',
      accountFailed ? `⚠️ สร้างบัญชีไม่สำเร็จ ${accountFailed} บัญชี` : '',
    ].filter(Boolean).join(' | ')
    ElMessage.success(msg)
    importDialogVisible.value = false
    setTimeout(() => loadAll(), 300)
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function openPullDialog() {
  pullSourceTerm.value = ''
  pullRows.value = []
  pullMode.value = 'skip'
  pullDialogVisible.value = true
}

async function loadPullSourceTeachers() {
  if (!pullSourceTerm.value) { pullRows.value = []; return }
  pullLoading.value = true
  try {
    const sid = schoolId.value
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('school_id', sid)
      .eq('term_id', pullSourceTerm.value)
    if (error) throw error
    const existingIds = new Set(teachers.value.map(t => t.teacher_id))
    pullRows.value = (data || []).map(t => ({
      teacher_id: t.teacher_id || '',
      prefix: t.prefix || 'นาย',
      name: t.name || '',
      surname: t.surname || '',
      academic_rank: t.academic_rank || 'ครู',
      dept: t.dept || '',
      position: t.position || '',
      is_dept_head: t.is_dept_head === true,
      email: t.email || '',
      phone: t.phone || '',
      _duplicate: existingIds.has(t.teacher_id),
    })).filter(t => t.teacher_id)
  } catch (e) {
    ElMessage.error('โหลดข้อมูลเทอมต้นทางไม่สำเร็จ: ' + e.message)
  } finally {
    pullLoading.value = false
  }
}

async function applyPullTeachers() {
  if (!pullRows.value.length) return
  pullApplying.value = true
  try {
    let created = 0
    let updated = 0
    let skipped = 0
    for (const row of pullRows.value) {
      if (row._duplicate && pullMode.value === 'skip') {
        skipped++
        continue
      }
      await saveTeacherDb({
        teacher_id: row.teacher_id,
        prefix: row.prefix,
        name: row.name,
        surname: row.surname,
        academic_rank: row.academic_rank,
        dept: row.dept,
        position: row.position,
        is_dept_head: row.is_dept_head,
        email: row.email,
        phone: row.phone,
      })
      if (row._duplicate) updated++
      else created++
    }

    ElMessage.success(`ดึงครูเรียบร้อย | เพิ่มใหม่ ${created} | อัปเดต ${updated} | ข้าม ${skipped}`)
    pullDialogVisible.value = false
    setTimeout(() => loadAll(), 300)
  } catch (e) {
    ElMessage.error('ดึงข้อมูลครูไม่สำเร็จ: ' + e.message)
  } finally {
    pullApplying.value = false
  }
}

function openAuditDialog() {
  const teacherMap = new Map(teachers.value.map(t => [t.teacher_id, t]))
  const userMap = new Map(users.value.map(u => [u.teacher_id, u]))

  auditData.teacherCount = teachers.value.length
  auditData.userCount = users.value.length
  auditData.teacherWithoutUser = teachers.value.filter(t => !userMap.has(t.teacher_id))
  auditData.userWithoutTeacher = users.value.filter(u => u.teacher_id && !teacherMap.has(u.teacher_id))
  auditData.missingSchoolId = users.value.filter(u => !(u.schoolId || u.school_id))
  auditData.legacyRole = users.value.filter(u => !Array.isArray(u.roles) && !!u.role)
  auditDialogVisible.value = true
}

// ─── Export ────────────────────────────────────────────────────────────────
function exportExcel() {
  const headers = ['รหัสครู','คำนำหน้า','ชื่อ','นามสกุล','วิทยฐานะ','กลุ่มสาระ','ตำแหน่ง','อีเมล','เบอร์โทร']
  const rows = filteredTeachers.value.map(t => [
    t.teacher_id, t.prefix, t.name, t.surname,
    t.academic_rank, t.dept, t.position, t.email, t.phone
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [10,10,14,16,14,22,16,24,14].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ครู')
  XLSX.writeFile(wb, 'teachers_export.xlsx')
  ElMessage.success('ส่งออกข้อมูลสำเร็จ')
}

function handlePrint() {
  printReport({
    title: 'รายงานข้อมูลครูและบุคลากร',
    columns: [
      { label: 'รหัสครู', key: 'teacher_id', width: '80px' },
      { label: 'คำนำหน้า', key: 'prefix', width: '80px' },
      { label: 'ชื่อ', key: 'name' },
      { label: 'นามสกุล', key: 'surname' },
      { label: 'วิทยฐานะ', key: 'academic_rank' },
      { label: 'กลุ่มสาระ', key: 'dept' },
      { label: 'ตำแหน่ง', key: 'position' },
      { label: 'อีเมล', key: 'email' },
      { label: 'เบอร์โทร', key: 'phone' },
      { label: 'บัญชีระบบ', render: row => userByTeacher.value[row.teacher_id] ? '✅ มีบัญชี' : '—' },
    ],
    rows: filteredTeachers.value,
  })
}
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(102,126,234,0.25);
}
.stat-card {
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
}
.stat-value { font-size: 2rem; font-weight: 800; line-height: 1; }
.stat-label { font-size: 0.85rem; margin-top: 4px; }
.avatar-sm {
  width: 30px; height: 30px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #4b5563;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 6px;
  margin-bottom: 12px;
  letter-spacing: 0.03em;
}
.grid.grid-cols-2 .col-span-2 {
  grid-column: span 2;
}
.role-check-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.role-check-group .el-checkbox {
  margin: 0;
  font-size: 12px;
  height: 22px;
}
</style>
