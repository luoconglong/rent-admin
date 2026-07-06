<template>
  <div>
    <h2>📈 经营概览</h2>

    <div class="filter-row">
      <select v-model="selectedYear" class="input" @change="loadData">
        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
      </select>
      <button class="btn" @click="exportExcel">📥 导出</button>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">¥{{ monthIncome }}</div><div class="stat-label">本月收入</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ monthExpense }}</div><div class="stat-label">本月支出</div></div>
      <div class="stat-card"><div class="stat-num" :class="monthBalance >= 0 ? 'green' : 'red'">¥{{ monthBalance }}</div><div class="stat-label">本月利润</div></div>
      <div class="stat-card warn-card"><div class="stat-num">¥{{ pendingTotal }}</div><div class="stat-label">待收总额</div></div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">{{ collectRate }}%</div><div class="stat-label">本月收缴率</div></div>
      <div class="stat-card"><div class="stat-num">{{ rentRate }}%</div><div class="stat-label">房源出租率</div></div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">¥{{ yearIncome }}</div><div class="stat-label">本年收入</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ yearExpense }}</div><div class="stat-label">本年支出</div></div>
      <div class="stat-card"><div class="stat-num" :class="yearBalance >= 0 ? 'green' : 'red'">¥{{ yearBalance }}</div><div class="stat-label">本年利润</div></div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>📈 月度收支趋势</h3>
      <div class="chart-container">
        <div class="chart-legend">
          <span class="legend-dot income"></span> 收入
          <span class="legend-dot expense"></span> 支出
          <span class="legend-dot profit"></span> 利润
        </div>
        <svg viewBox="0 0 600 220" class="line-chart">
          <polyline :points="expenseLine" fill="none" stroke="#ff4d4f" stroke-width="2" />
          <polyline :points="profitLine" fill="none" stroke="#1890ff" stroke-width="2" stroke-dasharray="5,3" />
          <polyline :points="incomeLine" fill="none" stroke="#07c160" stroke-width="2" />
        </svg>
        <div class="chart-labels">
          <span v-for="(m, idx) in chartMonths" :key="idx">{{ m }}</span>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:300px">
        <h3>📊 收入构成</h3>
        <div class="pie-container">
          <svg viewBox="0 0 200 200" class="pie-svg">
            <circle v-for="(slice, idx) in incomePieSlices" :key="idx"
              cx="100" cy="100" r="80"
              fill="transparent"
              :stroke="slice.color"
              stroke-width="40"
              :stroke-dasharray="slice.dashArray"
              :stroke-dashoffset="slice.offset"
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div class="pie-legend">
            <div v-for="item in incomeCategoryData" :key="item.name" class="pie-item">
              <span class="pie-dot" :style="{ background: item.color }"></span>
              <span>{{ item.name }} ¥{{ item.amount.toFixed(0) }} ({{ item.percent }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="flex:1;min-width:300px">
        <h3>📊 支出构成</h3>
        <div class="pie-container">
          <svg viewBox="0 0 200 200" class="pie-svg">
            <circle v-for="(slice, idx) in expensePieSlices" :key="idx"
              cx="100" cy="100" r="80"
              fill="transparent"
              :stroke="slice.color"
              stroke-width="40"
              :stroke-dasharray="slice.dashArray"
              :stroke-dashoffset="slice.offset"
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div class="pie-legend">
            <div v-for="item in expenseCategoryData" :key="item.name" class="pie-item">
              <span class="pie-dot" :style="{ background: item.color }"></span>
              <span>{{ item.name }} ¥{{ item.amount.toFixed(0) }} ({{ item.percent }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>📈 年度对比</h3>
      <div class="chart-container">
        <div class="chart-legend"><span class="legend-dot income"></span> 收入 <span class="legend-dot expense"></span> 支出</div>
        <div class="bar-chart">
          <div v-for="(y, idx) in yearCompareLabels" :key="idx" class="bar-group">
            <div class="bar-wrapper">
              <div class="bar income-bar" :style="{ height: getYearBarHeight(yearCompareIncome[idx]) }"></div>
              <div class="bar expense-bar" :style="{ height: getYearBarHeight(yearCompareExpense[idx]) }"></div>
            </div>
            <div class="bar-label">{{ y }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { bills, rooms, tenants } from '../stores/data.js'

const selectedYear = ref(new Date().getFullYear())
const yearOptions = computed(() => {
  const cy = new Date().getFullYear()
  const years = []
  for (let y = cy; y >= cy - 3; y--) years.push(y)
  return years
})

const monthIncome = ref('0.00'), monthExpense = ref('0.00'), monthBalance = ref('0.00')
const yearIncome = ref('0.00'), yearExpense = ref('0.00'), yearBalance = ref('0.00')
const pendingTotal = ref('0.00'), collectRate = ref('0'), rentRate = ref('0')
const chartMonths = ref([]), monthlyIncome = ref([]), monthlyExpense = ref([]), monthlyProfit = ref([])

function loadData() {
  const year = selectedYear.value
  const d = new Date()
  const cm = d.getMonth() + 1
  const cy = d.getFullYear()
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

  let mi = 0, yi = 0, me = 0, ye = 0, pt = 0
  const mIncome = [0,0,0,0,0,0,0,0,0,0,0,0]
  const mExpense = [0,0,0,0,0,0,0,0,0,0,0,0]
  let monthTotalBill = 0, monthPaidBill = 0

  for (const b of bills.value) {
    const unpaid = (b.total_amount || 0) - (b.paid_amount || 0)
    if (b.direction === 'income' && unpaid > 0) pt += unpaid

    const paid = b.paid_amount || 0
    if (paid > 0 && b.paid_time) {
      const pDate = new Date(b.paid_time)
      if (!isNaN(pDate.getTime()) && pDate.getFullYear() === year) {
        const pMonth = pDate.getMonth()
        if (b.direction === 'income') {
          yi += paid
          if (pMonth + 1 === cm && year === cy) mi += paid
          mIncome[pMonth] += paid
          if (pMonth + 1 === cm && year === cy) monthPaidBill += paid
        } else if (b.direction === 'expense') {
          ye += paid
          if (pMonth + 1 === cm && year === cy) me += paid
          mExpense[pMonth] += paid
        }
      }
    }
    if (b.direction === 'income' && b.bill_month) {
      const [by, bm] = b.bill_month.split('-').map(Number)
      if (by === cy && bm === cm) monthTotalBill += (b.total_amount || 0)
    }
  }

  const showMonths = year === cy ? cm : 12
  monthIncome.value = mi.toFixed(2)
  monthExpense.value = me.toFixed(2)
  monthBalance.value = (mi - me).toFixed(2)
  yearIncome.value = yi.toFixed(2)
  yearExpense.value = ye.toFixed(2)
  yearBalance.value = (yi - ye).toFixed(2)
  pendingTotal.value = pt.toFixed(2)
  collectRate.value = monthTotalBill > 0 ? Math.round((monthPaidBill / monthTotalBill) * 100) : 0
  rentRate.value = rooms.value.length > 0 ? Math.round((rooms.value.filter(r => r.status === 'rented').length / rooms.value.length) * 100) : 0
  chartMonths.value = months.slice(0, showMonths)
  monthlyIncome.value = mIncome.slice(0, showMonths)
  monthlyExpense.value = mExpense.slice(0, showMonths)
  monthlyProfit.value = mIncome.slice(0, showMonths).map((v, i) => v - mExpense.slice(0, showMonths)[i])
}

const incomeLine = computed(() => linePoints(monthlyIncome.value))
const expenseLine = computed(() => linePoints(monthlyExpense.value))
const profitLine = computed(() => linePoints(monthlyProfit.value))

function linePoints(data) {
  if (data.length === 0) return ''
  const max = Math.max(...data, 1)
  const w = 600, h = 180, pad = 10
  const stepX = data.length > 1 ? (w - 2 * pad) / (data.length - 1) : 0
  return data.map((v, i) => `${pad + i * stepX},${h - (v / max) * (h - 20)}`).join(' ')
}

const incomeCategoryData = computed(() => categoryCalc('income'))
const expenseCategoryData = computed(() => categoryCalc('expense'))

function categoryCalc(direction) {
  const map = {}
  const incomeColors = { '房租': '#07c160', '水费': '#1890ff', '电费': '#f59e0b', '其他': '#94a3b8' }
  const expenseColors = { '退租结算': '#ff4d4f', '维修费': '#f97316', '清洁费': '#8b5cf6', '宽带费': '#06b6d4', '其他': '#64748b' }
  const colors = direction === 'income' ? incomeColors : expenseColors
  let total = 0
  for (const b of bills.value) {
    if (b.direction !== direction) continue
    const amount = b.total_amount || 0
    if (amount <= 0) continue
    const cat = b.category || '其他'
    const catKey = colors[cat] ? cat : '其他'
    if (!map[catKey]) map[catKey] = { name: catKey, amount: 0, color: colors[catKey] || '#64748b' }
    map[catKey].amount += amount
    total += amount
  }
  return Object.values(map).map(item => ({ ...item, percent: total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0' }))
}

const incomePieSlices = computed(() => pieCalc(incomeCategoryData.value))
const expensePieSlices = computed(() => pieCalc(expenseCategoryData.value))

function pieCalc(data) {
  const total = data.reduce((s, i) => s + i.amount, 0)
  if (total === 0) return []
  const circumference = 2 * Math.PI * 80
  let offset = 0
  return data.map(item => {
    const percent = item.amount / total
    const dashArray = circumference * percent + ' ' + circumference * (1 - percent)
    const slice = { color: item.color, dashArray, offset: -offset }
    offset += circumference * percent
    return slice
  })
}

const yearCompareLabels = computed(() => yearOptions.value.map(y => y + '年').reverse())
const yearCompareIncome = computed(() => yearOptions.value.map(y => {
  let t = 0
  for (const b of bills.value) {
    if (b.direction !== 'income' || !b.paid_amount || !b.paid_time) continue
    const d = new Date(b.paid_time)
    if (!isNaN(d.getTime()) && d.getFullYear() === y) t += b.paid_amount
  }
  return t
}).reverse())
const yearCompareExpense = computed(() => yearOptions.value.map(y => {
  let t = 0
  for (const b of bills.value) {
    if (b.direction !== 'expense' || !b.paid_amount || !b.paid_time) continue
    const d = new Date(b.paid_time)
    if (!isNaN(d.getTime()) && d.getFullYear() === y) t += b.paid_amount
  }
  return t
}).reverse())
const yearMaxVal = computed(() => Math.max(...[...yearCompareIncome.value, ...yearCompareExpense.value], 1))
function getYearBarHeight(val) { return (val / yearMaxVal.value) * 150 + 'px' }

function exportExcel() {
  const rows = [['月份', '收入', '支出', '利润']]
  for (let i = 0; i < chartMonths.value.length; i++) {
    rows.push([chartMonths.value[i], monthlyIncome.value[i].toFixed(2), monthlyExpense.value[i].toFixed(2), monthlyProfit.value[i].toFixed(2)])
  }
  rows.push(['合计', yearIncome.value, yearExpense.value, yearBalance.value])
  let csv = '\uFEFF'
  rows.forEach(r => csv += r.join(',') + '\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `收支报表_${selectedYear.value}.csv`; a.click()
  URL.revokeObjectURL(url)
}

watch(() => bills.value, () => loadData(), { deep: true, immediate: true })
</script>

<style scoped>
.filter-row { margin-bottom: 16px; display: flex; gap: 10px; align-items: center; }
.green { color: #16a34a; }
.red { color: #dc2626; }
.warn-card { border-left: 4px solid #f59e0b; }
.chart-container { padding: 10px 0; }
.chart-legend { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; }
.legend-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; margin-right: 4px; }
.legend-dot.income { background: #07c160; }
.legend-dot.expense { background: #ff4d4f; }
.legend-dot.profit { background: #1890ff; }
.line-chart { width: 100%; height: auto; }
.chart-labels { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 6px; padding: 0 10px; }
.bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 200px; }
.bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; }
.bar-wrapper { display: flex; align-items: flex-end; gap: 4px; height: 160px; }
.bar { width: 20px; border-radius: 4px 4px 0 0; transition: height 0.3s; }
.income-bar { background: #07c160; }
.expense-bar { background: #ff4d4f; }
.bar-label { font-size: 11px; color: #64748b; margin-top: 6px; }
.pie-container { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.pie-svg { width: 160px; height: 160px; flex-shrink: 0; }
circle { transition: stroke-dasharray 0.5s, stroke-dashoffset 0.5s; }
.pie-legend { display: flex; flex-wrap: wrap; gap: 8px; flex-direction: column; }
.pie-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.pie-dot { width: 10px; height: 10px; border-radius: 50%; }
</style>