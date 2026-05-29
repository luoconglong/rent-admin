<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog">
      <h3>🏢 物业费设置</h3>
      <div class="form-item"><label>对象</label><select v-model="houseId" class="input"><option value="">整栋</option><option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option></select></div>
      <div class="form-item"><label>金额</label><input v-model.number="amount" type="number" class="input" /></div>
      <div class="form-item"><label>周期</label><select v-model="cycle" class="input"><option value="monthly">月付</option><option value="quarterly">季付</option><option value="yearly">年付</option></select></div>
      <div class="form-item"><label>交费日</label><input v-model.number="payDay" type="number" min="1" max="31" class="input" /></div>
      <div class="form-item"><label>提醒天数</label><input v-model.number="remindDays" type="number" class="input" /></div>
      <div class="dialog-btns"><button class="btn" @click="$emit('close')">取消</button><button class="btn primary" @click="save">保存</button></div>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { houses, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'
const emit = defineEmits(['close'])
const houseId = ref(''), amount = ref(0), cycle = ref('monthly'), payDay = ref(1), remindDays = ref(3)
async function save() {
  await supabase.from('property_settings').insert({
    id: Date.now().toString(),
    room_id: houseId.value, amount: amount.value,
    cycle: cycle.value, pay_day: payDay.value, remind_days: remindDays.value,
    next_pay_date: new Date().toISOString().slice(0,10)
  })
  loadAll(); emit('close')
}
</script>