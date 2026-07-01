import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { STATUS_LABELS, minutesSince } from '../../../lib/utils'

type Patient = {
  id: string
  full_name: string
  cedula: string | null
  phone_whatsapp: string
  email: string | null
  affected_zone: string
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
}

type Consultation = {
  id: string
  code: string
  status: string
  priority: string
  category: string | null
  chief_complaint: string | null
  created_at: string
  opened_at: string | null
  closed_at: string | null
  referred_specialty: string | null
  internal_note: string | null
  video_room_url: string | null
  patient_last_seen_at: string | null
  assigned_doctor_id: string | null
  attended_via_whatsapp: boolean
  patients: Patient | null
}

type Profile = {
  id: string
  full_name: string
  role: string
  specialty: string | null
  verified: boolean
  active: boolean
}

type ConsultationEvent = {
  id: string
  event_type: string
  created_by: string | null
  note: string | null
  created_at: string
}

type EventAuthor = Pick<Profile, 'id' | 'full_name' | 'role'>

const ADMIN_ROLES = ['admin', 'super_admin'] as const
const PANEL_ALLOWED_ROLES = ['doctor', 'specialist', ...ADMIN_ROLES] as const
const PRESENCE_WINDOW_MS = 30 * 60 * 1000 // generous; see note in panel-medico.tsx

// Case status options the attending doctor can set from "Gestión de la consulta".
const DOCTOR_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'in_progress', label: 'Abierta' },
  { value: 'contacted_whatsapp', label: 'Ya contactado vía WhatsApp' },
  { value: 'referred_to_specialist', label: 'Referenciado a otro médico' },
  { value: 'urgent_in_person', label: 'Necesita ir a centro de atención' },
  { value: 'patient_no_show', label: 'Paciente no se presentó' },
  { value: 'closed', label: 'Cerrado' }
]

function isAdminRole(role?: string | null): boolean {
  return !!role && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])
}

function isPatientPresent(c: Consultation): boolean {
  if (!c.patient_last_seen_at) return false
  return Date.now() - new Date(c.patient_last_seen_at).getTime() < PRESENCE_WINDOW_MS
}

function statusBadgeClass(status: string): string {
  if (status === 'urgent_in_person') return 'badge-red'
  if (status === 'referred_to_specialist') return 'badge-blue'
  if (status === 'in_progress') return 'badge-orange'
  return 'badge-green'
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    opened: 'Consulta abierta',
    closed: 'Consulta cerrada',
    patient_no_show: 'Paciente ausente',
    admin_update: 'Actualización administrativa',
    patient_entered_call: 'Paciente ingresó a la videollamada',
    patient_wants_whatsapp: 'Paciente prefirió ser contactado por WhatsApp'
  }
  return labels[type] || type
}

function fmtDateTime(value: string): string {
  // Always render in Venezuela time (America/Caracas), regardless of the viewer's browser timezone.
  return new Date(value).toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Caracas'
  })
}

export default function ConsultaDetalle() {
  const router = useRouter()
  const consultationId = typeof router.query.id === 'string' ? router.query.id : null
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [events, setEvents] = useState<ConsultationEvent[]>([])
  const [eventAuthorsById, setEventAuthorsById] = useState<Record<string, EventAuthor>>({})
  const [assignedDoctor, setAssignedDoctor] = useState<EventAuthor | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [problemOpen, setProblemOpen] = useState(false)

  useEffect(() => {
    if (!consultationId) return
    init(consultationId)
  }, [consultationId])

  async function init(id: string) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login-medico')
      return
    }

    const { data: p, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, specialty, verified, active')
      .eq('id', sessionData.session.user.id)
      .single()

    if (profileError || !p || !p.active || !p.verified) {
      await supabase.auth.signOut()
      router.push('/login-medico')
      return
    }

    if (!PANEL_ALLOWED_ROLES.includes(p.role as (typeof PANEL_ALLOWED_ROLES)[number])) {
      router.push('/')
      return
    }

    setProfile(p)
    await loadConsultation(id, p)
    setLoading(false)
  }

  async function loadConsultation(id: string, currentProfile: Profile | null = profile) {
    const { data, error } = await supabase
      .from('consultations')
      .select(
        '*, patients(id, full_name, cedula, phone_whatsapp, email, affected_zone, age_range, needs_tags, description)'
      )
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error(error)
      setMessage('No se pudo cargar la consulta.')
      return
    }

    const row = data as Consultation
    const canView =
      isAdminRole(currentProfile?.role) || row.assigned_doctor_id === currentProfile?.id
    if (!canView) {
      router.replace('/panel-medico')
      return
    }

    setConsultation(row)
    setNote(row.internal_note || '')
    await Promise.all([loadAssignedDoctor(row, currentProfile), loadEvents(id)])
  }

  async function loadAssignedDoctor(row: Consultation, currentProfile: Profile | null = profile) {
    if (!row.assigned_doctor_id) {
      setAssignedDoctor(null)
      return
    }

    if (row.assigned_doctor_id === currentProfile?.id) {
      setAssignedDoctor({
        id: currentProfile.id,
        full_name: currentProfile.full_name,
        role: currentProfile.role
      })
      return
    }

    if (!isAdminRole(currentProfile?.role)) {
      setAssignedDoctor(null)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', row.assigned_doctor_id)
      .single()

    setAssignedDoctor((data as EventAuthor | null) || null)
  }

  async function loadEvents(consultationId: string) {
    const { data, error } = await supabase
      .from('consultation_events')
      .select('id, event_type, created_by, note, created_at')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setEvents([])
      setEventAuthorsById({})
      return
    }

    const rows = (data || []) as ConsultationEvent[]
    setEvents(rows)

    const authorIds = Array.from(
      new Set(rows.map((e) => e.created_by).filter((id): id is string => !!id))
    )
    if (authorIds.length === 0) {
      setEventAuthorsById({})
      return
    }

    const { data: authors } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', authorIds)

    setEventAuthorsById(
      Object.fromEntries(((authors || []) as EventAuthor[]).map((a) => [a.id, a]))
    )
  }

  async function addEvent(consultationId: string, eventType: string, eventNote?: string) {
    await supabase.from('consultation_events').insert({
      consultation_id: consultationId,
      event_type: eventType,
      note: eventNote || null
    })
  }

  async function saveNote() {
    if (!consultation) return
    setMessage('')
    const { error } = await supabase
      .from('consultations')
      .update({ internal_note: note })
      .eq('id', consultation.id)
    if (error) setMessage('No se pudo guardar la nota.')
    else setMessage('Nota guardada.')
  }

  // Change the case status from the WhatsApp status dropdown (no video / close-button flow).
  async function updateStatus(newStatus: string) {
    if (!consultation || !profile) return
    setMessage('')
    const isTerminal = ['closed', 'closed_by_admin', 'patient_no_show'].includes(newStatus)
    const { error } = await supabase
      .from('consultations')
      .update({
        status: newStatus,
        ...(isTerminal ? { closed_at: new Date().toISOString() } : {})
      })
      .eq('id', consultation.id)
    if (error) {
      setMessage('No se pudo actualizar el estado.')
      return
    }
    setConsultation({ ...consultation, status: newStatus })
    await addEvent(
      consultation.id,
      'admin_update',
      `Estado: ${STATUS_LABELS[newStatus] || newStatus} (${profile.full_name})`
    )
    setMessage('Estado actualizado.')
  }

  if (loading) {
    return (
      <main className="page">
        <div className="container">
          <div className="card">Cargando...</div>
        </div>
      </main>
    )
  }

  if (!consultation) {
    return (
      <main className="page">
        <div className="container">
          <div className="card">
            <p>{message || 'Consulta no encontrada.'}</p>
            <button className="btn btn-muted" onClick={() => router.push('/panel-medico')}>
              Volver al panel
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      <Head>
        <title>Detalle de consulta — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="container">
          <div className="detail-topbar">
            <div>
              <button className="link-button" onClick={() => router.push('/panel-medico')}>
                ← Volver al panel médico
              </button>
              <h1 style={{ margin: '8px 0 0' }}>Detalle de consulta</h1>
              <p style={{ margin: 0, color: '#64748b' }}>
                Caso {consultation.code} · hace {minutesSince(consultation.created_at)} min
              </p>
            </div>
            <div style={{ textAlign: 'right', maxWidth: 280 }}>
              <span className={`badge ${statusBadgeClass(consultation.status)}`}>
                {STATUS_LABELS[consultation.status] || consultation.status}
              </span>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setProblemOpen(true)}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#b91c1c',
                    background: 'var(--red-light)',
                    border: '1px solid #fca5a5',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer'
                  }}
                >
                  Tengo un problema
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          <div className="detail-grid">
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Paciente</h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 4
                }}
              >
                <h3 style={{ margin: 0 }}>{consultation.patients?.full_name || 'Paciente'}</h3>
                {consultation.category && (
                  <span
                    className="badge"
                    style={{
                      background: '#eef2ff',
                      color: '#4338ca',
                      border: '1px solid #c7d2fe'
                    }}
                  >
                    {consultation.category}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  margin: '8px 0',
                  color: '#0f172a'
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Zona</div>
                  <div style={{ fontSize: 14 }}>{consultation.patients?.affected_zone || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Edad (años)</div>
                  <div style={{ fontSize: 14 }}>{consultation.patients?.age_range || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Cédula</div>
                  <div style={{ fontSize: 14 }}>{consultation.patients?.cedula || '—'}</div>
                </div>
              </div>
              <div style={{ margin: '10px 0' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                  Tel. (WhatsApp)
                </div>
                {consultation.patients?.phone_whatsapp ? (
                  <a
                    href={`https://wa.me/${consultation.patients.phone_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#fff',
                      background: '#16a34a',
                      borderRadius: 8,
                      padding: '8px 14px',
                      textDecoration: 'none',
                      wordBreak: 'break-all'
                    }}
                  >
                    <span aria-hidden="true">💬</span>
                    {consultation.patients.phone_whatsapp}
                  </a>
                ) : (
                  <span style={{ color: '#64748b', fontSize: 13 }}>—</span>
                )}
              </div>
              <ul
                style={{
                  margin: '4px 0 0',
                  paddingLeft: 16,
                  color: '#b91c1c',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.4
                }}
              >
                <li>
                  De ser posible por favor contacta al paciente vía WhatsApp intentando agendar una
                  llamada y asegurar así una mejor conexión con el paciente.
                </li>
                <li>Por favor espera hasta 24 horas por una respuesta del paciente.</li>
                <li>
                  Si no hay respuesta alguna o el contacto es incorrecto, coméntalo en las notas
                  médicas.
                </li>
              </ul>
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>
                Email (opcional): {consultation.patients?.email || '—'}
              </p>
              <div style={{ marginTop: 10 }}>
                {isPatientPresent(consultation) ? (
                  <span className="badge badge-green">● En sala</span>
                ) : (
                  <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>
                    ○ Sin conexión
                  </span>
                )}
              </div>
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Motivo</h2>
              <div className="notice">
                {consultation.chief_complaint ||
                  consultation.patients?.description ||
                  'Sin descripción'}
              </div>
              {consultation.patients?.needs_tags && consultation.patients.needs_tags.length > 0 && (
                <div className="tag-row" style={{ marginTop: 12 }}>
                  {consultation.patients.needs_tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {consultation.referred_specialty && (
                <p>
                  <span className="badge badge-blue">
                    Derivado a {consultation.referred_specialty}
                  </span>
                </p>
              )}
            </section>

            <section className="card detail-full-span">
              <h2 style={{ marginTop: 0 }}>Gestión de la consulta</h2>
              <div className="detail-actions">
                <div>
                  <label className="label">Estado del caso</label>
                  <select
                    value={consultation.status}
                    onChange={(e) => updateStatus(e.target.value)}
                  >
                    {DOCTOR_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Notas del médico</label>
                  <textarea
                    rows={6}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Evita escribir historia clínica completa. Solo información necesaria para coordinación."
                  />
                </div>
                <button className="btn btn-secondary" onClick={saveNote}>
                  Guardar nota
                </button>
              </div>
            </section>

            <section className="card detail-full-span">
              <h2 style={{ marginTop: 0 }}>Referencia y trazabilidad</h2>
              <div className="detail-timeline">
                <div className="notice">
                  <strong>Estado actual:</strong>{' '}
                  {STATUS_LABELS[consultation.status] || consultation.status}
                  <br />
                  <strong>Médico asignado:</strong>{' '}
                  {assignedDoctor?.full_name ||
                    (consultation.assigned_doctor_id ? 'Médico asignado' : 'Sin asignar')}
                  <br />
                  <strong>Especialidad referida:</strong> {consultation.referred_specialty || '—'}
                  {events[0]?.note && (
                    <>
                      <br />
                      <strong>Última nota:</strong> {events[0].note}
                    </>
                  )}
                </div>

                {events.length === 0 ? (
                  <p style={{ color: '#64748b', margin: 0 }}>
                    Todavía no hay historial registrado para este caso.
                  </p>
                ) : (
                  <div>
                    {events.map((event, i) => {
                      const author = event.created_by ? eventAuthorsById[event.created_by] : null
                      return (
                        <div
                          key={event.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '8px 0',
                            borderTop: i === 0 ? 'none' : '1px solid var(--border)'
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <strong>{eventLabel(event.event_type)}</strong>
                            {event.note && (
                              <span style={{ color: '#475569' }}> — {event.note}</span>
                            )}
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>
                              {' · '}
                              {author?.full_name || 'usuario del sistema'}
                              {author?.role ? ` (${author.role})` : ''}
                            </span>
                          </div>
                          <span style={{ color: '#64748b', fontSize: 13, whiteSpace: 'nowrap' }}>
                            {fmtDateTime(event.created_at)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {problemOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setProblemOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: '100%' }}
          >
            <h2 style={{ marginTop: 0 }}>¿Tienes un problema?</h2>
            <p style={{ marginBottom: 20 }}>
              Si tienes problemas con este caso, por favor contáctanos vía{' '}
              <strong>+4915203003171</strong> en WhatsApp.
            </p>
            <button className="btn btn-primary btn-full" onClick={() => setProblemOpen(false)}>
              Entendido
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .detail-topbar {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
        }

        .detail-grid,
        .detail-actions,
        .detail-timeline {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }

        .detail-grid .card {
          margin: 0;
        }

        .detail-full-span {
          grid-column: 1 / -1;
        }

        @media (min-width: 640px) {
          .detail-topbar {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
        }

        @media (min-width: 900px) {
          .detail-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px;
          }
        }
      `}</style>
    </>
  )
}
