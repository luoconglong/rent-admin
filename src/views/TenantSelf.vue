<template>
  <div>
    <div class="page-head"><h2>👤 租客自助查询</h2></div>
    
    <div class="card" v-if="!verified">
      <h3>验证身份</h3>
      <div class="form-item"><label>手机号</label><input v-model="phone" class="input" placeholder="请输入租客手机号" /></div>
      <button class="btn primary full" @click="verifyPhone">验证</button>
      <p class="error" v-if="errorMsg">{{ errorMsg }}</p>
    </div>

    <div v-if="verified && tenant">
      <div class="card">
        <h3>📋 基本信息</h3>
        <div class="detail-row"><span>姓名</span><span>{{ tenant.name }}</span></div>
        <div class="detail-row"><span>房间</span><span>{{ houseName }} {{ roomNo }}</span></div>
        <div class="detail-row"><span>合同期</span><span>{{ tenant.start_date }} 至 {{ tenant.end_date }}</span></div>
        <div class="detail-row"><span>月租</span><span>¥{{ tenant.rent_amount }}</span></div>
      </div>

      <div class="card" v-if="pendingBills.length">
        <h3>💰 待交账单</h3>
        <div v-for="b in pendingBills" :key="b.id" class="bill-row">
          <div class="bill-info">
            <span>{{ b.category }} · {{ b.bill_month }}</span>
            <span class="red">¥{{ b.unpaid }}</span>
          </div>
          <div class="bill-actions">
            <label class="upload-label">
              📎 上传凭证
              <input type="file" accept="image/*" @change="e => uploadReceipt(e, b.id)" style="display:none" />
            </label>
            <span v-if="b.receiptUrl" class="upload-link" @click="window.open(b.receiptUrl)">查看凭证</span>
          </div>
        </div>
      </div>

      <div class="card" v-if="paidBills.length">
        <h3>✅ 已交记录</h3>
        <div v-for="b in paidBills" :key="b.id" class="bill-row">
          <span>{{ b.category }} · {{ b.bill_month }}</span>
          <span class="green">¥{{ b.total_amount }}</span>
        </div>
      </div>

      <div class="card">
        <h3>⚡ 水电底数</h3>
        <div class="detail-row"><span>水表</span><span>{{ tenant.water_reading || '-' }} 吨</span></div>
        <div class="detail-row"><span>电表</span><span>{{ tenant.electric_reading || '-' }} 度</span></div>
      </div>
    </div>

    <div v-if="verified && !tenant" class="empty">未找到该手机号对应的租客</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { tenants, rooms, houses, bills, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const phone = ref('')
const verified = ref(false)
const errorMsg = ref('')
const tenant = ref(null)
const houseName = ref('')
const roomNo = ref('')

const pendingBills = computed(() => {
  if (!tenant.value) return []
  return bills.value
    .filter(b => b.tenant_id == tenant.value.id && b.status !== 'paid')
    .map(b => ({ ...b, unpaid: ((b.total_amount || 0) - (b.paid_amount || 0)).toFixed(2), receiptUrl: null }))
})

const paidBills = computed(() => {
  if (!tenant.value) return []
  return bills.value.filter(b => b.tenant_id == tenant.value.id && b.status === 'paid')
})

function verifyPhone() {
  errorMsg.value = ''
  const t = tenants.value.find(x => x.phone === phone.value.trim())
  if (!t) { errorMsg.value = '未找到该手机号对应的租客'; return }
  tenant.value = t
  const room = rooms.value.find(r => r.id == t.room_id)
  roomNo.value = room?.room_no || ''
  houseName.value = houses.value.find(h => h.id == room?.house_id)?.address || ''
  verified.value = true
}

async function uploadReceipt(e, billId) {
  const file = e.target.files[0]
  if (!file) return
  const fileName = `receipts/${tenant.value.id}_${billId}_${Date.now()}.${file.name.split('.').pop()}`
  const { error } = await supabase.storage.from('receipts').upload(fileName, file)
  if (error) { alert('上传失败'); return }
  const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
  if (data?.publicUrl) {
    const pending = pendingBills.value
    const bill = pending.find(b => b.id === billId)
    if (bill) bill.receiptUrl = data.publicUrl
  }
  alert('凭证上传成功，等待房东确认')
}
</script>

<style scoped>
.detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.detail-row span:first-child { color: #64748b; }
.bill-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.bill-info { display: flex; flex-direction: column; gap: 2px; }
.bill-actions { display: flex; gap: 8px; align-items: center; }
.upload-label { color: #1e6f5c; cursor: pointer; font-size: 12px; }
.upload-link { color: #3b82f6; cursor: pointer; font-size: 12px; }
.error { color: #dc2626; margin-top: 8px; font-size: 13px; }
.btn.full { width: 100%; margin-top: 8px; }
</style>