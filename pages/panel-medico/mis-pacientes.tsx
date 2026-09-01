// Pacientes de CONSULTORIO del médico: los que registra él mismo para pedir una interconsulta.
// No entran a la cola pública ni tienen cuenta. Ver .knowledge/interconsultas.md del backend.
import Seo from '../../components/Seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import CedulaField from '../../components/CedulaField'
import {
  archiveDoctorPatient,
  createDoctorPatient,
  fetchMyDoctorPatients,
  type DoctorPatient
} from '../../lib/doctorPatients'
import SolicitarInterconsulta from '../../components/SolicitarInterconsulta'

// Este formulario replica el de /registro-paciente en campos, orden y comportamiento: mismo
// `CedulaField`, edad como NÚMERO (que es lo que guarda `age_range` allí, no un rango), alergia
// como interruptor con detalle, y el consentimiento como aviso destacado. Un médico que ya usó
// el registro público no debería tener que aprender otro formulario.
//
// Lo que NO se replica, a propósito: WhatsApp, zona y especialidad. El paciente de consultorio
// no entra a la cola y nadie de la plataforma lo contacta; la especialidad se elige después, al
// pedir la interconsulta.
const VACIO = { full_name: '', edad: '', cedula: '', allergies: '', description: '' }

export default function MisPacientes() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [pacientes, setPacientes] = useState<DoctorPatient[]>([])
  const [form, setForm] = useState({ ...VACIO })
  // El consentimiento es una atestación del médico: arranca apagado a propósito.
  const [consent, setConsent] = useState(false)
  // Interruptor de alergia, igual que /registro-paciente: evita el 'ninguna'/'no' escrito a mano.
  const [hasAllergy, setHasAllergy] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Un estado de error por fuente: el fallo de la lista se recupera recargando, el del formulario
  // corrigiendo y reenviando, y el de archivar reintentando esa acción. Compartir uno solo haría
  // que el `setError('')` de cualquiera borrase el aviso de otro.
  const [errorCarga, setErrorCarga] = useState('')
  const [errorForm, setErrorForm] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [aviso, setAviso] = useState('')
  // Paciente sobre el que se está pidiendo interconsulta (null = ninguno).
  const [pidiendoPara, setPidiendoPara] = useState<DoctorPatient | null>(null)
  // Paciente pendiente de confirmar archivado (null = no hay confirmación abierta).
  const [porArchivar, setPorArchivar] = useState<DoctorPatient | null>(null)
  const [archivando, setArchivando] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    setToken(session.access_token)
    try {
      setPacientes(await fetchMyDoctorPatients(session.access_token))
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar tus pacientes.')
    } finally {
      setLoading(false)
    }
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setErrorForm('')
    setAviso('')
    setGuardando(true)
    try {
      const creado = await createDoctorPatient(
        {
          full_name: form.full_name.trim(),
          // `age_range` guarda la edad tal cual, igual que /registro-paciente (`age_range: edad`).
          age_range: form.edad.trim() || null,
          cedula: form.cedula.trim() || null,
          // Sin el interruptor activo no se manda nada, aunque haya quedado texto escrito.
          allergies: (hasAllergy && form.allergies.trim()) || null,
          description: form.description.trim() || null,
          consent
        },
        token
      )
      // Functional update: entre el await y este setState pudo cambiar la lista.
      setPacientes((prev) => [creado, ...prev])
      setForm({ ...VACIO })
      setConsent(false)
      setHasAllergy(false)
      setAviso(`${creado.full_name} quedó registrado. Ya puedes pedir una interconsulta.`)
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo registrar el paciente.')
    } finally {
      setGuardando(false)
    }
  }

  async function archivar() {
    if (!porArchivar) return
    setErrorAccion('')
    setArchivando(true)
    try {
      await archiveDoctorPatient(porArchivar.id, token)
      setPacientes((prev) => prev.filter((p) => p.id !== porArchivar.id))
      setPorArchivar(null)
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo archivar el paciente.')
      setPorArchivar(null)
    } finally {
      setArchivando(false)
    }
  }

  return (
    <>
      <Seo
        titulo="Mis pacientes — Médicos por Venezuela"
        descripcion="Registra a tus pacientes de consultorio para pedir una interconsulta."
        ruta="/panel-medico/mis-pacientes"
        noindex
      />
      <main className="page">
        <div className="container">
          <button className="link-button" onClick={() => router.push('/panel-medico')}>
            ← Volver al panel médico
          </button>

          <h1>Mis pacientes de consultorio</h1>
          <p style={{ color: '#64748b', marginTop: -8 }}>
            Registra aquí a los pacientes que atiendes por fuera de la plataforma, para pedir una
            segunda opinión sobre su caso. No entran a la cola pública ni reciben notificaciones.
          </p>

          {aviso && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              {aviso}
            </div>
          )}
          {errorAccion && (
            <div className="notice notice-error" style={{ marginBottom: 16 }}>
              {errorAccion}
            </div>
          )}

          <section className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Registrar un paciente</h2>
            {errorForm && (
              <div className="notice notice-error" style={{ marginBottom: 12 }}>
                {errorForm}
              </div>
            )}
            <form onSubmit={registrar}>
              <CedulaField
                label="Cédula / DNI"
                value={form.cedula}
                onChange={(v) => setForm((f) => ({ ...f, cedula: v }))}
              />

              <div>
                <label className="label" htmlFor="full_name">
                  Nombre completo *
                </label>
                <input
                  id="full_name"
                  required
                  minLength={2}
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Ej. María González"
                />
              </div>

              <div>
                <label className="label" htmlFor="edad">
                  Edad *
                </label>
                <input
                  id="edad"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  required
                  value={form.edad}
                  onChange={(e) => setForm({ ...form, edad: e.target.value })}
                  placeholder="Ej. 34"
                />
              </div>

              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hasAllergy}
                    onChange={(e) => setHasAllergy(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  ¿Tiene alguna alergia?
                </label>
                {hasAllergy && (
                  <div style={{ marginTop: 10 }}>
                    <label className="label" htmlFor="allergies">
                      ¿A qué es alérgico? *
                    </label>
                    <input
                      id="allergies"
                      value={form.allergies}
                      onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                      placeholder="Ej. Penicilina"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="label" htmlFor="description">
                  Descripción breve *
                </label>
                <textarea
                  id="description"
                  rows={4}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe en pocas palabras qué le ocurre y si ya está tomando algún medicamento."
                />
              </div>

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
                  Declaro que mi paciente autorizó compartir esta información con un especialista de
                  Médicos por Venezuela para obtener una segunda opinión. Entiendo que el
                  especialista no verá su identidad ni sus datos de contacto.
                </span>
              </label>

              <button
                className="btn btn-primary btn-full"
                type="submit"
                disabled={
                  guardando ||
                  !consent ||
                  form.full_name.trim().length < 2 ||
                  !form.edad.trim() ||
                  !form.description.trim() ||
                  (hasAllergy && !form.allergies.trim())
                }
              >
                {guardando ? 'Registrando...' : 'Registrar paciente'}
              </button>
            </form>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              No pedimos teléfono ni ubicación: el especialista nunca contacta a tu paciente, se
              comunica contigo.
            </p>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Tus pacientes ({pacientes.length})</h2>
            {errorCarga && <div className="notice notice-error">{errorCarga}</div>}
            {loading ? (
              <p style={{ color: '#64748b' }}>Cargando...</p>
            ) : pacientes.length === 0 ? (
              <p style={{ color: '#64748b' }}>
                Todavía no registraste ningún paciente de consultorio.
              </p>
            ) : (
              <div className="grid">
                {pacientes.map((p) => (
                  <div key={p.id} className="card-flat">
                    <strong>{p.full_name}</strong>
                    <p style={{ color: '#64748b', margin: '4px 0' }}>
                      {p.age_range ? `${p.age_range} años` : 'Edad sin especificar'}
                      {p.allergies ? ` · Alergias: ${p.allergies}` : ''}
                    </p>
                    {p.description && <p style={{ margin: '4px 0' }}>{p.description}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" onClick={() => setPidiendoPara(p)}>
                        Pedir interconsulta
                      </button>
                      <button className="btn btn-muted" onClick={() => setPorArchivar(p)}>
                        Archivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {pidiendoPara && (
        <SolicitarInterconsulta
          paciente={pidiendoPara}
          token={token}
          onClose={() => setPidiendoPara(null)}
          onCreated={(mensaje) => {
            setPidiendoPara(null)
            setAviso(mensaje)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(porArchivar)}
        title="Archivar paciente"
        message={
          <p>
            <strong>{porArchivar?.full_name}</strong> dejará de aparecer en tu lista. Sus
            interconsultas previas se conservan.
          </p>
        }
        confirmLabel="Archivar"
        onConfirm={archivar}
        onCancel={() => setPorArchivar(null)}
        busy={archivando}
        danger
      />
    </>
  )
}
