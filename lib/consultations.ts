// Cliente del backend (api-medicos-por-venezuela) para el panel médico: perfil propio, cola de
// consultas y el claim atómico de una consulta. Reemplaza los accesos directos a Supabase/PostgREST
// del panel — el único acceso directo que queda es Realtime (solo para avisar que algo cambió) y
// Auth. Los datos siempre vienen por el backend.
import { getJson, patchJson, postJson } from './apiClient'
import { Consultation, IN_PROGRESS_STATUSES, Patient } from './admin'

export { ApiError } from './apiClient'

// GET /api/v1/auth/me — perfil del titular del JWT (reemplaza la lectura directa a `profiles`).
// Trae también el contexto de médico (has_doctor_profile / doctor_cedula) para que el panel decida
// el redirect a completar perfil SIN una segunda llamada a /doctors/me.
export interface MyProfile {
  id: string
  full_name: string
  role: string
  role_chosen: boolean
  specialty: string | null
  verified: boolean
  active: boolean
  has_doctor_profile: boolean
  doctor_cedula: string | null
}

// Al cargar una página autenticada, /auth/me se pedía 3 VECES en paralelo: PresenceProvider lo
// llama al montar Y otra vez cuando `onAuthStateChange` emite INITIAL_SESSION, y encima la página
// (panel-medico, useAdminGuard, mi-caso…) lo pide por su cuenta. Como salen a la vez, ninguna
// aprovecha la caché de preflight del navegador: son 3 OPTIONS + 3 GET, y cada GET cuesta 4
// queries en el backend. Se coalescen aquí, en la función compartida, en vez de reordenar el
// ciclo de vida de cada caller.
//
// La clave incluye el token: otra sesión (u otro usuario) nunca reusa este resultado. La ventana
// es corta a propósito — coalescer la ráfaga del montaje, no cachear el perfil: un cambio de rol
// se ve en la siguiente carga igual que antes.
const PROFILE_COALESCE_MS = 5000
let inflightProfile: { token: string; at: number; promise: Promise<MyProfile> } | null = null

export async function fetchMyProfile(token: string): Promise<MyProfile> {
  const now = Date.now()
  if (inflightProfile && inflightProfile.token === token) {
    if (now - inflightProfile.at < PROFILE_COALESCE_MS) return inflightProfile.promise
  }
  const promise = getJson<MyProfile>('/api/v1/auth/me', 'No se pudo cargar tu perfil', token)
  const entry = { token, at: now, promise }
  inflightProfile = entry
  // Un fallo NO se cachea: si el siguiente caller reintenta, que salga de verdad a la red.
  promise.catch(() => {
    if (inflightProfile === entry) inflightProfile = null
  })
  return promise
}

// GET /api/v1/consultations (vista de paciente): el backend la scopea a las consultas del propio
// paciente (Patient.user_id == caller) y devuelve la vista reducida (sin notas del staff). Para el
// portal del paciente (mi-caso); reemplaza la lectura directa a `consultations`.
export interface MyConsultation {
  id: string
  code: string
  status: string
  category: string | null
  chief_complaint: string | null
  referred_specialty: string | null
  created_at: string
  scheduled_at: string | null
}
export async function fetchMyConsultations(token: string): Promise<MyConsultation[]> {
  return getJson<MyConsultation[]>(
    '/api/v1/consultations',
    'No se pudieron cargar tus consultas',
    token
  )
}

export interface PanelPatient {
  id: string
  // Opcional a propósito: en la cola de ESPERA (waiting) el backend NO envía el nombre por
  // seguridad; solo llega en las consultas ya tomadas por el médico (mine).
  full_name?: string
  cedula: string | null
  phone_whatsapp: string | null
  affected_zone: string | null
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
  // Presente también en la cola de espera (sin nombre): el médico las necesita para decidir si
  // toma el caso, no después de abrirlo.
  allergies: string | null
}

export interface PanelConsultation {
  id: string
  code: string
  status: string
  priority: string
  category: string | null
  // Nombre de la especialidad solicitada (specialty_id resuelta por el backend): la columna
  // con la que la consulta matchea con el médico. null en consultas viejas (fallback legacy).
  specialty: string | null
  chief_complaint: string | null
  referred_specialty: string | null
  video_room_url: string | null
  assigned_doctor_id: string | null
  attended_via_whatsapp: boolean
  opened_at: string | null
  closed_at: string | null
  patient_last_seen_at: string | null
  created_at: string
  patient: PanelPatient | null
}

export interface PanelResponse {
  waiting: PanelConsultation[]
  mine: PanelConsultation[]
  my_closed_count: number
}

// GET /api/v1/consultations/panel — cola de espera + mis consultas abiertas + cerradas por mí.
export async function fetchPanel(token: string): Promise<PanelResponse> {
  return getJson<PanelResponse>(
    '/api/v1/consultations/panel',
    'No se pudieron cargar las consultas',
    token
  )
}

// POST /api/v1/consultations/{id}/claim — toma atómica. Lanza ApiError 409 si otro médico la
// tomó primero (condición de carrera resuelta en la base, un único ganador).
export async function claimConsultation(
  id: string,
  viaWhatsapp: boolean,
  token: string
): Promise<PanelConsultation> {
  return postJson<PanelConsultation>(
    `/api/v1/consultations/${id}/claim`,
    { via_whatsapp: viaWhatsapp },
    'No se pudo tomar la consulta',
    token
  )
}

// --- Monitor admin de consultas "en progreso" (ver components/admin/ConsultationsMonitorModal.tsx) ---

// Subconjunto de ConsultationResponse (backend) que necesita el monitor: estado, nombres
// resueltos server-side (patient_name / assigned_doctor_name), y los timestamps para calcular el
// tiempo en progreso.
export interface ConsultationMonitorItem {
  id: string
  code: string
  status: string
  chief_complaint: string | null
  patient_name: string | null
  assigned_doctor_name: string | null
  queued_at: string
  started_at: string | null
  opened_at: string | null
}

// El endpoint solo acepta un `status` a la vez (ver src/routers/consultations.py::list_consultations
// del backend — no hay filtro multi-status), así que se pide una página por cada status del set
// amplio "en progreso" (mismo set que usa el KPI, `lib/admin.ts::IN_PROGRESS_STATUSES`) y se
// combinan los resultados. 100 es el límite máximo permitido por el backend (`le=100`).
const PAGE_LIMIT = 100

export async function fetchInProgressConsultations(
  token: string
): Promise<ConsultationMonitorItem[]> {
  // allSettled (no all): que un status puntual falle en el backend no debe tumbar todo
  // el modal. Si TODAS fallan, propagamos el primer error para que el modal lo muestre;
  // si al menos una responde, mostramos lo que se pudo cargar.
  const results = await Promise.allSettled(
    IN_PROGRESS_STATUSES.map((status) =>
      getJson<ConsultationMonitorItem[]>(
        `/api/v1/consultations?status=${encodeURIComponent(status)}&limit=${PAGE_LIMIT}`,
        'No se pudieron cargar las consultas en progreso',
        token
      )
    )
  )
  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<ConsultationMonitorItem[]> => r.status === 'fulfilled'
  )
  if (fulfilled.length === 0) {
    throw (results[0] as PromiseRejectedResult).reason
  }
  return fulfilled.flatMap((r) => r.value)
}

// --- Agenda / seguimiento (módulo Agenda; NO confundir con Interconsulta en vivo) ---

// Cita agendada / consulta de la agenda (subset de ConsultationResponse del backend).
export interface AgendaConsultation {
  id: string
  code: string
  status: string
  chief_complaint: string | null
  patient_name: string | null
  assigned_doctor_name: string | null
  scheduled_at: string | null
  parent_consultation_id: string | null
  video_room_url: string | null
  created_at: string
}

// Un eslabón de la cadena de seguimiento (historial padre→hijas).
export interface ChainItem {
  id: string
  code: string
  status: string
  chief_complaint: string | null
  internal_note: string | null
  scheduled_at: string | null
  closed_at: string | null
  created_at: string
  parent_consultation_id: string | null
}

// POST /consultations/{id}/close — cierra la consulta (firmada) por el BACKEND (reemplaza el UPDATE
// directo a Supabase). outcome 'closed' | 'patient_no_show'.
export async function closeConsultationApi(
  id: string,
  body: { outcome: 'closed' | 'patient_no_show'; note?: string; signature?: string },
  token: string
): Promise<AgendaConsultation> {
  return postJson<AgendaConsultation>(
    `/api/v1/consultations/${id}/close`,
    body,
    'No se pudo cerrar la consulta',
    token
  )
}

// POST /consultations/{id}/schedule-follow-up — cierra la consulta (firmada) y crea la hija agendada.
export async function scheduleFollowUp(
  id: string,
  body: { scheduled_at: string; closing_note?: string; signature?: string },
  token: string
): Promise<AgendaConsultation> {
  return postJson<AgendaConsultation>(
    `/api/v1/consultations/${id}/schedule-follow-up`,
    body,
    'No se pudo agendar el seguimiento',
    token
  )
}

// POST /consultations/{id}/refer — Agendar con especialista: entrega la consulta a OTRO médico (la
// actual queda 'referred_to_specialist') y crea la hija agendada asignada a ese médico, firmada.
export async function scheduleReferral(
  id: string,
  body: { invited_doctor_id: string; scheduled_at: string; reason: string; signature?: string },
  token: string
): Promise<AgendaConsultation> {
  return postJson<AgendaConsultation>(
    `/api/v1/consultations/${id}/refer`,
    body,
    'No se pudo agendar con el especialista',
    token
  )
}

// GET /consultations/agenda — mi agenda (citas agendadas del médico autenticado).
export async function fetchAgenda(token: string): Promise<AgendaConsultation[]> {
  return getJson<AgendaConsultation[]>(
    '/api/v1/consultations/agenda',
    'No se pudo cargar la agenda',
    token
  )
}

// GET /consultations/{id}/chain — historial de la cadena de seguimiento (padre→hijas).
export async function fetchChain(id: string, token: string): Promise<ChainItem[]> {
  return getJson<ChainItem[]>(
    `/api/v1/consultations/${id}/chain`,
    'No se pudo cargar el historial',
    token
  )
}

// --- Detalle de consulta (panel médico): reemplaza el acceso directo a Supabase ---
export interface ConsultationDetailPatient {
  id: string
  full_name: string
  cedula: string | null
  phone_whatsapp: string | null
  email: string | null
  affected_zone: string | null
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
}

// GET /consultations/{id}: la consulta con el paciente anidado (solo staff que puede verla).
export interface ConsultationDetail {
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
  scheduled_at: string | null
  patient: ConsultationDetailPatient | null
}

export async function fetchConsultationDetail(
  id: string,
  token: string
): Promise<ConsultationDetail> {
  return getJson<ConsultationDetail>(
    `/api/v1/consultations/${id}`,
    'No se pudo cargar la consulta',
    token
  )
}

// PATCH /consultations/{id}: estado y/o nota interna (reemplaza el UPDATE directo a Supabase).
export async function updateConsultation(
  id: string,
  body: {
    status?: string
    internal_note?: string
    // Campos que edita el panel admin/pacientes (además del panel médico).
    assigned_doctor_id?: string | null
    specialty_id?: string | null
    admin_seguimiento?: string | null
    nota_admin?: string | null
    contacted?: boolean
    closed_at?: string | null
  },
  token: string
): Promise<ConsultationDetail> {
  return patchJson<ConsultationDetail>(
    `/api/v1/consultations/${id}`,
    body,
    'No se pudo actualizar la consulta',
    token
  )
}

// GET /api/v1/consultations — lista completa para staff, con el paciente anidado y los campos de
// gestión admin (admin_seguimiento/nota_admin) + assigned_doctor_name resuelto server-side. El panel
// admin/pacientes la consume en vez de leer `consultations`/`patients`/`users` directo de Supabase.
export async function fetchConsultations(
  token: string,
  params: { limit?: number; status?: string; patientId?: string } = {}
): Promise<Consultation[]> {
  const qs = new URLSearchParams()
  qs.set('limit', String(params.limit ?? 200))
  if (params.status) qs.set('status', params.status)
  if (params.patientId) qs.set('patient_id', params.patientId)
  const rows = await getJson<(Omit<Consultation, 'patients'> & { patient: Patient | null })[]>(
    `/api/v1/consultations?${qs.toString()}`,
    'No se pudieron cargar las consultas',
    token
  )
  // El backend anida el paciente en `patient`; el panel usa `patients` (alias histórico del join).
  return rows.map(({ patient, ...c }) => ({ ...c, patients: patient }))
}

// Evento del historial, con el AUTOR ya resuelto por el backend (sin leer `users` en el cliente).
export interface ConsultationEventItem {
  id: string
  event_type: string
  note: string | null
  created_by: string | null
  created_at: string
  author_name: string | null
  author_role: string | null
}

export async function fetchConsultationEvents(
  id: string,
  token: string
): Promise<ConsultationEventItem[]> {
  return getJson<ConsultationEventItem[]>(
    `/api/v1/consultations/${id}/events`,
    'No se pudo cargar el historial',
    token
  )
}

export async function addConsultationEvent(
  id: string,
  body: { event_type: string; note?: string },
  token: string
): Promise<ConsultationEventItem> {
  return postJson<ConsultationEventItem>(
    `/api/v1/consultations/${id}/events`,
    { consultation_id: id, ...body },
    'No se pudo registrar el evento',
    token
  )
}
