<template>
  <AppLayout>
    <div class="flex" style="height:100vh;background:#f1f5f9;overflow:hidden">

      <!-- ===== Left Panel ===== -->
      <div class="flex-shrink-0 flex flex-col bg-white border-r" style="width:195px;height:100vh">
        <!-- Tab toggle -->
        <div class="flex text-xs font-bold border-b flex-shrink-0">
          <button @click="leftMode='assign'"
            :class="['flex-1 py-2 transition-all border-r', leftMode==='assign' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50']">
            📚 วิชา
          </button>
          <button @click="leftMode='lock'"
            :class="['flex-1 py-2 transition-all', leftMode==='lock' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50']">
            🔒 ล็อกคาบ
          </button>
        </div>

        <!-- ===== Assignments mode ===== -->
        <template v-if="leftMode==='assign'">
          <!-- Filter + Sort area (fixed) -->
          <div class="flex-shrink-0 border-b" style="background:#faf5ff">
            <div class="p-2 space-y-1.5">
              <!-- Filter type tabs -->
              <div class="flex text-xs gap-0.5">
                <button :class="['flex-1 py-0.5 rounded font-medium transition-all', filterMode==='class' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']" style="font-size:10px" @click="filterMode='class';clearFilters()">🏫 ห้อง</button>
                <button :class="['flex-1 py-0.5 rounded font-medium transition-all', filterMode==='teacher' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']" style="font-size:10px" @click="filterMode='teacher';clearFilters()">👨‍🏫 ครู</button>
                <button :class="['flex-1 py-0.5 rounded font-medium transition-all', filterMode==='lab' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']" style="font-size:10px" @click="filterMode='lab';clearFilters()">🏛 Lab</button>
              </div>
              <!-- Filter by class -->
              <template v-if="filterMode==='class'">
                <el-select v-model="filterClasses" placeholder="ทุกห้อง" class="w-full" size="small" multiple collapse-tags :collapse-tags-tooltip="true" clearable>
                  <el-option v-for="c in classes" :key="c.class_id" :label="c.class_id" :value="c.class_id" />
                </el-select>
                <div class="flex gap-1">
                  <button class="flex-1 text-xs py-0.5 rounded text-white font-medium transition-all hover:opacity-80" style="background:#7c3aed;font-size:10px" @click="filterClasses = classes.map(c => c.class_id)">ทั้งหมด</button>
                  <button class="flex-1 text-xs py-0.5 rounded font-medium transition-all hover:opacity-80" style="background:#e5e7eb;color:#6b7280;font-size:10px" @click="filterClasses = []">ยกเลิก</button>
                </div>
              </template>
              <!-- Filter by teacher -->
              <template v-else-if="filterMode==='teacher'">
                <el-select v-model="filterTeachers" placeholder="ทุกครู" class="w-full" size="small" multiple collapse-tags :collapse-tags-tooltip="true" clearable filterable>
                  <el-option v-for="t in teachers" :key="t.teacher_id" :label="`${t.prefix||''}${t.name} ${t.surname}`" :value="t.teacher_id" />
                </el-select>
                <div class="flex gap-1">
                  <button class="flex-1 text-xs py-0.5 rounded text-white font-medium transition-all hover:opacity-80" style="background:#1d4ed8;font-size:10px" @click="filterTeachers = teachers.map(t => t.teacher_id)">ทั้งหมด</button>
                  <button class="flex-1 text-xs py-0.5 rounded font-medium transition-all hover:opacity-80" style="background:#e5e7eb;color:#6b7280;font-size:10px" @click="filterTeachers = []">ยกเลิก</button>
                </div>
              </template>
              <!-- Filter by lab/room -->
              <template v-else>
                <el-select v-model="filterLabs" placeholder="ทุก Lab" class="w-full" size="small" multiple collapse-tags :collapse-tags-tooltip="true" clearable>
                  <el-option v-for="r in roomList" :key="r" :label="r" :value="r" />
                </el-select>
                <div class="flex gap-1">
                  <button class="flex-1 text-xs py-0.5 rounded text-white font-medium transition-all hover:opacity-80" style="background:#059669;font-size:10px" @click="filterLabs = [...roomList]">ทั้งหมด</button>
                  <button class="flex-1 text-xs py-0.5 rounded font-medium transition-all hover:opacity-80" style="background:#e5e7eb;color:#6b7280;font-size:10px" @click="filterLabs = []">ยกเลิก</button>
                </div>
              </template>
            </div>
            <!-- Sort row -->
            <div class="px-2 pb-2 flex items-center gap-1">
              <span class="text-gray-400 flex-shrink-0" style="font-size:10px">เรียง</span>
              <el-select v-model="cardSortBy" size="small" class="flex-1" style="font-size:10px">
                <el-option label="ห้อง" value="class" />
                <el-option label="ชื่อวิชา" value="subject" />
                <el-option label="ครู" value="teacher" />
                <el-option label="คาบ ↓" value="remaining_desc" />
                <el-option label="คาบ ↑" value="remaining_asc" />
              </el-select>
            </div>
          </div>

          <!-- Cards (scrollable independently) -->
          <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div v-for="a in sortedPendingAssignments" :key="a.id"
              class="rounded-lg select-none text-xs transition-all"
              :class="highlightedAssignId === (a.assign_id || a.id) ? 'ring-2 ring-orange-500' : ''"
              :style="`border-left:3px solid ${getSubjectColor(a.subject_code)};background:${getSubjectColor(a.subject_code)}18`"
            >
              <!-- Card main area: click to select + drag -->
              <div class="p-2 active:opacity-50"
                :class="isLocked ? 'cursor-default' : 'cursor-grab'"
                :draggable="!isLocked"
                @dragstart="!isLocked && onDragStart($event, a)"
                @click="selectAssignment(a)"
              >
                <div class="flex items-center justify-between mb-0.5">
                  <span class="font-bold text-purple-600" style="font-size:10px">🏫 {{ a.class_id }}</span>
                  <el-tag v-if="a.consecutive_periods > 1" size="small" type="warning" style="font-size:9px;padding:0 4px">{{ a.consecutive_periods }}ติด</el-tag>
                </div>
                <div class="font-semibold text-gray-800 leading-tight truncate">{{ a.subject_name }}</div>
                <div class="text-gray-500 mt-0.5 truncate">{{ a.teacher_name }}</div>
                <div class="flex items-center justify-between mt-0.5">
                  <span class="text-gray-500">เหลือ <b>{{ a.remaining }}</b> คาบ</span>
                </div>
                <div v-if="a.preferred_room" class="text-blue-400 truncate mt-0.5" style="font-size:10px">🏛 {{ a.preferred_room }}</div>
              </div>
              <!-- Card action row -->
              <div v-if="!isLocked" class="flex border-t" :style="`border-color:${getSubjectColor(a.subject_code)}30`">
                <button class="flex-1 py-1 text-center text-blue-500 hover:bg-blue-50 transition-all rounded-bl-lg"
                  style="font-size:10px"
                  @click.stop="openCardEdit(a)"
                  title="เปลี่ยนผู้สอน">✏️ เปลี่ยนครู</button>
                <button class="flex-1 py-1 text-center text-red-400 hover:bg-red-50 transition-all rounded-br-lg"
                  style="font-size:10px"
                  @click.stop="removeCardSlots(a)"
                  title="ลบออกจากตาราง">🗑 ล้างตาราง</button>
              </div>
            </div>
            <div v-if="!sortedPendingAssignments.length && assignments.length" class="text-center py-6 text-green-500 text-xs">✅ จัดครบแล้ว!</div>
          </div>
        </template>

        <!-- ===== Lock mode ===== -->
        <template v-else>
          <div class="flex-1 overflow-y-auto p-2.5" style="background:#fffbeb">
            <div class="text-xs font-bold text-orange-600 mb-2.5 flex items-center gap-1">🔒 ล็อกคาบกิจกรรม</div>
            <div class="space-y-2 text-xs">

              <!-- ชื่อกิจกรรม -->
              <div class="rounded-lg p-2" style="background:#fff7ed;border:1px solid #fed7aa">
                <div class="text-orange-700 font-semibold mb-1">ชื่อกิจกรรม <span class="text-red-400">*</span></div>
                <el-input v-model="lockForm.name" size="small" placeholder="เช่น โฮมรูม, ประชุม" />
              </div>

              <!-- ประเภทล็อก -->
              <div class="rounded-lg p-2" style="background:#eff6ff;border:1px solid #bfdbfe">
                <div class="text-blue-700 font-semibold mb-1">ประเภทล็อก</div>
                <el-select v-model="lockForm.lock_type" size="small" class="w-full">
                  <el-option label="🏫 ห้องเรียน" value="class" />
                  <el-option label="👨‍🏫 อาจารย์" value="teacher" />
                  <el-option label="🏛 ห้อง/Lab" value="room" />
                </el-select>
              </div>

              <!-- วัน -->
              <div class="rounded-lg p-2" style="background:#f0fdf4;border:1px solid #bbf7d0">
                <div class="text-green-700 font-semibold mb-1">📅 วัน</div>
                <el-select v-model="lockForm.day" size="small" class="w-full">
                  <el-option label="📅 ทุกวัน" :value="0" />
                  <el-option v-for="d in DAYS" :key="d.value" :label="d.label" :value="d.value" />
                </el-select>
              </div>

              <!-- คาบเริ่ม + จำนวนคาบ (dropdown) -->
              <div class="rounded-lg p-2" style="background:#fdf4ff;border:1px solid #e9d5ff">
                <div class="text-purple-700 font-semibold mb-1.5">⏰ ช่วงคาบ</div>
                <div class="flex gap-1.5">
                  <div class="flex-1">
                    <div class="text-purple-500 mb-0.5" style="font-size:10px">คาบเริ่ม</div>
                    <el-select v-model="lockForm.start_period" size="small" class="w-full">
                      <el-option v-for="p in PERIODS" :key="p" :label="`คาบ ${p}`" :value="p" />
                    </el-select>
                  </div>
                  <div class="flex-1">
                    <div class="text-purple-500 mb-0.5" style="font-size:10px">จำนวน</div>
                    <el-select v-model="lockForm.duration_periods" size="small" class="w-full">
                      <el-option v-for="n in 6" :key="n" :label="`${n} คาบ`" :value="n" />
                    </el-select>
                  </div>
                </div>
                <div class="mt-1 text-purple-400" style="font-size:10px">
                  คาบ {{ lockForm.start_period }} – {{ Math.min(lockForm.start_period + lockForm.duration_periods - 1, PERIODS.length) }}
                </div>
              </div>

              <!-- Class selector -->
              <div v-if="lockForm.lock_type === 'class'" class="rounded-lg p-2" style="background:#eff6ff;border:1px solid #bfdbfe">
                <div class="text-blue-700 font-semibold mb-1">🏫 ห้องที่ล็อก <span class="text-red-400">*</span></div>
                <el-select v-model="lockForm.target_classes" multiple size="small" class="w-full" collapse-tags :collapse-tags-tooltip="true">
                  <el-option v-for="c in classes" :key="c.class_id" :label="c.class_id" :value="c.class_id" />
                </el-select>
                <div class="flex gap-1 mt-1.5">
                  <button class="flex-1 text-xs py-0.5 rounded text-white font-medium transition-all hover:opacity-80"
                    style="background:#1d4ed8;font-size:10px"
                    @click="lockForm.target_classes = classes.map(c => c.class_id)">ทั้งหมด</button>
                  <button class="flex-1 text-xs py-0.5 rounded font-medium transition-all hover:opacity-80"
                    style="background:#e5e7eb;color:#6b7280;font-size:10px"
                    @click="lockForm.target_classes = []">ยกเลิก</button>
                </div>
              </div>

              <!-- Teacher selector -->
              <div v-else-if="lockForm.lock_type === 'teacher'" class="rounded-lg p-2" style="background:#f0fdf4;border:1px solid #bbf7d0">
                <div class="text-green-700 font-semibold mb-1">👨‍🏫 อาจารย์ที่ล็อก <span class="text-red-400">*</span></div>
                <el-select v-model="lockForm.target_teachers" multiple size="small" class="w-full" collapse-tags :collapse-tags-tooltip="true" filterable>
                  <el-option v-for="t in teachers" :key="t.teacher_id"
                    :label="`${t.prefix||''}${t.name} ${t.surname}`" :value="t.teacher_id" />
                </el-select>
                <div class="flex gap-1 mt-1.5">
                  <button class="flex-1 text-xs py-0.5 rounded text-white font-medium transition-all hover:opacity-80"
                    style="background:#15803d;font-size:10px"
                    @click="lockForm.target_teachers = teachers.map(t => t.teacher_id)">ทั้งหมด</button>
                  <button class="flex-1 text-xs py-0.5 rounded font-medium transition-all hover:opacity-80"
                    style="background:#e5e7eb;color:#6b7280;font-size:10px"
                    @click="lockForm.target_teachers = []">ยกเลิก</button>
                </div>
              </div>

              <!-- Room selector -->
              <div v-else-if="lockForm.lock_type === 'room'" class="rounded-lg p-2" style="background:#fdf4ff;border:1px solid #e9d5ff">
                <div class="text-purple-700 font-semibold mb-1">🏛 ห้อง/Lab ที่ล็อก <span class="text-red-400">*</span></div>
                <el-select v-model="lockForm.target_rooms" multiple size="small" class="w-full" collapse-tags :collapse-tags-tooltip="true">
                  <el-option v-for="r in roomList" :key="r" :label="r" :value="r" />
                </el-select>
              </div>

              <el-button type="warning" size="small" class="w-full" :loading="lockSaving"
                :disabled="isLocked" @click="guardAction(doLock)"
                style="font-weight:700;letter-spacing:0.5px">
                🔒 ล็อกคาบ
              </el-button>
            </div>
          </div>
        </template>
      </div>

      <!-- ===== Floating Legend (fixed bottom) ===== -->
      <div class="fixed bottom-3 right-3 z-50 rounded-xl shadow-lg border px-3 py-2 flex gap-3 flex-wrap items-center"
        style="background:rgba(255,255,255,0.97);backdrop-filter:blur(8px);border-color:#e5e7eb;font-size:11px;max-width:500px">
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 rounded" style="background:#fef9c3;border:3px solid #ca8a04"></div><span class="text-gray-600">⭐ เลือกอยู่</span></div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 rounded" style="background:#dcfce7;border:3px solid #16a34a"></div><span class="text-gray-600">🔄 สลับได้</span></div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 rounded" style="background:#f0fdf4;border:2px solid #86efac"></div><span class="text-gray-600">✅ ย้ายได้</span></div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 rounded" style="background:#eff6ff;border:3px solid #3b82f6"></div><span class="text-gray-600">🎯 เป้าหมาย</span></div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 rounded" style="background:#fef08a;border:2px solid #ca8a04"></div><span class="text-gray-600">🔒 ล็อก</span></div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 rounded" style="background:#fef2f2;border:2px dashed #dc2626"></div><span class="text-gray-600">⛔ วางไม่ได้</span></div>
        <div class="flex items-center gap-1.5"><div class="w-4 h-4 rounded" style="background:#f0fdf4;border:2px dashed #16a34a"></div><span class="text-gray-600">🟢 วางได้</span></div>
      </div>

      <!-- ===== Main: 3 stacked panels ===== -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4" :class="fontScaleClass" style="height:100vh" @contextmenu="onContextCancel">

        <!-- Workflow pre-check card: run activity locks and supervision locks before scheduling -->
        <div v-if="workflowStep !== null" class="rounded-xl border overflow-hidden"
          style="border-color:#c4b5fd;background:#faf5ff">
          <div class="flex items-center justify-between px-3 py-2"
            style="background:linear-gradient(135deg,#f3e8ff,#ede9fe)">
            <div class="text-xs font-semibold text-purple-700">📋 ขั้นตอนก่อนจัดตารางสอน</div>
            <button class="text-xs text-purple-500 hover:text-purple-700 underline" @click="workflowStep = null">ข้ามทั้งหมด</button>
          </div>

          <div class="px-3 py-2 text-xs" style="color:#92400e;background:#fef3c7;border-top:1px solid #f59e0b">
            ⚠️ กรุณาดำเนินการล็อกกิจกรรมและครูคุมก่อน หรือกดข้ามขั้นตอน
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
            <div class="rounded-lg border p-2.5" :style="workflowStep === '1' ? 'border-color:#a78bfa;background:#f5f3ff' : 'border-color:#bbf7d0;background:#f0fdf4'">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-semibold" :class="workflowStep === '1' ? 'text-purple-700' : 'text-green-700'">
                  {{ workflowStep === '1' ? '① ลงกิจกรรม' : '✅ ลงกิจกรรมแล้ว' }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mb-2">นำคาบกิจกรรมจากตารางกิจกรรมมาลงในตารางสอน</p>
              <div class="flex items-center gap-2">
                <el-button v-if="workflowStep === '1'" size="small" :loading="workflowLoading === '1'" :disabled="!!workflowLoading"
                  @click="doApplyAllActivities"
                  style="background:#7c3aed;border-color:#7c3aed;color:white;font-weight:700">
                  ① ลงกิจกรรม
                </el-button>
                <button v-if="workflowStep === '1'" class="text-xs text-gray-400 hover:text-gray-600 underline" @click="workflowStep = '2'">ข้ามขั้นตอนนี้</button>
              </div>
            </div>

            <div class="rounded-lg border p-2.5" :style="workflowStep === '2' ? 'border-color:#93c5fd;background:#eff6ff' : 'border-color:#e5e7eb;background:#f9fafb'">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-semibold" :class="workflowStep === '2' ? 'text-blue-700' : 'text-gray-400'">② ครูคุม + ล็อกห้อง</span>
              </div>
              <p class="text-xs text-gray-500 mb-2">นำข้อมูลครูคุมกิจกรรมมาลงตารางครู และล็อกห้องที่จองไว้</p>
              <div class="flex items-center gap-2">
                <el-button v-if="workflowStep === '2'" size="small" type="primary" :loading="workflowLoading === '2'" :disabled="!!workflowLoading"
                  @click="doApplySupervisions" style="font-weight:700">
                  ② ครูคุม + ล็อกห้อง
                </el-button>
                <span v-else class="text-xs text-gray-400">⏳ รอขั้นตอนที่ 1</span>
                <button v-if="workflowStep === '2'" class="text-xs text-gray-400 hover:text-gray-600 underline" @click="workflowStep = null">ข้ามขั้นตอนนี้</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Lock Banner -->
        <div v-if="isLocked" class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;color:#b91c1c">
          🔒 ระบบจัดตารางสอนถูกล็อค — ดูและพิมพ์ได้อย่างเดียว ไม่สามารถแก้ไขได้
        </div>

        <!-- Toolbar -->
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-lg font-bold text-gray-700">📅 ตารางสอน</h1>
          <div class="text-xs bg-white rounded-lg px-3 py-1 border" :class="highlightedAssignId ? 'text-green-600 font-semibold border-green-300 bg-green-50' : 'text-gray-400'">
            <template v-if="highlightedAssignId">✅ คลิกช่องสีเขียวในตารางเพื่อลงวิชา หรือลากวางก็ได้</template>
            <template v-else>คลิกวิชาซ้าย → ไฮไลต์ช่องว่าง | คลิกช่องว่างในตาราง → หาวิชาที่ย้ายได้</template>
          </div>
          <!-- Live / Offline indicator -->
          <el-tag v-if="rt.connected.value" type="success" size="small" class="tt-connected">● Live</el-tag>
          <el-tag v-else type="danger" size="small">● Offline</el-tag>

          <div class="ml-auto flex items-center gap-2 flex-wrap">
            <span v-if="loading" class="text-xs text-blue-400 animate-pulse">⏳ กำลังโหลด...</span>

            <!-- Swap Mode button -->
            <el-button v-if="!isLocked"
              :type="swapMode ? 'warning' : 'default'"
              size="small"
              @click="toggleSwapMode()"
              @keyup.esc="exitSwapMode"
            >
              {{ swapMode ? '🔄 กำลัง Swap... (คลิก ESC ยกเลิก)' : '🔄 Swap Mode' }}
            </el-button>

            <!-- Auto Schedule buttons (F6) -->
            <el-button v-if="!isLocked" type="success" size="small" @click="handleAutoScheduleConfirm" :loading="scheduling && !aiMode">
              ⚡ จัดอัตโนมัติ
            </el-button>
            <el-button v-if="!isLocked" type="info" size="small" @click="handleAIModeConfirm" :loading="scheduling && aiMode">
              🤖 จัด AI
            </el-button>

            <!-- Clear All button — SchoolAdmin only -->
            <el-button v-if="!isLocked && authStore.isAdmin" type="danger" size="small" plain @click="handleClearAll">
              🗑️ ล้างตาราง
            </el-button>

            <el-button size="small" plain @click="refreshAll">🔄 รีเฟรช</el-button>
            <div class="flex items-center gap-1">
              <el-button size="small" plain @click="decreaseFontScale" title="ลดขนาดตัวอักษร">
                📉 ↓
              </el-button>
              <span class="text-xs text-gray-500 min-w-10 text-center">{{ fontScalePercent }}</span>
              <el-button size="small" plain @click="increaseFontScale" title="เพิ่มขนาดตัวอักษร">
                📈 ↑
              </el-button>
            </div>
          </div>
        </div>

        <!-- ===== PANEL 1: ชั้นเรียน ===== -->
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-2.5 border-b panel-header-class flex-wrap">
            <span class="font-bold text-purple-700">🏫 ชั้นเรียน</span>
            <el-select v-model="selectedClass" placeholder="เลือกห้อง" size="small" style="width:90px" @change="onClassChange">
              <el-option v-for="c in classes" :key="c.class_id" :label="c.class_id" :value="c.class_id" />
            </el-select>
            <div class="flex items-center gap-1">
              <el-button size="small" plain :disabled="!canSelectPrevClass" @click="selectPrevClass" title="ห้องเรียนก่อนหน้า">↑</el-button>
              <el-button size="small" plain :disabled="!canSelectNextClass" @click="selectNextClass" title="ห้องเรียนถัดไป">↓</el-button>
            </div>
            <span v-if="selectedClass" class="text-xs text-gray-400">
              จัดแล้ว <b class="text-purple-600">{{ classPlacedCount }}</b>/{{ classTotalPeriods }} คาบ
            </span>
            <span class="text-xs text-gray-300 ml-auto">ลากวางจากแผง ← ซ้าย</span>
          </div>
          <div class="overflow-x-auto">
            <table class="tt-table">
              <colgroup>
                <col style="width:58px">
                <col v-for="p in PERIODS" :key="p">
              </colgroup>
              <thead>
                <tr>
                  <th class="tt-th-day">วัน</th>
                  <th v-for="p in PERIODS" :key="p" class="tt-th">
                    <div>คาบ {{ p }}</div>
                    <div class="tt-time">{{ PERIOD_TIMES[p] }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(day, di) in DAYS" :key="day.value" :class="di%2===0?'':'bg-slate-50/40'">
                  <td class="tt-day" :class="day.value===todayNum?'tt-today':''">
                    <div class="font-bold">{{ day.short }}</div>
                    <div style="font-size:9px;opacity:0.6">{{ day.label }}</div>
                  </td>
                  <td v-for="p in PERIODS" :key="p"
                    class="tt-cell"
                    :class="[
                      getCellHighlight(rt.getClassSlot(day.value, p, selectedClass)),
                      getSwapCellClass(rt.getClassSlot(day.value, p, selectedClass)),
                      getCellDragClass(day.value, p, selectedClass),
                      getSuggestedClass(day.value, p),
                      getCellTargetClass(day.value, p),
                      !rt.getClassSlot(day.value, p, selectedClass) ? 'hover:bg-purple-50 cursor-pointer' : 'cursor-pointer'
                    ]"
                    :title="rt.getClassSlot(day.value,p,selectedClass)?.type==='subject' ? 'คลิกเพื่อเลือกสลับ' : ''"
                    @dragover.prevent
                    @dragenter="onDragEnter($event, day.value, p, selectedClass)"
                    @dragleave="onDragLeave"
                    @drop="isLocked ? showLockMsg() : onDrop($event, day.value, p)"
                    @click="onCellClick(rt.getClassSlot(day.value, p, selectedClass), 'class', day.value, p)"
                    @dblclick="!isLocked && onCellDblClick(day.value, p, selectedClass, 'class')"
                  >
                    <!-- Inline lock input -->
                    <template v-if="isInlineLockCell(day.value, p, selectedClass, 'class')">
                      <div class="tt-inline-lock">
                        <input
                          v-model="inlineLockLabel"
                          class="tt-inline-input"
                          placeholder="ชื่อกิจกรรม"
                          autofocus
                          @keyup.enter="confirmInlineLock"
                          @keyup.esc="inlineLockCell = null"
                          @blur="confirmInlineLock"
                          ref="inlineLockInputRef"
                        />
                      </div>
                    </template>
                    <template v-else-if="rt.getClassSlot(day.value, p, selectedClass)">
                      <div v-if="rt.getClassSlot(day.value, p, selectedClass).type==='activity' || rt.getClassSlot(day.value, p, selectedClass).type==='manual_lock'" class="tt-act">
                        <span>🔒</span>
                        <div class="tt-act-name">{{ rt.getClassSlot(day.value, p, selectedClass).act_name || rt.getClassSlot(day.value, p, selectedClass).name }}</div>
                        <button class="tt-del" @click.stop="removeActivityLock(rt.getClassSlot(day.value, p, selectedClass))" title="ลบ Lock">✕</button>
                      </div>
                      <div v-else class="tt-subj"
                        :style="`border-left:3px solid ${getSubjectColor(rt.getClassSlot(day.value,p,selectedClass).subject_code)};background:${getSubjectColor(rt.getClassSlot(day.value,p,selectedClass).subject_code)}18`">
                        <div class="tt-subj-content">
                          <div class="tt-subj-name">{{ rt.getClassSlot(day.value, p, selectedClass).subject_name }}</div>
                          <div class="tt-subj-sub">{{ rt.getClassSlot(day.value, p, selectedClass).teacher_name }}</div>
                          <!-- Co-teach badges -->
                          <div v-for="ct in getCoTeachSlots(day.value, p, selectedClass)" :key="ct.id" class="tt-coteach-badge">
                            <span>{{ ct.teacher_name }}</span>
                            <button @click.stop="rt.removeSlot(ct.id)" class="tt-coteach-rm">✕</button>
                          </div>
                          <div v-if="rt.getClassSlot(day.value, p, selectedClass).preferred_room" class="tt-room">🏛 {{ rt.getClassSlot(day.value, p, selectedClass).preferred_room }}</div>
                        </div>
                        <div v-if="!isLocked" class="tt-slot-actions">
                          <button class="tt-sbtn tt-sbtn-coteach" @click.stop="openCoTeach(rt.getClassSlot(day.value, p, selectedClass))" title="เพิ่มครูสอนช่วย">👨‍🏫+</button>
                          <button class="tt-sbtn tt-sbtn-del" @click.stop="removeClassSlot(day.value, p)" title="ลบ slot นี้">✕</button>
                        </div>
                      </div>
                    </template>
                    <div v-else class="tt-empty">+</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ===== PANEL 2: อาจารย์ ===== -->
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-2.5 border-b panel-header-teacher flex-wrap">
            <span class="font-bold text-blue-700">👨‍🏫 อาจารย์</span>
            <el-select v-model="selectedTeacher" placeholder="เลือกอาจารย์" size="small" style="width:210px" filterable>
              <el-option v-for="t in teachers" :key="t.teacher_id"
                :label="`${t.prefix||''}${t.name} ${t.surname}`" :value="t.teacher_id" />
            </el-select>
            <div class="flex items-center gap-1">
              <el-button size="small" plain :disabled="!canSelectPrevTeacher" @click="selectPrevTeacher" title="ครูก่อนหน้า">↑</el-button>
              <el-button size="small" plain :disabled="!canSelectNextTeacher" @click="selectNextTeacher" title="ครูถัดไป">↓</el-button>
            </div>
            <span v-if="selectedTeacher" class="text-xs text-gray-400">
              <b class="text-blue-600">{{ teacherTotalPeriods }}</b> คาบ/สัปดาห์
            </span>
            <span class="text-xs text-gray-300 ml-auto">sync จากคลิก slot</span>
          </div>
          <div class="overflow-x-auto">
            <table class="tt-table">
              <colgroup>
                <col style="width:58px">
                <col v-for="p in PERIODS" :key="p">
              </colgroup>
              <thead>
                <tr>
                  <th class="tt-th-day tt-blue">วัน</th>
                  <th v-for="p in PERIODS" :key="p" class="tt-th tt-blue">
                    <div>คาบ {{ p }}</div>
                    <div class="tt-time">{{ PERIOD_TIMES[p] }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(day, di) in DAYS" :key="day.value" :class="di%2===0?'':'bg-slate-50/40'">
                  <td class="tt-day" :class="day.value===todayNum?'tt-today':''">
                    <div class="font-bold">{{ day.short }}</div>
                    <div style="font-size:9px;opacity:0.6">{{ day.label }}</div>
                  </td>
                  <td v-for="p in PERIODS" :key="p"
                    class="tt-cell hover:bg-blue-50 cursor-pointer"
                    :class="[
                      getCellHighlight(rt.getTeacherSlot(day.value, p, selectedTeacher)),
                      getSwapCellClass(rt.getTeacherSlot(day.value, p, selectedTeacher)),
                      getCellDragClass(day.value, p, selectedTeacher),
                      getSuggestedClass(day.value, p),
                      getCellTargetClass(day.value, p)
                    ]"
                    :title="rt.getTeacherSlot(day.value,p,selectedTeacher)?.type==='subject' ? 'คลิกเพื่อเลือกสลับ' : ''"
                    @dragover.prevent
                    @dragenter="onDragEnter($event, day.value, p, selectedTeacher)"
                    @dragleave="onDragLeave"
                    @drop="isLocked ? showLockMsg() : onDropTeacher($event, day.value, p)"
                    @click="onCellClick(rt.getTeacherSlot(day.value, p, selectedTeacher), 'teacher', day.value, p)"
                    @dblclick="!isLocked && onCellDblClick(day.value, p, selectedTeacher, 'teacher')"
                  >
                    <template v-if="isInlineLockCell(day.value, p, selectedTeacher, 'teacher')">
                      <div class="tt-inline-lock">
                        <input
                          v-model="inlineLockLabel"
                          class="tt-inline-input"
                          placeholder="ชื่อกิจกรรม"
                          autofocus
                          @keyup.enter="confirmInlineLock"
                          @keyup.esc="inlineLockCell = null"
                          @blur="confirmInlineLock"
                        />
                      </div>
                    </template>
                    <template v-else-if="rt.getTeacherSlot(day.value, p, selectedTeacher)">
                      <div v-if="rt.getTeacherSlot(day.value,p,selectedTeacher).type==='activity' || rt.getTeacherSlot(day.value,p,selectedTeacher).type==='manual_lock'" class="tt-act">
                        <span>🔒</span>
                        <div class="tt-act-name">{{ rt.getTeacherSlot(day.value,p,selectedTeacher).act_name || rt.getTeacherSlot(day.value,p,selectedTeacher).name }}</div>
                        <button class="tt-del" @click.stop="removeActivityLock(rt.getTeacherSlot(day.value, p, selectedTeacher))" title="ลบ Lock">✕</button>
                      </div>
                      <div v-else class="tt-subj"
                        :style="`border-left:3px solid ${getSubjectColor(rt.getTeacherSlot(day.value,p,selectedTeacher).subject_code)};background:${getSubjectColor(rt.getTeacherSlot(day.value,p,selectedTeacher).subject_code)}18`">
                        <div class="tt-subj-content">
                          <div class="tt-class-badge">{{ rt.getTeacherSlot(day.value, p, selectedTeacher).class_id }}</div>
                          <div class="tt-subj-name">{{ rt.getTeacherSlot(day.value, p, selectedTeacher).subject_name }}</div>
                          <div v-if="rt.getTeacherSlot(day.value, p, selectedTeacher).preferred_room" class="tt-room">🏛 {{ rt.getTeacherSlot(day.value, p, selectedTeacher).preferred_room }}</div>
                        </div>
                      </div>
                    </template>
                    <div v-else class="tt-empty text-blue-100">—</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ===== PANEL 3: ห้อง/Lab ===== -->
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-2.5 border-b panel-header-room flex-wrap">
            <span class="font-bold text-emerald-700">🏛 ห้อง/Lab</span>
            <el-select v-model="selectedRoom" placeholder="เลือกห้อง/Lab" size="small" style="width:150px">
              <el-option v-for="r in roomList" :key="r" :label="r" :value="r" />
            </el-select>
            <div class="flex items-center gap-1">
              <el-button size="small" plain :disabled="!canSelectPrevRoom" @click="selectPrevRoom" title="ห้อง/Lab ก่อนหน้า">↑</el-button>
              <el-button size="small" plain :disabled="!canSelectNextRoom" @click="selectNextRoom" title="ห้อง/Lab ถัดไป">↓</el-button>
            </div>
            <span v-if="selectedRoom" class="text-xs text-gray-400">
              <b class="text-emerald-600">{{ roomTotalPeriods }}</b> คาบ/สัปดาห์
            </span>
            <el-tag v-if="selectedRoom" type="success" size="small" class="ml-1">เลือกอิสระได้</el-tag>
            <span class="text-xs text-gray-300 ml-auto">เลือก room เพื่อตรวจการใช้ห้อง</span>
          </div>
          <div v-if="!roomList.length" class="p-4 text-sm text-amber-600 bg-amber-50">
            ⚠️ ยังไม่มีห้อง/Lab — กรอกช่อง "ห้อง/Lab" ในหน้า <b>มอบหมายภาระงาน</b> ก่อน
          </div>
          <div v-else class="overflow-x-auto">
            <table class="tt-table">
              <colgroup>
                <col style="width:58px">
                <col v-for="p in PERIODS" :key="p">
              </colgroup>
              <thead>
                <tr>
                  <th class="tt-th-day tt-green">วัน</th>
                  <th v-for="p in PERIODS" :key="p" class="tt-th tt-green">
                    <div>คาบ {{ p }}</div>
                    <div class="tt-time">{{ PERIOD_TIMES[p] }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(day, di) in DAYS" :key="day.value" :class="di%2===0?'':'bg-slate-50/40'">
                  <td class="tt-day" :class="day.value===todayNum?'tt-today':''">
                    <div class="font-bold">{{ day.short }}</div>
                    <div style="font-size:9px;opacity:0.6">{{ day.label }}</div>
                  </td>
                  <td v-for="p in PERIODS" :key="p"
                    class="tt-cell hover:bg-emerald-50 cursor-pointer"
                    :class="[
                      getCellHighlight(rt.getRoomSlot(day.value, p, selectedRoom)),
                      getSwapCellClass(rt.getRoomSlot(day.value, p, selectedRoom)),
                      getCellDragClass(day.value, p, selectedRoom),
                      getSuggestedClass(day.value, p),
                      getCellTargetClass(day.value, p)
                    ]"
                    :title="rt.getRoomSlot(day.value,p,selectedRoom)?.type==='subject' ? 'คลิกเพื่อเลือกสลับ' : ''"
                    @dragover.prevent
                    @dragenter="onDragEnter($event, day.value, p, selectedRoom)"
                    @dragleave="onDragLeave"
                    @drop="isLocked ? showLockMsg() : onDropRoom($event, day.value, p)"
                    @click="onCellClick(rt.getRoomSlot(day.value, p, selectedRoom), 'room', day.value, p)"
                    @dblclick="!isLocked && onCellDblClick(day.value, p, selectedRoom, 'room')"
                  >
                    <template v-if="isInlineLockCell(day.value, p, selectedRoom, 'room')">
                      <div class="tt-inline-lock">
                        <input
                          v-model="inlineLockLabel"
                          class="tt-inline-input"
                          placeholder="ชื่อกิจกรรม"
                          autofocus
                          @keyup.enter="confirmInlineLock"
                          @keyup.esc="inlineLockCell = null"
                          @blur="confirmInlineLock"
                        />
                      </div>
                    </template>
                    <template v-else-if="rt.getRoomSlot(day.value, p, selectedRoom)">
                      <div v-if="rt.getRoomSlot(day.value,p,selectedRoom).type==='activity' || rt.getRoomSlot(day.value,p,selectedRoom).type==='manual_lock'" class="tt-act">
                        <span>🔒</span>
                        <div class="tt-act-name">{{ rt.getRoomSlot(day.value,p,selectedRoom).act_name || rt.getRoomSlot(day.value,p,selectedRoom).name }}</div>
                        <div v-if="rt.getRoomSlot(day.value,p,selectedRoom).teacher_name" class="tt-subj-sub" style="font-size:9px;color:#065f46">{{ rt.getRoomSlot(day.value,p,selectedRoom).teacher_name }}</div>
                        <button class="tt-del" @click.stop="removeActivityLock(rt.getRoomSlot(day.value, p, selectedRoom))" title="ลบ Lock">✕</button>
                      </div>
                      <div v-else class="tt-subj"
                        :style="`border-left:3px solid ${getSubjectColor(rt.getRoomSlot(day.value,p,selectedRoom).subject_code)};background:${getSubjectColor(rt.getRoomSlot(day.value,p,selectedRoom).subject_code)}18`">
                        <div class="tt-subj-content">
                          <div class="tt-class-badge" style="color:#059669">{{ rt.getRoomSlot(day.value, p, selectedRoom).class_id }}</div>
                          <div class="tt-subj-name">{{ rt.getRoomSlot(day.value, p, selectedRoom).subject_name }}</div>
                          <div class="tt-subj-sub">{{ rt.getRoomSlot(day.value, p, selectedRoom).teacher_name }}</div>
                        </div>
                      </div>
                    </template>
                    <div v-else class="tt-empty text-emerald-100">—</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div><!-- end main -->
    </div><!-- end flex -->

    <!-- ===== Edit Slot Dialog ===== -->
    <el-dialog v-model="editDlg.visible" title="📌 รายละเอียด Slot" width="440px" destroy-on-close>
      <div v-if="editDlg.slot" class="space-y-4">
        <!-- Slot info card -->
        <div class="p-3 rounded-xl text-sm"
          :style="`background:${getSubjectColor(editDlg.slot.subject_code)}12;border-left:4px solid ${getSubjectColor(editDlg.slot.subject_code)}`">
          <div class="font-bold text-gray-800 text-base">{{ editDlg.slot.subject_name }}</div>
          <div class="text-gray-400 text-xs mt-0.5">{{ editDlg.slot.subject_code }}</div>
          <div class="flex gap-4 mt-2 text-xs text-gray-600 flex-wrap">
            <span>🏫 ห้อง {{ editDlg.slot.class_id }}</span>
            <span>📅 {{ getDayLabel(editDlg.slot.day) }} คาบ {{ editDlg.slot.period }}</span>
            <span v-if="editDlg.slot.preferred_room">🏛 {{ editDlg.slot.preferred_room }}</span>
          </div>
        </div>

        <!-- Change teacher -->
        <div v-if="editDlg.slot.type !== 'activity' && editDlg.slot.type !== 'manual_lock'">
          <div class="text-sm font-semibold text-gray-700 mb-1">👨‍🏫 เปลี่ยนครูผู้สอน</div>
          <div class="text-xs text-gray-400 mb-2">
            จะเปลี่ยน<b>ทุก slot</b> ของวิชา <span class="text-purple-600">{{ editDlg.slot.subject_name }}</span>
            ห้อง <span class="text-purple-600">{{ editDlg.slot.class_id }}</span>
            และอัปเดตรายการมอบหมายงานอัตโนมัติ
          </div>
          <el-select v-model="editDlg.newTeacherId" class="w-full" filterable>
            <el-option v-for="t in teachers" :key="t.teacher_id"
              :label="`${t.prefix||''}${t.name} ${t.surname}`" :value="t.teacher_id" />
          </el-select>
        </div>

        <!-- Swap Mode trigger from dialog -->
        <div v-if="editDlg.slot.type === 'subject'" class="pt-1">
          <el-button size="small" type="info" plain @click="startSwapFromDialog">
            🔄 เข้าสู่ Swap Mode สำหรับ slot นี้
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button v-if="editDlg.slot?.type !== 'activity' && editDlg.slot?.type !== 'manual_lock'" type="danger" plain @click="deleteEditSlot">🗑 ลบ slot</el-button>
        <el-button v-if="editDlg.slot?.type !== 'activity' && editDlg.slot?.type !== 'manual_lock'" type="danger" plain @click="removeSlotById(editDlg.slot.id)">🗑️ ลบคาบนี้</el-button>
        <el-button v-if="editDlg.slot?.type !== 'activity' && editDlg.slot?.type !== 'manual_lock'" type="danger" @click="removeAllSlotsOfAssignment(editDlg.slot.assign_id)">🗑️🗑️ ลบทุกคาบวิชานี้</el-button>
        <div class="flex-1"></div>
        <el-button @click="editDlg.visible=false">ปิด</el-button>
        <el-button v-if="editDlg.slot?.type !== 'activity' && editDlg.slot?.type !== 'manual_lock'" type="primary" :loading="editSaving" @click="saveEditSlot">💾 บันทึก</el-button>
      </template>
    </el-dialog>

    <!-- ===== Auto Schedule Result Dialog ===== -->
    <el-dialog v-model="autoDialogVisible" title="🤖 จัดตารางอัตโนมัติ" width="600px" :close-on-click-modal="false">
      <!-- Log output -->
      <div class="bg-gray-900 rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-xs text-green-400 mb-4">
        <div v-for="(line, i) in scheduleLog" :key="i">{{ line }}</div>
        <div v-if="scheduling" class="animate-pulse text-yellow-400">⏳ กำลังประมวลผล...</div>
      </div>
      <!-- Result stats -->
      <div v-if="scheduleResult" class="grid grid-cols-3 gap-3 mb-4">
        <div class="text-center p-3 bg-green-50 rounded-lg">
          <div class="text-2xl font-bold text-green-600">{{ scheduleResult.placed }}</div>
          <div class="text-xs text-gray-500">คาบที่จัดได้</div>
        </div>
        <div class="text-center p-3 bg-red-50 rounded-lg">
          <div class="text-2xl font-bold text-red-500">{{ scheduleResult.unplaced }}</div>
          <div class="text-xs text-gray-500">วิชาที่ยังไม่ได้จัด</div>
        </div>
        <div class="text-center p-3 bg-blue-50 rounded-lg">
          <div class="text-2xl font-bold text-blue-600">{{ scheduleResult.total }}</div>
          <div class="text-xs text-gray-500">คาบทั้งหมด</div>
        </div>
      </div>
      <!-- Unplaced list -->
      <div v-if="scheduleResult?.unplacedList?.length" class="mb-3">
        <div class="text-sm font-semibold text-red-600 mb-2">วิชาที่ยังจัดไม่ได้:</div>
        <el-table :data="scheduleResult.unplacedList" size="small" max-height="200"
          :header-cell-style="{ background: '#dc2626', color: 'white' }">
          <el-table-column prop="subject_name" label="วิชา" />
          <el-table-column prop="class_id" label="ห้อง" width="90" />
          <el-table-column prop="teacher_name" label="ครู" />
          <el-table-column prop="remaining" label="คาบที่เหลือ" width="90" align="center" />
        </el-table>
      </div>
      <template #footer>
        <el-button
          v-if="schoolStore.schoolInfo?.anthropic_api_key && scheduleResult?.unplacedList?.length"
          type="info" :loading="scheduling" @click="handleAIMode">
          🤖 ให้ AI ช่วยจัดส่วนที่เหลือ
        </el-button>
        <el-button
          v-else-if="!schoolStore.schoolInfo?.anthropic_api_key && scheduleResult?.unplacedList?.length"
          disabled title="ตั้งค่า Anthropic API Key ก่อนใน ตั้งค่าระบบ">
          🤖 AI Mode (ตั้งค่า API Key ก่อน)
        </el-button>
        <el-button type="danger" plain @click="handleClearAuto">🗑 ล้างที่จัดอัตโนมัติ</el-button>
        <el-button @click="autoDialogVisible = false">ปิด</el-button>
      </template>
    </el-dialog>

    <!-- ===== Card Edit Dialog (F4: change teacher + room, remove placed slots) ===== -->
    <el-dialog v-model="cardEditDlg.visible" title="✏️ แก้ไขวิชา — เปลี่ยนผู้สอน / ห้อง Lab" width="400px" destroy-on-close>
      <div v-if="cardEditDlg.assignment" class="space-y-3">
        <div class="p-3 rounded-xl text-sm"
          :style="`background:${getSubjectColor(cardEditDlg.assignment.subject_code)}10;border-left:4px solid ${getSubjectColor(cardEditDlg.assignment.subject_code)}`">
          <div class="font-bold text-gray-800">{{ cardEditDlg.assignment.subject_name }}</div>
          <div class="text-xs text-gray-400 mt-0.5">{{ cardEditDlg.assignment.subject_code }} | ห้อง {{ cardEditDlg.assignment.class_id }}</div>
          <div class="text-xs text-gray-500 mt-1">ครูปัจจุบัน: {{ cardEditDlg.assignment.teacher_name }}</div>
          <div v-if="cardEditDlg.assignment.preferred_room" class="text-xs text-blue-500 mt-0.5">ห้องปัจจุบัน: {{ cardEditDlg.assignment.preferred_room }}</div>
        </div>
        <div>
          <div class="text-sm font-semibold text-gray-700 mb-1.5">เลือกครูใหม่</div>
          <el-select v-model="cardEditDlg.newTeacherId" class="w-full" filterable placeholder="ค้นหาครู">
            <el-option v-for="t in teachers" :key="t.teacher_id"
              :label="`${t.prefix||''}${t.name} ${t.surname}`" :value="t.teacher_id" />
          </el-select>
        </div>
        <div>
          <div class="text-sm font-semibold text-gray-700 mb-1.5">เลือกห้อง/Lab ใหม่ (ไม่บังคับ)</div>
          <el-select v-model="cardEditDlg.newPreferredRoom" class="w-full" clearable placeholder="ไม่เปลี่ยนห้อง">
            <el-option v-for="r in roomList" :key="r" :label="r" :value="r" />
          </el-select>
          <div class="text-xs text-gray-400 mt-1.5">⚠️ การบันทึกจะลบคาบที่จัดไปแล้วทั้งหมด เพื่อจัดใหม่</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="cardEditDlg.visible = false">ยกเลิก</el-button>
        <el-button type="primary" :loading="cardEditDlg.saving" @click="saveCardTeacher">💾 บันทึก</el-button>
      </template>
    </el-dialog>

    <!-- ===== F7: Auto Confirm Dialog ===== -->
    <el-dialog v-model="autoConfirmDlg.visible" :title="autoConfirmDlg.mode==='ai' ? '🤖 ยืนยันจัด AI' : '⚡ ยืนยันจัดอัตโนมัติ'" width="420px">
      <div class="space-y-3 text-sm">
        <div class="p-3 rounded-lg" style="background:#f0fdf4;border:1px solid #bbf7d0">
          <div class="font-semibold text-green-700 mb-1">สถิติก่อนจัด</div>
          <div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>วิชาที่ยังไม่ได้จัด: <b class="text-purple-600">{{ pendingAssignments.length }}</b> รายการ</div>
            <div>คาบที่ต้องจัด: <b class="text-blue-600">{{ pendingAssignments.reduce((s,a)=>s+(a.remaining||0),0) }}</b> คาบ</div>
          </div>
        </div>
        <div v-if="autoConfirmDlg.mode==='auto'" class="text-xs text-gray-500">
          ระบบจะใช้ Algorithm Greedy + Most Constrained First จัดตารางให้อัตโนมัติ
        </div>
        <div v-else class="text-xs text-gray-500">
          ระบบจะส่งข้อมูลให้ AI วิเคราะห์และจัดตารางวิชาที่เหลือ (ต้องตั้งค่า Anthropic API Key)
        </div>
      </div>
      <template #footer>
        <el-button @click="autoConfirmDlg.visible = false">ยกเลิก</el-button>
        <el-button :type="autoConfirmDlg.mode==='ai' ? 'info' : 'success'" @click="doConfirmAutoSchedule">
          {{ autoConfirmDlg.mode==='ai' ? '🤖 จัดด้วย AI' : '⚡ เริ่มจัดอัตโนมัติ' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- ===== F11: Co-teach Dialog ===== -->
    <el-dialog v-model="coTeachDlg.visible" title="👨‍🏫+ เพิ่มครูร่วมสอน" width="380px" destroy-on-close>
      <div v-if="coTeachDlg.slot" class="space-y-3 text-sm">
        <div class="p-3 rounded-lg" :style="`background:${getSubjectColor(coTeachDlg.slot.subject_code)}10;border-left:4px solid ${getSubjectColor(coTeachDlg.slot.subject_code)}`">
          <div class="font-bold text-gray-800">{{ coTeachDlg.slot.subject_name }}</div>
          <div class="text-xs text-gray-500 mt-0.5">{{ getDayLabel(coTeachDlg.slot.day) }} คาบ {{ coTeachDlg.slot.period }} | ห้อง {{ coTeachDlg.slot.class_id }}</div>
        </div>
        <div>
          <div class="font-semibold text-gray-700 mb-1.5">เลือกครูร่วมสอน</div>
          <el-select v-model="coTeachDlg.teacherId" class="w-full" filterable placeholder="เลือกครู">
            <el-option v-for="t in availableCoTeachers" :key="t.teacher_id"
              :label="`${t.prefix||''}${t.name} ${t.surname}`" :value="t.teacher_id" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button @click="coTeachDlg.visible = false">ยกเลิก</el-button>
        <el-button type="primary" @click="confirmCoTeach">💾 เพิ่มครูร่วมสอน</el-button>
      </template>
    </el-dialog>

  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useTimetable } from '@/composables/useTimetable'
import { useRealtimeTimetable } from '@/composables/useRealtimeTimetable'
import { useAutoScheduler } from '@/composables/useAutoScheduler'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useSchedulerPresence } from '@/composables/useSchedulerPresence'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'
import { useScheduleGuard } from '@/composables/useScheduleGuard'

const router = useRouter()
const schoolStore = useSchoolStore()
const authStore = useAuthStore()
const { isLocked, showLockMsg, guardAction } = useScheduleGuard()
const presence = useSchedulerPresence()
const term = () => schoolStore.currentTerm || '2568_1'

const {
  DAYS, PERIODS, PERIOD_TIMES,
  loading,
  getSubjectColor,
} = useTimetable()

// Real-time timetable composable
const rt = useRealtimeTimetable()

// Auto scheduler composable
const {
  scheduling,
  scheduleLog,
  scheduleResult,
  runAutoSchedule,
  clearAutoSlots,
  findSwappableSlots,
  runAISchedule,
} = useAutoScheduler()

const { getTeachers, getClasses, getRooms, getRoomCatalog } = useSchoolDb()

// ===== State =====
const selectedClass   = ref('')
const selectedTeacher = ref('')
const selectedRoom    = ref('')
const activeSlot      = ref(null)
const leftMode        = ref('assign')   // 'assign' | 'lock'
const classes         = ref([])
const teachers        = ref([])
const roomMasterIds   = ref([])
const assignments     = ref([])
const dragData        = ref(null)

const editDlg     = reactive({ visible: false, slot: null, newTeacherId: '' })
const editSaving  = ref(false)

const lockForm = reactive({
  name: '',
  lock_type: 'class',       // 'class' | 'teacher' | 'room'
  day: 0,                   // 0 = ทุกวัน, 1-7 = วันเฉพาะ
  start_period: 1,
  duration_periods: 1,
  target_classes: [],
  target_teachers: [],
  target_rooms: [],
})
const lockSaving = ref(false)

// Auto schedule dialog
const autoDialogVisible = ref(false)

// Swap mode
const swapMode    = ref(false)
const swapSource  = ref(null)
const swappableIds = ref([])

// Highlighted assignment (orange)
const highlightedAssignId = ref('')

// Suggested cells (green dot) when assignment is selected
const suggestedCells = ref(new Set())

// Multi-class filter for left panel
const filterClasses = ref([])
const filterTeachers = ref([])
const filterLabs     = ref([])
const filterMode     = ref('class')   // 'class' | 'teacher' | 'lab'

// Card sort
const cardSortBy = ref('class')

// Workflow: null = normal edit, '1' = post-clear (show activity btn), '2' = show supervision btn
const workflowStep = ref(null)

// Workflow loading: '1' = applying activities, '2' = applying supervisions
const workflowLoading = ref('')

// Card edit dialog (F4: change teacher + room from left panel)
const cardEditDlg = reactive({ visible: false, assignment: null, newTeacherId: '', newPreferredRoom: '', saving: false })

// F6: AI mode flag
const aiMode = ref(false)

// F7: Auto-confirm dialog
const autoConfirmDlg = reactive({ visible: false, mode: '' })

// F8: Drag-over cell state
const dragOverCell = ref(null)   // key `${day}_${period}`
const emptyTarget    = ref(null)   // { day, period } — chosen empty cell in reverse swap
let assignmentsLoadPromise = null

// F11: Co-teach dialog
const coTeachDlg = reactive({ visible: false, slot: null, teacherId: '' })

// Click-to-lock (inline)
const inlineLockCell  = ref(null)   // { day, period, classId, view }
const inlineLockLabel = ref('')
const inlineLockInputRef = ref(null)

const todayNum = new Date().getDay()

// Font size control: 1 = 100% (default), user can adjust ±0.1 per click (0.7–2.0)
const fontScale = ref(1.0)
function increaseFontScale() {
  fontScale.value = Math.min(fontScale.value + 0.1, 2.0)
}
function decreaseFontScale() {
  fontScale.value = Math.max(fontScale.value - 0.1, 0.7)
}
const fontScaleClass = computed(() => `tt-scale-${Math.round(fontScale.value * 100)}`)
const fontScalePercent = computed(() => `${Math.round(fontScale.value * 100)}%`)

// ===== Computed =====

const roomList = computed(() => {
  return [...roomMasterIds.value].sort((a, b) => a.localeCompare(b, 'th'))
})

const classIds = computed(() => classes.value.map(c => c.class_id).filter(Boolean))
const teacherIds = computed(() => teachers.value.map(t => t.teacher_id).filter(Boolean))

const selectedClassIndex = computed(() => classIds.value.indexOf(selectedClass.value))
const selectedTeacherIndex = computed(() => teacherIds.value.indexOf(selectedTeacher.value))
const selectedRoomIndex = computed(() => roomList.value.indexOf(selectedRoom.value))

const canSelectPrevClass = computed(() => selectedClassIndex.value > 0)
const canSelectNextClass = computed(() => selectedClassIndex.value > -1 && selectedClassIndex.value < classIds.value.length - 1)
const canSelectPrevTeacher = computed(() => selectedTeacherIndex.value > 0)
const canSelectNextTeacher = computed(() => selectedTeacherIndex.value > -1 && selectedTeacherIndex.value < teacherIds.value.length - 1)
const canSelectPrevRoom = computed(() => selectedRoomIndex.value > 0)
const canSelectNextRoom = computed(() => selectedRoomIndex.value > -1 && selectedRoomIndex.value < roomList.value.length - 1)

// roomList uses rooms master data so invalid values in preferred_room (e.g. teacher names) are excluded.

const pendingAssignments = computed(() => {
  const base = assignments.value.filter(a => !a.done)
  if (filterMode.value === 'class' && filterClasses.value.length)
    return base.filter(a => filterClasses.value.includes(a.class_id))
  if (filterMode.value === 'teacher' && filterTeachers.value.length)
    return base.filter(a => filterTeachers.value.includes(a.teacher_id))
  if (filterMode.value === 'lab' && filterLabs.value.length)
    return base.filter(a => filterLabs.value.includes(a.preferred_room))
  return base
})

const sortedPendingAssignments = computed(() => {
  const arr = [...pendingAssignments.value]
  switch (cardSortBy.value) {
    case 'subject':    return arr.sort((a,b) => (a.subject_name||'').localeCompare(b.subject_name||'', 'th'))
    case 'teacher':    return arr.sort((a,b) => (a.teacher_name||'').localeCompare(b.teacher_name||'', 'th'))
    case 'remaining_desc': return arr.sort((a,b) => (b.remaining||0) - (a.remaining||0))
    case 'remaining_asc':  return arr.sort((a,b) => (a.remaining||0) - (b.remaining||0))
    default:           return arr.sort((a,b) => (a.class_id||'').localeCompare(b.class_id||'', 'th'))
  }
})

const classPlacedCount = computed(() => {
  if (!selectedClass.value) return 0
  return rt.timetableSlots.value.filter(s => s.class_id === selectedClass.value && s.type === 'subject').length
})
const classTotalPeriods = computed(() => {
  if (!selectedClass.value) return 0
  return assignments.value.filter(a => a.class_id === selectedClass.value).reduce((s, a) => s + (a.periods_per_week || 0), 0)
})
const teacherTotalPeriods = computed(() => {
  if (!selectedTeacher.value) return 0
  return rt.timetableSlots.value.filter(s => s.teacher_id === selectedTeacher.value && s.type === 'subject').length
})
const roomTotalPeriods = computed(() => {
  if (!selectedRoom.value) return 0
  return rt.timetableSlots.value.filter(s => s.preferred_room === selectedRoom.value && s.type === 'subject').length
})

function mapCatalogRoomIds(catalog) {
  const activeRooms = Array.isArray(catalog?.active_rooms) ? catalog.active_rooms : []
  return activeRooms
    .map(r => (r.room_id || '').toString().trim())
    .filter(Boolean)
}

async function loadRoomMasterIds() {
  try {
    const catalog = await getRoomCatalog()
    const ids = mapCatalogRoomIds(catalog)
    if (ids.length) return ids
  } catch {
    // fallback to direct collection read when catalog is unavailable
  }
  const rooms = await getRooms()
  return rooms
    .map(x => (x.room_id || x.id || '').toString().trim())
    .filter(Boolean)
}

// F9: Workflow gate — ready only when workflowStep is null
const isWorkflowReady = computed(() => workflowStep.value === null)

// F11: Teachers not busy at current coTeach slot's day/period
const availableCoTeachers = computed(() => {
  if (!coTeachDlg.slot) return teachers.value
  const { day, period } = coTeachDlg.slot
  return teachers.value.filter(t => !rt.teacherMap.value[`${day}_${period}_${t.teacher_id}`])
})

// ===== Mount / Unmount =====
onMounted(async () => {
  if (schoolStore.isViewOnlyMode) {
    ElMessage.warning('แพ็กเกจหมดอายุ: ใช้งานได้เฉพาะดูตารางสอน')
    router.replace('/planning/print')
    return
  }

  if (presence.isSchedulableRole()) {
    const { allowed, activeCount, limit } = await presence.canEnterByLimit(schoolStore.schedulerLimit)
    if (!allowed) {
      ElMessage.error(`จำนวนผู้จัดตารางเต็มแล้ว (${activeCount}/${limit})`)
      router.replace('/dashboard')
      return
    }
    presence.startHeartbeat()
    window.addEventListener('beforeunload', onBeforeUnload)
  }

  // Start real-time subscription first
  rt.subscribe()

  const [c, t, r] = await Promise.all([getClasses(), getTeachers(), loadRoomMasterIds()])
  classes.value = c
  teachers.value = t
  roomMasterIds.value = r
  await loadAssignmentsWithProgress()

  // Auto-select first items so tables are never blank on first load
  if (!selectedClass.value   && c.length)  selectedClass.value   = c[0].class_id
  if (!selectedTeacher.value && t.length)  selectedTeacher.value = t[0].teacher_id

  // Auto-select first room after a tick (computed roomList needs timetableSlots)
  if (!selectedRoom.value && roomList.value.length) selectedRoom.value = roomList.value[0]

  // ESC key to exit swap mode
  window.addEventListener('keyup', onGlobalKeyUp)
})

onUnmounted(() => {
  presence.stopHeartbeat()
  presence.leave()
  window.removeEventListener('beforeunload', onBeforeUnload)
  rt.unsubscribe()
  window.removeEventListener('keyup', onGlobalKeyUp)
})

function onBeforeUnload() {
  presence.stopHeartbeat()
  presence.leave()
}

function cancelInteractiveState() {
  let cancelled = false
  if (swapMode.value) {
    exitSwapMode()
    cancelled = true
  }
  if (inlineLockCell.value) {
    inlineLockCell.value = null
    cancelled = true
  }
  return cancelled
}

function onGlobalKeyUp(e) {
  if (e.key === 'Escape') {
    cancelInteractiveState()
  }
}

function onContextCancel(event) {
  if (!swapMode.value && !inlineLockCell.value) return
  event.preventDefault()
  cancelInteractiveState()
}

function clearFilters() {
  filterClasses.value  = []
  filterTeachers.value = []
  filterLabs.value     = []
}

async function refreshAll() {
  await loadAssignmentsWithProgress(true)
  ElMessage.success('รีเฟรชข้อมูลแล้ว')
}

// ===== Select assignment card → sync all 3 panels =====
function selectAssignment(a) {
  highlightedAssignId.value = a.assign_id || a.id
  if (a.class_id) selectedClass.value = a.class_id
  if (a.teacher_id) selectedTeacher.value = a.teacher_id
  if (a.preferred_room && roomList.value.includes(a.preferred_room)) selectedRoom.value = a.preferred_room
  // Compute available cells hint
  computeSuggestedCells(a)
}

function computeSuggestedCells(assignment) {
  const cells = new Set()
  DAYS.value.forEach(d => {
    PERIODS.value.forEach(p => {
      const check = rt.checkFree(d.value, p, assignment.class_id, assignment.teacher_id, assignment.preferred_room || null)
      if (check.allOk) {
        cells.add(`${d.value}_${p}`)
      }
    })
  })
  suggestedCells.value = cells
}

function getSuggestedClass(day, period) {
  if (suggestedCells.value.has(`${day}_${period}`)) return 'tt-suggested'
  return ''
}

function getCellTargetClass(day, period) {
  if (!emptyTarget.value) return ''
  return (emptyTarget.value.day === day && emptyTarget.value.period === period) ? 'swap-target' : ''
}

// Reverse swap: user clicked an empty cell → find all slots movable there
function enterReverseSwapMode(day, period, source) {
  const contextId = source === 'class'   ? selectedClass.value
                  : source === 'teacher' ? selectedTeacher.value
                  : selectedRoom.value
  if (!contextId) return

  const movable = rt.timetableSlots.value.filter(s => {
    if (s.type !== 'subject' || s.is_coteach) return false
    const matches = source === 'class'   ? s.class_id === contextId
                  : source === 'teacher' ? s.teacher_id === contextId
                  : s.preferred_room === contextId
    if (!matches) return false
    if (s.day === day && s.period === period) return false
    const chk = rt.checkFree(day, period, s.class_id, s.teacher_id, s.preferred_room || null, [s.id])
    return chk.allOk
  })

  if (!movable.length) {
    ElMessage.warning('🚫 ไม่มีคาบใดที่สามารถย้ายมาที่นี่ได้')
    return
  }

  swapMode.value = true
  swapSource.value = null
  emptyTarget.value = { day, period }
  swappableIds.value = movable.map(s => s.id)
  suggestedCells.value = new Set()
  ElMessage({
    message: `🎯 พบ ${movable.length} วิชาที่ย้ายมาได้ (เน้นสีเขียว) — คลิกเพื่อย้าย | ESC ยกเลิก`,
    type: 'success',
    duration: 4000,
  })
}

// ===== Card: open edit-teacher dialog =====
function openCardEdit(a) {
  cardEditDlg.assignment = a
  cardEditDlg.newTeacherId = a.teacher_id
  cardEditDlg.newPreferredRoom = a.preferred_room || ''
  cardEditDlg.saving = false
  cardEditDlg.visible = true
}

// ===== Card: save new teacher + room (F4: deletes ALL placed slots to reset them as pending) =====
async function saveCardTeacher() {
  const a = cardEditDlg.assignment
  if (!a || !cardEditDlg.newTeacherId) return
  const teacher = teachers.value.find(t => t.teacher_id === cardEditDlg.newTeacherId)
  if (!teacher) { ElMessage.error('ไม่พบครูที่เลือก'); return }
  cardEditDlg.saving = true
  try {
    const newName = `${teacher.prefix||''}${teacher.name} ${teacher.surname}`
    const assignId = a.assign_id || a.id
    const newRoom = cardEditDlg.newPreferredRoom || a.preferred_room || null

    // Delete ALL timetable_slots for this assignment (F4: reset to pending)
    const slotsToDelete = rt.timetableSlots.value.filter(s => s.assign_id === assignId && s.class_id === a.class_id)
    const schoolId = authStore.schoolId
    const t = term()
    if (slotsToDelete.length) {
      const slotIds = slotsToDelete.map(s => s._db_id || s.id).filter(Boolean)
      if (slotIds.length) {
        const { error } = await supabase.from('timetable_slots').delete().in('id', slotIds)
        if (error) throw error
      }
    }
    // Update remaining timetable_slots for this class+subject+teacher with new teacher + preferred_room
    const { error: updateError } = await supabase
      .from('timetable_slots')
      .update({ teacher_id: cardEditDlg.newTeacherId, room_id: newRoom, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('term_id', t)
      .eq('class_id', a.class_id)
      .eq('subject_id', a.subject_code)
    if (updateError) throw updateError

    // update local
    const idx = assignments.value.findIndex(x => (x.assign_id || x.id) === assignId)
    if (idx >= 0) assignments.value[idx] = {
      ...assignments.value[idx],
      teacher_id: cardEditDlg.newTeacherId,
      teacher_name: newName,
      preferred_room: newRoom
    }
    if (selectedTeacher.value === a.teacher_id) selectedTeacher.value = cardEditDlg.newTeacherId
    await loadAssignmentsWithProgress()
    ElMessage.success(`อัปเดตวิชา "${a.subject_name}" — เปลี่ยนครูเป็น "${newName}" และล้าง ${slotsToDelete.length} คาบเพื่อจัดใหม่`)
    cardEditDlg.visible = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    cardEditDlg.saving = false
  }
}

// ===== Card: remove all timetable slots for this assignment =====
async function removeCardSlots(a) {
  const assignId = a.assign_id || a.id
  const toDelete = rt.timetableSlots.value.filter(s => s.assign_id === assignId)
  if (!toDelete.length) { ElMessage.info('ไม่มีคาบในตารางสำหรับวิชานี้'); return }
  try {
    await ElMessageBox.confirm(`ลบ ${toDelete.length} คาบของ "${a.subject_name}" (${a.class_id}) ออกจากตาราง?`, 'ยืนยัน', { type: 'warning' })
  } catch { return }
  try {
    const dbIds = toDelete.map(s => s._db_id || s.id).filter(Boolean)
    if (dbIds.length) {
      const { error } = await supabase.from('timetable_slots').delete().in('id', dbIds)
      if (error) throw error
    }
    await loadAssignmentsWithProgress()
    ElMessage.success(`ลบ ${toDelete.length} คาบแล้ว`)
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
}

// ===== ① ลงกิจกรรม: lock activity slots for all target classes =====
// Helper: Convert Firestore docs to plain objects (remove reactive proxies)
function toPlainObject(obj) {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toPlainObject)
  const plain = {}
  for (const [key, value] of Object.entries(obj)) {
    plain[key] = toPlainObject(value)
  }
  return plain
}

async function doApplyAllActivities() {
  workflowLoading.value = '1'
  try {
    const schoolId = authStore.schoolId
    const t = term()
    const { data: actData, error: actErr } = await supabase
      .from('activity_bookings')
      .select('*')
      .eq('school_id', schoolId)
      .eq('term_id', t)
    if (actErr) throw actErr

    const acts = (actData || []).filter(a => a.start_period && a.duration_periods && Array.isArray(a.target_classes))
    if (!acts.length) { ElMessage.warning('ยังไม่มีกิจกรรม — กรอกกิจกรรมในหน้า ActivityBooking ก่อน'); return }

    const payloads = []
    acts.forEach(act => {
      const days = Array.isArray(act.days) && act.days.length ? act.days : (act.day != null ? [act.day] : [])
      const targetClasses = Array.isArray(act.target_classes) ? act.target_classes : []
      days.forEach(dayVal => {
        targetClasses.forEach(classId => {
          try {
            const startPeriod = Number(act.start_period)
            const durationPeriods = Number(act.duration_periods)
            for (let p = startPeriod; p < startPeriod + durationPeriods; p++) {
              payloads.push({
                school_id: schoolId,
                term_id: t,
                class_id: String(classId),
                day_of_week: Number(dayVal),
                period_number: Number(p),
                slot_type: 'activity',
                subject_id: null,
                teacher_id: null,
                room_id: null,
                act_id: String(act.act_id || act.id),
                act_name: String(act.name || ''),
                is_locked: true,
              })
            }
          } catch (err) {
            console.warn(`Failed to prepare slot for ${classId} day ${dayVal}:`, err.message)
          }
        })
      })
    })

    const CHUNK = 400
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const { error } = await supabase
        .from('timetable_slots')
        .upsert(payloads.slice(i, i + CHUNK), { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
      if (error) throw error
    }

    workflowStep.value = '2'
    ElMessage.success(`✅ ลงกิจกรรม ${payloads.length} คาบ (${acts.length} กิจกรรม) เรียบร้อย — กดปุ่ม ② ครูคุม`)
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    workflowLoading.value = ''
  }
}

// ===== ② ครูคุม: lock teacher + lab/room slots from activity_supervision =====
async function doApplySupervisions() {
  workflowLoading.value = '2'
  try {
    const schoolId = authStore.schoolId
    const t = term()
    const [{ data: actData, error: actErr }, { data: supData, error: supErr }] = await Promise.all([
      supabase.from('activity_bookings').select('*').eq('school_id', schoolId).eq('term_id', t),
      supabase.from('activity_supervisions').select('*').eq('school_id', schoolId).eq('term_id', t),
    ])
    if (actErr) throw actErr
    if (supErr) throw supErr

    const acts = actData || []
    const checkedSups = (supData || []).filter(s => s.teacher_id)
    if (!checkedSups.length) { ElMessage.warning('ยังไม่มีครูคุมกิจกรรม — กำหนดครูคุมในหน้า ActivityBooking ก่อน'); return }

    const payloads = []
    checkedSups.forEach(sup => {
      const act = acts.find(a => (a.act_id || a.id) === sup.act_id)
      if (!act) return
      const days = Array.isArray(act.days) && act.days.length ? act.days : (act.day != null ? [act.day] : [])

      days.forEach(dayVal => {
        try {
          const startPeriod = Number(act.start_period)
          const durationPeriods = Number(act.duration_periods)
          for (let p = startPeriod; p < startPeriod + durationPeriods; p++) {
            // Lock teacher slot (แสดงในแผงครู)
            payloads.push({
              school_id: schoolId,
              term_id: t,
              class_id: null,
              teacher_id: String(sup.teacher_id),
              room_id: null,
              day_of_week: Number(dayVal),
              period_number: Number(p),
              slot_type: 'activity',
              act_id: String(act.act_id || act.id),
              act_name: String(act.name || ''),
              is_locked: true,
              lock_type: 'teacher',
            })

            // Lock room/lab slot (แสดงในแผงห้อง/Lab)
            if (sup.room_id) {
              payloads.push({
                school_id: schoolId,
                term_id: t,
                class_id: null,
                teacher_id: String(sup.teacher_id),
                room_id: String(sup.room_id),
                day_of_week: Number(dayVal),
                period_number: Number(p),
                slot_type: 'activity',
                act_id: String(act.act_id || act.id),
                act_name: String(act.name || ''),
                is_locked: true,
                lock_type: 'room',
              })
            }
          }
        } catch (err) {
          console.warn(`Failed to prepare supervision for ${sup.teacher_id} day ${dayVal}:`, err.message)
        }
      })
    })

    const CHUNK = 400
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const { error } = await supabase
        .from('timetable_slots')
        .upsert(payloads.slice(i, i + CHUNK), { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
      if (error) throw error
    }

    workflowStep.value = null  // เข้าสู่โหมดจัดตารางปกติ
    ElMessage.success(`✅ ล็อกครูคุม ${checkedSups.length} คน → ${payloads.length} slot — พร้อมจัดตารางสอน!`)
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    workflowLoading.value = ''
  }
}

function recalcAssignmentProgress() {
  const placedByAssign = {}
  rt.timetableSlots.value.forEach(s => {
    if (s.type !== 'subject') return
    const assignId = s.assign_id || s.id
    if (!assignId) return
    placedByAssign[assignId] = (placedByAssign[assignId] || 0) + 1
  })

  assignments.value = assignments.value.map(a => {
    const assignId = a.assign_id || a.id
    const total = Number(a.periods_per_week) || 0
    const placed = placedByAssign[assignId] || 0
    return {
      ...a,
      placed,
      done: placed >= total,
      remaining: Math.max(total - placed, 0)
    }
  })
}

async function loadAssignmentsWithProgress(forceReload = false) {
  if (assignmentsLoadPromise) {
    if (!forceReload) return assignmentsLoadPromise
    try { await assignmentsLoadPromise } catch { /* ignore previous read error */ }
  }

  assignmentsLoadPromise = (async () => {
    if (forceReload || assignments.value.length === 0) {
      const schoolId = authStore.schoolId
      const t = term()
      const { data, error } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('school_id', schoolId)
        .eq('term_id', t)
        .eq('slot_type', 'subject')
      if (error) throw error
      // Derive assignment list: group by class+subject+teacher, sum periods_per_week
      const map = {}
      ;(data || []).forEach(row => {
        const key = `${row.class_id}|${row.subject_id}|${row.teacher_id}`
        if (!map[key]) {
          const teacher = teachers.value.find(tc => tc.teacher_id === row.teacher_id)
          const subject = (schoolStore.subjects || []).find(s => s.subject_code === row.subject_id)
          map[key] = {
            id: key,
            assign_id: key,
            class_id: row.class_id,
            subject_code: row.subject_id,
            subject_name: subject?.name || row.subject_id || '',
            teacher_id: row.teacher_id,
            teacher_name: teacher ? `${teacher.prefix || ''}${teacher.name} ${teacher.surname}` : (row.teacher_id || ''),
            preferred_room: row.room_id || '',
            periods_per_week: 0,
            consecutive_periods: 1,
            placed: 0,
          }
        }
        map[key].periods_per_week += 1
        map[key].placed += 1
      })
      assignments.value = Object.values(map).map(a => ({
        ...a,
        done: a.placed >= a.periods_per_week,
        remaining: Math.max(0, a.periods_per_week - a.placed),
      }))
    }
    recalcAssignmentProgress()
  })()

  try {
    await assignmentsLoadPromise
  } finally {
    assignmentsLoadPromise = null
  }
}

watch(rt.timetableSlots, () => {
  if (assignments.value.length) recalcAssignmentProgress()
})

function onClassChange() { dragData.value = null; activeSlot.value = null }

function getNextSelectionValue(list, currentValue, direction) {
  if (!Array.isArray(list) || !list.length) return null
  const currentIndex = list.indexOf(currentValue)
  if (currentIndex === -1) {
    return direction > 0 ? list[0] : list[list.length - 1]
  }
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= list.length) return null
  return list[nextIndex]
}

function shiftSelection(list, currentValue, direction, applySelection) {
  const nextValue = getNextSelectionValue(list, currentValue, direction)
  if (nextValue == null || nextValue === currentValue) return
  applySelection(nextValue)
}

function selectPrevClass() {
  shiftSelection(classIds.value, selectedClass.value, -1, (value) => {
    selectedClass.value = value
    onClassChange()
  })
}

function selectNextClass() {
  shiftSelection(classIds.value, selectedClass.value, 1, (value) => {
    selectedClass.value = value
    onClassChange()
  })
}

function selectPrevTeacher() {
  shiftSelection(teacherIds.value, selectedTeacher.value, -1, (value) => {
    selectedTeacher.value = value
  })
}

function selectNextTeacher() {
  shiftSelection(teacherIds.value, selectedTeacher.value, 1, (value) => {
    selectedTeacher.value = value
  })
}

function selectPrevRoom() {
  shiftSelection(roomList.value, selectedRoom.value, -1, (value) => {
    selectedRoom.value = value
  })
}

function selectNextRoom() {
  shiftSelection(roomList.value, selectedRoom.value, 1, (value) => {
    selectedRoom.value = value
  })
}

// ===== Highlight active assignment across panels =====
function getCellHighlight(slot) {
  if (!slot) return ''
  if (slot.type === 'subject' && highlightedAssignId.value && slot.assign_id === highlightedAssignId.value) {
    return 'ring-2 ring-inset ring-orange-500 bg-orange-50'
  }
  if (!activeSlot.value) return ''
  if (slot.type === 'subject' && slot.assign_id === activeSlot.value.assign_id && slot.class_id === activeSlot.value.class_id) {
    return 'ring-2 ring-inset ring-blue-500 bg-blue-50/80'
  }
  return ''
}

// ===== Swap Mode highlight =====
function getSwapCellClass(slot) {
  if (!swapMode.value || !slot) return ''
  if (swapSource.value && slot.id === swapSource.value.id) return 'swap-source'
  if (swappableIds.value.includes(slot.id)) return 'swappable'
  return ''
}

// ===== Click sync — the key feature (F2, F3) =====
async function onCellClick(slot, source, day, period) {
  if (inlineLockCell.value) { inlineLockCell.value = null; return }

  // F2/F3: guard against locked timetable for non-view actions
  if (isLocked.value && !swapMode.value && slot?.type === 'subject') {
    // Sync panels even when locked
    activeSlot.value = slot
    if (source !== 'class' && slot.class_id) selectedClass.value = slot.class_id
    if (source !== 'teacher' && slot.teacher_id) selectedTeacher.value = slot.teacher_id
    if (source !== 'room' && slot.preferred_room && roomList.value.includes(slot.preferred_room)) selectedRoom.value = slot.preferred_room
    return
  }

  // ===== In swap mode =====
  if (swapMode.value) {
    if (isLocked.value) { showLockMsg(); exitSwapMode(); return }
    // Reverse swap mode: empty target already chosen, user clicks a slot to move there
    if (emptyTarget.value && !swapSource.value) {
      if (!slot) { exitSwapMode(); return }
      if (slot.type !== 'subject') { exitSwapMode(); return }
      if (!swappableIds.value.includes(slot.id)) {
        ElMessage.warning('⚠️ คาบนี้ย้ายมาที่นั้นไม่ได้')
        exitSwapMode()
        return
      }
      swapSource.value = toPlainObject(slot)
      doMoveToEmpty(emptyTarget.value.day, emptyTarget.value.period)
      return
    }
    // Forward swap mode: source chosen, picking destination
    if (!slot) {
      if (swapSource.value) doMoveToEmpty(day, period)
      else exitSwapMode()
      return
    }
    if (slot.type !== 'subject') return
    if (!swapSource.value) {
      enterSwapMode(slot)
    } else if (slot.id === swapSource.value.id) {
      exitSwapMode()
    } else if (swappableIds.value.includes(slot.id)) {
      doSwap(slot)
    } else {
      ElMessage.warning('⚠️ คาบนี้ไม่สามารถสลับกันได้')
    }
    return
  }

  // ===== Normal mode =====
  // Click filled subject → forward swap mode (shows swappable + empty move targets)
  if (slot && slot.type === 'subject') {
    activeSlot.value = slot
    if (source !== 'class' && slot.class_id) selectedClass.value = slot.class_id
    if (source !== 'teacher' && slot.teacher_id) selectedTeacher.value = slot.teacher_id
    if (source !== 'room' && slot.preferred_room && roomList.value.includes(slot.preferred_room)) selectedRoom.value = slot.preferred_room
    
    if (isLocked.value) return // Don't enter swap mode if locked
    
    enterSwapMode(slot)
    return
  }
  // Click empty cell — if a card is selected and this cell is suggested → place directly
  if (!slot) {
    if (isLocked.value) return

    if (suggestedCells.value.has(`${day}_${period}`) && highlightedAssignId.value) {
      const a = assignments.value.find(x => (x.assign_id || x.id) === highlightedAssignId.value)
      if (a) {
        // Need selectedClass set correctly for doPlace
        if (source === 'class') selectedClass.value = a.class_id
        await doPlace(day, period, a)
        suggestedCells.value = new Set()
        highlightedAssignId.value = ''
        return
      }
    }
    enterReverseSwapMode(day, period, source)
    return
  }
  // Activity/lock slot → sync panels
  activeSlot.value = slot
  if (source !== 'class' && slot.class_id) selectedClass.value = slot.class_id
  if (source !== 'teacher' && slot.teacher_id) selectedTeacher.value = slot.teacher_id
  if (source !== 'room' && slot.preferred_room && roomList.value.includes(slot.preferred_room)) selectedRoom.value = slot.preferred_room
}

// ===== Helpers =====
function getDayLabel(dayNum) {
  return DAYS.value.find(d => d.value === dayNum)?.label || String(dayNum)
}

// ===== Drag & Drop =====
function onDragStart(event, assignment) {
  dragData.value = assignment
  event.dataTransfer.effectAllowed = 'move'
  suggestedCells.value = new Set()
}

async function onDrop(event, day, period) {
  dragOverCell.value = null
  if (!dragData.value || !selectedClass.value) return
  // F9: workflow gate
  if (!isWorkflowReady.value) { ElMessage.warning('⚠️ กรุณาดำเนินการล็อกกิจกรรมและครูคุมก่อน หรือกดข้ามขั้นตอน'); return }
  const assignment = dragData.value
  const existing = rt.getClassSlot(day, period, selectedClass.value)
  // F8: block occupied slot
  if (existing && !existing.is_locked) {
    ElMessage.error('⛔ คาบนี้มีวิชาอยู่แล้ว ไม่สามารถวางทับได้')
    return
  }
  if (existing?.is_locked) { ElMessage.warning('คาบนี้ถูก lock ไว้'); return }

  // Hard block — no override
  const check = rt.checkFree(day, period, selectedClass.value, assignment.teacher_id, assignment.preferred_room || null)
  if (!check.allOk) {
    const msgs = []
    if (!check.classOk) msgs.push(`ห้อง ${selectedClass.value} มีวิชาแล้ว`)
    if (!check.teacherOk) msgs.push(`ครู ${assignment.teacher_name} ติดสอนคาบนี้`)
    if (!check.roomOk) msgs.push(`ห้อง/Lab ${assignment.preferred_room} ถูกใช้งานอยู่`)
    ElMessage.error({ message: '⛔ วางไม่ได้: ' + msgs.join(' | '), duration: 3000 })
    return
  }
  await doPlace(day, period, assignment)
}

async function doPlace(day, period, assignment) {
  // F10: same-day check
  const assignId = assignment.assign_id || assignment.id
  const sameDay = rt.timetableSlots.value.filter(s =>
    s.assign_id === assignId && s.day === day && s.type === 'subject'
  )
  if (sameDay.length > 0) {
    try {
      await ElMessageBox.confirm(
        `วิชา "${assignment.subject_name}" มีคาบในวันนี้แล้ว ต้องการลงซ้ำหรือไม่?`,
        'ยืนยัน',
        { type: 'warning' }
      )
    } catch { return }
  }
  try {
    if (assignment.consecutive_periods > 1 && assignment.remaining >= assignment.consecutive_periods) {
      // Place consecutive periods
      const count = assignment.consecutive_periods
      for (let i = 0; i < count; i++) {
        const p = period + i
        const check = rt.checkFree(day, p, selectedClass.value, assignment.teacher_id, assignment.preferred_room || null)
        if (!check.allOk) {
          ElMessage.error(`ไม่สามารถวางติดกันได้ตั้งแต่คาบ ${period} — คาบ ${p} มีความขัดแย้ง`)
          return
        }
      }
      const groupId = `grp_${Date.now()}`
      for (let i = 0; i < count; i++) {
        const p = period + i
        await rt.placeSlot({
          day, period: p,
          class_id: selectedClass.value,
          assign_id: assignment.assign_id || assignment.id,
          subject_code: assignment.subject_code,
          subject_name: assignment.subject_name,
          teacher_id: assignment.teacher_id,
          teacher_name: assignment.teacher_name,
          preferred_room: assignment.preferred_room || null,
          type: 'subject',
          group_id: groupId,
          is_locked: false,
        })
      }
    } else {
      await rt.placeSlot({
        day, period,
        class_id: selectedClass.value,
        assign_id: assignment.assign_id || assignment.id,
        subject_code: assignment.subject_code,
        subject_name: assignment.subject_name,
        teacher_id: assignment.teacher_id,
        teacher_name: assignment.teacher_name,
        preferred_room: assignment.preferred_room || null,
        type: 'subject',
        is_locked: false,
      })
    }
    await loadAssignmentsWithProgress()
    ElMessage.success('วางวิชาเรียบร้อย')
  } catch (e) { ElMessage.error(e.message) }
}

async function removeClassSlot(day, period) {
  const slot = rt.getClassSlot(day, period, selectedClass.value)
  if (!slot || slot.is_locked) return
  await rt.removeSlot(slot.id)
  await loadAssignmentsWithProgress()
  ElMessage.success('ลบวิชาแล้ว')
}

// ===== Edit slot: change teacher (updates ALL slots + assignment) =====
async function saveEditSlot() {
  if (!editDlg.slot || !editDlg.newTeacherId) return
  if (editDlg.newTeacherId === editDlg.slot.teacher_id) { editDlg.visible = false; return }

  editSaving.value = true
  try {
    const teacher = teachers.value.find(t => t.teacher_id === editDlg.newTeacherId)
    if (!teacher) throw new Error('ไม่พบครูที่เลือก')

    const newName = `${teacher.prefix || ''}${teacher.name} ${teacher.surname}`
    const assignId = editDlg.slot.assign_id
    const classId = editDlg.slot.class_id

    // Find all slots for this assignment + class from rt
    const slotsToUpdate = rt.timetableSlots.value
      .filter(s => s.assign_id === assignId && s.class_id === classId)

    // Update teacher on all matching timetable_slots rows
    const dbIds = slotsToUpdate.map(s => s._db_id || s.id).filter(Boolean)
    if (dbIds.length) {
      const { error: slotErr } = await supabase
        .from('timetable_slots')
        .update({ teacher_id: editDlg.newTeacherId, updated_at: new Date().toISOString() })
        .in('id', dbIds)
      if (slotErr) throw slotErr
    }

    // Update local assignments
    if (assignId) {
      const aIdx = assignments.value.findIndex(a => (a.assign_id || a.id) === assignId)
      if (aIdx >= 0) {
        assignments.value[aIdx] = { ...assignments.value[aIdx], teacher_id: editDlg.newTeacherId, teacher_name: newName }
      }
    }

    if (selectedTeacher.value === editDlg.slot.teacher_id) selectedTeacher.value = editDlg.newTeacherId

    ElMessage.success(`เปลี่ยนครูทุก slot ของ "${editDlg.slot.subject_name}" เป็น "${newName}" แล้ว`)
    editDlg.visible = false
    editDlg.slot = null
    activeSlot.value = null
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    editSaving.value = false
  }
}

async function deleteEditSlot() {
  if (!editDlg.slot) return
  const slot = editDlg.slot
  if (slot.is_locked) { ElMessage.warning('ไม่สามารถลบ slot ที่ถูก lock'); return }
  await rt.removeSlot(slot.id)
  await loadAssignmentsWithProgress()
  ElMessage.success('ลบ slot แล้ว')
  editDlg.visible = false
  editDlg.slot = null
  activeSlot.value = null
}

function startSwapFromDialog() {
  const slot = editDlg.slot
  editDlg.visible = false
  enterSwapMode(slot)
}

function openSlotEdit(slot) {
  editDlg.visible = true
  editDlg.slot = toPlainObject(slot)
  editDlg.newTeacherId = slot.teacher_id
}

async function removeSlotById(slotId) {
  await rt.removeSlot(slotId)
  editDlg.visible = false
  await loadAssignmentsWithProgress()
  ElMessage.success('ลบคาบแล้ว')
}

async function removeAllSlotsOfAssignment(assignId) {
  const toDelete = rt.timetableSlots.value.filter(s => s.assign_id === assignId)
  const dbIds = toDelete.map(s => s._db_id || s.id).filter(Boolean)
  if (dbIds.length) {
    const { error } = await supabase.from('timetable_slots').delete().in('id', dbIds)
    if (error) throw error
  }
  editDlg.visible = false
  await loadAssignmentsWithProgress()
  ElMessage.success(`ลบ ${toDelete.length} คาบแล้ว`)
}

// ===== F3: Move to empty cell =====
async function doMoveToEmpty(day, period) {
  if (!swapSource.value) return
  const src = swapSource.value
  const check = rt.checkFree(day, period, src.class_id, src.teacher_id, src.preferred_room || null, [src.id])
  if (!check.allOk) { ElMessage.error('ตำแหน่งนี้ยังไม่ว่าง'); exitSwapMode(); return }
  try {
    await rt.moveSlot(src, day, period)
    ElMessage.success('ย้ายคาบเรียบร้อย')
    await loadAssignmentsWithProgress()
  } catch (e) { ElMessage.error(e.message) }
  exitSwapMode()
}

// ===== F5: Drop on teacher panel =====
async function onDropTeacher(event, day, period) {
  dragOverCell.value = null
  if (!dragData.value) return
  if (!isWorkflowReady.value) { ElMessage.warning('⚠️ กรุณาดำเนินการล็อกกิจกรรมและครูคุมก่อน หรือกดข้ามขั้นตอน'); return }
  const assignment = dragData.value
  // Set selectedTeacher to assignment's teacher
  if (assignment.teacher_id) selectedTeacher.value = assignment.teacher_id
  // Set selectedClass from assignment
  if (assignment.class_id) selectedClass.value = assignment.class_id
  const classIdT = assignment.class_id || selectedClass.value
  const checkT = rt.checkFree(day, period, classIdT, assignment.teacher_id, assignment.preferred_room || null)
  if (!checkT.allOk) {
    const msgs = []
    if (!checkT.classOk) msgs.push(`ห้อง ${classIdT} มีวิชาแล้ว`)
    if (!checkT.teacherOk) msgs.push(`ครู ${assignment.teacher_name} ติดสอนคาบนี้`)
    if (!checkT.roomOk) msgs.push(`ห้อง/Lab ${assignment.preferred_room} ถูกใช้งานอยู่`)
    ElMessage.error({ message: '⛔ วางไม่ได้: ' + msgs.join(' | '), duration: 3000 })
    return
  }
  await doPlace(day, period, assignment)
}

// ===== F5: Drop on room panel =====
async function onDropRoom(event, day, period) {
  dragOverCell.value = null
  if (!dragData.value) return
  if (!isWorkflowReady.value) { ElMessage.warning('⚠️ กรุณาดำเนินการล็อกกิจกรรมและครูคุมก่อน หรือกดข้ามขั้นตอน'); return }
  const assignment = dragData.value
  if (assignment.class_id) selectedClass.value = assignment.class_id
  const classIdR = assignment.class_id || selectedClass.value
  const checkR = rt.checkFree(day, period, classIdR, assignment.teacher_id, assignment.preferred_room || null)
  if (!checkR.allOk) {
    const msgs = []
    if (!checkR.classOk) msgs.push(`ห้อง ${classIdR} มีวิชาแล้ว`)
    if (!checkR.teacherOk) msgs.push(`ครู ${assignment.teacher_name} ติดสอนคาบนี้`)
    if (!checkR.roomOk) msgs.push(`ห้อง/Lab ${assignment.preferred_room} ถูกใช้งานอยู่`)
    ElMessage.error({ message: '⛔ วางไม่ได้: ' + msgs.join(' | '), duration: 3000 })
    return
  }
  await doPlace(day, period, assignment)
}

// ===== F8: Drag enter/leave for visual highlight =====
function onDragEnter(event, day, period, entityId) {
  dragOverCell.value = `${day}_${period}`
}
function onDragLeave(event) {
  dragOverCell.value = null
}
function getCellDragClass(day, period, entityId) {
  if (!dragOverCell.value || dragOverCell.value !== `${day}_${period}`) return ''
  // Check if the cell for this entity is occupied
  const slot = entityId
    ? (rt.timetableMap.value[`${day}_${period}_${entityId}`] ||
       rt.teacherMap.value[`${day}_${period}_${entityId}`] ||
       rt.roomMap.value[`${day}_${period}_${entityId}`])
    : null
  return slot ? 'drag-over-blocked' : 'drag-over-ok'
}

// ===== F6 + F7: Auto schedule confirm dialogs =====
function handleAutoScheduleConfirm() {
  autoConfirmDlg.visible = true
  autoConfirmDlg.mode = 'auto'
}
function handleAIModeConfirm() {
  autoConfirmDlg.visible = true
  autoConfirmDlg.mode = 'ai'
}
async function doConfirmAutoSchedule() {
  autoConfirmDlg.visible = false
  if (autoConfirmDlg.mode === 'ai') {
    await handleAIMode()
  } else {
    await handleAutoSchedule()
  }
}

// ===== F11: Co-teach helpers =====
function openCoTeach(slot) {
  if (!slot) return
  coTeachDlg.slot = toPlainObject(slot)
  coTeachDlg.teacherId = ''
  coTeachDlg.visible = true
}
function getCoTeachSlots(day, period, classId) {
  return rt.timetableSlots.value.filter(s =>
    s.is_coteach === true && s.day === day && s.period === period && s.class_id === classId
  )
}
async function confirmCoTeach() {
  if (!coTeachDlg.slot || !coTeachDlg.teacherId) return
  const slot = coTeachDlg.slot
  const teacher = teachers.value.find(t => t.teacher_id === coTeachDlg.teacherId)
  if (!teacher) { ElMessage.error('ไม่พบครูที่เลือก'); return }
  const teacherName = `${teacher.prefix||''}${teacher.name} ${teacher.surname}`
  try {
    const { error } = await supabase.from('timetable_slots').upsert([{
      school_id: authStore.schoolId,
      term_id: term(),
      class_id: slot.class_id,
      subject_id: slot.subject_code || null,
      teacher_id: coTeachDlg.teacherId,
      room_id: slot.preferred_room || null,
      day_of_week: slot.day,
      period_number: slot.period,
      slot_type: 'subject',
      is_coteach: true,
      is_locked: false,
    }], { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
    if (error) throw error
    ElMessage.success(`เพิ่มครูร่วมสอน ${teacherName} แล้ว`)
    coTeachDlg.visible = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
}

// ===== Remove activity lock slot =====
async function removeActivityLock(slot) {
  try {
    await rt.removeSlot(slot.id)
    ElMessage.success('ลบ lock คาบเรียบร้อย')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

// ===== Swap Mode =====
function enterSwapMode(slot) {
  const plainSlot = toPlainObject(slot)
  swapMode.value = true
  swapSource.value = plainSlot
  emptyTarget.value = null
  const candidates = findSwappableSlots(
    plainSlot,
    rt.timetableSlots.value,
    rt.teacherMap.value,
    rt.roomMap.value
  )
  swappableIds.value = candidates.map(s => s.id)
  // Also compute empty cells this slot can legally move to
  const cells = new Set()
  DAYS.value.forEach(d => {
    PERIODS.value.forEach(p => {
      if (d.value === plainSlot.day && p === plainSlot.period) return
      const chk = rt.checkFree(d.value, p, plainSlot.class_id, plainSlot.teacher_id, plainSlot.preferred_room || null, [plainSlot.id])
      if (chk.allOk) cells.add(`${d.value}_${p}`)
    })
  })
  suggestedCells.value = cells
  ElMessage({
    message: `🔄 สลับได้ ${swappableIds.value.length} คาบ (เส้นเขียวเข้ม) | ✅ ย้ายได้ ${cells.size} คาบว่าง (เส้นเขียวอ่อน) — คลิกเพื่อดำเนินการ ESC ยกเลิก`,
    type: 'info',
    duration: 4000,
  })
}

async function doSwap(targetSlot) {
  try {
    await rt.swapSlots(swapSource.value, targetSlot)
    ElMessage.success('สลับ slot เรียบร้อย')
    await loadAssignmentsWithProgress()
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
  exitSwapMode()
}

function exitSwapMode() {
  swapMode.value = false
  swapSource.value = null
  swappableIds.value = []
  emptyTarget.value = null
  suggestedCells.value = new Set()
}

function toggleSwapMode() {
  if (swapMode.value) {
    exitSwapMode()
  } else {
    swapMode.value = true
    swapSource.value = null
    swappableIds.value = []
    ElMessage.info('Swap Mode เปิดแล้ว — คลิก slot ที่ต้องการสลับ')
  }
}

// ===== Lock periods =====
async function doLock() {
  if (!lockForm.name.trim()) { ElMessage.warning('กรุณากรอกชื่อกิจกรรม'); return }
  if (lockForm.lock_type === 'class' && !lockForm.target_classes.length) {
    ElMessage.warning('กรุณาเลือกห้องเรียนที่จะล็อก'); return
  }
  if (lockForm.lock_type === 'teacher' && !lockForm.target_teachers.length) {
    ElMessage.warning('กรุณาเลือกอาจารย์ที่จะล็อก'); return
  }
  if (lockForm.lock_type === 'room' && !lockForm.target_rooms.length) {
    ElMessage.warning('กรุณาเลือกห้อง/Lab ที่จะล็อก'); return
  }

  // ถ้า day === 0 = ทุกวัน
  const daysToLock = lockForm.day === 0 ? DAYS.value.map(d => d.value) : [lockForm.day]

  lockSaving.value = true
  try {
    for (const dayVal of daysToLock) {
      for (let p = lockForm.start_period; p < lockForm.start_period + lockForm.duration_periods; p++) {
        if (lockForm.lock_type === 'class') {
          for (const classId of lockForm.target_classes) {
            await rt.lockSlot({ day: dayVal, period: p, classId, label: lockForm.name, lockType: 'class' })
          }
        } else if (lockForm.lock_type === 'teacher') {
          for (const teacherId of lockForm.target_teachers) {
            await rt.lockSlot({ day: dayVal, period: p, teacherId, label: lockForm.name, lockType: 'teacher' })
          }
        } else if (lockForm.lock_type === 'room') {
          for (const roomId of lockForm.target_rooms) {
            await rt.lockSlot({ day: dayVal, period: p, roomId, label: lockForm.name, lockType: 'room' })
          }
        }
      }
    }
    const dayLabel = lockForm.day === 0 ? 'ทุกวัน' : DAYS.value.find(d => d.value === lockForm.day)?.label
    ElMessage.success(`ล็อกคาบ "${lockForm.name}" (${dayLabel}) เรียบร้อย`)
    lockForm.name = ''
    lockForm.target_classes = []
    lockForm.target_teachers = []
    lockForm.target_rooms = []
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    lockSaving.value = false
  }
}

// ===== Click-to-lock (inline input on cell) =====
function onCellDblClick(day, period, entityId, view) {
  if (!entityId) return
  const slot = view === 'class'
    ? rt.getClassSlot(day, period, entityId)
    : view === 'teacher'
      ? rt.getTeacherSlot(day, period, entityId)
      : rt.getRoomSlot(day, period, entityId)
  if (slot) return  // Cell already has content
  inlineLockCell.value = { day, period, classId: entityId, view }
  inlineLockLabel.value = ''
  nextTick(() => {
    if (inlineLockInputRef.value) inlineLockInputRef.value.focus()
  })
}

function isInlineLockCell(day, period, entityId, view) {
  const c = inlineLockCell.value
  return c && c.day === day && c.period === period && c.classId === entityId && c.view === view
}

async function confirmInlineLock() {
  const c = inlineLockCell.value
  if (!c || !inlineLockLabel.value.trim()) { inlineLockCell.value = null; return }
  try {
    await rt.lockSlot({
      day: c.day,
      period: c.period,
      classId: c.view === 'class' ? c.classId : null,
      teacherId: c.view === 'teacher' ? c.classId : null,
      roomId: c.view === 'room' ? c.classId : null,
      label: inlineLockLabel.value,
      lockType: c.view,
    })
    ElMessage.success(`ล็อกคาบ "${inlineLockLabel.value}" แล้ว`)
  } catch (e) {
    ElMessage.error(e.message)
  }
  inlineLockCell.value = null
}

// ===== Auto Schedule (F9: workflow gate) =====
async function handleAutoSchedule() {
  if (!isWorkflowReady.value) { ElMessage.warning('⚠️ กรุณาดำเนินการล็อกกิจกรรมและครูคุมก่อน หรือกดข้ามขั้นตอน'); return }
  aiMode.value = false
  autoDialogVisible.value = true
  try {
    await runAutoSchedule({
      assignments: assignments.value,
      days: DAYS.value,
      periodsPerDay: PERIODS.value.length,
    })
  } catch (e) {
    ElMessage.error(e.message)
  }
  await loadAssignmentsWithProgress()
}

async function handleClearAuto() {
  try {
    const count = await clearAutoSlots()
    ElMessage.success(`ล้าง ${count} slot ที่จัดอัตโนมัติแล้ว`)
    await loadAssignmentsWithProgress()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleClearAll() {
  if (!authStore.isAdmin) { ElMessage.error('เฉพาะ SchoolAdmin เท่านั้นที่สามารถล้างตารางได้'); return }
  try {
    await ElMessageBox.confirm('ยืนยันล้างตารางทั้งหมด? (จะเริ่มขั้นตอน ① ลงกิจกรรม → ② ครูคุม ใหม่)', 'ยืนยัน', { type: 'warning' })
  } catch { return }
  try {
    const schoolId = authStore.schoolId
    const t = term()
    const { error, count } = await supabase
      .from('timetable_slots')
      .delete()
      .eq('school_id', schoolId)
      .eq('term_id', t)
    if (error) throw error
    // Wait a moment for real-time sync to update
    await new Promise(r => setTimeout(r, 100))
    assignments.value = []
    await loadAssignmentsWithProgress()
    workflowStep.value = '1'   // เริ่ม workflow ใหม่
    ElMessage.success(`ล้างตารางทั้งหมดเรียบร้อยแล้ว — กดปุ่ม ① ลงกิจกรรม`)
  } catch (e) {
    console.error('Clear all error:', e)
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
}

async function handleAIMode() {
  aiMode.value = true
  const apiKey = schoolStore.schoolInfo?.anthropic_api_key
  if (!apiKey) { ElMessage.error('ไม่พบ Anthropic API Key'); aiMode.value = false; return }
  try {
    const gridObj = {}
    rt.timetableSlots.value.forEach(s => { gridObj[s.id] = s })
    await runAISchedule(scheduleResult.value?.unplacedList || [], gridObj, apiKey)
    ElMessage.success('AI จัดตารางเรียบร้อย')
    await loadAssignmentsWithProgress()
  } catch (e) {
    ElMessage.error('AI Error: ' + e.message)
  } finally {
    aiMode.value = false
  }
}
</script>

<style scoped>
/* ===== Table base ===== */
.tt-table { border-collapse: collapse; table-layout: fixed; width: 100%; min-width: 560px; }

/* Font scale CSS variables */
.tt-scale-70  { --tt-scale: 0.7;  }
.tt-scale-80  { --tt-scale: 0.8;  }
.tt-scale-90  { --tt-scale: 0.9;  }
.tt-scale-100 { --tt-scale: 1.0;  }
.tt-scale-110 { --tt-scale: 1.1;  }
.tt-scale-120 { --tt-scale: 1.2;  }
.tt-scale-130 { --tt-scale: 1.3;  }
.tt-scale-140 { --tt-scale: 1.4;  }
.tt-scale-150 { --tt-scale: 1.5;  }
.tt-scale-160 { --tt-scale: 1.6;  }
.tt-scale-170 { --tt-scale: 1.7;  }
.tt-scale-180 { --tt-scale: 1.8;  }
.tt-scale-190 { --tt-scale: 1.9;  }
.tt-scale-200 { --tt-scale: 2.0;  }

.tt-table, .tt-table td, .tt-table th { font-size: calc(12px * var(--tt-scale, 1.0)); }

/* Header cells */
.tt-th {
  padding: 7px 4px;
  text-align: center;
  color: white;
  font-weight: bold;
  border-right: 1px solid rgba(255,255,255,0.2);
  font-size: calc(11px * var(--tt-scale, 1.0));
  width: 96px;
  min-width: 96px;
  max-width: 96px;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
}
.tt-th.tt-blue  { background: linear-gradient(135deg, #1d4ed8, #3b82f6); }
.tt-th.tt-green { background: linear-gradient(135deg, #059669, #10b981); }

.tt-th-day {
  width: 58px;
  min-width: 58px;
  max-width: 58px;
  padding: 7px 4px;
  text-align: center;
  color: white;
  font-size: calc(11px * var(--tt-scale, 1.0));
  font-weight: bold;
  border-right: 1px solid rgba(255,255,255,0.2);
  background: linear-gradient(135deg, #7c3aed, #a855f7);
}
.tt-th-day.tt-blue  { background: linear-gradient(135deg, #1d4ed8, #3b82f6); }
.tt-th-day.tt-green { background: linear-gradient(135deg, #059669, #10b981); }

.tt-time { color: rgba(255,255,255,0.65); font-weight: normal; font-size: calc(10px * var(--tt-scale, 1.0)); margin-top: 1px; }

/* Day label col */
.tt-day {
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  text-align: center;
  font-size: calc(12px * var(--tt-scale, 1.0));
  color: #64748b;
  padding: 4px 2px;
  background: #f8fafc;
  width: 58px;
  min-width: 58px;
  max-width: 58px;
  vertical-align: middle;
}
.tt-today { background: #eff6ff !important; color: #1d4ed8 !important; font-weight: bold; }

/* Data cell */
.tt-cell {
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  height: 90px;
  max-height: 90px;
  vertical-align: top;
  padding: 2px;
  width: 96px;
  min-width: 96px;
  max-width: 96px;
  position: relative;
  transition: background 0.1s;
  overflow: hidden;
}

/* Subject card inside cell (F1: compact font sizes 10-11px) */
.tt-subj {
  height: 100%;
  border-radius: 4px;
  overflow: hidden;
  padding: 2px 2px 0 4px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.tt-subj-content { flex: 1; overflow: hidden; min-height: 0; }
.tt-subj-name { font-size: calc(10px * var(--tt-scale, 1.0)); font-weight: 600; color: #1f2937; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tt-subj-sub  { font-size: calc(9px * var(--tt-scale, 1.0)); color: #6b7280; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Slot action bar (bottom of subject card) */
.tt-slot-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  padding: 1px 1px 1px 0;
  border-top: 1px solid transparent;
  opacity: 0;
  transition: opacity 0.15s;
}
.tt-subj:hover .tt-slot-actions { opacity: 1; }
.tt-sbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 3px;
  font-size: calc(8px * var(--tt-scale, 1.0));
  border: none;
  cursor: pointer;
  background: transparent;
  line-height: 1;
  transition: background 0.12s, color 0.12s;
}
.tt-sbtn-coteach { color: #6b7280; }
.tt-sbtn-coteach:hover { background: #dcfce7; color: #16a34a; }
.tt-sbtn-del { color: #9ca3af; }
.tt-sbtn-del:hover { background: #fee2e2; color: #ef4444; }
.tt-class-badge { font-size: calc(10px * var(--tt-scale, 1.0)); font-weight: 700; color: #7c3aed; line-height: 1.2; }
.tt-room { font-size: calc(9px * var(--tt-scale, 1.0)); color: #2563eb; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Activity lock cell */
.tt-act {
  height: 100%;
  background: #fef9c3;
  border: 1.5px solid #d97706;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.tt-act-name { font-size: calc(10px * var(--tt-scale, 1.0)); color: #92400e; font-weight: 600; text-align: center; margin-top: 2px; line-height: 1.2; }

/* Empty cell */
.tt-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #d1d5db;
  transition: all 0.15s;
}

/* Delete button */
.tt-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 8px;
  color: #9ca3af;
  background: transparent;
  border: none;
  cursor: pointer;
  line-height: 1;
  z-index: 1;
}
.tt-del:hover { background: #fee2e2; color: #ef4444; }

/* Edit button */
.tt-edit {
  position: absolute;
  top: 2px;
  right: 18px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 8px;
  color: #9ca3af;
  background: transparent;
  border: none;
  cursor: pointer;
  line-height: 1;
  z-index: 1;
}
.tt-edit:hover { background: #e0f2fe; color: #0284c7; }

/* Panel header bars */
.panel-header-class   { background: linear-gradient(135deg, #7c3aed08, #7c3aed03); }
.panel-header-teacher { background: linear-gradient(135deg, #1d4ed808, #1d4ed803); }
.panel-header-room    { background: linear-gradient(135deg, #05966908, #05966903); }

/* Swap mode highlighting */
.tt-cell.swappable {
  background: #dcfce7 !important;
  outline: 3px solid #16a34a !important;
  cursor: crosshair;
  position: relative;
}
.tt-cell.swappable .tt-empty::before {
  content: '🔄';
  font-size: 18px;
}
.tt-cell.swap-source {
  background: #fef9c3 !important;
  outline: 3px solid #ca8a04 !important;
  position: relative;
}

/* Reverse swap: target empty cell */
.tt-cell.swap-target {
  background: #eff6ff !important;
  outline: 3px solid #3b82f6 !important;
  cursor: crosshair;
  position: relative;
}
.tt-cell.swap-target .tt-empty {
  font-size: 22px;
  color: #3b82f6;
}

/* Live indicator */
.tt-connected { animation: pulse 2s infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Inline lock input */
.tt-inline-lock {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}
.tt-inline-input {
  width: 100%;
  font-size: 11px;
  border: 1.5px solid #f97316;
  border-radius: 4px;
  padding: 3px 5px;
  outline: none;
  background: #fff7ed;
  color: #92400e;
}
.tt-inline-input:focus { border-color: #ea580c; box-shadow: 0 0 0 2px #fed7aa; }

/* F8: Drag over visual indicators */
.tt-cell.drag-over-ok {
  outline: 3px dashed #16a34a !important;
  background: #f0fdf4;
}
.tt-cell.drag-over-ok .tt-empty {
  color: #16a34a;
  font-size: 22px;
}
.tt-cell.drag-over-blocked {
  outline: 3px dashed #dc2626 !important;
  background: #fef2f2;
  cursor: not-allowed;
}
.tt-cell.drag-over-blocked .tt-empty {
  color: #dc2626;
  font-size: 22px;
}

/* Suggested cells (empty, available to place/move to) */
.tt-suggested {
  background: #f0fdf4 !important;
  outline: 2px solid #86efac;
  position: relative;
}
.tt-suggested .tt-empty {
  color: #16a34a;
  font-size: 20px;
}

/* F11: Co-teach button */
.tt-coteach {
  position: absolute;
  top: 2px;
  right: 32px;
  width: 18px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 7px;
  color: #9ca3af;
  background: transparent;
  border: none;
  cursor: pointer;
  line-height: 1;
  z-index: 1;
}
.tt-coteach:hover { background: #f0fdf4; color: #16a34a; }

/* F11: Co-teach badges */
.tt-coteach-badge {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 8px;
  color: #065f46;
  background: #d1fae5;
  border-radius: 3px;
  padding: 0 3px;
  margin-top: 1px;
  max-width: 100%;
  overflow: hidden;
}
.tt-coteach-rm {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 8px;
  color: #9ca3af;
  padding: 0;
  flex-shrink: 0;
}
.tt-coteach-rm:hover { color: #ef4444; }

/* Font scale classes */
.tt-scale-small .tt-subj-name { font-size: 10px; }
.tt-scale-small .tt-subj-sub  { font-size: 9px; }
.tt-scale-small .tt-class-badge { font-size: 10px; }
.tt-scale-small .tt-room { font-size: 9px; }
.tt-scale-small .tt-act-name { font-size: 10px; }
.tt-scale-small .tt-empty { font-size: 18px; }
.tt-scale-small .tt-th { font-size: 11px; }
.tt-scale-small .tt-day { font-size: 12px; }

.tt-scale-medium .tt-subj-name { font-size: 12px; }
.tt-scale-medium .tt-subj-sub  { font-size: 11px; }
.tt-scale-medium .tt-class-badge { font-size: 12px; }
.tt-scale-medium .tt-room { font-size: 11px; }
.tt-scale-medium .tt-act-name { font-size: 12px; }
.tt-scale-medium .tt-empty { font-size: 20px; }
.tt-scale-medium .tt-th { font-size: 13px; }
.tt-scale-medium .tt-day { font-size: 13px; }

.tt-scale-large .tt-subj-name { font-size: 14px; line-height: 1.4; }
.tt-scale-large .tt-subj-sub  { font-size: 12px; }
.tt-scale-large .tt-class-badge { font-size: 13px; }
.tt-scale-large .tt-room { font-size: 12px; }
.tt-scale-large .tt-act-name { font-size: 13px; }
.tt-scale-large .tt-empty { font-size: 24px; }
.tt-scale-large .tt-th { font-size: 14px; padding: 8px 4px; }
.tt-scale-large .tt-day { font-size: 14px; }
</style>
