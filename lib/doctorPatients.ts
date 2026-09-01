// Cliente de los pacientes de CONSULTORIO: los que un médico registra él mismo para pedir una
// interconsulta sobre su caso. Ver tasks/interconsulta-asincrona/spec.md del backend.
//
// No confundir con lib/patients.ts, que es el alta PÚBLICA (el paciente se registra solo y entra
// a la cola). Estos pacientes nunca entran a la cola ni tienen cuenta: el vínculo con ellos lo
// mantiene su médico, fuera de la plataforma.
import { ApiError, deleteJson, getJson, patchJson, postJson } from './apiClient'

export { ApiError }

const BASE = '/api/v1/doctors/me/patients'

// Formulario corto a propósito: solo lo que un especialista necesita para evaluar el caso. NO se
// pide teléfono ni zona afectada (obligatorios en el alta pública) porque nadie de la plataforma
// va a contactar a este paciente — pedirlos sería guardar PII que no usamos.
export interface DoctorPatientCreate {
  full_name: string
  age_range?: string | null
  cedula?: string | null
  allergies?: string | null
  description?: string | null
  // El médico ATESTIGUA que su paciente autorizó compartir el caso. El backend rechaza `false`.
  consent: boolean
}

export type DoctorPatientUpdate = Partial<Omit<DoctorPatientCreate, 'consent'>>

export interface DoctorPatient {
  id: string
  full_name: string
  age_range?: string | null
  cedula?: string | null
  allergies?: string | null
  description?: string | null
  created_by_doctor_id?: string | null
  created_at: string
}

export function fetchMyDoctorPatients(token: string): Promise<DoctorPatient[]> {
  return getJson<DoctorPatient[]>(BASE, 'No se pudieron cargar tus pacientes', token)
}

export function createDoctorPatient(
  payload: DoctorPatientCreate,
  token: string
): Promise<DoctorPatient> {
  return postJson<DoctorPatient>(BASE, payload, 'No se pudo registrar el paciente', token)
}

export function updateDoctorPatient(
  id: string,
  payload: DoctorPatientUpdate,
  token: string
): Promise<DoctorPatient> {
  return patchJson<DoctorPatient>(
    `${BASE}/${id}`,
    payload,
    'No se pudo actualizar el paciente',
    token
  )
}

// Baja lógica en el backend (deleted_at), nunca borrado duro.
export function archiveDoctorPatient(id: string, token: string): Promise<void> {
  return deleteJson(`${BASE}/${id}`, 'No se pudo archivar el paciente', token)
}
