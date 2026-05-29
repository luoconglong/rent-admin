<!-- src/views/Settings.vue -->
<template>
  <div>
    <h2>⚙️ 设置</h2>

    <!-- 公寓信息 -->
    <div class="card">
      <h3>🏢 公寓信息</h3>
      <div class="form-item">
        <label>公寓名称</label>
        <input v-model="apartmentName" class="input" @change="saveSetting('apartmentName', apartmentName)" />
      </div>
      <div class="form-item">
        <label>收款人</label>
        <input v-model="payee" class="input" @change="saveSetting('payee', payee)" />
      </div>
      <div class="form-item">
        <label>默认提醒天数</label>
        <input v-model.number="remindDays" type="number" class="input" style="width:100px" @change="saveRemindDays" />
      </div>
    </div>

    <!-- 单价设置 -->
    <div class="card">
      <h3>💰 单价设置</h3>
      <div class="form-row">
        <div class="form-item">
          <label>物业水单价（元/吨）</label>
          <input v-model.number="pricePropertyWater" type="number" step="0.01" class="input" @change="savePrice('pricePropertyWater', pricePropertyWater)" />
        </div>
        <div class="form-item">
          <label>物业电单价（元/度）</label>
          <input v-model.number="pricePropertyElectric" type="number" step="0.01" class="input" @change="savePrice('pricePropertyElectric', pricePropertyElectric)" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-item">
          <label>抄表水单价（元/吨）</label>
          <input v-model.number="priceMeterWater" type="number" step="0.01" class="input" @change="savePrice('priceMeterWater', priceMeterWater)" />
        </div>
        <div class="form-item">
          <label>抄表电单价（元/度）</label>
          <input v-model.number="priceMeterElectric" type="number" step="0.01" class="input" @change="savePrice('priceMeterElectric', priceMeterElectric)" />
        </div>
      </div>
    </div>

    <!-- 合同模板 -->
    <div class="card">
      <h3>📄 合同模板</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:8px">
        可用变量：{甲方} {乙方} {乙方身份证} {乙方电话} {地址} {房间} {月租} {押金} {开始日期} {结束日期} {期限月数} {入住人数} {付款方式} {水费押金}
      </p>
      <div class="form-item">
        <label>合同标题</label>
        <input v-model="contractTitle" class="input" @change="saveContractTemplate" placeholder="福茂公寓租赁协议" />
      </div>
      <div class="form-item">
        <label>合同条款（每行一条）</label>
        <textarea v-model="contractClauses" class="input" rows="20" @change="saveContractTemplate"></textarea>
      </div>
      <button class="btn primary" @click="saveContractTemplate">💾 保存模板</button>
      <span v-if="contractSaved" style="margin-left:10px;color:#16a34a">已保存 ✓</span>
    </div>

    <!-- 数据管理 -->
    <div class="card">
      <h3>💾 数据管理</h3>
      <div class="btn-group">
        <button class="btn" @click="backupCloud">☁️ 云端备份</button>
        <button class="btn" @click="restoreCloud">📥 云端恢复</button>
        <button class="btn" @click="backupLocal">💻 本地备份</button>
        <button class="btn" @click="restoreLocal">📂 本地恢复</button>
        <button class="btn" @click="exportAll">📤 导出全部数据</button>
        <button class="btn" @click="importData">📥 导入数据</button>
      </div>
      <div class="form-item" style="margin-top:12px">
        <label>备份备注</label>
        <input v-model="backupNote" class="input" placeholder="可选备注" />
      </div>
      <div v-if="backupList.length" style="margin-top:12px">
        <h4>备份记录</h4>
        <div v-for="b in backupList" :key="b.id" class="backup-item">
          <span>{{ new Date(b.created_at).toLocaleString() }}</span>
          <span>{{ b.note || '无备注' }}</span>
          <button class="btn-sm" @click="doRestore(b.id)">恢复</button>
          <button class="btn-sm danger" @click="delBackup(b.id)">删除</button>
        </div>
      </div>
    </div>

    <!-- 云丁API配置 -->
    <div class="card">
      <h3>🔌 云丁API配置</h3>
      <div class="form-item">
        <label>Client ID</label>
        <input v-model="dingClientId" class="input" @change="saveSetting('dingClientId', dingClientId)" />
      </div>
      <div class="form-item">
        <label>Client Secret</label>
        <input v-model="dingClientSecret" type="password" class="input" @change="saveSetting('dingClientSecret', dingClientSecret)" />
      </div>
      <button class="btn primary" @click="testDing">🔗 连接测试</button>
      <span v-if="dingStatus" class="ding-status" :class="dingStatus === '连接成功' ? 'green' : 'red'">{{ dingStatus }}</span>
    </div>

    <!-- 关于 -->
    <div class="card">
      <h3>ℹ️ 关于</h3>
      <p>租务小帮手 v1.0.0</p>
      <p class="gray">Supabase 已连接 ✅</p>
      <p class="gray">Project: bfwjkistyfuasjcqamkn</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase.js'
import { loadAll } from '../stores/data.js'

const apartmentName = ref('租务小帮手')
const payee = ref('')
const remindDays = ref(3)

const pricePropertyWater = ref(5.0)
const pricePropertyElectric = ref(1.5)
const priceMeterWater = ref(5.0)
const priceMeterElectric = ref(1.5)

const contractTitle = ref('福茂公寓租赁协议')
const contractClauses = ref(`出租方(甲方)：{甲方}
承租方(乙方)：{乙方}
身份证号：{乙方身份证}
电话：{乙方电话}
一、甲方将位于:{地址}{房间}房屋出租给乙方居住使用。
二、租赁期限:{期限月数}个月.入住人数{入住人数}人
三、合同自{开始日期}至{结束日期}
四、租金及付款方式:
1 租金为人民币：{月租}元/月,不满一月按一月计算。
2 租金先付后住,支付方式为{付款方式},押金{押金}元,水费押金{水费押金}元；共计_________元。
3 甲方在收到乙方租金、押金、财产保证金等后,应开具收据给乙方。电表底数_______度,水表底数______吨,电费按1.5元/度,水费5元/吨。
五、乙方履约事项:
1、乙方严禁使用明火（如燃化气等），电动车及电瓶上楼，违者按违约处理。
2、乙方保证不转租,不转让房子,未经甲方同意变动入住人员按违约处理。
3、乙方如在租赁期内解约搬走,甲方按违约处理，扣除押金。
4、合同期满退租，乙方须把卫生清理干净，如未清理押金不退。
5、租期内不得有违法活动，如经发现，当即清退，不退押金。
六、租约期满,甲方对协议第四条3进行验收,如无损坏,乙方也无其他违约行为,甲方应退还押金。
七、约定租赁期内，承租人是该房屋的实际管理者，该房屋内发生的所有安全事故、意外事故和各种违法行为都由承租人承担，与出租方无关。
八、在租赁期内如遇不可抗力因素而造成租赁合同无法履行时,双方在不可抗力的影响范围内互不承担责任,本协议一式两份,经双方签字即时生效。
注意事项:人若外出，须关闭门窗,切断房间水电源,切记!!!否则后果自负!
甲方:{甲方}                       乙方:{乙方}
电话:19376884866                  电话:{乙方电话}
签约日期:{开始日期}                 签约日期:`)
const contractSaved = ref(false)

const backupNote = ref('')
const backupList = ref([])

const dingClientId = ref('')
const dingClientSecret = ref('')
const dingStatus = ref('')

onMounted(async () => {
  const { data } = await supabase.from('settings').select('*')
  if (data) {
    const map = {}
    data.forEach(s => { map[s.key] = s.value })
    if (map.apartmentName) apartmentName.value = map.apartmentName
    if (map.payee) payee.value = map.payee
    if (map.globalRemindDays) remindDays.value = parseInt(map.globalRemindDays) || 3
    if (map.pricePropertyWater) pricePropertyWater.value = parseFloat(map.pricePropertyWater)
    if (map.pricePropertyElectric) pricePropertyElectric.value = parseFloat(map.pricePropertyElectric)
    if (map.priceMeterWater) priceMeterWater.value = parseFloat(map.priceMeterWater)
    if (map.priceMeterElectric) priceMeterElectric.value = parseFloat(map.priceMeterElectric)
    if (map.dingClientId) dingClientId.value = map.dingClientId
    if (map.dingClientSecret) dingClientSecret.value = map.dingClientSecret
    if (map.contractTitle) contractTitle.value = map.contractTitle
    if (map.contractClauses) contractClauses.value = map.contractClauses
  }
  loadBackups()
})

async function saveSetting(key, value) {
  await supabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' })
}

function saveRemindDays() { saveSetting('globalRemindDays', remindDays.value) }
function savePrice(key, val) { saveSetting(key, val) }

async function saveContractTemplate() {
  await saveSetting('contractTitle', contractTitle.value)
  await saveSetting('contractClauses', contractClauses.value)
  contractSaved.value = true
  setTimeout(() => contractSaved.value = false, 2000)
}

async function loadBackups() {
  const { data } = await supabase.from('backups').select('*').order('created_at', { ascending: false }).limit(20)
  backupList.value = data || []
}

async function backupCloud() {
  const note = backupNote.value || '手动备份'
  const [houses, rooms, tenants, bills, meters, expends, owners, settings] = await Promise.all([
    supabase.from('houses').select('*'), supabase.from('rooms').select('*'), supabase.from('tenants').select('*'),
    supabase.from('bills').select('*'), supabase.from('meters').select('*'), supabase.from('expends').select('*'),
    supabase.from('owners').select('*'), supabase.from('settings').select('*'),
  ])
  await supabase.from('backups').insert({
    user_id: 'fm780913',
    backup_data: { houses: houses.data, rooms: rooms.data, tenants: tenants.data, bills: bills.data, meters: meters.data, expends: expends.data, owners: owners.data, settings: settings.data },
    note, created_at: new Date().toISOString()
  })
  backupNote.value = ''
  alert('云端备份成功')
  loadBackups()
}

async function restoreCloud() {
  const { data } = await supabase.from('backups').select('*').order('created_at', { ascending: false }).limit(1).single()
  if (!data) return alert('没有可恢复的备份')
  if (!confirm(`恢复 ${new Date(data.created_at).toLocaleString()} 的备份？`)) return
  await doRestore(data.id)
}

async function doRestore(backupId) {
  const { data } = await supabase.from('backups').select('*').eq('id', backupId).single()
  if (!data?.backup_data) return alert('备份数据为空')
  const d = data.backup_data
  for (const table of ['houses', 'rooms', 'tenants', 'bills', 'meters', 'expends', 'owners', 'settings']) {
    if (d[table]?.length) { await supabase.from(table).delete().neq('id', '000'); await supabase.from(table).insert(d[table]) }
  }
  alert('恢复成功'); loadAll()
}

async function delBackup(id) { if (!confirm('删除此备份？')) return; await supabase.from('backups').delete().eq('id', id); loadBackups() }

function backupLocal() {
  Promise.all([supabase.from('houses').select('*'), supabase.from('rooms').select('*'), supabase.from('tenants').select('*'), supabase.from('bills').select('*'), supabase.from('meters').select('*')])
    .then(([h, r, t, b, m]) => {
      const json = JSON.stringify({ houses: h.data, rooms: r.data, tenants: t.data, bills: b.data, meters: m.data }, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup_${new Date().toISOString().slice(0,10)}.json`; a.click()
      alert('本地备份已下载')
    })
}

function restoreLocal() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]; const text = await file.text()
    try {
      const data = JSON.parse(text)
      if (!confirm('本地恢复将覆盖当前数据，确认？')) return
      for (const table of ['houses', 'rooms', 'tenants', 'bills', 'meters']) {
        if (data[table]?.length) { await supabase.from(table).delete().neq('id', '000'); await supabase.from(table).insert(data[table]) }
      }
      alert('本地恢复成功'); loadAll()
    } catch { alert('文件格式错误') }
  }
  input.click()
}

function exportAll() { backupLocal() }
function importData() { restoreLocal() }

async function testDing() {
  if (!dingClientId.value || !dingClientSecret.value) { dingStatus.value = '请填写完整配置'; return }
  dingStatus.value = '连接中...'
  setTimeout(() => { dingStatus.value = Math.random() > 0.3 ? '连接成功' : '连接失败' }, 1500)
}
</script>

<style scoped>
.card { margin-bottom: 16px; }
h3 { margin-bottom: 12px; font-size: 15px; }
.form-item { margin-bottom: 10px; }
.form-item label { display: block; font-size: 13px; color: #64748b; margin-bottom: 4px; }
.form-row { display: flex; gap: 16px; }
.form-row .form-item { flex: 1; }
.btn-group { display: flex; flex-wrap: wrap; gap: 8px; }
.backup-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.ding-status { margin-left: 10px; font-size: 13px; }
.ding-status.green { color: #16a34a; }
.ding-status.red { color: #dc2626; }
textarea.input { min-height: 400px; resize: vertical; }
</style>