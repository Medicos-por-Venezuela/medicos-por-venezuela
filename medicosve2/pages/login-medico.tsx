import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })
      if (authError) throw authError

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, verified, active')
        .single()
      if (profileError) throw profileError
      if (!profile.active || !profile.verified) {
        await supabase.auth.signOut()
        setError('Tu usuario todavía no está verificado por un administrador.')
        return
      }
      if (['admin', 'super_admin'].includes(profile.role)) {
        router.push('/admin/dashboard')
      } else {
        router.push('/panel-medico')
      }
    } catch (e) {
      console.error(e)
      setError('Email o contraseña incorrectos, o el usuario aún no está aprobado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Acceso médico — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <Link href="/" className="link-button">← Volver</Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Acceso médico / administrador</h1>
            <p style={{ color: '#64748b' }}>Usa el email y contraseña creados por el administrador.</p>
            <div className="grid">
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') login() }} />
              </div>
              {error && <div className="notice notice-danger">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={login} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
