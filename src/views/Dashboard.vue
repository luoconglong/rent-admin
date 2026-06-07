<template>
  <div>
    <h2>📊 经营概览</h2>

    <div class="card-grid">
      <div class="stat-card red-bg">
        <div class="stat-icon">💰</div>
        <div class="stat-num">¥{{ stats.pendingRent }}</div>
        <div class="stat-label">待收租金</div>
        <div class="stat-sub">{{ stats.pendingCount }}笔待收</div>
      </div>
      <div class="stat-card blue-bg">
        <div class="stat-icon">🏠</div>
        <div class="stat-num">{{ stats.vacantCount }}</div>
        <div class="stat-label">空置房间</div>
        <div class="stat-sub">可出租</div>
      </div>
      <div class="stat-card orange-bg">
        <div class="stat-icon">⏰</div>
        <div class="stat-num">{{ stats.expiringCount }}</div>
        <div class="stat-label">即将到期</div>
        <div class="stat-sub">30天内</div>
      </div>
      <div class="stat-card green-bg">
        <div class="stat-icon">📈</div>
        <div class="stat-num">¥{{ stats.monthIncome }}</div>
        <div class="stat-label">本月已收</div>
        <div class="stat-sub">到账金额</div>
      </div>
      <div class="stat-card teal-bg">
        <div class="stat-icon">🧑</div>
        <div class="stat-num">{{ stats.rentingCount }}</div>
        <div class="stat-label">在住租客</div>
        <div class="stat-sub">{{ stats.houseCount }}栋楼</div>
      </div>
      <div class="stat-card purple-bg">
        <div class="stat-icon">📅</div>
        <div class="stat-num">{{ stats.todayExpire }}</div>
        <div class="stat-label">今日到期</div>
        <div class="stat-sub">需续租/退租</div>
      </div>
    </div>

    <div class="card" v-if="todoList.length">
      <h3>⚠️ 待处理事项</h3>
      <div v-for="(item, i) in todoList" :key="i" class="todo-item">
        <span :class="['todo-dot', item.level]"></span>
        <span class="todo-text">{{ item.text }}</span>
        <span class="todo-action" @click="item.action">{{ item.btn }}</span>
      </div>
    </div>
    <div v-else class="card">
      <h3>⚠️ 待处理事项</h3>
      <div class="empty">暂无待处理事项 🎉</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { stats, expiringList, urgentBills, tenants, bills, loadAll } from '../stores/data.js'

const todoList = computed(() => {
  const list = []
  const today = new Date(); today.setHours(0,0,0,0)

  // 逾期账单和今天到期
  for (const b of bills.value) {
    if (b.status !== 'pending' && b.status !== '待收') continue
    const unpaid = (b.total_amount || 0) - (b.paid_amount || 0)
    if (unpaid <= 0) continue
    const t = tenants.value.find(x => x.id == b.tenant_id)
    let days = 0
    if (b.due_date) {
      days = Math.ceil((today - new Date(b.due_date)) / 86400000)
    } else if (b.bill_month) {
      const d = t ? (t.payment_day || 1) : 1
      const dd = new Date(parseInt(b.bill_month.split('-')[0]), parseInt(b.bill_month.split('-')[1]) - 1, d)
      days = Math.ceil((today - dd) / 86400000)
    }
    if (days >= 0) {
      const text = days === 0
        ? `${t?.name || '未知'} ${t?.room_no || ''} ${b.category} ¥${unpaid.toFixed(0)} 今天到期`
        : `${t?.name || '未知'} ${t?.room_no || ''} ${b.category} ¥${unpaid.toFixed(0)} 超期${days}天`
      list.push({ level: days === 0 ? 'yellow' : 'red', text, btn: '收款', action: () => {} })
    }
  }

  // 到期合同
  for (const t of tenants.value) {
    if (t.status !== 'renting' && t.status !== '在住') continue
    if (!t.end_date) continue
    const ed = new Date(t.end_date); ed.setHours(0,0,0,0)
    const diff = Math.ceil((ed - today) / 86400000)
    if (diff <= 30 && diff > 0) {
      list.push({ level: 'yellow', text: `${t.name} ${t.room_no || ''} 合同${t.end_date}到期 剩${diff}天`, btn: '查看', action: () => {} })
    }
  }

  return list.slice(0, 8)
})

onMounted(() => { loadAll() })
</script>

<style scoped>
.card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.stat-card { border-radius: 16px; padding: 20px; color: white; position: relative; overflow: hidden; }
.stat-card.red-bg { background: linear-gradient(135deg, #ef4444, #dc2626); }
.stat-card.blue-bg { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.stat-card.orange-bg { background: linear-gradient(135deg, #f97316, #ea580c); }
.stat-card.green-bg { background: linear-gradient(135deg, #22c55e, #16a34a); }
.stat-card.teal-bg { background: linear-gradient(135deg, #14b8a6, #0d9488); }
.stat-card.purple-bg { background: linear-gradient(135deg, #a855f7, #9333ea); }
.stat-icon { font-size: 28px; margin-bottom: 8px; }
.stat-num { font-size: 28px; font-weight: 700; }
.stat-label { font-size: 14px; opacity: 0.9; }
.stat-sub { font-size: 12px; opacity: 0.7; margin-top: 4px; }

.todo-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.todo-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.todo-dot.red { background: #ef4444; }
.todo-dot.yellow { background: #f59e0b; }
.todo-dot.green { background: #22c55e; }
.todo-text { flex: 1; font-size: 14px; }
.todo-action { color: #1e6f5c; font-size: 13px; cursor: pointer; font-weight: 500; }
</style>