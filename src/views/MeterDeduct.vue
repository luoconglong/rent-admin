<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:500px;max-height:90vh;overflow-y:auto">
      <h3>📝 抄表扣费</h3>

      <div class="tab-bar">
        <span :class="['tab-item', { active: meterType === 'water' }]" @click="switchType('water')">💧 水表</span>
        <span :class="['tab-item', { active: meterType === 'electric' }]" @click="switchType('electric')">⚡ 电表</span>
      </div>

      <div class="form-item"><label>抄表日期</label><input v-model="meterDate" type="date" class="input" /></div>
      <div class="form-item"><label>单价</label><input v-model.number="unitPrice" type="number" step="0.1" class="input" /></div>
      <div class="form-item"><label>上期读数</label><input :value="lastReading" class="input" disabled /></div>
      <div class="form-item"><label>本期读数</label><input v-model.number="currentReading" type="number" class="input" @input="calc" /></div>
      <div class="form-item"><label>用量</label><input :value="usage" class="input" disabled /></div>
      <div class="total-line">金额：<strong>¥{{ amount.toFixed(2) }}</strong></div>

      <div class="dialog-btns">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn primary" @click="save">保存记录</button>
      </div>

      <div v-if="records.length" style="margin-top:16px">
        <h4>历史记录</h4>
        <div v-for="r in records" :key="r.id" class="record-row">
          <span>{{ r.date?.slice(0,10) }}</span>
          <span>{{ r.last_reading }} → {{ r.current_reading }}</span>
          <span>{{ r.usage }}{{ meterType === 'water' ? '吨' : '度' }}</span>
          <span>¥{{ r.amount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { meters, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const emit = defineEmits(['close'])

const meterType = ref('water')
const meterDate = ref(new Date().toISOString().slice(0, 10))
const unitPrice = ref(5.0)
const lastReading = ref(0)
const currentReading = ref('')
const usage = ref(0)
const amount = ref(0)
const records = ref([])

function switchType(type) {
  meterType.value = type
  unitPrice.value = parseFloat(localStorage.getItem('meterPrice_' + type) || (type === 'water' ? 5 : 1.5))
  loadLast()
}

async function loadLast() {
  const list = meters.value.filter(m => m.type === meterType.value)
  lastReading.value = list.length ? (list[list.length - 1].currentreading || 0) : 0
  records.value = [...list].reverse().slice(0, 10)
  calc()
}

function calc() {
  const curr = parseFloat(currentReading.value) || 0
  usage.value = Math.max(0, curr - lastReading.value)
  amount.value = usage.value * unitPrice.value
}

async function save() {
  const curr = parseFloat(currentReading.value) || 0
  const last = parseFloat(lastReading.value) || 0
  const isFirst = !records.value.length
  if (!isFirst && curr <= last) return alert('本期读数需大于上期')

  await supabase.from('meters').insert({
    id: Date.now().toString(),
    type: meterType.value,
    date: meterDate.value,
    lastreading: last,
    currentreading: curr,
    usage: usage.value,
    unitprice: unitPrice.value,
    amount: amount.value
  })

  await supabase.from('expends').insert({
    id: Date.now().toString() + '_exp',
    type: meterType.value === 'water' ? '💧水费扣费' : '⚡电费扣费',
    amount: amount.value, isincome: false,
    time: meterDate.value
  })

  localStorage.setItem('meterPrice_' + meterType.value, unitPrice.value.toString())
  loadAll()
  emit('close')
}

switchType('water')
</script>

<style scoped>
.tab-bar { display: flex; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 10px; border-radius: 8px; font-size: 15px; cursor: pointer; }
.tab-item.active { background: white; font-weight: 600; }
.total-line { text-align: center; font-size: 18px; padding: 10px 0; }
.record-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; color: #64748b; border-bottom: 1px solid #f1f5f9; }
</style>