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
  // Reserva de salud mental, definida en el catálogo (columnas de `specialties`), no por el
  // nombre: `mental_health_only` marca la especialidad que SOLO atiende salud mental
  // (Psicología). Usar el flag y no la cadena es lo que evita que renombrarla rompa el registro.
  is_mental_health: boolean
  mental_health_only: boolean
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
  // professional_type_* solo viene poblado para source:'doctor'; para source:'user' es null y el
  // propio usuario debe elegir el tipo antes de completar su cédula (ver /panel-medico/perfil).
  professional_type_id: string | null
  professional_type: string | null
  verified: boolean
}

// PATCH /api/v1/doctors/me — edición parcial; todos los campos opcionales. status, verified,
// email y phone NO son auto-editables (los rechaza el backend con 422).
//
// - source:'doctor' (ficha existente): full_name/license/specialty_id se editan directo; cambiar
//   cedula re-verifica contra SACS/FPV; professional_type_id se ignora (el tipo no es auto-editable).
// - source:'user' (completar registro): cedula + professional_type_id verifica y CREA la ficha, y
//   la respuesta vuelve como source:'doctor'. Enviar cedula sin professional_type_id → 422.
export interface DoctorSelfUpdate {
  full_name?: string
  license?: string | null
  specialty_id?: string
  cedula?: string
  professional_type_id?: string
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
  user_id: string | null // para cruzar con Realtime Presence y saber si está online
  full_name: string
  specialty_id: string | null
  professional_type_id: string | null
  // Sin teléfono: se revela (y audita) aparte con revealDoctorContact().
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
  search?: string
  online?: boolean // true=solo online · false=solo offline · undefined=todos
  online_ids?: string[] // user_ids que el cliente sabe online (Presence), para el filtro online
  exclude_self?: boolean // default true (no referirte a ti mismo); false = incluirte (dashboard admin)
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
  if (params.search) qs.set('search', params.search)
  if (params.online != null) qs.set('online', String(params.online))
  for (const id of params.online_ids || []) qs.append('online_ids', id)
  // Solo se manda cuando se sobreescribe el default (true) del backend.
  if (params.exclude_self === false) qs.set('exclude_self', 'false')
  return getJson<DoctorPoolPage>(
    `/api/v1/doctors/pool?${qs.toString()}`,
    'No se pudo cargar el pool de médicos',
    token
  )
}

// POST /api/v1/doctors/{id}/contact — revela el WhatsApp del médico y lo REGISTRA en audit_log
// (quién vio el número de quién). El número no viene en el listado del pool: solo por acá.
export async function revealDoctorContact(
  doctorId: string,
  token: string
): Promise<{ phone: string | null }> {
  return postJson<{ phone: string | null }>(
    `/api/v1/doctors/${doctorId}/contact`,
    {},
    'No se pudo obtener el contacto',
    token
  )
}

// --- Credenciales de médicos (panel admin) ---

// Por qué un médico NO puede atender. `null` = sí puede. Solo 'no_verificado' se arregla con el
// botón de aprobar: los demás necesitan que el médico complete su ficha (o que se reactive).
export type DoctorBlockedReason =
  'sin_ficha' | 'de_baja' | 'sin_cedula' | 'sin_licencia' | 'no_verificado'

// Fila de GET /api/v1/doctors. Incluye cuentas con rol de médico que aún no tienen ficha en
// `doctors` (`id: null`): esas no se pueden aprobar, hay que pedirles la cédula.
export interface DoctorAdminItem {
  id: string | null
  user_id: string | null
  full_name: string
  cedula: string | null
  license: string | null
  email: string | null
  specialty_id: string | null
  professional_type_id: string | null
  status: number | null
  // `doctors.verified`: la credencial está aprobada (por SACS/FPV o por un admin). NO implica que
  // pueda atender — para eso está `can_practice`, que exige además ficha activa, cédula y licencia.
  verified: boolean
  created_at: string
  can_practice: boolean
  blocked_reason: DoctorBlockedReason | null
}

export interface DoctorAdminPage {
  items: DoctorAdminItem[]
  total: number
}

export interface DoctorAdminParams {
  skip?: number
  limit?: number
  status?: number
  verified?: boolean // true=aprobados · false=no aprobados · undefined=todos
  can_practice?: boolean // true=habilitados para atender · false=bloqueados · undefined=todos
  // Motivo exacto. Es el filtro operativo: 'no_verificado' son los que se pueden aprobar YA, y
  // sin acotar por ahí quedan diluidos entre miles de fichas sin cédula (no salen ni en la 1ª página).
  blocked_reason?: DoctorBlockedReason
  search?: string // nombre, cédula o email
}

// Contadores por estado de credencial (GET /doctors/credential-summary). Las claves coinciden con
// los valores de `blocked_reason`, así que cada contador es un atajo al filtro del listado.
export interface DoctorCredentialSummary {
  can_practice: number
  sin_ficha: number
  de_baja: number
  sin_cedula: number
  sin_licencia: number
  no_verificado: number
  total: number
}

// GET /api/v1/doctors — requiere permiso doctors.read. Devuelve { items, total } para paginar.
export async function fetchAdminDoctors(
  params: DoctorAdminParams,
  token: string
): Promise<DoctorAdminPage> {
  const qs = new URLSearchParams()
  if (params.skip != null) qs.set('skip', String(params.skip))
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.status != null) qs.set('status', String(params.status))
  if (params.verified != null) qs.set('verified', String(params.verified))
  if (params.can_practice != null) qs.set('can_practice', String(params.can_practice))
  if (params.blocked_reason) qs.set('blocked_reason', params.blocked_reason)
  if (params.search?.trim()) qs.set('search', params.search.trim())
  return getJson<DoctorAdminPage>(
    `/api/v1/doctors?${qs.toString()}`,
    'No se pudieron cargar los médicos',
    token
  )
}

// GET /api/v1/doctors/credential-summary — requiere permiso doctors.read. Cuántos médicos hay en
// cada estado, en una sola consulta. Es lo que hace visible la cola de aprobación del admin.
export async function fetchDoctorCredentialSummary(
  token: string
): Promise<DoctorCredentialSummary> {
  return getJson<DoctorCredentialSummary>(
    '/api/v1/doctors/credential-summary',
    'No se pudo cargar el resumen de credenciales',
    token
  )
}

// POST /api/v1/doctors/{id}/approve — requiere permiso doctors.verify. Habilita para atender al
// médico que el SACS/FPV no validó y queda en audit_log como `doctor.approved`.
// 422 (ApiError.status) si a la ficha le falta cédula/licencia o no está activa: aprobarla no
// habilitaría a nadie. El `message` del error dice qué falta y se muestra tal cual.
export async function approveDoctor(doctorId: string, token: string): Promise<DoctorResponse> {
  return postJson<DoctorResponse>(
    `/api/v1/doctors/${doctorId}/approve`,
    {},
    'No se pudo aprobar al médico',
    token
  )
}

// POST /api/v1/doctors/{id}/revoke-approval — deshace la aprobación (el médico deja de atender).
export async function revokeDoctorApproval(
  doctorId: string,
  token: string
): Promise<DoctorResponse> {
  return postJson<DoctorResponse>(
    `/api/v1/doctors/${doctorId}/revoke-approval`,
    {},
    'No se pudo revocar la aprobación',
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
