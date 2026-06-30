<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog">
      <h3>💰 {{ meterType === 'water' ? '水表' : '电表' }}充值</h3>
      <div class="form-item"><label>表具</label><select v-model="selectedMeter" class="input"><option value="">选择表具</option><option v-for="m in meterList" :key="m.name" :value="m.name">{{ m.name }}（余额 ¥{{ m.balance }}）</option></select></div>
      <div class="form-item"><label>金额</label><input v-model.number="amount" type="number" class="input" /></div>
      <div class="dialog-btns"><button class="btn" @click="$emit('close')">取消</button><button class="btn primary" @click="save">确认充值</button></div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { meters, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const props = defineProps({ meterType: { type: String, default: 'electric' } })
const emit = defineEmits(['close'])

const selectedMeter = ref('')
const amount = ref(0)

const meterList = computed(() => {
  const map = {}
  for (const m of meters.value) {
    if (m.type !== props.meterType || !m.meter_name) continue
    const name = m.meter_name.trim()
    if (!map[name]) map[name] = { name, balance: 0, lastReading: 0, ratio: 1 }
  }
  for (const m of meters.value) {
    if (m.type !== props.meterType || !m.meter_name) continue
    const name = m.meter_name.trim()
    map[name].balance = m.balance || 0
    map[name].lastReading = m.current_reading || 0
    map[name].ratio = m.ratio || 1
  }
  return Object.values(map)
})

async function save() {
  if (!selectedMeter.value || amount.value <= 0) return alert('请选择表具并输入金额')
  const m = meterList.value.find(x => x.name === selectedMeter.value)
  if (!m) return
  const price = parseFloat(localStorage.getItem('meterPrice_' + props.meterType) || (props.meterType === 'water' ? 5 : 1.5))
  const ratio = m.ratio || 1
  const addedReading = amount.value / (price * ratio)
  const newBalance = parseFloat(((m.balance || 0) + amount.value).toFixed(2))
  const newReading = parseFloat(((m.lastReading || 0) + addedReading).toFixed(2))

  await supabase.from('meters').insert({
    id: Date.now().toString(),
    type: props.meterType, meter_name: selectedMeter.value,
    action: 'charge', amount: amount.value, balance: newBalance,
    current_reading: newReading, unit_price: price, ratio: ratio,
    date: new Date().toISOString().slice(0, 10)
  })
  loadAll(); emit('close')
}
</script>