import { ApiError, deleteJson, getJson, postJson } from './apiClient'

export { ApiError }

// DELETE /api/v1/patients/{id} — baja lógica (soft delete): el backend marca deleted_at y lo filtra
// de las listas; NO borra la fila (trazabilidad). Reemplaza la RPC admin_delete_patient.
export async function archivePatient(id: string, token: string): Promise<void> {
  return deleteJson(`/api/v1/patients/${id}`, 'No se pudo archivar el paciente', token)
}

// GET /api/v1/patients/me — registros de paciente ligados a la cuenta del llamante (portal del
// paciente / mi-caso). Reemplaza la lectura directa a `patients` (RLS patients_select_own).
export interface MyPatient {
  id: string
  full_name: string
}
export async function fetchMyPatients(token: string): Promise<MyPatient[]> {
  return getJson<MyPatient[]>('/api/v1/patients/me', 'No se pudieron cargar tus datos', token)
}

export interface PatientCreate {
  full_name: string
  phone_whatsapp: string
  affected_zone: string
  cedula?: string | null
  age_range?: string | null
  email?: string | null
  needs_tags?: string[]
  description?: string | null
  allergies?: string | null
  parent_id?: string | null
  parentesco?: string | null
  user_id?: string | null
  consent: boolean
}

export interface PatientResponse {
  id: string
  full_name: string
  cedula?: string | null
}

export interface ConsultationCreate {
  patient_id: string
  priority?: string
  category?: string | null
  chief_complaint?: string | null
  referred_specialty?: string | null
  platform_used?: string | null
  specialty_id?: string | null
  status?: string
}

export interface ConsultationResponse {
  id: string
  code: string
  video_room_url?: string | null
}

// POST /consultations devuelve además el token de acceso a la sala. Es la ÚNICA vez que se
// entrega: el paciente anónimo no tiene sesión con la que volver a pedirlo. Los demás endpoints
// devuelven ConsultationResponse a secas, sin token.
export interface ConsultationCreatedResponse extends ConsultationResponse {
  access_token: string
}

// POST /api/v1/patients — público.
export async function createPatient(payload: PatientCreate): Promise<PatientResponse> {
  return postJson<PatientResponse>('/api/v1/patients', payload, 'No se pudo registrar al paciente')
}

// POST /api/v1/consultations — público. No enviar `code`: lo genera un trigger en la DB.
export async function createConsultation(
  payload: ConsultationCreate
): Promise<ConsultationCreatedResponse> {
  return postJson<ConsultationCreatedResponse>(
    '/api/v1/consultations',
    payload,
    'No se pudo crear la consulta'
  )
}

// Credencial de la sala del paciente anónimo: la emite POST /consultations y caduca a las 24 h.
// Antes bastaba el id de la consulta, que era un secreto ETERNO y viaja en la URL (historial,
// Referer, vistas previas de WhatsApp, capturas). Ver src/core/consultation_token.py del backend.
const ROOM_TOKEN_HEADER = 'X-Consultation-Token'

function roomHeaders(roomToken?: string): Record<string, string> {
  return roomToken ? { [ROOM_TOKEN_HEADER]: roomToken } : {}
}

// POST /api/v1/consultations/{id}/video-room — idempotente: genera la sala Jitsi si la consulta
// sigue en espera, o devuelve la existente. Reemplaza al viejo /api/videoconsulta de Next (que
// necesitaba el service_role en el hosting del frontend y moría en Amplify con 500): la sala
// SIEMPRE la crea el backend. Sin sesión, pero exige el token de acceso de ESA consulta.
// Dos clientes: el paciente anónimo manda `roomToken`; el médico desde el panel manda su
// `sessionToken` de Supabase (no tiene el token del paciente, y no debe necesitarlo para abrir
// la sala del caso que atiende). El backend acepta cualquiera de los dos.
export async function ensureVideoRoom(
  consultationId: string,
  roomToken?: string,
  sessionToken?: string
): Promise<ConsultationResponse> {
  return postJson<ConsultationResponse>(
    `/api/v1/consultations/${consultationId}/video-room`,
    {},
    'No se pudo iniciar la videoconsulta',
    sessionToken,
    roomHeaders(roomToken)
  )
}

// POST /api/v1/consultations/{id}/entered-call — idempotente: marca que el paciente entró a la
// videollamada (entered_call_at, una sola vez). Reemplaza la RPC mark_patient_entered_call.
export async function markEnteredCall(
  consultationId: string,
  roomToken?: string
): Promise<ConsultationResponse> {
  return postJson<ConsultationResponse>(
    `/api/v1/consultations/${consultationId}/entered-call`,
    {},
    'No se pudo registrar la entrada a la videollamada',
    undefined,
    roomHeaders(roomToken)
  )
}
