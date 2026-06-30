<template>
  <div>
    <h2>📈 收支报表</h2>

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
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">¥{{ yearIncome }}</div><div class="stat-label">本年收入</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ yearExpense }}</div><div class="stat-label">本年支出</div></div>
      <div class="stat-card"><div class="stat-num" :class="yearBalance >= 0 ? 'green' : 'red'">¥{{ yearBalance }}</div><div class="stat-label">本年利润</div></div>
    </div>

    <div class="stat-grid">
      <div class="stat-card warn-card"><div class="stat-num">¥{{ pendingTotal }}</div><div class="stat-label">待收总额</div></div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>📈 月度收支趋势</h3>
      <div class="chart-container">
        <div class="chart-legend"><span class="legend-dot income"></span> 收入 <span class="legend-dot expense"></span> 支出</div>
        <div class="bar-chart">
          <div v-for="(m, idx) in chartMonths" :key="idx" class="bar-group">
            <div class="bar-wrapper">
              <div class="bar income-bar" :style="{ height: getBarHeight(monthlyIncome[idx]) }"></div>
              <div class="bar expense-bar" :style="{ height: getBarHeight(monthlyExpense[idx]) }"></div>
            </div>
            <div class="bar-label">{{ m }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { bills } from '../stores/data.js'

const selectedYear = ref(new Date().getFullYear())
const yearOptions = computed(() => {
  const cy = new Date().getFullYear()
  const years = []
  for (let y = cy; y >= cy - 3; y--) years.push(y)
  return years
})

const monthIncome = ref('0.00'), monthExpense = ref('0.00'), monthBalance = ref('0.00')
const yearIncome = ref('0.00'), yearExpense = ref('0.00'), yearBalance = ref('0.00')
const pendingTotal = ref('0.00')
const chartMonths = ref([]), monthlyIncome = ref([]), monthlyExpense = ref([])

function loadData() {
  const year = selectedYear.value
  const d = new Date()
  const cm = d.getMonth() + 1
  const cy = d.getFullYear()

  let mi = 0, yi = 0, me = 0, ye = 0, pt = 0
  const mIncome = [0,0,0,0,0,0,0,0,0,0,0,0]
  const mExpense = [0,0,0,0,0,0,0,0,0,0,0,0]
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

  for (const b of bills.value) {
    const unpaid = (b.total_amount || 0) - (b.paid_amount || 0)
    if (b.direction === 'income' && unpaid > 0) pt += unpaid

    const paid = b.paid_amount || 0
    if (paid > 0 && b.paid_time) {
      const pDate = new Date(b.paid_time)
      if (!isNaN(pDate.getTime()) && pDate.getFullYear() === year) {
        if (b.direction === 'income') {
          yi += paid
          if (pDate.getMonth() + 1 === cm && year === cy) mi += paid
          mIncome[pDate.getMonth()] += paid
        } else if (b.direction === 'expense') {
          ye += paid
          if (pDate.getMonth() + 1 === cm && year === cy) me += paid
          mExpense[pDate.getMonth()] += paid
        }
      }
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
  chartMonths.value = months.slice(0, showMonths)
  monthlyIncome.value = mIncome.slice(0, showMonths)
  monthlyExpense.value = mExpense.slice(0, showMonths)
}

function exportExcel() {
  const rows = [['月份', '收入', '支出', '利润']]
  for (let i = 0; i < chartMonths.value.length; i++) {
    rows.push([
      chartMonths.value[i],
      monthlyIncome.value[i].toFixed(2),
      monthlyExpense.value[i].toFixed(2),
      (monthlyIncome.value[i] - monthlyExpense.value[i]).toFixed(2)
    ])
  }
  rows.push(['合计', yearIncome.value, yearExpense.value, yearBalance.value])

  let csv = '\uFEFF'
  rows.forEach(r => csv += r.join(',') + '\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `收支报表_${selectedYear.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const maxVal = computed(() => {
  const all = [...monthlyIncome.value, ...monthlyExpense.value]
  return Math.max(...all, 1)
})
function getBarHeight(val) { return (val / maxVal.value) * 150 + 'px' }

watch(() => bills.value, () => loadData(), { deep: true, immediate: true })
</script>

<style scoped>
.filter-row { margin-bottom: 16px; display: flex; gap: 10px; align-items: center; }
.green { color: #16a34a; }
.red { color: #dc2626; }
.warn-card { border-left: 4px solid #f59e0b; }
.chart-container { padding: 10px 0; }
.chart-legend { display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; }
.legend-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; margin-right: 4px; }
.legend-dot.income { background: #07c160; }
.legend-dot.expense { background: #ff4d4f; }
.bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 200px; }
.bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; }
.bar-wrapper { display: flex; align-items: flex-end; gap: 4px; height: 160px; }
.bar { width: 16px; border-radius: 4px 4px 0 0; transition: height 0.3s; }
.income-bar { background: #07c160; }
.expense-bar { background: #ff4d4f; }
.bar-label { font-size: 11px; color: #64748b; margin-top: 6px; }
</style>