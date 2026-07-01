import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, canAttend, matchesSpecialty, minutesSince } from '../lib/utils'
import { browserRoomUrl } from '../lib/jitsi'

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
  entered_call_at: string | null
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

// A patient surfaces in the "no han podido ser atendidos" queue once they've been waiting at least
// this many minutes without a doctor assigned.
const WAITING_FALLBACK_MIN = 20

// "Still open" case statuses = not yet resolved. Includes patient_no_show (the patient registered
// but never connected to the video call, so they still need follow-up) but excludes the truly
// resolved statuses (closed, closed_by_admin, cancelled).
const OPEN_STATUSES = [
  'waiting',
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'contacted_whatsapp',
  'patient_no_show'
]

const PATIENT_COLS =
  'id, full_name, cedula, phone_whatsapp, affected_zone, age_range, needs_tags, description'

function statusBadgeClass(status: string): string {
  if (status === 'urgent_in_person') return 'badge-red'
  if (status === 'referred_to_specialist') return 'badge-blue'
  if (status === 'in_progress') return 'badge-orange'
  return 'badge-green'
}

const ADMIN_ROLES = ['admin', 'super_admin'] as const
const PANEL_ALLOWED_ROLES = ['doctor', 'specialist', ...ADMIN_ROLES] as const

function isAdminRole(role?: string | null): boolean {
  return !!role && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])
}

type Profile = {
  id: string
  full_name: string
  role: string
  specialty: string | null
  verified: boolean
  active: boolean
}

export default function PanelMedico() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [myClosed, setMyClosed] = useState(0)
  // Waiting case the doctor wants to attend via WhatsApp — set while the commitment modal is open.
  const [whatsappTarget, setWhatsappTarget] = useState<Consultation | null>(null)
  const isCurrentUserAdmin = isAdminRole(profile?.role)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!router.isReady || !profile?.id || router.query.actualizado !== '1') return
    loadConsultations(profile)
    setMessage('Panel actualizado.')
    router.replace('/panel-medico', undefined, { shallow: true })
  }, [router.isReady, router.query.actualizado, profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    const updateOnline = async () => {
      await supabase.rpc('mark_myself_online')
    }
    updateOnline()
    const timer = window.setInterval(updateOnline, 60000)
    return () => window.clearInterval(timer)
  }, [profile?.id])

  // Poll the queue so patient presence (and cases claimed by other doctors) stay fresh.
  useEffect(() => {
    if (!profile?.id) return
    const timer = window.setInterval(() => {
      loadConsultations(profile)
    }, 20000)
    return () => window.clearInterval(timer)
  }, [profile])

  // Refresh when returning to this tab/page after actions performed in the detail page.
  useEffect(() => {
    if (!profile?.id) return
    const refresh = () => {
      loadConsultations(profile)
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [profile])

  async function init() {
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
    await loadConsultations(p)
    setLoading(false)
  }

  async function loadConsultations(currentProfile: Profile | null = profile) {
    const twentyMinAgo = new Date(Date.now() - WAITING_FALLBACK_MIN * 60000).toISOString()

    // "Pacientes que no han podido ser atendidos": three filters, all in the DB so a large backlog
    // can't push recent patients past the row cap — (1) case still open (not resolved), (2) not
    // assigned to any doctor, (3) waiting longer than WAITING_FALLBACK_MIN minutes.
    const { data: unattended, error } = await supabase
      .from('consultations')
      .select(`*, patients(${PATIENT_COLS})`)
      .in('status', OPEN_STATUSES)
      .is('assigned_doctor_id', null)
      .lte('created_at', twentyMinAgo)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      setMessage('No se pudieron cargar las consultas.')
      return
    }

    // The doctor's own open cases, fetched separately so the cap can't drop them either.
    const id = currentProfile?.id
    let mine: Consultation[] = []
    if (id) {
      const { data: mineData } = await supabase
        .from('consultations')
        .select(`*, patients(${PATIENT_COLS})`)
        .eq('assigned_doctor_id', id)
        .in('status', ['in_progress', 'contacted_whatsapp'])
        .order('created_at', { ascending: true })
      mine = (mineData || []) as Consultation[]
    }

    setConsultations([...((unattended || []) as Consultation[]), ...mine])

    // How many cases this doctor has closed.
    if (id) {
      const { count } = await supabase
        .from('consultations')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_doctor_id', id)
        .eq('status', 'closed')
      setMyClosed(count || 0)
    }
  }

  // "Pacientes que no han podido ser atendidos hasta ahora": registered cases not assigned to any
  // doctor, waiting longer than WAITING_FALLBACK_MIN minutes. (The DB query already enforces this;
  // the client filter keeps it correct as time passes between refreshes.)
  const waiting = useMemo(
    () =>
      consultations.filter(
        (c) => c.assigned_doctor_id === null && minutesSince(c.created_at) >= WAITING_FALLBACK_MIN
      ),
    [consultations]
  )
  // The doctor's own active cases they can reopen: in-progress ones plus WhatsApp cases already
  // marked "Ya contactado vía WhatsApp" (which otherwise would drop off the panel). Only the
  // attending doctor sees them here.
  const myOpenConsultations = useMemo(
    () =>
      consultations.filter(
        (c) =>
          c.assigned_doctor_id === profile?.id &&
          (c.status === 'in_progress' || c.status === 'contacted_whatsapp')
      ),
    [consultations, profile?.id]
  )
  // Waiting patients that align with this doctor's specialty (and that they're allowed to take).
  const mySpecialtyWaiting = useMemo(
    () =>
      waiting.filter(
        (c) =>
          isCurrentUserAdmin ||
          (canAttend(profile?.specialty, c.category, c.patients?.needs_tags || null) &&
            matchesSpecialty(profile?.specialty, c.category, c.patients?.needs_tags || null))
      ),
    [waiting, profile?.specialty, isCurrentUserAdmin]
  )
  // Everyone — including admins/super_admins — sees /panel-medico as a doctor: the waiting queue and
  // their own open cases, no admin-only "system cases" section.
  const kpis = [
    { value: waiting.length, label: 'Pacientes esperando' },
    { value: mySpecialtyWaiting.length, label: 'Esperando para tu especialidad' },
    { value: myClosed, label: 'Consultas cerradas por mí' }
  ]

  const waitingEmptyMessage =
    'No hay pacientes nuevos en cola (waiting). Si ya tomaste un caso, aparecerá en “Mis consultas abiertas”.'

  async function addEvent(consultationId: string, eventType: string, eventNote?: string) {
    await supabase.from('consultation_events').insert({
      consultation_id: consultationId,
      event_type: eventType,
      note: eventNote || null
    })
  }

  async function openConsultation(c: Consultation) {
    if (!profile) return
    const now = new Date().toISOString()
    // Atomic claim: the update only matches while the case is still unassigned, so if another
    // doctor grabbed it first it returns 0 rows. We must NOT open the video room in that case,
    // otherwise two doctors could land in the same meeting.
    const { data: claimed, error } = await supabase
      .from('consultations')
      .update({
        status: 'in_progress',
        assigned_doctor_id: profile.id,
        opened_at: c.opened_at || now
      })
      .eq('id', c.id)
      .is('assigned_doctor_id', null)
      .select('id')

    if (error) {
      setMessage('No se pudo abrir la consulta.')
      return
    }
    if (!claimed || claimed.length === 0) {
      setMessage('Este paciente ya fue tomado por otro médico.')
      await loadConsultations()
      return
    }

    await addEvent(c.id, 'opened', `Abierta por ${profile.full_name}`)
    if (c.video_room_url) window.open(browserRoomUrl(c.video_room_url), '_blank')
    await router.push(`/panel-medico/consulta/${c.id}`)
  }

  // Claim a waiting patient to attend directly via WhatsApp (no video). Same atomic claim as
  // openConsultation: the update only matches while the case is 'waiting', so if another doctor took
  // it first we show "Ya fue asignado a otro doctor" instead. Runs only after the doctor accepts the
  // commitment modal.
  async function attendViaWhatsapp(c: Consultation) {
    if (!profile) return
    const now = new Date().toISOString()
    const { data: claimed, error } = await supabase
      .from('consultations')
      .update({
        status: 'in_progress',
        assigned_doctor_id: profile.id,
        opened_at: c.opened_at || now,
        attended_via_whatsapp: true
      })
      .eq('id', c.id)
      .is('assigned_doctor_id', null)
      .select('id')

    setWhatsappTarget(null)
    if (error) {
      setMessage('No se pudo asignar la consulta.')
      return
    }
    if (!claimed || claimed.length === 0) {
      setMessage('Ya fue asignado a otro doctor.')
      await loadConsultations()
      return
    }
    await addEvent(c.id, 'opened', `Atendido vía WhatsApp por ${profile.full_name}`)
    await router.push(`/panel-medico/consulta/${c.id}`)
  }

  // Take the next waiting patient: prefer one matching the doctor's specialty (oldest first),
  // otherwise fall back to the oldest waiting patient so nobody is left unattended.
  async function attendNext() {
    setMessage('')

    const eligible = waiting.filter(
      (c) =>
        isCurrentUserAdmin ||
        canAttend(profile?.specialty, c.category, c.patients?.needs_tags || null)
    )

    if (eligible.length === 0) {
      setMessage(
        waiting.length ? 'No hay pacientes para tu especialidad ahora.' : waitingEmptyMessage
      )
      return
    }

    const pool = eligible

    const next = isCurrentUserAdmin
      ? pool[0]
      : pool.find((c) =>
          matchesSpecialty(profile?.specialty, c.category, c.patients?.needs_tags || null)
        ) || pool[0]

    await openConsultation(next)
  }
  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
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

  return (
    <>
      <Head>
        <title>Panel médico — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="container">
          <div className="panel-topbar">
            <div>
              <h1 style={{ margin: 0 }}>{profile?.full_name}</h1>
              <p style={{ margin: 0, color: '#64748b' }}>
                {isCurrentUserAdmin ? 'Administrador' : profile?.specialty || 'Sin especialidad'} ·{' '}
                <span className="badge badge-green">Activo</span>
              </p>
            </div>
            <div className="panel-actions">
              {isCurrentUserAdmin && (
                <button className="btn btn-outline" onClick={() => router.push('/admin/dashboard')}>
                  Panel admin
                </button>
              )}
              <button className="btn btn-muted" onClick={logout}>
                Salir
              </button>
            </div>
          </div>

          {message && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          <div className="panel-kpis">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="kpi">
                <div className="kpi-value">{kpi.value}</div>
                <div className="kpi-label">{kpi.label}</div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary btn-full"
            style={{ marginBottom: 18, fontSize: 16, padding: '15px 18px' }}
            onClick={attendNext}
            disabled={waiting.length === 0}
          >
            {waiting.length
              ? `Atender al siguiente paciente · ${waiting.length} esperando`
              : 'No hay pacientes nuevos en cola'}
          </button>

          <div className="panel-sections">
            <section className="card">
              <h2>Mis consultas abiertas</h2>

              {myOpenConsultations.length === 0 ? (
                <p style={{ color: '#64748b' }}>No tienes consultas abiertas.</p>
              ) : (
                <div className="grid">
                  {myOpenConsultations.map((c) => (
                    <div key={c.id} className="card-flat">
                      <strong>{c.patients?.full_name || 'Paciente'}</strong>
                      <p>{c.chief_complaint || c.patients?.description || 'Sin descripción'}</p>

                      <button
                        className="btn btn-primary btn-full"
                        onClick={() => router.push(`/panel-medico/consulta/${c.id}`)}
                      >
                        Continuar / cerrar consulta
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card">
              <h2 style={{ marginTop: 0 }}>
                Pacientes que no han podido ser atendidos hasta ahora
              </h2>
              {waiting.length === 0 ? (
                <p style={{ color: '#64748b' }}>{waitingEmptyMessage}</p>
              ) : (
                <div className="grid">
                  {waiting.map((c) => (
                    <ConsultationCard key={c.id} c={c} onWhatsapp={() => setWhatsappTarget(c)} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {whatsappTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setWhatsappTarget(null)}
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
            style={{ maxWidth: 460, width: '100%' }}
          >
            <h2 style={{ marginTop: 0 }}>Atender vía WhatsApp</h2>
            <p>
              Al cliquear aquí te comprometes a contactar al paciente vía WhatsApp con el número
              disponible, de no ser posible por favor contacta a nuestro equipo al{' '}
              <strong>+4915203003171</strong>.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => attendViaWhatsapp(whatsappTarget)}
              >
                Aceptar
              </button>
              <button
                className="btn btn-muted"
                style={{ flex: 1 }}
                onClick={() => setWhatsappTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .panel-topbar {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          margin-bottom: 18px;
        }

        .panel-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .panel-kpis,
        .panel-sections {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .panel-kpis {
          gap: 12px;
          margin-bottom: 18px;
        }

        .panel-full-span {
          grid-column: 1 / -1;
        }

        .panel-card-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }

        @media (min-width: 640px) {
          .panel-topbar {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }

          .panel-actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .panel-kpis {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .panel-card-header {
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
          }
        }

        @media (min-width: 900px) {
          .panel-sections {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </>
  )
}

function ConsultationCard({ c, onWhatsapp }: { c: Consultation; onWhatsapp: () => void }) {
  return (
    <div className="card-flat">
      <div className="panel-card-header">
        <div>
          <strong>{c.patients?.full_name || 'Paciente'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            {c.patients?.affected_zone} · hace {minutesSince(c.created_at)} min
          </div>
          <div style={{ marginTop: 4 }}>
            <span className="badge badge-green">● Disponible</span>
          </div>
        </div>
        <span className={`badge ${statusBadgeClass(c.status)}`}>
          {STATUS_LABELS[c.status] || c.status}
        </span>
      </div>
      <p>{c.chief_complaint || c.patients?.description || 'Sin descripción'}</p>
      {c.referred_specialty && (
        <p>
          <span className="badge badge-blue">{c.referred_specialty}</span>
        </p>
      )}
      <div className="tag-row" style={{ marginBottom: 12 }}>
        {c.patients?.needs_tags?.slice(0, 4).map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <button className="btn btn-primary btn-full" onClick={onWhatsapp}>
        Puedo atender a este paciente vía WhatsApp con mi número personal
      </button>
    </div>
  )
}
