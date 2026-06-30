<template>
  <div>
    <div class="page-head">
      <h2>🏢 业主管理</h2>
      <div class="head-btns">
        <span>提醒天数：</span>
        <input v-model.number="remindDays" type="number" min="1" max="30" class="input" style="width:70px" />
        <span>天</span>
        <button class="btn primary" @click="openAdd">+ 添加业主</button>
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

    <!-- 编辑/添加弹窗 -->
    <div class="mask" v-if="showDialog" @click.self="showDialog = false">
      <div class="dialog" style="width:420px;max-height:90vh;overflow-y:auto">
        <h3>{{ editingId ? '编辑业主' : '添加业主' }}</h3>
        <div class="form-item"><label>姓名</label><input v-model="form.name" class="input" /></div>
        <div class="form-item"><label>月租</label><input v-model.number="form.monthlyRent" type="number" class="input" /></div>
        <div class="form-item">
          <label>周期</label>
          <select v-model="form.cycle" class="input">
            <option value="monthly">月付</option>
            <option value="quarterly">季付</option>
            <option value="yearly">年付</option>
          </select>
        </div>
        <div class="form-item"><label>付款日</label><input v-model.number="form.paymentDay" type="number" min="1" max="31" class="input" /></div>
        <div class="form-item"><label>开始月份</label><input v-model.number="form.startMonth" type="number" min="1" max="12" class="input" /></div>
        <div class="form-item">
          <label>关联楼栋</label>
          <select v-model="form.houseId" class="input">
            <option value="">无</option>
            <option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address || h.name }}</option>
          </select>
        </div>
        <div class="form-item"><label>备注</label><input v-model="form.note" class="input" /></div>
        <div class="dialog-btns">
          <button class="btn" @click="showDialog = false">取消</button>
          <button class="btn primary" @click="saveOwner">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { houses, owners, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const remindDays = ref(3)
const ungroupedExpanded = ref(false)
const showDialog = ref(false)
const editingId = ref(null)

const form = ref({
  name: '', monthlyRent: 0, cycle: 'monthly',
  paymentDay: 1, startMonth: 1, houseId: '', note: ''
})

const cycleMap = { 'monthly': '月付', 'quarterly': '季付', 'yearly': '年付' }

const enriched = computed(() => {
  const houseMap = {}
  houses.value.forEach(h => { houseMap[String(h.id)] = h })

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const currentDay = today.getDate()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  return owners.value.map(ow => {
    const cycle = ow.rentcycle || ow.rent_cycle || 'monthly'
    const paymentDay = ow.paymentday || ow.payment_day || 1
    const startMonth = ow.startmonth || ow.start_month || 1
    const monthlyRent = ow.monthlyrent || ow.monthly_rent || 0
    const houseId = ow.house_id || ''
    const houseName = houseMap[String(houseId)]?.address || ''

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
      monthlyRent,
      paymentDay,
      cycle,
      cycleText: cycleMap[cycle] || '月付',
      startMonth,
      houseId,
      linkText: houseName || '未关联',
      houseIds: houseId ? [String(houseId)] : [],
      countdown,
      countdownText,
      _open: false
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

function openAdd() {
  editingId.value = null
  form.value = { name: '', monthlyRent: 0, cycle: 'monthly', paymentDay: 1, startMonth: 1, houseId: '', note: '' }
  showDialog.value = true
}

function editOwner(o) {
  editingId.value = o.id
  form.value = {
    name: o.name || '',
    monthlyRent: o.monthlyRent || 0,
    cycle: o.rentcycle || o.rent_cycle || 'monthly',
    paymentDay: o.paymentday || o.payment_day || 1,
    startMonth: o.startmonth || o.start_month || 1,
    houseId: o.house_id || '',
    note: o.note || ''
  }
  showDialog.value = true
}

async function saveOwner() {
  if (!form.value.name.trim()) return alert('请输入业主姓名')
  const data = {
    name: form.value.name.trim(),
    monthlyrent: form.value.monthlyRent,
    rentcycle: form.value.cycle,
    paymentday: form.value.paymentDay,
    startmonth: form.value.startMonth,
    house_id: form.value.houseId || null,
    note: form.value.note
  }
  if (editingId.value) {
    await supabase.from('owners').update(data).eq('id', editingId.value)
  } else {
    await supabase.from('owners').insert(data)
  }
  showDialog.value = false
  loadAll()
}

async function delOwner(o) {
  if (!confirm(`确认删除业主 ${o.name}？`)) return
  await supabase.from('owners').delete().eq('id', o.id)
  loadAll()
}

onMounted(() => {
  const saved = localStorage.getItem('globalRemindDays')
  if (saved) remindDays.value = parseInt(saved) || 3
  loadAll()
})
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