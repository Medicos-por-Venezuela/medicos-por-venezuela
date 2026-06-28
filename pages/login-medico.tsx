import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { signInWithGoogle } from '../lib/auth'
import GoogleButton from '../components/GoogleButton'

export default function LoginMedico() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    setError('')
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })
      if (authError) throw authError

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, verified, active, role_chosen')
        .eq('id', authData.user.id)
        .single()
      if (profileError) throw profileError
      if (!profile.role_chosen) {
        router.push('/elegir-rol')
        return
      }
      if (!profile.active) {
        await supabase.auth.signOut()
        setError('Tu cuenta está desactivada. Contacta a un administrador.')
        return
      }
      if (['admin', 'super_admin'].includes(profile.role)) {
        router.push('/admin/dashboard')
      } else if (['doctor', 'specialist'].includes(profile.role)) {
        router.push('/panel-medico')
      } else {
        router.push('/mi-caso')
      }
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
        <title>Acceso médico — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="narrow">
          <Link href="/" className="link-button">
            ← Volver
          </Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Acceso médico</h1>
            <p style={{ color: '#64748b' }}>Entra con tu email y contraseña, o con Google.</p>
            <div className="grid">
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') login()
                  }}
                />
              </div>
              {error && <div className="notice notice-danger">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={login} disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>o</div>
              <GoogleButton onClick={loginWithGoogle} disabled={loading} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
