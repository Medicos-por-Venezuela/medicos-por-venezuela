import Seo from '../components/Seo'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAccessToken, type ClinicalAccess } from '../lib/admin'
import {
  ApiError,
  claimConsultation,
  deriveConsultation,
  fetchMyProfile,
  fetchPanel,
  type DerivationTarget,
  type MyProfile,
  type PanelConsultation,
  type QueueBlockedReason,
  type QueueGroup
} from '../lib/consultations'
import {
  STATUS_LABELS,
  isAdminRole,
  isPanelRole,
  tiempoTranscurrido,
  statusBadgeClass
} from '../lib/utils'
import { browserRoomUrl } from '../lib/jitsi'
import {
  fetchMyInterconsultations,
  useInterconsultationAssigned,
  type InterconsultationForInvitee
} from '../lib/interconsultations'
import { usePatientsInRoom } from '../lib/patientPresence'
import EstadoPacienteBadge from '../components/EstadoPacienteBadge'
import AntesDeEntrarModal from '../components/AntesDeEntrarModal'
import DerivarEspecialidadModal from '../components/DerivarEspecialidadModal'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import { clinicalValue, CONFIDENTIAL_QUEUE_LABEL } from '../components/ConfidentialText'
import { fetchMyPermissions } from '../lib/users'

type Patient = {
  id: string
  // Opcional: en "Pacientes que no han podido ser atendidos" (cola de espera) el backend no manda
  // el nombre por seguridad; solo llega en "Mis consultas abiertas". El card cae a "Paciente".
  full_name?: string
  // Tampoco llegan en la cola de espera: solo en las consultas ya tomadas.
  cedula?: string | null
  phone_whatsapp?: string
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
  specialty_id: string | null
  // Especialidad desde la que se derivó a esta cola (null si no viene derivado).
  derived_from_specialty: string | null
  chief_complaint: string | null
  created_at: string
  // Hora de llegada del paciente a la cola (un derivado conserva la original).
  queued_at: string
  entered_call_at: string | null
  opened_at: string | null
  closed_at: string | null
  referred_specialty: string | null
  internal_note: string | null
  video_room_url: string | null
  patient_last_seen_at: string | null
  assigned_doctor_id: string | null
  attended_via_whatsapp: boolean
  // Nivel de acceso clínico con el que respondió la API: un caso de otra cola (lo ve un admin)
  // llega sin motivo, y hay que decir que es confidencial, no "Sin descripción".
  clinical_access?: ClinicalAccess
  patients: Patient | null
}

// Dónde está el paciente: dos señales distintas que pinta `EstadoPacienteBadge`. La presencia
// (usePatientsInRoom, Realtime) dice si tiene abierta la página; `entered_call_at` dice si pulsó
// para entrar a la videollamada. Ver el porqué de las dos en ese componente.

// El backend (fetchPanel) devuelve el paciente como `patient` y omite las notas internas, que la
// cola no muestra. Lo adaptamos al tipo Consultation que usa el panel.
function toConsultationRow(c: PanelConsultation): Consultation {
  return {
    id: c.id,
    code: c.code,
    status: c.status,
    priority: c.priority,
    category: c.category,
    specialty: c.specialty,
    specialty_id: c.specialty_id,
    derived_from_specialty: c.derived_from_specialty,
    chief_complaint: c.chief_complaint,
    created_at: c.created_at,
    queued_at: c.queued_at || c.created_at,
    entered_call_at: c.entered_call_at,
    opened_at: c.opened_at,
    closed_at: c.closed_at,
    referred_specialty: c.referred_specialty,
    internal_note: null,
    video_room_url: c.video_room_url,
    patient_last_seen_at: c.patient_last_seen_at,
    assigned_doctor_id: c.assigned_doctor_id,
    attended_via_whatsapp: c.attended_via_whatsapp,
    clinical_access: c.clinical_access,
    patients: c.patient as Patient | null
  }
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
  // Caso de la cola que el médico quiere derivar (modal de especialidades) y, ya elegida la
  // especialidad, la confirmación "¿seguro que quieres derivar a X?".
  const [deriveTarget, setDeriveTarget] = useState<Consultation | null>(null)
  const [deriveConfirm, setDeriveConfirm] = useState<{
    c: Consultation
    target: DerivationTarget
  } | null>(null)
  const [deriving, setDeriving] = useState(false)
  // Por qué este médico no ve ninguna cola (sin especialidad, o con "Otra"): lo manda a su perfil.
  const [queueBlocked, setQueueBlocked] = useState<QueueBlockedReason | null>(null)
  // Las colas del médico: una por especialidad suya (puede ejercer varias) más la de entrada
  // (Medicina general). Con más de una, el panel enseña primero las cards con sus contadores y
  // solo abre la que elija — así no mezcla los pacientes de cada cola.
  const [queues, setQueues] = useState<QueueGroup[]>([])
  const [openQueue, setOpenQueue] = useState<string | null>(null)
  // A qué paciente va a atender mientras el aviso de "antes de entrar" está arriba.
  const [videoTarget, setVideoTarget] = useState<Consultation | null>(null)
  // Admins have no doctor profile by default. But an admin who is ALSO a doctor (has a `doctors`
  // row) does — this tracks whether /doctors/me resolved for them, so we only show "Mi perfil"
  // when there's actually a profile to open (a pure admin would just hit a 404 there).
  const [hasDoctorProfile, setHasDoctorProfile] = useState(false)
  // Gate de credencial del backend (`credential_verified` de /auth/me/permissions): el médico
  // conserva su rol pero llega SIN permisos hasta que su ficha esté verificada y completa.
  const [credentialPending, setCredentialPending] = useState(false)
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
      router.push('/login')
      return
    }

    // Perfil + contexto de médico por el backend en UNA sola llamada (GET /auth/me), no por
    // PostgREST directo a `profiles` ni una segunda a /doctors/me.
    let me: MyProfile
    try {
      me = await fetchMyProfile(sessionData.session.access_token)
    } catch {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }

    // Solo `active`: es el gate real, el que mueve el botón "Revocar acceso" del admin.
    // `verified` (users.verified) se quitó de aquí porque nace true y ningún camino del backend
    // la baja — comprobarla era evaluar una constante. El dato de credencial (SACS/FPV) vive en
    // `doctors.verified` y no gatea el acceso: lo supervisa un admin desde su lista.
    if (!me.active) {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }

    if (!isPanelRole(me.role)) {
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

    // Gate de credencial: quien ejerce como médico y no tiene la ficha verificada llega sin
    // permisos, así que TODO el panel respondería 403. Se comprueba antes de pedir nada para
    // mostrar la pantalla de "pendiente" en vez de una cola vacía y un error genérico.
    try {
      const perms = await fetchMyPermissions(sessionData.session.access_token)
      if (!perms.credential_verified) {
        setCredentialPending(true)
        setLoading(false)
        return
      }
    } catch {
      // Backend caído o endpoint viejo: se sigue como antes; la cola dará su propio error.
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
    } catch (e) {
      console.error(e)
      setMessage('No se pudieron cargar las consultas.')
      return
    }
    // Las dos llamadas son independientes, así que van EN PARALELO: en serie el panel esperaba
    // un round-trip completo de más antes de pintar (y esto corre también en cada refetch de
    // Realtime y en cada `focus`, no solo al entrar). allSettled y no Promise.all para que
    // cada una conserve su propio manejo de error — y para que un rechazo no quede sin
    // handler mientras se espera a la otra.
    const [panelRes, interconsultationsRes] = await Promise.allSettled([
      fetchPanel(token),
      fetchMyInterconsultations(token)
    ])
    if (panelRes.status === 'fulfilled') {
      const panel = panelRes.value
      setConsultations([...panel.waiting, ...panel.mine].map(toConsultationRow))
      setMyClosed(panel.my_closed_count)
      setQueueBlocked(panel.queue_blocked_reason ?? null)
      setQueues(panel.queues ?? [])
    } else {
      console.error(panelRes.reason)
      setMessage('No se pudieron cargar las consultas.')
    }
    // Error propio y no compartido: cuando ambos colgaban del mismo try, un fallo de
    // interconsultas se reportaba como "no se pudieron cargar las consultas" con el panel ya
    // pintado, y las interconsultas simplemente no aparecían. Ese enmascaramiento costó un
    // rato de diagnóstico en producción.
    if (interconsultationsRes.status === 'fulfilled') {
      setMyInterconsultations(interconsultationsRes.value)
    } else {
      console.error(interconsultationsRes.reason)
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
  // Dos contadores: cuántos pacientes esperan en SUS colas (la cola ya viene acotada por el
  // backend a su especialidad) y cuántas consultas cerró.
  const kpis = [
    { value: waiting.length, label: 'En espera por atender' },
    { value: myClosed, label: 'Consultas cerradas por mí' }
  ]

  // Cada cola trae los `specialty_ids` de los casos que le tocan (los suyos más sus accesos
  // extra, p. ej. Psicología dentro de la de Psiquiatría). La del resto (una admin que además
  // ejerce) no trae ids: es todo lo que no cayó en las otras, así que nada se queda fuera del
  // panel aunque se agregue una especialidad nueva.
  const porCola = useMemo(() => {
    const propias = queues.filter((q) => !q.is_rest).map((q) => q.specialty_ids)
    return queues.map((q) => ({
      queue: q,
      casos: q.is_rest
        ? waiting.filter((c) => {
            const sid = c.specialty_id
            return !sid || !propias.some((ids) => ids.includes(sid))
          })
        : waiting.filter((c) => !!c.specialty_id && q.specialty_ids.includes(c.specialty_id))
    }))
  }, [queues, waiting])
  // Con una sola cola (o ninguna) no hay cards: la lista va directa.
  const conCards = porCola.length > 1
  const claveCola = (q: QueueGroup) => q.id ?? 'resto'
  const colaAbierta = porCola.find((g) => claveCola(g.queue) === openQueue) || null
  const visibles = !conCards ? waiting : (colaAbierta?.casos ?? [])
  const tituloCola = (q: QueueGroup) =>
    q.is_rest
      ? 'Ver consultas de otras especialidades'
      : q.is_triage
        ? `Ver consultas pendientes de ${q.name}`
        : `Ver consultas pendientes de mi especialidad: ${q.name}`

  const waitingEmptyMessage =
    'No hay pacientes esperando en tu cola. Si ya tomaste un caso, aparecerá en “Mis consultas abiertas”.'

  // Claim atómico por el backend: POST /consultations/{id}/claim solo asigna si el caso sigue en
  // espera y sin médico; si otro lo tomó primero responde 409 y NO abrimos la sala (dos médicos
  // jamás caen en la misma reunión). La atención es siempre por video: el mismo claim crea la sala
  // y la devuelve. Devuelve el caso tomado, o null si no fue nuestro.
  async function claimCase(c: Consultation): Promise<PanelConsultation | null> {
    try {
      return await claimConsultation(c.id, await getAccessToken())
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) {
        setMessage(
          e.status === 409
            ? 'Este paciente ya fue tomado por otro médico.'
            : 'Este caso ya no corresponde a tu especialidad.'
        )
        await loadConsultations()
        return null
      }
      setMessage('No se pudo abrir la consulta.')
      return null
    }
  }

  async function openConsultation(c: Consultation) {
    if (!profile) return
    const claimed = await claimCase(c)
    if (!claimed) return
    const room = claimed.video_room_url || c.video_room_url
    if (room) window.open(browserRoomUrl(room), '_blank')
    await router.push(`/panel-medico/consulta/${c.id}`)
  }

  // Derivar un caso de la cola (sin tomarlo) a otra especialidad, tras confirmar.
  async function confirmDerive() {
    if (!deriveConfirm) return
    const { c, target } = deriveConfirm
    setDeriving(true)
    try {
      await deriveConsultation(c.id, target.id, await getAccessToken())
      setMessage(`Derivaste el caso a ${target.name}. Ya está en la cola de esa especialidad.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo derivar el caso.')
    } finally {
      setDeriving(false)
      setDeriveConfirm(null)
      await loadConsultations()
    }
  }

  // "Entendido" del aviso. Toma el caso y abre la sala desde ESTE clic: el `window.open` necesita
  // un gesto reciente del usuario, y el de abrir el aviso ya quedó atrás mientras lo leía.
  function confirmVideo() {
    const target = videoTarget
    setVideoTarget(null)
    if (target) openConsultation(target)
  }
  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  // El `noindex` se declara ANTES del return temprano de carga, y no solo dentro del arbol final.
  // En el servidor el estado inicial es siempre "cargando", asi que el HTML que recibe un crawler
  // es SIEMPRE esa pantalla. Con el <Seo> unicamente en la rama de abajo, esa respuesta salia con
  // el <head> vacio: sin `noindex`, sin `<title>` y con un 200. El `Disallow` de robots.txt pide
  // que no se rastree, pero una URL enlazada desde fuera puede acabar indexada igualmente --el
  // propio comentario de robots.txt explica por que hacen falta las dos senales-- y estas rutas
  // no tienen gate en servidor: responden 200 y el control de acceso llega tras la hidratacion.
  // Las otras dos ramas de esta pagina (credencial pendiente y panel completo) traen su propio
  // <Seo> con su titulo especifico; esta solo necesitaba el suyo.
  if (loading) {
    return (
      <>
        <Seo
          titulo="Panel médico — Médicos por Venezuela"
          descripcion={'Cola de pacientes en espera, tus casos y los contadores del día.'}
          ruta="/panel-medico"
          noindex
        />
        <main className="page">
          <div className="container">
            <div className="card">Cargando...</div>
          </div>
        </main>
      </>
    )
  }

  // Credencial pendiente: el backend le vació los permisos, así que la cola y todo lo demás
  // responden 403. Sin esta pantalla el médico vería un panel vacío sin explicación y creería
  // que la plataforma está rota. Aquí se le dice qué falta y por dónde salir del limbo
  // (/panel-medico/perfil queda FUERA del gate justamente para eso).
  if (credentialPending) {
    return (
      <>
        <Seo
          titulo="Verificación pendiente — Médicos por Venezuela"
          descripcion={'Falta completar tu credencial profesional para poder atender.'}
          ruta="/panel-medico"
          noindex
        />
        <main className="page">
          <div className="container">
            <div className="panel-topbar">
              <div>
                <h1 style={{ margin: 0 }}>{profile?.full_name}</h1>
                <p style={{ margin: 0, color: '#64748b' }}>
                  <span className="badge badge-orange">Verificación pendiente</span>
                </p>
              </div>
              <div className="panel-actions">
                <button className="btn btn-muted" onClick={logout}>
                  Salir
                </button>
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Tu credencial profesional aún no está verificada</h2>
              <p style={{ color: '#475569' }}>
                Para atender pacientes tu ficha necesita tu <strong>cédula</strong> y tu{' '}
                <strong>número de licencia</strong>, y que el registro oficial (SACS para médicos,
                FPV para psicólogos) los confirme. Mientras tanto no puedes ver la cola ni tomar
                casos.
              </p>
              <p style={{ color: '#475569' }}>
                Completa o corrige tus datos en tu perfil. Si el registro oficial no te encuentra,
                un administrador revisará tu ficha y la aprobará a mano.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => router.push('/panel-medico/perfil')}
              >
                Completar mi perfil
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Seo
        titulo="Panel médico — Médicos por Venezuela"
        descripcion={'Cola de pacientes en espera, tus casos y los contadores del día.'}
        ruta="/panel-medico"
        noindex
      />
      <main className="page">
        <div className="container panel-wide">
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
              {/* Interconsulta ASÍNCRONA (pacientes de consultorio). Distinta de la interconsulta
                  en vivo que se asigna desde el Pool durante una consulta de la cola. */}
              <button
                className="btn btn-outline"
                onClick={() => router.push('/panel-medico/mis-pacientes')}
              >
                Mis pacientes
              </button>
              <button
                className="btn btn-outline"
                onClick={() => router.push('/panel-medico/interconsultas')}
              >
                Interconsultas
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

          {queueBlocked && (
            <div className="notice notice-warning" role="alert" style={{ marginBottom: 16 }}>
              <strong>
                {queueBlocked === 'especialidad_por_definir'
                  ? 'Tu especialidad figura como “Otra”.'
                  : 'No tienes una especialidad registrada.'}
              </strong>{' '}
              Los pacientes llegan a la cola de cada especialidad, así que no puedes ver ni atender
              casos hasta que la indiques. Si tu especialidad no está en la lista, escríbela y un
              administrador la agregará.
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push('/panel-medico/perfil')}
                >
                  Actualizar mi especialidad
                </button>
              </div>
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
              {conCards && !colaAbierta ? (
                <>
                  <h2 style={{ marginTop: 0 }}>Pacientes en espera</h2>
                  <p style={{ color: '#64748b', marginTop: -6 }}>
                    Tienes una cola por cada especialidad que ejerces, más la de entrada, donde caen
                    los pacientes que no saben qué especialidad necesitan.
                    {porCola.some((g) => g.queue.is_rest)
                      ? ' La última reúne el resto de especialidades, que ves por ser administradora.'
                      : ''}
                  </p>
                  <div className="cola-cards">
                    {porCola.map(({ queue, casos }) => (
                      <button
                        key={claveCola(queue)}
                        className="cola-card"
                        onClick={() => setOpenQueue(claveCola(queue))}
                      >
                        <span className="cola-card-num">{casos.length}</span>
                        <span>{tituloCola(queue)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-card-header">
                    <h2 style={{ marginTop: 0 }}>
                      {colaAbierta
                        ? `Pacientes en espera · ${colaAbierta.queue.name}`
                        : 'Pacientes que no han podido ser atendidos hasta ahora'}
                    </h2>
                    {conCards && (
                      <button className="link-button" onClick={() => setOpenQueue(null)}>
                        ← Ver todas las consultas
                      </button>
                    )}
                  </div>
                  {visibles.length === 0 ? (
                    <p style={{ color: '#64748b' }}>{waitingEmptyMessage}</p>
                  ) : (
                    <div className="grid">
                      {visibles.map((c) => (
                        <ConsultationCard
                          key={c.id}
                          c={c}
                          inRoom={patientsInRoom.has(c.id)}
                          onOpen={() => setVideoTarget(c)}
                          onDerive={() => setDeriveTarget(c)}
                        />
                      ))}
                    </div>
                  )}
                </>
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

      <AntesDeEntrarModal
        para="medico"
        open={videoTarget !== null}
        onCancel={() => setVideoTarget(null)}
        onConfirm={confirmVideo}
      />

      <DerivarEspecialidadModal
        open={deriveTarget !== null}
        currentSpecialty={deriveTarget?.specialty}
        hint="El paciente pasa a la cola de la especialidad que elijas y conserva su lugar en la fila. Se le avisa por correo."
        onClose={() => setDeriveTarget(null)}
        onPick={(target) => {
          if (deriveTarget) setDeriveConfirm({ c: deriveTarget, target })
          setDeriveTarget(null)
        }}
      />

      <ConfirmDialog
        open={deriveConfirm !== null}
        title="Derivar paciente"
        message={
          <p>
            ¿Seguro que quieres derivar este paciente a{' '}
            <strong>{deriveConfirm?.target.name}</strong>? Saldrá de tu cola y lo atenderá un médico
            de esa especialidad.
          </p>
        }
        confirmLabel="Sí, derivar"
        busy={deriving}
        onConfirm={confirmDerive}
        onCancel={() => setDeriveConfirm(null)}
      />

      <style jsx global>{`
        /* El panel médico va a ancho completo: la cola es lo que más espacio necesita. */
        .panel-wide {
          max-width: none;
          margin: 0;
        }

        .cola-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .cola-card {
          display: flex;
          align-items: center;
          gap: 14px;
          text-align: left;
          width: 100%;
          padding: 18px;
          border-radius: 16px;
          border: 1px solid var(--brand);
          background: var(--brand-light);
          color: var(--brand-dark);
          font-weight: 700;
          font-size: 16px;
        }
        .cola-card:hover,
        .cola-card:focus-visible {
          background: var(--brand);
          color: white;
        }
        .cola-card-num {
          font-size: 30px;
          font-weight: 900;
          line-height: 1;
          min-width: 44px;
        }

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
          .cola-cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

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
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
  onDerive,
  inRoom
}: {
  c: Consultation
  onOpen: () => void
  onDerive: () => void
  inRoom: boolean
}) {
  return (
    // data-consultation-id: los E2E localizan la tarjeta por el caso, no por el motivo, que no ven
    // todos (un admin o un caso de otra cola lo reciben en null).
    <div className="card-flat" data-consultation-id={c.id}>
      <div className="panel-card-header">
        <div>
          {/* La cola no muestra quién es el paciente (el nombre llega al tomar el caso): el título
              es la especialidad de la cola en la que está. */}
          <strong>{c.specialty || 'Paciente'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            {c.patients?.affected_zone}
            {c.patients?.age_range ? ` · Edad ${c.patients.age_range}` : ''} · hace{' '}
            {tiempoTranscurrido(c.queued_at)}
          </div>
          {c.derived_from_specialty && (
            <div style={{ marginTop: 4 }}>
              <span className="badge badge-blue">Derivado desde {c.derived_from_specialty}</span>
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            <EstadoPacienteBadge enteredCallAt={c.entered_call_at} inRoom={inRoom} />
          </div>
        </div>
        <span className={`badge ${statusBadgeClass(c.status)}`}>
          {STATUS_LABELS[c.status] || c.status}
        </span>
      </div>
      <p>
        {clinicalValue(c.chief_complaint, c.clinical_access, CONFIDENTIAL_QUEUE_LABEL) ||
          c.patients?.description ||
          'Sin descripción'}
      </p>
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
      {/* Tomar a ESTE paciente: siempre por videoconsulta (el claim crea la sala). */}
      <button className="btn btn-primary btn-full" onClick={onOpen}>
        Atender paciente
      </button>
      {/* Derivar exige poder ver el motivo del caso (decisión de producto 2026-09-23): sin
          `clinical_access` (API vieja) se muestra igual, por compatibilidad hacia atrás. */}
      {c.clinical_access !== 'none' && (
        <button className="btn btn-outline btn-full" style={{ marginTop: 8 }} onClick={onDerive}>
          Derivar a especialista
        </button>
      )}
    </div>
  )
}
