import { ApiError, getJson, patchJson } from './apiClient'

export { ApiError }

export interface SpecialtyResponse {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// GET /api/v1/doctors/me — perfil del médico autenticado (resuelto desde el token, sin id).
// `source` indica el origen: 'doctor' (registrado con verificación SACS/FPV) o 'user' (médicos
// de Google / finalize-role sin fila en doctors todavía; ahí cedula y specialty_id son null).
export interface DoctorMeResponse {
  source: 'doctor' | 'user'
  user_id: string
  doctor_id: string | null
  cedula: string | null
  full_name: string
  license: string | null
  specialty_id: string | null
  specialty: string | null
  verified: boolean
}

// PATCH /api/v1/doctors/me — edición parcial; todos los campos opcionales. status, verified,
// email y phone NO son auto-editables (los rechaza el backend con 422).
export interface DoctorSelfUpdate {
  full_name?: string
  license?: string | null
  specialty_id?: string
  cedula?: string
}

// GET /api/v1/specialties — público, catálogo para el selector de especialidad.
export async function fetchSpecialties(): Promise<SpecialtyResponse[]> {
  return getJson<SpecialtyResponse[]>(
    '/api/v1/specialties',
    'No se pudo cargar el catálogo de especialidades'
  )
}

// GET /api/v1/doctors/me — requiere Bearer (el recurso sale del user_id del token, IDOR-safe).
export async function fetchMyDoctorProfile(token: string): Promise<DoctorMeResponse> {
  return getJson<DoctorMeResponse>('/api/v1/doctors/me', 'No se pudo cargar tu perfil', token)
}

// PATCH /api/v1/doctors/me — auto-edición parcial. Cambiar cedula re-verifica contra SACS/FPV.
export async function updateMyDoctorProfile(
  payload: DoctorSelfUpdate,
  token: string
): Promise<DoctorMeResponse> {
  return patchJson<DoctorMeResponse>(
    '/api/v1/doctors/me',
    payload,
    'No se pudo actualizar tu perfil',
    token
  )
}
