<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:500px;max-height:90vh;overflow-y:auto">
      <h3>🔻 剩余扣减</h3>

      <div class="tab-bar">
        <span :class="['tab-item', { active: meterType === 'water' }]" @click="switchType('water')">💧 水表</span>
        <span :class="['tab-item', { active: meterType === 'electric' }]" @click="switchType('electric')">⚡ 电表</span>
      </div>

      <div class="form-item"><label>表具</label><select v-model="selectedMeter" class="input" @change="onMeterChange"><option value="">选择表具</option><option v-for="m in meterList" :key="m.name" :value="m.name">{{ m.name }}（剩余 {{ m.lastReading }} · 倍率 {{ m.ratio }}）</option></select></div>
      <div class="form-item"><label>日期</label><input v-model="meterDate" type="date" class="input" /></div>
      <div class="form-item"><label>单价（元/{{ meterType === 'water' ? '吨' : '度' }}）</label><input v-model.number="unitPrice" type="number" step="0.1" class="input" @change="savePrice" /></div>
      <div class="form-item"><label>倍率</label><input :value="ratio" class="input" disabled /></div>
      <div class="form-item"><label>上期剩余度数</label><input :value="lastBalance" class="input" disabled /></div>
      <div class="form-item"><label>本期剩余度数</label><input v-model.number="currentBalance" type="number" class="input" @input="calc" /></div>
      <div class="form-item"><label>表显用量</label><input :value="tableUsage" class="input" disabled /></div>
      <div class="form-item"><label>实际用量（×倍率{{ ratio }}）</label><input :value="actualUsage" class="input" disabled /></div>
      <div class="total-line">金额：<strong>¥{{ amount.toFixed(2) }}</strong></div>

      <div class="dialog-btns">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn primary" @click="save">保存扣减</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { meters, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const emit = defineEmits(['close'])

const meterType = ref('water')
const meterDate = ref(new Date().toISOString().slice(0, 10))
const unitPrice = ref(5.0)
const selectedMeter = ref('')
const lastBalance = ref('0')
const currentBalance = ref('')
const tableUsage = ref(0)
const actualUsage = ref(0)
const amount = ref(0)
const ratio = ref(1)

const meterList = computed(() => {
  const map = {}
  for (const m of meters.value) {
    if (m.type !== meterType.value || !m.meter_name) continue
    const name = m.meter_name.trim()
    if (!map[name]) map[name] = { name, balance: 0, lastReading: 0, ratio: 1 }
  }
  for (const m of meters.value) {
    if (m.type !== meterType.value || !m.meter_name) continue
    const name = m.meter_name.trim()
    map[name].balance = m.balance || 0
    map[name].lastReading = m.current_reading || 0
    map[name].ratio = m.ratio || 1
  }
  return Object.values(map)
})

function switchType(type) {
  meterType.value = type
  unitPrice.value = parseFloat(localStorage.getItem('meterPrice_' + type) || (type === 'water' ? 5 : 1.5))
  selectedMeter.value = ''
  lastBalance.value = '0'
}

function savePrice() {
  localStorage.setItem('meterPrice_' + meterType.value, unitPrice.value.toString())
}

function onMeterChange() {
  const m = meterList.value.find(x => x.name === selectedMeter.value)
  if (m) {
    lastBalance.value = String(m.lastReading)
    ratio.value = m.ratio || 1
  }
  calc()
}

function calc() {
  const curr = parseFloat(currentBalance.value) || 0
  const last = parseFloat(lastBalance.value) || 0
  const tu = last - curr
  if (tu > 0) {
    tableUsage.value = tu
    actualUsage.value = tu * ratio.value
    amount.value = actualUsage.value * unitPrice.value
  } else {
    tableUsage.value = 0
    actualUsage.value = 0
    amount.value = 0
  }
}

async function save() {
  if (!selectedMeter.value) return alert('请选择表具')
  const curr = parseFloat(currentBalance.value) || 0
  const last = parseFloat(lastBalance.value) || 0
  if (curr >= last && last > 0) return alert('本期剩余不能大于上期')
  if (amount.value <= 0) return alert('用量为0，无需扣减')

  const m = meterList.value.find(x => x.name === selectedMeter.value)
  const newBalance = parseFloat(((m?.balance || 0) - amount.value).toFixed(2))
  const id = Date.now().toString()

  await supabase.from('meters').insert({
    id, type: meterType.value, meter_name: selectedMeter.value,
    date: meterDate.value, action: 'remain_deduct',
    amount: -amount.value, balance: Math.max(0, newBalance),
    current_reading: curr, usage: actualUsage.value,
    unit_price: unitPrice.value, ratio: ratio.value
  })

  await supabase.from('bills').insert({
    id: Date.now().toString(),
    category: meterType.value === 'water' ? '水费' : '电费',
    total_amount: amount.value, paid_amount: amount.value,
    status: 'paid', direction: 'expense',
    bill_month: meterDate.value.slice(0, 7),
    paid_time: new Date().toISOString(),
    tenant_name: selectedMeter.value,
    room_no: '剩余扣减' + actualUsage.value.toFixed(0) + (meterType.value === 'water' ? '吨' : '度')
  })

  loadAll(); emit('close')
}

switchType('water')
</script>

<style scoped>
.tab-bar { display: flex; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 10px; border-radius: 8px; font-size: 15px; cursor: pointer; }
.tab-item.active { background: white; font-weight: 600; }
.total-line { text-align: center; font-size: 18px; padding: 10px 0; }
</style>