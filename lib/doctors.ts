import { ApiError, getJson, postJson, patchJson } from './apiClient'

export { ApiError }

export interface ProfessionalTypeResponse {
  id: string
  name: string
  status: 'active' | 'inactive' | 'deleted'
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SpecialtyResponse {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DoctorCreate {
  professional_type_id: string
  specialty_id?: string | null
  cedula: string
  full_name: string
  license?: string | null
  phone: string
  email: string
  country_of_residence?: string | null
  website?: string | null
}

export interface DoctorResponse {
  id: string
  professional_type_id: string | null
  specialty_id: string | null
  cedula: string
  full_name: string
  license: string | null
  phone: string
  email: string
  country_of_residence: string | null
  verified: boolean
  status: number
  created_at: string
  updated_at: string
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

// GET /api/v1/professional-types — público, catálogo para el selector de registro.
export async function fetchProfessionalTypes(): Promise<ProfessionalTypeResponse[]> {
  return getJson<ProfessionalTypeResponse[]>(
    '/api/v1/professional-types',
    'No se pudo cargar el catálogo de tipos de profesional'
  )
}

// GET /api/v1/specialties — público, catálogo para el selector de especialidad.
export async function fetchSpecialties(): Promise<SpecialtyResponse[]> {
  return getJson<SpecialtyResponse[]>(
    '/api/v1/specialties',
    'No se pudo cargar el catálogo de especialidades'
  )
}

// POST /api/v1/doctors — público, rate-limited por IP, con honeypot anti-bot.
export async function createDoctor(payload: DoctorCreate): Promise<DoctorResponse> {
  return postJson<DoctorResponse>('/api/v1/doctors', payload, 'No se pudo completar el registro')
}

// --- Pool de médicos (para referir/agendar desde la consulta) ---

export interface DoctorPoolItem {
  id: string
  full_name: string
  specialty_id: string | null
  professional_type_id: string | null
  phone: string | null
  online: boolean
}

export interface DoctorPoolPage {
  items: DoctorPoolItem[]
  total: number
}

export interface DoctorPoolParams {
  skip?: number
  limit?: number
  specialty_id?: string
  professional_type_id?: string
  online?: boolean // true=logeados · false=offline · undefined=todos
}

// GET /api/v1/doctors/pool — requiere Bearer (permiso doctors.read; el médico ya lo tiene).
export async function fetchDoctorPool(
  params: DoctorPoolParams,
  token: string
): Promise<DoctorPoolPage> {
  const qs = new URLSearchParams()
  if (params.skip != null) qs.set('skip', String(params.skip))
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.specialty_id) qs.set('specialty_id', params.specialty_id)
  if (params.professional_type_id) qs.set('professional_type_id', params.professional_type_id)
  if (params.online != null) qs.set('online', String(params.online))
  return getJson<DoctorPoolPage>(
    `/api/v1/doctors/pool?${qs.toString()}`,
    'No se pudo cargar el pool de médicos',
    token
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
