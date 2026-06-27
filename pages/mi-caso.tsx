import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { signInWithGoogle } from '../lib/auth'
import GoogleButton from '../components/GoogleButton'
import { STATUS_LABELS, whatsappUrl } from '../lib/utils'

type Consultation = {
  id: string
  code: string
  status: string
  category: string | null
  chief_complaint: string | null
  referred_specialty: string | null
  created_at: string
}

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ''

export default function MiCaso() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [consultations, setConsultations] = useState<Consultation[]>([])
  // Login form state (shown when there is no session)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setAuthed(false)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase.from('profiles').select('role, role_chosen').single()
    if (profile && !profile.role_chosen) {
      router.replace('/elegir-rol')
      return
    }
    if (profile && ['doctor', 'specialist'].includes(profile.role)) {
      router.replace('/panel-medico')
      return
    }
    if (profile && ['admin', 'super_admin'].includes(profile.role)) {
      router.replace('/admin/dashboard')
      return
    }

    setAuthed(true)
    // Patient's own records (RLS: patients_select_own / consultations_select_own)
    const { data: patients } = await supabase.from('patients').select('id, full_name')
    const ids = (patients || []).map(p => p.id)
    if (patients && patients.length) setPatientName(patients[0].full_name)

    if (ids.length) {
      const { data: cons } = await supabase
        .from('consultations')
        .select('id, code, status, category, chief_complaint, referred_specialty, created_at')
        .in('patient_id', ids)
        .order('created_at', { ascending: false })
      setConsultations((cons || []) as Consultation[])
    }
    setLoading(false)
  }

  async function login() {
    setError('')
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })
      if (authError) throw authError
      await load()
    } catch (e) {
      console.error(e)
      setError('Email o contraseña incorrectos.')
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setAuthed(false)
    setConsultations([])
  }

  if (loading) return <main className="page"><div className="narrow"><div className="card">Cargando...</div></div></main>

  if (!authed) {
    return (
      <>
        <Head><title>Seguir mi caso — Médicos por Venezuela</title></Head>
        <main className="page">
          <div className="narrow">
            <Link href="/" className="link-button">← Volver</Link>
            <div className="card" style={{ marginTop: 14 }}>
              <h1 style={{ marginTop: 0 }}>Seguir mi caso</h1>
              <p style={{ color: '#64748b' }}>Inicia sesión para ver el estado de tu solicitud.</p>
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
                <button className="btn btn-primary btn-full" onClick={login}>Entrar</button>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>o</div>
                <GoogleButton
                  onClick={async () => { setError(''); try { await signInWithGoogle() } catch { setError('No se pudo iniciar sesión con Google.') } }}
                />
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, margin: 0 }}>
                  ¿No tienes cuenta? <Link href="/registro-paciente" style={{ color: '#0f6e56', fontWeight: 700 }}>Solicitar consulta</Link>
                </p>
              </div>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Head><title>Seguir mi caso — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <div className="topbar">
            <div>
              <h1 style={{ margin: 0 }}>Mi caso</h1>
              {patientName && <p style={{ margin: 0, color: '#64748b' }}>{patientName}</p>}
            </div>
            <button className="btn btn-muted" onClick={logout}>Salir</button>
          </div>

          {consultations.length === 0 ? (
            <div className="card">
              <p style={{ color: '#64748b' }}>Todavía no tienes solicitudes registradas con esta cuenta.</p>
              <Link className="btn btn-primary" href="/registro-paciente">Solicitar consulta</Link>
            </div>
          ) : (
            <div className="grid">
              {consultations.map(c => (
                <div key={c.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                    <div>
                      <strong>{c.category || 'Consulta'}</strong>
                      <div style={{ color: '#64748b', fontSize: 13 }}>Código {c.code}</div>
                    </div>
                    <span className="badge badge-green">{STATUS_LABELS[c.status] || c.status}</span>
                  </div>
                  {c.chief_complaint && <p style={{ color: '#475569' }}>{c.chief_complaint}</p>}
                  {c.referred_specialty && <p><span className="badge badge-blue">Derivado a {c.referred_specialty}</span></p>}
                </div>
              ))}
            </div>
          )}

          {SUPPORT_WHATSAPP && (
            <a className="btn btn-secondary btn-full" style={{ marginTop: 14 }} target="_blank" rel="noreferrer"
              href={whatsappUrl(SUPPORT_WHATSAPP, 'Hola, tengo una pregunta sobre mi caso en Médicos por Venezuela.')}>
              Continuar por WhatsApp
            </a>
          )}

          <div className="notice notice-warning" style={{ marginTop: 14 }}>
            Si tu situación empeora o hay señales de alarma, busca atención presencial urgente.
          </div>
        </div>
      </main>
    </>
  )
}
