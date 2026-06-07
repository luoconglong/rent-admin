<template>
  <div>
    <div class="page-head">
      <h2>📄 电子合同</h2>
      <button class="btn primary" @click="showForm = true">+ 新建合同</button>
    </div>

    <table class="tbl" v-if="contracts.length">
      <thead><tr><th>租客</th><th>房间</th><th>月租</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="c in contracts" :key="c.id">
          <td>{{ c.tenantName }}</td>
          <td>{{ c.roomNo }}</td>
          <td>¥{{ c.rentAmount }}</td>
          <td><span :class="['tag', c.status === '已签' ? 'green' : 'warn']">{{ c.status }}</span></td>
          <td>{{ formatDate(c.created_at) }}</td>
          <td>
            <button class="btn-sm" @click="preview(c)">预览</button>
            <button class="btn-sm green" @click="downloadPDF(c)">PDF</button>
            <button v-if="c.status === '待签'" class="btn-sm" @click="openSign(c)">签字</button>
            <button class="btn-sm danger" @click="delContract(c.id)">删</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">暂无合同</div>

    <div class="mask" v-if="showForm" @click.self="showForm = false">
      <div class="dialog">
        <h3>新建合同</h3>
        <div class="form-item"><label>选择租客</label><select v-model="form.tenantId" class="input" @change="onTenantChange"><option value="">请选择</option><option v-for="t in activeTenants" :key="t.id" :value="t.id">{{ t.name }} - {{ t.room_no }}</option></select></div>
        <div v-if="form.tenantId" style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:10px">
          <p>租客：{{ selectedTenant?.name }} | 房间：{{ selectedTenant?.room_no }}</p>
          <p>合同期：{{ form.startDate }} ~ {{ form.endDate }}</p>
        </div>
        <div class="form-item"><label>月租金</label><input v-model.number="form.rentAmount" type="number" class="input" /></div>
        <div class="form-item"><label>押金</label><input v-model.number="form.deposit" type="number" class="input" /></div>
        <p style="font-size:12px;color:#64748b">合同内容在"设置→合同模板"中编辑</p>
        <div class="dialog-btns"><button class="btn" @click="showForm = false">取消</button><button class="btn primary" @click="createContract">生成合同</button></div>
      </div>
    </div>

    <div class="mask" v-if="previewing" @click.self="previewing = null">
      <div class="dialog" style="width:650px;max-height:80vh;overflow-y:auto">
        <h3>合同预览</h3>
        <div class="contract-preview" ref="contractPrintRef">
          <h2 style="text-align:center">{{ contractTitle }}</h2>
          <p v-for="(clause, i) in replacedClauses" :key="i" v-html="clause"></p>
        </div>
        <div class="dialog-btns"><button class="btn" @click="previewing = null">关闭</button><button class="btn primary" @click="doPrint">打印</button></div>
      </div>
    </div>

    <div class="mask" v-if="signing" @click.self="signing = null">
      <div class="dialog" style="width:500px">
        <h3>手写签字</h3>
        <canvas ref="canvasRef" class="sign-canvas"
          @mousedown="startSign" @mousemove="onDraw" @mouseup="endSign" @mouseleave="endSign"
          @touchstart.prevent="startSignTouch" @touchmove.prevent="onDrawTouch" @touchend="endSign"></canvas>
        <div class="dialog-btns"><button class="btn" @click="clearCanvas">清除</button><button class="btn primary" @click="saveSignature">确认签字</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { tenants, rooms, houses, meters } from '../stores/data.js'
import { supabase } from '../supabase.js'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const contracts = ref([])
const showForm = ref(false)
const signing = ref(null)
const previewing = ref(null)
const canvasRef = ref(null)
const contractPrintRef = ref(null)

const form = reactive({ tenantId: '', rentAmount: 0, deposit: 0, startDate: '', endDate: '' })
const contractTitle = ref('福茂公寓租赁协议')
const contractClauses = ref('')
const aptName = ref('')
const payeeName = ref('')

function calcMonths(start, end) {
  if (!start || !end) return ''
  const s = new Date(start), e = new Date(end)
  const m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  return m > 0 ? m : ''
}
function calcPayment(t) {
  if (!t) return ''
  if (t.payment_cycle === 'quarterly') return '押一付三'
  if (t.payment_cycle === 'yearly') return '押一付十二'
  return '押一付一'
}

const replacedClauses = computed(() => {
  const d = previewing.value?.template_data || {}
  const room = rooms.value.find(r => String(r.id) === String(previewing.value?.room_id))
  const house = houses.value.find(h => String(h.id) === String(room?.house_id))
  const houseAddress = house?.detail_address || house?.address || ''
  const fullRoom = d.roomNo || room?.room_no || ''
  const t = tenants.value.find(x => String(x.id) === String(previewing.value?.tenant_id))
  const cycle = t?.payment_cycle || 'monthly'
  const cycleMultiplier = cycle === 'quarterly' ? 3 : cycle === 'yearly' ? 12 : 1
  const totalAmount = (Number(d.rentAmount) || 0) * cycleMultiplier + (Number(d.deposit) || 0)
  const meterList = meters.value.filter(m => String(m.room_id) === String(previewing.value?.room_id))
  const waterMeter = meterList.filter(m => m.type === 'water').pop()
  const electricMeter = meterList.filter(m => m.type === 'electric').pop()
  const replacements = {
    '{甲方}': d.landlord || (aptName.value && payeeName.value ? aptName.value + ' / ' + payeeName.value : ''),
    '{乙方}': d.tenantName || '',
    '{乙方身份证}': d.idCard || '',
    '{乙方电话}': d.phone || (t?.phone || ''),
    '{地址}': houseAddress,
    '{房间}': fullRoom,
    '{月租}': Number(d.rentAmount || 0).toFixed(0),
    '{押金}': Number(d.deposit || 0).toFixed(0),
    '{开始日期}': d.startDate || '',
    '{结束日期}': d.endDate || '',
    '{期限月数}': calcMonths(d.startDate, d.endDate),
    '{入住人数}': d.occupantCount || 1,
    '{付款方式}': calcPayment(t),
    '{水费押金}': '/',
    '{共计}': Number(totalAmount).toFixed(0),
    '{电表底数}': electricMeter?.currentreading || '_______',
    '{水表底数}': waterMeter?.currentreading || '______',
  }
  const sigUrl = previewing.value?.signature_url
  const sigHtml = sigUrl ? '<span style="display:inline-block;position:relative"><img src="' + sigUrl + '" style="max-width:100px;max-height:40px;position:relative;z-index:1" /></span>' : '<span style="display:inline-block;width:100px;border-bottom:1px solid #000"></span>'
  return contractClauses.value.split('\n').filter(c => c.trim()).map(c => {
    let result = c
    for (const [key, val] of Object.entries(replacements)) result = result.split(key).join(String(val))
    if (result.includes('甲方签名') && result.includes('乙方签名')) result = '<span style="display:inline-block;width:48%">甲方签名：' + (replacements['{甲方}'] || '') + '</span><span style="display:inline-block;width:48%;text-align:right">乙方签名：' + sigHtml + '</span>'
    return result
  })
})

const selectedTenant = computed(() => tenants.value.find(x => String(x.id) === String(form.tenantId)))

onMounted(async () => {
  const { data } = await supabase.from('settings').select('*')
  if (data) {
    const map = {}
    data.forEach(s => { map[s.key] = s.value })
    if (map.contractTitle) contractTitle.value = map.contractTitle
    if (map.contractClauses) contractClauses.value = map.contractClauses
    if (map.apartmentName) aptName.value = map.apartmentName
    if (map.payee) payeeName.value = map.payee
  }
  loadContracts()
})

const activeTenants = computed(() => tenants.value.filter(t => t.status === 'renting').map(t => ({ ...t, room_no: rooms.value.find(r => String(r.id) === String(t.room_id))?.room_no || '-' })))

async function loadContracts() {
  const { data } = await supabase.from('contracts').select('*').order('created_at', { ascending: false })
  if (data) contracts.value = data.map(c => { const t = tenants.value.find(x => String(x.id) === String(c.tenant_id)), r = rooms.value.find(x => String(x.id) === String(c.room_id)); return { ...c, tenantName: t?.name || '-', roomNo: r?.room_no || '-', rentAmount: c.template_data?.rentAmount || 0 } })
}

function onTenantChange() { const t = selectedTenant.value; if (t) { form.rentAmount = t.rent_amount || 0; form.deposit = t.deposit || 0; form.startDate = t.start_date || ''; form.endDate = t.end_date || '' } }

async function createContract() {
  const t = selectedTenant.value; if (!t) return alert('请选择租客')
  const r = rooms.value.find(x => String(x.id) === String(t.room_id))
  await supabase.from('contracts').insert({ tenant_id: form.tenantId, room_id: t.room_id, template_data: { landlord: aptName.value && payeeName.value ? aptName.value + ' / ' + payeeName.value : '', tenantName: t.name, idCard: t.id_card || '', phone: t.phone || '', occupantCount: t.occupant_count || 1, coOccupants: [], rentAmount: form.rentAmount, deposit: form.deposit, startDate: form.startDate, endDate: form.endDate, roomNo: r?.room_no || '' }, status: '待签' })
  showForm.value = false; loadContracts()
}

function preview(c) { previewing.value = c }
function doPrint() { const content = contractPrintRef.value?.innerHTML || ''; if (!content) return; const win = window.open('', '_blank'); win.document.write('<html><head><title>合同</title><style>@page{size:A4;margin:10mm}body{font-family:sans-serif;font-size:14px;line-height:2;padding:5px}h2{text-align:center;font-size:18px}p{margin:2px 0}</style></head><body>' + content + '</body></html>'); win.document.close(); setTimeout(() => win.print(), 500) }

async function downloadPDF(c) {
  previewing.value = c
  await new Promise(r => setTimeout(r, 500))
  const el = contractPrintRef.value
  if (!el) return
  const canvas = await html2canvas(el, { scale: 2 })
  const img = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pw = pdf.internal.pageSize.getWidth() - 20, ph = pdf.internal.pageSize.getHeight() - 20
  const ratio = Math.min(pw / canvas.width, ph / canvas.height)
  pdf.addImage(img, 'PNG', 10, 10, canvas.width * ratio, canvas.height * ratio)
  pdf.save(`合同_${c.tenantName}_${c.roomNo}.pdf`)
}

async function delContract(id) { if (!confirm('确认删除？')) return; await supabase.from('contracts').delete().eq('id', id); loadContracts() }

let ctx = null, isDrawing = false, lastX = 0, lastY = 0
function openSign(c) { signing.value = c; setTimeout(() => { const canvas = canvasRef.value; if (!canvas) return; canvas.width = canvas.parentElement.clientWidth - 40; canvas.height = 150; ctx = canvas.getContext('2d'); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round' }, 100) }
function startSign(e) { isDrawing = true; const r = canvasRef.value.getBoundingClientRect(); lastX = e.clientX - r.left; lastY = e.clientY - r.top }
function onDraw(e) { if (!isDrawing) return; const r = canvasRef.value.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke(); lastX = e.clientX - r.left; lastY = e.clientY - r.top }
function endSign() { isDrawing = false }
function startSignTouch(e) { isDrawing = true; const t = e.touches[0]; const r = canvasRef.value.getBoundingClientRect(); lastX = t.clientX - r.left; lastY = t.clientY - r.top }
function onDrawTouch(e) { if (!isDrawing) return; const t = e.touches[0]; const r = canvasRef.value.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(t.clientX - r.left, t.clientY - r.top); ctx.stroke(); lastX = t.clientX - r.left; lastY = t.clientY - r.top }
function clearCanvas() { ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height) }
async function saveSignature() { const url = canvasRef.value.toDataURL(); await supabase.from('contracts').update({ signature_url: url, status: '已签' }).eq('id', signing.value.id); signing.value = null; loadContracts() }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN') : '-' }
</script>

<style scoped>
.form-item { margin-bottom: 10px; }
.form-item label { display: block; font-size: 13px; color: #64748b; margin-bottom: 4px; }
.form-item .input { width: 100%; }
.sign-canvas { border: 2px dashed #d1d5db; border-radius: 8px; background: #fafafa; cursor: crosshair; width: 100%; }
.contract-preview { font-size: 14px; line-height: 2; padding: 10px 0; }
.contract-preview p { margin: 0; }
.btn-sm.danger { color: #dc2626; border-color: #fecaca; }
</style>