import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { signInWithGoogle } from '../lib/auth'
import GoogleButton from '../components/GoogleButton'

const ZONAS = [
  'La Guaira - Catia La Mar',
  'La Guaira - Maiquetía',
  'La Guaira - La Guaira (centro)',
  'La Guaira - Macuto',
  'La Guaira - Caraballeda',
  'La Guaira - Naiguatá',
  'La Guaira - Carayaca',
  'La Guaira - Caruao',
  'La Guaira - Otro sector',
  'Caracas - Centro',
  'Caracas - Este',
  'Caracas - Oeste',
  'Caracas - Sur',
  'Miranda',
  'Aragua',
  'Carabobo',
  'Otro'
]
const NECESIDADES = ['Medicina general', 'Lesión física', 'Primeros auxilios', 'Apoyo emocional', 'Crisis de ansiedad', 'Niño / pediatría', 'Embarazo', 'Medicamentos', 'Enfermedad crónica', 'Otra']

export default function RegistroPaciente() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [zona, setZona] = useState('')
  const [edad, setEdad] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Optional account creation
  const [wantsAccount, setWantsAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // True when the patient is already logged in (e.g. arrived from the Google role-picker).
  const [authedPatient, setAuthedPatient] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAuthedPatient(true)
    })
  }, [])

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const submit = async () => {
    setError('')
    if (!nombre.trim() || !cedula.trim() || !telefono.trim() || !zona) {
      setError('Completa nombre, cédula, teléfono y zona.')
      return
    }
    if (tags.length === 0) {
      setError('Selecciona al menos un tipo de ayuda.')
      return
    }
    if (!consent) {
      setError('Debes aceptar el consentimiento para poder continuar.')
      return
    }
    if (wantsAccount && !authedPatient && (!email.trim() || password.length < 6)) {
      setError('Para crear una cuenta indica un email y una contraseña de al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      // Determine the owning account, if any.
      let userId: string | null = null

      if (authedPatient) {
        const { data: sessionData } = await supabase.auth.getSession()
        userId = sessionData.session?.user.id ?? null
      } else if (wantsAccount) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: nombre.trim(), role: 'patient' } }
        })
        if (signUpError) throw signUpError
        userId = signUpData.user?.id ?? null
        if (!signUpData.session) {
          setError('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión en "Seguir mi caso".')
          return
        }
      }

      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          user_id: userId,
          full_name: nombre.trim(),
          cedula: cedula.trim(),
          phone_whatsapp: telefono.trim(),
          affected_zone: zona,
          age_range: edad || null,
          needs_tags: tags,
          description: descripcion.trim() || null,
          consent: true,
          consent_at: new Date().toISOString()
        })
        .select('id, full_name')
        .single()

      if (patientError) throw patientError

      const { data: consultation, error: consultationError } = await supabase
        .from('consultations')
        .insert({
          patient_id: patient.id,
          status: 'waiting',
          priority: tags.some(t => ['Lesión física', 'Embarazo', 'Niño / pediatría'].includes(t)) ? 'review' : 'normal',
          category: tags[0],
          chief_complaint: descripcion.trim() || tags.join(', '),
          code: `MPV-${Date.now()}`
        })
        .select('id, code')
        .single()

      if (consultationError) throw consultationError

      // Create the Jitsi video room (server-side) and show it on the waiting page. If this fails,
      // we still continue — the case stays in the queue for a doctor to attend.
      let room = ''
      try {
        const resp = await fetch('/api/videoconsulta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consultationId: consultation.id })
        })
        if (resp.ok) room = (await resp.json()).url || ''
      } catch (e) {
        console.error('No se pudo iniciar la videoconsulta:', e)
      }

      const params = new URLSearchParams({ nombre: patient.full_name })
      if (room) params.set('room', room)
      if (consultation.code) params.set('code', consultation.code)
      router.push(`/sala-espera?${params.toString()}`)
    } catch (e) {
      console.error(e)
      setError('No se pudo registrar la solicitud. Puede que el email ya esté registrado, o haya un error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Solicitar consulta — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <Link href="/" className="link-button">← Volver</Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Solicitar orientación</h1>
            <p style={{ color: '#64748b' }}>
              Comparte solo la información mínima necesaria. Un médico voluntario te atenderá por videoconsulta.
            </p>

            <div className="notice notice-danger" style={{ marginBottom: 16 }}>
              Si tienes síntomas graves, busca atención presencial urgente. Esta web no reemplaza emergencias.
            </div>

            <div className="grid">
              <div className="grid grid-2">
                <div>
                  <label className="label">Nombre completo *</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. María González" />
                </div>
                <div>
                  <label className="label">Número de cédula *</label>
                  <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Ej. V-12345678" />
                  <div className="hint">Nos ayuda a dar seguimiento a tu caso.</div>
                </div>
              </div>
              <div>
                <label className="label">Teléfono con código de país *</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej. 584121234567" />
                <div className="hint">Solo lo usaremos si tu caso necesita seguimiento.</div>
              </div>
              <div className="grid grid-2">
                <div>
                  <label className="label">Zona afectada *</label>
                  <select value={zona} onChange={e => setZona(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Edad aproximada</label>
                  <select value={edad} onChange={e => setEdad(e.target.value)}>
                    <option value="">Prefiero no decir</option>
                    <option value="0-2">0-2 años</option>
                    <option value="3-12">3-12 años</option>
                    <option value="13-17">13-17 años</option>
                    <option value="18-40">18-40 años</option>
                    <option value="41-65">41-65 años</option>
                    <option value="65+">65+ años</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Tipo de ayuda *</label>
                <div className="tag-row">
                  {NECESIDADES.map(tag => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`tag ${tags.includes(tag) ? 'selected' : ''}`}>{tag}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Descripción breve</label>
                <textarea rows={4} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Describe en pocas palabras qué ocurre. Evita datos innecesarios." />
              </div>

              {!authedPatient && (
                <div className="notice" style={{ background: '#f8fafc' }}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input type="checkbox" checked={wantsAccount} onChange={e => setWantsAccount(e.target.checked)} style={{ width: 'auto', marginTop: 5 }} />
                    <span><strong>Crear una cuenta para seguir mi caso</strong> (opcional). Podrás iniciar sesión y ver el estado de tu solicitud.</span>
                  </label>
                  {wantsAccount && (
                    <div className="grid grid-2" style={{ marginTop: 12 }}>
                      <div>
                        <label className="label">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Contraseña</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <label className="notice notice-warning" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: 'auto', marginTop: 5 }} />
                <span>
                  Acepto compartir voluntariamente esta información para recibir orientación médica solidaria. Entiendo que la atención es por videoconsulta, que el seguimiento podría continuar por teléfono si fuese necesario, y que esto no reemplaza atención presencial ni servicios de emergencia.
                </span>
              </label>
              {error && <div className="notice notice-danger">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>{loading ? 'Enviando...' : 'Solicitar consulta gratuita'}</button>

              {!authedPatient && (
                <>
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>o crea tu cuenta con</div>
                  <GoogleButton
                    disabled={loading}
                    onClick={async () => {
                      setError('')
                      try {
                        if (typeof window !== 'undefined') localStorage.setItem('mpv_role', 'patient')
                        await signInWithGoogle()
                      } catch { setError('No se pudo iniciar sesión con Google.') }
                    }}
                  />
                  <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, margin: 0 }}>
                    ¿Ya tienes cuenta? <Link href="/mi-caso" style={{ color: '#0f6e56', fontWeight: 700 }}>Seguir mi caso</Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
