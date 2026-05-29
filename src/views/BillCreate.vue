<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:500px;max-height:90vh;overflow-y:auto">
      <h3>📋 生成账单</h3>

      <div class="form-item">
        <label>租客</label>
        <select v-model="form.tenantId" class="input" @change="onTenantChange">
          <option value="">选择租客</option>
          <option v-for="t in activeTenants" :key="t.id" :value="t.id">{{ t.name }} - {{ t.room_no }}</option>
        </select>
      </div>

      <div class="form-item">
        <label>账单月份</label>
        <input v-model="form.billMonth" type="month" class="input" @change="calcDateRange" />
      </div>

      <div class="form-row">
        <div class="form-item">
          <label>月租金</label>
          <input v-model.number="form.rentAmount" type="number" class="input" @input="calcTotal" />
        </div>
        <div class="form-item">
          <label>付款周期</label>
          <select v-model="form.paymentCycle" class="input" @change="onCycleChange">
            <option value="monthly">月付</option>
            <option value="quarterly">季付</option>
          </select>
        </div>
      </div>

      <div class="form-item">
        <label>日期范围</label>
        <input v-model="form.dateRange" class="input" readonly />
      </div>

      <div class="form-item" v-if="isFirst">
        <label>押金</label>
        <input v-model.number="form.deposit" type="number" class="input" @input="calcTotal" />
      </div>

      <div class="form-item">
        <label>水电费</label>
        <input v-model.number="form.utilityFee" type="number" class="input" @input="calcTotal" />
      </div>

      <div class="form-item">
        <label>车位费</label>
        <input v-model.number="form.parkingFee" type="number" class="input" @input="calcTotal" />
      </div>
      <div class="form-item">
        <label>水费押金</label>
        <input v-model.number="form.waterDeposit" type="number" class="input" @input="calcTotal" />
      </div>
      <div class="form-item">
        <label>房卡押金</label>
        <input v-model.number="form.cardDeposit" type="number" class="input" @input="calcTotal" />
      </div>

      <div v-for="(ef, i) in form.extraFees" :key="i" class="form-row">
        <div class="form-item">
          <label>{{ ef.name }}</label>
          <input v-model.number="ef.amount" type="number" class="input" @input="calcTotal" />
        </div>
        <button class="btn-sm danger" style="margin-top:18px" @click="form.extraFees.splice(i,1);calcTotal()">✕</button>
      </div>
      <button class="btn-sm" @click="addExtra">+ 添加费用</button>

      <div class="total-line">合计：<strong>¥{{ totalAmount }}</strong></div>

      <div class="form-item">
        <label>收款金额（0=待收）</label>
        <input v-model.number="form.paidAmount" type="number" class="input" />
      </div>

      <div class="dialog-btns">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn primary" @click="saveBill('pending')">生成待收</button>
        <button class="btn green" @click="saveBill('paid')">生成并收款</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { tenants, rooms, houses, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const emit = defineEmits(['close'])
const props = defineProps({ tenantId: String })

const form = reactive({
  tenantId: props.tenantId || '',
  billMonth: new Date().toISOString().slice(0, 7),
  rentAmount: 0,
  paymentCycle: 'monthly',
  dateRange: '',
  deposit: 0,
  utilityFee: 0,
  parkingFee: 0,
  waterDeposit: 0,
  cardDeposit: 0,
  extraFees: [],
  paidAmount: 0
})

const isFirst = ref(false)
const startDay = ref(new Date().getDate())

const activeTenants = computed(() => 
  tenants.value.filter(t => t.status === 'renting').map(t => ({
    ...t,
    room_no: rooms.value.find(r => String(r.id) === String(t.room_id))?.room_no || '-'
  }))
)

function onTenantChange() {
  const t = tenants.value.find(x => String(x.id) === String(form.tenantId))
  if (!t) return
  form.rentAmount = t.rent_amount || 0
  form.paymentCycle = t.payment_cycle || 'monthly'
  form.deposit = t.deposit || 0
  startDay.value = t.payment_day || new Date().getDate()
  calcDateRange()
  calcTotal()
}

function onCycleChange() {
  if (form.paymentCycle === 'quarterly') {
    form.rentAmount = (tenants.value.find(x => String(x.id) === String(form.tenantId))?.rent_amount || 0) * 3
  }
  calcTotal()
}

function calcDateRange() {
  const [y, m] = form.billMonth.split('-').map(Number)
  const sd = new Date(y, m - 1, startDay.value)
  const ed = new Date(y, m, startDay.value - 1)
  form.dateRange = `${String(m).padStart(2,'0')}-${String(sd.getDate()).padStart(2,'0')} 至 ${String(ed.getMonth()+1).padStart(2,'0')}-${String(ed.getDate()).padStart(2,'0')}`
}

const totalAmount = computed(() => {
  let t = (form.rentAmount || 0) + (form.deposit || 0) + (form.utilityFee || 0) + (form.parkingFee || 0) + (form.waterDeposit || 0) + (form.cardDeposit || 0)
  form.extraFees.forEach(e => t += e.amount || 0)
  return t.toFixed(2)
})

function calcTotal() {}

function addExtra() {
  const name = prompt('费用名称：')
  if (!name) return
  const amount = parseFloat(prompt('金额：') || '0')
  form.extraFees.push({ name, amount })
  calcTotal()
}

async function saveBill(status) {
  if (!form.tenantId) return alert('请选择租客')
  const t = tenants.value.find(x => String(x.id) === String(form.tenantId))
  const baseId = Date.now()
  const today = new Date().toISOString()
  const bills = []

  if (form.deposit > 0) {
    bills.push({ id: String(baseId++) + '_dep', tenant_id: form.tenantId, room_id: t.room_id, tenant_name: t.name, room_no: t.room_no, category: '押金', total_amount: form.deposit, paid_amount: status === 'paid' ? form.deposit : 0, status, bill_month: form.billMonth, paid_time: status === 'paid' ? today : null })
  }
  if (form.utilityFee > 0) {
    bills.push({ id: String(baseId++) + '_util', tenant_id: form.tenantId, room_id: t.room_id, tenant_name: t.name, room_no: t.room_no, category: '水电费', total_amount: form.utilityFee, paid_amount: status === 'paid' ? form.utilityFee : 0, status, bill_month: form.billMonth, paid_time: status === 'paid' ? today : null })
  }
  if (form.parkingFee > 0) {
    bills.push({ id: String(baseId++) + '_park', tenant_id: form.tenantId, room_id: t.room_id, tenant_name: t.name, room_no: t.room_no, category: '车位费', total_amount: form.parkingFee, paid_amount: status === 'paid' ? form.parkingFee : 0, status, bill_month: form.billMonth, paid_time: status === 'paid' ? today : null })
  }
  if (form.waterDeposit > 0) {
    bills.push({ id: String(baseId++) + '_wdep', tenant_id: form.tenantId, room_id: t.room_id, tenant_name: t.name, room_no: t.room_no, category: '水费押金', total_amount: form.waterDeposit, paid_amount: status === 'paid' ? form.waterDeposit : 0, status, bill_month: form.billMonth, paid_time: status === 'paid' ? today : null })
  }
  if (form.cardDeposit > 0) {
    bills.push({ id: String(baseId++) + '_cdep', tenant_id: form.tenantId, room_id: t.room_id, tenant_name: t.name, room_no: t.room_no, category: '房卡押金', total_amount: form.cardDeposit, paid_amount: status === 'paid' ? form.cardDeposit : 0, status, bill_month: form.billMonth, paid_time: status === 'paid' ? today : null })
  }
  if (form.rentAmount > 0) {
    bills.push({ id: String(baseId++) + '_rent', tenant_id: form.tenantId, room_id: t.room_id, tenant_name: t.name, room_no: t.room_no, category: '房租', total_amount: form.rentAmount, paid_amount: status === 'paid' ? form.rentAmount : 0, status, bill_month: form.billMonth, paid_time: status === 'paid' ? today : null })
  }
  for (const ef of form.extraFees) {
    bills.push({ id: String(baseId++) + '_extra', tenant_id: form.tenantId, room_id: t.room_id, tenant_name: t.name, room_no: t.room_no, category: ef.name, total_amount: ef.amount, paid_amount: status === 'paid' ? ef.amount : 0, status, bill_month: form.billMonth, paid_time: status === 'paid' ? today : null })
  }

  for (const b of bills) {
    await supabase.from('bills').insert(b)
  }
  loadAll()
  emit('close')
}
</script>

<style scoped>
.form-row { display: flex; gap: 12px; }
.form-row .form-item { flex: 1; }
.total-line { text-align: center; font-size: 18px; padding: 12px 0; }
.btn.green { background: #16a34a; color: white; border-color: #16a34a; }
</style>