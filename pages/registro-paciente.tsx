import Seo from '../components/Seo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { fetchAffectedZoneCatalog } from '../lib/api'
// Reusa el catálogo de especialidades del registro de médico: trae {id, name},
// necesitamos el id real para specialty_id (fetchSpecialtyCatalog de lib/api solo
// devuelve nombres).
import { fetchSpecialties, type SpecialtyResponse } from '../lib/doctors'
import { createConsultation, createPatient, ApiError } from '../lib/patients'
import { useMountEffect } from '../lib/hooks'
import { trackSolicitudDeConsulta } from '../lib/analytics'
import { encryptAddress } from '../lib/patientAddressCrypto'
import AceptaTerminos, { MENSAJE_TERMINOS } from '../components/AceptaTerminos'
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

// Formatos emitidos por CedulaField ("V-12345678") y PhoneField ("584121234567") —
// ambos ya filtran no-dígitos por keystroke, esto es la segunda capa de defensa.
const CEDULA_REGEX = /^[VE]-\d{6,9}$/
const PHONE_REGEX = /^\d{8,15}$/

function edadEnRango(min: number, max: number) {
  return (valor: string) => {
    const n = Number(valor)
    return valor.trim() !== '' && !Number.isNaN(n) && n >= min && n <= max
  }
}

// Rama adulto (paciente registrándose a sí mismo).
const adultSchema = z
  .object({
    cedula: z.string().regex(CEDULA_REGEX, 'Ingresa un número de cédula válido (ej. V-12345678).'),
    fullName: z.string().trim().min(2, 'Completa tu nombre completo.'),
    phone: z.string().regex(PHONE_REGEX, 'Ingresa un número de WhatsApp válido.'),
    emergencyPhone: z.string().regex(PHONE_REGEX, 'Ingresa un teléfono de emergencia válido.'),
    address: z
      .string()
      .trim()
      .min(5, 'Ingresa la dirección de residencia.')
      .max(300, 'La dirección no puede superar 300 caracteres.'),
    zona: z.string().min(1, 'Selecciona la zona.'),
    edad: z.string().refine(edadEnRango(18, 120), 'La edad debe estar entre 18 y 120 años.'),
    authedPatient: z.boolean(),
    email: z.string(),
    password: z.string(),
    wantsSpecialty: z.boolean(),
    specialty: z.string(),
    hasAllergy: z.boolean(),
    allergyDetail: z.string(),
    descripcion: z.string().trim().min(1, 'Describe brevemente el motivo de la consulta.'),
    consent: z.boolean(),
    terminos: z.boolean()
  })
  .refine((d) => d.authedPatient || d.email.trim().length > 0, {
    message: 'Ingresa tu correo.',
    path: ['email']
  })
  .refine((d) => d.authedPatient || d.password.length >= 6, {
    message: 'La contraseña debe tener al menos 6 caracteres.',
    path: ['password']
  })
  .refine((d) => !d.wantsSpecialty || d.specialty.length > 0, {
    message: 'Selecciona una especialidad o desmarca "Conozco la especialidad".',
    path: ['specialty']
  })
  .refine((d) => !d.hasAllergy || d.allergyDetail.trim().length > 0, {
    message: 'Indica a qué eres alérgico, o desmarca la opción.',
    path: ['allergyDetail']
  })
  .refine((d) => d.consent, {
    message: 'Debes aceptar el consentimiento para poder continuar.',
    path: ['consent']
  })
  .refine((d) => d.terminos, { message: MENSAJE_TERMINOS, path: ['terminos'] })
  .refine((d) => d.emergencyPhone !== d.phone, {
    message: 'El teléfono de emergencia debe ser distinto al de WhatsApp.',
    path: ['emergencyPhone']
  })

// Rama menor de edad (representante + menor).
const minorSchema = z
  .object({
    gCedula: z
      .string()
      .regex(CEDULA_REGEX, 'Ingresa un número de cédula válido para el representante.'),
    gFullName: z.string().trim().min(2, 'Completa el nombre completo del representante.'),
    gPhone: z
      .string()
      .regex(PHONE_REGEX, 'Ingresa un número de WhatsApp válido para el representante.'),
    gEmergencyPhone: z
      .string()
      .regex(PHONE_REGEX, 'Ingresa un teléfono de emergencia válido para el representante.'),
    gAddress: z
      .string()
      .trim()
      .min(5, 'Ingresa la dirección de residencia del representante.')
      .max(300, 'La dirección no puede superar 300 caracteres.'),
    gRelationship: z.string().min(1, 'Selecciona el parentesco con el menor.'),
    authedPatient: z.boolean(),
    gEmail: z.string(),
    gPassword: z.string(),
    mCedula: z.string(),
    mFullName: z.string().trim().min(2, 'Completa el nombre completo del menor.'),
    zona: z.string().min(1, 'Selecciona la zona.'),
    mEdad: z.string().refine(edadEnRango(0, 17), 'La edad del menor debe estar entre 0 y 17 años.'),
    mHasAllergy: z.boolean(),
    mAllergyDetail: z.string(),
    descripcion: z
      .string()
      .trim()
      .min(1, 'Describe brevemente el motivo de la consulta del menor.'),
    consent: z.boolean(),
    terminos: z.boolean()
  })
  .refine((d) => d.authedPatient || d.gEmail.trim().length > 0, {
    message: 'Ingresa el correo del representante.',
    path: ['gEmail']
  })
  .refine((d) => d.authedPatient || d.gPassword.length >= 6, {
    message: 'La contraseña debe tener al menos 6 caracteres.',
    path: ['gPassword']
  })
  .refine((d) => d.mCedula === '' || CEDULA_REGEX.test(d.mCedula), {
    message: 'Ingresa un número de cédula válido para el menor, o déjalo en blanco.',
    path: ['mCedula']
  })
  .refine((d) => !d.mHasAllergy || d.mAllergyDetail.trim().length > 0, {
    message: 'Indica a qué es alérgico el menor, o desmarca la opción.',
    path: ['mAllergyDetail']
  })
  .refine((d) => d.consent, {
    message: 'Debes aceptar el consentimiento para poder continuar.',
    path: ['consent']
  })
  .refine((d) => d.terminos, { message: MENSAJE_TERMINOS, path: ['terminos'] })
  .refine((d) => d.gEmergencyPhone !== d.gPhone, {
    message: 'El teléfono de emergencia debe ser distinto al de WhatsApp.',
    path: ['gEmergencyPhone']
  })

export default function RegistroPaciente() {
  const router = useRouter()

  // Branch toggle: adult (self) vs. minor (represented by an adult).
  const [isMinor, setIsMinor] = useState(false)

  // Catalogs (backend-sourced when available; static fallback otherwise — see lib/api.ts).
  const [specialties, setSpecialties] = useState<SpecialtyResponse[]>([])
  const [zonas, setZonas] = useState<string[]>([])

  // True when the patient (or the guardian, for a minor) is already logged in.
  // Hides the email/password block.
  const [authedPatient, setAuthedPatient] = useState(false)

  // Adult / self patient.
  const [cedula, setCedula] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [address, setAddress] = useState('')
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
  const [gEmergencyPhone, setGEmergencyPhone] = useState('')
  const [gAddress, setGAddress] = useState('')
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
  const [terminos, setTerminos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // El CTA "Hablar con un psicólogo" del home entra aquí como
  // `/registro-paciente?especialidad=psicologia` y deja el bloque de especialidad ya marcado y
  // resuelto. No hay un flujo aparte para salud mental: es este mismo formulario con la
  // especialidad puesta, que es justo lo que el paciente tendría que elegir a mano.
  //
  // Psicología se localiza por el flag `mental_health_only` del catálogo, NUNCA por el nombre:
  // renombrarla en la base rompería un `find` por cadena, y ya pasó con "Pediatría" (ver la nota
  // del envío, más abajo). Si el catálogo no la trae, no se preselecciona nada y el formulario se
  // comporta como siempre — el paciente elige, que es peor que la preselección pero nunca es un
  // error.
  //
  // El parámetro se lee de `window.location.search` y no de `router.query`: en una página estática
  // `router.query` llega vacío en el primer render, y este callback puede resolverse antes de que
  // el router esté listo.
  const preseleccionarPsicologia = (activas: SpecialtyResponse[]) => {
    if (new URLSearchParams(window.location.search).get('especialidad') !== 'psicologia') return
    const psicologia = activas.find((e) => e.mental_health_only)
    if (!psicologia) return
    setWantsSpecialty(true)
    setSpecialty(psicologia.id)
  }

  useMountEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAuthedPatient(true)
    })
    fetchSpecialties(false, true).then((list) => {
      // El backend ya deja solo las colas con al menos un médico habilitado (misma condición que
      // la derivación); acá se quita "Otra" (`is_placeholder`), que no es la cola de nadie.
      const activas = list.filter((s) => s.status === 'active' && !s.is_placeholder)
      setSpecialties(activas)
      preseleccionarPsicologia(activas)
    })
    fetchAffectedZoneCatalog().then(setZonas)
  })

  // Un adulto con edad <18 es en realidad un menor mal registrado en la rama equivocada
  // (la rama de menor asigna Pediatría automáticamente; la de adulto no). Se confirma con
  // el usuario y, si dice que sí, se cambia de rama y se limpian los campos de adulto para
  // que vuelva a completarlos como representante + menor.
  const handleEdadBlur = () => {
    const n = Number(edad)
    if (edad.trim() === '' || Number.isNaN(n) || n >= 18) return
    const esMenor = window.confirm(
      '¿Estás intentando registrar a un menor de edad? Los menores deben registrarse junto a un adulto responsable, y el caso se asigna automáticamente a Pediatría.'
    )
    if (!esMenor) return
    setIsMinor(true)
    setCedula('')
    setFullName('')
    setPhone('')
    setEmergencyPhone('')
    setAddress('')
    setEmail('')
    setPassword('')
    setEdad('')
    setWantsSpecialty(false)
    setSpecialty('')
    setHasAllergy(false)
    setAllergyDetail('')
  }

  const submit = async () => {
    setError('')

    const result = isMinor
      ? minorSchema.safeParse({
          gCedula,
          gFullName,
          gPhone,
          gEmergencyPhone,
          gAddress,
          gRelationship,
          authedPatient,
          gEmail,
          gPassword,
          mCedula,
          mFullName,
          zona,
          mEdad,
          mHasAllergy,
          mAllergyDetail,
          descripcion,
          consent,
          terminos
        })
      : adultSchema.safeParse({
          cedula,
          fullName,
          phone,
          emergencyPhone,
          address,
          zona,
          edad,
          authedPatient,
          email,
          password,
          wantsSpecialty,
          specialty,
          hasAllergy,
          allergyDetail,
          descripcion,
          consent,
          terminos
        })
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Revisa los campos del formulario.')
      return
    }

    // Marca si signUp() ya dejó una cuenta+sesión activas antes de llamar a
    // createPatient()/createConsultation(), para poder distinguir en el catch si hay que revertir
    // la sesión (ver mitigación de cuentas huérfanas más abajo). No aplica al flujo authedPatient:
    // ahí la cuenta ya existía antes de este submit, no se crea nada nuevo.
    let cuentaCreada = false

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
        cuentaCreada = true
      }

      // Sin selector de "tipo de ayuda", los adultos caen en el bucket general (cubre
      // cualquier especialidad vía SPECIALTY_NEEDS['Medicina general'] = ['*']). Esto alimenta
      // SOLO category/priority de la consulta (matching del panel hoy) — no se toca ese filtro.
      const needsTags = isMinor ? ['Niño / pediatría'] : ['Medicina general']

      // Resolver la especialidad contra el catálogo REAL. Antes se buscaba 'Pediatría' por
      // nombre exacto, pero el catálogo la renombró a 'Pediatría y subespecialidades': el `find`
      // devolvía undefined y TODA consulta de un menor se creaba con specialty_id = null (15
      // casos, el último el 2026-08-04). Se busca por prefijo y, si aun así no aparece, se cae a
      // medicina general y luego a la primera activa: el id no puede quedar vacío, porque
      // `specialty_id` ES la columna del matching.
      const buscarEspecialidad = (prefijo: string) =>
        specialties.find((s) => s.name.toLowerCase().startsWith(prefijo.toLowerCase()))?.id ?? null
      const general = buscarEspecialidad('Medicina general') ?? specialties[0]?.id ?? null
      const specialtyId = isMinor
        ? (buscarEspecialidad('Pediatría') ?? general)
        : wantsSpecialty && specialty
          ? specialty
          : general

      if (!specialtyId) {
        setError('No se pudo cargar el catálogo de especialidades. Vuelve a intentarlo.')
        return // el `finally` de abajo ya resetea `loading`
      }

      // Cifrar la dirección UNA vez (la del adulto / representante). Si falla (entorno sin clave),
      // mostramos el error y NO enviamos el formulario.
      let address_encrypted: string
      try {
        address_encrypted = await encryptAddress(isMinor ? gAddress : address)
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'No se pudo cifrar la dirección. Contacta a soporte.'
        )
        setLoading(false)
        return
      }

      let patientId: string
      let patientName: string
      if (isMinor) {
        // El adulto responsable queda registrado como su propio paciente (dueño de la cuenta,
        // si se creó una); el menor es un registro aparte enlazado por parent_id.
        const guardian = await createPatient({
          user_id: userId,
          full_name: gFullName.trim(),
          cedula: gCedula,
          phone_whatsapp: gPhone,
          emergency_phone: gEmergencyPhone,
          address_encrypted,
          email: contactEmail || null,
          affected_zone: zona,
          consent: true
        })
        const minor = await createPatient({
          full_name: mFullName.trim(),
          cedula: mCedula || null,
          phone_whatsapp: gPhone,
          emergency_phone: gEmergencyPhone,
          address_encrypted,
          email: contactEmail || null,
          affected_zone: zona,
          age_range: mEdad || null,
          allergies: mHasAllergy && mAllergyDetail.trim() ? mAllergyDetail.trim() : null,
          parent_id: guardian.id,
          parentesco: gRelationship,
          consent: true
        })
        patientId = minor.id
        patientName = minor.full_name
      } else {
        const adult = await createPatient({
          user_id: userId,
          full_name: fullName.trim(),
          cedula,
          phone_whatsapp: phone,
          emergency_phone: emergencyPhone,
          address_encrypted,
          email: contactEmail || null,
          affected_zone: zona,
          age_range: edad || null,
          allergies: hasAllergy && allergyDetail.trim() ? allergyDetail.trim() : null,
          consent: true
        })
        patientId = adult.id
        patientName = adult.full_name
      }

      const consultation = await createConsultation({
        patient_id: patientId,
        status: 'waiting',
        priority: needsTags.some((t) =>
          ['Lesión física', 'Embarazo', 'Niño / pediatría'].includes(t)
        )
          ? 'review'
          : 'normal',
        category: needsTags[0],
        chief_complaint: descripcion.trim(),
        specialty_id: specialtyId
      })

      // La sala de video ya NO se crea aquí: la crea el backend en el mismo claim con el que un
      // médico toma el caso. Dársela al paciente desde el registro lo metía en una videollamada
      // vacía; la sala de espera le muestra el botón cuando hay alguien del otro lado.

      // Conversión. Va aquí y no en el submit: el caso ya está en la cola, que es lo único que
      // cuenta como "solicitud realizada". Sin datos de la persona ni de su caso (ver
      // lib/analytics.ts). No-op fuera de producción y si gtag no cargó; nunca lanza.
      trackSolicitudDeConsulta()

      const params = new URLSearchParams({ nombre: patientName })
      params.set('cid', consultation.id)
      // Credencial de la sala, con caducidad de 24 h. Viaja en la URL porque es la única forma
      // de llevarla a /sala-espera; esa página la saca del historial con replaceState en cuanto
      // la lee, para no dejarla en el Referer ni en una captura compartida.
      params.set('t', consultation.access_token)
      router.push(`/sala-espera?${params.toString()}`)
    } catch (e) {
      console.error(e)
      if (cuentaCreada) {
        // El registro en el backend falló después de crear la cuenta de Supabase: cerramos la
        // sesión para no dejar al usuario autenticado con un perfil a medio completar, y se lo
        // decimos explícitamente. No revertimos la cuenta en sí (eso requeriría un endpoint
        // admin con service-role, fuera del alcance de este fix — ver changeslog).
        await supabase.auth.signOut()
        setError(
          'Tu cuenta se creó, pero no pudimos guardar tu solicitud. Contáctanos desde la sección "Contacto" de la página principal para completarla manualmente, o inténtalo de nuevo más tarde con el mismo correo.'
        )
      } else if (e instanceof ApiError && e.status === 422) {
        setError(e.message || 'Revisa los datos ingresados.')
      } else {
        setError(
          'No se pudo registrar la solicitud. Puede que el email ya esté registrado, o haya un error de conexión.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo
        titulo="Solicitar consulta gratuita — Médicos por Venezuela"
        descripcion={
          'Cuéntanos qué necesitas y un especialista verificado te atenderá por videoconsulta, ' +
          'sin costo. Puedes solicitarla de forma anónima, sin crear una cuenta.'
        }
        ruta="/registro-paciente"
      />
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
                    label="Cédula / DNI del representante"
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
                  <PhoneField
                    label="Teléfono de emergencia de un familiar"
                    value={gEmergencyPhone}
                    onChange={setGEmergencyPhone}
                    required
                    placeholder="Ej. 4241234567"
                    hint="Debe ser el número de otra persona (no el del representante): es a quien llamamos si hay una emergencia."
                  />
                  <div>
                    <label className="label">Dirección de residencia *</label>
                    <input
                      value={gAddress}
                      onChange={(e) => setGAddress(e.target.value)}
                      maxLength={300}
                      placeholder="Ej. Calle 123, Urbanización Los Próceres"
                    />
                    <div className="hint">
                      Solo la ve el médico que te atienda. Se guarda cifrada.
                    </div>
                  </div>
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
                    label="Cédula / DNI del menor"
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
                      <label className="label">Zona *</label>
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
                  <CedulaField label="Cédula / DNI" value={cedula} onChange={setCedula} required />
                  <div>
                    <label className="label">Nombre completo *</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. María González"
                    />
                  </div>
                  <PhoneField label="WhatsApp" value={phone} onChange={setPhone} required />
                  <PhoneField
                    label="Teléfono de emergencia de un familiar"
                    value={emergencyPhone}
                    onChange={setEmergencyPhone}
                    required
                    placeholder="Ej. 4241234567"
                    hint="Debe ser el número de otra persona, no el tuyo: es a quien llamamos si hay una emergencia."
                  />
                  <div>
                    <label className="label">Dirección de residencia *</label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      maxLength={300}
                      placeholder="Ej. Calle 123, Urbanización Los Próceres"
                    />
                    <div className="hint">
                      Solo la ve el médico que te atienda. Se guarda cifrada.
                    </div>
                  </div>
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
                      <label className="label">Zona *</label>
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
                        onBlur={handleEdadBlur}
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
                            <option key={s.id} value={s.id}>
                              {s.name}
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
                  solidaria. Entiendo que se me pide un teléfono de emergencia de un familiar
                  (distinto al de WhatsApp) y mi dirección de residencia para poder actuar en una
                  emergencia, que la dirección se guarda cifrada de extremo a extremo (nadie en la
                  plataforma puede leerla), que la atención es por videoconsulta, que el seguimiento
                  podría continuar por teléfono si fuese necesario, y que esto no reemplaza atención
                  presencial ni servicios de emergencia.
                </span>
              </label>
              <AceptaTerminos checked={terminos} onChange={setTerminos} />
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
