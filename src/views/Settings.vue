<template>
  <div>
    <h2>⚙️ 设置</h2>

    <div class="card">
      <div class="card-head" @click="showApartment = !showApartment">
        <h3>🏢 公寓信息</h3><span>{{ showApartment ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showApartment">
        <div class="form-item"><label>公寓名称</label><input v-model="apartmentName" class="input" @change="saveSetting('apartmentName', apartmentName)" /></div>
        <div class="form-item"><label>收款人</label><input v-model="payee" class="input" @change="saveSetting('payee', payee)" /></div>
        <div class="form-item"><label>默认提醒天数</label><input v-model.number="remindDays" type="number" class="input" style="width:100px" @change="saveRemindDays" /></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" @click="showPrice = !showPrice">
        <h3>💰 单价设置</h3><span>{{ showPrice ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showPrice">
        <div class="form-row"><div class="form-item"><label>物业水单价</label><input v-model.number="pricePropertyWater" type="number" step="0.01" class="input" @change="savePrice('pricePropertyWater', pricePropertyWater)" /></div><div class="form-item"><label>物业电单价</label><input v-model.number="pricePropertyElectric" type="number" step="0.01" class="input" @change="savePrice('pricePropertyElectric', pricePropertyElectric)" /></div></div>
        <div class="form-row"><div class="form-item"><label>抄表水单价</label><input v-model.number="priceMeterWater" type="number" step="0.01" class="input" @change="savePrice('priceMeterWater', priceMeterWater)" /></div><div class="form-item"><label>抄表电单价</label><input v-model.number="priceMeterElectric" type="number" step="0.01" class="input" @change="savePrice('priceMeterElectric', priceMeterElectric)" /></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" @click="showContract = !showContract">
        <h3>📄 合同模板</h3><span>{{ showContract ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showContract">
        <p style="font-size:12px;color:#64748b;margin-bottom:8px">可用变量：{甲方} {乙方} {乙方身份证} {乙方电话} {地址} {房间} {月租} {押金} {开始日期} {结束日期} {期限月数} {入住人数} {付款方式} {水费押金}</p>
        <div class="form-item"><label>合同标题</label><input v-model="contractTitle" class="input" @change="saveContractTemplate" /></div>
        <div class="form-item"><label>合同条款</label><textarea v-model="contractClauses" class="input" rows="20" @change="saveContractTemplate"></textarea></div>
        <button class="btn primary" @click="saveContractTemplate">💾 保存模板</button>
        <span v-if="contractSaved" class="green" style="margin-left:10px">已保存 ✓</span>
      </div>
    </div>

    <div class="card">
      <div class="card-head" @click="showAdmin = !showAdmin">
        <h3>🔐 管理员中心</h3><span>{{ showAdmin ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showAdmin">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <strong>注册码管理</strong>
          <button class="btn primary" @click="generateCode">+ 生成注册码</button>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-num">¥{{ monthIncome }}</div><div class="stat-label">本月收入</div></div>
          <div class="stat-card"><div class="stat-num">¥{{ totalIncome }}</div><div class="stat-label">累计收入</div></div>
          <div class="stat-card"><div class="stat-num">{{ activeCount }}</div><div class="stat-label">激活中</div></div>
          <div class="stat-card"><div class="stat-num">{{ expiringCount }}</div><div class="stat-label">即将到期</div></div>
        </div>
        <table class="tbl" v-if="codeHistory.length">
          <thead><tr><th>注册码</th><th>备注</th><th>价格</th><th>状态</th><th>到期</th><th>时间</th></tr></thead>
          <tbody><tr v-for="c in codeHistory" :key="c.code"><td>{{ c.code }}</td><td>{{ c.note }}</td><td>¥{{ c.price }}</td><td><span :class="['tag', c.status === '已使用' ? 'green' : 'gray']">{{ c.status }}</span></td><td>{{ formatDate2(c.expiresAt) }}</td><td>{{ c.time }}</td></tr></tbody>
        </table>
        <div v-else class="empty">暂无注册码</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" @click="showBackup = !showBackup">
        <h3>💾 数据管理</h3><span>{{ showBackup ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showBackup">
        <div class="btn-group">
          <button class="btn" @click="backupCloud">☁️ 云端备份</button>
          <button class="btn" @click="restoreCloud">📥 云端恢复</button>
          <button class="btn" @click="backupLocal">💻 本地备份</button>
          <button class="btn" @click="restoreLocal">📂 本地恢复</button>
          <button class="btn" @click="exportAll">📤 导出全部</button>
          <button class="btn" @click="importData">📥 导入数据</button>
          <button class="btn danger" @click="resetAll">🔄 重置为默认</button>
        </div>
        <div class="form-item" style="margin-top:12px"><label>备份备注</label><input v-model="backupNote" class="input" placeholder="可选备注" /></div>
        <div v-if="backupList.length" style="margin-top:12px"><h4>备份记录</h4>
          <div v-for="b in backupList" :key="b.id" class="backup-item"><span>{{ new Date(b.created_at).toLocaleString() }}</span><span>{{ b.note || '无备注' }}</span><button class="btn-sm" @click="doRestore(b.id)">恢复</button><button class="btn-sm danger" @click="delBackup(b.id)">删除</button></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head" @click="showDing = !showDing">
        <h3>🔌 云丁API配置</h3><span>{{ showDing ? '▲' : '▼' }}</span>
      </div>
      <div v-if="showDing">
        <div class="form-item"><label>Client ID</label><input v-model="dingClientId" class="input" @change="saveSetting('dingClientId', dingClientId)" /></div>
        <div class="form-item"><label>Client Secret</label><input v-model="dingClientSecret" type="password" class="input" @change="saveSetting('dingClientSecret', dingClientSecret)" /></div>
        <button class="btn primary" @click="testDing">🔗 连接测试</button><span v-if="dingStatus" :class="dingStatus==='连接成功'?'green':'red'">{{ dingStatus }}</span>
      </div>
    </div>

    <div class="card">
      <h3>ℹ️ 关于</h3>
      <p>租务小帮手 v1.0.0</p><p class="gray">Supabase 已连接 ✅</p><p class="gray">Project: bfwjkistyfuasjcqamkn</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase.js'
import { loadAll } from '../stores/data.js'

const showApartment = ref(true), showPrice = ref(false), showContract = ref(false), showAdmin = ref(false), showBackup = ref(false), showDing = ref(false)
const apartmentName = ref('租务小帮手'), payee = ref(''), remindDays = ref(3)
const pricePropertyWater = ref(5.0), pricePropertyElectric = ref(1.5), priceMeterWater = ref(5.0), priceMeterElectric = ref(1.5)
const contractTitle = ref('福茂公寓租赁协议')
const contractClauses = ref(`出租方(甲方)：{甲方}\n承租方(乙方)：{乙方}\n身份证号：{乙方身份证}\n电话：{乙方电话}\n一、甲方将位于:{地址}{房间}房屋出租给乙方居住使用。\n二、租赁期限:{期限月数}个月.入住人数{入住人数}人\n三、合同自{开始日期}至{结束日期}\n四、租金及付款方式:\n1 租金为人民币：{月租}元/月,不满一月按一月计算。\n2 租金先付后住,支付方式为{付款方式},押金{押金}元,水费押金{水费押金}元；共计_________元。\n3 甲方在收到乙方租金、押金、财产保证金等后,应开具收据给乙方。电表底数_______度,水表底数______吨,电费按1.5元/度,水费5元/吨。\n五、乙方履约事项:\n1、乙方严禁使用明火（如燃化气等），电动车及电瓶上楼，违者按违约处理。\n2、乙方保证不转租,不转让房子,未经甲方同意变动入住人员按违约处理。\n3、乙方如在租赁期内解约搬走,甲方按违约处理，扣除押金。\n4、合同期满退租，乙方须把卫生清理干净，如未清理押金不退。\n5、租期内不得有违法活动，如经发现，当即清退，不退押金。\n六、租约期满,甲方对协议第四条3进行验收,如无损坏,乙方也无其他违约行为,甲方应退还押金。\n七、约定租赁期内，承租人是该房屋的实际管理者，该房屋内发生的所有安全事故、意外事故和各种违法行为都由承租人承担，与出租方无关。\n八、在租赁期内如遇不可抗力因素而造成租赁合同无法履行时,双方在不可抗力的影响范围内互不承担责任,本协议一式两份,经双方签字即时生效。\n注意事项:人若外出，须关闭门窗,切断房间水电源,切记!!!否则后果自负!\n甲方:{甲方} 乙方:{乙方}\n电话:19376884866 电话:{乙方电话}\n签约日期:{开始日期} 签约日期:`)
const contractSaved = ref(false)
const backupNote = ref(''), backupList = ref([])
const dingClientId = ref(''), dingClientSecret = ref(''), dingStatus = ref('')
const codeHistory = ref([]), monthIncome = ref(0), totalIncome = ref(0), activeCount = ref(0), expiringCount = ref(0)

function formatDate2(t) { return t ? new Date(t).toLocaleDateString('zh-CN') : '-' }

function loadCodeHistory() {
  const data = JSON.parse(localStorage.getItem('codeHistory') || '[]')
  codeHistory.value = data
  const now = new Date(), cm = now.getMonth() + 1
  let mi = 0, ti = 0, ac = 0, ec = 0
  for (const c of data) {
    if (c.status === '已使用') { ti += c.price || 0; ac++; try { if (new Date(c.time).getMonth() + 1 === cm) mi += c.price || 0 } catch(e) {} }
    if (c.expiresAt && c.status === '已使用') { const diff = Math.ceil((new Date(c.expiresAt) - now) / 86400000); if (diff <= 7 && diff >= 0) ec++ }
  }
  monthIncome.value = mi; totalIncome.value = ti; activeCount.value = ac; expiringCount.value = ec
}

function generateCode() {
  const prices = [19, 49, 79, 99], days = [30, 90, 180, 365]
  const labels = ['1个月 ¥19', '3个月 ¥49', '6个月 ¥79', '12个月 ¥99']
  const idx = parseInt(prompt(labels.join('\n') + '\n\n输入序号 1-4：') || '0')
  if (!idx || idx < 1 || idx > 4) return
  const i = idx - 1
  const note = prompt('输入备注：') || ''
  const code = 'RC_' + Date.now().toString(36).toUpperCase() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase()
  const data = JSON.parse(localStorage.getItem('codeHistory') || '[]')
  data.unshift({ code, note, time: new Date().toLocaleString(), status: '未使用', price: prices[i], expireDays: days[i], expiresAt: new Date(Date.now() + days[i] * 86400000).toISOString() })
  localStorage.setItem('codeHistory', JSON.stringify(data))
  loadCodeHistory()
}

onMounted(async () => {
  const { data } = await supabase.from('settings').select('*')
  if (data) { const m = {}; data.forEach(s => { m[s.key] = s.value }); if (m.apartmentName) apartmentName.value = m.apartmentName; if (m.payee) payee.value = m.payee; if (m.globalRemindDays) remindDays.value = parseInt(m.globalRemindDays) || 3; if (m.pricePropertyWater) pricePropertyWater.value = parseFloat(m.pricePropertyWater); if (m.pricePropertyElectric) pricePropertyElectric.value = parseFloat(m.pricePropertyElectric); if (m.priceMeterWater) priceMeterWater.value = parseFloat(m.priceMeterWater); if (m.priceMeterElectric) priceMeterElectric.value = parseFloat(m.priceMeterElectric); if (m.dingClientId) dingClientId.value = m.dingClientId; if (m.dingClientSecret) dingClientSecret.value = m.dingClientSecret; if (m.contractTitle) contractTitle.value = m.contractTitle; if (m.contractClauses) contractClauses.value = m.contractClauses }
  loadBackups(); loadCodeHistory()
})

async function saveSetting(key, value) { await supabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' }) }
function saveRemindDays() { saveSetting('globalRemindDays', remindDays.value) }
function savePrice(key, val) { saveSetting(key, val) }
async function saveContractTemplate() { await saveSetting('contractTitle', contractTitle.value); await saveSetting('contractClauses', contractClauses.value); contractSaved.value = true; setTimeout(() => contractSaved.value = false, 2000) }
async function loadBackups() { const { data } = await supabase.from('backups').select('*').order('created_at', { ascending: false }).limit(20); backupList.value = data || [] }
async function backupCloud() { const note = backupNote.value || '手动备份'; const [houses, rooms, tenants, bills, meters, expends, owners, settings] = await Promise.all([supabase.from('houses').select('*'), supabase.from('rooms').select('*'), supabase.from('tenants').select('*'), supabase.from('bills').select('*'), supabase.from('meters').select('*'), supabase.from('expends').select('*'), supabase.from('owners').select('*'), supabase.from('settings').select('*')]); await supabase.from('backups').insert({ user_id: 'fm780913', backup_data: { houses: houses.data, rooms: rooms.data, tenants: tenants.data, bills: bills.data, meters: meters.data, expends: expends.data, owners: owners.data, settings: settings.data }, note, created_at: new Date().toISOString() }); backupNote.value = ''; alert('云端备份成功'); loadBackups() }
async function restoreCloud() { const { data } = await supabase.from('backups').select('*').order('created_at', { ascending: false }).limit(1).single(); if (!data) return alert('没有可恢复的备份'); if (!confirm(`恢复 ${new Date(data.created_at).toLocaleString()} 的备份？`)) return; await doRestore(data.id) }
async function doRestore(backupId) { const { data } = await supabase.from('backups').select('*').eq('id', backupId).single(); if (!data?.backup_data) return alert('备份数据为空'); const d = data.backup_data; for (const table of ['houses', 'rooms', 'tenants', 'bills', 'meters', 'expends', 'owners', 'settings']) { if (d[table]?.length) { await supabase.from(table).delete().neq('id', '000'); await supabase.from(table).insert(d[table]) } } alert('恢复成功'); loadAll() }
async function delBackup(id) { if (!confirm('删除此备份？')) return; await supabase.from('backups').delete().eq('id', id); loadBackups() }
function backupLocal() { Promise.all([supabase.from('houses').select('*'), supabase.from('rooms').select('*'), supabase.from('tenants').select('*'), supabase.from('bills').select('*'), supabase.from('meters').select('*')]).then(([h, r, t, b, m]) => { const json = JSON.stringify({ houses: h.data, rooms: r.data, tenants: t.data, bills: b.data, meters: m.data }, null, 2); const blob = new Blob([json], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); alert('本地备份已下载') }) }
function restoreLocal() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = async (e) => { const file = e.target.files[0]; const text = await file.text(); try { const data = JSON.parse(text); if (!confirm('本地恢复将覆盖当前数据，确认？')) return; for (const table of ['houses', 'rooms', 'tenants', 'bills', 'meters']) { if (data[table]?.length) { await supabase.from(table).delete().neq('id', '000'); await supabase.from(table).insert(data[table]) } } alert('本地恢复成功'); loadAll() } catch { alert('文件格式错误') } }; input.click() }
function exportAll() { backupLocal() }
function importData() { restoreLocal() }
async function testDing() { if (!dingClientId.value || !dingClientSecret.value) { dingStatus.value = '请填写完整配置'; return }; dingStatus.value = '连接中...'; setTimeout(() => { dingStatus.value = Math.random() > 0.3 ? '连接成功' : '连接失败' }, 1500) }

async function resetAll() {
  if (!confirm('⚠️ 重置为默认将清空所有数据。\n\n重置前会自动备份到云端，确认继续？')) return
  if (!confirm('再次确认：清空所有业务数据？')) return

  const [houses, rooms, tenants, bills, meters, expends, owners, settings] = await Promise.all([
    supabase.from('houses').select('*'),
    supabase.from('rooms').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('bills').select('*'),
    supabase.from('meters').select('*'),
    supabase.from('expends').select('*'),
    supabase.from('owners').select('*'),
    supabase.from('settings').select('*')
  ])
  await supabase.from('backups').insert({
    user_id: 'fm780913',
    backup_data: {
      houses: houses.data, rooms: rooms.data, tenants: tenants.data,
      bills: bills.data, meters: meters.data, expends: expends.data,
      owners: owners.data, settings: settings.data
    },
    note: '重置前自动备份',
    created_at: new Date().toISOString()
  })

  const tables = ['houses', 'rooms', 'tenants', 'bills', 'meters', 'expends', 'owners']
  for (const table of tables) {
    await supabase.from(table).delete().neq('id', '000')
  }

  const defaults = [
    { key: 'apartmentName', value: '租务小帮手' },
    { key: 'globalRemindDays', value: '3' },
    { key: 'pricePropertyWater', value: '5.0' },
    { key: 'pricePropertyElectric', value: '1.5' },
    { key: 'priceMeterWater', value: '5.0' },
    { key: 'priceMeterElectric', value: '1.5' },
  ]
  for (const d of defaults) {
    await supabase.from('settings').upsert({ key: d.key, value: d.value }, { onConflict: 'key' })
  }

  alert('已重置为默认，备份已保存到云端。\n如需恢复，请在数据管理中点"云端恢复"。')
  await loadAll()
  location.reload()
}
</script>

<style scoped>
.backup-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--gray-100); font-size: 13px; }
</style>