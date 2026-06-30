<!-- src/views/Tenants.vue -->
<template>
  <div class="tenant-layout">
    <div class="tenant-list">
      <div class="page-head">
        <h2>🧑‍🤝‍🧑 租客管理</h2>
        <div class="head-btns">
          <input v-model="searchText" placeholder="搜索姓名/手机号/房间" class="input" @input="filterAndSearch" />
          <button class="btn primary" @click="$emit('openCheckin')">+ 办理入住</button>
        </div>
      </div>

      <div class="filter-tabs">
        <span v-for="f in filters" :key="f.key"
          :class="['filter-tab', { active: activeFilter === f.key }]"
          @click="activeFilter = f.key; filterAndSearch()">
          {{ f.label }} ({{ f.count }})
        </span>
      </div>

      <div v-if="filtered.length === 0" class="empty">暂无租客</div>
      <div v-for="t in filtered" :key="t.id" class="tenant-card"
        :class="{ selected: selectedTenant?.id === t.id }"
        @click="selectTenant(t.id)">
        <div class="tenant-main">
          <div class="tenant-avatar">{{ t.name.charAt(0) }}</div>
          <div class="tenant-info">
            <div class="tenant-name">{{ t.name }}</div>
            <div class="tenant-room">{{ t.houseName }} {{ t.roomNo }}</div>
            <div class="tenant-meta">
              <span>{{ t.phone }}</span>
              <span v-if="t.status === 'renting'">到期：{{ t.end_date }} ({{ expireText(t) }})</span>
            </div>
          </div>
          <div class="tenant-right">
            <span :class="['tag', t.status === 'renting' ? 'green' : 'gray']">{{ statusText(t) }}</span>
            <button v-if="t.status !== 'renting'" class="btn-sm danger" @click.stop="delTenantById(t.id)">删</button>
          </div>
        </div>
      </div>
    </div>

    <div class="tenant-drawer" v-if="selectedTenant">
      <div class="drawer-head">
        <h3>{{ selectedTenant.name }}</h3>
        <button class="btn-sm" @click="selectedTenant = null; editing = false">✕</button>
      </div>

      <template v-if="!editing">
        <div class="detail-section">
          <div class="detail-row"><span>手机号</span><span>{{ selectedTenant.phone }}</span></div>
          <div class="detail-row"><span>房间</span><span>{{ detailHouse }} {{ detailRoom }}</span></div>
          <div class="detail-row"><span>月租金</span><span>¥{{ selectedTenant.rent_amount }}</span></div>
          <div class="detail-row"><span>押金</span><span>¥{{ selectedTenant.deposit }}</span></div>
          <div class="detail-row"><span>入住</span><span>{{ selectedTenant.start_date }}</span></div>
          <div class="detail-row"><span>到期</span><span>{{ selectedTenant.end_date }} <span :class="remainClass">{{ remainText }}</span></span></div>
          <div class="detail-row"><span>付款日</span><span>每月{{ selectedTenant.payment_day }}号</span></div>
          <div class="detail-row"><span>水表底数</span><span>{{ waterReading }}</span></div>
          <div class="detail-row"><span>电表底数</span><span>{{ electricReading }}</span></div>
        </div>

        <div class="detail-section" v-if="pendingBills.length">
          <h4>待收账单 ({{ pendingBills.length }})</h4>
          <div v-for="b in pendingBills" :key="b.id" class="bill-row">
            <span>{{ b.category }} {{ b.bill_month }}</span>
            <span>¥{{ b.total_amount }}</span>
            <button class="btn-sm green" @click="doPay(b.id)">收款</button>
          </div>
        </div>

        <div class="detail-section" v-if="paidBills.length">
          <h4>已收账单 ({{ paidBills.length }})</h4>
          <div v-for="b in paidBills" :key="b.id" class="bill-row">
            <span>{{ b.category }} {{ b.bill_month }}</span>
            <span>¥{{ b.total_amount }}</span>
            <span style="font-size:12px;color:#64748b">{{ formatTime(b.paid_time) }}</span>
          </div>
        </div>

        <div class="drawer-actions">
          <button v-if="selectedTenant?.status === 'renting'" class="btn" @click="startEdit">编辑</button>
          <button v-if="selectedTenant?.status === 'renting'" class="btn danger" @click="$emit('checkout', selectedTenant.id); selectedTenant = null">退租</button>
          <button v-if="selectedTenant?.status === 'moved'" class="btn danger" @click="delTenant">删除租客</button>
        </div>
      </template>

      <div v-if="editing" class="detail-section">
        <div class="form-item"><label>姓名</label><input v-model="editForm.name" class="input" /></div>
        <div class="form-item"><label>手机号</label><input v-model="editForm.phone" class="input" /></div>
        <div class="form-item">
          <label>房间</label>
          <select v-model="editForm.room_id" class="input">
            <option v-for="r in allRooms" :key="r.id" :value="r.id">{{ r.houseName }} {{ r.room_no }} ({{ r.status === 'rented' && r.tenant_id !== selectedTenant?.id ? '占用' : '可用' }})</option>
          </select>
        </div>
        <div class="form-item"><label>月租金</label><input v-model.number="editForm.rent_amount" type="number" class="input" /></div>
        <div class="form-item"><label>押金</label><input v-model.number="editForm.deposit" type="number" class="input" /></div>
        <div class="form-item"><label>入住日期</label><input v-model="editForm.start_date" type="date" class="input" /></div>
        <div class="form-item"><label>到期日期</label><input v-model="editForm.end_date" type="date" class="input" /></div>
        <div class="form-item"><label>付款日</label><input v-model.number="editForm.payment_day" type="number" min="1" max="31" class="input" /></div>
        <div class="drawer-actions">
          <button class="btn" @click="cancelEdit">取消</button>
          <button class="btn primary" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { tenants, houses, rooms, bills, meters, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const emit = defineEmits(['openCheckin', 'checkout'])

const searchText = ref('')
const activeFilter = ref('all')
const selectedTenant = ref(null)
const editing = ref(false)
const editForm = ref({})

const allRooms = computed(() => rooms.value.map(r => {
  const house = houses.value.find(h => String(h.id) === String(r.house_id))
  return { ...r, houseName: house?.address || '' }
}))

const enriched = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return tenants.value.map(t => {
    const room = rooms.value.find(r => String(r.id) === String(t.room_id))
    const house = houses.value.find(h => String(h.id) === String(room?.house_id))
    let expireDays = null
    if (t.end_date && t.status === 'renting') {
      const end = new Date(t.end_date); end.setHours(0, 0, 0, 0)
      expireDays = Math.ceil((end - today) / 86400000)
    }
    return { ...t, roomNo: room?.room_no || '', houseName: house?.address || '', expireDays }
  })
})

const filters = computed(() => {
  let renting = 0, expiring = 0, expired = 0
  for (const t of enriched.value) {
    if (t.status === 'renting') { renting++; if (t.expireDays !== null && t.expireDays >= 0 && t.expireDays <= 30) expiring++ }
    else { expired++ }
  }
  return [
    { key: 'all', label: '全部', count: enriched.value.length },
    { key: 'renting', label: '在住', count: renting },
    { key: 'expiring', label: '即将到期', count: expiring },
    { key: 'expired', label: '退租', count: expired },
  ]
})

const filtered = ref([])

function filterAndSearch() {
  let list = enriched.value
  if (activeFilter.value === 'renting') list = list.filter(t => t.status === 'renting')
  if (activeFilter.value === 'expired') list = list.filter(t => t.status !== 'renting')
  if (activeFilter.value === 'expiring') list = list.filter(t => t.status === 'renting' && t.expireDays !== null && t.expireDays >= 0 && t.expireDays <= 30)
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(t => t.name.toLowerCase().includes(kw) || (t.phone || '').includes(kw) || t.roomNo.includes(kw) || t.houseName.toLowerCase().includes(kw))
  }
  filtered.value = list
}

function statusText(t) {
  if (t.status === 'renting') {
    if (t.expireDays !== null && t.expireDays < 0) return '已过期'
    if (t.expireDays !== null && t.expireDays <= 30) return '将到期'
    return '在住'
  }
  return '已退租'
}

function expireText(t) {
  if (t.status !== 'renting' || t.expireDays === null) return ''
  if (t.expireDays < 0) return `超期${Math.abs(t.expireDays)}天`
  if (t.expireDays === 0) return '今天到期'
  return `剩${t.expireDays}天`
}

watch(enriched, () => filterAndSearch(), { deep: true, immediate: true })

const detailHouse = ref('')
const detailRoom = ref('')
const waterReading = ref('-')
const electricReading = ref('-')
const pendingBills = computed(() => {
  if (!selectedTenant.value) return []
  return bills.value.filter(b => String(b.tenant_id) === String(selectedTenant.value.id) && b.status === 'pending')
})
const paidBills = computed(() => {
  if (!selectedTenant.value) return []
  return bills.value.filter(b => String(b.tenant_id) === String(selectedTenant.value.id) && b.status === 'paid')
})

const remainClass = computed(() => {
  if (!selectedTenant.value?.end_date) return ''
  const d = new Date(selectedTenant.value.end_date); d.setHours(0,0,0,0)
  const diff = Math.ceil((d - new Date()) / 86400000)
  if (diff < 0) return 'red'; if (diff <= 30) return 'warn'; return 'green'
})

const remainText = computed(() => {
  if (!selectedTenant.value?.end_date) return ''
  const d = new Date(selectedTenant.value.end_date); d.setHours(0,0,0,0)
  const diff = Math.ceil((d - new Date()) / 86400000)
  if (diff < 0) return `(超期${-diff}天)`; if (diff === 0) return '(今天到期)'; return `(剩${diff}天)`
})

function selectTenant(id) {
  const t = tenants.value.find(x => String(x.id) === String(id))
  if (!t) return
  selectedTenant.value = t
  editing.value = false
  const room = rooms.value.find(r => String(r.id) === String(t.room_id))
  detailRoom.value = room?.room_no || ''
  detailHouse.value = houses.value.find(h => String(h.id) === String(room?.house_id))?.address || ''

  const wm = meters.value.filter(m => String(m.room_id) === String(t.room_id) && m.type === 'water').pop()
  const em = meters.value.filter(m => String(m.room_id) === String(t.room_id) && m.type === 'electric').pop()
  waterReading.value = wm ? (wm.current_reading || '-') : (t.water_reading || '-')
  electricReading.value = em ? (em.current_reading || '-') : (t.electric_reading || '-')
}

function startEdit() { editForm.value = { ...selectedTenant.value }; editing.value = true }
function cancelEdit() { editing.value = false }

async function saveEdit() {
  const f = editForm.value
  const oldRoomId = selectedTenant.value.room_id
  if (String(f.room_id) !== String(oldRoomId)) {
    await supabase.from('rooms').update({ status: 'vacant', tenant_id: null }).eq('id', oldRoomId)
    await supabase.from('rooms').update({ status: 'rented', tenant_id: selectedTenant.value.id }).eq('id', f.room_id)
  }
  await supabase.from('tenants').update({
    name: f.name, phone: f.phone, room_id: f.room_id,
    rent_amount: f.rent_amount, deposit: f.deposit,
    start_date: f.start_date, end_date: f.end_date, payment_day: f.payment_day
  }).eq('id', selectedTenant.value.id)
  await loadAll()
  editing.value = false
  selectTenant(selectedTenant.value.id)
}

async function delTenant() {
  if (!confirm('确认删除该租客？账单和抄表记录将保留。')) return
  await supabase.from('tenants').delete().eq('id', selectedTenant.value.id)
  selectedTenant.value = null
  loadAll()
}

async function delTenantById(id) {
  if (!confirm('确认删除该租客？账单和抄表记录将保留。')) return
  await supabase.from('tenants').delete().eq('id', id)
  if (selectedTenant.value?.id === id) selectedTenant.value = null
  loadAll()
}

async function doPay(id) {
  const b = bills.value.find(x => x.id === id)
  if (!b) return
  await supabase.from('bills').update({ status: 'paid', paid_amount: b.total_amount, paid_time: new Date().toISOString() }).eq('id', id)
  loadAll()
  if (selectedTenant.value) selectTenant(selectedTenant.value.id)
}

function formatTime(t) { if (!t) return '-'; return new Date(t).toLocaleDateString('zh-CN') }
</script>

<style scoped>
.tenant-layout { display: flex; gap: 0; height: calc(100vh - 56px - 40px); }
.tenant-list { flex: 1; overflow-y: auto; padding-right: 8px; }
.tenant-drawer { width: 380px; background: #fff; border-left: 1px solid var(--gray-200); overflow-y: auto; padding: 20px; flex-shrink: 0; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.tenant-card { background: white; border-radius: var(--radius); margin-bottom: 10px; border: 1px solid var(--gray-200); overflow: hidden; cursor: pointer; }
.tenant-card.selected { border-color: var(--primary); background: var(--primary-light); }
.tenant-main { display: flex; align-items: center; padding: 14px; }
.tenant-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; flex-shrink: 0; margin-right: 12px; }
.tenant-info { flex: 1; min-width: 0; }
.tenant-name { font-size: 15px; font-weight: 600; }
.tenant-room { font-size: 13px; color: var(--gray-500); }
.tenant-meta { font-size: 12px; color: var(--gray-400); display: flex; gap: 8px; }
.tenant-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.detail-section { margin-bottom: 16px; }
.detail-section h4 { font-size: 14px; margin-bottom: 8px; color: var(--primary); }
.detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--gray-100); font-size: 14px; }
.detail-row span:first-child { color: var(--gray-500); }
.bill-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--gray-100); font-size: 13px; }
.drawer-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
</style>