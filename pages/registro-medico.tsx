import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { signInWithGoogle } from '../lib/auth'
import { SPECIALTIES } from '../lib/utils'
import { verificarSacs, verificarPsicologo } from '../lib/verificacion'
import GoogleButton from '../components/GoogleButton'

// MAQUETA (submit sin endpoint todavía): consolida en un solo paso lo que hoy está
// dividido entre este archivo (cuenta) y /elegir-rol (especialidad/país/whatsapp),
// según el diagrama de secuencia + wireframe del ticket "refactor(registro-medicos)".
// La verificación de cédula (SACS/FPV) ya pega contra el backend real — ver
// lib/verificacion.ts. El submit del formulario sigue simulado:
//   - GET /api/v1/professional-types                 (hoy es staff-only; para un
//     selector público como este hace falta un catálogo público, como
//     /specialties/catalog. Ver nota en TIPOS_PROFESIONAL abajo.)
//
// El botón de Google sigue el flujo viejo (-> /elegir-rol) sin cambios: no forma
// parte de este ticket. Queda como gap conocido a resolver en otra pasada.

// TODO: reemplazar por fetch a GET /api/v1/professional-types (necesita catálogo
// público equivalente a /specialties/catalog; hoy ese endpoint es staff-only).
const TIPOS_PROFESIONAL = ['Médico', 'Psicólogo', 'Nutricionista', 'Otro']

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

export default function RegistroMedico() {
  const [tipoProfesional, setTipoProfesional] = useState('')
  const [cedulaPrefijo, setCedulaPrefijo] = useState<'V' | 'E'>('V')
  const [cedulaNumero, setCedulaNumero] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [licencia, setLicencia] = useState('')
  const [whatsappPrefijo, setWhatsappPrefijo] = useState('+58')
  const [whatsappNumero, setWhatsappNumero] = useState('')
  const [correo, setCorreo] = useState('')
  const [paisReside, setPaisReside] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [contrasena, setContrasena] = useState('')

  // null = sin verificar todavía, true = encontrado (campos bloqueados),
  // false = no encontrado (campos liberados para carga manual).
  const [verificado, setVerificado] = useState<boolean | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const requiereVerificacion = tipoProfesional === 'Médico' || tipoProfesional === 'Psicólogo'
  const mostrarEspecialidad = tipoProfesional === 'Médico'
  // Si es psicólogo, la especialidad se fija sola y no se muestra el selector.
  const especialidadFinal = tipoProfesional === 'Psicólogo' ? 'Psicología' : especialidad

  function onChangeTipoProfesional(value: string) {
    setTipoProfesional(value)
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
    setOk(false)
    if (
      !tipoProfesional ||
      !cedulaNumero ||
      !nombreCompleto.trim() ||
      !whatsappNumero ||
      !correo.trim() ||
      !paisReside ||
      (mostrarEspecialidad && !especialidad) ||
      contrasena.length < 6
    ) {
      setError('Completa todos los campos obligatorios (contraseña mínimo 6 caracteres).')
      return
    }
    setLoading(true)
    try {
      // MAQUETA: acá va el POST real al backend una vez esté disponible
      // (ver notas al inicio del archivo). No se crea ninguna cuenta todavía.
      await new Promise((r) => setTimeout(r, 500))
      console.log('[maqueta] payload de registro', {
        tipo_profesional: tipoProfesional,
        cedula: `${cedulaPrefijo}-${cedulaNumero}`,
        nombre_completo: nombreCompleto,
        licencia,
        whatsapp: `${whatsappPrefijo}${whatsappNumero}`,
        correo,
        pais_reside: paisReside,
        especialidad: especialidadFinal || null
      })
      setOk(true)
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
                  value={tipoProfesional}
                  onChange={(e) => onChangeTipoProfesional(e.target.value)}
                >
                  <option value="">Selecciona...</option>
                  {TIPOS_PROFESIONAL.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                  </select>
                  <input
                    value={cedulaNumero}
                    onChange={(e) => onChangeCedulaNumero(e.target.value)}
                    onBlur={verificarCedula}
                    inputMode="numeric"
                    placeholder="Solo números"
                  />
                </div>
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
                  <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {SPECIALTIES.filter((s) => s !== 'Psicología').map((s) => (
                      <option key={s} value={s}>
                        {s}
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

              {error && <div className="notice notice-danger">{error}</div>}
              {ok && (
                <div className="notice notice-success">
                  Maqueta: formulario válido (sin backend conectado todavía).
                </div>
              )}
              <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
                {loading ? 'Registrando...' : 'Registrarse'}
              </button>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>o</div>
              <GoogleButton onClick={googleSignup} disabled={loading} />
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
