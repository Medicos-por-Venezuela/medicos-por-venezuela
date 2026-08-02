import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAccessToken } from '../lib/admin'
import {
  ApiError,
  claimConsultation,
  fetchMyProfile,
  fetchPanel,
  type MyProfile,
  type PanelConsultation
} from '../lib/consultations'
import {
  STATUS_LABELS,
  // `canAttendConsultation` ya no se importa: la elegibilidad la decide el backend (get_panel +
  // claim). Aquí solo queda `matchesConsultation`, que es una preferencia de orden, no un permiso.
  matchesConsultation,
  minutesSince
} from '../lib/utils'
import { browserRoomUrl } from '../lib/jitsi'
import {
  fetchMyInterconsultations,
  useInterconsultationAssigned,
  type InterconsultationForInvitee
} from '../lib/interconsultations'
import { ensureVideoRoom } from '../lib/patients'
import { usePatientsInRoom } from '../lib/patientPresence'

type Patient = {
  id: string
  // Opcional: en "Pacientes que no han podido ser atendidos" (cola de espera) el backend no manda
  // el nombre por seguridad; solo llega en "Mis consultas abiertas". El card cae a "Paciente".
  full_name?: string
  cedula: string | null
  phone_whatsapp: string
  affected_zone: string
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
  // Se piden en el registro y el backend las expone también en la cola de espera: son dato de
  // decisión clínica ANTES de tomar el caso, no después de abrirlo.
  allergies: string | null
}

type Consultation = {
  id: string
  code: string
  status: string
  priority: string
  category: string | null
  specialty: string | null
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

// La presencia del paciente "en sala" se lee por Realtime Presence (usePatientsInRoom), no por
// heartbeat/patient_last_seen_at: `patientsInRoom.has(c.id)`.

function statusBadgeClass(status: string): string {
  if (status === 'urgent_in_person') return 'badge-red'
  if (status === 'referred_to_specialist') return 'badge-blue'
  if (status === 'in_progress') return 'badge-orange'
  return 'badge-green'
}

// El backend (fetchPanel) devuelve el paciente como `patient` y omite campos que la cola no
// muestra (entered_call_at, internal_note). Lo adaptamos al tipo Consultation que usa el panel.
function toConsultationRow(c: PanelConsultation): Consultation {
  return {
    id: c.id,
    code: c.code,
    status: c.status,
    priority: c.priority,
    category: c.category,
    specialty: c.specialty,
    chief_complaint: c.chief_complaint,
    created_at: c.created_at,
    entered_call_at: null,
    opened_at: c.opened_at,
    closed_at: c.closed_at,
    referred_specialty: c.referred_specialty,
    internal_note: null,
    video_room_url: c.video_room_url,
    patient_last_seen_at: c.patient_last_seen_at,
    assigned_doctor_id: c.assigned_doctor_id,
    attended_via_whatsapp: c.attended_via_whatsapp,
    patients: c.patient as Patient | null
  }
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
  // Consultas con el paciente EN SALA por Realtime Presence (reemplaza el heartbeat).
  const patientsInRoom = usePatientsInRoom()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [myClosed, setMyClosed] = useState(0)
  // Interconsultas donde YO soy el médico invitado (segunda opinión en vivo; datos limitados).
  const [myInterconsultations, setMyInterconsultations] = useState<InterconsultationForInvitee[]>(
    []
  )
  // Waiting case the doctor wants to attend via WhatsApp — set while the commitment modal is open.
  const [whatsappTarget, setWhatsappTarget] = useState<Consultation | null>(null)
  // Admins have no doctor profile by default. But an admin who is ALSO a doctor (has a `doctors`
  // row) does — this tracks whether /doctors/me resolved for them, so we only show "Mi perfil"
  // when there's actually a profile to open (a pure admin would just hit a 404 there).
  const [hasDoctorProfile, setHasDoctorProfile] = useState(false)
  const isCurrentUserAdmin = isAdminRole(profile?.role)
  // Non-admins are doctors → always have a profile. Admins only if the probe below found one.
  const showProfileButton = !isCurrentUserAdmin || hasDoctorProfile

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!router.isReady || !profile?.id || router.query.actualizado !== '1') return
    loadConsultations(profile)
    setMessage('Panel actualizado.')
    router.replace('/panel-medico', undefined, { shallow: true })
  }, [router.isReady, router.query.actualizado, profile?.id])

  // La presencia (anunciar al médico como "online") la maneja PresenceProvider a nivel de app, así
  // el médico sigue online al navegar del panel a la consulta. Aquí no hace falta anunciarla.

  // Realtime (WebSocket) en vez de long-polling: nos suscribimos a los cambios de `consultations`
  // en Supabase (el ÚNICO acceso directo que queda, junto con Auth) y ante cualquier evento
  // refrescamos la cola DESDE EL BACKEND. Así el médico ve en vivo las consultas que entran o que
  // otro médico toma, sin sondear cada 20s. El refetch se debouncea para coalescer ráfagas.
  useEffect(() => {
    if (!profile?.id) return
    let debounce: number | undefined
    const refetch = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => loadConsultations(profile), 400)
    }
    const channel = supabase
      .channel('panel-consultations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultations' }, refetch)
      .subscribe()
    return () => {
      window.clearTimeout(debounce)
      supabase.removeChannel(channel)
    }
  }, [profile])

  // Un colega me acaba de asignar una interconsulta: refrescar en el acto. Va por broadcast y no
  // por postgres_changes porque `interconsultations` está deny-all a propósito (ver lib).
  useInterconsultationAssigned(profile?.id, () => {
    if (profile) loadConsultations(profile)
  })

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

    // Perfil + contexto de médico por el backend en UNA sola llamada (GET /auth/me), no por
    // PostgREST directo a `profiles` ni una segunda a /doctors/me.
    let me: MyProfile
    try {
      me = await fetchMyProfile(sessionData.session.access_token)
    } catch {
      await supabase.auth.signOut()
      router.push('/login-medico')
      return
    }

    if (!me.active || !me.verified) {
      await supabase.auth.signOut()
      router.push('/login-medico')
      return
    }

    if (!PANEL_ALLOWED_ROLES.includes(me.role as (typeof PANEL_ALLOWED_ROLES)[number])) {
      router.push('/')
      return
    }

    setProfile(me)
    setHasDoctorProfile(me.has_doctor_profile)
    // Médico (con o sin ficha) y sin cédula = registro a medias: completar perfil antes de usar el
    // panel. Un admin puro (has_doctor_profile=false) no se redirige y solo se le oculta "Mi perfil".
    if (me.has_doctor_profile && !me.doctor_cedula?.trim()) {
      router.replace('/panel-medico/perfil')
      return
    }
    await loadConsultations(me)
    setLoading(false)
  }

  async function loadConsultations(_currentProfile: Profile | null = profile) {
    // Todo el panel en una sola llamada al backend (cola de espera + mías + cerradas). La cola trae
    // TODA consulta sin asignar en estado abierto — en tiempo real, sin el gate de 20 min de antes.
    let token: string
    try {
      token = await getAccessToken()
      const panel = await fetchPanel(token)
      setConsultations([...panel.waiting, ...panel.mine].map(toConsultationRow))
      setMyClosed(panel.my_closed_count)
    } catch (e) {
      console.error(e)
      setMessage('No se pudieron cargar las consultas.')
      return
    }
    // En su PROPIO try: cuando compartía el de arriba, un fallo aquí se reportaba como "no se
    // pudieron cargar las consultas" con el panel ya pintado, y las interconsultas simplemente
    // no aparecían. Ese enmascaramiento costó un rato de diagnóstico en producción.
    try {
      setMyInterconsultations(await fetchMyInterconsultations(token))
    } catch (e) {
      console.error(e)
      setMessage('No se pudieron cargar tus interconsultas.')
    }
  }

  // "Pacientes que no han podido ser atendidos hasta ahora": registered cases not assigned to any
  // doctor. Sin gate de tiempo: el backend ya devuelve toda consulta en espera sin asignar, y el
  // médico las ve entrar en tiempo real para atenderlas de una vez.
  const waiting = useMemo(
    () => consultations.filter((c) => c.assigned_doctor_id === null),
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
  // El filtro por especialidad se aplica AHORA EN EL BACKEND (GET /consultations/panel), así que
  // `waiting` ya viene acotado a lo que este médico puede atender y el recorte en el cliente
  // sobra. Se eliminó `mySpecialtyWaiting` a propósito: mientras existió, la lista se pintaba sin
  // filtrar y el contador sí filtraba, que es como un psicólogo terminó viendo la cédula y el
  // motivo de un caso de medicina general. Una sola fuente de verdad, y del lado del servidor.
  //
  // Everyone — including admins/super_admins — sees /panel-medico as a doctor: the waiting queue and
  // their own open cases, no admin-only "system cases" section.
  // "Pacientes esperando" partido en dos (PR #27 de main, recreado con la presencia real): en la
  // sala AHORA (badge "● En sala", vía Realtime Presence) vs. +20 min sin atender.
  const kpis = [
    {
      value: waiting.filter((c) => patientsInRoom.has(c.id)).length,
      label: 'En videollamada ahora'
    },
    {
      value: waiting.filter((c) => minutesSince(c.created_at) > 20).length,
      label: 'Sin atender (+20 min)'
    },
    { value: waiting.length, label: 'Esperando para tu especialidad' },
    { value: myClosed, label: 'Consultas cerradas por mí' }
  ]

  const waitingEmptyMessage =
    'No hay pacientes nuevos en cola (waiting). Si ya tomaste un caso, aparecerá en “Mis consultas abiertas”.'

  // Claim atómico por el backend: POST /consultations/{id}/claim solo asigna si el caso sigue sin
  // médico; si otro lo tomó primero responde 409 y NO abrimos la sala (dos médicos jamás caen en la
  // misma reunión). El evento 'opened' lo registra el backend. Devuelve true si el claim fue nuestro.
  async function claimCase(c: Consultation, viaWhatsapp: boolean): Promise<boolean> {
    try {
      await claimConsultation(c.id, viaWhatsapp, await getAccessToken())
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setMessage(
          viaWhatsapp
            ? 'Ya fue asignado a otro doctor.'
            : 'Este paciente ya fue tomado por otro médico.'
        )
        await loadConsultations()
        return false
      }
      setMessage(viaWhatsapp ? 'No se pudo asignar la consulta.' : 'No se pudo abrir la consulta.')
      return false
    }
  }

  async function openConsultation(c: Consultation) {
    if (!profile) return
    // Si el caso no tiene sala, créala ANTES del claim (el backend solo la genera mientras
    // sigue en espera; es idempotente): sana consultas viejas sin video_room_url — casos
    // tomados por WhatsApp que se liberaron, o creados mientras el hosting rompía la creación.
    let room = c.video_room_url
    if (!room) {
      try {
        // Con la sesión del médico: la sala exige el token del paciente O una sesión de staff, y
        // el médico obviamente no tiene el token del paciente.
        const { data: sessionData } = await supabase.auth.getSession()
        room =
          (await ensureVideoRoom(c.id, undefined, sessionData.session?.access_token))
            .video_room_url || null
      } catch {
        // 409 (ya no está en espera) u otro fallo: se sigue sin sala, como antes.
      }
    }
    if (!(await claimCase(c, false))) return
    if (room) window.open(browserRoomUrl(room), '_blank')
    await router.push(`/panel-medico/consulta/${c.id}`)
  }

  // Toma un paciente en espera para atenderlo por WhatsApp (sin video). Solo tras aceptar el modal
  // de compromiso.
  async function attendViaWhatsapp(c: Consultation) {
    if (!profile) return
    setWhatsappTarget(null)
    if (!(await claimCase(c, true))) return
    await router.push(`/panel-medico/consulta/${c.id}`)
  }

  // Toma el siguiente paciente en espera. `waiting` ya viene del backend acotado a lo que este
  // médico PUEDE atender y ordenado FIFO, así que aquí no se vuelve a comprobar la elegibilidad:
  // ese filtro duplicado es justo lo que provocó el bug del psicólogo. Lo único que queda es la
  // PREFERENCIA por un caso que pida exactamente su especialidad — preferencia, no permiso: si no
  // hay ninguno, se atiende al más antiguo para que nadie se quede esperando. El permiso lo
  // revalida el backend en /claim de todas formas.
  async function attendNext() {
    setMessage('')
    if (waiting.length === 0) {
      setMessage(waitingEmptyMessage)
      return
    }
    const exactMatch = waiting.find((c) =>
      matchesConsultation(
        profile?.specialty,
        c.specialty,
        c.category,
        c.patients?.needs_tags || null
      )
    )
    await openConsultation(isCurrentUserAdmin ? waiting[0] : exactMatch || waiting[0])
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
              <button
                className="btn btn-outline"
                onClick={() => router.push('/panel-medico/agenda')}
              >
                Mi agenda
              </button>
              {showProfileButton && (
                <button
                  className="btn btn-outline"
                  onClick={() => router.push('/panel-medico/perfil')}
                >
                  Mi perfil
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
                    <ConsultationCard
                      key={c.id}
                      c={c}
                      inRoom={patientsInRoom.has(c.id)}
                      onOpen={() => openConsultation(c)}
                      onWhatsapp={() => setWhatsappTarget(c)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {myInterconsultations.length > 0 && (
            <section className="card" style={{ marginTop: 18 }}>
              <h2 style={{ marginTop: 0 }}>Interconsultas asignadas a mí</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
                Un colega te pidió una segunda opinión en vivo. Ves solo el motivo, las notas y la
                edad del paciente — sin su identidad.
              </p>
              <div className="grid">
                {myInterconsultations.map((ic) => (
                  <div key={ic.id} className="card-flat">
                    <strong>Interconsulta · edad {ic.patient_age_range || '—'}</strong>
                    <p>
                      <em>Motivo:</em> {ic.chief_complaint || 'Sin motivo'}
                    </p>
                    {(ic.internal_note || ic.clinical_notes) && (
                      <p>
                        <em>Notas:</em>{' '}
                        {[ic.internal_note, ic.clinical_notes].filter(Boolean).join(' — ')}
                      </p>
                    )}
                    {ic.note && (
                      <p style={{ color: '#64748b' }}>
                        <em>Mensaje del colega:</em> {ic.note}
                      </p>
                    )}
                    {ic.video_room_url && (
                      <a
                        className="btn btn-primary btn-full"
                        href={browserRoomUrl(ic.video_room_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Unirse a videoconsulta
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
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

function ConsultationCard({
  c,
  onOpen,
  onWhatsapp,
  inRoom
}: {
  c: Consultation
  onOpen: () => void
  onWhatsapp: () => void
  inRoom: boolean
}) {
  return (
    <div className="card-flat">
      <div className="panel-card-header">
        <div>
          <strong>{c.patients?.full_name || 'Paciente'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            {c.patients?.affected_zone}
            {c.patients?.age_range ? ` · Edad ${c.patients.age_range}` : ''} · hace{' '}
            {minutesSince(c.created_at)} min
          </div>
          <div style={{ marginTop: 4 }}>
            {inRoom ? (
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
      {c.patients?.allergies && (
        // Dato de decisión clínica: el médico lo necesita ANTES de tomar el caso, no al abrirlo.
        <p className="badge badge-red" style={{ display: 'inline-block' }}>
          ⚠ Alergias: {c.patients.allergies}
        </p>
      )}
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
      {/* Acción principal: tomar a ESTE paciente por video (abre la sala). WhatsApp es el fallback. */}
      <button className="btn btn-primary btn-full" onClick={onOpen}>
        Atender por videoconsulta
      </button>
      <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={onWhatsapp}>
        Puedo atender a este paciente vía WhatsApp con mi número personal
      </button>
    </div>
  )
}
