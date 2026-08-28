import Seo from '../../components/Seo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { fetchMyProfile, MyProfile } from '../../lib/consultations'
import { resolvePostLoginRoute } from '../../lib/postLogin'
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

      // 3) Route by profile. El perfil (rol/estado) viene del backend (/auth/me), no de una lectura
      // directa a `users`.
      let profile: MyProfile
      try {
        profile = await fetchMyProfile(session.access_token)
      } catch (e: any) {
        if (cancelled) return
        await supabase.auth.signOut()
        setError(`No se pudo cargar tu perfil${e?.message ? `: ${e.message}` : ''}.`)
        return
      }
      if (cancelled) return

      // El fan-out por rol vive en lib/postLogin.ts, compartido con /login: una sola copia de
      // "¿a dónde va este usuario?" para que las dos puertas no vuelvan a divergir.
      const route = resolvePostLoginRoute(profile)
      if (cancelled) return
      if (route.kind === 'blocked') {
        await supabase.auth.signOut()
        setError(route.message)
        return
      }
      router.replace(route.href)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <>
      <Seo
        titulo="Acceso — Médicos por Venezuela"
        descripcion={'Validando tu sesión.'}
        ruta="/auth/callback"
        noindex
      />
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
                  href="/login"
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
