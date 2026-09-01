// Interconsultas ASÍNCRONAS: los dos lados del feature en una página.
//
// - Bandeja: casos abiertos de mi especialidad, ANONIMIZADOS, para tomar.
// - Casos que tomé: los activos, con el contacto del médico tratante.
// - Mis solicitudes: las que pedí yo, para cancelar o cerrar.
//
// No confundir con la interconsulta EN VIVO del panel (video durante una consulta de la cola).
import Seo from '../../components/Seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import {
  ApiError,
  cancelRequest,
  closeRequest,
  fetchInbox,
  fetchMyRequests,
  fetchTakenByMe,
  takeRequest,
  type InterconsultationInboxItem,
  type InterconsultationRequest,
  type InterconsultationTaken
} from '../../lib/interconsultationRequests'

type Tab = 'bandeja' | 'tome' | 'pedi'

const ESTADO_LABEL: Record<string, string> = {
  open: 'Esperando especialista',
  taken: 'Tomada',
  closed: 'Cerrada',
  cancelled: 'Cancelada'
}

// WhatsApp necesita el número sin símbolos para el enlace wa.me.
function waLink(numero: string): string {
  return `https://wa.me/${numero.replace(/[^0-9]/g, '')}`
}

export default function Interconsultas() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [tab, setTab] = useState<Tab>('bandeja')
  const [loading, setLoading] = useState(true)
  const [bandeja, setBandeja] = useState<InterconsultationInboxItem[]>([])
  const [tome, setTome] = useState<InterconsultationTaken[]>([])
  const [pedi, setPedi] = useState<InterconsultationRequest[]>([])
  // Un estado de error por fuente: el fallo de carga se recupera recargando; el de una acción
  // (tomar/cancelar/cerrar), reintentando esa acción. Con uno solo, el `setError('')` de una
  // acción borraría el aviso de que la lista no cargó.
  const [errorCarga, setErrorCarga] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState('')
  // Confirmaciones pendientes (null = ninguna abierta).
  const [porCancelar, setPorCancelar] = useState<InterconsultationRequest | null>(null)
  const [porCerrar, setPorCerrar] = useState<InterconsultationRequest | null>(null)
  const [notaCierre, setNotaCierre] = useState('')

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
    await recargar(session.access_token)
    setLoading(false)
  }

  async function recargar(t: string) {
    try {
      const [b, tk, m] = await Promise.all([fetchInbox(t), fetchTakenByMe(t), fetchMyRequests(t)])
      setBandeja(b)
      setTome(tk)
      setPedi(m)
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar las interconsultas.')
    }
  }

  async function tomar(caso: InterconsultationInboxItem) {
    setErrorAccion('')
    setAviso('')
    setOcupado(caso.id)
    try {
      const tomada = await takeRequest(caso.id, token)
      setAviso(
        `Tomaste el caso. Contacta a ${tomada.requesting_doctor.full_name}` +
          (tomada.requesting_doctor.whatsapp_number
            ? ` por WhatsApp: ${tomada.requesting_doctor.whatsapp_number}`
            : ' por correo.')
      )
      setTab('tome')
      await recargar(token)
    } catch (e) {
      // 409 = otro especialista ganó la carrera. No es un error del usuario: se le explica y se
      // refresca la bandeja para que el caso desaparezca.
      if (e instanceof ApiError && e.status === 409) {
        setAviso('Otro colega tomó este caso primero.')
        await recargar(token)
      } else {
        setErrorAccion(e instanceof Error ? e.message : 'No se pudo tomar la interconsulta.')
      }
    } finally {
      setOcupado('')
    }
  }

  async function cancelar() {
    if (!porCancelar) return
    setErrorAccion('')
    setOcupado(porCancelar.id)
    try {
      await cancelRequest(porCancelar.id, token)
      setAviso('Solicitud retirada.')
      setPorCancelar(null)
      await recargar(token)
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo cancelar la solicitud.')
      setPorCancelar(null)
    } finally {
      setOcupado('')
    }
  }

  async function cerrar() {
    if (!porCerrar) return
    setErrorAccion('')
    setOcupado(porCerrar.id)
    try {
      await closeRequest(porCerrar.id, notaCierre.trim() || null, token)
      setAviso('Caso cerrado.')
      setPorCerrar(null)
      setNotaCierre('')
      await recargar(token)
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo cerrar el caso.')
      setPorCerrar(null)
    } finally {
      setOcupado('')
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'bandeja', label: 'Casos para mí', count: bandeja.length },
    { id: 'tome', label: 'Casos que tomé', count: tome.length },
    { id: 'pedi', label: 'Mis solicitudes', count: pedi.length }
  ]

  return (
    <>
      <Seo
        titulo="Interconsultas — Médicos por Venezuela"
        descripcion="Casos de tu especialidad y las segundas opiniones que pediste."
        ruta="/panel-medico/interconsultas"
        noindex
      />
      <main className="page">
        <div className="container">
          <button className="link-button" onClick={() => router.push('/panel-medico')}>
            ← Volver al panel médico
          </button>

          <h1>Interconsultas</h1>

          {errorCarga && (
            <div className="notice notice-error" style={{ marginBottom: 16 }}>
              {errorCarga}
            </div>
          )}
          {errorAccion && (
            <div className="notice notice-error" style={{ marginBottom: 16 }}>
              {errorAccion}
            </div>
          )}
          {aviso && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              {aviso}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'btn btn-primary' : 'btn btn-outline'}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card">Cargando...</div>
          ) : tab === 'bandeja' ? (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Casos abiertos para tu especialidad</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
                Ves el motivo, las notas y la edad. Sin identidad del paciente ni del colega que
                pide. Al tomar el caso recibes sus datos de contacto.
              </p>
              {bandeja.length === 0 ? (
                <p style={{ color: '#64748b' }}>No hay casos abiertos para tu especialidad.</p>
              ) : (
                <div className="grid">
                  {bandeja.map((c) => (
                    <div key={c.id} className="card-flat">
                      <strong>
                        {c.specialty_name}
                        {c.patient_age_range ? ` · ${c.patient_age_range} años` : ''}
                      </strong>
                      {c.dirigida_a_mi && (
                        <span className="badge badge-green" style={{ marginLeft: 8 }}>
                          Te la enviaron a ti
                        </span>
                      )}
                      <p>
                        <em>Motivo:</em> {c.chief_complaint}
                      </p>
                      {c.clinical_notes && (
                        <p>
                          <em>Notas:</em> {c.clinical_notes}
                        </p>
                      )}
                      <button
                        className="btn btn-primary btn-full"
                        onClick={() => tomar(c)}
                        disabled={ocupado === c.id}
                      >
                        {ocupado === c.id ? 'Tomando...' : 'Tomar este caso'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : tab === 'tome' ? (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Casos que tomé</h2>
              {tome.length === 0 ? (
                <p style={{ color: '#64748b' }}>Todavía no tomaste ningún caso.</p>
              ) : (
                <div className="grid">
                  {tome.map((c) => (
                    <div key={c.id} className="card-flat">
                      <strong>
                        {c.specialty_name}
                        {c.patient_age_range ? ` · ${c.patient_age_range} años` : ''}
                      </strong>
                      <p>
                        <em>Motivo:</em> {c.chief_complaint}
                      </p>
                      {c.clinical_notes && (
                        <p>
                          <em>Notas:</em> {c.clinical_notes}
                        </p>
                      )}
                      <p>
                        <em>Médico tratante:</em> {c.requesting_doctor.full_name}
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {c.requesting_doctor.whatsapp_number && (
                          <a
                            className="btn btn-primary"
                            href={waLink(c.requesting_doctor.whatsapp_number)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            WhatsApp
                          </a>
                        )}
                        {c.requesting_doctor.email && (
                          <a
                            className="btn btn-outline"
                            href={`mailto:${c.requesting_doctor.email}`}
                          >
                            Correo
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Mis solicitudes</h2>
              {pedi.length === 0 ? (
                <p style={{ color: '#64748b' }}>
                  No pediste ninguna interconsulta.{' '}
                  <button
                    className="link-button"
                    onClick={() => router.push('/panel-medico/mis-pacientes')}
                  >
                    Registra un paciente
                  </button>{' '}
                  para empezar.
                </p>
              ) : (
                <div className="grid">
                  {pedi.map((s) => (
                    <div key={s.id} className="card-flat">
                      <strong>
                        {s.patient_name} · {s.specialty_name}
                      </strong>
                      <p style={{ margin: '4px 0' }}>
                        <span className="badge">{ESTADO_LABEL[s.status] || s.status}</span>
                        {s.status === 'open' && (
                          <span style={{ color: '#64748b', fontSize: 13 }}>
                            {' '}
                            · se notificó a {s.notified_count}{' '}
                            {s.notified_count === 1 ? 'colega' : 'colegas'}
                          </span>
                        )}
                      </p>
                      <p>
                        <em>Motivo:</em> {s.chief_complaint}
                      </p>
                      {s.taken_by && (
                        <p>
                          <em>Tomada por:</em> {s.taken_by.full_name}
                          {s.taken_by.whatsapp_number && (
                            <>
                              {' · '}
                              <a
                                href={waLink(s.taken_by.whatsapp_number)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {s.taken_by.whatsapp_number}
                              </a>
                            </>
                          )}
                        </p>
                      )}
                      {s.mode === 'doctor' && s.target_doctor && !s.taken_by && (
                        <p style={{ color: '#64748b' }}>
                          <em>Enviada a:</em> {s.target_doctor.full_name}
                          {s.target_doctor.whatsapp_number
                            ? ` · ${s.target_doctor.whatsapp_number}`
                            : ''}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.status === 'open' && (
                          <button
                            className="btn btn-muted"
                            onClick={() => setPorCancelar(s)}
                            disabled={ocupado === s.id}
                          >
                            Retirar solicitud
                          </button>
                        )}
                        {/* Cerrar es del médico TRATANTE, nunca del especialista: por eso este
                            botón vive aquí y no en "Casos que tomé". */}
                        {s.status === 'taken' && (
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setNotaCierre('')
                              setPorCerrar(s)
                            }}
                            disabled={ocupado === s.id}
                          >
                            Cerrar caso
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={Boolean(porCancelar)}
        title="Retirar solicitud"
        message={
          <p>
            Dejará de aparecer para los especialistas. El caso de{' '}
            <strong>{porCancelar?.patient_name}</strong> seguirá en tus pacientes.
          </p>
        }
        confirmLabel="Retirar"
        onConfirm={cancelar}
        onCancel={() => setPorCancelar(null)}
        busy={Boolean(porCancelar && ocupado === porCancelar.id)}
        danger
      />

      <ConfirmDialog
        open={Boolean(porCerrar)}
        title="Cerrar caso"
        message={
          <>
            <p>
              Cierra la interconsulta de <strong>{porCerrar?.patient_name}</strong>. Cerrar es tuyo
              como médico tratante: el especialista no puede hacerlo.
            </p>
            <label htmlFor="nota-cierre">¿Cómo se resolvió? (opcional)</label>
            <textarea
              id="nota-cierre"
              rows={3}
              maxLength={2000}
              value={notaCierre}
              onChange={(e) => setNotaCierre(e.target.value)}
            />
          </>
        }
        confirmLabel="Cerrar caso"
        onConfirm={cerrar}
        onCancel={() => setPorCerrar(null)}
        busy={Boolean(porCerrar && ocupado === porCerrar.id)}
      />
    </>
  )
}
