import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AuthField from '../components/auth/AuthField'
import AuthPanel from '../components/auth/AuthPanel'
import GoogleButton from '../components/GoogleButton'
import { signInWithGoogle } from '../lib/auth'
import { fetchMyProfile } from '../lib/consultations'
import { resolvePostLoginRoute } from '../lib/postLogin'
import { supabase } from '../lib/supabase'

// Puerta ÚNICA del sitio: paciente, médico y admin entran por aquí. Antes había tres formularios
// (/login-medico, el que vivía dentro de /mi-caso y /admin) que hacían casi lo mismo; el destino
// lo decide resolvePostLoginRoute, compartido con /auth/callback.
export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Con sesión abierta, /login no debe pedir credenciales otra vez: te lleva a tu sitio. Antes lo
  // hacía /mi-caso (era login Y portal), así que un paciente ya logueado que pulsaba "Iniciar
  // sesión" en la home entraba directo. Sin esto, el login unificado le enseñaría un formulario.
  useEffect(() => {
    let cancelled = false
    const routeExistingSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (cancelled || !session) return
      try {
        const route = resolvePostLoginRoute(await fetchMyProfile(session.access_token))
        if (cancelled) return
        // `blocked` (cuenta desactivada) NO se anuncia aquí: nadie ha intentado entrar todavía.
        // Se cierra la sesión y se deja el formulario limpio; el aviso sale si lo intenta.
        if (route.kind === 'blocked') await supabase.auth.signOut()
        else router.replace(route.href)
      } catch {
        // Backend caído: mejor enseñar el formulario que un error sin salida.
      }
    }
    routeExistingSession()
    return () => {
      cancelled = true
    }
  }, [router])

  const login = async () => {
    setError('')
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })
      if (authError) throw authError
      if (!authData.session) throw new Error('Sin sesión tras el login.')

      // El perfil (rol/estado) viene del backend (/auth/me), no de una lectura directa a `users`.
      const profile = await fetchMyProfile(authData.session.access_token)
      const route = resolvePostLoginRoute(profile)
      if (route.kind === 'blocked') {
        // Cuenta desactivada: el aviso se queda AQUÍ, donde el usuario está mirando, en vez de
        // mandarlo a una página que lo rebota sin explicar por qué.
        await supabase.auth.signOut()
        setError(route.message)
        return
      }
      router.push(route.href)
    } catch (e) {
      console.error(e)
      setError('Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  const loginWithGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
      // On success the browser is redirected to Google, then back to /auth/callback.
    } catch (e) {
      console.error(e)
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Iniciar sesión — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <AuthPanel
          title="Iniciar sesión"
          description="Entra con tu email y contraseña, o con Google. Te llevamos a tu espacio según tu cuenta."
          backHref="/"
          backLabel="Volver al inicio"
        >
          <div className="grid">
            <AuthField
              label="Email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={setEmail}
            />
            <AuthField
              label="Contraseña"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={setPassword}
              onEnter={login}
            />
            {error && <div className="notice notice-danger">{error}</div>}
            <button className="btn btn-primary btn-full" onClick={login} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>o</div>
            <GoogleButton onClick={loginWithGoogle} disabled={loading} />
            <p style={{ textAlign: 'center', color: '#64748b', margin: 0 }}>
              ¿No tienes cuenta?{' '}
              <Link href="/registro-paciente" className="link-button">
                Soy paciente
              </Link>{' '}
              ·{' '}
              <Link href="/registro-medico" className="link-button">
                Soy médico
              </Link>
            </p>
          </div>
        </AuthPanel>
      </main>
    </>
  )
}
