import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import AuthField from '../../components/auth/AuthField'
import AuthPanel from '../../components/auth/AuthPanel'
import GoogleButton from '../../components/GoogleButton'
import { signInWithGoogle } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

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
        <AuthPanel
          title="Iniciar sesión de administrador"
          description="Entra con una cuenta existente promovida como admin o super_admin. El registro de administradores no está disponible desde esta página."
          backHref="/"
          backLabel="Volver al sitio"
        >
          <div className="grid">
            <AuthField label="Email" type="email" value={email} autoComplete="email" onChange={setEmail} />
            <AuthField label="Contraseña" type="password" value={password} autoComplete="current-password" onChange={setPassword} onEnter={login} />
            {error && <div className="notice notice-danger">{error}</div>}
            <button className="btn btn-primary btn-full" onClick={login} disabled={loading}>{loading ? 'Entrando...' : 'Entrar al panel admin'}</button>
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>También puedes usar Google si esa cuenta ya es admin.</div>
            <GoogleButton onClick={loginWithGoogle} disabled={loading} />
          </div>
        </AuthPanel>
      </main>
    </>
  )
}
