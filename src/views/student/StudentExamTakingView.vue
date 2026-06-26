<template>
  <!-- LOCKED state -->
  <div v-if="sessionStatus === 'locked'" class="fullscreen locked-screen">
    <div class="locked-content">
      <div style="font-size:72px">🔒</div>
      <h2>ถูกล็อกการสอบ</h2>
      <p>ครูผู้คุมสอบได้ล็อกการสอบของคุณ<br>เนื่องจากทุจริตเกินจำนวนครั้งที่กำหนด</p>
      <el-button @click="$router.push('/student/exams')">กลับหน้าตารางสอบ</el-button>
    </div>
  </div>

  <!-- SUBMITTED state -->
  <div v-else-if="sessionStatus === 'submitted'" class="fullscreen submitted-screen">
    <div class="submitted-content">
      <div style="font-size:72px">✅</div>
      <h2>ส่งข้อสอบแล้ว</h2>
      <div v-if="finalScore !== null" class="score-display">
        <div class="score-num">{{ finalScore }}</div>
        <div class="score-max">/ {{ maxScore }} คะแนน</div>
      </div>
      <p v-else>รอครูตรวจข้อสอบ</p>
      <el-button type="primary" @click="$router.push('/student/exams')">กลับหน้าตารางสอบ</el-button>
    </div>
  </div>

  <!-- WAITING state (not yet in exam window) -->
  <div v-else-if="sessionStatus === 'waiting'" class="fullscreen waiting-screen">
    <div class="waiting-content">
      <div style="font-size:48px">⏳</div>
      <h2 v-if="exam">{{ exam.subject_name }}</h2>
      <p v-if="exam">{{ exam.title }}</p>
      <div v-if="exam" class="exam-time">
        📅 {{ fmtDate(exam.exam_date) }} &nbsp; 🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }}
      </div>
      <div class="countdown-big">เริ่มสอบใน {{ countdownText }}</div>
      <el-button @click="$router.push('/student/exams')">กลับ</el-button>
    </div>
  </div>

  <!-- PENDING_APPROVAL state -->
  <div v-else-if="sessionStatus === 'pending_approval'" class="fullscreen pending-screen">
    <div class="pending-content">
      <div class="spinner"></div>
      <h2>รอครูผู้คุมสอบอนุมัติ</h2>
      <p>กรุณารอ ครูจะเห็นคำขอของคุณและอนุมัติให้เริ่มทำข้อสอบ</p>
      <el-button text @click="$router.push('/student/exams')">ยกเลิก</el-button>
    </div>
  </div>

  <!-- IN_PROGRESS state - actual exam -->
  <div v-else-if="sessionStatus === 'in_progress'" class="exam-shell" @contextmenu.prevent @copy.prevent @cut.prevent @paste.prevent>

    <!-- Top bar -->
    <div class="exam-topbar">
      <div class="exam-topbar-left">
        <span class="subject-chip">{{ exam?.subject_name }}</span>
        <span class="exam-name">{{ exam?.title }}</span>
      </div>
      <div class="exam-topbar-right">
        <div class="timer-box" :class="{ 'timer-warn': timeLeft < 300, 'timer-danger': timeLeft < 60 }">
          ⏱ {{ fmtTime(timeLeft) }}
        </div>
        <el-button type="primary" size="small" @click="handleSubmit" :loading="submitting">
          ส่งข้อสอบ
        </el-button>
      </div>
    </div>

    <!-- Question number strip (horizontal) -->
    <div class="q-strip">
      <div class="q-strip-scroll">
        <div
          v-for="(q, i) in orderedQuestions"
          :key="q.id"
          class="q-strip-btn"
          :class="{
            'q-strip-current': currentIdx === i,
            'q-strip-answered': isAnswered(q.id),
          }"
          @click="currentIdx = i"
        >{{ i + 1 }}</div>
      </div>
      <div class="q-strip-stat">
        <span class="strip-answered">{{ answeredCount }}</span>/{{ orderedQuestions.length }}
      </div>
    </div>

    <!-- Question area (scrollable, fills remaining space) -->
    <div class="q-area" v-if="currentQuestion">
      <div class="q-header">
        <span class="q-num">ข้อที่ {{ currentIdx + 1 }}</span>
        <el-tag size="small" type="info">{{ typeLabel(currentQuestion.question_type) }}</el-tag>
        <span class="q-points">{{ currentQuestion.points || 1 }} คะแนน</span>
      </div>

      <div class="q-text">{{ currentQuestion.question_text }}</div>
      <div v-if="currentQuestion.question_image" class="q-image">
        <img :src="fixPhoto(currentQuestion.question_image)" alt="รูปคำถาม" class="q-img-zoom" @click="openZoom(currentQuestion.question_image)" />
      </div>

      <!-- choice (ปรนัย) -->
      <div v-if="currentQuestion.question_type === 'choice'" class="choices">
        <label
          v-for="(ch, ci) in getChoices(currentQuestion)"
          :key="ci"
          class="choice-item"
          :class="{ 'choice-selected': answers[currentQuestion.id] === choiceLetter(ci) }"
          :style="answers[currentQuestion.id] === choiceLetter(ci)
            ? { borderColor: choiceColor(ci), background: choiceColor(ci) + '1a' }
            : { borderLeftColor: choiceColor(ci) }"
        >
          <input type="radio" :value="choiceLetter(ci)" v-model="answers[currentQuestion.id]" @change="autoSave" />
          <span class="choice-letter" :style="{ color: choiceColor(ci) }">{{ choiceLetter(ci) }}</span>
          <span class="choice-text">{{ ch.text }}</span>
          <img v-if="ch.image" :src="fixPhoto(ch.image)" class="choice-img" @click.stop="openZoom(ch.image)" />
        </label>
      </div>

      <!-- multi (หลายตัวเลือก) -->
      <div v-else-if="currentQuestion.question_type === 'multi'" class="choices">
        <label
          v-for="(ch, ci) in getChoices(currentQuestion)"
          :key="ci"
          class="choice-item"
          :class="{ 'choice-selected': multiAnswers[currentQuestion.id]?.includes(choiceLetter(ci)) }"
          :style="multiAnswers[currentQuestion.id]?.includes(choiceLetter(ci))
            ? { borderColor: choiceColor(ci), background: choiceColor(ci) + '1a' }
            : { borderLeftColor: choiceColor(ci) }"
        >
          <input
            type="checkbox"
            :value="choiceLetter(ci)"
            :checked="multiAnswers[currentQuestion.id]?.includes(choiceLetter(ci))"
            @change="toggleMulti(currentQuestion.id, choiceLetter(ci))"
          />
          <span class="choice-letter" :style="{ color: choiceColor(ci) }">{{ choiceLetter(ci) }}</span>
          <img v-if="ch.image" :src="fixPhoto(ch.image)" class="choice-img" @click.stop="openZoom(ch.image)" />
          <span class="choice-text">{{ ch.text }}</span>
        </label>
      </div>

      <!-- truefalse -->
      <div v-else-if="currentQuestion.question_type === 'truefalse'" class="choices">
        <label class="choice-item" :class="{ 'choice-selected': answers[currentQuestion.id] === 'true' }">
          <input type="radio" value="true" v-model="answers[currentQuestion.id]" @change="autoSave" />
          <span class="choice-text">✅ ถูก</span>
        </label>
        <label class="choice-item" :class="{ 'choice-selected': answers[currentQuestion.id] === 'false' }">
          <input type="radio" value="false" v-model="answers[currentQuestion.id]" @change="autoSave" />
          <span class="choice-text">❌ ผิด</span>
        </label>
      </div>

      <!-- fill (เติมคำ) -->
      <div v-else-if="currentQuestion.question_type === 'fill'" class="fill-wrap">
        <el-input v-model="answers[currentQuestion.id]" placeholder="พิมพ์คำตอบที่นี่..." @input="debouncedAutoSave" />
      </div>

      <!-- essay (อัตนัย) -->
      <div v-else-if="currentQuestion.question_type === 'essay'" class="fill-wrap">
        <el-input v-model="answers[currentQuestion.id]" type="textarea" :rows="5" placeholder="พิมพ์คำตอบที่นี่..." @input="debouncedAutoSave" />
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">ข้อนี้ครูจะตรวจเองและให้คะแนน</div>
      </div>

      <!-- match (จับคู่) — SVG line drawing -->
      <div v-else-if="currentQuestion.question_type === 'match'" class="match-draw-root">
        <!-- Header -->
        <div class="match-draw-hdr">
          <span class="match-draw-hint" :class="{'mh-active': activeMatchLeft?.qid === currentQuestion.id}">
            {{ activeMatchLeft?.qid === currentQuestion.id ? '➡️ คลิกจุดฝั่งขวาที่ต้องการจับคู่' : '👆 คลิกจุด ● ฝั่งซ้ายแล้วลากไปหาฝั่งขวา' }}
          </span>
          <button class="match-reset-btn" @click="resetMatch(currentQuestion.id)">↺ ทำใหม่</button>
        </div>

        <!-- Drawing area (position:relative so SVG overlay works) -->
        <div class="match-draw-area"
             :ref="el => { if(el) _matchContainers[currentQuestion.id] = el }"
             @mousemove="onMatchMouseMove(currentQuestion.id, $event)"
             @click.self="cancelDraw()">

          <!-- SVG lines overlay -->
          <svg class="match-svg-ov" xmlns="http://www.w3.org/2000/svg">
            <!-- Permanent lines with ✕ delete at midpoint -->
            <g v-for="line in (matchLines[currentQuestion.id] || [])" :key="line.localI">
              <line :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
                    :stroke="line.color" stroke-width="3" stroke-linecap="round" />
              <g class="mdel-g" @click.stop="deleteMatchLine(currentQuestion.id, line.localI)">
                <circle :cx="(line.x1+line.x2)/2" :cy="(line.y1+line.y2)/2"
                        r="12" fill="white" :stroke="line.color" stroke-width="2"/>
                <text :x="(line.x1+line.x2)/2" :y="(line.y1+line.y2)/2+5"
                      text-anchor="middle" font-size="14" :fill="line.color" font-weight="bold"
                      style="user-select:none;pointer-events:none">✕</text>
              </g>
            </g>
            <!-- Temp drawing line (dashed, follows cursor) -->
            <line v-if="drawingLine?.qid === currentQuestion.id"
                  :x1="drawingLine.x1" :y1="drawingLine.y1"
                  :x2="drawingLine.x2" :y2="drawingLine.y2"
                  stroke="#7c3aed" stroke-width="2.5" stroke-dasharray="7,5"
                  stroke-linecap="round" opacity="0.6" />
          </svg>

          <!-- Left column (Column A) -->
          <div class="mdraw-col mdraw-left">
            <div class="mdraw-col-hd">คอลัมน์ A</div>
            <div v-for="pair in getLeftPairs(currentQuestion)" :key="pair.localIdx"
                 class="mdraw-row mdraw-left-row"
                 :class="{'mdlr-active': activeMatchLeft?.qid===currentQuestion.id && activeMatchLeft?.pi===pair.localIdx,
                          'mdlr-paired': matchAnswers[currentQuestion.id+'_'+pair.localIdx]!==undefined}">
              <div class="mdraw-content">
                <img v-if="pair.leftImage" :src="fixPhoto(pair.leftImage)" class="match-thumb"
                     @click.stop="openZoom(pair.leftImage)" />
                <span v-if="pair.left" class="mdraw-text">{{ pair.left }}</span>
              </div>
              <!-- Right-side dot -->
              <div class="mdot mdot-r"
                   :ref="el => { if(el) _matchLeftDots[currentQuestion.id+'_'+pair.localIdx] = el }"
                   @click.stop="toggleMatchLeft(currentQuestion.id, pair.localIdx)"
                   :class="{'mdot-active': activeMatchLeft?.qid===currentQuestion.id && activeMatchLeft?.pi===pair.localIdx,
                            'mdot-linked': matchAnswers[currentQuestion.id+'_'+pair.localIdx]!==undefined}"
                   :style="matchAnswers[currentQuestion.id+'_'+pair.localIdx]!==undefined
                     ? {background:matchColor(matchAnswers[currentQuestion.id+'_'+pair.localIdx]),borderColor:matchColor(matchAnswers[currentQuestion.id+'_'+pair.localIdx])}
                     : activeMatchLeft?.qid===currentQuestion.id && activeMatchLeft?.pi===pair.localIdx
                       ? {background:'#7c3aed',borderColor:'#7c3aed'}
                       : {}">
              </div>
            </div>
          </div>

          <!-- Right column (Column B, shuffled) -->
          <div class="mdraw-col mdraw-right">
            <div class="mdraw-col-hd">คอลัมน์ B</div>
            <div v-for="rItem in getShuffledRight(currentQuestion)" :key="rItem.origIdx"
                 class="mdraw-row mdraw-right-row"
                 :class="{'mdrr-used': isRightUsed(currentQuestion.id, rItem.origIdx)}">
              <!-- Left-side dot -->
              <div class="mdot mdot-l"
                   :ref="el => { if(el) _matchRightDots[currentQuestion.id+'_'+rItem.origIdx] = el }"
                   @click.stop="onRightDotClick(currentQuestion.id, rItem.origIdx)"
                   :class="{'mdot-linked': isRightUsed(currentQuestion.id, rItem.origIdx),
                            'mdot-ready': !!activeMatchLeft?.qid && !isRightUsed(currentQuestion.id, rItem.origIdx)}"
                   :style="isRightUsed(currentQuestion.id, rItem.origIdx)
                     ? {background:matchColor(getMatchedLocalIdx(currentQuestion.id, rItem.origIdx)),borderColor:matchColor(getMatchedLocalIdx(currentQuestion.id, rItem.origIdx))}
                     : activeMatchLeft?.qid===currentQuestion.id ? {borderColor:'#7c3aed'} : {}">
              </div>
              <div class="mdraw-content">
                <img v-if="rItem.rightImage" :src="fixPhoto(rItem.rightImage)" class="match-thumb"
                     @click.stop="openZoom(rItem.rightImage)" />
                <span v-if="rItem.right" class="mdraw-text">{{ rItem.right }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- group (จัดกลุ่ม) drag-and-drop -->
      <div v-else-if="currentQuestion.question_type === 'group'" class="group-dnd-wrap">
        <!-- Item pool (unassigned items) -->
        <div
          class="group-pool"
          :class="{ 'group-pool-over': groupDropTarget === 'pool' }"
          @dragover.prevent="groupDropTarget = 'pool'"
          @dragleave="groupDropTarget = null"
          @drop.prevent="dropToPool(currentQuestion.id)"
        >
          <div class="group-pool-top">
            <span class="group-pool-label">📦 ลากรายการไปวางในกลุ่ม</span>
            <button class="group-reset-btn" @click.stop="resetGroup(currentQuestion.id)">↺ ทำใหม่</button>
          </div>
          <div class="group-pool-items">
            <div
              v-for="item in getPoolItems(currentQuestion)" :key="item.ii"
              class="group-item-card"
              :class="{ 'gic-dragging': draggingGroupItem?.qid === currentQuestion.id && draggingGroupItem?.itemIdx === item.ii }"
              draggable="true"
              @dragstart="startDragGroup(currentQuestion.id, item.ii, $event)"
              @dragend="draggingGroupItem = null"
            >
              <img v-if="item.leftImage" :src="fixPhoto(item.leftImage)" class="gic-img gic-zoom" @click.stop.prevent="openZoom(item.leftImage)" />
              <span v-if="item.left">{{ item.left }}</span>
            </div>
            <div v-if="!getPoolItems(currentQuestion).length" class="group-pool-empty">✅ จัดทุกรายการแล้ว</div>
          </div>
        </div>
        <!-- Group boxes -->
        <div class="group-boxes">
          <div
            v-for="(g, gi) in getChoices(currentQuestion)" :key="gi"
            class="group-box"
            :class="{ 'group-box-over': groupDropTarget === 'g'+gi }"
            :style="{ '--gc': matchColor(gi) }"
            @dragover.prevent="groupDropTarget = 'g'+gi"
            @dragleave="groupDropTarget = null"
            @drop.prevent="dropToGroup(currentQuestion.id, gi)"
          >
            <div class="group-box-hd" :style="{ background: matchColor(gi) }">{{ g.text }}</div>
            <div class="group-box-items">
              <div
                v-for="item in getGroupItems(currentQuestion, gi)" :key="item.ii"
                class="group-item-card"
                :class="{ 'gic-dragging': draggingGroupItem?.qid === currentQuestion.id && draggingGroupItem?.itemIdx === item.ii }"
                draggable="true"
                @dragstart="startDragGroup(currentQuestion.id, item.ii, $event)"
                @dragend="draggingGroupItem = null"
              >
                <img v-if="item.leftImage" :src="fixPhoto(item.leftImage)" class="gic-img gic-zoom" @click.stop.prevent="openZoom(item.leftImage)" />
                <span v-if="item.left">{{ item.left }}</span>
              </div>
              <div v-if="!getGroupItems(currentQuestion, gi).length" class="group-box-empty">วางรายการที่นี่</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom navigation bar (fixed at bottom, no scroll) -->
    <div class="exam-bottom-bar">
      <el-button size="large" :disabled="currentIdx === 0" @click="prev">← ข้อก่อน</el-button>
      <div class="bottom-center">
        <span class="bottom-qnum">{{ currentIdx + 1 }} / {{ orderedQuestions.length }}</span>
        <span class="bottom-hint" v-if="isAnswered(currentQuestion?.id)">✅ ตอบแล้ว</span>
        <span class="bottom-hint unanswered" v-else>— ยังไม่ตอบ</span>
      </div>
      <el-button
        size="large"
        :type="currentIdx < orderedQuestions.length - 1 ? 'primary' : 'success'"
        @click="currentIdx < orderedQuestions.length - 1 ? next() : handleSubmit()"
      >
        {{ currentIdx < orderedQuestions.length - 1 ? 'ข้อถัดไป →' : '✅ ส่งข้อสอบ' }}
      </el-button>
    </div>

    <!-- Monitoring banner (always visible during exam) -->
    <div class="monitor-banner">
      <span class="monitor-dot"></span>
      กำลังบันทึกพฤติกรรม — ห้ามออกจากพื้นที่สอบ
    </div>

    <!-- Image zoom overlay -->
    <div v-if="zoomImg" class="img-zoom-overlay" @click="zoomImg = null">
      <img :src="zoomImg" class="img-zoom-pic" @click.stop />
      <button class="img-zoom-close" @click="zoomImg = null">✕</button>
    </div>

    <!-- Violation warning overlay -->
    <div v-if="showViolationWarning" class="violation-overlay">
      <div class="violation-box">
        <div style="font-size:48px">⚠️</div>
        <h3 v-if="lastViolationType === 'screen_split'">ตรวจพบการแบ่งหน้าจอ!</h3>
        <h3 v-else-if="lastViolationType === 'tab_switch'">ตรวจพบการเปลี่ยน Tab!</h3>
        <h3 v-else>ตรวจพบการออกจากหน้าสอบ!</h3>
        <p class="viol-desc" v-if="lastViolationType === 'screen_split'">
          เมาส์ออกนอกพื้นที่สอบ — อาจเป็นการแบ่งหน้าจอหรือเปิดหน้าต่างอื่น
        </p>
        <p class="viol-desc" v-else-if="lastViolationType === 'tab_switch'">
          ตรวจพบการซ่อนหน้าสอบหรือสลับไปยังแท็บอื่น
        </p>
        <p class="viol-desc" v-else>
          หน้าต่างสอบสูญเสียการโฟกัส
        </p>
        <div class="viol-count">ครั้งที่ {{ violationCount }} / {{ exam?.violation_limit }}</div>
        <p v-if="violationCount >= (exam?.violation_limit || 3)" class="viol-danger">
          ⛔ ครบจำนวนครั้งแล้ว — ครูสามารถล็อกการสอบของคุณได้ทันที
        </p>
        <el-button type="primary" @click="showViolationWarning = false">รับทราบและกลับมาทำข้อสอบ</el-button>
      </div>
    </div>
  </div>

  <!-- JOIN screen (before joining) -->
  <div v-else class="fullscreen join-screen">
    <div class="join-content" v-if="exam">
      <div style="font-size:48px">📝</div>
      <h2>{{ exam.subject_name }}</h2>
      <h3>{{ exam.title }}</h3>
      <div class="exam-info-card">
        <div>📅 {{ fmtDate(exam.exam_date) }}</div>
        <div>🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }}</div>
        <div>⏱ เวลาทำ {{ exam.duration_minutes }} นาที</div>
        <div v-if="exam.description" style="margin-top:8px;font-style:italic;color:#475569">{{ exam.description }}</div>
      </div>
      <div class="join-rules">
        <p>📌 ข้อปฏิบัติ:</p>
        <ul>
          <li>ห้ามออกจากหน้าสอบหรือเปลี่ยน Tab</li>
          <li>ห้ามแบ่งหน้าจอหรือเปิดหน้าต่างอื่นไว้ข้างๆ</li>
          <li>ห้ามใช้คลิกขวาหรือคัดลอกข้อความ</li>
          <li>ระบบบันทึกการเคลื่อนไหวของเมาส์ตลอดการสอบ</li>
          <li>หากทุจริตเกิน {{ exam.violation_limit }} ครั้ง ครูสามารถล็อกการสอบได้ทันที</li>
        </ul>
      </div>
      <el-button type="primary" size="large" :loading="joining" @click="handleJoin">
        เข้าห้องสอบ
      </el-button>
    </div>
    <div v-else>กำลังโหลด...</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useExam } from '@/composables/useExam'
import { useStudentStore } from '@/stores/student'
import { supabase } from '@/supabase/client'
import { fixPhotoUrl } from '@/composables/useStudentUpload'

const route = useRoute()
const router = useRouter()
const studentStore = useStudentStore()
const { getExamById, getQuestions, getMySession, joinExam, saveAnswers, submitExam, logViolation } = useExam()

const examId = route.params.id
const exam = ref(null)
const acConfig = ref({ splitGraceMs: 120, topGraceMs: 350, returnGraceMs: 500 })
const questions = ref([])
const mySession = ref(null)
const sessionStatus = ref('join') // join | waiting | pending_approval | in_progress | submitted | locked
const orderedQuestions = ref([])
const currentIdx = ref(0)
const answers = ref({})
const multiAnswers = ref({})
const matchAnswers = ref({})
const timeLeft = ref(0)
const joining = ref(false)
const submitting = ref(false)
const violationCount = ref(0)
const showViolationWarning = ref(false)
const lastViolationType = ref('')
const finalScore = ref(null)
const maxScore = ref(null)
let realtimeChannel = null
let timerInterval = null
let autoSaveInterval = null
let pollInterval = null
let wakeLock = null
let mouseLeaveTimer = null
let violationPendingTimer = null
let autoSaveTimer = null

const currentQuestion = computed(() => orderedQuestions.value[currentIdx.value] || null)
const answeredCount = computed(() => orderedQuestions.value.filter(q => isAnswered(q.id)).length)

const CHOICE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
const MATCH_COLORS  = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6']
function choiceColor(idx) { return CHOICE_COLORS[idx % CHOICE_COLORS.length] }
function matchColor(idx)  { return MATCH_COLORS[idx  % MATCH_COLORS.length] }

const activeMatchLeft   = ref(null)       // {qid, pi}
const matchRightShuffles = ref({})        // stable shuffle per question
const groupAnswers = ref({})              // {[qid]: {[itemIdx]: groupIdx}}
const draggingGroupItem = ref(null)       // {qid, itemIdx}
const groupDropTarget = ref(null)         // 'pool' | 'g0' | 'g1' | ...
const zoomImg = ref(null)                 // URL of zoomed image
const matchLines = ref({})               // {qid: [{x1,y1,x2,y2,localI,color},...]}
const drawingLine = ref(null)             // {qid, localI, x1, y1, x2, y2}
const _matchLeftDots  = {}               // non-reactive DOM refs  {qid_localIdx: el}
const _matchRightDots = {}               // non-reactive DOM refs  {qid_origIdx: el}
const _matchContainers = {}              // non-reactive DOM refs  {qid: el}
const countdownText = computed(() => {
  if (!exam.value) return ''
  const { start } = getExamWindow()
  const diff = start - new Date()
  if (diff <= 0) return '0 วินาที'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h} ชม. ${m} นาที`
  if (m > 0) return `${m} นาที ${s} วินาที`
  return `${s} วินาที`
})

function fixPhoto(url) { return fixPhotoUrl ? fixPhotoUrl(url) : url }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '' }
function fmtTime(s) {
  const m = Math.floor(s / 60); const sec = s % 60
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function getExamWindow() {
  if (!exam.value) return { start: new Date(), end: new Date() }
  const examDate = new Date(exam.value.exam_date)
  const [sh, sm] = (exam.value.start_time || '00:00').split(':')
  const [eh, em] = (exam.value.end_time || '23:59').split(':')
  const start = new Date(examDate); start.setHours(+sh, +sm, 0)
  const end = new Date(examDate); end.setHours(+eh, +em, 0)
  return { start, end }
}

function isAnswered(qid) {
  const q = orderedQuestions.value.find(q => q.id === qid)
  if (!q) return false
  if (q.question_type === 'multi') return (multiAnswers.value[qid] || []).length > 0
  if (q.question_type === 'match') {
    const leftPairs = getMatchPairs(q).filter(p => p.left || p.leftImage)
    return leftPairs.every((_, i) => matchAnswers.value[qid + '_' + i] !== undefined)
  }
  if (q.question_type === 'group') {
    const pairs = getMatchPairs(q)
    return pairs.every((_, i) => groupAnswers.value[qid]?.[i] !== undefined)
  }
  return !!answers.value[qid]
}

function typeLabel(t) {
  const m = { choice: 'ปรนัย', multi: 'หลายตัวเลือก', truefalse: 'ถูก/ผิด', fill: 'เติมคำ', essay: 'อัตนัย', match: 'จับคู่', group: 'จัดกลุ่ม' }
  return m[t] || t
}

function choiceLetter(idx) { return 'ABCDEFGH'[idx] }

function getChoices(q) {
  try { return typeof q.choices === 'string' ? JSON.parse(q.choices) : (q.choices || []) }
  catch { return [] }
}

function getMatchPairs(q) {
  try { return typeof q.match_pairs === 'string' ? JSON.parse(q.match_pairs) : (q.match_pairs || []) }
  catch { return [] }
}

// left items only (pairs with non-empty left — decoys have empty left)
function getLeftPairs(q) {
  return getMatchPairs(q)
    .map((p, globalIdx) => ({ ...p, globalIdx }))
    .filter(p => p.left || p.leftImage)
    .map((p, localIdx) => ({ ...p, localIdx }))
}

// ── Match helpers ────────────────────────────────────────────────
function getShuffledRight(q) {
  if (matchRightShuffles.value[q.id]) return matchRightShuffles.value[q.id]
  const pairs = getMatchPairs(q)
  const shuffled = pairs.map((p, i) => ({ ...p, origIdx: i })).sort(() => Math.random() - 0.5)
  matchRightShuffles.value[q.id] = shuffled
  return shuffled
}

function isRightUsed(qid, origIdx) {
  const q = orderedQuestions.value.find(q => q.id === qid)
  if (!q) return false
  const leftPairs = getMatchPairs(q).filter(p => p.left || p.leftImage)
  return leftPairs.some((_, i) => matchAnswers.value[qid + '_' + i] === origIdx)
}

function getMatchedLocalIdx(qid, origIdx) {
  const q = orderedQuestions.value.find(q => q.id === qid)
  if (!q) return -1
  const leftPairs = getMatchPairs(q).filter(p => p.left || p.leftImage)
  return leftPairs.findIndex((_, i) => matchAnswers.value[qid + '_' + i] === origIdx)
}

function updateMatchLines(qid) {
  const container = _matchContainers[qid]
  if (!container) { matchLines.value[qid] = []; return }
  const cr = container.getBoundingClientRect()
  const q = orderedQuestions.value.find(q => q.id === qid)
  if (!q) return
  const leftPairs = getMatchPairs(q).filter(p => p.left || p.leftImage)
  const lines = []
  for (let localI = 0; localI < leftPairs.length; localI++) {
    const origIdx = matchAnswers.value[qid + '_' + localI]
    if (origIdx === undefined) continue
    const lEl = _matchLeftDots[qid + '_' + localI]
    const rEl = _matchRightDots[qid + '_' + origIdx]
    if (!lEl || !rEl) continue
    const lR = lEl.getBoundingClientRect()
    const rR = rEl.getBoundingClientRect()
    lines.push({
      localI,
      x1: lR.right - cr.left, y1: lR.top + lR.height / 2 - cr.top,
      x2: rR.left  - cr.left, y2: rR.top + rR.height / 2 - cr.top,
      color: matchColor(localI),
    })
  }
  matchLines.value[qid] = lines
}

function toggleMatchLeft(qid, pi) {
  if (activeMatchLeft.value?.qid === qid && activeMatchLeft.value?.pi === pi) {
    activeMatchLeft.value = null; drawingLine.value = null; return
  }
  // If already paired, clear that pair first
  if (matchAnswers.value[qid + '_' + pi] !== undefined) {
    delete matchAnswers.value[qid + '_' + pi]
    buildMatchAnswer(qid); updateMatchLines(qid)
  }
  activeMatchLeft.value = { qid, pi }
  // Start drawing line from this dot
  const lEl = _matchLeftDots[qid + '_' + pi]
  const container = _matchContainers[qid]
  if (lEl && container) {
    const cr = container.getBoundingClientRect()
    const lr = lEl.getBoundingClientRect()
    const sx = lr.right - cr.left, sy = lr.top + lr.height / 2 - cr.top
    drawingLine.value = { qid, localI: pi, x1: sx, y1: sy, x2: sx + 20, y2: sy }
  }
}

function onRightDotClick(qid, origIdx) {
  if (activeMatchLeft.value?.qid !== qid) {
    // No active left — if this right is used, click it to disconnect
    if (isRightUsed(qid, origIdx)) {
      const localI = getMatchedLocalIdx(qid, origIdx)
      if (localI >= 0) deleteMatchLine(qid, localI)
    }
    return
  }
  const pi = activeMatchLeft.value.pi
  // If this right is already used by another left, clear it
  if (isRightUsed(qid, origIdx)) {
    const existingLocalI = getMatchedLocalIdx(qid, origIdx)
    if (existingLocalI >= 0 && existingLocalI !== pi) delete matchAnswers.value[qid + '_' + existingLocalI]
  }
  matchAnswers.value[qid + '_' + pi] = origIdx
  activeMatchLeft.value = null; drawingLine.value = null
  buildMatchAnswer(qid); updateMatchLines(qid)
}

function deleteMatchLine(qid, localI) {
  delete matchAnswers.value[qid + '_' + localI]
  buildMatchAnswer(qid); updateMatchLines(qid)
}

function resetMatch(qid) {
  const q = orderedQuestions.value.find(q => q.id === qid)
  if (!q) return
  const leftPairs = getMatchPairs(q).filter(p => p.left || p.leftImage)
  for (let i = 0; i < leftPairs.length; i++) delete matchAnswers.value[qid + '_' + i]
  activeMatchLeft.value = null; drawingLine.value = null
  buildMatchAnswer(qid); matchLines.value[qid] = []
}

function onMatchMouseMove(qid, event) {
  if (!drawingLine.value || drawingLine.value.qid !== qid) return
  const container = _matchContainers[qid]
  if (!container) return
  const cr = container.getBoundingClientRect()
  drawingLine.value = { ...drawingLine.value, x2: event.clientX - cr.left, y2: event.clientY - cr.top }
}

function cancelDraw() { activeMatchLeft.value = null; drawingLine.value = null }

// ── Group helpers ────────────────────────────────────────────────
function selectGroup(qid, itemIdx, groupIdx) {
  if (!groupAnswers.value[qid]) groupAnswers.value[qid] = {}
  if (groupAnswers.value[qid][itemIdx] === groupIdx)
    delete groupAnswers.value[qid][itemIdx]
  else
    groupAnswers.value[qid][itemIdx] = groupIdx
  buildGroupAnswer(qid)
}

function buildGroupAnswer(qid) {
  const q = orderedQuestions.value.find(q => q.id === qid)
  if (!q) return
  const pairs = getMatchPairs(q)
  answers.value[qid] = pairs.map((_, i) => groupAnswers.value[qid]?.[i] ?? 'null').join(',')
  autoSave()
}

function getPoolItems(q) {
  return getMatchPairs(q).map((item, ii) => ({ ...item, ii }))
    .filter(({ ii }) => groupAnswers.value[q.id]?.[ii] === undefined)
}

function getGroupItems(q, groupIdx) {
  return getMatchPairs(q).map((item, ii) => ({ ...item, ii }))
    .filter(({ ii }) => groupAnswers.value[q.id]?.[ii] === groupIdx)
}

function startDragGroup(qid, itemIdx, event) {
  draggingGroupItem.value = { qid, itemIdx }
  event.dataTransfer.effectAllowed = 'move'
}

function dropToGroup(qid, groupIdx) {
  if (!draggingGroupItem.value || draggingGroupItem.value.qid !== qid) return
  selectGroup(qid, draggingGroupItem.value.itemIdx, groupIdx)
  draggingGroupItem.value = null
  groupDropTarget.value = null
}

function dropToPool(qid) {
  if (!draggingGroupItem.value || draggingGroupItem.value.qid !== qid) return
  const { itemIdx } = draggingGroupItem.value
  if (!groupAnswers.value[qid]) groupAnswers.value[qid] = {}
  delete groupAnswers.value[qid][itemIdx]
  buildGroupAnswer(qid)
  draggingGroupItem.value = null
  groupDropTarget.value = null
}

function resetGroup(qid) {
  groupAnswers.value[qid] = {}
  buildGroupAnswer(qid)
}

function openZoom(url) {
  zoomImg.value = fixPhoto(url)
}

function toggleMulti(qid, letter) {
  if (!multiAnswers.value[qid]) multiAnswers.value[qid] = []
  const idx = multiAnswers.value[qid].indexOf(letter)
  if (idx >= 0) multiAnswers.value[qid].splice(idx, 1)
  else multiAnswers.value[qid].push(letter)
  autoSave()
}

function buildMatchAnswer(qid) {
  const q = orderedQuestions.value.find(q => q.id === qid)
  if (!q) return
  const leftPairs = getMatchPairs(q).filter(p => p.left || p.leftImage)
  const result = leftPairs.map((_, i) => matchAnswers.value[qid + '_' + i] ?? 'null').join(',')
  answers.value[qid] = result
  autoSave()
}

function prev() { if (currentIdx.value > 0) currentIdx.value-- }
function next() { if (currentIdx.value < orderedQuestions.value.length - 1) currentIdx.value++ }

function buildAnswersPayload() {
  const payload = {}
  for (const q of orderedQuestions.value) {
    if (q.question_type === 'multi') payload[q.id] = (multiAnswers.value[q.id] || []).join(',')
    else payload[q.id] = answers.value[q.id] || ''
  }
  return payload
}

async function autoSave() {
  if (!mySession.value?.id) return
  await saveAnswers(mySession.value.id, buildAnswersPayload())
}

function debouncedAutoSave() {
  clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(autoSave, 1500)
}

async function handleJoin() {
  joining.value = true
  const res = await joinExam(
    examId,
    studentStore.session?.school_id,
    studentStore.session?.student_code,
    [studentStore.session?.first_name, studentStore.session?.last_name].filter(Boolean).join(' ') || studentStore.session?.student_code,
    studentStore.session?.class_id,
    studentStore.session?.photo_url || null
  )
  joining.value = false
  if (!res.success) { ElMessage.error(res.error); return }
  const sessionId = res.data?.session_id || res.data?.id || res.data
  mySession.value = { id: sessionId, status: 'pending_approval' }
  sessionStatus.value = 'pending_approval'
  subscribeSession(sessionId)
}

async function handleSubmit() {
  try {
    await ElMessageBox.confirm('ยืนยันการส่งข้อสอบ? จะไม่สามารถแก้ไขได้อีก', 'ส่งข้อสอบ', {
      confirmButtonText: 'ส่งข้อสอบ', cancelButtonText: 'ยกเลิก', type: 'warning'
    })
  } catch { return }
  submitting.value = true
  const res = await submitExam(mySession.value.id, buildAnswersPayload())
  submitting.value = false
  if (res.success) {
    finalScore.value = res.data?.score ?? null
    maxScore.value = res.data?.max_score ?? null
    sessionStatus.value = 'submitted'
    stopTimer()
  } else ElMessage.error(res.error)
}

function startTimer() {
  if (!mySession.value || !exam.value) return
  const approvedAt = mySession.value.approved_at ? new Date(mySession.value.approved_at) : new Date()
  const elapsed = Math.floor((new Date() - approvedAt) / 1000)
  timeLeft.value = Math.max(0, (exam.value.duration_minutes || 60) * 60 - elapsed)
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) timeLeft.value--
    else { clearInterval(timerInterval); autoSubmit() }
  }, 1000)
}

async function autoSubmit() {
  if (sessionStatus.value !== 'in_progress') return
  ElMessage.warning('หมดเวลาสอบ! ระบบจะส่งข้อสอบอัตโนมัติ')
  submitting.value = true
  const res = await submitExam(mySession.value.id, buildAnswersPayload())
  submitting.value = false
  if (res.success) {
    finalScore.value = res.data?.score ?? null
    maxScore.value = res.data?.max_score ?? null
    sessionStatus.value = 'submitted'
  }
}

function stopTimer() { clearInterval(timerInterval); clearInterval(autoSaveInterval) }

function applySessionUpdate(updated) {
  mySession.value = { ...mySession.value, ...updated }
  if (updated.status === 'in_progress' && sessionStatus.value !== 'in_progress') {
    sessionStatus.value = 'in_progress'
    buildOrderedQuestions(updated.shuffled_question_ids)
    startTimer()
    requestWakeLock()
    registerAntiCheat()
  } else if (updated.status === 'locked' && sessionStatus.value !== 'locked') {
    sessionStatus.value = 'locked'
    stopTimer()
    releaseWakeLock()
  } else if (updated.status === 'submitted' && sessionStatus.value !== 'submitted') {
    finalScore.value = updated.score
    maxScore.value = updated.max_score
    sessionStatus.value = 'submitted'
    stopTimer()
    releaseWakeLock()
  }
}

function subscribeSession(sessionId) {
  realtimeChannel = supabase
    .channel(`student-exam-${sessionId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'exam_sessions', filter: `id=eq.${sessionId}` },
      (payload) => applySessionUpdate(payload.new))
    .subscribe()

  // polling fallback every 3s while waiting for teacher approval or mid-exam lock
  pollInterval = setInterval(async () => {
    if (!mySession.value?.id) return
    if (['submitted', 'locked'].includes(sessionStatus.value)) {
      clearInterval(pollInterval); return
    }
    const res = await getMySession(examId, studentStore.session?.student_code)
    if (res.success && res.data) applySessionUpdate(res.data)
  }, 3000)
}

function buildOrderedQuestions(shuffledIds) {
  let ids = shuffledIds
  if (typeof ids === 'string') { try { ids = JSON.parse(ids) } catch { ids = [] } }
  if (Array.isArray(ids) && ids.length) {
    orderedQuestions.value = ids.map(id => questions.value.find(q => q.id === id)).filter(Boolean)
  } else {
    orderedQuestions.value = [...questions.value]
  }
}

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen') } catch {}
}

function releaseWakeLock() { wakeLock?.release().catch(() => {}) }

function registerAntiCheat() {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)
  document.addEventListener('mouseleave', onMouseLeave)
  document.addEventListener('mouseenter', onMouseEnter)
}

function unregisterAntiCheat() {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('blur', onBlur)
  window.removeEventListener('focus', onFocus)
  document.removeEventListener('mouseleave', onMouseLeave)
  document.removeEventListener('mouseenter', onMouseEnter)
  clearTimeout(mouseLeaveTimer)
  clearTimeout(violationPendingTimer)
}

// ─── pending violation helpers ────────────────────────────────────
// blur / tab-switch: pending 500ms — ถ้ากลับมาทันยกเลิก ไม่นับ
function startViolationPending(type) {
  clearTimeout(violationPendingTimer)
  violationPendingTimer = setTimeout(async () => {
    violationPendingTimer = null
    if (sessionStatus.value === 'in_progress') await recordViolation(type)
  }, acConfig.value.returnGraceMs)
}
function cancelViolationPending() {
  clearTimeout(violationPendingTimer)
  violationPendingTimer = null
}

function onVisibilityChange() {
  if (document.hidden && sessionStatus.value === 'in_progress') {
    startViolationPending('tab_switch')
  } else if (!document.hidden) {
    cancelViolationPending()   // กลับมาทัน 500ms → ไม่นับ
  }
}

function onBlur() {
  if (sessionStatus.value === 'in_progress') startViolationPending('window_blur')
}

function onFocus() {
  cancelViolationPending()     // กลับมาทัน 500ms → ไม่นับ
}

function onMouseLeave(e) {
  if (sessionStatus.value !== 'in_progress') return
  // ออกด้านบน (address bar / toolbar) หรือด้านข้าง/ล่าง (split-screen)
  const fromTop = e.clientY <= 5
  const grace = fromTop ? acConfig.value.topGraceMs : acConfig.value.splitGraceMs
  mouseLeaveTimer = setTimeout(async () => {
    if (sessionStatus.value === 'in_progress') await recordViolation('screen_split')
  }, grace)
}

function onMouseEnter() {
  clearTimeout(mouseLeaveTimer)
  mouseLeaveTimer = null
}

async function recordViolation(type) {
  violationCount.value++
  lastViolationType.value = type
  showViolationWarning.value = true
  if (!mySession.value?.id) return
  await logViolation(
    mySession.value.id,
    examId,
    studentStore.session?.school_id,
    studentStore.session?.student_code,
    type
  )
}

async function loadAcConfig(schoolId) {
  if (!schoolId) return
  try {
    const { data } = await supabase.from('schools').select('settings').eq('id', schoolId).single()
    const ac = data?.settings?.anti_cheat_detection
    if (ac) {
      acConfig.value = {
        splitGraceMs:  Number(ac.split_grace_ms)  || 120,
        topGraceMs:    Number(ac.top_grace_ms)    || 350,
        returnGraceMs: Number(ac.return_grace_ms) || 500,
      }
    }
  } catch {}
}

onMounted(async () => {
  const [examRes, questionsRes] = await Promise.all([getExamById(examId), getQuestions(examId)])
  if (examRes.success) exam.value = examRes.data
  if (questionsRes.success) questions.value = questionsRes.data

  await loadAcConfig(studentStore.session?.school_id)

  const sessRes = await getMySession(examId, studentStore.session?.student_code)
  if (sessRes.success && sessRes.data) {
    mySession.value = sessRes.data
    violationCount.value = sessRes.data.violation_count || 0
    const status = sessRes.data.status
    sessionStatus.value = status
    if (status === 'in_progress') {
      buildOrderedQuestions(sessRes.data.shuffled_question_ids)
      if (sessRes.data.answers) {
        const saved = typeof sessRes.data.answers === 'string' ? JSON.parse(sessRes.data.answers) : sessRes.data.answers
        for (const [qid, val] of Object.entries(saved)) answers.value[qid] = val
        for (const q of questions.value) {
          if (q.question_type === 'match' && saved[q.id]) {
            String(saved[q.id]).split(',').forEach((v, i) => {
              const n = parseInt(v); if (!isNaN(n)) matchAnswers.value[q.id + '_' + i] = n
            })
          }
          if (q.question_type === 'group' && saved[q.id]) {
            groupAnswers.value[q.id] = {}
            String(saved[q.id]).split(',').forEach((v, i) => {
              if (v !== 'null') groupAnswers.value[q.id][i] = parseInt(v)
            })
          }
        }
      }
      startTimer()
      requestWakeLock()
      if (exam.value?.anti_cheat !== false) registerAntiCheat()
      subscribeSession(sessRes.data.id)
      // Restore SVG lines for match questions already visible
      nextTick(() => {
        const q = orderedQuestions.value[currentIdx.value]
        if (q?.question_type === 'match') updateMatchLines(q.id)
      })
    } else if (status === 'submitted') {
      finalScore.value = sessRes.data.score
      maxScore.value = sessRes.data.max_score
    } else if (status === 'pending_approval') {
      subscribeSession(sessRes.data.id)
    }
  } else {
    if (exam.value) {
      const { start, end } = getExamWindow()
      const now = new Date()
      if (now < start) {
        sessionStatus.value = 'waiting'
        const waitTimer = setInterval(() => {
          if (new Date() >= start) { clearInterval(waitTimer); sessionStatus.value = 'join' }
        }, 1000)
      } else if (now > end) {
        sessionStatus.value = 'ended'
      } else {
        sessionStatus.value = 'join'
      }
    }
  }

  autoSaveInterval = setInterval(autoSave, 30000)
})

watch(currentIdx, async (newIdx) => {
  cancelDraw()
  const q = orderedQuestions.value[newIdx]
  if (q?.question_type === 'match') {
    await nextTick()
    updateMatchLines(q.id)
  }
})

onUnmounted(() => {
  stopTimer()
  clearInterval(pollInterval)
  realtimeChannel?.unsubscribe()
  unregisterAntiCheat()
  releaseWakeLock()
  clearTimeout(autoSaveTimer)
})
</script>

<style scoped>
* { box-sizing: border-box; }
.fullscreen {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: #f8fafc;
}
.locked-screen { background: #fff5f5; }
.locked-content, .submitted-content, .waiting-content, .pending-content, .join-content {
  text-align: center; max-width: 480px;
}
.locked-content h2 { color: #dc2626; font-size: 24px; margin: 12px 0; }
.submitted-content h2 { color: #16a34a; font-size: 24px; margin: 12px 0; }
.score-display { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin: 16px 0; }
.score-num { font-size: 56px; font-weight: 900; color: #0284c7; }
.score-max { font-size: 20px; color: #64748b; }
.waiting-content h2, .join-content h2 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 8px 0; }
.countdown-big { font-size: 28px; font-weight: 800; color: #7c3aed; margin: 16px 0; }
.exam-time { font-size: 13px; color: #64748b; margin: 8px 0; }
.spinner {
  width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: #7c3aed;
  border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.pending-content h2 { color: #7c3aed; font-size: 20px; }
.join-content h3 { color: #475569; font-size: 16px; margin: 4px 0 16px; }
.exam-info-card { background: #f8fafc; border-radius: 12px; padding: 14px 20px; margin: 12px 0; text-align: left; font-size: 14px; color: #374151; line-height: 2; }
.join-rules { background: #fef3c7; border-radius: 12px; padding: 12px 16px; margin: 12px 0; text-align: left; font-size: 13px; color: #92400e; }
.join-rules ul { margin: 6px 0 0; padding-left: 18px; }
.join-rules li { margin-bottom: 4px; }

/* ── Exam shell (full-screen container) ─────────────────────────── */
.exam-shell {
  height: 100dvh; display: flex; flex-direction: column; background: #f8fafc;
  user-select: none; -webkit-user-select: none; overflow: hidden;
}

/* ── Top bar ─────────────────────────────────────────────────────── */
.exam-topbar {
  display: flex; justify-content: space-between; align-items: center;
  background: linear-gradient(135deg,#1e1b4b,#4c1d95); color: #fff;
  padding: 10px 16px; gap: 12px; flex-shrink: 0;
}
.exam-topbar-left { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; }
.subject-chip { background: rgba(255,255,255,.2); padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.exam-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exam-topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.timer-box { font-size: 16px; font-weight: 800; font-family: monospace; background: rgba(255,255,255,.15); padding: 5px 10px; border-radius: 8px; }
.timer-warn { background: #fef3c7 !important; color: #92400e !important; }
.timer-danger { background: #fee2e2 !important; color: #dc2626 !important; animation: pulse-red 1s infinite; }
@keyframes pulse-red { 0%,100% { opacity:1 } 50% { opacity:.7 } }

/* ── Question number strip ───────────────────────────────────────── */
.q-strip {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border-bottom: 1px solid #e2e8f0;
  padding: 5px 12px; flex-shrink: 0; height: 44px;
}
.q-strip-scroll {
  display: flex; gap: 4px; overflow-x: auto; flex: 1; align-items: center;
  scrollbar-width: thin;
}
.q-strip-scroll::-webkit-scrollbar { height: 3px; }
.q-strip-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
.q-strip-btn {
  min-width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; flex-shrink: 0;
  background: #f1f5f9; color: #64748b; transition: all .12s;
}
.q-strip-btn:hover { background: #e2e8f0; }
.q-strip-current { background: #7c3aed !important; color: #fff !important; }
.q-strip-answered { background: #dcfce7 !important; color: #166534 !important; }
.q-strip-answered.q-strip-current { background: #7c3aed !important; color: #fff !important; }
.q-strip-stat { font-size: 12px; font-weight: 700; color: #7c3aed; white-space: nowrap; flex-shrink: 0; }
.strip-answered { color: #16a34a; }

/* ── Question area (fills all remaining space) ───────────────────── */
.q-area { flex: 1; overflow-y: auto; padding: 16px 20px 12px; }
.q-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.q-num { font-size: 17px; font-weight: 800; color: #0f172a; }
.q-points { font-size: 12px; color: #7c3aed; font-weight: 700; background: #ede9fe; padding: 2px 8px; border-radius: 6px; }
.q-text { font-size: 16px; color: #0f172a; line-height: 1.8; margin-bottom: 14px; }
.q-image img { max-width: 100%; max-height: 260px; object-fit: contain; border-radius: 10px; margin-bottom: 14px; cursor: zoom-in; }
.choices { display: flex; flex-direction: column; gap: 8px; }
.choice-item {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all .12s;
  background: #fff;
}
.choice-item:hover { border-color: #a78bfa; background: #faf5ff; }
.choice-selected { border-color: #7c3aed !important; background: #ede9fe !important; }
.choice-item input { cursor: pointer; }
.choice-letter { font-weight: 800; color: #7c3aed; min-width: 20px; }
.choice-text { flex: 1; color: #0f172a; }
.choice-img { max-width: 80px; max-height: 60px; border-radius: 6px; cursor: zoom-in; }
.choice-item { border-left: 4px solid #e2e8f0; }
.fill-wrap { max-width: 600px; }

/* ── Match SVG line-drawing ────────────────────────────────────── */
.match-draw-root { display: flex; flex-direction: column; gap: 10px; }

.match-draw-hdr {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 6px 12px; background: #f1f5f9; border-radius: 8px;
}
.match-draw-hint { font-size: 12px; color: #64748b; font-weight: 600; }
.mh-active { color: #5b21b6; font-weight: 800; }
.match-reset-btn {
  font-size: 11px; font-weight: 700; color: #7c3aed; background: #ede9fe;
  border: none; border-radius: 7px; padding: 3px 10px; cursor: pointer; white-space: nowrap;
}
.match-reset-btn:hover { background: #ddd6fe; }

/* Main drawing area — position:relative so SVG overlay uses absolute positioning */
.match-draw-area {
  position: relative;
  display: grid; grid-template-columns: 1fr 1fr; gap: 0;
  border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: visible;
  background: #fff; min-height: 120px;
}

/* SVG overlay covers entire area, passes through clicks except on interactive elements */
.match-svg-ov {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: visible; z-index: 5;
}
.mdel-g { pointer-events: all; cursor: pointer; }

/* Columns */
.mdraw-col { display: flex; flex-direction: column; padding: 10px 8px 10px 12px; gap: 6px; }
.mdraw-left { padding-right: 24px; }
.mdraw-right { padding-left: 24px; border-left: 1.5px solid #f1f5f9; }
.mdraw-col-hd {
  font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;
  letter-spacing: .06em; padding-bottom: 6px; border-bottom: 2px solid #f1f5f9; margin-bottom: 2px;
}

/* Rows */
.mdraw-row {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 6px; border-radius: 9px; min-height: 44px;
  background: #f8fafc; border: 1.5px solid transparent; transition: background .1s, border-color .1s;
}
.mdraw-left-row { flex-direction: row; justify-content: space-between; }
.mdraw-right-row { flex-direction: row; }
.mdlr-active { background: #ede9fe !important; border-color: #a78bfa !important; }
.mdlr-paired { background: #f0fdf4; border-color: #bbf7d0; }
.mdrr-used { background: #f0fdf4; border-color: #bbf7d0; }

/* Card content (text + image) */
.mdraw-content { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.mdraw-text { font-size: 13px; color: #1e293b; font-weight: 600; word-break: break-word; }
.match-thumb {
  width: 44px; height: 44px; object-fit: cover; border-radius: 7px;
  flex-shrink: 0; cursor: zoom-in; transition: opacity .12s;
}
.match-thumb:hover { opacity: .85; }

/* Connection dots */
.mdot {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  border: 2.5px solid #cbd5e1; background: #fff; cursor: pointer;
  transition: background .12s, border-color .12s, transform .1s; z-index: 10;
}
.mdot:hover { border-color: #7c3aed; transform: scale(1.2); }
.mdot-active { background: #7c3aed !important; border-color: #7c3aed !important; transform: scale(1.15); }
.mdot-linked { transform: scale(1.1); }
.mdot-ready { border-color: #a78bfa; border-style: dashed; }
.mdot-r { margin-left: 4px; }
.mdot-l { margin-right: 4px; }

/* ── Group question drag-and-drop ─────────────────────────────── */
.group-dnd-wrap { display: flex; flex-direction: column; gap: 14px; }

.group-pool {
  border: 2px dashed #cbd5e1; border-radius: 12px; padding: 12px 14px;
  min-height: 80px; transition: border-color .15s, background .15s; background: #fafafa;
}
.group-pool-over { border-color: #7c3aed !important; background: #faf5ff !important; }
.group-pool-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.group-pool-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
.group-reset-btn {
  font-size: 11px; font-weight: 700; color: #7c3aed; background: #ede9fe;
  border: none; border-radius: 7px; padding: 3px 10px; cursor: pointer; transition: background .12s;
}
.group-reset-btn:hover { background: #ddd6fe; }
.group-pool-items { display: flex; flex-wrap: wrap; gap: 8px; min-height: 36px; }
.group-pool-empty { font-size: 12px; color: #16a34a; font-weight: 700; padding: 4px 0; }
.gic-zoom { cursor: zoom-in !important; }
.gic-zoom:hover { opacity: .85; transform: scale(1.05); }

.group-boxes { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }

.group-box {
  border: 2px solid var(--gc, #e2e8f0); border-radius: 12px; overflow: hidden;
  min-height: 130px; transition: background .15s;
}
.group-box-over { background: #f0fdf4; }
.group-box-hd { padding: 8px 12px; font-size: 13px; font-weight: 800; color: #fff; }
.group-box-items { padding: 10px; display: flex; flex-wrap: wrap; gap: 8px; min-height: 80px; }
.group-box-empty { font-size: 11px; color: #94a3b8; font-style: italic; align-self: center; width: 100%; text-align: center; padding: 12px 0; }

.group-item-card {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; background: #fff; border: 2px solid #e2e8f0; border-radius: 8px;
  cursor: grab; font-size: 13px; font-weight: 600; color: #0f172a;
  transition: all .12s; box-shadow: 0 1px 3px rgba(0,0,0,.07); user-select: none;
}
.group-item-card:hover { border-color: #a78bfa; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
.group-item-card:active { cursor: grabbing; }
.gic-dragging { opacity: .45; }
.gic-img { width: 28px; height: 28px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }

/* ── Bottom navigation bar ───────────────────────────────────────── */
.exam-bottom-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; background: #fff; border-top: 2px solid #e2e8f0;
  flex-shrink: 0; gap: 12px;
}
.bottom-center { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.bottom-qnum { font-size: 15px; font-weight: 800; color: #0f172a; }
.bottom-hint { font-size: 11px; font-weight: 600; color: #16a34a; }
.bottom-hint.unanswered { color: #94a3b8; }

/* ── Monitoring banner ───────────────────────────────────────────── */
.monitor-banner {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: #1e1b4b; color: rgba(255,255,255,.7); font-size: 11px; font-weight: 700;
  padding: 5px 12px; letter-spacing: .03em;
}
.monitor-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #ef4444; flex-shrink: 0;
  animation: pulse-rec 1.2s ease-in-out infinite;
}
@keyframes pulse-rec {
  0%,100% { opacity: 1; transform: scale(1); }
  50%      { opacity: .4; transform: scale(.8); }
}

/* ── Image zoom overlay ──────────────────────────────────────────── */
.img-zoom-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.88); z-index: 9998;
  display: flex; align-items: center; justify-content: center;
}
.img-zoom-pic {
  max-width: 90vw; max-height: 85vh; object-fit: contain;
  border-radius: 12px; box-shadow: 0 8px 40px rgba(0,0,0,.5);
}
.img-zoom-close {
  position: fixed; top: 20px; right: 20px;
  width: 40px; height: 40px; border-radius: 50%; border: none;
  background: rgba(255,255,255,.18); color: #fff; font-size: 18px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.img-zoom-close:hover { background: rgba(255,255,255,.32); }

/* ── Violation overlay ───────────────────────────────────────────── */
.violation-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.78); z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.violation-box {
  background: #fff; border-radius: 20px; padding: 32px 28px; text-align: center;
  max-width: 400px; border: 4px solid #dc2626; display: flex; flex-direction: column; gap: 10px;
}
.violation-box h3 { color: #dc2626; font-size: 20px; margin: 0; }
.viol-desc { font-size: 13px; color: #475569; margin: 0; }
.viol-count { font-size: 18px; font-weight: 900; color: #0f172a; }
.viol-danger { font-size: 13px; font-weight: 800; color: #dc2626; background: #fee2e2; border-radius: 8px; padding: 8px 12px; margin: 0; }
</style>
