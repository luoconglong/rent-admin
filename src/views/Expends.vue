<template>
  <div>
    <div class="page-head">
      <h2>💸 支出明细</h2>
      <button class="btn primary" @click="showForm = true">+ 记一笔</button>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">¥{{ totalIncome }}</div><div class="stat-label">总收入</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ totalExpense }}</div><div class="stat-label">总支出</div></div>
      <div class="stat-card"><div class="stat-num" :class="balance >= 0 ? 'green' : 'red'">¥{{ balance }}</div><div class="stat-label">结余</div></div>
    </div>

    <div v-if="!filtered.length" class="empty">暂无记录</div>
    <div v-for="e in filtered" :key="e.id" class="expend-card">
      <div class="card-top">
        <div :class="['type-tag', e.is_income ? 'in' : 'out']">{{ e.is_income ? '收' : '支' }}</div>
        <div class="card-info">
          <div class="card-type">{{ e.type }}</div>
          <div class="card-meta">{{ e.room_info || '-' }} · {{ e.tenant_name || '-' }}</div>
          <div class="card-note" v-if="e.detail">{{ e.detail }}</div>
        </div>
        <div class="card-right">
          <div :class="['card-amount', e.is_income ? 'green' : 'red']">{{ e.is_income ? '+' : '-' }}¥{{ Number(e.amount).toFixed(2) }}</div>
          <div class="card-date">{{ formatDate(e.time) }}</div>
        </div>
      </div>
    </div>

    <div class="mask" v-if="showForm" @click.self="showForm = false">
      <div class="dialog">
        <h3>记一笔</h3>
        <div class="form-item"><label>类型</label><select v-model="form.is_income" class="input"><option :value="false">支出</option><option :value="true">收入</option></select></div>
        <div class="form-item"><label>类别</label><input v-model="form.type" class="input" placeholder="如：维修费、水费充值" /></div>
        <div class="form-item"><label>金额</label><input v-model.number="form.amount" type="number" class="input" /></div>
        <div class="form-item"><label>房间</label><input v-model="form.room_info" class="input" placeholder="选填" /></div>
        <div class="form-item"><label>租客</label><input v-model="form.tenant_name" class="input" placeholder="选填" /></div>
        <div class="form-item"><label>备注</label><input v-model="form.detail" class="input" placeholder="选填" /></div>
        <div class="dialog-btns"><button class="btn" @click="showForm = false">取消</button><button class="btn primary" @click="save">保存</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { expends, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const showForm = ref(false)
const form = reactive({ is_income: false, type: '', amount: 0, room_info: '', tenant_name: '', detail: '' })

const totalIncome = computed(() => expends.value.filter(e => e.is_income).reduce((s, e) => s + Number(e.amount), 0).toFixed(2))
const totalExpense = computed(() => expends.value.filter(e => !e.is_income).reduce((s, e) => s + Number(e.amount), 0).toFixed(2))
const balance = computed(() => (Number(totalIncome.value) - Number(totalExpense.value)).toFixed(2))
const filtered = computed(() => [...expends.value].sort((a, b) => new Date(b.time) - new Date(a.time)))

function formatDate(t) {
  if (!t) return '-'
  const d = new Date(t)
  return `${d.getMonth()+1}-${d.getDate()}`
}

async function save() {
  if (!form.type || !form.amount) return alert('请填写类别和金额')
  await supabase.from('expends').insert({
    type: form.type, amount: form.amount, is_income: form.is_income,
    room_info: form.room_info, tenant_name: form.tenant_name, detail: form.detail,
    time: new Date().toISOString()
  })
  showForm.value = false
  Object.assign(form, { is_income: false, type: '', amount: 0, room_info: '', tenant_name: '', detail: '' })
  loadAll()
}
</script>

<style scoped>
.expend-card { background: white; border-radius: 12px; padding: 14px; margin-bottom: 8px; border: 1px solid #e8ecf1; }
.card-top { display: flex; align-items: flex-start; gap: 12px; }
.type-tag { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; }
.type-tag.in { background: #dcfce7; color: #16a34a; }
.type-tag.out { background: #fef2f2; color: #dc2626; }
.card-info { flex: 1; }
.card-type { font-size: 14px; font-weight: 500; }
.card-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
.card-note { font-size: 12px; color: #94a3b8; margin-top: 2px; font-style: italic; }
.card-right { text-align: right; flex-shrink: 0; }
.card-amount { font-size: 16px; font-weight: 600; }
.card-amount.green { color: #16a34a; }
.card-amount.red { color: #dc2626; }
.card-date { font-size: 12px; color: #94a3b8; }
</style>