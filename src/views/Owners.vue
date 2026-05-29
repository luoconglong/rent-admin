<template>
  <div>
    <div class="page-head">
      <h2>🏢 业主管理</h2>
      <div class="head-btns">
        <span>提醒天数：</span>
        <input v-model.number="remindDays" type="number" min="1" max="30" class="input" style="width:70px" />
        <span>天</span>
        <button class="btn primary" @click="$emit('openDialog', 'owner')">+ 添加业主</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">{{ totalOwners }}</div><div class="stat-label">业主总数</div></div>
      <div class="stat-card"><div class="stat-num">{{ totalHouses }}</div><div class="stat-label">关联楼栋</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ totalRent }}</div><div class="stat-label">月租合计</div></div>
    </div>

    <div v-for="(g, gi) in grouped" :key="g.houseId" class="card group-card">
      <div class="group-head" @click="g._expanded = !g._expanded">
        <span>🏢 {{ g.houseName }}</span>
        <span>{{ g.owners.length }} 位业主 · ¥{{ g.totalRent }}</span>
        <span>{{ g._expanded ? '▼' : '▶' }}</span>
      </div>
      <div v-if="g._expanded">
        <div v-for="o in g.owners" :key="o.id" class="owner-row" @touchstart="onStart($event, o)" @touchmove="onMove($event, o)" @touchend="onEnd(o)">
          <div class="owner-main" @click="editOwner(o)">
            <div class="owner-info">
              <strong>{{ o.name }}</strong>
              <span>{{ o.cycleText }} · 每月{{ o.paymentDay }}号</span>
              <span>{{ o.linkText }}</span>
            </div>
            <div class="owner-right">
              <span class="tag" :class="countdownClass(o)">{{ o.countdownText }}</span>
              <span>¥{{ o.monthlyRent }}</span>
            </div>
          </div>
          <div class="owner-actions" :class="{ open: o._open }">
            <button class="action-btn edit" @click="editOwner(o)">编辑</button>
            <button class="action-btn delete" @click="delOwner(o)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card" v-if="ungrouped.length">
      <div class="group-head" @click="ungroupedExpanded = !ungroupedExpanded">
        <span>📋 未关联楼栋</span>
        <span>{{ ungrouped.length }} 位 · ¥{{ ungroupedRent }}</span>
        <span>{{ ungroupedExpanded ? '▼' : '▶' }}</span>
      </div>
      <div v-if="ungroupedExpanded">
        <div v-for="o in ungrouped" :key="o.id" class="owner-row">
          <div class="owner-main" @click="editOwner(o)">
            <div class="owner-info"><strong>{{ o.name }}</strong><span>¥{{ o.monthlyRent }}</span></div>
            <div class="owner-right"><span class="tag gray">未关联</span></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="grouped.length === 0 && ungrouped.length === 0" class="empty">暂无业主</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { houses, rooms, owners, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const remindDays = ref(3)
const ungroupedExpanded = ref(false)

const cycleMap = { 'monthly': '月付', 'quarterly': '季付', 'yearly': '年付' }

const enriched = computed(() => {
  const houseMap = {}
  houses.value.forEach(h => { houseMap[String(h.id)] = h })
  const roomMap = {}
  rooms.value.forEach(r => { roomMap[String(r.id)] = r })

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const currentDay = today.getDate()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  return owners.value.map(ow => {
    const parts = [], oHouseIds = []
    if (ow.houses && ow.houses.length) {
      ow.houses.forEach(hid => {
        parts.push('🏢' + (houseMap[String(hid)]?.address || '未知'))
        oHouseIds.push(String(hid))
      })
    }
    if (ow.rooms && ow.rooms.length) {
      ow.rooms.forEach(rid => {
        const r = roomMap[String(rid)]
        parts.push('🚪' + (r?.room_no || '未知'))
        if (r?.house_id && !oHouseIds.includes(String(r.house_id))) oHouseIds.push(String(r.house_id))
      })
    }

    const cycle = ow.rentcycle || 'monthly'
    const cycleText = cycleMap[cycle] || '月付'
    const paymentDay = ow.paymentday || 1
    const startMonth = ow.startmonth || 1

    let nextPayDate = null, countdown = null, countdownText = ''
    if (paymentDay >= 1 && paymentDay <= 31) {
      if (cycle === 'quarterly') {
        let m = startMonth
        while (m < currentMonth) m += 3
        if (m === currentMonth && paymentDay < currentDay) m += 3
        nextPayDate = new Date(currentYear, m - 1, paymentDay)
      } else if (cycle === 'yearly') {
        let y = currentYear
        if (startMonth < currentMonth || (startMonth === currentMonth && paymentDay < currentDay)) y++
        nextPayDate = new Date(y, startMonth - 1, paymentDay)
      } else {
        nextPayDate = new Date(currentYear, currentMonth - 1, paymentDay)
        if (nextPayDate < today) nextPayDate = new Date(currentYear, currentMonth, paymentDay)
      }
      nextPayDate.setHours(0, 0, 0, 0)
      countdown = Math.ceil((nextPayDate - today) / 86400000)
      if (countdown === 0) countdownText = '今天付租'
      else if (countdown < 0) countdownText = '已逾期' + (-countdown) + '天'
      else countdownText = '还有' + countdown + '天付租'
    }

    return {
      ...ow,
      monthlyRent: ow.monthlyrent || 0,
      paymentDay, cycleText, linkText: parts.length ? parts.join(' ') : '暂无关联',
      houseIds: oHouseIds, countdown, countdownText, _open: false
    }
  })
})

const grouped = computed(() => {
  const houseMap = {}
  houses.value.forEach(h => { houseMap[String(h.id)] = h })
  const groupMap = {}
  enriched.value.forEach(o => {
    o.houseIds.forEach(hid => {
      if (!groupMap[hid]) groupMap[hid] = { houseId: hid, houseName: houseMap[hid]?.address || '未知', owners: [], totalRent: 0, _expanded: false }
      if (!groupMap[hid].owners.find(x => x.id === o.id)) {
        groupMap[hid].owners.push(o)
        groupMap[hid].totalRent += o.monthlyRent
      }
    })
  })
  const list = Object.values(groupMap)
  list.forEach(g => g.owners.sort((a, b) => a.name.localeCompare(b.name)))
  list.sort((a, b) => a.houseName.localeCompare(b.houseName))
  return list
})

const ungrouped = computed(() => enriched.value.filter(o => o.houseIds.length === 0))
const ungroupedRent = computed(() => ungrouped.value.reduce((s, o) => s + o.monthlyRent, 0))
const totalOwners = computed(() => enriched.value.length)
const totalHouses = computed(() => { const set = new Set(); enriched.value.forEach(o => o.houseIds.forEach(h => set.add(h))); return set.size })
const totalRent = computed(() => enriched.value.reduce((s, o) => s + o.monthlyRent, 0))

function countdownClass(o) {
  if (!o.countdownText) return 'gray'
  if (o.countdownText.includes('逾期')) return 'warn'
  if (o.countdown <= remindDays.value) return 'warn'
  return 'green'
}

let startX = 0
function onStart(e, o) { startX = e.touches[0].clientX }
function onMove(e, o) { const diff = startX - e.touches[0].clientX; if (diff > 50) o._open = true; else if (diff < -20) o._open = false }
function onEnd(o) {}

function editOwner(o) { alert(`编辑业主：${o.name}\n月租：¥${o.monthlyRent}\n周期：${o.cycleText}\n付款日：${o.paymentDay}号`) }
async function delOwner(o) { if (!confirm(`确认删除业主 ${o.name}？`)) return; await supabase.from('owners').delete().eq('id', o.id); loadAll() }

onMounted(() => { const saved = localStorage.getItem('globalRemindDays'); if (saved) remindDays.value = parseInt(saved) || 3 })
</script>

<style scoped>
.group-card { margin-bottom: 12px; }
.group-head { display: flex; justify-content: space-between; align-items: center; padding: 14px; cursor: pointer; font-size: 14px; font-weight: 600; }
.owner-row { overflow: hidden; position: relative; border-top: 1px solid #f1f5f9; }
.owner-main { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; cursor: pointer; }
.owner-info { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.owner-right { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.owner-actions { display: flex; position: absolute; right: -140px; top: 0; bottom: 0; transition: right 0.2s; }
.owner-actions.open { right: 0; }
.action-btn { width: 70px; border: none; color: white; font-size: 14px; cursor: pointer; }
.action-btn.edit { background: #3b82f6; }
.action-btn.delete { background: #ef4444; }
</style>