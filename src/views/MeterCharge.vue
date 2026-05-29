<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog">
      <h3>💰 电表充值</h3>
      <div class="form-item"><label>楼栋</label><select v-model="houseId" class="input" @change="onHouseChange"><option value="">选择楼栋</option><option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option></select></div>
      <div class="form-item"><label>房间</label><select v-model="roomId" class="input"><option value="">选择房间</option><option v-for="r in filteredRooms" :key="r.id" :value="r.id">{{ r.room_no }}</option></select></div>
      <div class="form-item"><label>金额</label><input v-model.number="amount" type="number" class="input" /></div>
      <div class="dialog-btns"><button class="btn" @click="$emit('close')">取消</button><button class="btn primary" @click="save">确认充值</button></div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { houses, rooms, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'
const emit = defineEmits(['close'])
const houseId = ref(''), roomId = ref(''), amount = ref(0)
const filteredRooms = computed(() => houseId.value ? rooms.value.filter(r => String(r.house_id) === String(houseId.value)) : rooms.value)
function onHouseChange() { roomId.value = '' }
async function save() {
  if (!roomId.value || amount.value <= 0) return alert('请选择房间并输入金额')
  await supabase.from('meters').insert({
    id: Date.now().toString(),
    room_id: roomId.value, type: 'electric', action: 'charge',
    amount: amount.value, balance: amount.value,
    date: new Date().toISOString().slice(0,10)
  })
  await supabase.from('expends').insert({
    id: Date.now().toString() + '_exp',
    type: '⚡电费充值', amount: amount.value, isincome: false,
    time: new Date().toISOString(),
    roominfo: rooms.value.find(r => String(r.id) === String(roomId.value))?.room_no || ''
  })
  loadAll(); emit('close')
}
</script>