<template>
  <AppLayout>
    <div class="hv-page">
      <div class="hv-header">
        <h1 class="hv-title">🏠 เยี่ยมบ้านนักเรียน</h1>
        <p class="hv-sub">ข้อมูลบ้าน · บันทึกการเยี่ยม · รายงานตามรอบ</p>
      </div>

      <el-tabs v-model="mainTab" class="hv-tabs" @tab-change="onTabChange">

        <!-- แดชบอร์ด -->
        <el-tab-pane label="📊 แดชบอร์ด" name="dashboard">
          <div v-loading="dashLoading" class="tab-body">
            <div class="overall-stats">
              <div class="os-card"><span class="os-n">{{ overall.total }}</span><span class="os-l">นักเรียนทั้งหมด</span></div>
              <div class="os-card os-card--blue"><span class="os-n">{{ overall.hasHome }}</span><span class="os-l">มีข้อมูลบ้าน</span></div>
              <div class="os-card os-card--red"><span class="os-n">{{ overall.noHome }}</span><span class="os-l">ยังไม่มีข้อมูล</span></div>
              <div class="os-card os-card--green"><span class="os-n">{{ overall.visited }}</span><span class="os-l">เยี่ยมแล้ว</span></div>
              <div class="os-card os-card--amber"><span class="os-n">{{ overall.notVisited }}</span><span class="os-l">ยังไม่เยี่ยม</span></div>
            </div>
            <div class="class-grid">
              <div v-for="cs in myDashStats" :key="cs.classId" class="class-card">
                <div class="cc-head"><span class="cc-name">{{ cs.classId }}</span><span class="cc-total">{{ cs.total }} คน</span></div>
                <div class="cc-progress">
                  <div class="cc-bar-home"  :style="`width:${pct(cs.hasHome,cs.total)}%`"></div>
                  <div class="cc-bar-visit" :style="`width:${pct(cs.visited,cs.total)}%`"></div>
                </div>
                <div class="cc-stats-row">
                  <span class="cc-stat cc-stat--blue">📍 {{ cs.hasHome }}/{{ cs.total }} มีข้อมูล</span>
                  <span class="cc-stat cc-stat--green">✅ {{ cs.visited }}/{{ cs.total }} เยี่ยมแล้ว</span>
                </div>
                <div class="cc-actions">
                  <button class="cc-btn" @click="goToStudents(cs.classId)">ดูนักเรียน →</button>
                  <button class="cc-btn cc-btn--teal" @click="goToRounds(cs.classId)">รอบเยี่ยม →</button>
                </div>
              </div>
            </div>
            <div v-if="!dashLoading && !dashStats.length" class="hv-empty">ไม่พบข้อมูลนักเรียน</div>
          </div>
        </el-tab-pane>

        <!-- นักเรียนแยกห้อง -->
        <el-tab-pane label="👥 นักเรียนแยกห้อง" name="students">
          <div class="tab-body">
            <div class="class-pill-bar">
              <button v-for="c in myClasses" :key="c.class_id" class="class-pill"
                :class="{ active: activeClass === c.class_id }" @click="activeClass = c.class_id">
                {{ c.class_name || c.class_id }}
              </button>
            </div>
            <div class="stu-filters">
              <el-input v-model="searchText" placeholder="ค้นหาชื่อ..." clearable size="small" style="width:200px" />
              <el-select v-model="filterStatus" size="small" style="width:150px">
                <el-option label="ทั้งหมด" value="" />
                <el-option label="มีข้อมูลบ้าน" value="has_home" />
                <el-option label="ยังไม่มีข้อมูล" value="no_home" />
                <el-option label="เยี่ยมแล้ว" value="visited" />
                <el-option label="ยังไม่เยี่ยม" value="no_visit" />
              </el-select>
              <span class="stu-count">{{ filteredStudents.length }} คน</span>
            </div>
            <div v-loading="stuLoading" class="hv-list">
              <div v-for="s in filteredStudents" :key="s.student_code" class="hv-card" @click="openDetail(s)">
                <div class="hv-avatar" :class="s.lastVisit ? 'hv-av--visited' : 'hv-av--new'">{{ (s.first_name||'?')[0] }}</div>
                <div class="hv-card-body">
                  <div class="hv-card-name">{{ s.prefix }}{{ s.first_name }} {{ s.last_name }}</div>
                  <div class="hv-card-class">{{ s.class_id }}</div>
                  <div v-if="s.homeInfo && s.homeInfo.home_address" class="hv-card-addr">📍 {{ s.homeInfo.home_address.slice(0,55) }}</div>
                  <div v-else class="hv-card-no-addr">ยังไม่มีข้อมูลบ้าน</div>
                  <div v-if="s.lastVisit" class="hv-card-visited">✅ เยี่ยมล่าสุด {{ fmtDate(s.lastVisit.visit_date) }}</div>
                </div>
                <div class="hv-card-right">
                  <button v-if="s.homeInfo && s.homeInfo.home_lat" class="hv-nav-btn"
                    @click.stop="navigate(s.homeInfo.home_lat, s.homeInfo.home_lng)">🗺 นำทาง</button>
                  <span class="hv-arrow">›</span>
                </div>
              </div>
              <div v-if="!stuLoading && !filteredStudents.length" class="hv-empty">ไม่พบนักเรียน</div>
            </div>
          </div>
        </el-tab-pane>

        <!-- รอบเยี่ยมบ้าน -->
        <el-tab-pane label="🗓 รอบเยี่ยมบ้าน" name="rounds">
          <div class="tab-body">
            <div class="rounds-toolbar">
              <el-select v-model="roundClass" placeholder="เลือกห้อง" clearable size="small" style="width:160px" @change="loadRounds">
                <el-option v-for="c in myClasses" :key="c.class_id" :label="c.class_name||c.class_id" :value="c.class_id" />
              </el-select>
              <button v-if="isAdmin" class="btn-create-round" @click="openCreateRound">+ สร้างรอบใหม่</button>
              <span v-else class="rounds-teacher-note">ผู้ดูแลระบบเป็นผู้สร้างรอบเยี่ยมบ้าน</span>
            </div>
            <div v-loading="roundsLoading" class="rounds-list">
              <div v-for="r in filteredRounds" :key="r.id" class="round-card" @click="openRoundDetail(r)">
                <div class="rc-head">
                  <div>
                    <div class="rc-name">{{ r.round_name }}</div>
                    <div class="rc-class">ห้อง {{ r.class_id }}</div>
                  </div>
                  <div class="rc-dates">
                    <span v-if="r.date_start">{{ fmtDate(r.date_start) }}</span>
                    <span v-if="r.date_start && r.date_end"> – </span>
                    <span v-if="r.date_end">{{ fmtDate(r.date_end) }}</span>
                  </div>
                </div>
                <div class="rc-progress-row">
                  <div class="rc-progress"><div class="rc-bar" :style="`width:${roundPct(r)}%`"></div></div>
                  <span class="rc-count">{{ roundVisitCounts[r.id]||0 }}/{{ classStudentCount[r.class_id]||0 }} คน</span>
                </div>
                <div class="rc-footer">
                  <span class="rc-teacher">สร้างโดย {{ r.teacher_name }}</span>
                  <button v-if="isAdmin" class="rc-del" @click.stop="confirmDeleteRound(r)">🗑</button>
                </div>
              </div>
              <div v-if="!roundsLoading && !filteredRounds.length" class="hv-empty">ยังไม่มีรอบเยี่ยมบ้าน — กด "+ สร้างรอบใหม่"</div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- Student detail dialog -->
      <el-dialog v-model="detailVisible"
        :title="`🏠 ${selectedStudent ? selectedStudent.prefix : ''}${selectedStudent ? selectedStudent.first_name : ''} ${selectedStudent ? selectedStudent.last_name : ''}`"
        width="92%" destroy-on-close>
        <el-tabs v-model="detailTab">
          <el-tab-pane label="ข้อมูลบ้าน" name="info">
            <div v-if="homeInfoData" class="info-grid">
              <div v-if="homeInfoData.home_lat" class="info-map-row">
                <a :href="`https://www.google.com/maps/dir/?api=1&destination=${homeInfoData.home_lat},${homeInfoData.home_lng}`"
                   target="_blank" class="btn-nav-sm">🧭 นำทาง Google Maps</a>
              </div>
              <div v-if="homeInfoData.home_address" class="info-row"><b>ที่อยู่:</b> {{ homeInfoData.home_address }}</div>
              <div v-if="homeInfoData.house_type" class="info-row"><b>ประเภทบ้าน:</b> {{ homeInfoData.house_type }}</div>
              <div v-if="homeInfoData.household_income" class="info-row"><b>รายได้:</b> {{ homeInfoData.household_income }} บ./เดือน</div>
              <div v-if="homeInfoData.student_notes" class="info-row"><b>บันทึก:</b> {{ homeInfoData.student_notes }}</div>
              <div v-if="homeInfoData.family_members && homeInfoData.family_members.length" class="family-section">
                <div class="family-title">👨‍👩‍👧 คนในครอบครัว</div>
                <div v-for="(m,i) in homeInfoData.family_members" :key="i" class="member-row">
                  <span class="member-name">{{ m.name }}</span>
                  <span class="member-rel">{{ m.relation }}</span>
                  <span v-if="m.phone" class="member-phone">📞 {{ m.phone }}</span>
                </div>
              </div>
              <div v-if="homeInfoData.photo_urls && homeInfoData.photo_urls.length" class="photo-section">
                <div class="family-title">📷 ภาพบ้าน</div>
                <div class="photo-row">
                  <img v-for="(u,i) in homeInfoData.photo_urls" :key="i" :src="u" class="home-photo" @click="viewPhoto = u" />
                </div>
              </div>
              <el-collapse class="mt-3">
                <el-collapse-item title="✏️ กรอก/แก้ไขข้อมูลบ้าน (ครู)">
                  <!-- GPS -->
                  <label class="edit-label">📍 พิกัดบ้าน</label>
                  <button class="gps-btn" :class="{'gps-btn--ok': editHomeForm.home_lat}" :disabled="editHomeGpsLoading" @click="captureHomeGPS">
                    <span v-if="editHomeGpsLoading">⏳ กำลังดึง GPS...</span>
                    <span v-else-if="editHomeForm.home_lat">✅ {{ editHomeForm.home_lat?.toFixed(5) }}, {{ editHomeForm.home_lng?.toFixed(5) }} — กดอีกครั้งเพื่ออัปเดต</span>
                    <span v-else>🎯 บันทึกพิกัดบ้าน ณ จุดที่เยี่ยม</span>
                  </button>
                  <!-- ที่อยู่ -->
                  <label class="edit-label">ที่อยู่</label>
                  <textarea v-model="editHomeForm.home_address" class="edit-ta" rows="2" placeholder="เลขที่ หมู่ ถนน ตำบล อำเภอ จังหวัด"></textarea>
                  <!-- ประเภทบ้าน -->
                  <label class="edit-label">ประเภทที่อยู่อาศัย</label>
                  <div class="chip-row">
                    <button v-for="t in HOUSE_TYPES" :key="t" class="chip" :class="{'chip--active': editHomeForm.house_type === t}" @click="editHomeForm.house_type = t">{{ t }}</button>
                  </div>
                  <!-- รายได้ -->
                  <label class="edit-label">รายได้ครัวเรือน (บาท/เดือน)</label>
                  <div class="chip-row">
                    <button v-for="inc in INCOME_RANGES" :key="inc" class="chip" :class="{'chip--active': editHomeForm.household_income === inc}" @click="editHomeForm.household_income = inc">{{ inc }}</button>
                  </div>
                  <!-- คนในครอบครัว -->
                  <label class="edit-label">👨‍👩‍👧 คนในครอบครัว</label>
                  <div v-for="(m, i) in editHomeForm.family_members" :key="i" class="ef-member">
                    <div class="ef-member-top">
                      <input v-model="m.name" class="ef-input" placeholder="ชื่อ-นามสกุล" />
                      <button class="ef-del" @click="removeEditMember(i)">✕</button>
                    </div>
                    <div class="chip-row mt-1">
                      <button v-for="rel in RELATIONS" :key="rel" class="chip chip--sm"
                        :class="{'chip--active': m.relation === rel}" @click="m.relation = rel">{{ rel }}</button>
                    </div>
                    <div class="ef-row-2">
                      <input v-model="m.phone" class="ef-input" placeholder="เบอร์โทร" type="tel" />
                      <input v-model="m.occupation" class="ef-input" placeholder="อาชีพ" />
                    </div>
                  </div>
                  <button class="ef-add-btn" @click="addEditMember">+ เพิ่มสมาชิก</button>
                  <!-- รูปภาพบ้าน -->
                  <label class="edit-label mt-2">📷 ภาพบ้าน</label>
                  <div class="photo-row">
                    <div v-for="(url, i) in editHomeForm.photo_urls" :key="i" class="photo-wrap">
                      <img :src="url" class="home-photo" @click="viewPhoto = url" />
                      <button class="photo-del" @click="editHomeForm.photo_urls.splice(i, 1)">✕</button>
                    </div>
                    <label class="photo-add">
                      <input type="file" accept="image/*" multiple style="display:none" @change="onHomePhoto" />
                      <span>+</span>
                    </label>
                  </div>
                  <div v-if="editPhotoUploading" class="upload-hint">กำลังอัปโหลด...</div>
                  <!-- บันทึก -->
                  <label class="edit-label mt-2">บันทึกเพิ่มเติม</label>
                  <textarea v-model="editHomeForm.student_notes" class="edit-ta" rows="2" placeholder="ข้อมูลอื่นๆ ที่ควรรู้ก่อนเยี่ยม"></textarea>
                  <el-button type="primary" size="small" :loading="editSaving" class="mt-2" style="width:100%" @click="saveHomeEdit">💾 บันทึกข้อมูลบ้าน</el-button>
                </el-collapse-item>
              </el-collapse>
            </div>
            <div v-else class="hv-empty">นักเรียนยังไม่ได้กรอกข้อมูลบ้าน</div>
          </el-tab-pane>

          <el-tab-pane label="ประวัติเยี่ยม" name="history">
            <div v-if="visitHistory.length">
              <div v-for="v in visitHistory" :key="v.id" class="visit-record">
                <div class="vr-head">{{ fmtDate(v.visit_date) }} — {{ v.teacher_name }}</div>
                <div v-if="v.notes" class="vr-notes">{{ v.notes }}</div>
                <div v-if="v.family_present && v.family_present.length" class="vr-family">พบ: {{ v.family_present.join(', ') }}</div>
                <div v-if="v.visit_photo_urls && v.visit_photo_urls.length" class="photo-row mt-1">
                  <img v-for="(u,i) in v.visit_photo_urls" :key="i" :src="u" class="home-photo" @click="viewPhoto = u" />
                </div>
              </div>
            </div>
            <div v-else class="hv-empty">ยังไม่มีประวัติการเยี่ยม</div>
          </el-tab-pane>

          <el-tab-pane label="+ บันทึกการเยี่ยม" name="new">
            <div class="new-visit-form">
              <div class="nv-field">
                <label class="edit-label">วันที่เยี่ยม</label>
                <el-date-picker v-model="visitForm.visit_date" type="date" format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:100%" />
              </div>
              <div class="nv-field">
                <label class="edit-label">🗓 รอบเยี่ยมบ้าน (ถ้ามี)</label>
                <el-select v-model="visitForm.round_id" placeholder="ไม่ระบุรอบ" clearable style="width:100%" size="small">
                  <el-option v-for="r in availableRoundsForStudent" :key="r.id" :label="r.round_name" :value="r.id" />
                </el-select>
              </div>
              <div class="nv-field">
                <label class="edit-label">📍 GPS ณ จุดเยี่ยม</label>
                <button class="gps-btn" :class="{'gps-btn--ok':visitForm.visit_lat}" :disabled="visitGpsLoading" @click="captureVisitGPS">
                  <span v-if="visitGpsLoading">⏳ กำลังดึง GPS...</span>
                  <span v-else-if="visitForm.visit_lat">✅ {{ visitForm.visit_lat.toFixed(5) }}, {{ visitForm.visit_lng.toFixed(5) }}</span>
                  <span v-else>🎯 บันทึกตำแหน่งที่เยี่ยม</span>
                </button>
              </div>
              <div class="nv-field">
                <label class="edit-label">คนในบ้านที่พบ</label>
                <div class="chip-row">
                  <button v-for="m in (homeInfoData ? homeInfoData.family_members : [])" :key="m.name"
                    class="chip" :class="{'chip--active':visitForm.family_present.includes(m.name)}"
                    @click="togglePresent(m.name)">{{ m.name }} ({{ m.relation }})</button>
                </div>
                <el-input v-model="visitForm.custom_present" size="small" class="mt-1" placeholder="ระบุเพิ่มเติม" />
              </div>
              <div class="nv-field">
                <label class="edit-label">บันทึก / ข้อสังเกต</label>
                <textarea v-model="visitForm.notes" class="edit-ta" rows="4" placeholder="สภาพบ้าน ปัญหา สิ่งที่ต้องติดตาม..."></textarea>
              </div>
              <div class="nv-field">
                <label class="edit-label">📷 ภาพระหว่างเยี่ยม</label>
                <div class="photo-row">
                  <div v-for="(url,i) in visitForm.photo_urls" :key="i" class="photo-wrap">
                    <img :src="url" class="home-photo" />
                    <button class="photo-del" @click="visitForm.photo_urls.splice(i,1)">✕</button>
                  </div>
                  <label class="photo-add">
                    <input type="file" accept="image/*" multiple style="display:none" @change="onVisitPhoto" />
                    <span>+</span>
                  </label>
                </div>
                <div v-if="visitPhotoUploading" class="upload-hint">กำลังอัปโหลด...</div>
              </div>
              <el-button type="primary" :loading="visitSaving" style="width:100%;margin-top:8px" @click="submitVisit">
                💾 บันทึกการเยี่ยมบ้าน
              </el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-dialog>

      <!-- Round detail dialog -->
      <el-dialog v-model="roundDetailVisible"
        :title="`📋 ${selectedRound ? selectedRound.round_name : ''}`"
        width="92%" destroy-on-close>
        <div v-if="selectedRound" class="rd-body">
          <div class="rd-summary">
            <div class="rd-sum-row"><span class="rd-label">ห้อง:</span> {{ selectedRound.class_id }}</div>
            <div v-if="selectedRound.date_start || selectedRound.date_end" class="rd-sum-row">
              <span class="rd-label">ช่วงเวลา:</span>
              {{ selectedRound.date_start ? fmtDate(selectedRound.date_start) : '' }}{{ (selectedRound.date_start && selectedRound.date_end) ? ' – ' : '' }}{{ selectedRound.date_end ? fmtDate(selectedRound.date_end) : '' }}
            </div>
            <div v-if="selectedRound.notes" class="rd-sum-row"><span class="rd-label">หมายเหตุ:</span> {{ selectedRound.notes }}</div>
            <div class="rd-progress-row">
              <div class="rd-progress-bar"><div class="rd-bar-fill" :style="`width:${rdPct}%`"></div></div>
              <span class="rd-pct-text">เยี่ยมแล้ว {{ rdVisited.length }}/{{ rdTotal }} คน ({{ rdPct }}%)</span>
            </div>
          </div>
          <el-tabs v-model="rdTab">
            <el-tab-pane :label="`✅ เยี่ยมแล้ว (${rdVisited.length})`" name="visited">
              <div v-for="v in rdVisited" :key="v.student_code" class="rd-stu-row rd-stu-row--visited">
                <span class="rd-stu-name">{{ v.prefix }}{{ v.first_name }} {{ v.last_name }}</span>
                <span class="rd-stu-date">{{ fmtDate(v.visit_date) }}</span>
                <span class="rd-stu-by">{{ v.teacher_name }}</span>
              </div>
              <div v-if="!rdVisited.length" class="hv-empty">ยังไม่มีการบันทึกในรอบนี้</div>
            </el-tab-pane>
            <el-tab-pane :label="`⏳ ยังไม่เยี่ยม (${rdNotVisited.length})`" name="not_visited">
              <div v-for="s in rdNotVisited" :key="s.student_code" class="rd-stu-row">
                <span class="rd-stu-name">{{ s.prefix }}{{ s.first_name }} {{ s.last_name }}</span>
                <span v-if="s.homeInfo && s.homeInfo.home_lat" class="rd-home-badge">📍มีพิกัด</span>
                <span v-else class="rd-no-home-badge">ไม่มีข้อมูล</span>
                <button class="rd-record-btn" @click="openDetailFromRound(s)">บันทึก</button>
              </div>
              <div v-if="!rdNotVisited.length" class="hv-empty rd-all-done">🎉 เยี่ยมครบทุกคนในรอบนี้แล้ว!</div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-dialog>

      <!-- Create round dialog -->
      <el-dialog v-model="createRoundVisible" title="+ สร้างรอบเยี่ยมบ้าน" width="88%" destroy-on-close>
        <div class="cr-form">
          <div class="cr-field">
            <label class="edit-label">ห้องเรียน *</label>
            <el-select v-model="roundForm.class_id" placeholder="เลือกห้อง" style="width:100%">
              <el-option v-for="c in myClasses" :key="c.class_id" :label="c.class_name||c.class_id" :value="c.class_id" />
            </el-select>
          </div>
          <div class="cr-field">
            <label class="edit-label">ชื่อรอบ *</label>
            <el-input v-model="roundForm.round_name" placeholder="เช่น รอบที่ 1 ภาค 1/2568" />
          </div>
          <div class="cr-field">
            <label class="edit-label">วันที่เริ่ม – สิ้นสุด (ไม่บังคับ)</label>
            <el-date-picker v-model="roundDateRange" type="daterange" format="DD/MM/YYYY" value-format="YYYY-MM-DD"
              start-placeholder="เริ่ม" end-placeholder="สิ้นสุด" style="width:100%" />
          </div>
          <div class="cr-field">
            <label class="edit-label">หมายเหตุ</label>
            <el-input v-model="roundForm.notes" type="textarea" :rows="2" placeholder="เป้าหมาย บริบท ฯลฯ" />
          </div>
          <el-button type="primary" :loading="roundSaving" style="width:100%;margin-top:8px" @click="submitCreateRound">
            สร้างรอบเยี่ยมบ้าน
          </el-button>
        </div>
      </el-dialog>

      <div v-if="viewPhoto" class="photo-overlay" @click="viewPhoto = ''">
        <img :src="viewPhoto" class="photo-full" />
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useHomeVisit } from '@/composables/useHomeVisit'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useAuthStore } from '@/stores/auth'

const {
  getHomeInfo, saveHomeInfo, getVisits, saveVisit, uploadVisitPhoto,
  getStudentsWithHomeInfo, getDashboardStats,
  getRounds, createRound, deleteRound, getVisitsByRound, getRoundVisitCounts,
} = useHomeVisit()
const { getClasses } = useSchoolDb()
const authStore = useAuthStore()

const HOUSE_TYPES   = ['บ้านปูน', 'บ้านไม้', 'บ้านเช่า', 'ห้องเช่า/อพาร์ตเมนต์', 'อื่นๆ']
const INCOME_RANGES = ['ต่ำกว่า 5,000', '5,000–10,000', '10,000–20,000', '20,000–40,000', 'มากกว่า 40,000']
const RELATIONS     = ['พ่อ', 'แม่', 'ปู่/ย่า', 'ตา/ยาย', 'พี่', 'น้อง', 'ผู้ปกครอง', 'อื่นๆ']

const isAdmin = computed(() => authStore.isAdmin)
const teacherId = computed(() => String(authStore.profile?.teacher_id || authStore.profile?.uid || ''))

const classes = ref([])
const allStudents = ref([])
const mainTab = ref('dashboard')

const myClasses = computed(() => {
  if (isAdmin.value) return classes.value
  const tid = teacherId.value
  return classes.value.filter(c => (c.homeroom_teacher_ids || []).map(String).includes(tid))
})
const myDashStats = computed(() => {
  if (isAdmin.value) return dashStats.value
  const ids = new Set(myClasses.value.map(c => c.class_id))
  return dashStats.value.filter(cs => ids.has(cs.classId))
})

// ── Dashboard ──────────────────────────────────────────
const dashStats = ref([])
const dashLoading = ref(false)
const overall = computed(() => {
  const t = dashStats.value.reduce(
    (a, c) => ({ total: a.total + c.total, hasHome: a.hasHome + c.hasHome, visited: a.visited + c.visited }),
    { total: 0, hasHome: 0, visited: 0 }
  )
  return { ...t, noHome: t.total - t.hasHome, notVisited: t.total - t.visited }
})
function pct(n, d) { return d ? Math.round(n / d * 100) : 0 }

// ── Students tab ───────────────────────────────────────
const stuLoading = ref(false)
const activeClass = ref('')
const searchText = ref('')
const filterStatus = ref('')
const studentsInClass = computed(() => allStudents.value.filter(s => !activeClass.value || s.class_id === activeClass.value))
const filteredStudents = computed(() => {
  let list = studentsInClass.value
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(s => (s.first_name + s.last_name).toLowerCase().includes(q))
  }
  if (filterStatus.value === 'has_home') list = list.filter(s => s.homeInfo && (s.homeInfo.home_lat || s.homeInfo.home_address))
  if (filterStatus.value === 'no_home') list = list.filter(s => !s.homeInfo || (!s.homeInfo.home_lat && !s.homeInfo.home_address))
  if (filterStatus.value === 'visited') list = list.filter(s => s.lastVisit)
  if (filterStatus.value === 'no_visit') list = list.filter(s => !s.lastVisit)
  return list
})

// ── Rounds tab ─────────────────────────────────────────
const rounds = ref([])
const roundsLoading = ref(false)
const roundClass = ref('')
const roundVisitCounts = ref({})
const classStudentCount = computed(() => {
  const m = {}
  for (const c of dashStats.value) m[c.classId] = c.total
  return m
})
const filteredRounds = computed(() => {
  let list = isAdmin.value ? rounds.value : rounds.value.filter(r => myClasses.value.some(c => c.class_id === r.class_id))
  if (roundClass.value) list = list.filter(r => r.class_id === roundClass.value)
  return list
})
function roundPct(r) {
  const t = classStudentCount.value[r.class_id] || 0
  return t ? Math.round((roundVisitCounts.value[r.id] || 0) / t * 100) : 0
}

// ── Student detail ─────────────────────────────────────
const detailVisible = ref(false)
const detailTab = ref('info')
const selectedStudent = ref(null)
const homeInfoData = ref(null)
const visitHistory = ref([])
const editSaving = ref(false)
const editHomeGpsLoading = ref(false)
const editPhotoUploading = ref(false)
const editHomeForm = reactive({
  home_lat: null, home_lng: null,
  home_address: '', house_type: '', household_income: '',
  family_members: [], student_notes: '', photo_urls: [],
})
const visitSaving = ref(false)
const visitGpsLoading = ref(false)
const visitPhotoUploading = ref(false)
const visitForm = reactive({
  visit_date: new Date().toISOString().split('T')[0],
  round_id: '', visit_lat: null, visit_lng: null,
  family_present: [], custom_present: '', notes: '', photo_urls: [],
})
const availableRoundsForStudent = computed(() =>
  rounds.value.filter(r => !r.class_id || r.class_id === (selectedStudent.value && selectedStudent.value.class_id))
)

// ── Round detail ───────────────────────────────────────
const roundDetailVisible = ref(false)
const selectedRound = ref(null)
const rdTab = ref('not_visited')
const rdVisits = ref([])
const rdAllStudents = ref([])
const rdTotal = computed(() => rdAllStudents.value.length)
const rdVisitedCodes = computed(() => new Set(rdVisits.value.map(v => v.student_code)))
const rdVisited = computed(() => rdVisits.value.map(v => {
  const s = rdAllStudents.value.find(st => st.student_code === v.student_code) || {}
  return { ...s, visit_date: v.visit_date, teacher_name: v.teacher_name }
}))
const rdNotVisited = computed(() => rdAllStudents.value.filter(s => !rdVisitedCodes.value.has(s.student_code)))
const rdPct = computed(() => rdTotal.value ? Math.round(rdVisited.value.length / rdTotal.value * 100) : 0)

// ── Create round ───────────────────────────────────────
const createRoundVisible = ref(false)
const roundSaving = ref(false)
const roundDateRange = ref(null)
const roundForm = reactive({ class_id: '', round_name: '', notes: '' })
const viewPhoto = ref('')

// ── Helpers ────────────────────────────────────────────
function goToStudents(classId) { activeClass.value = classId; mainTab.value = 'students' }
function goToRounds(classId) { roundClass.value = classId; mainTab.value = 'rounds' }
function navigate(lat, lng) { window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank') }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '' }

// ── Data loading ───────────────────────────────────────
async function loadDashboard() {
  dashLoading.value = true
  try { dashStats.value = await getDashboardStats() }
  catch { ElMessage.error('โหลดแดชบอร์ดไม่สำเร็จ') }
  finally { dashLoading.value = false }
}
async function loadStudents() {
  stuLoading.value = true
  try { allStudents.value = await getStudentsWithHomeInfo(null) }
  catch { ElMessage.error('โหลดนักเรียนไม่สำเร็จ') }
  finally { stuLoading.value = false }
}
async function loadRounds() {
  roundsLoading.value = true
  try {
    const [r, counts] = await Promise.all([getRounds(roundClass.value || null), getRoundVisitCounts()])
    rounds.value = r; roundVisitCounts.value = counts
  }
  catch { ElMessage.error('โหลดรอบเยี่ยมบ้านไม่สำเร็จ') }
  finally { roundsLoading.value = false }
}
function onTabChange(tab) { if (tab === 'rounds' && !rounds.value.length) loadRounds() }

onMounted(async () => {
  const cls = await getClasses()
  classes.value = cls.filter(c => !c.is_schedule_only)
  await Promise.all([loadDashboard(), loadStudents(), loadRounds()])
  // default to first of myClasses (computed after classes loaded)
  if (myClasses.value.length) activeClass.value = myClasses.value[0].class_id
})

// ── Student detail actions ─────────────────────────────
async function openDetail(s) {
  selectedStudent.value = s; detailTab.value = 'info'; detailVisible.value = true
  homeInfoData.value = null; visitHistory.value = []; resetVisitForm()
  const [info, visits] = await Promise.all([getHomeInfo(s.student_code), getVisits(s.student_code)])
  homeInfoData.value = info; visitHistory.value = visits
  if (info) {
    editHomeForm.home_lat = info.home_lat || null
    editHomeForm.home_lng = info.home_lng || null
    editHomeForm.home_address = info.home_address || ''
    editHomeForm.house_type = info.house_type || ''
    editHomeForm.household_income = info.household_income || ''
    editHomeForm.family_members = JSON.parse(JSON.stringify(info.family_members || []))
    editHomeForm.student_notes = info.student_notes || ''
    editHomeForm.photo_urls = [...(info.photo_urls || [])]
  } else {
    Object.assign(editHomeForm, { home_lat: null, home_lng: null, home_address: '', house_type: '', household_income: '', family_members: [], student_notes: '', photo_urls: [] })
  }
}
async function saveHomeEdit() {
  editSaving.value = true
  try {
    await saveHomeInfo(selectedStudent.value.student_code, { ...editHomeForm })
    homeInfoData.value = { ...homeInfoData.value, ...editHomeForm }
    ElMessage.success('บันทึกข้อมูลบ้านแล้ว')
  } catch (e) { ElMessage.error(e.message) } finally { editSaving.value = false }
}
function captureHomeGPS() {
  if (!navigator.geolocation) { ElMessage.warning('ไม่รองรับ GPS'); return }
  editHomeGpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      editHomeForm.home_lat = parseFloat(pos.coords.latitude.toFixed(6))
      editHomeForm.home_lng = parseFloat(pos.coords.longitude.toFixed(6))
      editHomeGpsLoading.value = false; ElMessage.success('บันทึกพิกัดบ้านแล้ว')
    },
    err => { editHomeGpsLoading.value = false; ElMessage.error('GPS: ' + err.message) },
    { enableHighAccuracy: true, timeout: 15000 }
  )
}
function addEditMember() { editHomeForm.family_members.push({ name: '', relation: '', phone: '', occupation: '' }) }
function removeEditMember(i) { editHomeForm.family_members.splice(i, 1) }
async function onHomePhoto(e) {
  editPhotoUploading.value = true
  try {
    for (const f of [...(e.target.files || [])]) {
      editHomeForm.photo_urls.push(await uploadVisitPhoto(f, selectedStudent.value.student_code))
    }
  } catch (err) { ElMessage.error(err.message) }
  finally { editPhotoUploading.value = false; e.target.value = '' }
}
function captureVisitGPS() {
  if (!navigator.geolocation) { ElMessage.warning('ไม่รองรับ GPS'); return }
  visitGpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      visitForm.visit_lat = parseFloat(pos.coords.latitude.toFixed(6))
      visitForm.visit_lng = parseFloat(pos.coords.longitude.toFixed(6))
      visitGpsLoading.value = false
      ElMessage.success('บันทึกพิกัดแล้ว')
    },
    err => { visitGpsLoading.value = false; ElMessage.error('GPS: ' + err.message) },
    { enableHighAccuracy: true, timeout: 15000 }
  )
}
function togglePresent(name) {
  const i = visitForm.family_present.indexOf(name)
  if (i >= 0) visitForm.family_present.splice(i, 1)
  else visitForm.family_present.push(name)
}
async function onVisitPhoto(e) {
  visitPhotoUploading.value = true
  try {
    for (const f of [...(e.target.files || [])]) {
      visitForm.photo_urls.push(await uploadVisitPhoto(f, selectedStudent.value.student_code))
    }
  } catch (err) { ElMessage.error(err.message) }
  finally { visitPhotoUploading.value = false; e.target.value = '' }
}
async function submitVisit() {
  if (!visitForm.visit_date) { ElMessage.warning('กรุณาเลือกวันที่'); return }
  visitSaving.value = true
  try {
    const allPresent = [...visitForm.family_present]
    if (visitForm.custom_present.trim()) allPresent.push(visitForm.custom_present.trim())
    await saveVisit({
      studentCode: selectedStudent.value.student_code, classId: selectedStudent.value.class_id,
      visitDate: visitForm.visit_date, visitLat: visitForm.visit_lat, visitLng: visitForm.visit_lng,
      homeInfo: homeInfoData.value, familyPresent: allPresent,
      notes: visitForm.notes, photoUrls: visitForm.photo_urls, roundId: visitForm.round_id || null,
    })
    ElMessage.success('บันทึกการเยี่ยมบ้านเรียบร้อย')
    visitHistory.value = await getVisits(selectedStudent.value.student_code)
    const idx = allStudents.value.findIndex(s => s.student_code === selectedStudent.value.student_code)
    if (idx >= 0) allStudents.value[idx].lastVisit = { visit_date: visitForm.visit_date }
    roundVisitCounts.value = await getRoundVisitCounts()
    await loadDashboard()
    detailTab.value = 'history'; resetVisitForm()
  } catch (e) { ElMessage.error(e.message) } finally { visitSaving.value = false }
}
function resetVisitForm() {
  Object.assign(visitForm, {
    visit_date: new Date().toISOString().split('T')[0],
    round_id: '', visit_lat: null, visit_lng: null,
    family_present: [], custom_present: '', notes: '', photo_urls: [],
  })
}

// ── Round detail actions ───────────────────────────────
async function openRoundDetail(r) {
  selectedRound.value = r; rdTab.value = 'not_visited'; rdVisits.value = []; rdAllStudents.value = []
  roundDetailVisible.value = true
  const [visits, studs] = await Promise.all([getVisitsByRound(r.id), getStudentsWithHomeInfo(r.class_id)])
  rdVisits.value = visits; rdAllStudents.value = studs
}
function openDetailFromRound(s) {
  roundDetailVisible.value = false
  openDetail(s)
  setTimeout(() => { detailTab.value = 'new'; visitForm.round_id = (selectedRound.value && selectedRound.value.id) || '' }, 300)
}

// ── Create round actions ───────────────────────────────
function openCreateRound() {
  roundForm.class_id = roundClass.value || (myClasses.value[0] && myClasses.value[0].class_id) || ''
  roundForm.round_name = ''; roundForm.notes = ''; roundDateRange.value = null
  createRoundVisible.value = true
}
async function submitCreateRound() {
  if (!roundForm.class_id) { ElMessage.warning('กรุณาเลือกห้อง'); return }
  if (!roundForm.round_name) { ElMessage.warning('กรุณาใส่ชื่อรอบ'); return }
  roundSaving.value = true
  try {
    await createRound({
      classId: roundForm.class_id, roundName: roundForm.round_name,
      dateStart: roundDateRange.value && roundDateRange.value[0] || null,
      dateEnd: roundDateRange.value && roundDateRange.value[1] || null,
      notes: roundForm.notes,
    })
    ElMessage.success('สร้างรอบเยี่ยมบ้านแล้ว'); createRoundVisible.value = false; await loadRounds()
  } catch (e) { ElMessage.error(e.message) } finally { roundSaving.value = false }
}
async function confirmDeleteRound(r) {
  try {
    await ElMessageBox.confirm(`ลบรอบ "${r.round_name}" ?`, 'ยืนยันการลบ', {
      confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning',
    })
    await deleteRound(r.id); ElMessage.success('ลบรอบแล้ว'); await loadRounds()
  } catch {}
}
</script>

<style scoped>
.hv-page   { padding-bottom:80px; min-height:100vh; background:#f8f9ff; }
.hv-header { background:linear-gradient(135deg,#065f46,#059669); color:white; padding:20px 18px; }
.hv-title  { font-size:1.2rem; font-weight:700; margin:0; }
.hv-sub    { font-size:.82rem; opacity:.8; margin-top:3px; margin-bottom:0; }
.hv-tabs   { padding:0 12px; }
.tab-body  { padding:14px 0; }

.overall-stats { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px; }
.os-card { flex:1; min-width:55px; background:white; border-radius:14px; padding:12px 8px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,.07); }
.os-card--blue  { border-top:3px solid #3b82f6; }
.os-card--red   { border-top:3px solid #ef4444; }
.os-card--green { border-top:3px solid #10b981; }
.os-card--amber { border-top:3px solid #f59e0b; }
.os-n { display:block; font-size:1.3rem; font-weight:800; color:#1f2937; }
.os-l { display:block; font-size:.62rem; color:#6b7280; margin-top:2px; }

.class-grid { display:flex; flex-direction:column; gap:12px; }
.class-card { background:white; border-radius:16px; padding:14px; box-shadow:0 2px 8px rgba(0,0,0,.06); }
.cc-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.cc-name { font-weight:800; color:#065f46; font-size:1rem; }
.cc-total{ font-size:.8rem; color:#6b7280; }
.cc-progress { height:12px; background:#e5e7eb; border-radius:99px; overflow:hidden; position:relative; margin-bottom:8px; }
.cc-bar-home  { position:absolute; top:0; left:0; height:100%; background:#93c5fd; border-radius:99px; }
.cc-bar-visit { position:absolute; top:0; left:0; height:100%; background:#10b981; border-radius:99px; }
.cc-stats-row { display:flex; gap:12px; margin-bottom:10px; flex-wrap:wrap; }
.cc-stat { font-size:.77rem; font-weight:600; }
.cc-stat--blue  { color:#3b82f6; }
.cc-stat--green { color:#059669; }
.cc-actions { display:flex; gap:8px; }
.cc-btn { padding:5px 12px; border:none; border-radius:8px; font-size:.78rem; font-weight:600; cursor:pointer; background:#d1fae5; color:#065f46; }
.cc-btn--teal { background:#cffafe; color:#0e7490; }

.class-pill-bar { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
.class-pill { padding:6px 14px; border-radius:99px; border:1.5px solid #d1d5db; font-size:.8rem; background:white; cursor:pointer; }
.class-pill.active { background:#059669; border-color:#059669; color:white; font-weight:700; }
.stu-filters { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:12px; }
.stu-count { font-size:.78rem; color:#9ca3af; }

.hv-list { display:flex; flex-direction:column; gap:10px; }
.hv-card { background:white; border-radius:14px; padding:12px; display:flex; gap:10px; align-items:flex-start; box-shadow:0 2px 8px rgba(0,0,0,.06); cursor:pointer; }
.hv-avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1rem; font-weight:800; color:white; flex-shrink:0; }
.hv-av--visited { background:linear-gradient(135deg,#059669,#10b981); }
.hv-av--new     { background:linear-gradient(135deg,#6b7280,#9ca3af); }
.hv-card-body { flex:1; min-width:0; }
.hv-card-name { font-weight:700; font-size:.9rem; }
.hv-card-class { font-size:.74rem; color:#9ca3af; }
.hv-card-addr { font-size:.74rem; color:#4b5563; }
.hv-card-no-addr { font-size:.74rem; color:#d1d5db; font-style:italic; }
.hv-card-visited { font-size:.72rem; color:#059669; margin-top:2px; }
.hv-card-right { display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0; }
.hv-nav-btn { padding:4px 8px; background:#eff6ff; color:#3b82f6; border:none; border-radius:8px; font-size:.72rem; font-weight:600; cursor:pointer; white-space:nowrap; }
.hv-arrow { color:#d1d5db; }
.hv-empty { text-align:center; padding:30px; color:#d1d5db; font-size:.88rem; }

.rounds-teacher-note { font-size:.76rem; color:#9ca3af; font-style:italic; }
.rounds-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.btn-create-round { padding:8px 16px; background:linear-gradient(135deg,#065f46,#059669); color:white; border:none; border-radius:10px; font-size:.86rem; font-weight:700; cursor:pointer; }
.rounds-list { display:flex; flex-direction:column; gap:12px; }
.round-card { background:white; border-radius:16px; padding:14px; box-shadow:0 2px 8px rgba(0,0,0,.06); cursor:pointer; }
.round-card:hover { box-shadow:0 4px 16px rgba(6,95,70,.15); }
.rc-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
.rc-name { font-weight:800; font-size:.95rem; color:#065f46; }
.rc-class { font-size:.76rem; color:#6b7280; margin-top:2px; }
.rc-dates { font-size:.76rem; color:#9ca3af; text-align:right; }
.rc-progress-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.rc-progress { flex:1; height:10px; background:#e5e7eb; border-radius:99px; overflow:hidden; }
.rc-bar { height:100%; background:linear-gradient(90deg,#059669,#34d399); border-radius:99px; }
.rc-count { font-size:.8rem; font-weight:700; color:#065f46; white-space:nowrap; }
.rc-footer { display:flex; justify-content:space-between; align-items:center; }
.rc-teacher { font-size:.72rem; color:#9ca3af; }
.rc-del { background:none; border:none; font-size:.9rem; cursor:pointer; opacity:.4; padding:2px 6px; }
.rc-del:hover { opacity:1; }

.info-grid { display:flex; flex-direction:column; gap:8px; }
.info-map-row { margin-bottom:6px; }
.info-row { font-size:.86rem; color:#374151; padding:4px 0; border-bottom:1px solid #f3f4f6; }
.family-section, .photo-section { margin-top:10px; }
.family-title { font-weight:700; color:#065f46; font-size:.86rem; margin-bottom:6px; }
.member-row { display:flex; gap:8px; align-items:center; padding:4px 0; border-bottom:1px solid #f9fafb; flex-wrap:wrap; }
.member-name { font-weight:600; font-size:.83rem; }
.member-rel  { background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:99px; font-size:.72rem; }
.member-phone { font-size:.78rem; color:#6b7280; }
.btn-nav-sm { padding:7px 14px; background:#065f46; color:white; border:none; border-radius:10px; font-size:.82rem; font-weight:600; cursor:pointer; text-decoration:none; display:inline-block; }

.edit-label { display:block; font-size:.78rem; font-weight:600; color:#374151; margin-top:8px; margin-bottom:4px; }
.edit-ta { width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px; font-size:.84rem; box-sizing:border-box; }

.visit-record { background:#f0fdf4; border-radius:10px; padding:10px; margin-bottom:8px; }
.vr-head  { font-weight:700; color:#059669; font-size:.84rem; margin-bottom:4px; }
.vr-notes { font-size:.82rem; color:#374151; }
.vr-family { font-size:.78rem; color:#6b7280; margin-top:2px; }

.new-visit-form { display:flex; flex-direction:column; }
.nv-field { margin-bottom:10px; }
.gps-btn { width:100%; padding:10px; border-radius:10px; background:linear-gradient(135deg,#065f46,#059669); color:white; border:none; font-size:.84rem; font-weight:600; cursor:pointer; }
.gps-btn--ok { background:linear-gradient(135deg,#1d4ed8,#3b82f6); }
.chip-row { display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; }
.chip { padding:5px 11px; border-radius:99px; border:1.5px solid #d1d5db; font-size:.76rem; background:white; cursor:pointer; }
.chip--active { background:#059669; border-color:#059669; color:white; }
.photo-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.photo-wrap { position:relative; }
.home-photo { width:68px; height:68px; object-fit:cover; border-radius:10px; cursor:pointer; }
.photo-del { position:absolute; top:-5px; right:-5px; width:18px; height:18px; border-radius:50%; background:#ef4444; color:white; border:none; font-size:.6rem; cursor:pointer; }
.photo-add { width:68px; height:68px; border:2px dashed #a7f3d0; border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#059669; font-size:1.3rem; }
.upload-hint { font-size:.76rem; color:#6366f1; margin-top:3px; }

.rd-body { display:flex; flex-direction:column; gap:14px; }
.rd-summary { background:#f0fdf4; border-radius:14px; padding:14px; }
.rd-sum-row { font-size:.84rem; color:#374151; margin-bottom:4px; }
.rd-label { font-weight:700; margin-right:6px; color:#065f46; }
.rd-progress-row { margin-top:10px; display:flex; align-items:center; gap:10px; }
.rd-progress-bar { flex:1; height:12px; background:#e5e7eb; border-radius:99px; overflow:hidden; }
.rd-bar-fill { height:100%; background:linear-gradient(90deg,#059669,#34d399); border-radius:99px; transition:width .5s; }
.rd-pct-text { font-size:.8rem; font-weight:700; color:#065f46; white-space:nowrap; }
.rd-stu-row { display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid #f3f4f6; flex-wrap:wrap; }
.rd-stu-row--visited { background:#f0fdf4; border-radius:8px; padding:8px; margin-bottom:3px; border:none; }
.rd-stu-name { font-weight:600; font-size:.84rem; flex:1; }
.rd-stu-date { font-size:.76rem; color:#059669; }
.rd-stu-by { font-size:.74rem; color:#9ca3af; }
.rd-home-badge    { font-size:.72rem; background:#dbeafe; color:#1e40af; padding:2px 7px; border-radius:99px; }
.rd-no-home-badge { font-size:.72rem; background:#fef2f2; color:#dc2626; padding:2px 7px; border-radius:99px; }
.rd-record-btn { padding:4px 10px; background:#059669; color:white; border:none; border-radius:8px; font-size:.76rem; font-weight:700; cursor:pointer; margin-left:auto; }
.rd-all-done { color:#059669 !important; font-weight:700; }

.cr-form  { display:flex; flex-direction:column; gap:4px; }
.cr-field { margin-bottom:10px; }

.photo-overlay { position:fixed; inset:0; background:rgba(0,0,0,.88); z-index:9999; display:flex; align-items:center; justify-content:center; }
.photo-full { max-width:95vw; max-height:90vh; border-radius:10px; }
.mt-1 { margin-top:4px; } .mt-2 { margin-top:8px; } .mt-3 { margin-top:12px; }
.ef-member { background:#f9fafb; border-radius:10px; padding:10px; margin-bottom:8px; }
.ef-member-top { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
.ef-input { flex:1; padding:7px 10px; border:1px solid #e5e7eb; border-radius:8px; font-size:.82rem; min-width:0; }
.ef-del { background:#fee2e2; color:#dc2626; border:none; border-radius:8px; padding:5px 9px; cursor:pointer; font-size:.8rem; flex-shrink:0; }
.ef-row-2 { display:flex; gap:6px; margin-top:6px; }
.ef-add-btn { padding:6px 14px; border:1.5px dashed #a7f3d0; color:#059669; background:white; border-radius:8px; font-size:.8rem; cursor:pointer; margin-top:4px; }
</style>
