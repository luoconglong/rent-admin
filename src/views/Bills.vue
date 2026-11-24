<template>
  <div>
    <div class="page-head">
      <h2>💰 账单管理</h2>
      <div class="head-btns">
        <button class="btn primary" @click="generate">📅 生成本月账单</button>
        <button class="btn success" @click="toggleExportPanel" style="margin-left: 10px;">
          {{ showExportPanel ? '收起导出面板' : '📥 组合导出（按月+分类）' }}
        </button>
      </div>
    </div>

    <!-- 月份与分类组合筛选面板 -->
    <div v-if="showExportPanel" class="card export-panel">
      <div class="panel-section">
        <div class="panel-head">
          <strong>📅 选择月份（多选）：</strong>
          <button class="btn-sm" @click="toggleSelectAllMonths">{{ isAllMonthsSelected ? '取消全选' : '全选' }}</button>
        </div>
        <div class="checkbox-group">
          <label v-for="m in availableMonths" :key="m" class="check-label">
            <input type="checkbox" :value="m" v-model="selectedMonths" />
            {{ m }}
          </label>
        </div>
      </div>

      <div class="panel-section" style="margin-top: 16px;">
        <div class="panel-head">
          <strong>🏷️ 选择分类（多选，不勾=全部）：</strong>
          <button class="btn-sm" @click="toggleSelectAllCategories">{{ isAllCategoriesSelected ? '取消全选' : '全选' }}</button>
        </div>
        <div class="checkbox-group">
          <label v-for="c in availableCategories" :key="c" class="check-label">
            <input type="checkbox" :value="c" v-model="selectedCategories" />
            {{ c }}
          </label>
        </div>
      </div>

      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <button class="btn primary" @click="exportWithFilters">📥 确认导出选中数据</button>
        <button class="btn" @click="resetFilters">重置选择</button>
      </div>
    </div>

    <div class="tab-bar">
      <span :class="['tab-item', { active: tab === 'pending' }]" @click="tab = 'pending'">待收账单</span>
      <span :class="['tab-item', { active: tab === 'paid' }]" @click="tab = 'paid'">已收账单</span>
    </div>

    <!-- ===================== 待收账单区 ===================== -->
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

    <!-- ===================== 已收账单区 ===================== -->
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

// ================= 导出筛选状态 =================
const showExportPanel = ref(false)
const selectedMonths = ref([])
const selectedCategories = ref([])

const availableMonths = computed(() => {
  const months = bills.value.map(b => b.bill_month || b.billMonth).filter(m => m)
  return [...new Set(months)].sort().reverse()
})

const availableCategories = computed(() => {
  const cats = bills.value.map(b => b.category).filter(c => c)
  return [...new Set(cats)]
})

const isAllMonthsSelected = computed(() => {
  return selectedMonths.value.length === availableMonths.value.length && availableMonths.value.length > 0
})
const isAllCategoriesSelected = computed(() => {
  return selectedCategories.value.length === availableCategories.value.length && availableCategories.value.length > 0
})

const toggleExportPanel = () => {
  showExportPanel.value = !showExportPanel.value
}

const toggleSelectAllMonths = () => {
  selectedMonths.value = isAllMonthsSelected.value ? [] : [...availableMonths.value]
}
const toggleSelectAllCategories = () => {
  selectedCategories.value = isAllCategoriesSelected.value ? [] : [...availableCategories.value]
}
const resetFilters = () => {
  selectedMonths.value = []
  selectedCategories.value = []
}

// ================= 待收账单 =================
const pendingBills = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return bills.value
    .filter(b => b.status === 'pending')
    .map(b => {
      const tenant = tenants.value.find(t => String(t.id) === String(b.tenant_id))
      const room = rooms.value.find(r => String(r.id) === String(b.room_id))
      const amount = (b.total_amount || 0) - (b.paid_amount || 0)
      const payDay = tenant?.payment_day || 1
      let diffDays = null
      if (b.bill_month) {
        const parts = b.bill_month.split('-')
        if (parts.length >= 2) {
          const dueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, payDay)
          dueDate.setHours(0, 0, 0, 0)
          diffDays = Math.floor((dueDate - today) / 86400000)
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
    else if (d < 0) group = groupState[0]
    else if (d === 0) group = groupState[1]
    else if (d <= 3) group = groupState[2]
    else if (d <= 7) group = groupState[3]
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
  if (d < 0) return `逾期${-d}天`
  if (d === 0) return '今天到期'
  return `${d}天后`
}

// ================= 已收账单 =================
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

// ================= 数据操作 =================
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

// ================= 核心导出逻辑 =================
const exportWithFilters = () => {
  if (selectedMonths.value.length === 0) {
    return alert('请至少勾选一个月份！')
  }

  // 映射表
  const roomMap = {}
  rooms.value.forEach(r => { roomMap[String(r.id)] = r })
  const houseMap = {}
  houses.value.forEach(h => { houseMap[String(h.id)] = h })
  const tenantMap = {}
  tenants.value.forEach(t => { tenantMap[String(t.id)] = t })

  let data = bills.value.filter(b => {
    const month = b.bill_month || b.billMonth
    const category = b.category
    const monthMatch = selectedMonths.value.includes(month)
    const categoryMatch = selectedCategories.value.length === 0 || selectedCategories.value.includes(category)
    
    if (!monthMatch || !categoryMatch) return false

    // 【终极绝杀】：只要该账单的租客状态是 moved（退房），不管他付没付钱，统统不准导出！
    const tenant = tenantMap[String(b.tenant_id)]
    if (tenant && (tenant.status === 'moved' || tenant.status === 'checked_out')) {
      return false
    }

    // 拦截退租结算和押金抵扣
    if (b.category === '退租结算' || b.category === '押金抵扣-房租') {
       return false
    }

    return true
  })

  if (data.length === 0) {
    return alert('选中的条件没有匹配到任何账单数据')
  }

  // 排序：先按月，再按楼栋，最后按房号
  data.sort((a, b) => {
    const monthA = a.bill_month || a.billMonth || ''
    const monthB = b.bill_month || b.billMonth || ''
    if (monthA !== monthB) return monthA.localeCompare(monthB)

    const roomA = roomMap[String(a.room_id)]
    const roomB = roomMap[String(b.room_id)]
    
    const houseA = roomA ? roomA.house_id : ''
    const houseB = roomB ? roomB.house_id : ''
    if (houseA !== houseB) return String(houseA).localeCompare(String(houseB))

    const noA = roomA ? roomA.room_no : ''
    const noB = roomB ? roomB.room_no : ''
    return (noA || '').localeCompare(noB || '')
  })

  // 生成 CSV
  let csvContent = "\uFEFF"
  csvContent += "账单月份,楼栋/地址,房间号,租客姓名,费用类别,账单金额,已付金额,待收金额,状态,收租日,账单周期,到期日\n"

  data.forEach(b => {
    const month = b.bill_month || b.billMonth || ''
    const room = roomMap[String(b.room_id)]
    const house = room ? houseMap[String(room.house_id)] : null
    const houseAddress = house ? (house.address || '') : ''
    const realRoomNo = room ? room.room_no : (b.room_no || '-')
    
    const tenantName = b.tenant_name || b.tenantName || '-'
    const category = b.category || ''
    const total = b.total_amount || b.totalAmount || 0
    const paid = b.paid_amount || b.paidAmount || 0
    const unpaid = (total - paid).toFixed(2)
    const status = b.status === 'paid' ? '已付清' : '待收'
    const dueDate = b.due_date || b.dueDate || ''

    const tenant = tenantMap[String(b.tenant_id)]
    let payDay = tenant?.payment_day || b.pay_day || b.payment_day || 1

    // 【终极修复】：直接读取数据库里存好的 date_range！
    // 如果数据库里存了 12-25 至 03-24，这里出来的就是 12-25 至 03-24
    let finalRangeStr = b.date_range || b.dateRange || ''
    
    if (!finalRangeStr && month) {
       // 如果数据库实在没存（NULL），才走兜底逻辑算一个单月周期
       const parts = month.split('-')
       if (parts.length >= 2) {
          let y = parseInt(parts[0])
          let m = parseInt(parts[1])
          let startObj = new Date(y, m - 1, payDay)
          let endObj = new Date(y, m, payDay - 1)
          const startStr = String(startObj.getMonth() + 1).padStart(2, '0') + '-' + String(startObj.getDate()).padStart(2, '0')
          const endStr = String(endObj.getMonth() + 1).padStart(2, '0') + '-' + String(endObj.getDate()).padStart(2, '0')
          finalRangeStr = startStr + ' 至 ' + endStr
       }
    }
    
    if (!finalRangeStr) finalRangeStr = '-'

    const payDayStr = (payDay && payDay !== '-') ? `${payDay}号` : '-'

    const row = `"\t${month}","${houseAddress}","${realRoomNo}","${tenantName}","${category}","${total}","${paid}","${unpaid}","${status}","${payDayStr}","${finalRangeStr}","${dueDate}"`
    csvContent += row + "\n"
  })

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  
  const monthStr = selectedMonths.value.length > 2 ? `${selectedMonths.value.length}个月份` : selectedMonths.value.join('_')
  const catStr = selectedCategories.value.length === 0 ? '全分类' : (selectedCategories.value.length > 2 ? '多分类' : selectedCategories.value.join('_'))
  
  link.setAttribute('download', `账单导出_${monthStr}_${catStr}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}
</script>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; }
.head-btns { display: flex; align-items: center; }

/* 导出面板样式 */
.export-panel { margin-bottom: 16px; padding: 16px; }
.panel-section { margin-bottom: 12px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.checkbox-group { display: flex; flex-wrap: wrap; gap: 12px; }
.check-label { display: flex; align-items: center; gap: 4px; font-size: 14px; cursor: pointer; }

.group-card { margin-bottom: 12px; }
.group-head { display: flex; justify-content: space-between; align-items: center; padding: 14px; cursor: pointer; font-size: 14px; font-weight: 600; user-select: none; }
.group-head:hover { background: var(--gray-50); }
.total-row { padding: 14px; font-size: 16px; font-weight: 700; text-align: center; }
</style>