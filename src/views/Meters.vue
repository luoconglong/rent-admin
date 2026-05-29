<template>
  <div>
    <div class="page-head">
      <h2>⚡ 水电物业</h2>
      <div class="head-btns">
        <button class="btn" @click="$emit('openCharge')">💰 充值</button>
        <button class="btn" @click="$emit('openDeduct')">📝 抄表扣费</button>
        <button class="btn" @click="$emit('openRemain')">🔻 剩余扣减</button>
        <button class="btn" @click="$emit('openDing')">🔌 云丁余额</button>
        <button class="btn primary" @click="$emit('openDialog', 'meter')">+ 添加表具</button>
      </div>
    </div>

    <!-- 表具管理卡片 -->
    <div class="card" v-if="meterList.length">
      <h3>📊 表具管理</h3>
      <table class="tbl">
        <thead><tr><th>名称</th><th>类型</th><th>当前读数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="m in meterList" :key="m.id">
            <td>{{ m.metername || '-' }}</td>
            <td>{{ m.type === 'water' ? '💧 水表' : '⚡ 电表' }}</td>
            <td>{{ m.currentreading || 0 }}</td>
            <td>
              <button class="btn-sm" @click="editMeter(m)">编辑</button>
              <button class="btn-sm danger" @click="delMeter(m.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑表具弹窗 -->
    <div class="mask" v-if="editingMeter" @click.self="editingMeter = null">
      <div class="dialog">
        <h3>编辑表具</h3>
        <div class="form-item"><label>名称</label><input v-model="editMeterForm.metername" class="input" /></div>
        <div class="form-item"><label>当前读数</label><input v-model.number="editMeterForm.currentreading" type="number" class="input" /></div>
        <div class="dialog-btns">
          <button class="btn" @click="editingMeter = null">取消</button>
          <button class="btn primary" @click="saveMeter">保存</button>
        </div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card water"><div class="stat-num">¥{{ monthWater }}</div><div class="stat-label">本月水费</div><div class="stat-sub">{{ monthWaterUsage }} 吨</div></div>
      <div class="stat-card electric"><div class="stat-num">¥{{ monthElectric }}</div><div class="stat-label">本月电费</div><div class="stat-sub">{{ monthElectricUsage }} 度</div></div>
      <div class="stat-card water"><div class="stat-num">¥{{ yearWater }}</div><div class="stat-label">本年水费</div><div class="stat-sub">{{ yearWaterUsage }} 吨</div></div>
      <div class="stat-card electric"><div class="stat-num">¥{{ yearElectric }}</div><div class="stat-label">本年电费</div><div class="stat-sub">{{ yearElectricUsage }} 度</div></div>
    </div>

    <div class="filter-row">
      <select v-model="houseId" class="input" @change="filterRecords"><option value="">全部楼栋</option><option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option></select>
      <input v-model="filterMonth" type="month" class="input" @change="filterRecords" />
      <input v-model="searchText" placeholder="搜索房间..." class="input" @input="filterRecords" />
      <select v-model="filterType" class="input" @change="filterRecords"><option value="all">全部类型</option><option value="water">水费</option><option value="electric">电费</option></select>
    </div>

    <div v-if="filteredRecords.length === 0" class="empty">暂无记录</div>
    <div v-for="(r, idx) in filteredRecords" :key="r.id" class="meter-card" @click="toggle(idx)">
      <div class="meter-head">
        <span :class="['dot', r.type === 'water' ? 'blue' : 'yellow']"></span>
        <span class="meter-room">{{ r.roomName }}</span>
        <span class="meter-amount">¥{{ r.amount }}</span>
        <span class="meter-arrow">{{ r._expanded ? '▼' : '▶' }}</span>
      </div>
      <div class="meter-body" v-if="r._expanded">
        <div class="meter-row"><span>日期</span><span>{{ r.date }}</span></div>
        <div class="meter-row"><span>类型</span><span>{{ r.type === 'water' ? '水费' : '电费' }}</span></div>
        <div class="meter-row"><span>用量</span><span>{{ r.usage }} {{ r.type === 'water' ? '吨' : '度' }}</span></div>
        <div class="meter-row"><span>上次读数</span><span>{{ r.lastReading }}</span></div>
        <div class="meter-row"><span>本次读数</span><span>{{ r.currentReading }}</span></div>
        <div class="meter-row"><span>金额</span><span>¥{{ r.amount }}</span></div>
        <button class="btn-sm danger" @click.stop="revert(r)">撤销</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { meters, bills, rooms, houses, tenants, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const houseId = ref('')
const filterMonth = ref('')
const searchText = ref('')
const filterType = ref('all')
const editingMeter = ref(null)
const editMeterForm = ref({})

// 表具列表
const meterList = computed(() => {
  return meters.value.filter(m => m.type === 'water' || m.type === 'electric')
})

function editMeter(m) {
  editingMeter.value = m.id
  editMeterForm.value = { ...m }
}

async function saveMeter() {
  await supabase.from('meters').update({
    metername: editMeterForm.value.metername,
    currentreading: editMeterForm.value.currentreading
  }).eq('id', editingMeter.value)
  editingMeter.value = null
  loadAll()
}

async function delMeter(id) {
  if (!confirm('确认删除这个表具？')) return
  await supabase.from('meters').delete().eq('id', id)
  loadAll()
}

const stats = computed(() => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const roomMap = {}, houseMap = {}, tenantMap = {}
  rooms.value.forEach(r => { roomMap[String(r.id)] = r })
  houses.value.forEach(h => { houseMap[String(h.id)] = h })
  tenants.value.forEach(t => { tenantMap[String(t.id)] = t })

  let mWater = 0, mElec = 0, yWater = 0, yElec = 0
  let mWaterUse = 0, mElecUse = 0, yWaterUse = 0, yElecUse = 0
  const records = []

  for (const m of meters.value) {
    if (m.type !== 'electric' && m.type !== 'water') continue
    const type = m.type
    const usage = m.usage || 0
    const amount = m.amount || 0
    if (usage <= 0 || amount <= 0) continue

    const d = new Date(m.date || m.created_at)
    const isCurMonth = d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth
    const isCurYear = d.getFullYear() === currentYear

    if (type === 'water') {
      if (isCurMonth) { mWater += amount; mWaterUse += usage }
      if (isCurYear) { yWater += amount; yWaterUse += usage }
    } else {
      if (isCurMonth) { mElec += amount; mElecUse += usage }
      if (isCurYear) { yElec += amount; yElecUse += usage }
    }

    const room = roomMap[String(m.room_id)]
    const house = room ? houseMap[String(room.house_id)] : null
    let roomName = room && house ? `${house.address} ${room.room_no}` : (m.room_id || '未知')
    const tenant = Object.values(tenantMap).find(t => String(t.room_id) === String(m.room_id) && t.status === 'renting')
    if (tenant) roomName += `（${tenant.name}）`

    records.push({
      id: m.id, roomId: m.room_id || '', roomName,
      houseId: room?.house_id || '', type, date: m.date || m.created_at,
      lastReading: m.lastreading || 0, currentReading: m.currentreading || 0,
      usage, amount: amount.toFixed(2), source: 'meter', _expanded: false
    })
  }

  for (const b of bills.value) {
    if (b.category !== '水费' && b.category !== '电费') continue
    const unpaid = (b.total_amount || 0) - (b.paid_amount || 0)
    if (unpaid > 0) continue
    const type = b.category === '水费' ? 'water' : 'electric'
    const amount = b.total_amount || 0
    if (amount <= 0) continue
    const bDate = new Date(b.bill_month + '-01')
    const isCurMonth = bDate.getFullYear() === currentYear && (bDate.getMonth() + 1) === currentMonth
    const isCurYear = bDate.getFullYear() === currentYear

    if (type === 'water') {
      if (isCurMonth) mWater += amount
      if (isCurYear) yWater += amount
    } else {
      if (isCurMonth) mElec += amount
      if (isCurYear) yElec += amount
    }

    const room = roomMap[String(b.room_id)]
    const house = room ? houseMap[String(room.house_id)] : null
    let roomName = room && house ? `${house.address} ${room.room_no}` : (b.room_no || '未知')
    const tName = Object.values(tenantMap).find(tn => String(tn.id) === String(b.tenant_id))?.name
    if (tName) roomName += `（${tName}）`

    records.push({
      id: b.id, roomId: b.room_id || '', roomName,
      houseId: room?.house_id || '', type, date: b.bill_month || '',
      lastReading: 0, currentReading: 0, usage: 0,
      amount: amount.toFixed(2), source: 'bill', _expanded: false
    })
  }

  records.sort((a, b) => a.date > b.date ? -1 : 1)

  return {
    mWater: mWater.toFixed(2), mElec: mElec.toFixed(2),
    yWater: yWater.toFixed(2), yElec: yElec.toFixed(2),
    mWaterUse: mWaterUse.toFixed(1), mElecUse: mElecUse.toFixed(1),
    yWaterUse: yWaterUse.toFixed(1), yElecUse: yElecUse.toFixed(1),
    allRecords: records
  }
})

const monthWater = computed(() => stats.value.mWater)
const monthElectric = computed(() => stats.value.mElec)
const yearWater = computed(() => stats.value.yWater)
const yearElectric = computed(() => stats.value.yElec)
const monthWaterUsage = computed(() => stats.value.mWaterUse)
const monthElectricUsage = computed(() => stats.value.mElecUse)
const yearWaterUsage = computed(() => stats.value.yWaterUse)
const yearElectricUsage = computed(() => stats.value.yElecUse)

const filteredRecords = ref([])

function filterRecords() {
  let list = stats.value.allRecords
  if (houseId.value) list = list.filter(r => String(r.houseId) === String(houseId.value))
  if (filterMonth.value) list = list.filter(r => r.date && r.date.startsWith(filterMonth.value))
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(r => r.roomName.toLowerCase().includes(kw))
  }
  if (filterType.value === 'water') list = list.filter(r => r.type === 'water')
  if (filterType.value === 'electric') list = list.filter(r => r.type === 'electric')
  filteredRecords.value = list
}

function toggle(idx) {
  filteredRecords.value[idx]._expanded = !filteredRecords.value[idx]._expanded
}

async function revert(record) {
  if (!confirm('确认撤销这条记录？')) return
  if (record.source === 'meter') {
    await supabase.from('meters').delete().eq('id', record.id)
  } else {
    await supabase.from('bills').update({ status: 'pending', paid_amount: 0, paid_time: null }).eq('id', record.id)
  }
  loadAll()
}

watch(stats, () => filterRecords(), { immediate: true })
</script>

<style scoped>
.stat-card.water { border-left: 4px solid #3b82f6; }
.stat-card.electric { border-left: 4px solid #f59e0b; }
.stat-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.filter-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.filter-row .input { flex: 1; min-width: 120px; }
.meter-card { background: white; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; border: 1px solid #e8ecf1; cursor: pointer; }
.meter-head { display: flex; align-items: center; gap: 10px; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot.blue { background: #3b82f6; }
.dot.yellow { background: #f59e0b; }
.meter-room { flex: 1; font-size: 14px; }
.meter-amount { font-weight: 600; }
.meter-arrow { font-size: 12px; color: #94a3b8; }
.meter-body { margin-top: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
.meter-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #64748b; }
.btn-sm.danger { color: #dc2626; border-color: #fecaca; margin-top: 6px; }
</style>