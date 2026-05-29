<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="drawer">
      <div class="drawer-head">
        <h3>{{ tenant.name }}</h3>
        <button class="btn-sm" @click="$emit('close')">✕</button>
      </div>

      <!-- 基本信息 -->
      <div class="detail-section">
        <div class="detail-row"><span>手机号</span><span>{{ tenant.phone }}</span></div>
        <div class="detail-row"><span>房间</span><span>{{ houseName }} {{ roomNo }}</span></div>
        <div class="detail-row"><span>月租金</span><span>¥{{ tenant.rent_amount }}</span></div>
        <div class="detail-row"><span>押金</span><span>¥{{ tenant.deposit }}</span></div>
        <div class="detail-row"><span>入住</span><span>{{ tenant.start_date }}</span></div>
        <div class="detail-row"><span>到期</span><span>{{ tenant.end_date }} <span :class="remainClass">{{ remainText }}</span></span></div>
        <div class="detail-row"><span>付款日</span><span>每月{{ tenant.payment_day }}号</span></div>
        <div class="detail-row"><span>水表底数</span><span>{{ waterReading }}</span></div>
        <div class="detail-row"><span>电表底数</span><span>{{ electricReading }}</span></div>
      </div>

      <!-- 待收账单 -->
      <div class="detail-section" v-if="pendingBills.length">
        <h4>待收账单 ({{ pendingBills.length }})</h4>
        <div v-for="b in pendingBills" :key="b.id" class="bill-row">
          <span>{{ b.category }} {{ b.bill_month }}</span>
          <span>¥{{ b.total_amount }}</span>
          <button class="btn-sm green" @click="doPay(b.id)">收款</button>
        </div>
      </div>

      <!-- 已收账单 -->
      <div class="detail-section" v-if="paidBills.length">
        <h4>已收账单 ({{ paidBills.length }})</h4>
        <div v-for="b in paidBills" :key="b.id" class="bill-row">
          <span>{{ b.category }} {{ b.bill_month }}</span>
          <span>¥{{ b.total_amount }}</span>
          <span style="font-size:12px;color:#64748b">{{ formatTime(b.paid_time) }}</span>
        </div>
      </div>

      <div class="drawer-actions">
        <button class="btn" @click="$emit('billCreate')">生成账单</button>
        <button class="btn" @click="goMeter('water')">水表抄表</button>
        <button class="btn" @click="goMeter('electric')">电表抄表</button>
        <button class="btn danger" @click="$emit('checkout', tenant.id)">退租</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { tenants, rooms, houses, bills, meters, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const props = defineProps({ tenantId: String })
const emit = defineEmits(['close', 'checkout', 'billCreate'])

const tenant = ref({})
const roomNo = ref('')
const houseName = ref('')
const waterReading = ref('-')
const electricReading = ref('-')

const remainClass = computed(() => {
  if (!tenant.value.end_date) return ''
  const d = new Date(tenant.value.end_date); d.setHours(0,0,0,0)
  const diff = Math.ceil((d - new Date()) / 86400000)
  if (diff < 0) return 'red'
  if (diff <= 30) return 'warn'
  return 'green'
})

const remainText = computed(() => {
  if (!tenant.value.end_date) return ''
  const d = new Date(tenant.value.end_date); d.setHours(0,0,0,0)
  const diff = Math.ceil((d - new Date()) / 86400000)
  if (diff < 0) return `(超期${-diff}天)`
  if (diff === 0) return '(今天到期)'
  return `(剩${diff}天)`
})

const pendingBills = computed(() => {
  return bills.value.filter(b => String(b.tenant_id) === String(props.tenantId) && b.status === 'pending')
})

const paidBills = computed(() => {
  return bills.value.filter(b => String(b.tenant_id) === String(props.tenantId) && b.status === 'paid')
})

function loadTenant() {
  const t = tenants.value.find(x => String(x.id) === String(props.tenantId))
  if (!t) return
  tenant.value = t
  const r = rooms.value.find(x => String(x.id) === String(t.room_id))
  roomNo.value = r?.room_no || ''
  houseName.value = houses.value.find(h => String(h.id) === String(r?.house_id))?.address || ''

  // 从 meters 表读取最新水/电底数
  const waterMeter = meters.value.filter(m => String(m.room_id) === String(t.room_id) && m.type === 'water').pop()
  const electricMeter = meters.value.filter(m => String(m.room_id) === String(t.room_id) && m.type === 'electric').pop()
  waterReading.value = waterMeter ? (waterMeter.currentreading || waterMeter.currentReading || '-') : (t.water_reading || '-')
  electricReading.value = electricMeter ? (electricMeter.currentreading || electricMeter.currentReading || '-') : (t.electric_reading || '-')
}

async function doPay(id) {
  await supabase.from('bills').update({
    status: 'paid', paid_amount: bills.value.find(x => x.id === id)?.total_amount || 0, paid_time: new Date().toISOString()
  }).eq('id', id)
  loadAll()
  loadTenant()
}

function goMeter(type) {
  alert('跳转到抄表页面：' + type)
}

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleDateString('zh-CN')
}

onMounted(loadTenant)
</script>

<style scoped>
.drawer { position: fixed; right: 0; top: 0; width: 420px; max-width: 90%; height: 100%; background: white; z-index: 201; overflow-y: auto; padding: 20px; box-shadow: -4px 0 20px rgba(0,0,0,0.1); }
.drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.detail-section { margin-bottom: 16px; }
.detail-section h4 { font-size: 14px; margin-bottom: 8px; color: #1e6f5c; }
.detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.detail-row span:first-child { color: #64748b; }
.bill-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.drawer-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.btn.danger { color: #dc2626; border-color: #fecaca; }
.red { color: #dc2626; }
.warn { color: #f59e0b; }
.green { color: #16a34a; }
</style>