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

// A patient counts as "in the waiting room" if their /sala-espera page pinged within this window.
// It's generous (30 min) on purpose: once a patient enters the Jitsi call the /sala-espera tab is
// backgrounded/suspended and stops pinging, so a short window would grey out patients who are
// actually in the call waiting for a doctor.
const PRESENCE_WINDOW_MS = 30 * 60 * 1000
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

type AssignedDoctor = Pick<Profile, 'id' | 'full_name' | 'role' | 'specialty'>

export default function PanelMedico() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [myClosed, setMyClosed] = useState(0)
  const [assignedDoctorsById, setAssignedDoctorsById] = useState<Record<string, AssignedDoctor>>({})
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
    const { data, error } = await supabase
      .from('consultations')
      .select(
        '*, patients(id, full_name, cedula, phone_whatsapp, affected_zone, age_range, needs_tags, description)'
      )
      .in('status', ['waiting', 'in_progress', 'referred_to_specialist', 'urgent_in_person'])
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      setMessage('No se pudieron cargar las consultas.')
      return
    }
    const rows = (data || []) as Consultation[]
    setConsultations(rows)

    if (isAdminRole(currentProfile?.role)) {
      const assignedIds = Array.from(
        new Set(rows.map((c) => c.assigned_doctor_id).filter((id): id is string => !!id))
      )
      if (assignedIds.length > 0) {
        const { data: doctors, error: doctorsError } = await supabase
          .from('profiles')
          .select('id, full_name, role, specialty')
          .in('id', assignedIds)

        if (doctorsError) {
          console.error(doctorsError)
          setAssignedDoctorsById({})
        } else {
          setAssignedDoctorsById(
            Object.fromEntries(((doctors || []) as AssignedDoctor[]).map((d) => [d.id, d]))
          )
        }
      } else {
        setAssignedDoctorsById({})
      }
    } else {
      setAssignedDoctorsById({})
    }

    // How many cases this doctor has closed.
    const id = currentProfile?.id
    if (id) {
      const { count } = await supabase
        .from('consultations')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_doctor_id', id)
        .eq('status', 'closed')
      setMyClosed(count || 0)
    }
  }

  const waiting = useMemo(
    () => consultations.filter((c) => c.status === 'waiting'),
    [consultations]
  )
  const activeSystemConsultations = useMemo(
    () =>
      consultations.filter((c) =>
        ['in_progress', 'urgent_in_person', 'referred_to_specialist'].includes(c.status)
      ),
    [consultations]
  )
  const myOpenConsultations = useMemo(
    () =>
      consultations.filter(
        (c) => c.status === 'in_progress' && c.assigned_doctor_id === profile?.id
      ),
    [consultations, profile?.id]
  )
  // Only patients whose waiting-room page is still pinging count as actually present in the queue.
  const waitingPresent = useMemo(() => waiting.filter(isPatientPresent), [waiting])
  // Present waiting patients that align with this doctor's specialty (and that they're allowed to take).
  const mySpecialtyWaiting = useMemo(
    () =>
      waitingPresent.filter(
        (c) =>
          isCurrentUserAdmin ||
          (canAttend(profile?.specialty, c.category, c.patients?.needs_tags || null) &&
            matchesSpecialty(profile?.specialty, c.category, c.patients?.needs_tags || null))
      ),
    [waitingPresent, profile?.specialty, isCurrentUserAdmin]
  )
  const kpis = isCurrentUserAdmin
    ? [
        { value: waitingPresent.length, label: 'En sala esperando ahora' },
        { value: waiting.length, label: 'Nuevos en cola (waiting)' },
        { value: activeSystemConsultations.length, label: 'Casos activos del sistema' }
      ]
    : [
        { value: waitingPresent.length, label: 'En sala esperando ahora' },
        { value: mySpecialtyWaiting.length, label: 'En sala asignados a esta especialidad' },
        { value: myClosed, label: 'Consultas cerradas por mí' }
      ]

  const waitingEmptyMessage = isCurrentUserAdmin
    ? activeSystemConsultations.length > 0
      ? 'No hay pacientes nuevos en cola (waiting). Hay casos activos del sistema abajo.'
      : 'No hay pacientes nuevos en cola (waiting) ni casos activos del sistema.'
    : 'No hay pacientes nuevos en cola (waiting). Si ya tomaste un caso, aparecerá en “Mis consultas abiertas”.'

  function assignmentLabel(c: Consultation): string {
    if (!c.assigned_doctor_id) return 'Sin asignar'
    if (c.assigned_doctor_id === profile?.id) return 'Asignado a ti'
    const doctor = assignedDoctorsById[c.assigned_doctor_id]
    return doctor ? `Asignado a ${doctor.full_name}` : 'Asignado a otro médico'
  }

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
    // Atomic claim: the update only matches while the case is still 'waiting', so if another
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
      .eq('status', 'waiting')
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
      .eq('status', 'waiting')
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

    // Preferimos pacientes detectados como presentes, pero si el heartbeat falló,
    // igual permitimos atender casos que están en waiting.
    const presentEligible = eligible.filter(isPatientPresent)
    const pool = presentEligible.length > 0 ? presentEligible : eligible

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
              <h2 style={{ marginTop: 0 }}>Consultas disponibles</h2>
              {waiting.length === 0 ? (
                <p style={{ color: '#64748b' }}>{waitingEmptyMessage}</p>
              ) : (
                <div className="grid">
                  {waiting.map((c) => (
                    <ConsultationCard
                      key={c.id}
                      c={c}
                      onOpen={() => openConsultation(c)}
                      onWhatsapp={() => setWhatsappTarget(c)}
                    />
                  ))}
                </div>
              )}
            </section>

            {isCurrentUserAdmin && (
              <section className="card panel-full-span">
                <h2 style={{ marginTop: 0 }}>Casos activos del sistema</h2>
                {activeSystemConsultations.length === 0 ? (
                  <p style={{ color: '#64748b' }}>
                    No hay casos activos en progreso, derivados o marcados como urgentes
                    presenciales.
                  </p>
                ) : (
                  <div className="grid">
                    {activeSystemConsultations.map((c) => (
                      <AdminActiveCaseCard
                        key={c.id}
                        c={c}
                        assignment={assignmentLabel(c)}
                        onSelect={() => router.push(`/panel-medico/consulta/${c.id}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
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

function AdminActiveCaseCard({
  c,
  assignment,
  onSelect
}: {
  c: Consultation
  assignment: string
  onSelect: () => void
}) {
  return (
    <div className="card-flat">
      <div className="panel-card-header">
        <div>
          <strong>{c.patients?.full_name || 'Paciente'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            {c.patients?.affected_zone || 'Zona no indicada'} · hace {minutesSince(c.created_at)}{' '}
            min
          </div>
        </div>
        <span className={`badge ${statusBadgeClass(c.status)}`}>
          {STATUS_LABELS[c.status] || c.status}
        </span>
      </div>

      <p>{c.chief_complaint || c.patients?.description || 'Sin descripción'}</p>

      <div className="tag-row" style={{ marginBottom: 12 }}>
        <span className="badge">{assignment}</span>
        {isPatientPresent(c) ? (
          <span className="badge badge-green">● En sala</span>
        ) : (
          <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>
            ○ Sin conexión
          </span>
        )}
        {c.referred_specialty && (
          <span className="badge badge-blue">Derivado a {c.referred_specialty}</span>
        )}
      </div>

      <button className="btn btn-secondary btn-full" onClick={onSelect}>
        Ver / gestionar caso
      </button>
    </div>
  )
}

function ConsultationCard({
  c,
  onOpen,
  onWhatsapp
}: {
  c: Consultation
  onOpen: () => void
  onWhatsapp: () => void
}) {
  return (
    <div className="card-flat">
      <div className="panel-card-header">
        <div>
          <strong>{c.patients?.full_name || 'Paciente'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            {c.patients?.affected_zone} · hace {minutesSince(c.created_at)} min
          </div>
          <div style={{ marginTop: 4 }}>
            {isPatientPresent(c) ? (
              <span className="badge badge-green">● En sala</span>
            ) : (
              <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>
                ○ Sin conexión
              </span>
            )}
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
      <button className="btn btn-primary btn-full" onClick={onOpen}>
        Atender
      </button>
      <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={onWhatsapp}>
        Puedo atender a este paciente vía WhatsApp con mi número personal
      </button>
    </div>
  )
}
