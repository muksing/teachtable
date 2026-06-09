<template>
  <AppLayout>
    <div class="p-6 max-w-screen-xl mx-auto">

      <!-- ===== Header ===== -->
      <div class="rounded-2xl p-6 mb-6 text-white shadow-lg"
        style="background: linear-gradient(135deg, #0d9488 0%, #0891b2 50%, #1d4ed8 100%)">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">🎯 กิจกรรมและครูคุมกิจกรรม</h1>
            <p class="text-white/80 text-sm mt-1">จองคาบสำหรับกิจกรรม และมอบหมายครูคุม</p>
          </div>
          <div class="text-right text-white/70 text-sm">
            <div>ภาคเรียน: <span class="text-white font-semibold">{{ schoolStore.currentTerm || '-' }}</span></div>
            <div>{{ periodsPerDay }} คาบ/วัน</div>
          </div>
        </div>
      </div>

      <!-- ===== Tabs ===== -->
      <el-tabs v-model="activeTab" type="border-card" class="shadow-sm">

        <!-- ==================== TAB 1: กิจกรรม ==================== -->
        <el-tab-pane name="activities">
          <template #label>
            <span class="flex items-center gap-1.5">📋 กิจกรรม</span>
          </template>

          <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div class="text-sm text-gray-500">กิจกรรมเหล่านี้จะถูกจองคาบในตารางก่อน <strong>เป็นลำดับแรก</strong> จากนั้นค่อยจัดวิชาลงในคาบที่เหลือ</div>
            <div class="flex gap-2 flex-wrap items-center">
              <input ref="actFileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleActImportFile" />
              <el-button v-if="!isLocked" size="small" @click="triggerActImport">📥 นำเข้า</el-button>
              <el-button size="small" @click="exportActivities">📤 ส่งออก</el-button>
              <el-button size="small" @click="printActivities">🖨️ พิมพ์รายงาน</el-button>
              <el-button v-if="!isLocked" type="primary" @click="openActivityDialog(null)">+ เพิ่มกิจกรรม</el-button>
              <span v-if="isLocked" class="text-xs text-red-500 font-semibold">🔒 ล็อคแล้ว</span>
            </div>
          </div>

          <!-- Activities Toolbar (select-all / delete) -->
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <el-button size="small" @click="actTableRef?.toggleAllSelection()">เลือกทั้งหมด</el-button>
            <el-button size="small" @click="actTableRef?.clearSelection()">ยกเลิกเลือก</el-button>
            <el-button v-if="!isLocked" size="small" type="danger" :disabled="!selectedActRows.length" @click="deleteSelectedActivities">
              🗑️ ลบที่เลือก ({{ selectedActRows.length }})
            </el-button>
            <el-button v-if="!isLocked" size="small" type="danger" plain @click="deleteAllActivities">❌ ลบทั้งหมด</el-button>
          </div>

          <!-- Activities Table -->
          <el-table
            ref="actTableRef"
            :data="activities"
            border stripe
            v-loading="loading"
            empty-text="ยังไม่มีกิจกรรม"
            :header-cell-style="{ background: '#0d9488', color: 'white', fontWeight: '600' }"
            @selection-change="selectedActRows = $event.map(r=>r)">
            <el-table-column type="selection" width="48" />
            <el-table-column label="ชื่อกิจกรรม" prop="name" min-width="160">
              <template #default="{ row }">
                <div class="flex items-center gap-2">
                  <span v-if="row.color"
                    class="w-3 h-3 rounded-full flex-shrink-0 inline-block"
                    :style="`background:${row.color}`"></span>
                  <span class="font-medium">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="วัน" min-width="160">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-1">
                  <el-tag
                    v-for="dayVal in normalizeDays(row.days, row.day)"
                    :key="dayVal"
                    size="small"
                    type="primary"
                    effect="light">
                    {{ DAYS.find(d => d.value === dayVal)?.label || dayVal }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="คาบเริ่ม" prop="start_period" width="90" align="center" />

            <el-table-column label="ระยะเวลา" width="100" align="center">
              <template #default="{ row }">{{ row.duration_periods }} คาบ</template>
            </el-table-column>

            <el-table-column label="ห้องที่เกี่ยวข้อง" min-width="200">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-1">
                  <el-tag
                    v-for="c in (row.target_classes || [])"
                    :key="c"
                    size="small"
                    type="success"
                    effect="light">
                    {{ c }}
                  </el-tag>
                  <span v-if="!(row.target_classes || []).length" class="text-gray-400 text-xs">-</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="จัดการ" width="220" align="center" fixed="right">
              <template #default="{ row }">
                <el-button v-if="!isLocked" size="small" @click="openActivityDialog(row)">แก้ไข</el-button>
                <el-button v-if="!isLocked" size="small" type="success" :loading="lockingId === row.act_id" @click="applyLock(row)">
                  📌 จองคาบ
                </el-button>
                <el-button v-if="!isLocked" size="small" type="danger" @click="deleteActivity(row)">ลบ</el-button>
                <span v-if="isLocked" class="text-xs text-gray-400">—</span>
              </template>
            </el-table-column>
          </el-table>

          <!-- ===== Weekly Grid Preview ===== -->
          <div class="mt-8">
            <div class="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📅</span> ตัวอย่างคาบที่กิจกรรมจะจอง (จะลงตารางก่อนจัดวิชา)
            </div>
            <div class="overflow-x-auto rounded-xl border bg-white shadow-sm">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-gray-50">
                    <th class="border px-3 py-2 text-gray-500 font-semibold w-20 text-center">วัน \ คาบ</th>
                    <th
                      v-for="p in PERIODS"
                      :key="p"
                      class="border px-2 py-2 text-center font-semibold text-gray-600 min-w-16">
                      {{ p }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="day in DAYS" :key="day.value">
                    <td class="border px-2 py-1.5 text-center font-semibold text-gray-600 bg-gray-50">
                      {{ day.label }}
                    </td>
                    <td
                      v-for="p in PERIODS"
                      :key="p"
                      class="border p-0.5 text-center"
                      style="height:44px;min-width:64px">
                      <div
                        v-for="act in getGridCell(day.value, p)"
                        :key="act.act_id"
                        class="rounded text-white text-center px-1 py-0.5 leading-tight truncate"
                        :style="`background:${act.color || '#0d9488'}`"
                        :title="act.name">
                        {{ act.name }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-2 text-xs text-gray-400">* แสดงเฉพาะกิจกรรมที่บันทึกไว้ (ไม่แสดงห้องแยก)</div>
          </div>
        </el-tab-pane>

        <!-- ==================== TAB 2: ครูคุมกิจกรรม ==================== -->
        <el-tab-pane name="supervision">
          <template #label>
            <span class="flex items-center gap-1.5">👨‍🏫 ครูคุมกิจกรรม</span>
          </template>

          <div class="flex justify-end mb-3 gap-2 items-center">
            <input ref="supFileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleSupImportFile" />
            <el-button v-if="!isLocked" size="small" @click="supFileInputRef?.click()">📥 นำเข้า</el-button>
            <el-button size="small" @click="exportSupervisions">📤 ส่งออก</el-button>
            <el-button size="small" @click="printSupervisions">🖨️ พิมพ์รายงาน</el-button>
            <span v-if="isLocked" class="text-xs text-red-500 font-semibold">🔒 ล็อคแล้ว</span>
          </div>

          <div class="flex gap-4" style="min-height:480px">

            <!-- Left: Activity List -->
            <div class="flex-shrink-0 w-64 bg-gray-50 rounded-xl border overflow-y-auto" style="max-height:600px">
              <div class="p-3 border-b bg-white rounded-t-xl">
                <div class="text-sm font-semibold text-gray-700">รายการกิจกรรม</div>
                <div class="text-xs text-gray-400 mt-0.5">คลิกเพื่อดูครูคุม</div>
              </div>
              <div v-if="loading" class="p-4 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              <div v-else-if="!activities.length" class="p-4 text-center text-gray-400 text-sm">ยังไม่มีกิจกรรม</div>
              <div v-else class="p-2 space-y-1">
                <button
                  v-for="act in activities"
                  :key="act.act_id"
                  class="w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all"
                  :class="selectedActId === (act.act_id || act.id)
                    ? 'bg-teal-600 text-white shadow'
                    : 'bg-white hover:bg-teal-50 text-gray-700 border'"
                  @click="selectActivity(act)">
                  <div class="font-medium truncate flex items-center gap-1.5">
                    <span
                      v-if="act.color"
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      :style="`background:${act.color}`"></span>
                    {{ act.name }}
                  </div>
                  <div class="text-xs mt-0.5 opacity-75 flex gap-2">
                    <span>
                      {{ normalizeDays(act.days, act.day).map(d => DAYS.find(x => x.value === d)?.short).filter(Boolean).join('/') }}
                    </span>
                    <span>คาบ {{ act.start_period }}–{{ act.start_period + act.duration_periods - 1 }}</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Right: Supervision Panel (inline table — all teachers) -->
            <div class="flex-1 min-w-0">
              <div v-if="!selectedActId" class="flex items-center justify-center h-full text-gray-400 text-sm">
                ← เลือกกิจกรรมทางซ้าย
              </div>
              <div v-else>
                <!-- Activity header -->
                <div class="rounded-xl p-4 mb-4 border"
                  :style="`background:${selectedActivity?.color || '#0d9488'}18;border-color:${selectedActivity?.color || '#0d9488'}40`">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div class="font-semibold text-gray-800 text-base flex items-center gap-2">
                        <span v-if="selectedActivity?.color" class="w-3 h-3 rounded-full"
                          :style="`background:${selectedActivity.color}`"></span>
                        {{ selectedActivity?.name }}
                      </div>
                      <div class="text-sm text-gray-500 mt-1 flex flex-wrap gap-3">
                        <span>วัน: {{ normalizeDays(selectedActivity?.days, selectedActivity?.day)
                            .map(d => DAYS.find(x => x.value === d)?.label).filter(Boolean).join(', ') }}</span>
                        <span>คาบ {{ selectedActivity?.start_period }}–{{ (selectedActivity?.start_period || 0) + (selectedActivity?.duration_periods || 0) - 1 }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-teal-700 font-medium">
                        เลือกแล้ว {{ teacherSupRows.filter(r => r.checked).length }} คน
                      </span>
                      <el-button v-if="!isLocked" type="primary" size="small" :loading="supSaving" @click="saveAllSupervisions">
                        💾 บันทึกทั้งหมด
                      </el-button>
                    </div>
                  </div>
                </div>

                <!-- All-teachers supervision table -->
                <div class="mb-2 text-xs text-gray-400">
                  ✅ เลือกครูที่จะคุมกิจกรรมนี้ และเลือกห้องที่ต้องการ (ไม่บังคับ)
                </div>
                <el-table
                  :data="teacherSupRows"
                  border
                  v-loading="supLoading"
                  size="small"
                  :row-class-name="row => row.row.checked ? 'sup-row-checked' : ''"
                  :header-cell-style="{ background: '#0891b2', color: 'white', fontWeight: '600' }"
                  max-height="500">
                  <!-- Checkbox -->
                  <el-table-column width="52" align="center">
                    <template #default="{ row }">
                      <el-checkbox v-model="row.checked" @change="onTeacherCheck(row)" />
                    </template>
                  </el-table-column>
                  <!-- ชื่อครู -->
                  <el-table-column label="ชื่อครู" min-width="180">
                    <template #default="{ row }">
                      <div class="font-medium text-sm" :class="row.checked ? 'text-teal-700' : 'text-gray-600'">
                        {{ row.teacher_name }}
                      </div>
                      <div class="text-xs text-gray-400">{{ row.teacher_id }}</div>
                    </template>
                  </el-table-column>
                  <!-- ห้องที่จอง -->
                  <el-table-column label="ห้องที่จอง" min-width="200">
                    <template #default="{ row }">
                      <el-select
                        v-model="row.room_id"
                        :disabled="!row.checked"
                        clearable
                        filterable
                        size="small"
                        class="w-full"
                        placeholder="ไม่จอง"
                        @change="val => onRoomSelectRow(row, val)">
                        <el-option label="— ไม่จอง —" value="" />
                        <el-option-group v-if="specialRooms.length" label="🔬 Lab / ห้องพิเศษ">
                          <el-option v-for="r in specialRooms" :key="r.room_id"
                            :label="`${r.room_id} — ${r.room_name}`" :value="r.room_id" />
                        </el-option-group>
                        <el-option-group label="🏠 ห้องทั้งหมด">
                          <el-option v-for="r in rooms" :key="r.room_id"
                            :label="`${r.room_id} — ${r.room_name}`" :value="r.room_id" />
                        </el-option-group>
                      </el-select>
                    </template>
                  </el-table-column>
                  <!-- หมายเหตุ -->
                  <el-table-column label="หมายเหตุ" min-width="160">
                    <template #default="{ row }">
                      <el-input
                        v-model="row.note"
                        :disabled="!row.checked"
                        size="small"
                        placeholder="—" />
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- ==================== Activity Dialog ==================== -->
    <el-dialog
      v-model="actDialogVisible"
      :title="editingActivity ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'"
      width="560px"
      :close-on-click-modal="false">
      <el-form :model="actForm" ref="actFormRef" label-width="130px" @submit.prevent>
        <el-form-item
          label="ชื่อกิจกรรม"
          prop="name"
          :rules="[{ required: true, message: 'กรุณาระบุชื่อกิจกรรม', trigger: 'blur' }]">
          <el-input v-model="actForm.name" placeholder="เช่น กิจกรรมแนะแนว, ชมรม, ประชุม" />
        </el-form-item>

        <el-form-item
          label="วัน"
          prop="days"
          :rules="[{ required: true, type: 'array', min: 1, message: 'เลือกอย่างน้อย 1 วัน', trigger: 'change' }]">
          <el-checkbox-group v-model="actForm.days">
            <el-checkbox v-for="d in DAYS" :key="d.value" :value="d.value">{{ d.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item
          label="คาบที่เริ่ม"
          prop="start_period"
          :rules="[{ required: true, message: 'กรุณาระบุคาบที่เริ่ม', trigger: 'blur' }]">
          <el-input-number
            v-model="actForm.start_period"
            :min="1"
            :max="periodsPerDay"
            controls-position="right" />
        </el-form-item>

        <el-form-item
          label="ระยะเวลา (คาบ)"
          prop="duration_periods"
          :rules="[{ required: true, message: 'กรุณาระบุระยะเวลา', trigger: 'blur' }]">
          <el-input-number
            v-model="actForm.duration_periods"
            :min="1"
            :max="periodsPerDay"
            controls-position="right" />
          <span class="ml-2 text-gray-400 text-sm">
            สิ้นสุดคาบ {{ actForm.start_period + actForm.duration_periods - 1 }}
          </span>
        </el-form-item>

        <el-form-item label="ห้องที่เกี่ยวข้อง">
          <el-select
            v-model="actForm.target_classes"
            multiple
            filterable
            collapse-tags
            :collapse-tags-tooltip="true"
            class="w-full"
            placeholder="เลือกห้องที่เกี่ยวข้อง">
            <el-option
              v-for="c in classes"
              :key="c.class_id"
              :label="c.class_id"
              :value="c.class_id" />
          </el-select>
        </el-form-item>

        <el-form-item label="สีกิจกรรม">
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="color in ACTIVITY_COLORS"
              :key="color"
              type="button"
              class="w-6 h-6 rounded-full border-2 transition-all"
              :style="`background:${color};border-color:${actForm.color === color ? '#000' : 'transparent'}`"
              @click="actForm.color = color" />
            <span class="text-xs text-gray-400 ml-1">{{ actForm.color || 'ไม่ระบุ' }}</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="actDialogVisible = false">ยกเลิก</el-button>
        <el-button type="primary" :loading="actSaving" @click="saveActivity">บันทึก</el-button>
      </template>
    </el-dialog>

    <!-- ===== Import Activities Preview Dialog ===== -->
    <el-dialog v-model="actImportDialogVisible" title="📥 ตรวจสอบข้อมูลนำเข้า (กิจกรรม)" width="700px" destroy-on-close>
      <div class="flex gap-2 mb-3 flex-wrap">
        <el-tag type="success">✅ ถูกต้อง {{ actImportRows.filter(r => !r._error).length }} รายการ</el-tag>
        <el-tag type="danger" v-if="actImportRows.filter(r => r._error).length">
          ❌ ข้อผิดพลาด {{ actImportRows.filter(r => r._error).length }} รายการ
        </el-tag>
      </div>
      <el-table :data="actImportRows" border stripe size="small" max-height="360"
        :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600' }">
        <el-table-column prop="name" label="ชื่อกิจกรรม" min-width="150" />
        <el-table-column label="วัน" width="120">
          <template #default="{ row }">
            {{ row.days.map(d => DAYS.value.find(x => x.value === d)?.short || d).join('/') }}
          </template>
        </el-table-column>
        <el-table-column prop="start_period" label="คาบเริ่ม" width="80" align="center" />
        <el-table-column prop="duration_periods" label="ระยะเวลา" width="90" align="center" />
        <el-table-column label="ห้อง" min-width="120">
          <template #default="{ row }">{{ row.target_classes.join(', ') || '—' }}</template>
        </el-table-column>
        <el-table-column label="สถานะ" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row._error ? 'danger' : 'success'" size="small">
              {{ row._error || '✅ ถูกต้อง' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="actImportDialogVisible = false">ยกเลิก</el-button>
        <el-button type="primary" :loading="actImporting"
          :disabled="!actImportRows.filter(r => !r._error).length"
          @click="confirmActImport">
          นำเข้า {{ actImportRows.filter(r => !r._error).length }} รายการ
        </el-button>
      </template>
    </el-dialog>

    <!-- ===== Import Supervision Preview Dialog ===== -->
    <el-dialog v-model="supImportDialogVisible" title="📥 ตรวจสอบข้อมูลนำเข้า (ครูคุมกิจกรรม)" width="720px" destroy-on-close>
      <el-alert type="info" :closable="false" class="mb-3" style="font-size:12px">
        คอลัมน์: <strong>ชื่อกิจกรรม | รหัสครู | ห้อง/Lab ที่จัดกิจกรรม | หมายเหตุ</strong> — ระบบจะจับคู่กิจกรรมจากชื่อ และครูจากรหัส
      </el-alert>
      <div class="flex gap-2 mb-3 flex-wrap">
        <el-tag type="success">✅ ถูกต้อง {{ supImportRows.filter(r => !r._error).length }} รายการ</el-tag>
        <el-tag type="danger" v-if="supImportRows.filter(r => r._error).length">
          ❌ ข้อผิดพลาด {{ supImportRows.filter(r => r._error).length }} รายการ
        </el-tag>
      </div>
      <el-table :data="supImportRows" border stripe size="small" max-height="360"
        :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600' }">
        <el-table-column label="กิจกรรม" min-width="150">
          <template #default="{ row }">
            <span :class="row._act ? 'text-green-700' : 'text-red-500'">
              {{ row.act_name }}
              <span v-if="!row._act" class="text-xs">(ไม่พบ)</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="ครู" min-width="150">
          <template #default="{ row }">
            <span :class="row._teacher ? 'text-green-700' : 'text-red-500'">
              {{ row.teacher_id }}
              <span v-if="row._teacher" class="text-xs text-gray-500"> — {{ row._teacher.prefix }}{{ row._teacher.name }}</span>
              <span v-else class="text-xs">(ไม่พบ)</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="room_name" label="ห้อง/Lab ที่จัดกิจกรรม" width="120" />
        <el-table-column prop="note" label="หมายเหตุ" min-width="120" />
        <el-table-column label="สถานะ" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row._error ? 'danger' : 'success'" size="small">
              {{ row._error || '✅ ถูกต้อง' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="supImportDialogVisible = false">ยกเลิก</el-button>
        <el-button type="primary" :loading="supImporting"
          :disabled="!supImportRows.filter(r => !r._error).length"
          @click="confirmSupImport">
          นำเข้า {{ supImportRows.filter(r => !r._error).length }} รายการ
        </el-button>
      </template>
    </el-dialog>

  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp, writeBatch } from '@/supabase/firestore'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useTimetable } from '@/composables/useTimetable'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { getSchoolDb } from '@/supabase/db'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'
import { usePrintReport } from '@/composables/usePrintReport'
import { useScheduleGuard } from '@/composables/useScheduleGuard'

// ===== Stores & composables =====
const schoolStore = useSchoolStore()
const authStore = useAuthStore()
const { isLocked } = useScheduleGuard()
const { DAYS, PERIODS, loadTimetable, lockActivitySlots } = useTimetable()
const { getClasses, getTeachers, getRooms, getRoomCatalog } = useSchoolDb()
const { printReport } = usePrintReport()

const db = () => getSchoolDb()
const term = () => schoolStore.currentTerm || '2568_1'
const periodsPerDay = computed(() => schoolStore.schoolInfo?.periods_per_day || 8)

// ===== Colors =====
const ACTIVITY_COLORS = [
  '#0d9488', '#0891b2', '#1d4ed8', '#7c3aed',
  '#db2777', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#0f766e', '#1e40af', '#6d28d9',
]

// ===== State =====
const activeTab = ref('activities')
const loading = ref(false)
const activities = ref([])
const classes = ref([])
const teachers = ref([])
const rooms = ref([])

// Activities table ref + selection
const actTableRef = ref()
const selectedActRows = ref([])

// Activity Dialog
const actDialogVisible = ref(false)
const actFormRef = ref()
const actSaving = ref(false)
const editingActivity = ref(null)
const actForm = reactive({
  name: '',
  days: [1],
  start_period: 1,
  duration_periods: 1,
  target_classes: [],
  color: '#0d9488',
})
const lockingId = ref(null)

// Supervision
const selectedActId = ref(null)
const supervisions = ref([])
const supLoading = ref(false)
const supSaving = ref(false)
// Inline table rows — one per teacher, with checked/room/note state
const teacherSupRows = ref([])

// ===== Computed =====
const selectedActivity = computed(() =>
  activities.value.find(a => (a.act_id || a.id) === selectedActId.value) || null
)

const specialRooms = computed(() =>
  rooms.value.filter(r => (r.room_type === 'lab' || r.room_type === 'special') && r.is_active !== false)
)

function mapCatalogRooms(catalog) {
  const activeRooms = Array.isArray(catalog?.active_rooms) ? catalog.active_rooms : []
  return activeRooms.map(r => ({
    room_id: r.room_id,
    room_name: r.room_name || '',
    room_type: r.room_type || 'other',
    is_active: r.is_active !== false,
  }))
}

async function loadRoomOptions() {
  try {
    const catalog = await getRoomCatalog()
    const roomsFromCatalog = mapCatalogRooms(catalog)
    if (roomsFromCatalog.length) return roomsFromCatalog
  } catch {
    // fallback to direct collection read when catalog is unavailable
  }
  const allRooms = await getRooms()
  return allRooms.filter(r => r.is_active !== false)
}

// Build inline teacher rows whenever selected activity or teachers/supervisions change
function buildTeacherSupRows() {
  if (!selectedActId.value) { teacherSupRows.value = []; return }
  const actSups = supervisions.value.filter(s => s.act_id === selectedActId.value)
  // actSups already filtered by selectedActId.value which is set via act.act_id || act.id
  teacherSupRows.value = teachers.value.map(t => {
    const existing = actSups.find(s => s.teacher_id === (t.teacher_id || t.id))
    return {
      teacher_id: t.teacher_id || t.id,
      teacher_name: `${t.prefix || ''}${t.name || ''} ${t.surname || ''}`.trim(),
      checked: !!existing,
      sup_id: existing?.sup_id || null,
      room_id: existing?.room_id || '',
      room_name: existing?.room_name || '',
      note: existing?.note || '',
    }
  })
}

watch(selectedActId, buildTeacherSupRows)

// ===== Helpers =====
function normalizeDays(days, day) {
  // support both multi-day (days: number[]) and legacy single-day (day: number)
  if (Array.isArray(days) && days.length) return days
  if (day != null) return [day]
  return []
}

function getGridCell(dayVal, period) {
  return activities.value.filter(act => {
    const actDays = normalizeDays(act.days, act.day)
    if (!actDays.includes(dayVal)) return false
    const end = act.start_period + act.duration_periods - 1
    return period >= act.start_period && period <= end
  })
}

function audit() {
  return {
    updated_by: authStore.profile?.uid || 'system',
    updated_by_name: authStore.profile?.displayName || 'ระบบ',
    updated_at: serverTimestamp(),
  }
}

// ===== Data Loading =====
async function loadActivities() {
  const snap = await getDocs(collection(db(), `terms/${term()}/activity_booking`))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function loadSupervisions() {
  const snap = await getDocs(collection(db(), `terms/${term()}/activity_supervision`))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

onMounted(async () => {
  loading.value = true
  try {
    const [classesData, teachersData, roomsData, activitiesData, supervisionsData] =
      await Promise.all([getClasses(), getTeachers(), loadRoomOptions(), loadActivities(), loadSupervisions()])
    classes.value = classesData
    teachers.value = teachersData
    rooms.value = roomsData
    activities.value = activitiesData
    supervisions.value = supervisionsData
  } catch (e) {
    ElMessage.error('โหลดข้อมูลล้มเหลว: ' + e.message)
  } finally {
    loading.value = false
  }
})

// ===== Activity CRUD =====
function openActivityDialog(activity) {
  editingActivity.value = activity
  if (activity) {
    Object.assign(actForm, {
      name: activity.name || '',
      days: normalizeDays(activity.days, activity.day),
      start_period: activity.start_period || 1,
      duration_periods: activity.duration_periods || 1,
      target_classes: activity.target_classes ? [...activity.target_classes] : [],
      color: activity.color || '#0d9488',
    })
  } else {
    Object.assign(actForm, {
      name: '',
      days: [1],
      start_period: 1,
      duration_periods: 1,
      target_classes: [],
      color: '#0d9488',
    })
  }
  actDialogVisible.value = true
}

async function saveActivity() {
  try {
    await actFormRef.value.validate()
  } catch {
    return
  }
  actSaving.value = true
  try {
    const isEdit = !!editingActivity.value
    const id = isEdit ? editingActivity.value.act_id : 'act_' + Date.now()
    const data = {
      act_id: id,
      name: actForm.name,
      days: [...actForm.days],
      day: actForm.days[0] || 1,  // compat with lockActivitySlots
      start_period: actForm.start_period,
      duration_periods: actForm.duration_periods,
      target_classes: [...actForm.target_classes],
      color: actForm.color || '',
      ...audit(),
    }
    await setDoc(doc(db(), `terms/${term()}/activity_booking`, id), data)

    if (isEdit) {
      const idx = activities.value.findIndex(a => a.act_id === id)
      if (idx >= 0) activities.value[idx] = { id, ...data }
      else activities.value.push({ id, ...data })
      ElMessage.success('แก้ไขกิจกรรมเรียบร้อย')
    } else {
      activities.value.push({ id, ...data })
      ElMessage.success('เพิ่มกิจกรรมเรียบร้อย')
    }
    actDialogVisible.value = false
  } catch (e) {
    ElMessage.error('บันทึกล้มเหลว: ' + e.message)
  } finally {
    actSaving.value = false
  }
}

async function applyLock(activity) {
  lockingId.value = activity.act_id
  try {
    await loadTimetable()
    // lockActivitySlots in useTimetable uses activity.day (single), so we run for each selected day
    const actDays = normalizeDays(activity.days, activity.day)
    for (const dayVal of actDays) {
      await lockActivitySlots({ ...activity, day: dayVal })
    }
    ElMessage.success(`Lock คาบ "${activity.name}" เรียบร้อยแล้ว`)
  } catch (e) {
    ElMessage.error('Lock ล้มเหลว: ' + e.message)
  } finally {
    lockingId.value = null
  }
}

const BATCH_CHUNK_SIZE = 400
const IN_QUERY_LIMIT = 10

async function fetchTimetableRefsByActivityIds(activityIds = []) {
  if (!activityIds.length) return []
  const uniqueIds = [...new Set(activityIds.filter(Boolean).map(String))]
  const refsMap = new Map()

  for (let i = 0; i < uniqueIds.length; i += IN_QUERY_LIMIT) {
    const idsChunk = uniqueIds.slice(i, i + IN_QUERY_LIMIT)

    const [actSnap, refSnap] = await Promise.all([
      getDocs(query(collection(db(), `terms/${term()}/timetable_grid`), where('act_id', 'in', idsChunk))),
      getDocs(query(collection(db(), `terms/${term()}/timetable_grid`), where('ref_id', 'in', idsChunk))),
    ])

    actSnap.docs.forEach((d) => refsMap.set(d.id, d.ref))
    refSnap.docs.forEach((d) => refsMap.set(d.id, d.ref))
  }

  return [...refsMap.values()]
}

async function deleteRefsInChunks(refs = []) {
  if (!refs.length) return
  for (let i = 0; i < refs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = refs.slice(i, i + BATCH_CHUNK_SIZE)
    const batch = writeBatch(db())
    chunk.forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

async function deleteActivity(activity) {
  try {
    await ElMessageBox.confirm(
      `ลบกิจกรรม "${activity.name}" ใช่หรือไม่?`,
      'ยืนยันการลบ',
      { type: 'warning', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' }
    )
    const actId = activity.act_id || activity.id
    const slotRefs = await fetchTimetableRefsByActivityIds([actId])

    await deleteDoc(doc(db(), `terms/${term()}/activity_booking`, actId))
    await deleteRefsInChunks(slotRefs)

    activities.value = activities.value.filter(a => (a.act_id || a.id) !== actId)
    if (selectedActId.value === actId) selectedActId.value = null
    ElMessage.success('ลบกิจกรรมเรียบร้อย')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('ลบล้มเหลว: ' + e.message)
  }
}

async function deleteSelectedActivities() {
  if (!selectedActRows.value.length) return
  const selectedCount = selectedActRows.value.length
  try {
    await ElMessageBox.confirm(
      `ลบกิจกรรมที่เลือก ${selectedCount} รายการ ใช่หรือไม่?`,
      'ยืนยันการลบ',
      { type: 'warning', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' }
    )
  } catch { return }
  try {
    const actIds = selectedActRows.value.map(a => a.act_id || a.id).filter(Boolean)
    const slotRefs = await fetchTimetableRefsByActivityIds(actIds)

    for (let i = 0; i < actIds.length; i += BATCH_CHUNK_SIZE) {
      const chunk = actIds.slice(i, i + BATCH_CHUNK_SIZE)
      const batch = writeBatch(db())
      chunk.forEach((actId) => batch.delete(doc(db(), `terms/${term()}/activity_booking`, actId)))
      await batch.commit()
    }
    await deleteRefsInChunks(slotRefs)

    activities.value = await loadActivities()
    selectedActRows.value = []
    if (activities.value.findIndex(a => (a.act_id || a.id) === selectedActId.value) < 0) selectedActId.value = null
    ElMessage.success(`ลบ ${selectedCount} กิจกรรมเรียบร้อย`)
  } catch (e) {
    ElMessage.error('ลบล้มเหลว: ' + e.message)
  }
}

async function deleteAllActivities() {
  try {
    await ElMessageBox.confirm(
      'ลบกิจกรรมทั้งหมด และ lock slots ที่เกี่ยวข้องในตาราง ใช่หรือไม่?',
      'ยืนยันการลบทั้งหมด',
      { type: 'warning', confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก' }
    )
  } catch { return }
  try {
    const actSnap = await getDocs(collection(db(), `terms/${term()}/activity_booking`))
    const activityDocs = actSnap.docs
    const activityIds = activityDocs.map((d) => d.data().act_id || d.id).filter(Boolean)
    const slotRefs = await fetchTimetableRefsByActivityIds(activityIds)

    for (let i = 0; i < activityDocs.length; i += BATCH_CHUNK_SIZE) {
      const chunk = activityDocs.slice(i, i + BATCH_CHUNK_SIZE)
      const batch = writeBatch(db())
      chunk.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    await deleteRefsInChunks(slotRefs)

    activities.value = []
    selectedActRows.value = []
    selectedActId.value = null
    ElMessage.success('ลบกิจกรรมทั้งหมดเรียบร้อย')
  } catch (e) {
    ElMessage.error('ลบล้มเหลว: ' + e.message)
  }
}

// ===== Supervision (inline table) =====
function selectActivity(act) {
  selectedActId.value = act.act_id || act.id
  // Do NOT switch tabs here — just select
}

function onTeacherCheck(row) {
  // when unchecked, clear room/note
  if (!row.checked) {
    row.room_id = ''
    row.room_name = ''
    row.note = ''
  }
}

function onRoomSelectRow(row, val) {
  if (!val) { row.room_name = ''; return }
  const r = rooms.value.find(x => x.room_id === val)
  row.room_name = r?.room_name || r?.room_id || val
}

// Save all supervision at once (batch: create new / delete removed)
async function saveAllSupervisions() {
  if (!selectedActId.value) return
  supSaving.value = true
  try {
    const act = selectedActivity.value
    const actSups = supervisions.value.filter(s => s.act_id === selectedActId.value)

    for (const row of teacherSupRows.value) {
      const existing = actSups.find(s => s.teacher_id === row.teacher_id)

      if (row.checked && !existing) {
        // CREATE new supervision record
        const id = `sup_${selectedActId.value}_${row.teacher_id}_${Date.now()}`
        const data = {
          sup_id: id, act_id: selectedActId.value, act_name: act?.name || '',
          teacher_id: row.teacher_id, teacher_name: row.teacher_name,
          room_id: row.room_id || null, room_name: row.room_name || null,
          note: row.note || '', ...audit()
        }
        await setDoc(doc(db(), `terms/${term()}/activity_supervision`, id), data)
        supervisions.value.push({ id, ...data })
        row.sup_id = id

      } else if (row.checked && existing) {
        // UPDATE if room or note changed
        const changed = existing.room_id !== (row.room_id || null) || existing.note !== row.note
        if (changed) {
          await setDoc(doc(db(), `terms/${term()}/activity_supervision`, existing.sup_id || existing.id), {
            ...existing, room_id: row.room_id || null, room_name: row.room_name || null,
            note: row.note || '', ...audit()
          }, { merge: true })
          Object.assign(existing, { room_id: row.room_id || null, room_name: row.room_name || null, note: row.note || '' })
        }

      } else if (!row.checked && existing) {
        // DELETE supervision record
        await deleteDoc(doc(db(), `terms/${term()}/activity_supervision`, existing.sup_id || existing.id))
        supervisions.value = supervisions.value.filter(s => (s.sup_id || s.id) !== (existing.sup_id || existing.id))
        row.sup_id = null
      }
    }

    supervisions.value = await loadSupervisions()
    buildTeacherSupRows()
    ElMessage.success('บันทึกครูคุมกิจกรรมเรียบร้อย')
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    supSaving.value = false
  }
}

// ===== Import State =====
const actImportDialogVisible = ref(false)
const actImportRows = ref([])
const actImporting = ref(false)
const actFileInputRef = ref()

// Supervision Import State
const supImportDialogVisible = ref(false)
const supImportRows = ref([])
const supImporting = ref(false)
const supFileInputRef = ref()

// ===== Export Activities =====
function exportActivities() {
  const headers = ['ชื่อกิจกรรม', 'วัน (1=จ 2=อ 3=พ 4=พฤ 5=ศ 6=ส)', 'คาบเริ่ม', 'ระยะเวลา(คาบ)', 'ห้องที่เกี่ยวข้อง', 'สี']
  const rows = activities.value.map(a => [
    a.name,
    normalizeDays(a.days, a.day).join(','),
    a.start_period,
    a.duration_periods,
    (a.target_classes || []).join(','),
    a.color || '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [22, 28, 10, 14, 30, 10].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'กิจกรรม')
  XLSX.writeFile(wb, `activities_${term()}.xlsx`)
  ElMessage.success('ส่งออกข้อมูลกิจกรรมสำเร็จ')
}

// ===== Export Supervisions =====
function exportSupervisions() {
  const headers = ['กิจกรรม', 'รหัสครู', 'ชื่อครู', 'ห้อง/Lab ที่จัดกิจกรรม', 'หมายเหตุ']
  const rows = supervisions.value.map(s => [
    s.act_name || s.act_id,
    s.teacher_id,
    s.teacher_name,
    s.room_name || s.room_id || '',
    s.note || '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [22, 10, 22, 16, 20].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ครูคุมกิจกรรม')
  XLSX.writeFile(wb, `activity_supervisions_${term()}.xlsx`)
  ElMessage.success('ส่งออกข้อมูลครูคุมสำเร็จ')
}

// ===== Import Activities =====
function triggerActImport() { actFileInputRef.value?.click() }

function handleActImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result)
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (rows.length < 2) { ElMessage.warning('ไม่พบข้อมูลในไฟล์'); return }
    actImportRows.value = rows.slice(1).filter(r => r.some(c => c)).map((r, i) => {
      const daysRaw = String(r[1] || '').trim()
      const daysArr = daysRaw ? daysRaw.split(',').map(d => parseInt(d)).filter(n => !isNaN(n)) : [1]
      const classesRaw = String(r[4] || '').trim()
      const classesArr = classesRaw ? classesRaw.split(',').map(s => s.trim()).filter(Boolean) : []
      const obj = {
        _row: i + 2,
        name: String(r[0] || '').trim(),
        days: daysArr,
        start_period: parseInt(r[2]) || 1,
        duration_periods: parseInt(r[3]) || 1,
        target_classes: classesArr,
        color: String(r[5] || '#0d9488').trim(),
        _error: '',
      }
      if (!obj.name) obj._error = 'ไม่มีชื่อกิจกรรม'
      return obj
    })
    actImportDialogVisible.value = true
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function confirmActImport() {
  const valid = actImportRows.value.filter(r => !r._error)
  if (!valid.length) return
  actImporting.value = true
  try {
    for (const row of valid) {
      const { _row, _error, ...data } = row
      const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      await setDoc(doc(db(), `terms/${term()}/activity_booking`, id), {
        ...data, id, ...audit(),
      })
    }
    ElMessage.success(`นำเข้ากิจกรรม ${valid.length} รายการเรียบร้อย`)
    const snap = await getDocs(collection(db(), `terms/${term()}/activity_booking`))
    activities.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    actImportDialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    actImporting.value = false
  }
}

// ===== Import Supervisions =====
function handleSupImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result)
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
    if (rows.length < 2) { ElMessage.warning('ไม่พบข้อมูลในไฟล์'); return }

    supImportRows.value = rows.slice(1).filter(r => r.some(c => c)).map(r => {
      const actName = String(r[0] || '').trim()
      const teacherId = String(r[1] || '').trim()
      const roomName = String(r[2] || '').trim()
      const note = String(r[3] || '').trim()

      // จับคู่กิจกรรมจากชื่อ
      const matchedAct = activities.value.find(a =>
        a.name === actName || a.id === actName || a.act_id === actName
      )
      // จับคู่ครูจากรหัส
      const matchedTeacher = teachers.value.find(t =>
        (t.teacher_id || t.id) === teacherId
      )

      const obj = {
        act_name: actName,
        teacher_id: teacherId,
        room_name: roomName,
        note,
        _act: matchedAct || null,
        _teacher: matchedTeacher || null,
        _error: '',
      }
      if (!actName) obj._error = 'ไม่มีชื่อกิจกรรม'
      else if (!teacherId) obj._error = 'ไม่มีรหัสครู'
      else if (!matchedAct) obj._error = 'ไม่พบกิจกรรม'
      else if (!matchedTeacher) obj._error = 'ไม่พบครู'
      return obj
    })
    supImportDialogVisible.value = true
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function confirmSupImport() {
  const valid = supImportRows.value.filter(r => !r._error)
  if (!valid.length) return
  supImporting.value = true
  try {
    for (const row of valid) {
      const act = row._act
      const teacher = row._teacher
      const tid = teacher.teacher_id || teacher.id
      const id = `sup_${act.id || act.act_id}_${tid}_${Date.now()}`

      // ตรวจซ้ำ — ถ้ามีอยู่แล้วให้ update
      const existing = supervisions.value.find(
        s => s.act_id === (act.id || act.act_id) && s.teacher_id === tid
      )
      const docId = existing?.id || id
      const docData = {
        sup_id: docId,
        act_id: act.id || act.act_id,
        act_name: act.name || '',
        teacher_id: tid,
        teacher_name: `${teacher.prefix || ''}${teacher.name || ''} ${teacher.surname || ''}`.trim(),
        room_id: row.room_name || null,
        room_name: row.room_name || null,
        note: row.note || '',
        ...audit(),
      }
      await setDoc(doc(db(), `terms/${term()}/activity_supervision`, docId), docData, { merge: true })
    }

    ElMessage.success(`นำเข้าครูคุม ${valid.length} รายการเรียบร้อย`)
    // reload supervisions
    const snap = await getDocs(collection(db(), `terms/${term()}/activity_supervision`))
    supervisions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    buildTeacherSupRows()
    supImportDialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    supImporting.value = false
  }
}

// ===== Print Reports =====
function printActivities() {
  printReport({
    title: 'รายงานกิจกรรมและการจองคาบ',
    subtitle: `ภาคเรียน ${term()}`,
    columns: [
      { label: 'ชื่อกิจกรรม', key: 'name' },
      { label: 'วัน', render: row => normalizeDays(row.days, row.day).map(d => DAYS.value.find(x => x.value === d)?.label || d).join(', ') },
      { label: 'คาบเริ่ม', key: 'start_period', width: '80px' },
      { label: 'ระยะเวลา', render: row => `${row.duration_periods} คาบ`, width: '90px' },
      { label: 'ห้องที่เกี่ยวข้อง', render: row => (row.target_classes || []).join(', ') },
    ],
    rows: activities.value,
    extraInfo: [['ภาคเรียน', term()], ['กิจกรรมทั้งหมด', `${activities.value.length} รายการ`]],
  })
}

function printSupervisions() {
  printReport({
    title: 'รายงานครูคุมกิจกรรม',
    subtitle: `ภาคเรียน ${term()}`,
    columns: [
      { label: 'กิจกรรม', render: row => row.act_name || row.act_id },
      { label: 'ชื่อครู', key: 'teacher_name' },
      { label: 'รหัสครู', key: 'teacher_id', width: '90px' },
      { label: 'ห้อง/Lab ที่จัดกิจกรรม', render: row => row.room_name || row.room_id || '—' },
      { label: 'หมายเหตุ', key: 'note' },
    ],
    rows: supervisions.value,
    extraInfo: [['ภาคเรียน', term()], ['รายการทั้งหมด', `${supervisions.value.length} รายการ`]],
  })
}
</script>

<style scoped>
:deep(.sup-row-checked td) {
  background: #f0fdf4 !important;
}
</style>
