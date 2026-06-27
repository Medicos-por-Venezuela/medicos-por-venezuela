import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SPECIALTIES } from '../lib/utils'

const PAISES = ['Venezuela', 'Colombia', 'España', 'Chile', 'Argentina', 'Perú', 'Ecuador', 'México', 'Estados Unidos', 'Panamá', 'República Dominicana', 'Uruguay', 'Italia', 'Portugal', 'Dinamarca', 'Otro']

// First-time role picker for accounts created via Google (OAuth can't carry a trusted role).
// Calls the set_my_role RPC, which finalizes the profile exactly once and can never grant admin.
export default function ElegirRol() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [choice, setChoice] = useState<'' | 'patient' | 'doctor'>('')
  // True when the role was pre-selected from registration intent — hides the "Volver" choice toggle.
  const [locked, setLocked] = useState(false)
  const [specialty, setSpecialty] = useState('')
  const [country, setCountry] = useState('')
  const [license, setLicense] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/')
        return
      }
      // If the role was already chosen, don't show this screen again.
      const { data: profile } = await supabase.from('profiles').select('role, role_chosen').single()
      if (profile?.role_chosen) {
        redirectByRole(profile.role)
        return
      }

      // Pre-select the form when the intent is known (email redirect ?rol= or Google localStorage).
      const intent = new URLSearchParams(window.location.search).get('rol')
        || (typeof window !== 'undefined' ? localStorage.getItem('mpv_role') : null)
      if (typeof window !== 'undefined') localStorage.removeItem('mpv_role')
      if (intent === 'medico' || intent === 'doctor') { setChoice('doctor'); setLocked(true) }
      else if (intent === 'paciente' || intent === 'patient') { setChoice('patient'); setLocked(true) }

      setChecking(false)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function redirectByRole(role: string) {
    if (['admin', 'super_admin'].includes(role)) router.replace('/admin/dashboard')
    else if (['doctor', 'specialist'].includes(role)) router.replace('/panel-medico')
    else router.replace('/registro-paciente')
  }

  const confirmPatient = async () => {
    setError('')
    setLoading(true)
    try {
      const { error: rpcError } = await supabase.rpc('set_my_role', { p_role: 'patient' })
      if (rpcError) throw rpcError
      router.replace('/registro-paciente')
    } catch (e) {
      console.error(e)
      setError('No se pudo guardar tu elección. Intenta de nuevo.')
      setLoading(false)
    }
  }

  const confirmDoctor = async () => {
    setError('')
    if (!specialty || !country || !whatsapp.trim()) {
      setError('Completa especialidad, país y WhatsApp.')
      return
    }
    setLoading(true)
    try {
      const { error: rpcError } = await supabase.rpc('set_my_role', {
        p_role: 'doctor',
        p_specialty: specialty,
        p_country: country,
        p_medical_license: license.trim() || null,
        p_whatsapp_number: whatsapp.trim()
      })
      if (rpcError) throw rpcError
      router.replace('/panel-medico')
    } catch (e) {
      console.error(e)
      setError('No se pudo guardar tu elección. Intenta de nuevo.')
      setLoading(false)
    }
  }

  if (checking) return <main className="page"><div className="narrow"><div className="card">Cargando...</div></div></main>

  return (
    <>
      <Head><title>Elegir rol — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>¿Cómo quieres usar la plataforma?</h1>
            <p style={{ color: '#64748b' }}>Elige una opción para terminar de configurar tu cuenta.</p>

            {choice === '' && (
              <div className="grid grid-2">
                <button className="card-flat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setChoice('patient')}>
                  <h2 style={{ marginTop: 0 }}>Soy paciente</h2>
                  <p style={{ color: '#64748b' }}>Necesito orientación médica y quiero seguir mi caso.</p>
                </button>
                <button className="card-flat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setChoice('doctor')}>
                  <h2 style={{ marginTop: 0 }}>Soy médico</h2>
                  <p style={{ color: '#64748b' }}>Quiero atender pacientes como voluntario.</p>
                </button>
              </div>
            )}

            {choice === 'patient' && (
              <div className="grid">
                <div className="notice notice-info">Tu cuenta quedará como paciente. Luego podrás registrar tu solicitud.</div>
                {error && <div className="notice notice-danger">{error}</div>}
                <button className="btn btn-primary btn-full" onClick={confirmPatient} disabled={loading}>{loading ? 'Guardando...' : 'Confirmar como paciente'}</button>
                {!locked && <button className="btn btn-muted" onClick={() => setChoice('')} disabled={loading}>Volver</button>}
              </div>
            )}

            {choice === 'doctor' && (
              <div className="grid">
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
                {error && <div className="notice notice-danger">{error}</div>}
                <button className="btn btn-primary btn-full" onClick={confirmDoctor} disabled={loading}>{loading ? 'Guardando...' : 'Confirmar como médico'}</button>
                {!locked && <button className="btn btn-muted" onClick={() => setChoice('')} disabled={loading}>Volver</button>}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
