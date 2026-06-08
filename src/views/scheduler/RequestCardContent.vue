<template>
  <div class="request-card-content">
    <div class="card-header">
      <div class="school-info">
        <h3>{{ request.schoolId }}</h3>
        <span class="request-id">{{ request.id }}</span>
      </div>
      <el-tag 
        :type="statusType(request.status)"
        effect="dark"
      >
        {{ statusLabel(request.status) }}
      </el-tag>
    </div>

    <div class="card-body">
      <!-- Parameters -->
      <div class="info-section">
        <span class="section-title">📊 ข้เทพาราเมตอร์</span>
        <div class="info-grid">
          <div class="info-item">
            <span class="key">ห้อง:</span>
            <span class="value">{{ request.calculationParams?.rooms }}</span>
          </div>
          <div class="info-item">
            <span class="key">วัน/สัป:</span>
            <span class="value">{{ request.calculationParams?.days }}</span>
          </div>
          <div class="info-item">
            <span class="key">คาบ/วัน:</span>
            <span class="value">{{ request.calculationParams?.periods }}</span>
          </div>
          <div class="info-item">
            <span class="key">ครู:</span>
            <span class="value">{{ request.calculationParams?.teachers }}</span>
          </div>
          <div class="info-item">
            <span class="key">ก.พร้อมกัน:</span>
            <span class="value">{{ request.calculationParams?.concurrent }}</span>
          </div>
          <div class="info-item">
            <span class="key">เดือน:</span>
            <span class="value">{{ request.calculationParams?.months }}</span>
          </div>
        </div>
      </div>

      <!-- Price -->
      <div class="info-section">
        <span class="section-title">💰 ราคา</span>
        <div class="price-grid">
          <div class="price-item">
            <span class="key">/เดือน</span>
            <span class="value">{{ currency(request.pricing?.monthlyPrice) }}</span>
          </div>
          <div class="price-item highlight">
            <span class="key">ยอดรวม</span>
            <span class="value">{{ currency(request.pricing?.totalPrice) }}</span>
          </div>
          <div class="price-item">
            <span class="key">ลด {{ request.pricing?.discountPercent }}%</span>
            <span class="value">{{ currency(request.pricing?.discount) }}</span>
          </div>
        </div>
      </div>

      <!-- Payment -->
      <div class="info-section" v-if="request.paymentEvidence">
        <span class="section-title">📄 การโอน</span>
        <div class="info-grid">
          <div class="info-item">
            <span class="key">วันที่:</span>
            <span class="value">{{ formatDate(request.paymentEvidence?.transferDate) }}</span>
          </div>
          <div class="info-item">
            <span class="key">จำนวน:</span>
            <span class="value">{{ currency(request.paymentEvidence?.amount) }}</span>
          </div>
        </div>
      </div>

      <!-- Meta -->
      <div class="info-section">
        <span class="section-title">ℹ️ เมตา</span>
        <div class="info-grid">
          <div class="info-item">
            <span class="key">ประเภท:</span>
            <span class="value">
              {{ request.renewalType === 'manual' ? 'ตั้งค่าเอง' : 'อัตโนมัติ' }}
            </span>
          </div>
          <div class="info-item">
            <span class="key">ขอเมื่อ:</span>
            <span class="value">{{ formatDate(request.requestedAt) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  request: {
    type: Object,
    required: true,
  },
  hideActions: {
    type: Boolean,
    default: false,
  },
})

function currency(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    ' บาท'
}

function formatDate(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function statusLabel(status) {
  const labels = {
    pending: 'รอการตรวจสอบ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธแล้ว',
    active: 'ใช้งานแล้ว',
  }
  return labels[status] || status
}

function statusType(status) {
  const types = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    active: 'success',
  }
  return types[status] || 'info'
}
</script>

<style scoped>
.request-card-content {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.school-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.school-info h3 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
}

.request-id {
  font-size: 12px;
  color: #64748b;
  font-family: monospace;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  font-size: 13px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #f8fafc;
  padding: 6px 8px;
  border-radius: 6px;
}

.info-item .key {
  font-size: 11px;
  color: #64748b;
}

.info-item .value {
  font-weight: 600;
  color: #0f172a;
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  font-size: 13px;
}

.price-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #fff7ed;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #fdba74;
}

.price-item .key {
  font-size: 11px;
  color: #92400e;
}

.price-item .value {
  font-weight: 700;
  color: #b45309;
}

.price-item.highlight {
  background: #d1fae5;
  border-color: #6ee7b7;
}

.price-item.highlight .key {
  color: #065f46;
}

.price-item.highlight .value {
  color: #059669;
}

@media (max-width: 700px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .info-grid,
  .price-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .info-grid,
  .price-grid {
    grid-template-columns: 1fr;
  }
}
</style>
