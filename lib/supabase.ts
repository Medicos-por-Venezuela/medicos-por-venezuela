import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  // The app still compiles without env vars, but Supabase calls will fail until Vercel env vars are configured.
  console.warn('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // The /auth/callback page exchanges the code manually, so don't auto-process the URL
    // (avoids a race where the code is consumed before the callback can read it).
    detectSessionInUrl: false
  }
})
