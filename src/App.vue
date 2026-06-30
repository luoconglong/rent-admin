<template>
  <!-- 租客自助模式：纯净页面，无侧边栏 -->
  <div v-if="isTenantSelfMode" class="tenant-self-only">
    <TenantSelf />
  </div>

  <!-- 恢复码登录 -->
  <div class="login-page" v-else-if="!userIdVerified">
    <div class="login-card">
      <h1>🏢 租务小帮手</h1>
      <p class="subtitle">输入恢复码登录</p>
      <input v-model="restoreCode" class="input" placeholder="请输入恢复码" @keyup.enter="verifyRestoreCode" />
      <p class="error" v-if="restoreError">{{ restoreError }}</p>
      <button class="btn primary full" @click="verifyRestoreCode" :disabled="restoring">{{ restoring ? '验证中...' : '登录' }}</button>
      <p class="link" style="margin-top:16px">首次使用？联系管理员获取恢复码</p>
    </div>
  </div>

  <div id="app" v-else>
    <header class="header">
      <div class="logo">🏢 租务小帮手</div>
      <div class="header-right">
        <span class="user-badge">👤 房东</span>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>
    </header>

    <div class="main">
      <aside class="sidebar">
        <div v-for="m in menus" :key="m.key"
          :class="['menu-item', { active: current === m.key }]"
          @click="current = m.key">
          <span>{{ m.icon }}</span>
          <span>{{ m.label }}</span>
        </div>
      </aside>

      <section class="content">
        <Dashboard v-if="current === 'dashboard'" />
        <Houses v-if="current === 'rooms'" @openDetail="detailId = $event" @openCheckin="openCheckin" @openCheckout="doCheckout" />
        <Tenants v-if="current === 'tenants'" @openDetail="detailId = $event" @openCheckout="doCheckout" @openCheckin="openCheckin" />
        <Bills v-if="current === 'bills'" @openBillCreate="showBillCreate = true" />
        <Meters v-if="current === 'meters'" @openDialog="openDialog" @openCharge="showMeterCharge = true" @openDeduct="showMeterDeduct = true" @openRemain="showMeterRemain = true" @openDing="showDingBalance = true" @openProperty="showPropertySettings = true" />
        <MeterRank v-if="current === 'meterrank'" />
        <Unified v-if="current === 'unified'" />
        <Expends v-if="current === 'expends'" />
        <Owners v-if="current === 'owners'" @openDialog="openDialog" @openOwnerPay="showOwnerPay = true" />
        <Reports v-if="current === 'reports'" />
        <Contracts v-if="current === 'contracts'" @print="showPrintContract = $event" />
        <Memos v-if="current === 'memos'" />
        <CheckoutPage v-if="current === 'checkout'" :tenantId="checkoutTenantId" @close="current = 'dashboard'" />
        <Settings v-if="current === 'settings'" />
      </section>
    </div>

    <div class="mask" v-if="dialog.show" @click.self="dialog.show = false">
      <div class="dialog">
        <h3>{{ dialog.title }}</h3>
        <div v-for="f in dialog.fields" :key="f.key" class="form-item">
          <label>{{ f.label }}</label>
          <input v-if="f.type !== 'select'" v-model="dialog.form[f.key]" :type="f.type || 'text'" :placeholder="f.placeholder" class="input" />
          <select v-else v-model="dialog.form[f.key]" class="input">
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="dialog-btns">
          <button class="btn" @click="dialog.show = false">取消</button>
          <button class="btn primary" @click="dialog.onConfirm">确定</button>
        </div>
      </div>
    </div>

    <Checkin v-if="showCheckin" :roomId="checkinRoomId" @close="showCheckin = false; loadAll()" />
    <TenantDetail v-if="detailId" :tenantId="detailId" @close="detailId = null" @billCreate="showBillCreate = true" />
    <BillCreate v-if="showBillCreate" :tenantId="detailId" @close="showBillCreate = false; loadAll()" />
    <MeterCharge v-if="showMeterCharge" @close="showMeterCharge = false; loadAll()" />
    <MeterDeduct v-if="showMeterDeduct" @close="showMeterDeduct = false; loadAll()" />
    <MeterRemain v-if="showMeterRemain" @close="showMeterRemain = false; loadAll()" />
    <PropertySettings v-if="showPropertySettings" @close="showPropertySettings = false; loadAll()" />
    <OwnerPay v-if="showOwnerPay" @close="showOwnerPay = false; loadAll()" />
    <DingBalance v-if="showDingBalance" @close="showDingBalance = false" />
    <PrintContract v-if="showPrintContract" :contract="showPrintContract" @close="showPrintContract = null" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { houses, rooms, loadAll } from './stores/data.js'
import { supabase } from './supabase.js'
import Dashboard from './views/Dashboard.vue'
import Houses from './views/Houses.vue'
import Tenants from './views/Tenants.vue'
import TenantDetail from './views/TenantDetail.vue'
import Bills from './views/Bills.vue'
import BillCreate from './views/BillCreate.vue'
import Meters from './views/Meters.vue'
import MeterRank from './views/MeterRank.vue'
import MeterCharge from './views/MeterCharge.vue'
import MeterDeduct from './views/MeterDeduct.vue'
import MeterRemain from './views/MeterRemain.vue'
import Unified from './views/Unified.vue'
import Expends from './views/Expends.vue'
import PropertySettings from './views/PropertySettings.vue'
import Owners from './views/Owners.vue'
import OwnerPay from './views/OwnerPay.vue'
import Reports from './views/Reports.vue'
import Contracts from './views/Contracts.vue'
import PrintContract from './views/PrintContract.vue'
import Memos from './views/Memos.vue'
import TenantSelf from './views/TenantSelf.vue'
import CheckoutPage from './views/CheckoutPage.vue'
import DingBalance from './views/DingBalance.vue'
import Settings from './views/Settings.vue'
import Checkin from './views/Checkin.vue'

const current = ref('dashboard')
const showCheckin = ref(false)
const checkinRoomId = ref(null)
const checkoutTenantId = ref(null)
const detailId = ref(null)
const showBillCreate = ref(false)
const showMeterCharge = ref(false)
const showMeterDeduct = ref(false)
const showMeterRemain = ref(false)
const showPropertySettings = ref(false)
const showOwnerPay = ref(false)
const showDingBalance = ref(false)
const showPrintContract = ref(null)
const userIdVerified = ref(false)
const restoreCode = ref('')
const restoreError = ref('')
const restoring = ref(false)

const isTenantSelfMode = computed(() => {
  const params = new URLSearchParams(window.location.search)
  return params.get('page') === 'tenantself'
})

function openCheckin(roomId) {
  checkinRoomId.value = String(roomId)
  showCheckin.value = true
}

function doCheckout(tenantId) {
  checkoutTenantId.value = String(tenantId)
  current.value = 'checkout'
}

const menus = [
  { key: 'dashboard', label: '首页看板', icon: '📊' },
  { key: 'rooms', label: '房源管理', icon: '🏠' },
  { key: 'tenants', label: '租客管理', icon: '🧑‍🤝‍🧑' },
  { key: 'bills', label: '账单管理', icon: '💰' },
  { key: 'meters', label: '水电物业', icon: '⚡' },
  { key: 'meterrank', label: '抄表排行', icon: '📊' },
  { key: 'unified', label: '统一抄表', icon: '📋' },
  { key: 'expends', label: '支出明细', icon: '💸' },
  { key: 'owners', label: '业主管理', icon: '🏢' },
  { key: 'reports', label: '报表', icon: '📈' },
  { key: 'contracts', label: '电子合同', icon: '📄' },
  { key: 'memos', label: '备忘提醒', icon: '📝' },
  { key: 'settings', label: '设置', icon: '⚙️' },
]

const dialog = reactive({ show: false, title: '', fields: [], form: {}, onConfirm: () => {} })

function openDialog(type) {
  dialog.form = {}
  if (type === 'house') {
    dialog.title = '添加楼栋'
    dialog.fields = [{ key: 'address', label: '楼栋名称', placeholder: '如: 幸福小区A栋' }]
    dialog.onConfirm = async () => { await supabase.from('houses').insert({ address: dialog.form.address }); dialog.show = false; loadAll() }
  } else if (type === 'meter') {
    dialog.title = '添加表具'
    dialog.fields = [
      { key: 'room_id', label: '房间', type: 'select', options: rooms.value.map(r => ({ value: r.id, label: r.room_no })) },
      { key: 'type', label: '类型', type: 'select', options: [{ value: '电表', label: '电表' }, { value: '水表', label: '水表' }] },
      { key: 'current_reading', label: '当前读数', type: 'number' },
    ]
    dialog.onConfirm = async () => { await supabase.from('meters').insert({ room_id: dialog.form.room_id, type: dialog.form.type, current_reading: Number(dialog.form.current_reading) }); dialog.show = false; loadAll() }
  } else if (type === 'owner') {
    dialog.title = '添加业主'
    dialog.fields = [
      { key: 'name', label: '姓名' }, { key: 'phone', label: '手机号' },
      { key: 'monthly_rent', label: '月租金', type: 'number' },
      { key: 'rent_cycle', label: '付款周期', type: 'select', options: [{ value: '月付', label: '月付' }, { value: '季付', label: '季付' }, { value: '年付', label: '年付' }] },
      { key: 'payment_day', label: '付款日', type: 'number', placeholder: '1' },
      { key: 'start_month', label: '起付月份', type: 'number', placeholder: '1' },
    ]
    dialog.onConfirm = async () => {
      const f = dialog.form
      await supabase.from('owners').insert({ name: f.name, phone: f.phone, monthly_rent: Number(f.monthly_rent) || 0, rent_cycle: f.rent_cycle || '月付', payment_day: Number(f.payment_day) || 1, start_month: Number(f.start_month) || 1 })
      dialog.show = false; loadAll()
    }
  }
  dialog.show = true
}

async function verifyRestoreCode() {
  restoreError.value = ''
  if (!restoreCode.value.trim()) { restoreError.value = '请输入恢复码'; return }
  restoring.value = true

  const userId = restoreCode.value.trim()

  const { data: check } = await supabase
    .from('houses')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  restoring.value = false

  if (!check || check.length === 0) {
    restoreError.value = '恢复码无效或无数据'
    return
  }

  localStorage.setItem('userId', userId)
  userIdVerified.value = true
  loadAll()
}

function handleLogout() {
  localStorage.removeItem('userId')
  userIdVerified.value = false
  restoreCode.value = ''
}

onMounted(() => {
  if (isTenantSelfMode.value) return  // 租客自助模式不做任何初始化

  const saved = localStorage.getItem('userId')
  if (saved) {
    restoreCode.value = saved
    verifyRestoreCode()
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get('page') === 'checkout') {
    current.value = 'checkout'
    checkoutTenantId.value = params.get('tenantId')
  }
})
</script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;background:#f5f7fb;color:#1e293b}
.tenant-self-only { min-height: 100vh; background: #f5f7fb; }
.header{height:56px;background:#fff;border-bottom:1px solid #e8ecf1;display:flex;align-items:center;justify-content:space-between;padding:0 20px}
.logo{font-size:18px;font-weight:700;color:#1e6f5c}
.header-right{display:flex;align-items:center;gap:12px}
.user-badge{font-size:14px}
.btn-logout{background:none;border:1px solid #e8ecf1;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px}
.main{display:flex;min-height:calc(100vh - 56px)}
.sidebar{width:190px;background:#fff;border-right:1px solid #e8ecf1;padding:12px 8px}
.menu-item{padding:10px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;color:#475569;margin-bottom:2px}
.menu-item:hover{background:#f1f5f9}
.menu-item.active{background:#eef7f2;color:#1e6f5c;font-weight:600}
.content{flex:1;padding:20px 24px;overflow-y:auto}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.stat-card{background:#fff;border-radius:12px;padding:16px;border:1px solid #e8ecf1;text-align:center}
.stat-num{font-size:24px;font-weight:700;color:#1e293b}
.stat-label{font-size:12px;color:#64748b;margin-top:4px}
.card{background:#fff;border-radius:12px;padding:18px;border:1px solid #e8ecf1;margin-bottom:14px}
.remind-item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9}
.page-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}
.head-btns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.house-card{margin-bottom:12px}
.house-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.tbl{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}
.tbl th,.tbl td{text-align:left;padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
.tbl th{background:#f8fafc;color:#64748b;font-weight:500}
.tag{padding:3px 8px;border-radius:10px;font-size:11px;font-weight:500}
.tag.green{background:#dcfce7;color:#166534}
.tag.gray{background:#f1f5f9;color:#64748b}
.tag.warn{background:#fef3c7;color:#b45309}
.btn,.btn-sm{border:1px solid #e8ecf1;background:#fff;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px}
.btn.primary,.btn-sm.primary{background:#1e6f5c;color:#fff;border-color:#1e6f5c}
.btn-sm{padding:4px 10px;font-size:12px}
.btn-sm.green{background:#dcfce7;color:#166534;border-color:#bbf7d0}
.btn-sm.danger{color:#dc2626;border-color:#fecaca}
.input{padding:7px 10px;border:1px solid #e8ecf1;border-radius:8px;font-size:13px;outline:none;background:#fff}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
.mask{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);display:flex;justify-content:center;align-items:center;z-index:200}
.dialog{background:#fff;border-radius:16px;padding:22px;width:400px;max-width:90%}
.dialog h3{margin-bottom:14px}
.form-item{margin-bottom:10px}
.form-item label{display:block;font-size:13px;color:#64748b;margin-bottom:4px}
.form-item .input{width:100%}
.dialog-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f7fb; }
.login-card { background: white; border-radius: 20px; padding: 40px; width: 380px; max-width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; }
h1 { font-size: 24px; color: #1e6f5c; margin-bottom: 4px; }
.subtitle { color: #94a3b8; margin-bottom: 24px; }
.link { color: #1e6f5c; cursor: pointer; margin-top: 12px; font-size: 13px; }
.error { color: #dc2626; margin-top: 8px; font-size: 13px; }
.btn.full { width: 100%; margin-top: 8px; }
</style>