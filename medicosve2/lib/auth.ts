import { supabase } from './supabase'

// Starts the Google OAuth flow. On success the browser is redirected to Google and
// then back to /auth/callback, which routes the user by role (and to /elegir-rol for
// first-time accounts that still need to pick patient vs doctor).
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })
  if (error) throw error
}
