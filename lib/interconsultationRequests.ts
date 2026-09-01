// Cliente de la interconsulta ASÍNCRONA (pacientes de consultorio).
//
// NO confundir con lib/interconsultations.ts, que es la segunda opinión EN VIVO durante una
// consulta activa de la cola, con video compartido. Son dos flujos distintos; ver
// .knowledge/interconsultas.md del backend, que documenta los cuatro.
import { ApiError, getJson, postJson } from './apiClient'

export { ApiError }

const BASE = '/api/v1/interconsultation-requests'

// Contacto de un COLEGA (nunca de un paciente): con esto se hablan fuera de la plataforma.
export interface DoctorContact {
  id: string
  full_name: string
  whatsapp_number?: string | null
  email?: string | null
}

export type RequestMode = 'specialty' | 'doctor'
export type RequestStatus = 'open' | 'taken' | 'closed' | 'cancelled'

export interface InterconsultationRequestCreate {
  patient_id: string
  mode: RequestMode
  // En modo 'specialty' va la especialidad; en modo 'doctor' va el médico y la especialidad la
  // deriva el backend de su ficha. Mandar ambos es 422.
  specialty_id?: string | null
  target_doctor_id?: string | null
  chief_complaint: string
  clinical_notes?: string | null
}

// Lo que ve el MÉDICO TRATANTE de su propia solicitud.
export interface InterconsultationRequest {
  id: string
  patient_id: string
  patient_name?: string | null
  mode: RequestMode
  specialty_id: string
  specialty_name?: string | null
  chief_complaint: string
  clinical_notes?: string | null
  status: RequestStatus
  // A cuántos especialistas elegibles se les avisó. Alimenta el "se notificó a N colegas".
  notified_count: number
  created_at: string
  taken_at?: string | null
  closed_at?: string | null
  cancelled_at?: string | null
  target_doctor?: DoctorContact | null
  taken_by?: DoctorContact | null
}

// Vista ANONIMIZADA del especialista ANTES de tomar el caso.
//
// Este tipo declara exactamente lo que el backend devuelve y nada más: sin nombre, cédula,
// teléfono, correo ni zona del paciente, y sin identidad del médico que pide. Si algún día
// aparece aquí un campo de PII, es una regresión del backend — no lo agregues al tipo.
export interface InterconsultationInboxItem {
  id: string
  specialty_id: string
  specialty_name?: string | null
  chief_complaint: string
  clinical_notes?: string | null
  patient_age_range?: string | null
  // La solicitud venía dirigida a este especialista en concreto (modo 'doctor').
  dirigida_a_mi: boolean
  created_at: string
}

// Lo que recibe el especialista AL TOMAR: se suma el contacto del médico TRATANTE, nunca del
// paciente. Es el objetivo del flujo — que los dos médicos se hablen.
export interface InterconsultationTaken {
  id: string
  status: RequestStatus
  taken_at: string
  specialty_name?: string | null
  chief_complaint: string
  clinical_notes?: string | null
  patient_age_range?: string | null
  requesting_doctor: DoctorContact
}

// --- Médico tratante (pide ayuda) ---

export function createInterconsultationRequest(
  payload: InterconsultationRequestCreate,
  token: string
): Promise<InterconsultationRequest> {
  return postJson<InterconsultationRequest>(
    BASE,
    payload,
    'No se pudo crear la solicitud de interconsulta',
    token
  )
}

export function fetchMyRequests(token: string): Promise<InterconsultationRequest[]> {
  return getJson<InterconsultationRequest[]>(
    `${BASE}/mine`,
    'No se pudieron cargar tus solicitudes',
    token
  )
}

export function cancelRequest(id: string, token: string): Promise<InterconsultationRequest> {
  return postJson<InterconsultationRequest>(
    `${BASE}/${id}/cancel`,
    {},
    'No se pudo cancelar la solicitud',
    token
  )
}

// Cerrar es EXCLUSIVO del médico tratante: el especialista toma el caso pero no lo cierra.
export function closeRequest(
  id: string,
  closingNote: string | null,
  token: string
): Promise<InterconsultationRequest> {
  return postJson<InterconsultationRequest>(
    `${BASE}/${id}/close`,
    { closing_note: closingNote },
    'No se pudo cerrar el caso',
    token
  )
}

// --- Especialista (ofrece ayuda) ---

export function fetchInbox(token: string): Promise<InterconsultationInboxItem[]> {
  return getJson<InterconsultationInboxItem[]>(
    `${BASE}/inbox`,
    'No se pudo cargar la bandeja de interconsultas',
    token
  )
}

export function fetchTakenByMe(token: string): Promise<InterconsultationTaken[]> {
  return getJson<InterconsultationTaken[]>(
    `${BASE}/taken-by-me`,
    'No se pudieron cargar los casos que tomaste',
    token
  )
}

// Carrera: si otro especialista llegó primero, el backend responde 409. El caller debe
// distinguirlo por `ApiError.status` y refrescar la bandeja, no mostrarlo como error genérico.
export function takeRequest(id: string, token: string): Promise<InterconsultationTaken> {
  return postJson<InterconsultationTaken>(
    `${BASE}/${id}/take`,
    {},
    'No se pudo tomar la interconsulta',
    token
  )
}
