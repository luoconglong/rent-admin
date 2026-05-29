<!-- src/views/Houses.vue -->
<template>
  <div>
    <div class="page-head">
      <h2>🏠 房源管理</h2>
      <div class="head-btns">
        <button class="btn" @click="$emit('openDialog', 'house')">+ 楼栋</button>
        <button class="btn primary" @click="$emit('openDialog', 'room')">+ 房间</button>
      </div>
    </div>
    <div v-for="h in houses" :key="h.id" class="card house-card">
      <div class="house-head" @click="toggleHouse(h.id)" style="cursor:pointer">
        <div class="house-info">
          <strong>{{ h.address }}</strong>
          <span v-if="h.detail_address" style="font-size:12px;color:#64748b;display:block">{{ h.detail_address }}</span>
        </div>
        <div class="house-stats">
          <span>{{ getRooms(h.id).length }} 间 | 在住 {{ getRenting(h.id) }} | 空置 {{ getVacant(h.id) }}</span>
          <span>月租 ¥{{ getRentTotal(h.id) }} | 押金 ¥{{ getDepositTotal(h.id) }}</span>
        </div>
        <span>{{ expanded === h.id ? '▲' : '▼' }}</span>
      </div>
      <table class="tbl" v-if="expanded === h.id && getRooms(h.id).length">
        <thead><tr><th>房号</th><th>状态</th><th>月租</th><th>押金</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="r in getRooms(h.id)" :key="r.id">
            <td>{{ r.room_no }}</td>
            <td><span :class="['tag', r.status === '在住' ? 'green' : 'gray']">{{ r.status }}</span></td>
            <td>¥{{ r.rent_amount || 0 }}</td>
            <td>¥{{ r.deposit || 0 }}</td>
            <td><button class="btn-sm" @click="delRoom(r.id)">删除</button></td>
          </tr>
        </tbody>
      </table>
      <div class="house-actions" v-if="expanded === h.id">
        <button class="btn-sm danger" @click="delHouse(h.id)">删除楼栋</button>
      </div>
    </div>
    <div v-if="!houses.length" class="empty">暂无楼栋，请添加</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { houses, rooms, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const expanded = ref(null)

function toggleHouse(id) {
  expanded.value = expanded.value === id ? null : id
}

function getRooms(hid) { return rooms.value.filter(r => r.house_id === hid) }
function getRenting(hid) { return rooms.value.filter(r => r.house_id === hid && r.status === '在住').length }
function getVacant(hid) { return rooms.value.filter(r => r.house_id === hid && r.status === '空置').length }
function getRentTotal(hid) { return rooms.value.filter(r => r.house_id === hid).reduce((s, r) => s + (Number(r.rent_amount) || 0), 0) }
function getDepositTotal(hid) { return rooms.value.filter(r => r.house_id === hid).reduce((s, r) => s + (Number(r.deposit) || 0), 0) }

async function delHouse(id) {
  if (!confirm('删除楼栋及所有房间？')) return
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
.house-head { display: flex; align-items: center; gap: 12px; }
.house-info { flex: 1; }
.house-stats { text-align: right; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 2px; }
.house-actions { padding: 8px 0; text-align: right; }
</style>