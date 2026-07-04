import { ApiError, getJson, postJson } from './apiClient'

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
