<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog">
      <h3>🔻 剩余扣减</h3>
      <div class="form-item"><label>楼栋</label><select v-model="houseId" class="input" @change="onHouseChange"><option value="">选择楼栋</option><option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option></select></div>
      <div class="form-item"><label>房间</label><select v-model="roomId" class="input" @change="loadBalance"><option value="">选择房间</option><option v-for="r in filteredRooms" :key="r.id" :value="r.id">{{ r.room_no }}</option></select></div>
      <div class="form-item"><label>当前余额</label><input :value="balance" class="input" disabled /></div>
      <div class="form-item"><label>扣减金额</label><input v-model.number="deduct" type="number" class="input" /></div>
      <div class="dialog-btns"><button class="btn" @click="$emit('close')">取消</button><button class="btn primary" @click="save">确认扣减</button></div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { houses, rooms, meters, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'
const emit = defineEmits(['close'])
const houseId = ref(''), roomId = ref(''), deduct = ref(0), balance = ref(0)
const filteredRooms = computed(() => houseId.value ? rooms.value.filter(r => String(r.house_id) === String(houseId.value)) : rooms.value)
function onHouseChange() { roomId.value = ''; balance.value = 0 }
function loadBalance() {
  const list = meters.value.filter(m => String(m.room_id) === String(roomId.value) && m.type === 'electric')
  balance.value = list.reduce((s, m) => s + (m.amount || 0), 0)
}
async function save() {
  if (!roomId.value || deduct.value <= 0) return alert('请选择房间并输入金额')
  await supabase.from('meters').insert({
    id: Date.now().toString(),
    room_id: roomId.value, type: 'electric', action: 'remain_deduct',
    amount: -deduct.value, balance: balance.value - deduct.value,
    date: new Date().toISOString().slice(0,10)
  })
  loadAll(); emit('close')
}
</script>