<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:520px;max-height:90vh;overflow-y:auto">
      <h3>🏠 办理入住</h3>
      
      <div class="form-item"><label>姓名</label><input v-model="name" class="input" placeholder="租客姓名" /></div>
      <div class="form-item"><label>手机号</label><input v-model="phone" class="input" placeholder="选填" maxlength="11" /></div>
      <div class="form-item"><label>身份证号 *</label><input v-model="idCard" class="input" placeholder="18位身份证号" maxlength="18" /></div>
      
      <div class="form-item">
        <label>同住人</label>
        <div v-for="(co, i) in coOccupants" :key="i" style="display:flex;gap:6px;margin-bottom:6px">
          <input v-model="co.name" class="input" placeholder="姓名" style="flex:1" />
          <input v-model="co.idCard" class="input" placeholder="身份证" style="flex:1" maxlength="18" />
          <input v-model="co.phone" class="input" placeholder="手机号(选填)" style="flex:1" maxlength="11" />
          <button class="btn-sm danger" @click="coOccupants.splice(i,1)">✕</button>
        </div>
        <button class="btn-sm" @click="coOccupants.push({name:'',phone:'',idCard:''})">+ 添加同住人</button>
      </div>
      
      <div class="form-item"><label>入住人数</label><span style="font-size:16px;font-weight:600">{{ totalOccupant }} 人</span></div>

      <div class="form-item"><label>楼栋</label>
        <select v-model="houseId" class="input" @change="onHouseChange">
          <option value="">请选择</option>
          <option v-for="h in houses" :key="h.id" :value="h.id">{{ h.address }}</option>
        </select>
      </div>
      <div class="form-item"><label>房间</label>
        <select v-model="roomId" class="input" @change="onRoomChange">
          <option value="">请选择</option>
          <option v-for="r in roomList" :key="r.id" :value="r.id">{{ r.room_no }}</option>
        </select>
      </div>
      
      <div class="form-row">
        <div class="form-item"><label>月租金</label><input v-model.number="rentAmount" type="number" class="input" /></div>
        <div class="form-item"><label>押金</label><input v-model.number="deposit" type="number" class="input" /></div>
      </div>
      
      <div class="form-item">
        <label>缴费周期</label>
        <div class="term-btns">
          <span :class="['term-btn',{active:paymentCycle==='monthly'}]" @click="paymentCycle='monthly'">月付</span>
          <span :class="['term-btn',{active:paymentCycle==='quarterly'}]" @click="paymentCycle='quarterly'">季付</span>
          <span :class="['term-btn',{active:paymentCycle==='yearly'}]" @click="paymentCycle='yearly'">年付</span>
        </div>
      </div>
      
      <div class="form-item"><label>租期</label>
        <div class="term-btns">
          <span v-for="m in [3,6,12,24]" :key="m" :class="['term-btn',{active:termMonths===m}]" @click="setTerm(m)">{{m}}个月</span>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-item"><label>入住日期</label><input v-model="startDate" type="date" class="input" @change="calcEnd" /></div>
        <div class="form-item"><label>到期日期</label><input v-model="endDate" type="date" class="input" /></div>
      </div>
      
      <div class="form-item">
        <label>付款日</label>
        <input v-model.number="paymentDay" type="number" min="1" max="31" class="input" style="width:80px" />
        <span style="color:#999;font-size:13px">每月几号交租</span>
      </div>
      
      <div class="form-row">
        <div class="form-item"><label>水表底数</label><input v-model.number="waterReading" type="number" step="0.1" class="input" /></div>
        <div class="form-item"><label>电表底数</label><input v-model.number="electricReading" type="number" step="0.1" class="input" /></div>
      </div>

      <div class="form-item" style="display:flex;align-items:center;gap:8px;margin-top:4px">
        <input type="checkbox" v-model="genContract" id="genContract" style="width:18px;height:18px" />
        <label for="genContract" style="margin:0;cursor:pointer">📄 同时生成电子合同</label>
      </div>
      
      <div class="dialog-btns">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn primary" @click="save">确认入住</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { houses, rooms, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const props = defineProps({ roomId: String })
const emit = defineEmits(['close'])

const name = ref('')
const phone = ref('')
const idCard = ref('')
const coOccupants = ref([])
const houseId = ref('')
const roomId = ref('')
const rentAmount = ref(0)
const deposit = ref(0)
const termMonths = ref(12)
const startDate = ref(new Date().toISOString().slice(0,10))
const endDate = ref('')
const paymentDay = ref(new Date().getDate())
const paymentCycle = ref('monthly')
const waterReading = ref('')
const electricReading = ref('')
const genContract = ref(true)

const totalOccupant = computed(() => 1 + coOccupants.value.filter(c => c.name.trim()).length)

calcEnd()
function calcEnd() {
  const s = new Date(startDate.value)
  s.setMonth(s.getMonth() + termMonths.value)
  s.setDate(s.getDate() - 1)
  endDate.value = s.toISOString().slice(0,10)
}
function setTerm(m) { termMonths.value = m; calcEnd() }
function onHouseChange() { roomId.value = '' }

const roomList = computed(() => {
  if (!houseId.value) return []
  return rooms.value.filter(r => r.house_id == houseId.value && (r.status === 'vacant' || r.status === '空置'))
})

function onRoomChange() {
  const r = rooms.value.find(x => x.id == roomId.value)
  if (r) {
    rentAmount.value = Number(r.rent_amount) || 0
    deposit.value = Number(r.deposit) || 0
  }
}

async function save() {
  const rid = roomId.value || props.roomId
  if (!rid) return alert('请选择房间')
  if (!name.value.trim()) return alert('请输入姓名')
  if (!idCard.value || idCard.value.length !== 18) return alert('请输入18位身份证号')
  for (const co of coOccupants.value) {
    if (co.name.trim() && (!co.idCard || co.idCard.length !== 18)) return alert('同住人 ' + co.name + ' 需填写18位身份证号')
    if (co.phone && co.phone.length !== 11) return alert('同住人 ' + co.name + ' 手机号需11位')
  }

  const now = new Date().toISOString()
  const ds = now.slice(0, 10)
  const room = rooms.value.find(r => r.id == rid)
  const house = houses.value.find(h => h.id == room?.house_id)

  const { data: settings } = await supabase.from('settings').select('key,value')
  const getSetting = (key, def) => { const s = settings?.find(x => x.key === key); return s ? parseFloat(s.value) : def }
  const getStr = (key, def) => { const s = settings?.find(x => x.key === key); return s && s.value ? s.value : def }

  const waterPrice = getSetting('meterPrice_water', 5)
  const electricPrice = getSetting('meterPrice_electric', 1.5)
  const aptName = getStr('apartmentName', '')
  const payeeName = getStr('payee', '')
  const landlordName = aptName && payeeName ? aptName + ' / ' + payeeName : ''

  const coList = coOccupants.value.filter(c => c.name.trim())

  const { data: newTenant, error } = await supabase.from('tenants').insert({
    name: name.value.trim(), phone: phone.value || null, id_card: idCard.value,
    occupant_count: totalOccupant.value, room_id: Number(rid),
    start_date: startDate.value, end_date: endDate.value,
    rent_amount: rentAmount.value, deposit: deposit.value,
    payment_cycle: paymentCycle.value, payment_day: paymentDay.value,
    water_reading: waterReading.value || null, electric_reading: electricReading.value || null,
    status: 'renting'
  }).select().single()

  if (error) { alert('租客保存失败：' + error.message); return }

  const tenantId = newTenant.id
  await supabase.from('rooms').update({ status: 'rented' }).eq('id', rid)

  if (waterReading.value && parseFloat(waterReading.value) > 0) {
    await supabase.from('meters').insert({ type: 'water', room_id: rid, tenant_id: tenantId, date: ds, action: 'init_reading', last_reading: 0, current_reading: parseFloat(waterReading.value), usage: parseFloat(waterReading.value), amount: parseFloat(waterReading.value) * waterPrice, unit_price: waterPrice })
  }
  if (electricReading.value && parseFloat(electricReading.value) > 0) {
    await supabase.from('meters').insert({ type: 'electric', room_id: rid, tenant_id: tenantId, date: ds, action: 'init_reading', last_reading: 0, current_reading: parseFloat(electricReading.value), usage: parseFloat(electricReading.value), amount: parseFloat(electricReading.value) * electricPrice, unit_price: electricPrice })
  }

  const rentForCycle = paymentCycle.value === 'quarterly' ? rentAmount.value * 3 : rentAmount.value
  const { error: billErr } = await supabase.from('bills').insert([
    { tenant_id: tenantId, room_id: rid, tenant_name: name.value.trim(), room_no: room?.room_no || '', house_address: house?.address || '', title: '房租', category: '房租', total_amount: rentForCycle, paid_amount: 0, status: 'pending', bill_month: startDate.value.slice(0, 7), rent_amount: rentForCycle, deposit: 0, date_range: '' },
    { tenant_id: tenantId, room_id: rid, tenant_name: name.value.trim(), room_no: room?.room_no || '', house_address: house?.address || '', title: '押金', category: '押金', total_amount: deposit.value, paid_amount: 0, status: 'pending', bill_month: startDate.value.slice(0, 7), rent_amount: 0, deposit: deposit.value, date_range: '' }
  ])
  if (billErr) { alert('账单生成失败：' + billErr.message); return }

  if (genContract.value) {
    await supabase.from('contracts').insert({
      tenant_id: tenantId, room_id: rid,
      template_data: { landlord: landlordName, tenantName: name.value.trim(), idCard: idCard.value, phone: phone.value || '', occupantCount: totalOccupant.value, coOccupants: coList.map(c => ({ name: c.name, phone: c.phone || '', idCard: c.idCard })), rentAmount: rentAmount.value, deposit: deposit.value, startDate: startDate.value, endDate: endDate.value, roomNo: room?.room_no || '' },
      status: '待签'
    })
  }

  loadAll()
  alert('入住成功！')
  emit('close')
}

onMounted(() => {
  if (props.roomId) {
    roomId.value = String(props.roomId)
    const r = rooms.value.find(x => x.id == roomId.value)
    if (r) {
      houseId.value = r.house_id
      rentAmount.value = Number(r.rent_amount) || 0
      deposit.value = Number(r.deposit) || 0
    }
  }
})
</script>

<style scoped>
.form-row{display:flex;gap:12px}.form-row .form-item{flex:1}
.term-btns{display:flex;gap:6px}
.term-btn{padding:6px 14px;border-radius:14px;font-size:13px;background:#f1f5f9;cursor:pointer}
.term-btn.active{background:#1e6f5c;color:white}
</style>