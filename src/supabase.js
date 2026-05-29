import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bfwjkistyfuasjcqamkn.supabase.co'
const supabaseKey = 'sb_publishable_h7faLemveK76KhOj8oh9Dw_csQxVXpt'

export const supabase = createClient(supabaseUrl, supabaseKey)