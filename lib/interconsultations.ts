// Cliente de Interconsultas (segunda opinión en tiempo real). Ver .knowledge/interconsultas.md del
// backend. NO confundir con "Agendar con Especialista" (que cierra la consulta y agenda otro día).
import { getJson, postJson } from './apiClient'

// Lo que ve el médico que ATIENDE (a quién invitó).
export interface Interconsultation {
  id: string
  consultation_id: string
  invited_doctor_id: string
  invited_doctor_name: string | null
  created_by_id: string
  status: string
  note: string | null
  created_at: string
}

// Vista LIMITADA del médico INVITADO: solo motivo, notas y edad — sin identidad del paciente.
export interface InterconsultationForInvitee {
  id: string
  consultation_id: string
  status: string
  note: string | null
  chief_complaint: string | null
  internal_note: string | null
  clinical_notes: string | null
  patient_age_range: string | null
  video_room_url: string | null
  created_at: string
}

// POST /interconsultations — el médico que atiende invita a un médico del pool.
export async function createInterconsultation(
  params: { consultation_id: string; invited_doctor_id: string; note?: string },
  token: string
): Promise<Interconsultation> {
  return postJson<Interconsultation>(
    '/api/v1/interconsultations',
    params,
    'No se pudo asignar la interconsulta',
    token
  )
}

// GET /interconsultations/for-consultation/{id} — la interconsulta activa de una consulta (o null).
export async function fetchInterconsultationForConsultation(
  consultationId: string,
  token: string
): Promise<Interconsultation | null> {
  return getJson<Interconsultation | null>(
    `/api/v1/interconsultations/for-consultation/${consultationId}`,
    'No se pudo cargar la interconsulta',
    token
  )
}

// GET /interconsultations/me — mis interconsultas asignadas (médico invitado, datos limitados).
export async function fetchMyInterconsultations(
  token: string
): Promise<InterconsultationForInvitee[]> {
  return getJson<InterconsultationForInvitee[]>(
    '/api/v1/interconsultations/me',
    'No se pudieron cargar tus interconsultas',
    token
  )
}
