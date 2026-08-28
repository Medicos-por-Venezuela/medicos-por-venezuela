import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyProfile } from '../lib/consultations'
import { finalizeMyRole } from '../lib/users'
import { fetchSpecialties, type SpecialtyResponse } from '../lib/doctors'
import { isAdminRole } from '../lib/utils'

const PAISES = [
  'Venezuela',
  'Colombia',
  'España',
  'Chile',
  'Argentina',
  'Perú',
  'Ecuador',
  'México',
  'Estados Unidos',
  'Panamá',
  'República Dominicana',
  'Uruguay',
  'Italia',
  'Portugal',
  'Dinamarca',
  'Otro'
]

// First-time role picker for accounts created via Google (OAuth can't carry a trusted role).
// Calls POST /profiles/me/finalize-role (backend), which finalizes the profile exactly once and
// can never grant admin.
export default function ElegirRol() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [choice, setChoice] = useState<'' | 'patient' | 'doctor'>('')
  // True when the role was pre-selected from registration intent — hides the "Volver" choice toggle.
  const [locked, setLocked] = useState(false)
  // El ID del catálogo, no el nombre: se envía como `specialty_id` y es la FK con la que el
  // backend decide qué puede atender este médico. Ya no hay fallback a una lista hardcodeada —
  // sin catálogo no se puede producir un id válido, así que se avisa en vez de inventar uno.
  const [specialty, setSpecialty] = useState('')
  const [specialtyOptions, setSpecialtyOptions] = useState<SpecialtyResponse[]>([])
  const [country, setCountry] = useState('')
  const [license, setLicense] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/')
        return
      }
      // If the role was already chosen, don't show this screen again. El perfil viene del backend
      // (/auth/me); si la llamada falla, se muestra el formulario de elección (fallback seguro).
      try {
        const profile = await fetchMyProfile(session.access_token)
        if (profile.role_chosen) {
          redirectByRole(profile.role)
          return
        }
      } catch {
        // sin perfil del backend, seguimos y mostramos el formulario
      }

      // Pre-select the form when the intent is known (email redirect ?rol= or Google localStorage).
      const intent =
        new URLSearchParams(window.location.search).get('rol') ||
        (typeof window !== 'undefined' ? localStorage.getItem('mpv_role') : null)
      if (typeof window !== 'undefined') localStorage.removeItem('mpv_role')
      if (intent === 'medico' || intent === 'doctor') {
        setChoice('doctor')
        setLocked(true)
      } else if (intent === 'paciente' || intent === 'patient') {
        setChoice('patient')
        setLocked(true)
      }

      setChecking(false)
    }
    run()
    fetchSpecialties()
      .then((list) => setSpecialtyOptions(list.filter((s) => s.status === 'active')))
      .catch(() => setError('No se pudo cargar el catálogo de especialidades.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function redirectByRole(role: string) {
    if (isAdminRole(role)) router.replace('/admin/dashboard')
    else if (['doctor', 'specialist'].includes(role)) router.replace('/panel-medico')
    else router.replace('/registro-paciente')
  }

  const confirmPatient = async () => {
    setError('')
    setLoading(true)
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesión expirada')
      // POST /profiles/me/finalize-role (backend) — reemplaza la RPC set_my_role.
      await finalizeMyRole({ role: 'patient' }, session.access_token)
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
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesión expirada')
      // POST /profiles/me/finalize-role (backend) — reemplaza la RPC set_my_role.
      await finalizeMyRole(
        {
          role: 'doctor',
          specialty_id: specialty,
          country,
          medical_license: license.trim() || null,
          whatsapp_number: whatsapp.trim()
        },
        session.access_token
      )
      router.replace('/panel-medico')
    } catch (e) {
      console.error(e)
      setError('No se pudo guardar tu elección. Intenta de nuevo.')
      setLoading(false)
    }
  }

  if (checking)
    return (
      <main className="page">
        <div className="narrow">
          <div className="card">Cargando...</div>
        </div>
      </main>
    )

  return (
    <>
      <Head>
        <title>Elegir rol — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="narrow">
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>¿Cómo quieres usar la plataforma?</h1>
            <p style={{ color: '#64748b' }}>
              Elige una opción para terminar de configurar tu cuenta.
            </p>

            {choice === '' && (
              <div className="grid grid-2">
                <button
                  className="card-flat"
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setChoice('patient')}
                >
                  <h2 style={{ marginTop: 0 }}>Soy paciente</h2>
                  <p style={{ color: '#64748b' }}>
                    Necesito orientación médica y quiero seguir mi caso.
                  </p>
                </button>
                <button
                  className="card-flat"
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setChoice('doctor')}
                >
                  <h2 style={{ marginTop: 0 }}>Soy médico</h2>
                  <p style={{ color: '#64748b' }}>Quiero atender pacientes como voluntario.</p>
                </button>
              </div>
            )}

            {choice === 'patient' && (
              <div className="grid">
                <div className="notice notice-info">
                  Tu cuenta quedará como paciente. Luego podrás registrar tu solicitud.
                </div>
                {error && <div className="notice notice-danger">{error}</div>}
                <button
                  className="btn btn-primary btn-full"
                  onClick={confirmPatient}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Confirmar como paciente'}
                </button>
                {!locked && (
                  <button
                    className="btn btn-muted"
                    onClick={() => setChoice('')}
                    disabled={loading}
                  >
                    Volver
                  </button>
                )}
              </div>
            )}

            {choice === 'doctor' && (
              <div className="grid">
                <div className="grid grid-2">
                  <div>
                    <label className="label">Especialidad *</label>
                    <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                      <option value="">Selecciona...</option>
                      {specialtyOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">País donde ejerces/resides *</label>
                    <select value={country} onChange={(e) => setCountry(e.target.value)}>
                      <option value="">Selecciona...</option>
                      {PAISES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-2">
                  <div>
                    <label className="label">Número de colegiatura/licencia</label>
                    <input
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      placeholder="Opcional, pero recomendado"
                    />
                  </div>
                  <div>
                    <label className="label">WhatsApp / teléfono (uso administrativo) *</label>
                    <input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="Ej. 584121234567"
                    />
                    <div className="hint">
                      Solo para uso administrativo. Nunca se comparte con pacientes ni con terceros.
                    </div>
                  </div>
                </div>
                {error && <div className="notice notice-danger">{error}</div>}
                <button
                  className="btn btn-primary btn-full"
                  onClick={confirmDoctor}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Confirmar como médico'}
                </button>
                {!locked && (
                  <button
                    className="btn btn-muted"
                    onClick={() => setChoice('')}
                    disabled={loading}
                  >
                    Volver
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
