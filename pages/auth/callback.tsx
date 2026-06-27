import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const routeBySession = async () => {
      // supabase-js (detectSessionInUrl) processes the OAuth response on load.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, verified, active, role_chosen')
        .single()

      if (cancelled) return true

      if (profileError || !profile) {
        await supabase.auth.signOut()
        setError('No se pudo cargar tu perfil. Intenta de nuevo.')
        return true
      }

      // First-time Google account that still needs to pick patient vs doctor.
      if (!profile.role_chosen) {
        router.replace('/elegir-rol')
        return true
      }

      // Revoked/suspended accounts are blocked.
      if (!profile.active) {
        await supabase.auth.signOut()
        setError('Tu cuenta está desactivada. Contacta a un administrador.')
        return true
      }

      if (['admin', 'super_admin'].includes(profile.role)) {
        router.replace('/admin/dashboard')
      } else if (['doctor', 'specialist'].includes(profile.role)) {
        router.replace('/panel-medico')
      } else {
        router.replace('/mi-caso')
      }
      return true
    }

    // Try immediately; if the session isn't ready yet, wait for the auth event.
    routeBySession().then(handled => {
      if (handled || cancelled) return
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) routeBySession()
      })
      // Safety net if no session ever arrives.
      setTimeout(() => {
        if (!cancelled) {
          supabase.auth.getSession().then(({ data }) => {
            if (!data.session && !cancelled) {
              setError('No se pudo completar el inicio de sesión con Google.')
            }
          })
        }
      }, 4000)
      return () => sub.subscription.unsubscribe()
    })

    return () => { cancelled = true }
  }, [router])

  return (
    <>
      <Head><title>Acceso — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <div className="card" style={{ marginTop: 14 }}>
            {error ? (
              <>
                <div className="notice notice-danger">{error}</div>
                <Link href="/login-medico" className="link-button" style={{ marginTop: 12, display: 'inline-block' }}>← Volver al inicio de sesión</Link>
              </>
            ) : (
              <p style={{ color: '#64748b' }}>Iniciando sesión…</p>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
