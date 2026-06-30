<template>
  <div>
    <div class="page-head">
      <h2>⚡ 水电物业</h2>
    </div>

    <div class="main-tabs">
      <span :class="['main-tab', { active: mainTab === 'meter' }]" @click="mainTab = 'meter'">💧⚡ 水电费</span>
      <span :class="['main-tab', { active: mainTab === 'property' }]" @click="mainTab = 'property'">🏢 物业费</span>
    </div>

    <!-- 水电费 -->
    <div v-if="mainTab === 'meter'">
      <div class="tab-bar">
        <span :class="['tab-item', { active: meterType === 'water' }]" @click="switchType('water')">💧 水表</span>
        <span :class="['tab-item', { active: meterType === 'electric' }]" @click="switchType('electric')">⚡ 电表</span>
      </div>

      <div class="form-item">
        <label>房间</label>
        <select v-model="roomId" class="input" @change="onRoomChange">
          <option value="">选择房间</option>
          <option v-for="r in rentedRooms" :key="r.id" :value="r.id">{{ r.houseName }} {{ r.roomNo }}（{{ r.tenantName }}）</option>
        </select>
      </div>

      <div class="form-item">
        <label>日期</label>
        <input v-model="meterDate" type="date" class="input" />
      </div>

      <div class="form-item">
        <label>单价（元/{{ meterType === 'water' ? '吨' : '度' }}）</label>
        <input v-model.number="unitPrice" type="number" step="0.1" class="input" @change="savePrice" />
      </div>

      <div class="form-item">
        <label>上期读数</label>
        <input :value="lastReading" class="input" disabled />
      </div>

      <div class="form-item">
        <label>本期读数</label>
        <input v-model.number="currentReading" type="number" class="input" @input="calcReading" />
      </div>

      <div class="form-item">
        <label>用量</label>
        <input :value="meterUsage" class="input" disabled />
      </div>

      <div class="form-item">
        <label>金额</label>
        <input :value="meterAmount.toFixed(2)" class="input" disabled />
      </div>

      <button class="btn primary" style="width:100%" @click="saveMeter" :disabled="saving">
        {{ saving ? '保存中...' : '保存抄表并生成账单' }}
      </button>

      <!-- 抄表记录 -->
      <div class="card" v-if="records.length" style="margin-top:16px">
        <h3>抄表记录</h3>
        <table class="tbl">
          <thead><tr><th>日期</th><th>房间</th><th>租客</th><th>上期</th><th>本期</th><th>用量</th><th>金额</th></tr></thead>
          <tbody>
            <tr v-for="r in records" :key="r.id">
              <td>{{ r.date?.slice(0, 10) }}</td>
              <td>{{ r.roomNo }}</td>
              <td>{{ r.tenantName }}</td>
              <td>{{ r.lastReading }}</td>
              <td>{{ r.currentReading }}</td>
              <td>{{ r.usage }}</td>
              <td>¥{{ Number(r.amount).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 物业费 -->
    <div v-if="mainTab === 'property'">
      <div class="card">
        <h3>添加物业费设置</h3>
        <div class="form-item"><label>交费对象</label><select v-model="propTarget" class="input"><option value="">选择楼栋</option><option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option></select></div>
        <div class="form-item"><label>金额</label><input v-model.number="propAmount" type="number" class="input" /></div>
        <div class="form-item"><label>周期</label><select v-model="propCycle" class="input"><option value="monthly">月付</option><option value="quarterly">季付</option><option value="yearly">年付</option></select></div>
        <div class="form-item"><label>交费日</label><input v-model.number="propDay" type="number" min="1" max="31" class="input" /></div>
        <button class="btn primary" style="width:100%" @click="saveProperty">保存设置</button>
      </div>

      <div class="card" v-if="propList.length" style="margin-top:16px">
        <h3>物业费列表</h3>
        <table class="tbl">
          <thead><tr><th>对象</th><th>金额</th><th>周期</th><th>交费日</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="p in propList" :key="p.id">
              <td>{{ p.target_name }}</td><td>¥{{ p.amount }}</td>
              <td>{{ p.cycle === 'monthly' ? '月付' : p.cycle === 'quarterly' ? '季付' : '年付' }}</td>
              <td>{{ p.pay_day }}号</td>
              <td><button class="btn-sm danger" @click="delProperty(p.id)">删除</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { meters, tenants, rooms, houses, propertySettings, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const mainTab = ref('meter')
const meterType = ref('water')
const roomId = ref('')
const tenantId = ref('')
const meterDate = ref(new Date().toISOString().slice(0, 10))
const unitPrice = ref(5)
const lastReading = ref('0')
const currentReading = ref('')
const meterUsage = ref('0')
const meterAmount = ref(0)
const saving = ref(false)

const rentedRooms = computed(() => {
  return rooms.value
    .filter(r => r.status === 'rented')
    .map(r => {
      const t = tenants.value.find(t => String(t.room_id) === String(r.id) && t.status === 'renting')
      const h = houses.value.find(h => String(h.id) === String(r.house_id))
      return {
        id: r.id,
        roomNo: r.room_no || '',
        houseName: h?.address || '',
        tenantName: t?.name || '',
        tenantId: t?.id || ''
      }
    })
})

const records = computed(() => {
  if (!roomId.value) return []
  const room = rooms.value.find(r => String(r.id) === String(roomId.value))
  const tenant = tenants.value.find(t => String(t.id) === String(tenantId.value))
  return meters.value
    .filter(m => String(m.room_id) === String(roomId.value) && m.type === meterType.value)
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .map(m => ({
      id: m.id,
      date: m.date || m.created_at,
      roomNo: room?.room_no || '',
      tenantName: tenant?.name || '',
      lastReading: m.last_reading || 0,
      currentReading: m.current_reading || 0,
      usage: m.usage || 0,
      amount: m.amount || 0
    }))
})

function switchType(t) {
  meterType.value = t
  unitPrice.value = parseFloat(localStorage.getItem('meterPrice_' + t) || (t === 'water' ? 5 : 1.5))
  roomId.value = ''
  lastReading.value = '0'
  currentReading.value = ''
  meterUsage.value = '0'
  meterAmount.value = 0
}

function savePrice() {
  localStorage.setItem('meterPrice_' + meterType.value, String(unitPrice.value))
}

function onRoomChange() {
  const r = rentedRooms.value.find(x => x.id === roomId.value)
  tenantId.value = r?.tenantId || ''

  const list = meters.value.filter(m => String(m.room_id) === String(roomId.value) && m.type === meterType.value)
  if (list.length) {
    const last = list[list.length - 1]
    lastReading.value = String(last.current_reading || 0)
  } else {
    lastReading.value = '0'
  }
  currentReading.value = ''
  meterUsage.value = '0'
  meterAmount.value = 0
}

function calcReading() {
  const last = parseFloat(lastReading.value) || 0
  const curr = parseFloat(currentReading.value) || 0
  const usage = Math.max(0, curr - last)
  meterUsage.value = usage.toFixed(2)
  meterAmount.value = usage * unitPrice.value
}

async function saveMeter() {
  if (!roomId.value) return alert('请选择房间')
  const curr = parseFloat(currentReading.value) || 0
  const last = parseFloat(lastReading.value) || 0
  if (!currentReading.value) return alert('请输入读数')
  if (curr < last) return alert('本期读数不能小于上期读数')

  saving.value = true
  const dateStr = meterDate.value
  const usage = curr - last
  const amount = usage * unitPrice.value
  const r = rentedRooms.value.find(x => x.id === roomId.value)

  await supabase.from('meters').insert({
    type: meterType.value,
    room_id: Number(roomId.value),
    tenant_id: Number(tenantId.value),
    date: dateStr,
    last_reading: last,
    current_reading: curr,
    usage: usage,
    unit_price: unitPrice.value,
    amount: amount,
    source: 'tenant'
  })

  if (usage > 0) {
    await supabase.from('bills').insert({
      tenant_id: Number(tenantId.value),
      room_id: Number(roomId.value),
      category: meterType.value === 'water' ? '水费' : '电费',
      bill_month: dateStr.slice(0, 7),
      total_amount: amount,
      paid_amount: 0,
      status: 'pending',
      direction: 'income',
      tenant_name: r?.tenantName || '',
      room_no: r?.roomNo || ''
    })
  }

  await supabase.from('tenants').update(
    meterType.value === 'water' ? { water_reading: curr } : { electric_reading: curr }
  ).eq('id', tenantId.value)

  loadAll()
  saving.value = false
  lastReading.value = String(curr)
  currentReading.value = ''
  meterUsage.value = '0'
  meterAmount.value = 0
  alert('保存成功')
}

const propTarget = ref('')
const propAmount = ref(0)
const propCycle = ref('monthly')
const propDay = ref(1)

const propList = computed(() => propertySettings.value || [])

async function saveProperty() {
  if (!propAmount.value) return alert('请输入金额')
  if (!propTarget.value) return alert('请选择楼栋')
  const house = houses.value.find(h => h.id == propTarget.value)
  await supabase.from('property_settings').insert({
    mode: 'building',
    room_id: propTarget.value,
    target_name: (house?.address || '') + ' 整栋',
    cycle: propCycle.value,
    amount: propAmount.value,
    pay_day: propDay.value,
    remind_days: 3,
    next_pay_date: new Date().toISOString().slice(0, 10)
  })
  propAmount.value = 0
  propTarget.value = ''
  loadAll()
}

async function delProperty(id) {
  if (!confirm('删除物业费设置？')) return
  await supabase.from('property_settings').delete().eq('id', id)
  loadAll()
}

onMounted(() => {
  loadAll()
  unitPrice.value = parseFloat(localStorage.getItem('meterPrice_water') || '5')
})
</script>

<style scoped>
.main-tabs { display: flex; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.main-tab { flex: 1; text-align: center; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 15px; }
.main-tab.active { background: white; font-weight: 600; }
.tab-bar { display: flex; margin-bottom: 14px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 8px; border-radius: 8px; cursor: pointer; }
.tab-item.active { background: white; font-weight: 600; }
.form-item { margin-bottom: 10px; }
.form-item label { display: block; font-size: 13px; color: #64748b; margin-bottom: 4px; }
.form-item .input { width: 100%; }
</style>