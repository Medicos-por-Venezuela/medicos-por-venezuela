import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { signInWithGoogle } from '../lib/auth'
import GoogleButton from '../components/GoogleButton'

// Step 1 of doctor registration: create the account (email+password or Google).
// Step 2 (specialty/country/WhatsApp) happens on /elegir-rol, so email and Google
// doctors follow the same path. The "doctor" intent is passed via the redirect query
// (email) or localStorage (Google, since OAuth can't carry it).
export default function RegistroMedico() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Completa nombre, email y una contraseña de al menos 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      // No role in metadata → trigger creates an unfinalized profile (role_chosen=false),
      // so the next step (/elegir-rol) can set role=doctor + details via set_my_role.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } }
      })
      if (error) throw error
      if (!data.session) {
        setError('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')
        return
      }
      router.push('/elegir-rol?rol=medico')
    } catch (e) {
      console.error(e)
      setError(
        'No se pudo crear la cuenta. Puede que este email ya esté registrado o haya un error de conexión.'
      )
    } finally {
      setLoading(false)
    }
  }

  const googleSignup = async () => {
    setError('')
    setLoading(true)
    try {
      if (typeof window !== 'undefined') localStorage.setItem('mpv_role', 'doctor')
      await signInWithGoogle()
    } catch {
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Registro médico — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="narrow">
          <Link href="/" className="link-button">
            ← Volver
          </Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Crea tu cuenta de Médico/Psicólogo</h1>
            <p style={{ color: '#64748b' }}>
              Paso 1 de 2: crea tu cuenta. Luego completarás tu especialidad y datos de contacto.
            </p>

            <div className="grid">
              <div>
                <label className="label">Nombre completo *</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-2">
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="label">Contraseña *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>
              {error && <div className="notice notice-danger">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Continuar'}
              </button>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>o</div>
              <GoogleButton onClick={googleSignup} disabled={loading} />
            </div>

            <p style={{ marginTop: 18, color: '#64748b' }}>
              ¿Ya tienes cuenta?{' '}
              <Link href="/login-medico" style={{ color: '#0f6e56', fontWeight: 800 }}>
                Entrar al panel médico
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
