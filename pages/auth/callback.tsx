import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [debug, setDebug] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const search = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const diag = `search:[${Array.from(search.keys()).join(',') || '∅'}] hash:[${Array.from(hash.keys()).join(',') || '∅'}]`

      // 1) Explicit OAuth error?
      const oErr = search.get('error') || hash.get('error')
      const oErrDesc = search.get('error_description') || hash.get('error_description')
      if (oErr || oErrDesc) {
        setError(`Google: ${oErrDesc || oErr}`)
        setDebug(diag)
        return
      }

      // 2) Establish the session from whatever was returned.
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const code = search.get('code')
      try {
        if (accessToken && refreshToken) {
          const { error: e } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          if (e) throw e
        } else if (code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code)
          if (e) throw e
        }
      } catch (e: any) {
        setError(`No se pudo iniciar sesión: ${e?.message || e}`)
        setDebug(diag)
        return
      }

      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) {
        setError('No se pudo completar el inicio de sesión con Google. Vuelve a intentarlo.')
        setDebug(diag)
        return
      }

      window.history.replaceState({}, '', '/auth/callback')

      // 3) Route by profile.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, active, role_chosen')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return

      if (profileError || !profile) {
        await supabase.auth.signOut()
        setError(`No se pudo cargar tu perfil${profileError ? `: ${profileError.message}` : ''}.`)
        return
      }
      if (!profile.role_chosen) {
        router.replace('/elegir-rol')
        return
      }
      if (!profile.active) {
        await supabase.auth.signOut()
        setError('Tu cuenta está desactivada. Contacta a un administrador.')
        return
      }
      if (['admin', 'super_admin'].includes(profile.role)) router.replace('/admin/dashboard')
      else if (['doctor', 'specialist'].includes(profile.role)) router.replace('/panel-medico')
      else router.replace('/mi-caso')
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <>
      <Head>
        <title>Acceso — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="narrow">
          <div className="card" style={{ marginTop: 14 }}>
            {error ? (
              <>
                <div className="notice notice-danger">{error}</div>
                {debug && (
                  <p
                    style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, wordBreak: 'break-all' }}
                  >
                    Debug: {debug}
                  </p>
                )}
                <Link
                  href="/login-medico"
                  className="link-button"
                  style={{ marginTop: 12, display: 'inline-block' }}
                >
                  ← Volver al inicio de sesión
                </Link>
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
