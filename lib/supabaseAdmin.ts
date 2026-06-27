import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service-role key (bypasses RLS).
// IMPORTANT: import this ONLY from API routes — never from client/page code, or the
// service-role key would be bundled into the browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})
