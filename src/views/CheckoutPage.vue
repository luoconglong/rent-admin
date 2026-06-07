<template>
  <div>
    <div class="page-head">
      <h2>🧾 退租结算</h2>
      <button class="btn" @click="$emit('close')">← 返回</button>
    </div>

    <div class="card" v-if="tenant.name">
      <div class="section">
        <div class="row"><span>租客</span><strong>{{ tenant.name }}</strong></div>
        <div class="row"><span>房间</span><span>{{ address }}</span></div>
      </div>

      <div class="section">
        <div class="row clickable" @click="editField('deposit')"><span>💰 押金</span><strong>+¥{{ deposit }}</strong></div>
        <div class="row clickable" @click="editField('deductDeposit')"><span>⚠️ 提前退租扣除</span><strong class="red">-¥{{ deductDeposit }}</strong></div>
        <div class="row clickable" @click="editField('unpaidRent')"><span>🏠 未付房租</span><strong class="red">-¥{{ unpaidRent }}</strong></div>
        <div class="row clickable" @click="editField('waterFee')"><span>💧 水费</span><strong class="red">-¥{{ waterFee }}</strong></div>
        <div class="row clickable" @click="editField('electricFee')"><span>⚡ 电费</span><strong class="red">-¥{{ electricFee }}</strong></div>
      </div>

      <div class="section" v-if="pendingBills.length">
        <div class="row" v-for="b in pendingBills" :key="b.id">
          <span>{{ b.category }} ({{ b.billMonth }})</span><span class="red">-¥{{ b.amount }}</span>
        </div>
      </div>

      <div class="total-row">
        <span>应退合计</span>
        <strong :class="totalRefund >= 0 ? 'green' : 'red'">¥{{ totalRefund.toFixed(2) }}</strong>
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
    pending.push({ id: b.id, category: b.category, amount: unpaid, billMonth: b.bill_month })
    if (b.category === '水费') w += unpaid
    else if (b.category === '电费') e += unpaid
    else if (b.category !== '押金') r += unpaid
  }
  waterFee.value = w; electricFee.value = e; unpaidRent.value = r; pendingBills.value = pending
  const ed = t.end_date ? new Date(t.end_date) : null
  const today = new Date(); today.setHours(0,0,0,0)
  if (ed) ed.setHours(0,0,0,0)
  deductDeposit.value = (ed && today < ed) ? deposit.value : 0
}

watch(() => props.tenantId, loadData, { immediate: true })
watch(() => tenants.value.length, loadData)

async function confirmCheckout() {
  if (!confirm(`应退合计：¥${totalRefund.value.toFixed(2)}\n\n确认退租？`)) return
  const t = tenant.value
  await supabase.from('tenants').update({ status: 'moved', move_out_time: new Date().toISOString() }).eq('id', t.id)
  await supabase.from('rooms').update({ status: 'vacant', tenant_id: null }).eq('id', t.room_id)
  await supabase.from('expends').insert({
    type: '退租结算', amount: Math.abs(totalRefund.value),
    is_income: totalRefund.value < 0, time: new Date().toISOString(),
    room_info: address.value, tenant_name: t.name
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
.row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.row.clickable { cursor: pointer; }
.total-row { display: flex; justify-content: space-between; padding: 14px 0; font-size: 18px; border-top: 2px solid #e8ecf1; margin-top: 8px; }
.red { color: #dc2626; }
.green { color: #16a34a; }
.btn.danger { background: #dc2626; color: white; border-color: #dc2626; }
</style>