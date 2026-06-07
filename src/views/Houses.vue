<template>
  <div>
    <div class="page-head">
      <h2>🏠 房源管理</h2>
      <button class="btn" @click="showAddHouse = !showAddHouse">+ 楼栋</button>
    </div>

    <div v-if="showAddHouse" class="inline-form">
      <input v-model="newHouse" class="input" placeholder="楼栋名称" @keyup.enter="addHouse" />
      <button class="btn primary" @click="addHouse">确定</button>
      <button class="btn" @click="showAddHouse = false">取消</button>
    </div>

    <div v-if="!houses.length" class="empty">暂无楼栋，请添加</div>

    <div v-for="h in houseList" :key="h.id" class="card house-card">
      <div class="house-head" @click="expanded = expanded === h.id ? null : h.id">
        <strong>{{ h.address }}</strong>
        <span>{{ h.rooms.length }} 间 | 在住 {{ h.rentedCount }} | 空置 {{ h.vacantCount }} | 月租 ¥{{ h.monthlyRent }} | 押金 ¥{{ h.totalDeposit }}</span>
        <span style="margin-left:auto">{{ expanded === h.id ? '▲' : '▼' }}</span>
      </div>

      <div v-if="expanded === h.id">
        <div class="batch-row">
          <input v-model="batchStart" class="input" placeholder="起始" style="width:80px" />
          <span>-</span>
          <input v-model="batchEnd" class="input" placeholder="结束" style="width:80px" />
          <button class="btn primary" @click="batchAdd(h.id)">批量生成</button>
          <input v-model="newRoomNo" class="input" placeholder="或单个房号" style="width:90px" />
          <button class="btn" @click="addRoom(h.id)">+ 一间</button>
        </div>

        <table class="tbl" v-if="h.rooms.length">
          <thead><tr><th>房号</th><th>状态</th><th>租客</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="r in h.rooms" :key="r.id">
              <td>
                <span v-if="r.status === 'rented'">{{ r.roomNo }}</span>
                <input v-else v-model="r.roomNo" class="input" style="width:70px" @blur="updateRoom(r)" />
              </td>
              <td><span :class="['tag', r.status === 'rented' ? 'green' : 'gray']">{{ r.status === 'rented' ? '在住' : '空置' }}</span></td>
              <td>
                <span v-if="r.tenantName" class="link" @click="$emit('openDetail', r.tenantId)">{{ r.tenantName }}</span>
                <span v-else>-</span>
              </td>
              <td class="actions">
                <button v-if="r.status === 'vacant'" class="btn-sm green" @click="$emit('openCheckin', r.id)">入住</button>
                <button v-if="r.status === 'rented'" class="btn-sm warn" @click="$emit('openCheckout', r.tenantId)">退租</button>
                <button v-if="r.status === 'vacant'" class="btn-sm danger" @click="delRoom(r.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else style="color:#94a3b8;padding:8px 0">暂无房间</div>

        <button class="btn-sm danger" @click="delHouse(h.id)">删除楼栋</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { houses, rooms, tenants, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const emit = defineEmits(['openDetail', 'openCheckin', 'openCheckout'])
const expanded = ref(null)
const showAddHouse = ref(false)
const newHouse = ref('')
const newRoomNo = ref('')
const batchStart = ref('')
const batchEnd = ref('')

const houseList = computed(() => {
  return houses.value.map(house => {
    const houseRooms = []
    let vacantCount = 0, rentedCount = 0, monthlyRent = 0, totalDeposit = 0
    for (const room of rooms.value) {
      if (room.house_id !== house.id) continue
      let tenantName = '', tenantId = ''
      if (room.status === 'rented') {
        rentedCount++
        const t = tenants.value.find(x => x.room_id == room.id && x.status === 'renting')
        if (t) {
          tenantName = t.name; tenantId = t.id
          monthlyRent += Number(t.rent_amount) || 0
          totalDeposit += Number(t.deposit) || 0
        }
      } else { vacantCount++ }
      houseRooms.push({ id: room.id, roomNo: room.room_no, status: room.status === 'vacant' ? 'vacant' : 'rented', tenantName, tenantId })
    }
    houseRooms.sort((a, b) => {
      const na = parseInt(a.roomNo), nb = parseInt(b.roomNo)
      return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.roomNo.localeCompare(b.roomNo)
    })
    return { id: house.id, address: house.address, rooms: houseRooms, vacantCount, rentedCount, monthlyRent, totalDeposit }
  })
})

async function addHouse() {
  if (!newHouse.value.trim()) return alert('请输入楼栋名称')
  await supabase.from('houses').insert({ address: newHouse.value.trim() })
  newHouse.value = ''; showAddHouse.value = false; loadAll()
}

async function addRoom(hid) {
  if (!newRoomNo.value.trim()) return alert('请输入房号')
  await supabase.from('rooms').insert({ house_id: hid, room_no: newRoomNo.value.trim(), rent_amount: 0, deposit: 0, status: 'vacant' })
  newRoomNo.value = ''; loadAll()
}

async function batchAdd(hid) {
  const start = parseInt(batchStart.value), end = parseInt(batchEnd.value)
  if (isNaN(start) || isNaN(end) || start > end) return alert('请输入有效房号范围')
  const list = []
  for (let i = start; i <= end; i++) list.push({ house_id: hid, room_no: String(i), rent_amount: 0, deposit: 0, status: 'vacant' })
  await supabase.from('rooms').insert(list)
  batchStart.value = ''; batchEnd.value = ''; loadAll()
}

async function updateRoom(r) {
  if (!r.roomNo.trim()) return
  await supabase.from('rooms').update({ room_no: r.roomNo.trim() }).eq('id', r.id)
  loadAll()
}

async function delHouse(id) {
  const hasRented = rooms.value.some(r => r.house_id === id && r.status === 'rented')
  if (hasRented) return alert('该楼栋还有在住房间，无法删除')
  if (!confirm('删除楼栋及所有空置房间？')) return
  await supabase.from('rooms').delete().eq('house_id', id)
  await supabase.from('houses').delete().eq('id', id)
  loadAll()
}

async function delRoom(id) {
  if (!confirm('删除房间？')) return
  await supabase.from('rooms').delete().eq('id', id)
  loadAll()
}
</script>

<style scoped>
.inline-form, .batch-row { display: flex; gap: 8px; padding: 6px 0; align-items: center; flex-wrap: wrap; }
.actions { display: flex; gap: 4px; flex-wrap: wrap; }
.link { color: #1e6f5c; cursor: pointer; text-decoration: underline; }
.btn-sm.warn { color: #f59e0b; border-color: #fde68a; }
</style>