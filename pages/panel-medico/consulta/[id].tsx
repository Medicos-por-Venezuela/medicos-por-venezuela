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
const PRESENCE_WINDOW_MS = 5 * 60 * 1000

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
    admin_update: 'Actualización administrativa'
  }
  return labels[type] || type
}

function fmtDateTime(value: string): string {
  return new Date(value).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ConsultaDetalle() {
  const router = useRouter()
  const consultationId = typeof router.query.id === 'string' ? router.query.id : null
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [events, setEvents] = useState<ConsultationEvent[]>([])
  const [eventAuthorsById, setEventAuthorsById] = useState<Record<string, EventAuthor>>({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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
      .select('*, patients(id, full_name, cedula, phone_whatsapp, affected_zone, age_range, needs_tags, description)')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error(error)
      setMessage('No se pudo cargar la consulta.')
      return
    }

    const row = data as Consultation
    const canView = isAdminRole(currentProfile?.role) || row.assigned_doctor_id === currentProfile?.id
    if (!canView) {
      router.replace('/panel-medico')
      return
    }

    setConsultation(row)
    setNote(row.internal_note || '')
    await loadEvents(id)
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

    const authorIds = Array.from(new Set(rows.map(e => e.created_by).filter((id): id is string => !!id)))
    if (authorIds.length === 0) {
      setEventAuthorsById({})
      return
    }

    const { data: authors } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', authorIds)

    setEventAuthorsById(Object.fromEntries(((authors || []) as EventAuthor[]).map(a => [a.id, a])))
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
    const { error } = await supabase.from('consultations').update({ internal_note: note }).eq('id', consultation.id)
    if (error) setMessage('No se pudo guardar la nota.')
    else setMessage('Nota guardada.')
  }

  async function closeConsultation(outcome: 'closed' | 'patient_no_show' = 'closed') {
    if (!consultation || !profile) return
    setMessage('')
    const noShow = outcome === 'patient_no_show'
    const { error } = await supabase
      .from('consultations')
      .update({ status: outcome, internal_note: note, closed_at: new Date().toISOString() })
      .eq('id', consultation.id)

    if (error) {
      setMessage(noShow ? 'No se pudo marcar como ausente.' : 'No se pudo cerrar la consulta.')
      return
    }

    await addEvent(
      consultation.id,
      noShow ? 'patient_no_show' : 'closed',
      noShow ? `Paciente no estaba en la sala de espera (${profile.full_name})` : `Cerrada por ${profile.full_name}`
    )
    router.push('/panel-medico?actualizado=1')
  }

  if (loading) {
    return <main className="page"><div className="container"><div className="card">Cargando...</div></div></main>
  }

  if (!consultation) {
    return (
      <main className="page">
        <div className="container">
          <div className="card">
            <p>{message || 'Consulta no encontrada.'}</p>
            <button className="btn btn-muted" onClick={() => router.push('/panel-medico')}>Volver al panel</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      <Head><title>Detalle de consulta — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="container">
          <div className="detail-topbar">
            <div>
              <button className="link-button" onClick={() => router.push('/panel-medico')}>← Volver al panel médico</button>
              <h1 style={{ margin: '8px 0 0' }}>Detalle de consulta</h1>
              <p style={{ margin: 0, color: '#64748b' }}>Caso {consultation.code} · hace {minutesSince(consultation.created_at)} min</p>
            </div>
            <span className={`badge ${statusBadgeClass(consultation.status)}`}>{STATUS_LABELS[consultation.status] || consultation.status}</span>
          </div>

          {message && <div className="notice notice-info" style={{ marginBottom: 16 }}>{message}</div>}

          <div className="detail-grid">
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Paciente</h2>
              <h3 style={{ marginBottom: 4 }}>{consultation.patients?.full_name || 'Paciente'}</h3>
              <p style={{ marginTop: 0, color: '#64748b' }}>{consultation.patients?.affected_zone || 'Zona no indicada'} · {consultation.patients?.age_range || 'Edad no indicada'}</p>
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>Cédula: {consultation.patients?.cedula || '—'}</p>
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>Tel. (solo seguimiento): {consultation.patients?.phone_whatsapp || '—'}</p>
              <div style={{ marginTop: 10 }}>
                {isPatientPresent(consultation)
                  ? <span className="badge badge-green">● En sala</span>
                  : <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>○ Sin conexión</span>}
              </div>
              <div className="tag-row" style={{ marginTop: 12 }}>
                {consultation.patients?.needs_tags?.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Motivo</h2>
              <div className="notice">
                {consultation.chief_complaint || consultation.patients?.description || 'Sin descripción'}
              </div>
              {consultation.category && <p style={{ color: '#64748b' }}>Tipo de ayuda: {consultation.category}</p>}
              {consultation.referred_specialty && (
                <p><span className="badge badge-blue">Derivado a {consultation.referred_specialty}</span></p>
              )}
            </section>

            <section className="card detail-full-span">
              <h2 style={{ marginTop: 0 }}>Referencia y trazabilidad</h2>
              <div className="detail-timeline">
                <div className="notice">
                  <strong>Estado actual:</strong> {STATUS_LABELS[consultation.status] || consultation.status}<br />
                  <strong>Especialidad referida:</strong> {consultation.referred_specialty || '—'}
                  {events[0]?.note && <><br /><strong>Última nota:</strong> {events[0].note}</>}
                </div>

                {events.length === 0 ? (
                  <p style={{ color: '#64748b', margin: 0 }}>Todavía no hay historial registrado para este caso.</p>
                ) : (
                  <div className="grid">
                    {events.map(event => {
                      const author = event.created_by ? eventAuthorsById[event.created_by] : null
                      return (
                        <div key={event.id} className="card-flat">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <strong>{eventLabel(event.event_type)}</strong>
                            <span style={{ color: '#64748b', fontSize: 13 }}>{fmtDateTime(event.created_at)}</span>
                          </div>
                          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>
                            Por {author?.full_name || 'usuario del sistema'}{author?.role ? ` · ${author.role}` : ''}
                          </p>
                          {event.note && <p style={{ marginBottom: 0 }}>{event.note}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="card detail-full-span">
              <h2 style={{ marginTop: 0 }}>Gestión de la consulta</h2>
              <div className="detail-actions">
                <div>
                  <label className="label">Nota operativa interna</label>
                  <textarea rows={6} value={note} onChange={e => setNote(e.target.value)} placeholder="Evita escribir historia clínica completa. Solo información necesaria para coordinación." />
                </div>
                {consultation.video_room_url && (
                  <a className="btn btn-primary" href={consultation.video_room_url} target="_blank" rel="noreferrer">
                    Unirse a videoconsulta
                  </a>
                )}
                <button className="btn btn-secondary" onClick={saveNote}>Guardar nota</button>
                <button className="btn btn-primary btn-full" onClick={() => closeConsultation('closed')}>Cerrar consulta</button>
                <button className="btn btn-outline btn-full" onClick={() => closeConsultation('patient_no_show')}>Paciente no estaba en la sala de espera</button>
              </div>
            </section>
          </div>
        </div>
      </main>

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
          gap: 16px;
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
          }
        }
      `}</style>
    </>
  )
}
