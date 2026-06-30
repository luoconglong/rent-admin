import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bfwjkistyfuasjcqamkn.supabase.co'
const supabaseKey = 'sb_publishable_h7faLemveK76KhOj8oh9Dw_csQxVXpt'

const rawSupabase = createClient(supabaseUrl, supabaseKey)

function getUserId() {
  return localStorage.getItem('userId') || 'fm780913'
}

// 需要跳过 user_id 的表
const skipTables = ['backups', 'settings']

// 包装 from 方法
const originalFrom = rawSupabase.from.bind(rawSupabase)
rawSupabase.from = function(table) {
  const query = originalFrom(table)
  
  // 拦截 insert
  const originalInsert = query.insert.bind(query)
  query.insert = function(data, options) {
    if (!skipTables.includes(table) && data && !Array.isArray(data) && !data.user_id) {
      data = { ...data, user_id: getUserId() }
    }
    if (Array.isArray(data)) {
      data = data.map(d => {
        if (!d.user_id) return { ...d, user_id: getUserId() }
        return d
      })
    }
    return originalInsert(data, options)
  }

  // 拦截 upsert
  const originalUpsert = query.upsert.bind(query)
  query.upsert = function(data, options) {
    if (!skipTables.includes(table) && data && !Array.isArray(data) && !data.user_id) {
      data = { ...data, user_id: getUserId() }
    }
    if (Array.isArray(data)) {
      data = data.map(d => {
        if (!d.user_id) return { ...d, user_id: getUserId() }
        return d
      })
    }
    return originalUpsert(data, options)
  }

  // 拦截 update
  const originalUpdate = query.update.bind(query)
  query.update = function(data, options) {
    if (!skipTables.includes(table) && data && !data.user_id) {
      data = { ...data, user_id: getUserId() }
    }
    return originalUpdate(data, options)
  }

  return query
}

export const supabase = rawSupabase