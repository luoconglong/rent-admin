<template>
  <div>
    <div class="page-head"><h2>🔧 缴费管理</h2></div>

    <!-- 主Tab -->
    <div class="main-tabs">
      <span :class="['main-tab', { active: mainTab === 'meter' }]" @click="mainTab = 'meter'">💧⚡ 水电总表</span>
      <span :class="['main-tab', { active: mainTab === 'property' }]" @click="mainTab = 'property'">🏢 物业费</span>
    </div>

    <!-- 水电总表 -->
    <div v-if="mainTab === 'meter'">
      <div class="tab-bar">
        <span :class="['tab-item', { active: meterType === 'water' }]" @click="switchType('water')">💧 水表</span>
        <span :class="['tab-item', { active: meterType === 'electric' }]" @click="switchType('electric')">⚡ 电表</span>
      </div>

      <div class="meter-select-row">
        <select v-model="selectedMeter" class="input" @change="selectMeter">
          <option value="">选择表具</option>
          <option v-for="m in meterList" :key="m.name" :value="m.name">{{ m.name }} (余额 ¥{{ m.balance }})</option>
        </select>
        <button class="btn" @click="showAddMeter = true">+ 添加</button>
        <button class="btn-sm danger" v-if="selectedMeter" @click="delMeter">删除</button>
      </div>

      <div class="balance-card" v-if="selectedMeter">
        <div class="balance-label">当前余额</div>
        <div class="balance-value">¥{{ balance.toFixed(2) }}</div>
        <div class="balance-sub">约 {{ remain }} {{ meterType === 'water' ? '吨' : '度' }}</div>
      </div>

      <div class="card" v-if="selectedMeter">
        <div class="mode-tabs">
          <span :class="['mode-tab', { active: mode === 'charge' }]" @click="mode = 'charge'">💰 充值</span>
          <span :class="['mode-tab', { active: mode === 'reading' }]" @click="mode = 'reading'">📝 抄表扣费</span>
          <span :class="['mode-tab', { active: mode === 'remain' }]" @click="mode = 'remain'">🔻 剩余扣减</span>
        </div>

        <div v-if="mode === 'charge'">
          <div class="form-item"><label>充值金额</label><input v-model.number="chargeAmount" type="number" class="input" /></div>
          <button class="btn primary full" @click="doCharge">确认充值</button>
        </div>
        <div v-if="mode === 'reading'">
          <div class="form-item"><label>单价（元/{{ meterType === 'water' ? '吨' : '度' }}）</label><input v-model.number="unitPrice" type="number" step="0.1" class="input" @change="savePrice" /></div>
          <div class="form-item"><label>上期读数</label><input :value="lastReading" class="input" disabled /></div>
          <div class="form-item"><label>本期读数</label><input v-model.number="currentReading" type="number" class="input" @input="calcReading" /></div>
          <div class="form-item"><label>用量</label><input :value="readingUsage" class="input" disabled /></div>
          <div class="form-item"><label>扣费金额</label><input :value="readingAmount.toFixed(2)" class="input" disabled /></div>
          <button class="btn primary full" @click="doReading">保存抄表</button>
        </div>
        <div v-if="mode === 'remain'">
          <div class="form-item"><label>单价（元/{{ meterType === 'water' ? '吨' : '度' }}）</label><input v-model.number="unitPrice" type="number" step="0.1" class="input" @change="savePrice" /></div>
          <div class="form-item"><label>上期剩余</label><input :value="lastBalance" class="input" disabled /></div>
          <div class="form-item"><label>本期剩余</label><input v-model.number="currentBalance" type="number" class="input" @input="calcRemain" /></div>
          <div class="form-item"><label>用量</label><input :value="remainUsage" class="input" disabled /></div>
          <div class="form-item"><label>扣费金额</label><input :value="remainAmount.toFixed(2)" class="input" disabled /></div>
          <button class="btn primary full" @click="doRemain">保存扣减</button>
        </div>
      </div>

      <div class="card" v-if="records.length" style="margin-top:16px">
        <h3>交费记录</h3>
        <table class="tbl"><thead><tr><th>时间</th><th>表具</th><th>类型</th><th>金额</th><th>余额</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="r in records" :key="r.id">
              <td>{{ r.date?.slice(0,10) }}</td><td>{{ r.meter_name || '-' }}</td>
              <td>{{ r.action === 'charge' ? '充值' : r.action === 'remain_deduct' ? '剩余扣减' : '抄表扣费' }}</td>
              <td :class="r.amount > 0 ? 'green' : 'red'">{{ r.amount > 0 ? '+' : '' }}¥{{ Number(r.amount).toFixed(2) }}</td>
              <td>¥{{ Number(r.balance).toFixed(2) }}</td>
              <td><button class="btn-sm danger" @click="revert(r)">撤销</button></td>
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
        <button class="btn primary full" @click="doProperty">保存设置</button>
      </div>

      <div class="card" v-if="propList.length" style="margin-top:16px">
        <h3>物业费列表</h3>
        <table class="tbl"><thead><tr><th>对象</th><th>金额</th><th>周期</th><th>交费日</th><th>操作</th></tr></thead>
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

    <!-- 添加表具弹窗 -->
    <div class="mask" v-if="showAddMeter" @click.self="showAddMeter = false">
      <div class="dialog">
        <h3>添加表具</h3>
        <div class="form-item"><label>表具名称</label><input v-model="newMeterName" class="input" :placeholder="meterType==='water'?'如：21栋总水表':'如：22栋总电表'" /></div>
        <div class="form-item"><label>初始读数</label><input v-model.number="newMeterReading" type="number" class="input" /></div>
        <div class="dialog-btns"><button class="btn" @click="showAddMeter = false">取消</button><button class="btn primary" @click="addMeter">确定</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { houses, meters, propertySettings, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const mainTab = ref('meter')
const meterType = ref('water')
const selectedMeter = ref('')
const mode = ref('charge')
const showAddMeter = ref(false)
const newMeterName = ref('')
const newMeterReading = ref(0)
const unitPrice = ref(5)
const balance = ref(0)
const lastReading = ref(0)
const currentReading = ref('')
const readingUsage = ref(0)
const readingAmount = ref(0)
const lastBalance = ref('0')
const currentBalance = ref('')
const remainUsage = ref(0)
const remainAmount = ref(0)
const chargeAmount = ref(0)
const propTarget = ref('')
const propAmount = ref(0)
const propCycle = ref('monthly')
const propDay = ref(1)

const propList = computed(() => propertySettings.value || [])

const meterList = computed(() => {
  const map = {}
  for (const m of meters.value) {
    if (m.type !== meterType.value || !m.meter_name || m.source !== 'landlord') continue
    if (!map[m.meter_name]) map[m.meter_name] = { name: m.meter_name, balance: 0 }
  }
  for (const m of meters.value) {
    if (m.type !== meterType.value || !m.meter_name || m.source !== 'landlord') continue
    map[m.meter_name].balance = m.balance || 0
  }
  return Object.values(map)
})

const remain = computed(() => ((balance.value || 0) / (unitPrice.value || 1)).toFixed(1))

const records = computed(() => {
  return meters.value
    .filter(m => m.type === meterType.value && m.source === 'landlord' && m.meter_name === selectedMeter.value)
    .filter(m => m.action === 'charge' || m.action === 'deduct' || m.action === 'remain_deduct')
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
})

function switchType(t) {
  meterType.value = t
  unitPrice.value = parseFloat(localStorage.getItem('meterPrice_' + t) || (t === 'water' ? 5 : 1.5))
  selectedMeter.value = ''; balance.value = 0
}
function savePrice() { localStorage.setItem('meterPrice_' + meterType.value, String(unitPrice.value)) }

function selectMeter() {
  const list = meters.value.filter(m => m.type === meterType.value && m.meter_name === selectedMeter.value && m.source === 'landlord')
  if (list.length) {
    const last = list[list.length - 1]
    balance.value = last.balance || 0
    lastReading.value = last.current_reading || 0
    const remainList = meters.value.filter(m => m.type === meterType.value && m.meter_name === selectedMeter.value && (m.action === 'remain_deduct' || m.action === 'init_balance'))
    lastBalance.value = remainList.length ? String(remainList[remainList.length - 1].current_reading || 0) : '0'
  } else { balance.value = 0; lastReading.value = 0; lastBalance.value = '0' }
}

async function addMeter() {
  if (!newMeterName.value.trim()) return alert('请输入表具名称')
  await supabase.from('meters').insert({
    type: meterType.value, meter_name: newMeterName.value.trim(),
    balance: 0, current_reading: newMeterReading.value || 0, action: 'init_reading',
    source: 'landlord', date: new Date().toISOString().slice(0, 10)
  })
  showAddMeter.value = false; newMeterName.value = ''; newMeterReading.value = 0
  loadAll()
}

async function delMeter() {
  if (!confirm(`删除表具「${selectedMeter.value}」及其所有记录？`)) return
  await supabase.from('meters').delete().eq('meter_name', selectedMeter.value).eq('type', meterType.value)
  selectedMeter.value = ''; balance.value = 0
  loadAll()
}

async function doCharge() {
  if (!chargeAmount.value || chargeAmount.value <= 0) return alert('请输入充值金额')
  const newBalance = balance.value + chargeAmount.value
  await supabase.from('meters').insert({
    type: meterType.value, meter_name: selectedMeter.value,
    action: 'charge', amount: chargeAmount.value, balance: newBalance,
    source: 'landlord', date: new Date().toISOString().slice(0, 10)
  })
  await supabase.from('expends').insert({
    type: (meterType.value === 'water' ? '💧水费' : '⚡电费') + ' ' + selectedMeter.value + ' 充值',
    amount: chargeAmount.value, is_income: false, time: new Date().toISOString()
  })
  balance.value = newBalance; chargeAmount.value = 0
  loadAll()
}

function calcReading() {
  const curr = parseFloat(currentReading.value) || 0
  readingUsage.value = Math.max(0, curr - lastReading.value)
  readingAmount.value = readingUsage.value * unitPrice.value
}

async function doReading() {
  const curr = parseFloat(currentReading.value) || 0
  if (curr <= lastReading.value) return alert('本期读数需大于上期')
  const newBalance = balance.value - readingAmount.value
  await supabase.from('meters').insert({
    type: meterType.value, meter_name: selectedMeter.value,
    action: 'deduct', amount: -readingAmount.value, balance: newBalance,
    last_reading: lastReading.value, current_reading: curr,
    usage: readingUsage.value, unit_price: unitPrice.value,
    source: 'landlord', date: new Date().toISOString().slice(0, 10)
  })
  await supabase.from('expends').insert({
    type: (meterType.value === 'water' ? '💧水费' : '⚡电费') + ' ' + selectedMeter.value + ' 扣费',
    amount: readingAmount.value, is_income: false, time: new Date().toISOString()
  })
  balance.value = newBalance; lastReading.value = curr
  currentReading.value = ''; readingUsage.value = 0; readingAmount.value = 0
  loadAll()
}

function calcRemain() {
  const curr = parseFloat(currentBalance.value) || 0
  const last = parseFloat(lastBalance.value) || 0
  remainUsage.value = Math.max(0, last - curr)
  remainAmount.value = remainUsage.value * unitPrice.value
}

async function doRemain() {
  const curr = parseFloat(currentBalance.value) || 0
  const last = parseFloat(lastBalance.value) || 0
  if (curr >= last && last > 0) return alert('本期剩余不能大于上期')
  const newBalance = balance.value - remainAmount.value
  await supabase.from('meters').insert({
    type: meterType.value, meter_name: selectedMeter.value,
    action: 'remain_deduct', amount: -remainAmount.value, balance: newBalance,
    current_reading: curr, usage: remainUsage.value, unit_price: unitPrice.value,
    source: 'landlord', date: new Date().toISOString().slice(0, 10)
  })
  await supabase.from('expends').insert({
    type: (meterType.value === 'water' ? '💧水费' : '⚡电费') + ' ' + selectedMeter.value + ' 扣费(剩余)',
    amount: remainAmount.value, is_income: false, time: new Date().toISOString()
  })
  balance.value = newBalance; lastBalance.value = String(curr)
  currentBalance.value = ''; remainUsage.value = 0; remainAmount.value = 0
  loadAll()
}

async function doProperty() {
  if (!propAmount.value || propAmount.value <= 0) return alert('请输入物业费金额')
  if (!propTarget.value) return alert('请选择楼栋')
  const house = houses.value.find(h => h.id == propTarget.value)
  await supabase.from('property_settings').insert({
    mode: 'building', room_id: propTarget.value,
    target_name: (house?.address || '') + ' 整栋',
    cycle: propCycle.value, amount: propAmount.value,
    pay_day: propDay.value, remind_days: 3,
    next_pay_date: new Date().toISOString().slice(0, 10)
  })
  propAmount.value = 0; propTarget.value = ''
  loadAll()
}

async function delProperty(id) {
  if (!confirm('删除物业费设置？')) return
  await supabase.from('property_settings').delete().eq('id', id)
  loadAll()
}

async function revert(r) {
  if (!confirm(`撤销「${r.action === 'charge' ? '充值' : '扣费'}」操作？余额将恢复。`)) return
  await supabase.from('meters').delete().eq('id', r.id)
  loadAll()
  if (selectedMeter.value) selectMeter()
}

switchType('water')
</script>

<style scoped>
.main-tabs { display: flex; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.main-tab { flex: 1; text-align: center; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 15px; }
.main-tab.active { background: white; font-weight: 600; }
.tab-bar { display: flex; margin-bottom: 14px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab-item { flex: 1; text-align: center; padding: 8px; border-radius: 8px; cursor: pointer; }
.tab-item.active { background: white; font-weight: 600; }
.meter-select-row { display: flex; gap: 8px; margin-bottom: 14px; align-items: center; }
.meter-select-row .input { flex: 1; }
.balance-card { text-align: center; padding: 20px; background: #eef7f2; border-radius: 16px; margin-bottom: 14px; }
.balance-label { font-size: 13px; color: #64748b; }
.balance-value { font-size: 36px; font-weight: 700; color: #1e6f5c; }
.balance-sub { font-size: 13px; color: #64748b; }
.mode-tabs { display: flex; gap: 4px; margin-bottom: 14px; flex-wrap: wrap; }
.mode-tab { padding: 6px 12px; border-radius: 14px; font-size: 12px; background: #f1f5f9; cursor: pointer; }
.mode-tab.active { background: #1e6f5c; color: white; }
.btn.full { width: 100%; margin-top: 8px; }
</style>