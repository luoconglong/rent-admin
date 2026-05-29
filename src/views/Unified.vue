<template>
  <div>
    <div class="page-head"><h2>📝 统一抄表</h2></div>

    <div class="tab-bar">
      <span :class="['tab-item', { active: meterType === 'water' }]" @click="switchType('water')">💧 水表</span>
      <span :class="['tab-item', { active: meterType === 'electric' }]" @click="switchType('electric')">⚡ 电表</span>
    </div>

    <div class="filter-row">
      <select v-model="houseId" class="input"><option value="">全部楼栋</option><option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option></select>
      <span>单价：</span><input v-model.number="unitPrice" type="number" step="0.1" class="input" style="width:90px" @change="savePrice" />
      <span>元/{{ meterType === 'water' ? '吨' : '度' }}</span>
    </div>

    <div v-if="filtered.length === 0" class="empty">暂无在住房间</div>

    <div v-for="(r, idx) in filtered" :key="r.roomId" class="card-row">
      <div class="info"><strong>{{ r.houseName }} {{ r.roomNo }}</strong><span>{{ r.tenantName }} · 上期：{{ r.lastReading }}</span></div>
      <div class="action">
        <input v-model="r.currentReading" type="number" placeholder="本期读数" class="input" style="width:100px" @input="calc(r)" />
        <span v-if="r.amount > 0" class="amt">¥{{ r.amount.toFixed(2) }}</span>
        <button v-if="r.amount > 0" class="btn-sm green" @click="paySingle(r)">收款</button>
      </div>
    </div>

    <div class="bottom-bar" v-if="total > 0">
      <span>共 {{ count }} 条 · ¥{{ total.toFixed(2) }}</span>
      <button class="btn primary" @click="saveAll">全部保存为待收</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { houses, rooms, tenants, meters, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const meterType = ref('water')
const houseId = ref('')
const unitPrice = ref(5.0)
const list = ref([])

function load() {
  const result = []
  for (const room of rooms.value) {
    if (room.status !== '在住') continue
    const tenant = tenants.value.find(t => String(t.room_id) === String(room.id) && t.status === 'renting')
    if (!tenant) continue
    const house = houses.value.find(h => String(h.id) === String(room.house_id))
    let last = 0
    for (let i = meters.value.length - 1; i >= 0; i--) {
      if (String(meters.value[i].room_id) === String(room.id) && meters.value[i].type === meterType.value) {
        last = meters.value[i].currentreading || 0; break
      }
    }
    result.push({ roomId: room.id, tenantId: tenant.id, tenantName: tenant.name, houseId: room.house_id, houseName: house?.address || '', roomNo: room.room_no, lastReading: last, currentReading: '', usage: 0, amount: 0 })
  }
  list.value = result
}

const filtered = computed(() => houseId.value ? list.value.filter(r => String(r.houseId) === String(houseId.value)) : list.value)
const total = computed(() => filtered.value.reduce((s, r) => s + (r.amount || 0), 0))
const count = computed(() => filtered.value.filter(r => r.amount > 0).length)

function calc(r) {
  const curr = parseFloat(r.currentReading) || 0
  const usage = curr - r.lastReading
  r.usage = usage > 0 ? usage : 0
  r.amount = usage > 0 ? usage * unitPrice.value : 0
}

function switchType(t) {
  meterType.value = t
  unitPrice.value = parseFloat(localStorage.getItem('meterPrice_' + t) || (t === 'water' ? 5 : 1.5))
  load()
}
function savePrice() { localStorage.setItem('meterPrice_' + meterType.value, unitPrice.value.toString()) }

async function doSave(r, status) {
  const curr = parseFloat(r.currentReading) || 0
  const usage = curr - r.lastReading
  const today = new Date().toISOString()
  await supabase.from('meters').insert({
    id: Date.now().toString(),
    type: meterType.value, room_id: r.roomId,
    lastreading: r.lastReading, currentreading: curr,
    usage, amount: r.amount, unitprice: unitPrice.value,
    date: today.slice(0,10)
  })
  await supabase.from('bills').insert({
    id: Date.now().toString() + '_bill',
    tenant_id: r.tenantId, room_id: r.roomId,
    category: meterType.value === 'water' ? '水费' : '电费',
    bill_month: today.slice(0,7),
    total_amount: r.amount, paid_amount: status === 'paid' ? r.amount : 0,
    status
  })
}

async function paySingle(r) {
  if (!confirm(`${r.houseName} ${r.roomNo} ¥${r.amount.toFixed(2)} 确认收款？`)) return
  await doSave(r, 'paid')
  alert('已收款')
  loadAll(); load()
}

async function saveAll() {
  const valid = filtered.value.filter(r => r.amount > 0)
  if (!valid.length) return alert('无有效记录')
  if (!confirm(`共 ${valid.length} 条 ¥${total.value.toFixed(2)} 保存为待收？`)) return
  for (const r of valid) await doSave(r, 'pending')
  alert('已保存')
  loadAll(); load()
}

switchType('water')
</script>

<style scoped>
.tab-bar { display: flex; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 10px; border-radius: 8px; font-size: 15px; cursor: pointer; }
.tab-item.active { background: white; font-weight: 600; }
.filter-row { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; font-size: 13px; }
.card-row { background: white; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; border: 1px solid #e8ecf1; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.info { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.action { display: flex; align-items: center; gap: 8px; }
.amt { font-weight: 700; font-size: 16px; color: #1e6f5c; }
.bottom-bar { position: sticky; bottom: 0; background: white; border-top: 2px solid #e8ecf1; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; border-radius: 12px 12px 0 0; }
</style>