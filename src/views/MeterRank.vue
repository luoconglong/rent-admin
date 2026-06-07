<template>
  <div>
    <div class="page-head"><h2>📊 抄表排行</h2></div>

    <div class="tab-bar">
      <span :class="['tab-item', { active: tab === 'water' }]" @click="switchTab('water')">💧 水表</span>
      <span :class="['tab-item', { active: tab === 'electric' }]" @click="switchTab('electric')">⚡ 电表</span>
    </div>

    <select v-model="houseId" class="input" @change="applyFilter" style="margin-bottom:14px">
      <option value="">全部楼栋</option>
      <option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option>
    </select>

    <div v-if="filtered.length === 0" class="empty">暂无数据</div>
    <div v-for="(r, i) in filtered" :key="r.roomId" class="rank-item">
      <div class="rank-num">{{ i + 1 }}</div>
      <div class="rank-info">
        <div class="rank-name">{{ r.name }}</div>
        <div class="rank-bar"><div class="rank-fill" :style="{ width: r.percent + '%' }"></div></div>
      </div>
      <div class="rank-usage">{{ r.usage }}{{ tab === 'water' ? '吨' : '度' }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { houses, rooms, meters } from '../stores/data.js'

const tab = ref('water')
const houseId = ref('')
const filtered = ref([])

let waterRank = []
let electricRank = []

function loadRank() {
  const roomMap = {}, houseMap = {}
  rooms.value.forEach(r => { roomMap[r.id] = r })
  houses.value.forEach(h => { houseMap[h.id] = h })

  const waterMap = {}, electricMap = {}

  for (const m of meters.value) {
    const usage = m.usage || 0
    const roomId = m.room_id || ''
    if (!roomId || usage <= 0) continue
    if (m.type === 'water') {
      waterMap[roomId] = (waterMap[roomId] || 0) + usage
    }
    if (m.type === 'electric') {
      electricMap[roomId] = (electricMap[roomId] || 0) + usage
    }
  }

  const makeRank = (map) => {
    return Object.entries(map).map(([id, usage]) => {
      const room = roomMap[id]
      const house = room ? houseMap[room.house_id] : null
      return {
        roomId: id,
        name: (house ? house.address + ' ' : '') + (room ? room.room_no : id),
        houseId: room ? room.house_id : '',
        usage
      }
    }).sort((a, b) => b.usage - a.usage)
  }

  waterRank = makeRank(waterMap)
  electricRank = makeRank(electricMap)
  applyFilter()
}

function switchTab(t) { tab.value = t; applyFilter() }

function applyFilter() {
  let rank = tab.value === 'water' ? waterRank : electricRank
  let list = houseId.value ? rank.filter(r => r.houseId === houseId.value) : rank
  const max = list.length > 0 ? list[0].usage : 1
  list = list.map(r => ({ ...r, percent: Math.round((r.usage / max) * 100) }))
  filtered.value = list
}

onMounted(loadRank)
</script>

<style scoped>
.tab-bar { display: flex; margin-bottom: 14px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 10px; border-radius: 8px; cursor: pointer; }
.tab-item.active { background: white; font-weight: 600; }
.rank-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
.rank-num { width: 28px; height: 28px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
.rank-info { flex: 1; }
.rank-name { font-size: 13px; margin-bottom: 4px; }
.rank-bar { height: 6px; background: #f1f5f9; border-radius: 3px; }
.rank-fill { height: 100%; background: #1e6f5c; border-radius: 3px; transition: width 0.3s; }
.rank-usage { font-size: 14px; font-weight: 600; }
</style>