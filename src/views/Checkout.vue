<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:450px;max-height:90vh;overflow-y:auto">
      <h3>🧾 退租结算</h3>
      
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

      <div class="dialog-btns">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn danger" @click="confirmCheckout">确认退租</button>
      </div>

      <div class="mask" v-if="editingField" @click.self="editingField = ''">
        <div class="dialog" style="width:300px">
          <h3>修改金额</h3>
          <input v-model="editValue" type="number" class="input" />
          <div class="dialog-btns" style="margin-top:12px">
            <button class="btn" @click="editingField = ''">取消</button>
            <button class="btn primary" @click="confirmEdit">确定</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { tenants, rooms, houses, bills, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const props = defineProps({ tenantId: String })
const emit = defineEmits(['close'])

const tenant = ref({})
const address = ref('')
const deposit = ref(0)
const unpaidRent = ref(0)
const waterFee = ref(0)
const electricFee = ref(0)
const deductDeposit = ref(0)
const pendingBills = ref([])
const editingField = ref('')
const editValue = ref('')

const totalRefund = computed(() => {
  return deposit.value - unpaidRent.value - waterFee.value - electricFee.value - deductDeposit.value
})

onMounted(() => {
  const t = tenants.value.find(x => String(x.id) === String(props.tenantId))
  if (!t) return
  tenant.value = t

  const room = rooms.value.find(r => String(r.id) === String(t.room_id))
  const house = houses.value.find(h => String(h.id) === String(room?.house_id))
  address.value = `${house?.address || ''} ${room?.room_no || ''}`

  deposit.value = Number(t.deposit) || 0
  let water = 0, elec = 0, rent = 0
  const pending = []

  for (const b of bills.value) {
    if (String(b.tenant_id) === String(t.id) && b.status !== 'paid') {
      const unpaid = (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0)
      if (unpaid <= 0) continue
      pending.push({ id: b.id, category: b.category, amount: unpaid, billMonth: b.bill_month })
      if (b.category === '水费') water += unpaid
      else if (b.category === '电费') elec += unpaid
      else if (b.category !== '押金') rent += unpaid
    }
  }

  waterFee.value = water
  electricFee.value = elec
  unpaidRent.value = rent
  pendingBills.value = pending

  const endDate = t.end_date ? new Date(t.end_date) : null
  const today = new Date(); today.setHours(0,0,0,0)
  if (endDate) endDate.setHours(0,0,0,0)
  if (endDate && today < endDate) deductDeposit.value = deposit.value
})

function editField(field) {
  editingField.value = field
  const map = { deposit, unpaidRent, waterFee, electricFee, deductDeposit }
  editValue.value = String(map[field].value)
}

function confirmEdit() {
  const map = { deposit, unpaidRent, waterFee, electricFee, deductDeposit }
  map[editingField.value].value = parseFloat(editValue.value) || 0
  editingField.value = ''
}

async function confirmCheckout() {
  if (!confirm(`应退合计：¥${totalRefund.value.toFixed(2)}\n\n退租后房间将释放。确认执行？`)) return

  const t = tenant.value
  // 更新租客状态
  await supabase.from('tenants').update({ status: 'moved', move_out_time: new Date().toISOString() }).eq('id', t.id)
  // 释放房间
  await supabase.from('rooms').update({ status: '空置', tenant_id: null }).eq('id', t.room_id)
  // 记录退租结算支出
  await supabase.from('expends').insert({
    id: Date.now().toString(),
    type: '退租结算', amount: Math.abs(totalRefund.value),
    isincome: totalRefund.value < 0,
    time: new Date().toISOString(),
    roominfo: address.value, tenantname: t.name
  })

  loadAll()
  emit('close')
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