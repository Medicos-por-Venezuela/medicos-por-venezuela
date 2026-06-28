import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { signInWithGoogle } from '../../lib/auth'
import GoogleButton from '../../components/GoogleButton'

// Private admin entrance. Not linked from anywhere public. Only admin/super_admin may pass;
// any other account is signed out. Google sign-in routes through /auth/callback, which sends
// a real admin to the dashboard and never lets a new account self-assign the admin role.
export default function AdminLogin() {
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
        .select('role, active')
        .eq('id', authData.user.id)
        .single()
      if (profileError) throw profileError

      if (!profile.active || !['admin', 'super_admin'].includes(profile.role)) {
        await supabase.auth.signOut()
        setError('No autorizado.')
        return
      }
      router.push('/admin/dashboard')
    } catch (e) {
      console.error(e)
      setError('Credenciales inválidas o cuenta no autorizada.')
    } finally {
      setLoading(false)
    }
  }

  const loginWithGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      setError('No se pudo iniciar sesión con Google.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Administración</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="page">
        <div className="narrow">
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Administración</h1>
            <p style={{ color: '#64748b' }}>Acceso restringido.</p>
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
