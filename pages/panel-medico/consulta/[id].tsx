import Seo from '../../../components/Seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import DoctorPoolModal from '../../../components/DoctorPoolModal'
import DerivarEspecialidadModal from '../../../components/DerivarEspecialidadModal'
import SignaturePad from '../../../components/SignaturePad'
import UnlockClinicalKeyModal from '../../../components/UnlockClinicalKeyModal'
import { fmtDateTime, getAccessToken } from '../../../lib/admin'
import { DoctorPoolItem } from '../../../lib/doctors'
import {
  addConsultationEvent,
  ChainItem,
  closeConsultationApi,
  fetchChain,
  fetchConsultationDetail,
  fetchConsultationEvents,
  fetchMyProfile,
  referToQueue,
  scheduleFollowUp,
  updateConsultation,
  type ConsultationDetail,
  type ConsultationEventItem,
  type DerivationTarget
} from '../../../lib/consultations'
import { ensureVideoRoom, fetchPatientAddress } from '../../../lib/patients'
import { decryptAddress, isClinicalKeyUnlocked } from '../../../lib/patientAddressCrypto'
import {
  createInterconsultation,
  fetchInterconsultationForConsultation,
  notifyInterconsultationAssigned,
  Interconsultation
} from '../../../lib/interconsultations'
import { supabase } from '../../../lib/supabase'
import { fetchProfile } from '../../../lib/users'
import {
  STATUS_LABELS,
  isAdminRole,
  isPanelRole,
  tiempoTranscurrido,
  statusBadgeClass
} from '../../../lib/utils'
import { browserRoomUrl } from '../../../lib/jitsi'
import { notify, requestNotifyPermission } from '../../../lib/nativeNotifications'
import {
  fetchNotificationPrefs,
  isPushEnabled,
  type NotificationPrefs
} from '../../../lib/notificationPrefs'
import { usePatientsInRoom } from '../../../lib/patientPresence'
import EstadoPacienteBadge from '../../../components/EstadoPacienteBadge'
import AntesDeEntrarModal from '../../../components/AntesDeEntrarModal'

type Patient = {
  id: string
  full_name: string
  cedula: string | null
  phone_whatsapp: string
  emergency_phone: string | null
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
  // Cuándo pulsó el paciente para entrar a la videollamada. Es la única señal DURADERA de que
  // llegó: la presencia por Realtime se apaga en cuanto esta pestaña pasa a segundo plano, que
  // es justo lo que ocurre al abrir la sala desde un móvil (ver EstadoPacienteBadge).
  entered_call_at: string | null
  assigned_doctor_id: string | null
  attended_via_whatsapp: boolean
  can_view_patient_address: boolean
  // Especialidad de la cola del caso y, si llegó derivado, de dónde viene, quién y por qué.
  specialty?: string | null
  derived_from_specialty?: string | null
  derivation?: ConsultationDetail['derivation']
  patients: Patient | null
}

type Profile = {
  id: string
  full_name: string
  role: string
  specialty: string | null
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

// Status options shown for WhatsApp-attended cases (the doctor handles these outside video).
// 'closed' y 'referred_to_specialist' se quitaron a propósito: cerrar es solo vía el botón
// "Cerrar consulta" (con confirmación + nota guardada); derivar, vía "Derivar con especialista".
const WHATSAPP_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'in_progress', label: 'Abierta' },
  { value: 'contacted_whatsapp', label: 'Ya contactado vía WhatsApp' },
  { value: 'urgent_in_person', label: 'Necesita ir a centro de atención' }
]

// Estados que finalizan el caso: con uno de estos ya no se muestra el select de estado
// ni los botones de cierre (evita re-cerrar pisando closed_at, y que el select de
// WhatsApp "mienta" mostrando la primera opción cuando el estado real no está listado).
// 'referred_to_specialist' cuenta como finalizado: al derivar, el médico actual ya no la atiende
// (el paciente pasa a la cola del especialista); ver el flujo "Derivar con especialista".
const FINAL_STATUSES = [
  'closed',
  'patient_no_show',
  'closed_by_admin',
  'cancelled',
  'referred_to_specialist'
]

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    opened: 'Consulta abierta',
    closed: 'Consulta cerrada',
    patient_no_show: 'Paciente ausente',
    admin_update: 'Actualización administrativa',
    derived: 'Derivada a esta especialidad',
    referred_to_specialist: 'Derivada con especialista',
    scheduled: 'Cita agendada'
  }
  return labels[type] || type
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
  // Última nota persistida (para exigir "nota guardada" antes de cerrar la consulta).
  const [savedNote, setSavedNote] = useState('')
  // Pool de médicos: verlos y pedir una interconsulta (segunda opinión en vivo).
  const [poolOpen, setPoolOpen] = useState(false)
  // El aviso de "antes de entrar" a la sala está arriba.
  const [avisoVideo, setAvisoVideo] = useState(false)
  // "Derivar con especialista": primero se elige la especialidad (modal), luego motivo y firma.
  // Interconsulta activa de esta consulta (segunda opinión en vivo). null si aún no tiene.
  const [interconsultation, setInterconsultation] = useState<Interconsultation | null>(null)
  // Firma al cerrar / agendar seguimiento / referir (acto médico firmado). Módulo Agenda.
  const [signMode, setSignMode] = useState<null | 'close' | 'followup' | 'referral'>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [deriveOpen, setDeriveOpen] = useState(false)
  const [referSpecialty, setReferSpecialty] = useState<DerivationTarget | null>(null)
  const [referReason, setReferReason] = useState('')
  // Historial de la cadena de seguimiento (padre→hijas).
  const [chain, setChain] = useState<ChainItem[]>([])
  // Preferencias de notificación (para respetar el aviso push de confirmación). null = opt-out.
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  // in-flight guard compartido por las acciones de escritura (evita dobles submits).
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  // Error específico del cierre (se muestra en rojo debajo del botón "Cerrar consulta").
  const [closeError, setCloseError] = useState('')
  // Titila el borde de "Notas del médico" ~3s cuando el cierre se bloquea por falta de nota.
  const [notesBlink, setNotesBlink] = useState(false)
  // Dirección cifrada del paciente (solo si can_view_patient_address).
  const [address, setAddress] = useState<string | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [unlockOpen, setUnlockOpen] = useState(false)
  // Consultas con el paciente EN SALA por Realtime Presence (reemplaza el heartbeat + la ventana de
  // tiempo). Es un Set global; abajo se consulta por el id de esta consulta.
  const patientsInRoom = usePatientsInRoom()

  function flagMissingNote(msg: string) {
    setCloseError(msg)
    setNotesBlink(true)
    window.setTimeout(() => setNotesBlink(false), 3000)
  }

  // Cerrar la consulta y agendar seguimiento finalizan el caso: ambos exigen una nota NO vacía
  // y YA persistida (lo escrito sin guardar no queda en el expediente). Devuelve false y titila
  // el recuadro de notas si falta alguna de las dos condiciones.
  function hasSavedNote(action: string): boolean {
    if (!note.trim()) {
      flagMissingNote(`Agrega una nota antes de ${action}.`)
      return false
    }
    if (note !== savedNote) {
      flagMissingNote(`Guarda la nota antes de ${action}.`)
      return false
    }
    return true
  }

  // Aviso push de confirmación de cita, respetando el opt-out del médico.
  async function notifyAppointment(title: string, body: string) {
    if (!isPushEnabled(notifPrefs, 'appointment_confirm')) return
    await requestNotifyPermission()
    notify(title, body)
  }

  useEffect(() => {
    if (!consultationId) return
    init(consultationId)
  }, [consultationId])

  // Preferencias de notificación del médico (para gatear el aviso push de confirmación).
  useEffect(() => {
    if (!profile) return
    ;(async () => {
      try {
        const { prefs } = await fetchNotificationPrefs(await getAccessToken())
        setNotifPrefs(prefs)
      } catch {
        // Si falla, quedan por defecto (opt-out): las notificaciones siguen activas.
      }
    })()
  }, [profile])

  // Estado del caso EN VIVO (Realtime): si un admin lo cierra o cambia, el médico lo ve sin recargar
  // y sin pisar la nota que está escribiendo. La presencia del paciente "en sala" ya NO va por aquí:
  // se lee por Realtime Presence (usePatientsInRoom), sin heartbeat ni polling.
  useEffect(() => {
    if (!consultationId) return
    const channel = supabase
      .channel(`consulta-${consultationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultations',
          filter: `id=eq.${consultationId}`
        },
        (payload) => {
          const row = payload.new as { status: string }
          setConsultation((prev) => (prev ? { ...prev, status: row.status } : prev))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [consultationId])

  async function init(id: string) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login')
      return
    }

    // Perfil propio vía GET /auth/me (backend), ya no la vista `profiles`. Trae id/full_name/role/
    // specialty/active, justo lo que necesita el guard y el "médico asignado = yo".
    let p: Profile
    try {
      const me = await fetchMyProfile(sessionData.session.access_token)
      p = {
        id: me.id,
        full_name: me.full_name,
        role: me.role,
        specialty: me.specialty,
        active: me.active
      }
    } catch {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }

    // Solo `active`: es el gate real, el que mueve el botón "Revocar acceso" del admin.
    // `verified` (users.verified) se quitó de aquí porque nace true y ningún camino del backend
    // la baja — comprobarla era evaluar una constante. El dato de credencial (SACS/FPV) vive en
    // `doctors.verified` y no gatea el acceso: lo supervisa un admin desde su lista.
    if (!p.active) {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }

    if (!isPanelRole(p.role)) {
      router.push('/')
      return
    }

    setProfile(p)
    // La consulta y su interconsulta/cadena son independientes: en serie el detalle esperaba
    // dos round-trips completos de más antes de pintar. `loadConsultation` ya paraleliza lo
    // suyo (médico asignado + eventos) y cada rama conserva su propio manejo de error.
    await Promise.all([loadConsultation(id, p), loadInterconsultation(id)])
    setLoading(false)
  }

  async function loadInterconsultation(id: string) {
    try {
      const token = await getAccessToken()
      // Ambas cuelgan solo de (id, token), no una de la otra: van juntas.
      const [interconsultation, chain] = await Promise.all([
        fetchInterconsultationForConsultation(id, token),
        fetchChain(id, token)
      ])
      setInterconsultation(interconsultation)
      setChain(chain)
    } catch {
      // Silencioso: si falla, simplemente no se muestran interconsulta/cadena.
    }
  }

  // El médico que atiende invita a un médico del pool a una interconsulta (segunda opinión EN VIVO;
  // la consulta sigue abierta). 1 por consulta: si ya hay, el pool no ofrece el botón.
  async function assignInterconsultation(doctor: DoctorPoolItem) {
    if (!consultation || !doctor.user_id) return
    setBusy(true)
    setMessage('')
    try {
      const inter = await createInterconsultation(
        { consultation_id: consultation.id, invited_doctor_id: doctor.user_id },
        await getAccessToken()
      )
      setInterconsultation(inter)
      setPoolOpen(false)
      // Aviso en vivo: sin esto el invitado no la ve hasta recargar (crear una interconsulta no
      // toca `consultations`, que es la única tabla a la que su panel está suscrito).
      notifyInterconsultationAssigned(doctor.user_id)
      setMessage(`Interconsulta asignada a ${inter.invited_doctor_name || 'el médico'}.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo asignar la interconsulta.')
    } finally {
      setBusy(false)
    }
  }

  async function loadConsultation(id: string, currentProfile: Profile | null = profile) {
    let detail
    try {
      detail = await fetchConsultationDetail(id, await getAccessToken())
    } catch (e) {
      console.error(e)
      setMessage('No se pudo cargar la consulta.')
      return
    }

    // El backend anida el paciente como `patient`; el resto del componente usa `patients`.
    const row = { ...detail, patients: detail.patient } as unknown as Consultation
    const canView =
      isAdminRole(currentProfile?.role) || row.assigned_doctor_id === currentProfile?.id
    if (!canView) {
      router.replace('/panel-medico')
      return
    }

    setConsultation(row)
    setNote(row.internal_note || '')
    setSavedNote(row.internal_note || '')
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

    // Nombre del médico asignado (admin viendo el caso de otro): GET /profiles/{id} (backend, staff).
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setAssignedDoctor(null)
      return
    }
    try {
      const doc = await fetchProfile(row.assigned_doctor_id, sessionData.session.access_token)
      setAssignedDoctor({ id: doc.id, full_name: doc.full_name, role: doc.role })
    } catch {
      setAssignedDoctor(null)
    }
  }

  async function loadEvents(consultationId: string) {
    let rows: ConsultationEventItem[]
    try {
      rows = await fetchConsultationEvents(consultationId, await getAccessToken())
    } catch (e) {
      console.error(e)
      setEvents([])
      setEventAuthorsById({})
      return
    }

    // El backend los devuelve ascendente; el panel muestra el más reciente primero.
    setEvents([...rows].reverse() as ConsultationEvent[])

    // El autor viene resuelto en cada evento (author_name/role): armamos el índice para el render,
    // sin leer `users` en el cliente.
    const authors: Record<string, EventAuthor> = {}
    for (const e of rows) {
      if (e.created_by && e.author_name) {
        authors[e.created_by] = {
          id: e.created_by,
          full_name: e.author_name,
          role: e.author_role || ''
        }
      }
    }
    setEventAuthorsById(authors)
  }

  // Carga y descifra la dirección del paciente (solo si can_view_patient_address).
  async function loadAddress() {
    if (!consultation?.patients?.id) return
    setAddressLoading(true)
    setAddressError('')
    try {
      const token = await getAccessToken()
      const { address_encrypted } = await fetchPatientAddress(consultation.patients.id, token)
      if (!address_encrypted) {
        setAddress('Sin dirección registrada.')
        return
      }
      // Intenta descifrar; devuelve null si la clave está bloqueada.
      const decrypted = await decryptAddress(address_encrypted)
      if (decrypted === null) {
        // Clave bloqueada: abre el modal de passphrase.
        setUnlockOpen(true)
        return
      }
      setAddress(decrypted)
    } catch (e) {
      setAddressError(e instanceof Error ? e.message : 'No se pudo obtener la dirección.')
    } finally {
      setAddressLoading(false)
    }
  }

  // Callback cuando el modal de passphrase se cierra con éxito: reintenta descifrar.
  function onAddressUnlocked() {
    loadAddress()
  }

  async function addEvent(consultationId: string, eventType: string, eventNote?: string) {
    await addConsultationEvent(
      consultationId,
      { event_type: eventType, note: eventNote },
      await getAccessToken()
    )
  }

  async function saveNote() {
    if (!consultation || busy) return
    setMessage('')
    setBusy(true)
    try {
      await updateConsultation(consultation.id, { internal_note: note }, await getAccessToken())
      setSavedNote(note)
      setMessage('Nota guardada.')
    } catch {
      setMessage('No se pudo guardar la nota.')
    } finally {
      setBusy(false)
    }
  }

  // Change the case status from the WhatsApp status dropdown (no video / close-button flow).
  // 'closed' ya no está entre las opciones: cerrar es solo vía el botón (con sus guardas).
  async function updateStatus(newStatus: string) {
    if (!consultation || !profile || busy) return
    setMessage('')
    setBusy(true)
    try {
      await updateConsultation(consultation.id, { status: newStatus }, await getAccessToken())
    } catch {
      setBusy(false)
      setMessage('No se pudo actualizar el estado.')
      return
    }
    // Functional update: durante el await, Realtime pudo aplicar otros campos
    // (patient_last_seen_at, o un cierre hecho por un admin) — no pisarlos con
    // el objeto capturado al entrar a la función.
    setConsultation((prev) => (prev ? { ...prev, status: newStatus } : prev))
    await addEvent(
      consultation.id,
      'admin_update',
      `Estado: ${STATUS_LABELS[newStatus] || newStatus} (${profile.full_name})`
    )
    setBusy(false)
    setMessage('Estado actualizado.')
  }

  async function closeConsultation(outcome: 'closed' | 'patient_no_show' = 'closed') {
    if (!consultation || !profile || busy) return
    setMessage('')
    setCloseError('')
    const noShow = outcome === 'patient_no_show'
    // Cierre real (no ausencia): exige una nota NO vacía y YA guardada.
    if (!noShow && !hasSavedNote('cerrar la consulta')) return
    // Ambos caminos finalizan el caso: siempre se confirma (un tap accidental en
    // "no estaba en la sala" cerraba el caso sin vuelta atrás).
    const confirmMsg = noShow
      ? '¿Confirmas que el paciente no estaba en la sala de espera? Esto finaliza el caso.'
      : '¿Seguro que deseas cerrar la consulta? Esta acción la finaliza.'
    if (!window.confirm(confirmMsg)) return
    // No-show cierra sin firma; el cierre real (completada) pide la firma del médico.
    if (noShow) {
      await doClose('patient_no_show')
    } else {
      setSignMode('close')
    }
  }

  // Cierre por el BACKEND (POST /consultations/{id}/close) — reemplaza el UPDATE directo a Supabase
  // (server-side hace anti-IDOR + audit_log + evento + guarda la firma).
  async function doClose(outcome: 'closed' | 'patient_no_show', signature?: string) {
    if (!consultation) return
    setBusy(true)
    try {
      await closeConsultationApi(
        consultation.id,
        { outcome, note: outcome === 'closed' ? note : undefined, signature },
        await getAccessToken()
      )
      router.push('/panel-medico?actualizado=1')
    } catch (e) {
      setBusy(false)
      setCloseError(e instanceof Error ? e.message : 'No se pudo cerrar la consulta.')
    }
  }

  // Agendar seguimiento: cierra esta consulta (firmada) y crea la hija agendada para otra fecha.
  async function doScheduleFollowUp(signature: string) {
    if (!consultation || !scheduledAt) return
    setBusy(true)
    try {
      await scheduleFollowUp(
        consultation.id,
        {
          scheduled_at: new Date(scheduledAt).toISOString(),
          closing_note: note || undefined,
          signature
        },
        await getAccessToken()
      )
      await notifyAppointment(
        'Seguimiento agendado',
        `Cita para ${new Date(scheduledAt).toLocaleString('es-VE')}.`
      )
      router.push('/panel-medico?actualizado=1')
    } catch (e) {
      setBusy(false)
      setMessage(e instanceof Error ? e.message : 'No se pudo agendar el seguimiento.')
    }
  }

  // Derivar con especialista: esta consulta se cierra como derivada (firmada, con el motivo) y el
  // paciente entra a la cola de la especialidad elegida, sin cita y conservando su turno. Lo
  // atiende el primer especialista que lo tome.
  async function doReferToQueue(signature: string) {
    if (!consultation || !referSpecialty || !referReason.trim()) return
    setBusy(true)
    try {
      await referToQueue(
        consultation.id,
        { specialty_id: referSpecialty.id, reason: referReason.trim(), signature },
        await getAccessToken()
      )
      router.push('/panel-medico?actualizado=1')
    } catch (e) {
      setBusy(false)
      setMessage(e instanceof Error ? e.message : 'No se pudo derivar con el especialista.')
    }
  }

  // "Unirse a videoconsulta": la atención es siempre por video. Si el caso no tiene sala (casos
  // tomados antes por WhatsApp), se crea ahora. La ventana se abre dentro del clic de "Entendido".
  async function joinVideo() {
    if (!consultation) return
    let room = consultation.video_room_url
    if (!room) {
      try {
        const { data } = await supabase.auth.getSession()
        room =
          (await ensureVideoRoom(consultation.id, undefined, data.session?.access_token))
            .video_room_url || null
        setConsultation((prev) => (prev ? { ...prev, video_room_url: room } : prev))
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'No se pudo abrir la sala de video.')
        return
      }
    }
    if (room) window.open(browserRoomUrl(room), '_blank', 'noreferrer')
  }

  // El canvas de firma resuelve → dispara el cierre / el agendado / la referencia según el modo.
  function onSign(dataUrl: string) {
    const mode = signMode
    setSignMode(null)
    if (mode === 'close') doClose('closed', dataUrl)
    else if (mode === 'followup') doScheduleFollowUp(dataUrl)
    else if (mode === 'referral') doReferToQueue(dataUrl)
  }

  // "Derivar con especialista": primero la especialidad; luego el motivo y la firma.
  function openReferral() {
    setMessage('')
    setCloseError('')
    setDeriveOpen(true)
  }

  // "Agendar seguimiento": exige la nota guardada (cierra el padre) y abre el selector de fecha.
  function openScheduleFollowUp() {
    setMessage('')
    setCloseError('')
    if (!hasSavedNote('agendar el seguimiento')) return
    setScheduleOpen(true)
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

  const isCaseClosed = FINAL_STATUSES.includes(consultation.status)

  return (
    <>
      <Seo
        titulo="Detalle de consulta — Médicos por Venezuela"
        descripcion={'Detalle del caso, videoconsulta y cierre.'}
        ruta="/panel-medico/consulta"
        noindex
      />
      <main className="page">
        <div className="container">
          <div className="detail-topbar">
            <div>
              <button className="link-button" onClick={() => router.push('/panel-medico')}>
                ← Volver al panel médico
              </button>
              <h1 style={{ margin: '8px 0 0' }}>Detalle de consulta</h1>
              <p style={{ margin: 0, color: '#64748b' }}>
                Caso {consultation.code} · hace {tiempoTranscurrido(consultation.created_at)}
              </p>
            </div>
            <span className={`badge ${statusBadgeClass(consultation.status)}`}>
              {STATUS_LABELS[consultation.status] || consultation.status}
            </span>
          </div>

          {/* Unirse a la videoconsulta: acción principal, arriba de todo (antes del paciente).
              La atención es siempre por video: aparece en todo caso abierto, y si no tiene sala
              (tomado antes por WhatsApp) se crea al entrar. No en casos finalizados. */}
          {!isCaseClosed && (
            <button
              className="btn btn-primary btn-full"
              onClick={() => setAvisoVideo(true)}
              style={{ marginBottom: 16 }}
            >
              Unirse a videoconsulta
            </button>
          )}

          {/* Acciones de referencia/agenda, en una fila debajo del encabezado. */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              style={{ flex: '1 1 160px' }}
              onClick={() => setPoolOpen(true)}
            >
              Ver Pool de médicos (pedir interconsulta)
            </button>
            <button
              className="btn btn-outline"
              style={{ flex: '1 1 160px' }}
              onClick={openScheduleFollowUp}
              disabled={isCaseClosed}
            >
              Agendar seguimiento
            </button>
            <button
              className="btn btn-outline"
              style={{ flex: '1 1 160px' }}
              onClick={openReferral}
              disabled={isCaseClosed}
            >
              Derivar con especialista
            </button>
          </div>

          {consultation.derivation && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              ↪ Paciente derivado
              {consultation.derivation.from_specialty
                ? ` desde ${consultation.derivation.from_specialty}`
                : ''}
              {consultation.derivation.by_name ? (
                <>
                  {' '}
                  por <strong>{consultation.derivation.by_name}</strong>
                </>
              ) : null}
              {consultation.derivation.reason ? (
                <>
                  : <em>{consultation.derivation.reason}</em>
                </>
              ) : (
                '.'
              )}
            </div>
          )}

          {interconsultation && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              🩺 Interconsulta asignada a{' '}
              <strong>{interconsultation.invited_doctor_name || 'un médico'}</strong>. Ve el motivo,
              las notas y la edad del paciente, y puede unirse a esta videoconsulta.
            </div>
          )}

          {message && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          {chain.length > 1 && (
            <section className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Historial de seguimiento</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
                Cadena de consultas (de la más antigua a la más reciente).
              </p>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {chain.map((link) => (
                  <li key={link.id} style={{ marginBottom: 6 }}>
                    <strong>{link.code}</strong>{' '}
                    <span className="badge" style={{ background: '#e2e8f0', color: '#475569' }}>
                      {STATUS_LABELS[link.status] || link.status}
                    </span>
                    {link.scheduled_at && (
                      <span style={{ color: '#64748b' }}>
                        {' '}
                        · agendada {new Date(link.scheduled_at).toLocaleString('es-VE')}
                      </span>
                    )}
                    {link.id === consultation.id && (
                      <span style={{ color: '#0d9488' }}> · (esta)</span>
                    )}
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      {link.chief_complaint || 'Sin motivo'}
                      {link.internal_note ? ` — ${link.internal_note}` : ''}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="detail-grid">
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Paciente</h2>
              <h3 style={{ marginBottom: 4 }}>{consultation.patients?.full_name || 'Paciente'}</h3>
              <p style={{ marginTop: 0, color: '#64748b' }}>
                {consultation.patients?.affected_zone || 'Zona no indicada'} ·{' '}
                {consultation.patients?.age_range || 'Edad no indicada'}
              </p>
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>
                Cédula / DNI: {consultation.patients?.cedula || '—'}
              </p>
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>
                Tel. (solo seguimiento): {consultation.patients?.phone_whatsapp || '—'}
              </p>
              {consultation.patients?.emergency_phone && (
                <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>
                  Tel. emergencia: {consultation.patients.emergency_phone}
                </p>
              )}
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>
                Email (opcional): {consultation.patients?.email || '—'}
              </p>
              <div style={{ marginTop: 10 }}>
                <EstadoPacienteBadge
                  enteredCallAt={consultation.entered_call_at}
                  inRoom={patientsInRoom.has(consultation.id)}
                />
              </div>
              <div className="tag-row" style={{ marginTop: 12 }}>
                {consultation.patients?.needs_tags?.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </section>

            {/* Dirección: solo si el backend dice que este médico la puede ver. */}
            {consultation.can_view_patient_address && (
              <section className="card">
                <h2 style={{ marginTop: 0 }}>Dirección</h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
                  Esta dirección va cifrada de extremo a extremo; solo la ve el médico tratante.
                </p>
                {!address && !addressLoading && !addressError && (
                  <button
                    className="btn btn-outline"
                    onClick={loadAddress}
                    disabled={busy}
                    style={{ marginTop: 8 }}
                  >
                    Ver dirección
                  </button>
                )}
                {addressLoading && <p style={{ marginTop: 8, color: '#64748b' }}>Cargando…</p>}
                {address && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{address}</p>
                    <button
                      className="btn btn-muted"
                      onClick={() => setAddress(null)}
                      style={{ marginTop: 8 }}
                    >
                      Ocultar
                    </button>
                  </div>
                )}
                {addressError && (
                  <div className="notice notice-danger" style={{ marginTop: 8 }}>
                    {addressError}
                  </div>
                )}
              </section>
            )}

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Motivo</h2>
              <div className="notice">
                {consultation.chief_complaint ||
                  consultation.patients?.description ||
                  'Sin descripción'}
              </div>
              {consultation.specialty && (
                <p style={{ color: '#64748b', marginBottom: 0 }}>
                  Especialidad: <strong>{consultation.specialty}</strong>
                </p>
              )}
              {consultation.category && (
                <p style={{ color: '#64748b' }}>Tipo de ayuda: {consultation.category}</p>
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
                  <strong>Especialidad:</strong> {consultation.specialty || '—'}
                  {consultation.derived_from_specialty && (
                    <> (derivada desde {consultation.derived_from_specialty})</>
                  )}
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

            <section className="card detail-full-span">
              <h2 style={{ marginTop: 0 }}>Gestión de la consulta</h2>
              <div className="detail-actions">
                {isCaseClosed && (
                  <div className="notice">
                    Este caso ya está finalizado (
                    {STATUS_LABELS[consultation.status] || consultation.status}). Solo la nota sigue
                    editable.
                  </div>
                )}
                {consultation.attended_via_whatsapp && !isCaseClosed && (
                  <div>
                    <label className="label">Estado del caso</label>
                    <select
                      value={consultation.status}
                      disabled={busy}
                      onChange={(e) => updateStatus(e.target.value)}
                    >
                      {WHATSAPP_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Notas del médico</label>
                  <textarea
                    className={notesBlink ? 'note-blink' : undefined}
                    rows={6}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Evita escribir historia clínica completa. Solo información necesaria para coordinación."
                  />
                </div>
                <button className="btn btn-secondary" onClick={saveNote} disabled={busy}>
                  Guardar nota
                </button>

                {!consultation.attended_via_whatsapp && !isCaseClosed && (
                  <button
                    className="btn btn-outline btn-full"
                    onClick={() => closeConsultation('patient_no_show')}
                    disabled={busy}
                  >
                    Paciente no estaba en la sala de espera
                  </button>
                )}

                {/* Cerrar consulta: al final. Exige nota guardada + confirmación (ver closeConsultation). */}
                {!isCaseClosed && (
                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => closeConsultation('closed')}
                    disabled={busy}
                  >
                    Cerrar consulta
                  </button>
                )}
                {/* Error del cierre: en rojo, JUSTO debajo del botón. */}
                {closeError && (
                  <p style={{ color: '#dc2626', fontWeight: 500, fontSize: 14, margin: '4px 0 0' }}>
                    {closeError}
                  </p>
                )}
              </div>
            </section>
          </div>

          <AntesDeEntrarModal
            para="medico"
            open={avisoVideo}
            // El correo "tu médico te está esperando" solo sale al tomar el caso POR VIDEO y si
            // el paciente dejó correo (ver video_ready_mail_args en el backend).
            pacienteSinCorreo={!consultation.patients?.email || consultation.attended_via_whatsapp}
            onCancel={() => setAvisoVideo(false)}
            onConfirm={() => {
              setAvisoVideo(false)
              // Dentro del clic de "Entendido": fuera de un gesto el navegador bloquea el pop-up.
              joinVideo()
            }}
          />

          <DoctorPoolModal
            open={poolOpen}
            onClose={() => setPoolOpen(false)}
            onAssignInterconsultation={!interconsultation ? assignInterconsultation : undefined}
          />

          <DerivarEspecialidadModal
            open={deriveOpen}
            currentSpecialty={consultation.specialty}
            title="Derivar con especialista"
            hint="Elige la especialidad. Después escribes el motivo y firmas; el paciente pasa a la cola de esa especialidad, sin cita, y conserva su turno."
            confirmLabel="Continuar"
            onClose={() => setDeriveOpen(false)}
            onPick={(target) => {
              setReferSpecialty(target)
              setDeriveOpen(false)
            }}
          />

          <UnlockClinicalKeyModal
            open={unlockOpen}
            onClose={() => setUnlockOpen(false)}
            onUnlocked={onAddressUnlocked}
          />

          {signMode && (
            <SignaturePad
              onSign={onSign}
              onCancel={() => setSignMode(null)}
              busy={busy}
              title={
                signMode === 'followup'
                  ? 'Firma para agendar el seguimiento'
                  : signMode === 'referral'
                    ? 'Firma la derivación al especialista'
                    : 'Firma para cerrar la consulta'
              }
              hint={
                signMode === 'referral'
                  ? 'Firma para dejar constancia de la derivación (motivo y especialidad).'
                  : undefined
              }
            />
          )}

          {scheduleOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Agendar seguimiento"
              onClick={() => setScheduleOpen(false)}
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
                <h2 style={{ marginTop: 0 }}>Agendar seguimiento</h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
                  Se cierra esta consulta (firmada) y se crea una nueva agendada para la fecha que
                  elijas. Queda en tu agenda y en la del paciente.
                </p>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  style={{ width: '100%', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-muted" onClick={() => setScheduleOpen(false)}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ marginLeft: 'auto' }}
                    disabled={!scheduledAt}
                    onClick={() => {
                      setScheduleOpen(false)
                      setSignMode('followup')
                    }}
                  >
                    Continuar a la firma
                  </button>
                </div>
              </div>
            </div>
          )}

          {referSpecialty && !signMode && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Derivar con especialista"
              onClick={() => setReferSpecialty(null)}
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
                <h2 style={{ marginTop: 0 }}>Derivar con especialista</h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
                  Derivas este caso a <strong>{referSpecialty.name}</strong>. Tu consulta se cierra
                  (firmada) y el paciente entra a la cola de esa especialidad, sin cita y
                  conservando su turno. El especialista que lo tome verá tu motivo.{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setReferSpecialty(null)
                      setDeriveOpen(true)
                    }}
                  >
                    Cambiar especialidad
                  </button>
                </p>
                <label className="label" htmlFor="motivo-derivacion">
                  Motivo de la derivación
                </label>
                <textarea
                  id="motivo-derivacion"
                  rows={3}
                  value={referReason}
                  onChange={(e) => setReferReason(e.target.value)}
                  placeholder="Por qué derivas al paciente a esta especialidad."
                  style={{ width: '100%', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-muted" onClick={() => setReferSpecialty(null)}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ marginLeft: 'auto' }}
                    disabled={!referReason.trim()}
                    onClick={() => setSignMode('referral')}
                  >
                    Continuar a la firma
                  </button>
                </div>
              </div>
            </div>
          )}
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

        /* Borde de "Notas del médico" titilando ~3s cuando falta la nota al cerrar. */
        .note-blink {
          animation: note-blink 0.5s ease-in-out 0s 6;
        }
        @keyframes note-blink {
          0%,
          100% {
            border-color: #dc2626;
            box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.25);
          }
          50% {
            border-color: #cbd5e1;
            box-shadow: none;
          }
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
