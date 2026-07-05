import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { verificarSacs, verificarPsicologo } from '../lib/verificacion'
import {
  fetchProfessionalTypes,
  fetchSpecialties,
  createDoctor,
  ApiError,
  type ProfessionalTypeResponse,
  type SpecialtyResponse
} from '../lib/doctors'
import { useMountEffect } from '../lib/hooks'

// Consolida en un solo paso lo que antes estaba dividido entre este archivo (cuenta) y
// /elegir-rol (especialidad/país/whatsapp), según el diagrama de secuencia + wireframe
// del ticket "refactor(registro-medicos)". La verificación de cédula (SACS/FPV) y el
// alta del profesional pegan contra el backend real — ver lib/verificacion.ts y
// lib/doctors.ts.
//
// El registro con Google se eliminó de esta pantalla: la cuenta se crea únicamente
// con correo + contraseña.

const PAISES = [
  { nombre: 'Venezuela', dial: '+58' },
  { nombre: 'Colombia', dial: '+57' },
  { nombre: 'España', dial: '+34' },
  { nombre: 'Chile', dial: '+56' },
  { nombre: 'Argentina', dial: '+54' },
  { nombre: 'Perú', dial: '+51' },
  { nombre: 'Ecuador', dial: '+593' },
  { nombre: 'México', dial: '+52' },
  { nombre: 'Estados Unidos', dial: '+1' },
  { nombre: 'Panamá', dial: '+507' },
  { nombre: 'República Dominicana', dial: '+1' },
  { nombre: 'Uruguay', dial: '+598' },
  { nombre: 'Italia', dial: '+39' },
  { nombre: 'Portugal', dial: '+351' },
  { nombre: 'Dinamarca', dial: '+45' }
]

const soloDigitos = (value: string) => value.replace(/\D/g, '')

// Validación del formulario. mostrarEspecialidad/especialidad viajan juntos porque la
// especialidad solo es obligatoria cuando el tipo de profesional es "Médico" (para
// Psicólogo se fija sola, para el resto no aplica) — ver mostrarEspecialidad más abajo.
const registroMedicoSchema = z
  .object({
    tipoProfesional: z.string().min(1, 'Selecciona el tipo de profesional.'),
    cedulaNumero: z
      .string()
      .regex(/^\d+$/, 'La cédula solo debe contener números.')
      .min(6, 'La cédula debe tener al menos 6 dígitos.')
      .max(9, 'La cédula no puede tener más de 9 dígitos.'),
    nombreCompleto: z.string().trim().min(2, 'Completa el nombre completo.'),
    whatsappNumero: z
      .string()
      .regex(/^\d+$/, 'El WhatsApp solo debe contener números.')
      .min(7, 'El WhatsApp debe tener al menos 7 dígitos.')
      .max(11, 'El WhatsApp no puede tener más de 11 dígitos.'),
    correo: z.string().trim().min(1, 'Ingresa tu correo.').email('Ingresa un correo válido.'),
    paisReside: z.string().min(1, 'Selecciona el país donde resides.'),
    mostrarEspecialidad: z.boolean(),
    especialidadId: z.string(),
    contrasena: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.')
  })
  .refine((data) => !data.mostrarEspecialidad || data.especialidadId.length > 0, {
    message: 'Selecciona una especialidad.',
    path: ['especialidadId']
  })

export default function RegistroMedico() {
  const router = useRouter()
  const [professionalTypes, setProfessionalTypes] = useState<ProfessionalTypeResponse[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyResponse[]>([])
  const [tipoProfesionalId, setTipoProfesionalId] = useState('')
  const [tipoProfesional, setTipoProfesional] = useState('')
  const [cedulaPrefijo, setCedulaPrefijo] = useState<'V' | 'E'>('V')
  const [cedulaNumero, setCedulaNumero] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [licencia, setLicencia] = useState('')
  const [whatsappPrefijo, setWhatsappPrefijo] = useState('+58')
  const [whatsappNumero, setWhatsappNumero] = useState('')
  const [correo, setCorreo] = useState('')
  const [paisReside, setPaisReside] = useState('')
  const [especialidadId, setEspecialidadId] = useState('')
  const [contrasena, setContrasena] = useState('')
  // Honeypot anti-bot: campo real (no type="hidden") que un humano nunca ve ni completa,
  // pero que un bot que auto-rellena formularios sí suele tocar.
  const [website, setWebsite] = useState('')

  // null = sin verificar todavía, true = encontrado (campos bloqueados),
  // false = no encontrado (campos liberados para carga manual).
  const [verificado, setVerificado] = useState<boolean | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useMountEffect(() => {
    fetchProfessionalTypes()
      .then(setProfessionalTypes)
      .catch((e) => {
        console.error('No se pudo cargar el catálogo de tipos de profesional:', e)
        setError('No se pudo cargar el catálogo de tipos de profesional. Recarga la página.')
      })
  })

  useMountEffect(() => {
    fetchSpecialties()
      .then(setSpecialties)
      .catch((e) => {
        console.error('No se pudo cargar el catálogo de especialidades:', e)
        setError('No se pudo cargar el catálogo de especialidades. Recarga la página.')
      })
  })

  const requiereVerificacion = tipoProfesional === 'Médico' || tipoProfesional === 'Psicólogo'
  const mostrarEspecialidad = tipoProfesional === 'Médico'
  const especialidadesActivas = specialties.filter(
    (s) => s.status === 'active' && s.name !== 'Psicología'
  )

  // Psicólogo no tiene selector propio: se asigna automáticamente la especialidad
  // "Psicología" del catálogo (intención original antes de que existiera este catálogo
  // con id real — ver git blame). Para cualquier otro tipo (Nutricionista, etc.) no aplica.
  function resolverSpecialtyId(): string | null {
    if (tipoProfesional === 'Médico') return especialidadId || null
    if (tipoProfesional === 'Psicólogo') {
      return specialties.find((s) => s.name === 'Psicología')?.id ?? null
    }
    return null
  }

  function onChangeTipoProfesional(id: string) {
    const seleccionado = professionalTypes.find((t) => t.id === id)
    setTipoProfesionalId(id)
    setTipoProfesional(seleccionado?.name || '')
    setVerificado(null)
    setNombreCompleto('')
    setLicencia('')
  }

  // Cambiar la cédula invalida cualquier verificación previa: si los campos
  // estaban bloqueados (autocompletados por una cédula anterior), se limpian
  // para no dejar pegados datos de una identidad que ya no corresponde.
  function limpiarSiEstabaBloqueado() {
    if (verificado === true) {
      setNombreCompleto('')
      setLicencia('')
    }
  }

  function onChangeCedulaPrefijo(value: 'V' | 'E') {
    limpiarSiEstabaBloqueado()
    setCedulaPrefijo(value)
    setVerificado(null)
  }

  function onChangeCedulaNumero(value: string) {
    limpiarSiEstabaBloqueado()
    setCedulaNumero(soloDigitos(value))
    setVerificado(null)
  }

  async function verificarCedula() {
    if (!requiereVerificacion || cedulaNumero.length < 6) return
    setVerificando(true)
    setError('')
    try {
      const resp =
        tipoProfesional === 'Médico'
          ? await verificarSacs(`${cedulaPrefijo}-${cedulaNumero}`)
          : await verificarPsicologo(cedulaNumero)
      if (resp.encontrado) {
        setNombreCompleto([resp.nombre, resp.apellido].filter(Boolean).join(' '))
        setLicencia(resp.licencia || '')
        setVerificado(true)
      } else {
        setVerificado(false)
      }
    } catch (e) {
      console.error(e)
      setVerificado(false)
      setError('No se pudo verificar la cédula en este momento. Completa tus datos manualmente.')
    } finally {
      setVerificando(false)
    }
  }

  const camposBloqueados = verificado === true

  const submit = async () => {
    setError('')

    const result = registroMedicoSchema.safeParse({
      tipoProfesional,
      cedulaNumero,
      nombreCompleto,
      whatsappNumero,
      correo,
      paisReside,
      mostrarEspecialidad,
      especialidadId,
      contrasena
    })
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Revisa los campos del formulario.')
      return
    }
    if (!tipoProfesionalId) {
      setError('Selecciona el tipo de profesional.')
      return
    }

    // Marca si signUp() ya dejó una cuenta+sesión activas antes de llamar a createDoctor(), para
    // poder distinguir en el catch si hay que revertir la sesión (ver mitigación de cuentas
    // huérfanas más abajo).
    let cuentaCreada = false

    setLoading(true)
    try {
      const accountEmail = correo.trim().toLowerCase()
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: accountEmail,
        password: contrasena,
        options: { data: { full_name: nombreCompleto.trim(), role: 'doctor' } }
      })
      if (signUpError) throw signUpError
      if (!signUpData.session) {
        setError(
          'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión en el panel médico.'
        )
        return
      }
      cuentaCreada = true

      await createDoctor({
        professional_type_id: tipoProfesionalId,
        specialty_id: resolverSpecialtyId(),
        cedula: `${cedulaPrefijo}-${cedulaNumero}`,
        full_name: nombreCompleto,
        license: licencia || null,
        phone: `${whatsappPrefijo}${whatsappNumero}`,
        email: accountEmail,
        country_of_residence: paisReside || null,
        website
      })
      // Diagrama de secuencia del ticket: tras el 201 se redirige directo al board (panel-medico),
      // no se pide un login manual aparte — signUp() ya dejó una sesión activa.
      await router.push('/panel-medico')
    } catch (e) {
      if (cuentaCreada) {
        // El registro en el backend falló después de crear la cuenta de Supabase: cerramos la
        // sesión para no dejar al usuario autenticado con un perfil a medio completar, y se lo
        // decimos explícitamente. No revertimos la cuenta en sí (eso requeriría un endpoint
        // admin con service-role, fuera del alcance de este fix — ver changeslog).
        await supabase.auth.signOut()
        console.error(e)
        setError(
          'Tu cuenta se creó, pero no pudimos guardar tus datos de registro. Contáctanos desde la sección "Contacto" de la página principal para completar tu registro manualmente, o inténtalo de nuevo más tarde con el mismo correo.'
        )
      } else if (e instanceof ApiError && e.status === 422) {
        setError(e.message || 'Cédula o teléfono con formato inválido.')
      } else if (e instanceof ApiError && e.status === 429) {
        setError('Demasiados intentos. Intenta de nuevo más tarde.')
      } else if (e instanceof ApiError) {
        setError('No se pudo completar el registro. Intenta de nuevo.')
      } else {
        console.error(e)
        setError(
          'No se pudo crear la cuenta. Puede que el correo ya esté registrado, o haya un error de conexión.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Registro médico — Médicos por Venezuela</title>
      </Head>
      <main className="page registro-medico-page">
        <div className="narrow">
          <Link href="/" className="link-button">
            ← Volver
          </Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Registro de profesional</h1>
            <p style={{ color: '#64748b' }}>
              Completa tus datos para unirte como voluntario (médico, psicólogo u otro profesional
              de salud).
            </p>

            <div className="grid">
              <div>
                <label className="label">Tipo de profesional *</label>
                <select
                  value={tipoProfesionalId}
                  onChange={(e) => onChangeTipoProfesional(e.target.value)}
                >
                  <option value="">Selecciona...</option>
                  {professionalTypes
                    .filter((t) => t.status === 'active')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="label">Cédula *</label>
                <div className="input-group">
                  <select
                    value={cedulaPrefijo}
                    onChange={(e) => onChangeCedulaPrefijo(e.target.value as 'V' | 'E')}
                    disabled={!tipoProfesionalId}
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                  </select>
                  <input
                    value={cedulaNumero}
                    onChange={(e) => onChangeCedulaNumero(e.target.value)}
                    onBlur={verificarCedula}
                    disabled={!tipoProfesionalId}
                    inputMode="numeric"
                    placeholder="Solo números"
                  />
                </div>
                {/* La verificación (SACS/FPV) depende del tipo de profesional, así que el
                    campo se bloquea hasta elegirlo — evita que el onBlur no dispare nada
                    sin explicar por qué. */}
                {!tipoProfesionalId && (
                  <div className="hint">Selecciona primero el tipo de profesional.</div>
                )}
                {verificando && <div className="hint">Verificando cédula...</div>}
                {verificado === true && (
                  <div className="notice notice-success" style={{ marginTop: 8 }}>
                    Cédula verificada ✓ Datos cargados automáticamente.
                  </div>
                )}
                {verificado === false && (
                  <div className="notice notice-warning" style={{ marginTop: 8 }}>
                    No encontramos esta cédula en el registro. Completa tus datos manualmente.
                  </div>
                )}
              </div>

              <div className="grid grid-2">
                <div>
                  <label className="label">Nombre completo *</label>
                  <input
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    readOnly={camposBloqueados}
                  />
                </div>
                <div>
                  <label className="label">Licencia / colegiatura</label>
                  <input
                    value={licencia}
                    onChange={(e) => setLicencia(e.target.value)}
                    readOnly={camposBloqueados}
                    placeholder="Opcional si no aplica"
                  />
                </div>
              </div>

              <div>
                <label className="label">WhatsApp *</label>
                <div className="input-group">
                  <select
                    value={whatsappPrefijo}
                    onChange={(e) => setWhatsappPrefijo(e.target.value)}
                  >
                    {PAISES.map((p) => (
                      <option key={p.nombre} value={p.dial}>
                        {p.dial}
                      </option>
                    ))}
                  </select>
                  <input
                    value={whatsappNumero}
                    onChange={(e) => setWhatsappNumero(soloDigitos(e.target.value))}
                    inputMode="numeric"
                    placeholder="Solo números"
                  />
                </div>
                <div className="hint">
                  Solo para uso administrativo. Nunca se comparte con pacientes ni con terceros.
                </div>
              </div>

              <div>
                <label className="label">Correo *</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </div>

              <div>
                <label className="label">País donde reside *</label>
                <select value={paisReside} onChange={(e) => setPaisReside(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {PAISES.map((p) => (
                    <option key={p.nombre} value={p.nombre}>
                      {p.nombre}
                    </option>
                  ))}
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {mostrarEspecialidad && (
                <div>
                  <label className="label">Especialidad *</label>
                  <select
                    value={especialidadId}
                    onChange={(e) => setEspecialidadId(e.target.value)}
                  >
                    <option value="">Selecciona...</option>
                    {especialidadesActivas.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Contraseña *</label>
                <input
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />

              {error && <div className="notice notice-danger">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
                {loading ? 'Registrando...' : 'Registrarse'}
              </button>
            </div>

            <p style={{ marginTop: 18, color: '#64748b' }}>
              ¿Ya tienes cuenta?{' '}
              <Link href="/login-medico" style={{ color: 'var(--home-blue)', fontWeight: 800 }}>
                Entrar al panel médico
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
