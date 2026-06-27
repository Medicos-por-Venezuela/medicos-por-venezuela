import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { signInWithGoogle } from '../lib/auth'
import GoogleButton from '../components/GoogleButton'
import { SPECIALTIES } from '../lib/utils'

const PAISES = ['Venezuela', 'Colombia', 'España', 'Chile', 'Argentina', 'Perú', 'Ecuador', 'México', 'Estados Unidos', 'Panamá', 'República Dominicana', 'Uruguay', 'Italia', 'Portugal', 'Dinamarca', 'Otro']

export default function RegistroMedico() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [country, setCountry] = useState('')
  const [license, setLicense] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [availability, setAvailability] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!fullName.trim() || !email.trim() || password.length < 6 || !specialty || !country || !whatsapp.trim()) {
      setError('Completa nombre, email, contraseña (mín. 6), especialidad, país y WhatsApp.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'doctor',
            specialty,
            country,
            medical_license: license.trim() || null,
            whatsapp_number: whatsapp.trim()
          }
        }
      })
      if (error) throw error
      if (!data.session) {
        setError('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')
        return
      }
      router.push('/panel-medico')
    } catch (e) {
      console.error(e)
      setError('No se pudo crear la cuenta. Puede que este email ya esté registrado o haya un error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  const googleSignup = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Registro médico — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <Link href="/" className="link-button">← Volver</Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Registro de médico voluntario</h1>
            <p style={{ color: '#64748b' }}>
              Crea tu cuenta con email y contraseña (o con Google) y entra directamente al panel médico.
            </p>

            <div className="grid">
                <div>
                  <label className="label">Nombre completo *</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="grid grid-2">
                  <div>
                    <label className="label">Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Contraseña *</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  </div>
                </div>
                <div className="grid grid-2">
                  <div>
                    <label className="label">Especialidad *</label>
                    <select value={specialty} onChange={e => setSpecialty(e.target.value)}>
                      <option value="">Selecciona...</option>
                      {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">País donde ejerces/resides *</label>
                    <select value={country} onChange={e => setCountry(e.target.value)}>
                      <option value="">Selecciona...</option>
                      {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-2">
                  <div>
                    <label className="label">Número de colegiatura/licencia</label>
                    <input value={license} onChange={e => setLicense(e.target.value)} placeholder="Opcional, pero recomendado" />
                  </div>
                  <div>
                    <label className="label">WhatsApp *</label>
                    <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="Ej. 584121234567" />
                  </div>
                </div>
                <div>
                  <label className="label">Disponibilidad</label>
                  <textarea rows={3} value={availability} onChange={e => setAvailability(e.target.value)} placeholder="Ej. 2 horas por la noche, pediatría, solo WhatsApp" />
                </div>
                {error && <div className="notice notice-danger">{error}</div>}
                <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta y entrar'}</button>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>o</div>
                <GoogleButton onClick={googleSignup} disabled={loading} />
              </div>

            <p style={{ marginTop: 18, color: '#64748b' }}>
              ¿Ya tienes cuenta? <Link href="/login-medico" style={{ color: '#0f6e56', fontWeight: 800 }}>Entrar al panel médico</Link>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
