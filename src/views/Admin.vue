<template>
  <div>
    <div class="page-head">
      <h2>🔐 注册码管理</h2>
      <button class="btn primary" @click="generateCode">+ 生成注册码</button>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">¥{{ monthIncome }}</div><div class="stat-label">本月收入</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ totalIncome }}</div><div class="stat-label">累计收入</div></div>
      <div class="stat-card"><div class="stat-num">{{ activeCount }}</div><div class="stat-label">激活中</div></div>
      <div class="stat-card"><div class="stat-num">{{ expiringCount }}</div><div class="stat-label">即将到期</div></div>
    </div>

    <table class="tbl" v-if="codeHistory.length">
      <thead><tr><th>注册码</th><th>备注</th><th>价格</th><th>状态</th><th>到期</th><th>时间</th></tr></thead>
      <tbody>
        <tr v-for="c in codeHistory" :key="c.code">
          <td>{{ c.code }}</td><td>{{ c.note }}</td><td>¥{{ c.price }}</td>
          <td><span :class="['tag', c.status === '已使用' ? 'green' : 'gray']">{{ c.status }}</span></td>
          <td>{{ formatDate(c.expiresAt) }}</td><td>{{ c.time }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">暂无注册码</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const codeHistory = ref([])
const monthIncome = ref(0)
const totalIncome = ref(0)
const activeCount = ref(0)
const expiringCount = ref(0)

function formatDate(t) { return t ? new Date(t).toLocaleDateString('zh-CN') : '-' }

function loadData() {
  const data = JSON.parse(localStorage.getItem('codeHistory') || '[]')
  codeHistory.value = data
  const now = new Date(), cm = now.getMonth() + 1
  let mi = 0, ti = 0, ac = 0, ec = 0
  for (const c of data) {
    if (c.status === '已使用') {
      ti += c.price || 0; ac++
      try { if (new Date(c.time).getMonth() + 1 === cm) mi += c.price || 0 } catch(e) {}
    }
    if (c.expiresAt && c.status === '已使用') {
      const diff = Math.ceil((new Date(c.expiresAt) - now) / 86400000)
      if (diff <= 7 && diff >= 0) ec++
    }
  }
  monthIncome.value = mi; totalIncome.value = ti; activeCount.value = ac; expiringCount.value = ec
}

function generateCode() {
  const prices = [19, 49, 79, 99], days = [30, 90, 180, 365], labels = ['1个月 ¥19', '3个月 ¥49', '6个月 ¥79', '12个月 ¥99']
  const idx = parseInt(prompt(labels.join('\n') + '\n\n输入序号 1-4：') || '0')
  if (!idx || idx < 1 || idx > 4) return
  const i = idx - 1
  const note = prompt('输入备注（如：张三 138xxxx）：') || ''
  const code = 'RC_' + Date.now().toString(36).toUpperCase() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase()
  const expiresAt = new Date(Date.now() + days[i] * 86400000).toISOString()
  const data = JSON.parse(localStorage.getItem('codeHistory') || '[]')
  data.unshift({ code, note, time: new Date().toLocaleString(), status: '未使用', price: prices[i], expireDays: days[i], expiresAt })
  localStorage.setItem('codeHistory', JSON.stringify(data))
  loadData()
}

onMounted(loadData)
</script>