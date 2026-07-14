import { ApiError, postJson } from './apiClient'

export { ApiError }

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

// POST /api/v1/patients — público.
export async function createPatient(payload: PatientCreate): Promise<PatientResponse> {
  return postJson<PatientResponse>('/api/v1/patients', payload, 'No se pudo registrar al paciente')
}

// POST /api/v1/consultations — público. No enviar `code`: lo genera un trigger en la DB.
export async function createConsultation(
  payload: ConsultationCreate
): Promise<ConsultationResponse> {
  return postJson<ConsultationResponse>(
    '/api/v1/consultations',
    payload,
    'No se pudo crear la consulta'
  )
}

// POST /api/v1/consultations/{id}/video-room — público e idempotente: genera la sala Jitsi si la
// consulta sigue en espera, o devuelve la existente. Reemplaza al viejo /api/videoconsulta de
// Next (que necesitaba el service_role en el hosting del frontend y moría en Amplify con 500):
// la sala SIEMPRE la crea el backend.
export async function ensureVideoRoom(consultationId: string): Promise<ConsultationResponse> {
  return postJson<ConsultationResponse>(
    `/api/v1/consultations/${consultationId}/video-room`,
    {},
    'No se pudo iniciar la videoconsulta'
  )
}
