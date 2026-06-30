<template>
  <div>
    <div class="page-head">
      <h2>🧾 退租结算</h2>
      <button class="btn" @click="$emit('close')">← 返回</button>
    </div>

    <div class="card" v-if="tenant.name">
      <!-- 基本信息 -->
      <div class="section">
        <div class="row"><span>租客</span><strong>{{ tenant.name }}</strong></div>
        <div class="row"><span>房间</span><span>{{ address }}</span></div>
        <div class="row" v-if="isEarly"><span>类型</span><span class="red">提前退租</span></div>
      </div>

      <!-- 费用明细 -->
      <div class="section">
        <h4 style="margin:0 0 8px">📋 费用明细</h4>
        <div class="row clickable" @click="editField('unpaidRent')">
          <span>🏠 未付房租</span><strong class="red">-¥{{ unpaidRent }}</strong>
        </div>
        <div class="row clickable" @click="editField('waterFee')">
          <span>💧 水费</span><strong class="red">-¥{{ waterFee }}</strong>
        </div>
        <div class="row clickable" @click="editField('electricFee')">
          <span>⚡ 电费</span><strong class="red">-¥{{ electricFee }}</strong>
        </div>
        <div class="row" style="border-top:1px solid #e8ecf1">
          <span>费用合计</span><strong class="red">-¥{{ totalFee.toFixed(2) }}</strong>
        </div>
      </div>

      <!-- 押金处理 -->
      <div class="section">
        <h4 style="margin:0 0 8px">💰 押金处理</h4>
        <div class="row">
          <span>押金</span><strong>+¥{{ deposit }}</strong>
        </div>
        <div class="row clickable" @click="editField('deductDeposit')">
          <span>⚠️ 扣除押金</span><strong class="red">-¥{{ deductDeposit }}</strong>
        </div>
        <div class="row" style="border-top:1px solid #e8ecf1">
          <span>退还押金</span><strong>+¥{{ depositRefund.toFixed(2) }}</strong>
        </div>
      </div>

      <!-- 待收账单明细 -->
      <div class="section" v-if="pendingBills.length">
        <h4 style="margin:0 0 8px">📝 待收账单明细</h4>
        <div class="row" v-for="b in pendingBills" :key="b.id">
          <span>{{ b.category }} ({{ b.billMonth }})</span><span class="red">-¥{{ b.amount }}</span>
        </div>
      </div>

      <div class="total-row">
        <span>应退合计</span>
        <strong :class="totalRefund >= 0 ? 'green' : 'red'">¥{{ totalRefund.toFixed(2) }}</strong>
      </div>
      <div v-if="totalRefund < 0" style="text-align:center;color:#dc2626;font-size:13px;margin-top:4px">
        租客需补交 ¥{{ Math.abs(totalRefund).toFixed(2) }}
      </div>

      <button class="btn danger" style="width:100%;margin-top:16px" @click="confirmCheckout">确认退租</button>
    </div>
    <div v-else class="empty">加载中...</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { tenants, rooms, houses, bills, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const props = defineProps({ tenantId: String })
const emit = defineEmits(['close'])

const tenant = ref({})
const address = ref('')
const deposit = ref(0), unpaidRent = ref(0), waterFee = ref(0), electricFee = ref(0), deductDeposit = ref(0)
const pendingBills = ref([])

const isEarly = computed(() => {
  const ed = tenant.value.end_date ? new Date(tenant.value.end_date) : null
  const today = new Date(); today.setHours(0,0,0,0)
  if (ed) ed.setHours(0,0,0,0)
  return ed && today < ed
})

const totalFee = computed(() => unpaidRent.value + waterFee.value + electricFee.value)
const depositRefund = computed(() => deposit.value - deductDeposit.value)
const totalRefund = computed(() => deposit.value - unpaidRent.value - waterFee.value - electricFee.value - deductDeposit.value)

function loadData() {
  if (!props.tenantId) return
  const t = tenants.value.find(x => String(x.id) === String(props.tenantId))
  if (!t) return
  tenant.value = t
  const room = rooms.value.find(r => String(r.id) === String(t.room_id))
  const house = houses.value.find(h => String(h.id) === String(room?.house_id))
  address.value = `${house?.address || ''} ${room?.room_no || ''}`

  deposit.value = Number(t.deposit) || 0
  let w = 0, e = 0, r = 0
  const pending = []
  for (const b of bills.value) {
    if (String(b.tenant_id) !== String(t.id) || b.status === 'paid') continue
    const unpaid = (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0)
    if (unpaid <= 0) continue
    if (b.category === '押金') continue
    pending.push({ id: b.id, category: b.category, amount: unpaid, billMonth: b.bill_month })
    if (b.category === '水费') w += unpaid
    else if (b.category === '电费') e += unpaid
    else if (b.category === '房租') r += unpaid
  }
  waterFee.value = w; electricFee.value = e; unpaidRent.value = r; pendingBills.value = pending
  deductDeposit.value = isEarly.value ? deposit.value : 0
}

watch(() => props.tenantId, loadData, { immediate: true })
watch(() => tenants.value.length, loadData)

async function confirmCheckout() {
  if (!confirm(`应退合计：¥${totalRefund.value.toFixed(2)}\n\n确认退租？`)) return
  const t = tenant.value
  const now = new Date().toISOString()
  const billMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0')

  await supabase.from('tenants').update({ status: 'moved' }).eq('id', t.id)
  await supabase.from('rooms').update({ status: 'vacant' }).eq('id', t.room_id)

  for (const b of pendingBills.value) {
    await supabase.from('bills').update({ status: 'paid', paid_amount: b.amount, paid_time: now }).eq('id', b.id)
  }

  // 退租结算：total >= 0 退钱=支出，total < 0 补收=收入
  const total = totalRefund.value
  const billAmount = total < 0 ? Math.abs(total) : total
  const direction = total < 0 ? 'income' : 'expense'

  await supabase.from('bills').insert({
    id: Date.now(),
    tenant_id: t.id,
    room_id: t.room_id,
    category: '退租结算',
    total_amount: billAmount,
    paid_amount: billAmount,
    status: 'paid',
    bill_month: billMonth,
    paid_time: now,
    direction: direction,
    tenant_name: t.name,
    room_no: address.value
  })

  loadAll()
  emit('close')
}

function editField(field) {
  const val = prompt('修改金额：', String({ deposit, unpaidRent, waterFee, electricFee, deductDeposit }[field].value))
  if (val !== null) {
    const map = { deposit, unpaidRent, waterFee, electricFee, deductDeposit }
    map[field].value = parseFloat(val) || 0
  }
}
</script>

<style scoped>
.section { margin: 12px 0; }
.section h4 { font-size: 13px; color: #666; }
.row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.row.clickable { cursor: pointer; }
.total-row { display: flex; justify-content: space-between; padding: 14px 0; font-size: 18px; border-top: 2px solid #e8ecf1; margin-top: 8px; }
.red { color: #dc2626; }
.green { color: #16a34a; }
.btn.danger { background: #dc2626; color: white; border-color: #dc2626; }
</style>