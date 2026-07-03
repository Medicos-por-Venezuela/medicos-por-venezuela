import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAffectedZoneCatalog, fetchSpecialtyCatalog } from '../lib/api'
import CedulaField from '../components/CedulaField'
import PhoneField from '../components/PhoneField'

const PARENTESCOS = [
  'Padre',
  'Madre',
  'Representante legal',
  'Abuelo/a',
  'Tío/a',
  'Hermano/a mayor',
  'Otro'
]

export default function RegistroPaciente() {
  const router = useRouter()

  // Branch toggle: adult (self) vs. minor (represented by an adult).
  const [isMinor, setIsMinor] = useState(false)

  // Catalogs (backend-sourced when available; static fallback otherwise — see lib/api.ts).
  const [specialties, setSpecialties] = useState<string[]>([])
  const [zonas, setZonas] = useState<string[]>([])

  // True when the patient (or the guardian, for a minor) is already logged in.
  // Hides the email/password block.
  const [authedPatient, setAuthedPatient] = useState(false)

  // Adult / self patient.
  const [cedula, setCedula] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [edad, setEdad] = useState('')
  const [wantsSpecialty, setWantsSpecialty] = useState(false)
  const [specialty, setSpecialty] = useState('')
  const [hasAllergy, setHasAllergy] = useState(false)
  const [allergyDetail, setAllergyDetail] = useState('')

  // Guardian (only used when isMinor).
  const [gCedula, setGCedula] = useState('')
  const [gFullName, setGFullName] = useState('')
  const [gPhone, setGPhone] = useState('')
  const [gEmail, setGEmail] = useState('')
  const [gPassword, setGPassword] = useState('')
  const [gRelationship, setGRelationship] = useState('')

  // Minor (only used when isMinor).
  const [mCedula, setMCedula] = useState('')
  const [mFullName, setMFullName] = useState('')
  const [mEdad, setMEdad] = useState('')
  const [mHasAllergy, setMHasAllergy] = useState(false)
  const [mAllergyDetail, setMAllergyDetail] = useState('')

  // Shared.
  const [zona, setZona] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAuthedPatient(true)
    })
    fetchSpecialtyCatalog().then(setSpecialties)
    fetchAffectedZoneCatalog().then(setZonas)
  }, [])

  const submit = async () => {
    setError('')

    if (isMinor) {
      if (!gCedula || !gFullName.trim() || !gPhone || !gRelationship) {
        setError('Completa la cédula, nombre, WhatsApp y parentesco del representante.')
        return
      }
      if (!authedPatient && (!gEmail.trim() || gPassword.length < 6)) {
        setError('Completa el correo del representante y una contraseña de al menos 6 caracteres.')
        return
      }
      if (!mFullName.trim() || !zona) {
        setError('Completa el nombre del menor y la zona afectada.')
        return
      }
      const ageNum = Number(mEdad)
      if (!mEdad || Number.isNaN(ageNum) || ageNum < 0 || ageNum > 17) {
        setError('La edad del menor debe estar entre 0 y 17 años.')
        return
      }
      if (!descripcion.trim()) {
        setError('Describe brevemente el motivo de la consulta del menor.')
        return
      }
      if (mHasAllergy && !mAllergyDetail.trim()) {
        setError('Indica a qué es alérgico el menor, o desmarca la opción.')
        return
      }
    } else {
      if (!cedula || !fullName.trim() || !phone || !zona) {
        setError('Completa cédula, nombre completo, WhatsApp y zona afectada.')
        return
      }
      if (!authedPatient && (!email.trim() || password.length < 6)) {
        setError('Completa el correo y una contraseña de al menos 6 caracteres.')
        return
      }
      const ageNum = Number(edad)
      if (!edad || Number.isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
        setError('La edad debe estar entre 18 y 120 años.')
        return
      }
      if (wantsSpecialty && !specialty) {
        setError('Selecciona una especialidad o desmarca "Conozco la especialidad".')
        return
      }
      if (!descripcion.trim()) {
        setError('Describe brevemente el motivo de la consulta.')
        return
      }
      if (hasAllergy && !allergyDetail.trim()) {
        setError('Indica a qué eres alérgico, o desmarca la opción.')
        return
      }
    }
    if (!consent) {
      setError('Debes aceptar el consentimiento para poder continuar.')
      return
    }

    setLoading(true)
    try {
      let userId: string | null = null
      let contactEmail = ''

      if (authedPatient) {
        const { data: sessionData } = await supabase.auth.getSession()
        userId = sessionData.session?.user.id ?? null
        contactEmail = sessionData.session?.user.email ?? ''
      } else {
        const accountEmail = (isMinor ? gEmail : email).trim().toLowerCase()
        const accountPassword = isMinor ? gPassword : password
        const accountName = isMinor ? gFullName.trim() : fullName.trim()
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: accountEmail,
          password: accountPassword,
          options: { data: { full_name: accountName, role: 'patient' } }
        })
        if (signUpError) throw signUpError
        contactEmail = accountEmail
        if (!signUpData.session) {
          setError(
            'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión en "Seguir mi caso".'
          )
          return
        }
        userId = signUpData.user?.id ?? null
      }

      // Sin selector de "tipo de ayuda", los adultos caen en el bucket general (cubre
      // cualquier especialidad vía SPECIALTY_NEEDS['Medicina general'] = ['*']); la
      // especialidad indicada (si la conoce) queda como dato informativo en chief_complaint.
      const needsTags = isMinor ? ['Niño / pediatría'] : ['Medicina general']

      // La alergia es un checkbox + input aparte (no un campo propio en `patients`), así que
      // se antepone como nota estructurada a la descripción/motivo — mismo criterio "puente"
      // que ya usamos para el representante y la especialidad solicitada.
      const allergyNote =
        (isMinor ? mHasAllergy : hasAllergy) && (isMinor ? mAllergyDetail : allergyDetail).trim()
          ? `Alergias: ${(isMinor ? mAllergyDetail : allergyDetail).trim()}. `
          : ''
      const descripcionFinal = `${allergyNote}${descripcion.trim()}`.trim()

      const patientDescription = isMinor
        ? `Representante: ${gFullName.trim()}, CI ${gCedula}, Parentesco: ${gRelationship}${
            descripcionFinal ? ` — ${descripcionFinal}` : ''
          }`
        : descripcionFinal || null

      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          user_id: userId,
          full_name: isMinor ? mFullName.trim() : fullName.trim(),
          cedula: isMinor ? mCedula || null : cedula,
          // The guardian is who must be contacted and who owns the account.
          phone_whatsapp: isMinor ? gPhone : phone,
          email: contactEmail || null,
          affected_zone: zona,
          age_range: (isMinor ? mEdad : edad) || null,
          needs_tags: needsTags,
          description: patientDescription,
          consent: true,
          consent_at: new Date().toISOString()
        })
        .select('id, full_name')
        .single()

      if (patientError) throw patientError

      const chiefComplaint =
        !isMinor && wantsSpecialty && specialty
          ? `Especialidad solicitada: ${specialty}. ${descripcionFinal}`
          : descripcionFinal

      const { data: consultation, error: consultationError } = await supabase
        .from('consultations')
        .insert({
          patient_id: patient.id,
          status: 'waiting',
          priority: needsTags.some((t) =>
            ['Lesión física', 'Embarazo', 'Niño / pediatría'].includes(t)
          )
            ? 'review'
            : 'normal',
          category: needsTags[0],
          chief_complaint: chiefComplaint,
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
      params.set('cid', consultation.id) // lets /sala-espera send the waiting-room heartbeat
      router.push(`/sala-espera?${params.toString()}`)
    } catch (e) {
      console.error(e)
      setError(
        'No se pudo registrar la solicitud. Puede que el email ya esté registrado, o haya un error de conexión.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Solicitar consulta — Médicos por Venezuela</title>
      </Head>
      <main className="page patient-theme">
        <div className="narrow">
          <Link href="/" className="link-button">
            ← Volver
          </Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Solicitar orientación</h1>
            <p style={{ color: '#64748b' }}>
              Comparte solo la información mínima necesaria. Un médico voluntario te atenderá por
              videoconsulta.
            </p>

            <div className="notice notice-danger" style={{ marginBottom: 16 }}>
              Si tienes síntomas graves, busca atención presencial urgente. Esta web no reemplaza
              emergencias.
            </div>

            <label
              className="notice notice-info"
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}
            >
              <input
                type="checkbox"
                checked={isMinor}
                onChange={(e) => setIsMinor(e.target.checked)}
                style={{ width: 'auto', marginTop: 3 }}
              />
              <span>
                <strong>Voy a registrar un menor de edad (&lt;18)</strong>. La consulta se asignará
                a Pediatría y debe registrarse junto a un adulto responsable.
              </span>
            </label>

            <div className="grid">
              {isMinor ? (
                <>
                  <h2 style={{ margin: 0, fontSize: 16 }}>Datos del adulto (representante)</h2>
                  <CedulaField
                    label="Cédula del representante"
                    value={gCedula}
                    onChange={setGCedula}
                    required
                  />
                  <div>
                    <label className="label">Nombre completo del representante *</label>
                    <input value={gFullName} onChange={(e) => setGFullName(e.target.value)} />
                  </div>
                  <PhoneField
                    label="WhatsApp del representante"
                    value={gPhone}
                    onChange={setGPhone}
                    required
                  />
                  {!authedPatient && (
                    <div className="grid grid-2">
                      <div>
                        <label className="label">Correo *</label>
                        <input
                          type="email"
                          value={gEmail}
                          onChange={(e) => setGEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Contraseña *</label>
                        <input
                          type="password"
                          value={gPassword}
                          onChange={(e) => setGPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    </div>
                  )}

                  <h2 style={{ margin: 0, fontSize: 16 }}>Datos del menor</h2>
                  <CedulaField
                    label="Cédula del menor"
                    value={mCedula}
                    onChange={setMCedula}
                    hint="Si no tiene cédula propia, puedes dejarlo en blanco."
                  />
                  <div>
                    <label className="label">Nombre completo del menor *</label>
                    <input value={mFullName} onChange={(e) => setMFullName(e.target.value)} />
                  </div>
                  <div className="grid grid-2">
                    <div>
                      <label className="label">Zona afectada *</label>
                      <select value={zona} onChange={(e) => setZona(e.target.value)}>
                        <option value="">Selecciona...</option>
                        {zonas.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Edad del menor *</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={17}
                        value={mEdad}
                        onChange={(e) => setMEdad(e.target.value)}
                        placeholder="Ej. 7"
                      />
                    </div>
                  </div>

                  <div className="notice notice-info">
                    Esta consulta se asignará automáticamente a <strong>Pediatría</strong>.
                  </div>

                  <div>
                    <label
                      style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={mHasAllergy}
                        onChange={(e) => setMHasAllergy(e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      ¿El menor tiene alguna alergia?
                    </label>
                    {mHasAllergy && (
                      <div style={{ marginTop: 10 }}>
                        <label className="label">¿A qué es alérgico? *</label>
                        <input
                          value={mAllergyDetail}
                          onChange={(e) => setMAllergyDetail(e.target.value)}
                          placeholder="Ej. Penicilina"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label">Descripción breve *</label>
                    <textarea
                      rows={4}
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Describe en pocas palabras qué le ocurre al menor y si ya está tomando algún medicamento."
                    />
                  </div>

                  <div>
                    <label className="label">Parentesco con el menor *</label>
                    <select
                      value={gRelationship}
                      onChange={(e) => setGRelationship(e.target.value)}
                    >
                      <option value="">Selecciona...</option>
                      {PARENTESCOS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <CedulaField
                    label="Número de cédula"
                    value={cedula}
                    onChange={setCedula}
                    required
                  />
                  <div>
                    <label className="label">Nombre completo *</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. María González"
                    />
                  </div>
                  <PhoneField label="WhatsApp" value={phone} onChange={setPhone} required />
                  {!authedPatient && (
                    <div className="grid grid-2">
                      <div>
                        <label className="label">Correo *</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
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
                  )}

                  <div className="grid grid-2">
                    <div>
                      <label className="label">Zona afectada *</label>
                      <select value={zona} onChange={(e) => setZona(e.target.value)}>
                        <option value="">Selecciona...</option>
                        {zonas.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Edad *</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={18}
                        max={120}
                        value={edad}
                        onChange={(e) => setEdad(e.target.value)}
                        placeholder="Ej. 34"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={wantsSpecialty}
                        onChange={(e) => setWantsSpecialty(e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      Conozco la especialidad que necesito
                    </label>
                    {wantsSpecialty && (
                      <div style={{ marginTop: 10 }}>
                        <label className="label">Especialidad *</label>
                        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                          <option value="">Selecciona...</option>
                          {specialties.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={hasAllergy}
                        onChange={(e) => setHasAllergy(e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      ¿Tienes alguna alergia?
                    </label>
                    {hasAllergy && (
                      <div style={{ marginTop: 10 }}>
                        <label className="label">¿A qué eres alérgico? *</label>
                        <input
                          value={allergyDetail}
                          onChange={(e) => setAllergyDetail(e.target.value)}
                          placeholder="Ej. Penicilina"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label">Descripción breve *</label>
                    <textarea
                      rows={4}
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Describe en pocas palabras qué ocurre y si ya estás tomando algún medicamento."
                    />
                  </div>
                </>
              )}

              <label
                className="notice notice-warning"
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ width: 'auto', marginTop: 5 }}
                />
                <span>
                  Acepto compartir voluntariamente esta información para recibir orientación médica
                  solidaria. Entiendo que la atención es por videoconsulta, que el seguimiento
                  podría continuar por teléfono si fuese necesario, y que esto no reemplaza atención
                  presencial ni servicios de emergencia.
                </span>
              </label>
              {error && <div className="notice notice-danger">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
                {loading ? 'Enviando...' : 'Registrarse'}
              </button>

              {!authedPatient && (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, margin: 0 }}>
                  ¿Ya tienes cuenta?{' '}
                  <Link href="/mi-caso" style={{ color: 'var(--green)', fontWeight: 700 }}>
                    Seguir mi caso
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
