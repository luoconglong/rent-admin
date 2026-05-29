<!-- src/views/PropertyPay.vue -->
<template>
  <div>
    <div class="page-head">
      <h2>🏢 物业费管理</h2>
      <div class="head-btns">
        <button class="btn primary" @click="$emit('openPropertySettings')">⚙️ 物业费设置</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">{{ pendingCount }}</div><div class="stat-label">待缴笔数</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ pendingTotal }}</div><div class="stat-label">待缴金额</div></div>
      <div class="stat-card"><div class="stat-num">{{ paidCount }}</div><div class="stat-label">已缴笔数</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ paidTotal }}</div><div class="stat-label">已缴金额</div></div>
    </div>

    <div class="tab-bar">
      <span :class="['tab-item', { active: tab === 'pending' }]" @click="tab = 'pending'">待缴物业费</span>
      <span :class="['tab-item', { active: tab === 'paid' }]" @click="tab = 'paid'">已缴记录</span>
    </div>

    <div v-if="tab === 'pending'">
      <div v-if="pendingList.length === 0" class="empty">暂无待缴物业费</div>
      <table class="tbl" v-else>
        <thead><tr><th>对象</th><th>周期</th><th>金额</th><th>下次缴费日</th><th>剩余天数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="p in pendingList" :key="p.id" :class="p.remainDays < 0 ? 'row-overdue' : p.remainDays <= 7 ? 'row-warn' : ''">
            <td>{{ p.target_name || p.room_id }}</td>
            <td>{{ cycleText(p.cycle) }}</td>
            <td>¥{{ p.amount }}</td>
            <td>{{ p.next_pay_date || '-' }}</td>
            <td :class="p.remainDays < 0 ? 'red' : ''">{{ p.remainDays < 0 ? '逾期' + Math.abs(p.remainDays) + '天' : p.remainDays === 0 ? '今天到期' : '剩' + p.remainDays + '天' }}</td>
            <td><button class="btn-sm green" @click="doPay(p)">确认缴费</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab === 'paid'">
      <div v-if="paidList.length === 0" class="empty">暂无记录</div>
      <table class="tbl" v-else>
        <thead><tr><th>对象</th><th>金额</th><th>缴费时间</th></tr></thead>
        <tbody>
          <tr v-for="r in paidList" :key="r.id">
            <td>{{ r.roominfo || r.tenantname || '-' }}</td>
            <td>¥{{ r.amount }}</td>
            <td>{{ formatTime(r.time) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { propertySettings, expends, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const tab = ref('pending')

const cycleMap = { 'monthly': '月付', 'quarterly': '季付', 'yearly': '年付' }
function cycleText(c) { return cycleMap[c] || c || '-' }

const pendingList = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return propertySettings.value.map(p => {
    const nextDate = p.next_pay_date ? new Date(p.next_pay_date) : null
    const remainDays = nextDate ? Math.ceil((nextDate - today) / 86400000) : null
    return { ...p, remainDays }
  }).sort((a, b) => (a.remainDays ?? 999) - (b.remainDays ?? 999))
})

const pendingCount = computed(() => pendingList.value.length)
const pendingTotal = computed(() => pendingList.value.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2))

const paidList = computed(() => {
  return expends.value
    .filter(e => e.type === '物业费')
    .sort((a, b) => new Date(b.time) - new Date(a.time))
})

const paidCount = computed(() => paidList.value.length)
const paidTotal = computed(() => paidList.value.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2))

async function doPay(p) {
  if (!confirm(`确认缴纳 ${p.target_name || p.room_id} 的物业费 ¥${p.amount}？`)) return

  const today = new Date()
  let nextDate = new Date(p.next_pay_date || today)
  if (p.cycle === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
  else if (p.cycle === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3)
  else if (p.cycle === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)
  const nextStr = nextDate.toISOString().slice(0, 10)

  await supabase.from('property_settings').update({ next_pay_date: nextStr }).eq('id', p.id)

  await supabase.from('expends').insert({
    id: Date.now().toString(),
    type: '物业费', amount: p.amount, isincome: false,
    time: new Date().toISOString(),
    roominfo: p.target_name || p.room_id
  })

  loadAll()
}

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.tab-bar { display: flex; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 8px; border-radius: 8px; font-size: 14px; cursor: pointer; color: #64748b; }
.tab-item.active { background: white; color: #1e6f5c; font-weight: 600; }
.row-overdue { background: #fef2f2; }
.row-warn { background: #fffbeb; }
.red { color: #dc2626; font-weight: 600; }
</style>