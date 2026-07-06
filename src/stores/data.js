// src/stores/data.js
import { ref, reactive } from 'vue'
import { supabase } from '../supabase.js'

export const houses = ref([])
export const rooms = ref([])
export const tenants = ref([])
export const bills = ref([])
export const meters = ref([])
export const owners = ref([])
export const expends = ref([])
export const propertySettings = ref([])
export const memos = ref([])
export const globalRemindDays = ref(3)

export const stats = reactive({
  houseCount: 0, roomCount: 0, rentingCount: 0, ownerCount: 0,
  pendingCount: 0, urgentCount: 0, pendingRent: '0', pendingPay: '0', expiringCount: 0,
  vacantCount: 0, monthIncome: '0', todayExpire: 0
})

export const memoUnread = ref(0)
export const expiringList = ref([])
export const urgentBills = ref([])

function getUserId() {
  return localStorage.getItem('userId') || 'fm780913'
}

export function calcStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()

  let pendingCount = 0, pendingTotal = 0
  const nowUrgentBills = []

  for (const b of bills.value) {
    const unpaid = (b.total_amount || 0) - (b.paid_amount || 0)
    if (unpaid <= 0) continue

    let isUrgent = false
    if (b.due_date) {
      const dd = new Date(b.due_date); dd.setHours(0, 0, 0, 0)
      if (Math.floor((dd - today) / 86400000) <= 0) isUrgent = true
    } else if (b.bill_month) {
      const parts = b.bill_month.split('-')
      if (parts.length >= 2) {
        let dueDay = 1
        const t = tenants.value.find(t => String(t.id) === String(b.tenant_id) && t.status === 'renting')
        if (t) dueDay = t.payment_day || 1
        const dd2 = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, dueDay)
        dd2.setHours(0, 0, 0, 0)
        if (Math.floor((dd2 - today) / 86400000) <= 0) isUrgent = true
      }
    }

    if (isUrgent) {
      pendingCount++
      pendingTotal += unpaid
      nowUrgentBills.push(b)
    }
  }

  let rentingCount = 0, expiringCount = 0
  const nowExpiring = []
  for (const t of tenants.value) {
    if (t.status === 'renting') {
      rentingCount++
      if (t.end_date) {
        const ed = new Date(t.end_date); ed.setHours(0, 0, 0, 0)
        const diff = Math.ceil((ed - today) / 86400000)
        if (diff >= 0 && diff <= 30) {
          expiringCount++
          nowExpiring.push({ id: t.id, name: t.name, room: t.room_no, end_date: t.end_date })
        }
      }
    }
  }

  let pendingPayTotal = 0
  for (const ow of owners.value) {
    const dueDay = parseInt(ow.payment_day) || 1
    const cycle = ow.rent_cycle || 'monthly'
    const startMonth = parseInt(ow.start_month) || 1
    let dueDate3 = new Date(today.getFullYear(), startMonth - 1, dueDay)
    dueDate3.setHours(0, 0, 0, 0)
    while (dueDate3.getTime() <= todayTs) {
      if (cycle === 'quarterly') dueDate3.setMonth(dueDate3.getMonth() + 3)
      else if (cycle === 'yearly') dueDate3.setFullYear(dueDate3.getFullYear() + 1)
      else dueDate3.setMonth(dueDate3.getMonth() + 1)
    }
    if (Math.ceil((dueDate3.getTime() - todayTs) / 86400000) <= globalRemindDays.value) {
      pendingPayTotal += ow.monthly_rent || 0
    }
  }

  for (const ps of propertySettings.value) {
    const nd = ps.next_pay_date ? new Date(ps.next_pay_date) : null
    if (nd) {
      nd.setHours(0, 0, 0, 0)
      if (Math.ceil((nd.getTime() - todayTs) / 86400000) <= (ps.remind_days || 3)) {
        pendingPayTotal += ps.amount || 0
      }
    }
  }

  stats.houseCount = houses.value.length
  stats.roomCount = rooms.value.length
  stats.rentingCount = rentingCount
  stats.ownerCount = owners.value.length
  stats.pendingCount = pendingCount
  stats.urgentCount = nowUrgentBills.length
  stats.pendingRent = pendingTotal.toFixed(2)
  stats.pendingPay = pendingPayTotal.toFixed(2)
  stats.expiringCount = expiringCount
  stats.vacantCount = rooms.value.filter(r => r.status === 'vacant').length

  const cm = today.getMonth() + 1; const cy = today.getFullYear()
  let mi = 0
  for (const b of bills.value) {
    if (b.direction === 'income' && b.status === 'paid' && b.bill_month) {
      const [y, m] = b.bill_month.split('-').map(Number)
      if (y === cy && m === cm) mi += b.paid_amount || 0
    }
  }
  stats.monthIncome = mi.toFixed(2)

  let td = 0
  for (const t of tenants.value) {
    if (t.status === 'renting' && t.end_date) {
      const ed = new Date(t.end_date); ed.setHours(0,0,0,0)
      if (ed.getTime() === today.getTime()) td++
    }
  }
  stats.todayExpire = td

  expiringList.value = nowExpiring
  urgentBills.value = nowUrgentBills
  memoUnread.value = memos.value.length
}

export async function loadAll() {
  const userId = getUserId()
  const results = await Promise.allSettled([
    supabase.from('houses').select('*').eq('user_id', userId),
    supabase.from('rooms').select('*').eq('user_id', userId),
    supabase.from('tenants').select('*').eq('user_id', userId),
    supabase.from('bills').select('*').eq('user_id', userId),
    supabase.from('meters').select('*').eq('user_id', userId),
    supabase.from('owners').select('*').eq('user_id', userId),
    supabase.from('expends').select('*').eq('user_id', userId),
    supabase.from('property_settings').select('*').eq('user_id', userId),
    supabase.from('memos').select('*').eq('user_id', userId),
  ])

  const [h, r, t, b, m, o, e, ps, memo] = results

  houses.value = h.status === 'fulfilled' ? (h.value.data || []) : []
  rooms.value = r.status === 'fulfilled' ? (r.value.data || []) : []
  tenants.value = (t.status === 'fulfilled' ? (t.value.data || []) : []).map(x => ({
    ...x,
    room_no: (r.status === 'fulfilled' ? (r.value.data || []) : []).find(rr => String(rr.id) === String(x.room_id))?.room_no || '-'
  }))
  bills.value = b.status === 'fulfilled' ? (b.value.data || []) : []
  meters.value = (m.status === 'fulfilled' ? (m.value.data || []) : []).map(x => ({
    ...x,
    room_no: (r.status === 'fulfilled' ? (r.value.data || []) : []).find(rr => String(rr.id) === String(x.room_id))?.room_no || '-'
  }))
  owners.value = o.status === 'fulfilled' ? (o.value.data || []) : []
  expends.value = e.status === 'fulfilled' ? (e.value.data || []) : []
  propertySettings.value = ps.status === 'fulfilled' ? (ps.value.data || []) : []
  memos.value = memo.status === 'fulfilled' ? (memo.value.data || []) : []

  if (b.status === 'rejected') console.error('bills 查询失败:', b.reason)
  if (e.status === 'rejected') console.error('expends 查询失败:', e.reason)

  const { data: allSettings } = await supabase.from('settings').select('*')
  if (allSettings) {
    const apName = allSettings.find(s => s.key === 'apartmentName_' + userId || s.key === 'apartmentName')
    if (apName) localStorage.setItem('apartmentName_' + userId, apName.value)
    const payee = allSettings.find(s => s.key === 'payeeName_' + userId)
    if (payee) localStorage.setItem('payeeName_' + userId, payee.value)
    const remind = allSettings.find(s => s.key === 'globalRemindDays')
    if (remind) globalRemindDays.value = Number(remind.value) || 3
  }

  calcStats()
}