// Cliente del backend (api-medicos-por-venezuela) para el panel médico: perfil propio, cola de
// consultas y el claim atómico de una consulta. Reemplaza los accesos directos a Supabase/PostgREST
// del panel — el único acceso directo que queda es Realtime (solo para avisar que algo cambió) y
// Auth. Los datos siempre vienen por el backend.
import { getJson, postJson } from './apiClient'

export { ApiError } from './apiClient'

// GET /api/v1/auth/me — perfil del titular del JWT (reemplaza la lectura directa a `profiles`).
// Trae también el contexto de médico (has_doctor_profile / doctor_cedula) para que el panel decida
// el redirect a completar perfil SIN una segunda llamada a /doctors/me.
export interface MyProfile {
  id: string
  full_name: string
  role: string
  specialty: string | null
  verified: boolean
  active: boolean
  has_doctor_profile: boolean
  doctor_cedula: string | null
}

export async function fetchMyProfile(token: string): Promise<MyProfile> {
  return getJson<MyProfile>('/api/v1/auth/me', 'No se pudo cargar tu perfil', token)
}

export interface PanelPatient {
  id: string
  full_name: string
  cedula: string | null
  phone_whatsapp: string | null
  affected_zone: string | null
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
}

export interface PanelConsultation {
  id: string
  code: string
  status: string
  priority: string
  category: string | null
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
