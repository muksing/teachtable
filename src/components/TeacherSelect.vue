<template>
  <el-select
    :model-value="modelValue"
    :multiple="multiple"
    :collapse-tags="multiple"
    :collapse-tags-tooltip="multiple"
    :clearable="clearable"
    :disabled="disabled"
    :size="size"
    :placeholder="placeholder"
    :filter-method="filterMethod"
    :style="style"
    :class="cls"
    filterable
    popper-class="ts-popper"
    @update:model-value="$emit('update:modelValue', $event)"
    @change="$emit('change', $event)"
  >
    <!-- Selected value display: show photo + name in tag/trigger -->
    <template v-if="!multiple && selectedTeacher" #prefix>
      <img
        v-if="selectedTeacher.photo_url"
        :src="selectedTeacher.photo_url"
        class="ts-sel-photo"
        @error="e => e.target.style.display='none'"
      />
      <div v-else class="ts-sel-avatar">{{ initial(selectedTeacher) }}</div>
    </template>

    <!-- Options -->
    <el-option
      v-for="t in visibleList"
      :key="t.teacher_id"
      :value="t.teacher_id"
      :label="`${t.teacher_id} ${t.prefix || ''}${t.name} ${t.surname}`"
    >
      <div class="ts-row">
        <div class="ts-photo-wrap">
          <img
            v-if="t.photo_url"
            :src="t.photo_url"
            class="ts-photo"
            @error="e => e.target.style.display='none'"
          />
          <div v-else class="ts-avatar">{{ initial(t) }}</div>
        </div>
        <div class="ts-info">
          <span class="ts-code">{{ t.teacher_id }}</span>
          <span class="ts-name">{{ t.prefix || '' }}{{ t.name }} {{ t.surname }}</span>
        </div>
      </div>
    </el-option>

    <!-- Empty state -->
    <div v-if="!visibleList.length" class="ts-empty">
      {{ q ? `ไม่พบ "${q}"` : 'ไม่มีข้อมูลครู' }}
    </div>
  </el-select>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { default: null },
  teachers:   { type: Array, default: () => [] },
  multiple:   { type: Boolean, default: false },
  clearable:  { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
  size:       { type: String,  default: '' },
  placeholder:{ type: String,  default: 'เลือกครู...' },
  style:      { type: [String, Object], default: '' },
  cls:        { type: String,  default: 'w-full' },
})

defineEmits(['update:modelValue', 'change'])

const q = ref('')

const sortedTeachers = computed(() =>
  [...props.teachers].sort((a, b) => {
    const na = isNaN(a.teacher_id) ? a.teacher_id : String(a.teacher_id).padStart(6, '0')
    const nb = isNaN(b.teacher_id) ? b.teacher_id : String(b.teacher_id).padStart(6, '0')
    return na.localeCompare(nb, 'th')
  })
)

function filterMethod(val) { q.value = val }

const visibleList = computed(() => {
  if (!q.value) return sortedTeachers.value
  const s = q.value.toLowerCase()
  return sortedTeachers.value.filter(t =>
    String(t.teacher_id).includes(s) ||
    (t.name    || '').toLowerCase().includes(s) ||
    (t.surname || '').toLowerCase().includes(s) ||
    (t.prefix  || '').toLowerCase().includes(s)
  )
})

const selectedTeacher = computed(() => {
  if (!props.modelValue || props.multiple) return null
  return props.teachers.find(t => t.teacher_id === props.modelValue) || null
})

function initial(t) {
  return ((t.name || t.surname || '?').charAt(0)).toUpperCase()
}
</script>

<style>
/* ── Dropdown panel ────────────────────────────────────── */
.ts-popper .el-select-dropdown__item {
  padding: 6px 12px;
  height: auto;
}
.ts-popper .el-select-dropdown__item.selected .ts-code { color: #2563eb; }
</style>

<style scoped>
/* ── Selected value (trigger) ──────────────────────────── */
.ts-sel-photo,
.ts-sel-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
  margin-right: 2px; vertical-align: middle;
}
.ts-sel-avatar {
  background: linear-gradient(135deg,#6366f1,#a78bfa);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff;
}

/* ── Option row ────────────────────────────────────────── */
.ts-row {
  display: flex; align-items: center; gap: 10px; padding: 3px 0;
}
.ts-photo-wrap {
  width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
  flex-shrink: 0; background: linear-gradient(135deg,#6366f1,#a78bfa);
  border: 2px solid #e0e7ff;
  display: flex; align-items: center; justify-content: center;
}
.ts-photo { width: 100%; height: 100%; object-fit: cover; }
.ts-avatar { font-size: 14px; font-weight: 700; color: #fff; }

.ts-info {
  display: flex; flex-direction: column; gap: 1px; min-width: 0;
}
.ts-code {
  font-size: 11px; font-weight: 700; color: #4f46e5;
  letter-spacing: 0.5px; line-height: 1;
}
.ts-name {
  font-size: 14px; font-weight: 500; color: #0f172a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ── Empty ─────────────────────────────────────────────── */
.ts-empty {
  padding: 16px; text-align: center; font-size: 13px; color: #94a3b8;
}
</style>
