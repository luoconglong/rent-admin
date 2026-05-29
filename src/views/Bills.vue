<template>
  <div>
    <div class="page-head">
      <h2>💰 账单管理</h2>
      <div class="head-btns">
        <button class="btn primary" @click="generate">📅 生成本月账单</button>
        <select v-model="exportCategory" class="input" style="width:auto" @change="exportCSV">
          <option value="">📥 导出全部</option>
          <option v-for="c in categories.filter(x => x !== '全部')" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>

    <div class="tab-bar">
      <span :class="['tab-item', { active: tab === 'pending' }]" @click="tab = 'pending'">待收账单</span>
      <span :class="['tab-item', { active: tab === 'paid' }]" @click="tab = 'paid'">已收账单</span>
    </div>

    <div v-if="tab === 'pending'">
      <div v-if="pendingBills.length === 0" class="empty">暂无待收账单</div>

      <div v-for="(group, gIdx) in pendingGroups" :key="group.key" class="card group-card">
        <div class="group-head" @click="group.open = !group.open">
          <span>{{ group.emoji }} {{ group.label }} ({{ group.list.length }}笔 · ¥{{ group.total }})</span>
          <span>{{ group.open ? '▼' : '▶' }}</span>
        </div>
        <table class="tbl" v-show="group.open && group.list.length">
          <thead><tr><th>租客</th><th>房间</th><th>类型</th><th>月份</th><th>金额</th><th>到期</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="b in group.list" :key="b.id">
              <td>{{ b.tenantName }}</td>
              <td>{{ b.roomNo }}</td>
              <td>{{ b.category }}</td>
              <td>{{ b.bill_month }}</td>
              <td>¥{{ b.amount }}</td>
              <td>{{ urgencyText(b) }}</td>
              <td>
                <button class="btn-sm green" @click="doPay(b.id)">收款</button>
                <button class="btn-sm danger" @click="delBill(b.id)">删</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="total-row" v-if="pendingBills.length">
        合计：{{ pendingBills.length }}笔 · ¥{{ pendingTotal }}
      </div>
    </div>

    <div v-if="tab === 'paid'">
      <div class="stat-grid" style="margin-bottom:16px;">
        <div class="stat-card"><div class="stat-num">¥{{ monthTotal }}</div><div class="stat-label">本月收入</div></div>
        <div class="stat-card"><div class="stat-num">¥{{ yearTotal }}</div><div class="stat-label">本年收入</div></div>
      </div>

      <div class="filter-tabs">
        <span v-for="c in categories" :key="c"
          :class="['filter-tab', { active: activeCategory === c }]"
          @click="activeCategory = c; filterPaid()">{{ c }}</span>
      </div>

      <input v-model="searchKeyword" placeholder="搜索租客/房间/类型..." class="input" style="margin-bottom:14px;width:100%" @input="filterPaid" />

      <table class="tbl" v-if="filteredPaid.length">
        <thead><tr><th>租客</th><th>房间</th><th>类型</th><th>金额</th><th>收款时间</th><th>月份</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="b in filteredPaid" :key="b.id">
            <td>{{ b.tenantName }}</td>
            <td>{{ b.houseAddress }} {{ b.roomNo }}</td>
            <td>{{ b.category }}</td>
            <td>¥{{ b.amount }}</td>
            <td>{{ formatTime(b.paidTime) }}</td>
            <td>{{ b.billMonth }}</td>
            <td><button class="btn-sm danger" @click="delBill(b.id)">删</button></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无记录</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue'
import { bills, tenants, rooms, houses, expends, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const tab = ref('pending')
const exportCategory = ref('')

const pendingBills = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return bills.value
    .filter(b => b.status === 'pending')
    .map(b => {
      const tenant = tenants.value.find(t => t.name === b.tenant_name) || tenants.value.find(t => String(t.id) === String(b.tenant_id))
      const room = rooms.value.find(r => String(r.id) === String(b.room_id))
      const amount = (b.total_amount || 0) - (b.paid_amount || 0)
      const payDay = tenant?.payment_day || 1
      let diffDays = null
      if (b.bill_month) {
        const parts = b.bill_month.split('-')
        if (parts.length >= 2) {
          const dueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, payDay)
          diffDays = Math.ceil((today - dueDate) / 86400000)
        }
      }
      return { ...b, tenantName: tenant?.name || b.tenant_name || '-', roomNo: room?.room_no || b.room_no || '-', amount, diffDays }
    })
})

const groupState = reactive([
  { key: 'overdue', emoji: '🚨', label: '已逾期', open: false, list: [], total: '0' },
  { key: 'today', emoji: '⚡', label: '今天到期', open: false, list: [], total: '0' },
  { key: 'in3', emoji: '⏰', label: '3天内到期', open: false, list: [], total: '0' },
  { key: 'in7', emoji: '📅', label: '7天内到期', open: false, list: [], total: '0' },
  { key: 'normal', emoji: '✅', label: '正常待收', open: false, list: [], total: '0' },
])

const pendingGroups = computed(() => {
  groupState.forEach(g => { g.list = []; g.total = '0' })

  for (const b of pendingBills.value) {
    const d = b.diffDays
    let group
    if (d === null) group = groupState[4]
    else if (d > 0) group = groupState[0]
    else if (d === 0) group = groupState[1]
    else if (d >= -3) group = groupState[2]
    else if (d >= -7) group = groupState[3]
    else group = groupState[4]
    group.list.push(b)
  }

  groupState.forEach(g => {
    g.total = g.list.reduce((s, b) => s + b.amount, 0).toFixed(2)
  })

  return groupState.filter(g => g.list.length > 0)
})

const pendingTotal = computed(() => pendingBills.value.reduce((s, b) => s + b.amount, 0).toFixed(2))

function urgencyText(b) {
  const d = b.diffDays
  if (d === null) return '待收'
  if (d > 0) return `逾期${d}天`
  if (d === 0) return '今天到期'
  return `${-d}天后`
}

const activeCategory = ref('全部')
const searchKeyword = ref('')
const filteredPaid = ref([])
const monthTotal = ref('0.00')
const yearTotal = ref('0.00')

const categories = computed(() => {
  const cats = new Set()
  cats.add('全部')
  paidBills.value.forEach(b => cats.add(b.category))
  return [...cats]
})

const paidBills = computed(() => {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const roomMap = {}, houseMap = {}, tenantMap = {}
  rooms.value.forEach(r => { roomMap[String(r.id)] = r })
  houses.value.forEach(h => { houseMap[String(h.id)] = h })
  tenants.value.forEach(t => { tenantMap[String(t.id)] = t })

  let list = []

  for (const b of bills.value) {
    const paidAmount = b.paid_amount || 0
    if (paidAmount === 0 || b.status !== 'paid') continue
    const room = roomMap[String(b.room_id)]
    const house = room ? houseMap[String(room.house_id)] : null
    const tenant = tenantMap[String(b.tenant_id)]
    const paidTime = b.paid_time ? new Date(b.paid_time) : new Date()

    list.push({
      id: b.id, billMonth: b.bill_month || '',
      houseAddress: house ? (house.address || '') : (b.house_address || ''),
      roomNo: room ? room.room_no : (b.room_no || ''),
      tenantName: tenant ? tenant.name : (b.tenant_name || ''),
      amount: paidAmount.toFixed(2),
      paidTime: b.paid_time || '',
      category: b.category || '其他',
      paidYear: paidTime.getFullYear(),
      paidMonth: paidTime.getMonth() + 1
    })
  }

  for (const e of expends.value) {
    if (e.type === '退租结算' && e.amount > 0 && e.time) {
      const et = new Date(e.time)
      if (!isNaN(et.getTime())) {
        list.push({
          id: e.id, billMonth: '',
          houseAddress: '', roomNo: e.roominfo || '',
          tenantName: e.tenantname || '',
          amount: (e.isincome ? e.amount : -e.amount).toFixed(2),
          paidTime: e.time, category: '房租',
          paidYear: et.getFullYear(), paidMonth: et.getMonth() + 1
        })
      }
    }
  }

  list.sort((a, b) => new Date(b.paidTime) - new Date(a.paidTime))

  let mTotal = 0, yTotal = 0
  list.forEach(b => {
    const amt = parseFloat(b.amount) || 0
    if (b.paidYear === currentYear) {
      yTotal += amt
      if (b.paidMonth === currentMonth) mTotal += amt
    }
  })
  monthTotal.value = mTotal.toFixed(2)
  yearTotal.value = yTotal.toFixed(2)

  return list
})

function filterPaid() {
  let list = paidBills.value
  if (activeCategory.value !== '全部') list = list.filter(b => b.category === activeCategory.value)
  const kw = searchKeyword.value.toLowerCase()
  if (kw) {
    list = list.filter(b =>
      (b.tenantName || '').toLowerCase().includes(kw) ||
      (b.roomNo || '').toLowerCase().includes(kw) ||
      (b.houseAddress || '').toLowerCase().includes(kw) ||
      (b.category || '').toLowerCase().includes(kw) ||
      (b.billMonth || '').toLowerCase().includes(kw)
    )
  }
  filteredPaid.value = list
}

watch(paidBills, () => filterPaid(), { immediate: true })

async function generate() {
  const month = new Date().toISOString().slice(0, 7)
  const active = tenants.value.filter(t => t.status === 'renting')
  if (!active.length) return alert('没有在住租客')
  const data = active.map(t => ({
    tenant_id: String(t.id), room_id: String(t.room_id), category: '房租',
    total_amount: t.rent_amount, status: 'pending', bill_month: month,
    tenant_name: t.name, room_no: ''
  }))
  await supabase.from('bills').insert(data)
  alert(`已生成 ${data.length} 条账单`)
  loadAll()
}

async function doPay(id) {
  const b = bills.value.find(x => x.id === id)
  if (!b) return
  await supabase.from('bills').update({
    status: 'paid', paid_amount: b.total_amount, paid_time: new Date().toISOString()
  }).eq('id', id)
  loadAll()
}

async function delBill(id) {
  if (!confirm('确认删除这笔账单？')) return
  await supabase.from('bills').delete().eq('id', id)
  loadAll()
}

function exportCSV() {
  let data
  if (tab.value === 'pending') {
    data = pendingBills.value
  } else {
    data = exportCategory.value
      ? paidBills.value.filter(b => b.category === exportCategory.value)
      : filteredPaid.value
  }
  if (!data.length) return alert('没有可导出的数据')
  let csv = '租客,房间,类型,月份,金额,状态\n'
  data.forEach(b => {
    csv += `${b.tenantName},${b.roomNo || b.houseAddress + ' ' + b.roomNo},${b.category},${b.bill_month || ''},${b.amount},${tab.value === 'pending' ? '待收' : '已收'}\n`
  })
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `账单_${exportCategory.value || tab.value}_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function showDetail(b) {
  alert(`收款详情\n租客：${b.tenantName}\n房间：${b.houseAddress} ${b.roomNo}\n类型：${b.category}\n金额：¥${b.amount}\n时间：${formatTime(b.paidTime)}`)
}

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}
</script>

<style scoped>
.tab-bar { display: flex; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 8px; border-radius: 8px; font-size: 14px; cursor: pointer; color: #64748b; }
.tab-item.active { background: white; color: #1e6f5c; font-weight: 600; }
.filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.filter-tab { padding: 4px 12px; border-radius: 14px; font-size: 12px; background: #f1f5f9; color: #475569; cursor: pointer; }
.filter-tab.active { background: #1e6f5c; color: white; }
.group-card { margin-bottom: 12px; }
.group-head { display: flex; justify-content: space-between; align-items: center; padding: 14px; cursor: pointer; font-size: 14px; font-weight: 600; user-select: none; }
.group-head:hover { background: #f8fafc; }
.total-row { padding: 14px; font-size: 16px; font-weight: 700; text-align: center; }
.btn-sm.danger { color: #dc2626; border-color: #fecaca; }
</style>