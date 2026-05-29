<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:550px;max-height:90vh;overflow-y:auto">
      <h3>💳 业主待付账单</h3>
      <table class="tbl" v-if="list.length">
        <thead><tr><th>业主</th><th>月租</th><th>周期</th><th>下次付款日</th><th>剩余天数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="o in list" :key="o.id">
            <td>{{ o.name }}</td>
            <td>¥{{ o.monthlyrent }}</td>
            <td>{{ o.cycleText }}</td>
            <td>{{ o.nextPayDate }}</td>
            <td :class="o.remainDays <= 3 ? 'red' : ''">{{ o.remainDays <= 0 ? '已逾期' + Math.abs(o.remainDays) + '天' : '剩' + o.remainDays + '天' }}</td>
            <td><button class="btn-sm green" @click="pay(o)">确认付款</button></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无待付业主</div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { owners, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'
const emit = defineEmits(['close'])

const cycleMap = { 'monthly': '月付', 'quarterly': '季付', 'yearly': '年付' }

const list = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return owners.value.map(o => {
    const cycle = o.rentcycle || 'monthly'
    const paymentDay = o.paymentday || 1
    const startMonth = o.startmonth || 1
    const cycleText = cycleMap[cycle] || '月付'

    // 计算下次付款日
    let nextPay = new Date(today.getFullYear(), startMonth - 1, paymentDay)
    while (nextPay <= today) {
      if (cycle === 'quarterly') nextPay.setMonth(nextPay.getMonth() + 3)
      else if (cycle === 'yearly') nextPay.setFullYear(nextPay.getFullYear() + 1)
      else nextPay.setMonth(nextPay.getMonth() + 1)
    }
    const remainDays = Math.ceil((nextPay - today) / 86400000)
    const nextPayDate = nextPay.getFullYear() + '-' + String(nextPay.getMonth() + 1).padStart(2, '0') + '-' + String(nextPay.getDate()).padStart(2, '0')

    return { ...o, cycleText, nextPayDate, remainDays }
  }).sort((a, b) => a.remainDays - b.remainDays)
})

async function pay(o) {
  if (!confirm(`确认支付 ${o.name} ¥${o.monthlyrent}？`)) return
  await supabase.from('expends').insert({
    id: Date.now().toString(),
    type: '业主付款', amount: o.monthlyrent, isincome: false,
    time: new Date().toISOString(), tenantname: o.name
  })
  loadAll(); emit('close')
}
</script>
<style scoped>
.red { color: #dc2626; font-weight: 600; }
</style>