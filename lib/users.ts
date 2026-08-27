// Client for the multi-role RBAC endpoints of api-medicos-por-venezuela (user creation +
// role assignment). Separate from lib/admin.ts's `Profile` type, which is the OLD Supabase-direct
// single-role profile used by doctores.tsx/pacientes.tsx — do not mix the two.
import { deleteJson, getJson, patchJson, postJson } from './apiClient'

export { ApiError } from './apiClient'

export interface ApiUser {
  id: string
  email: string
  full_name: string
  role: string
  specialty: string | null
  active: boolean
  // OJO: este es `users.verified`, que nace true y ningún camino la baja — no significa nada. El
  // dato real de credencial es `doctor_verified`. Se conserva porque el backend lo sigue
  // devolviendo, pero no debe decidir ni mostrarse.
  verified: boolean
  // `doctors.verified`: resultado de contrastar la cédula con SACS (médico) o FPV (psicólogo).
  // null = esta persona no tiene ficha de médico, así que no hay credencial que verificar.
  doctor_verified: boolean | null
  created_at: string
}

// GET /profiles devuelve la página + el total exacto (para la paginación por número de página).
export interface ProfileListResult {
  items: ApiUser[]
  total: number
}

export interface RoleCatalogItem {
  id: string
  code: string
  name: string
  description: string
}

export interface UserRoleAssignment {
  id: string
  role_id: string
  role_code: string
  role_name: string
  assigned_at: string
}

export interface PermissionsResponse {
  roles: string[]
  permissions: string[]
}

export interface UserCreate {
  email: string
  password: string
  full_name: string
  initial_role?: 'patient' | 'doctor' | 'admin'
}

// GET /api/v1/auth/me/permissions — solo requiere sesión, sin permiso especial. Sirve para
// habilitar/ocultar acciones en la UI (el backend igual valida y responde 403 si se saltan).
export async function fetchMyPermissions(token: string): Promise<PermissionsResponse> {
  return getJson<PermissionsResponse>(
    '/api/v1/auth/me/permissions',
    'No se pudieron cargar los permisos',
    token
  )
}

// GET /api/v1/profiles — requiere permiso profiles.read. Devuelve { items, total } para paginar por
// número de página. Filtra server-side por rol(es), estado (active), rango de fechas y búsqueda
// (nombre/email/especialidad) — con ~3000 usuarios, paginar sin filtrar es inservible.
export async function fetchProfiles(
  token: string,
  params: {
    skip?: number
    limit?: number
    role?: string
    roles?: string[]
    search?: string
    active?: boolean
    createdFrom?: string
    createdTo?: string
  }
): Promise<ProfileListResult> {
  const qs = new URLSearchParams()
  if (params.skip != null) qs.set('skip', String(params.skip))
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.role) qs.set('role', params.role)
  if (params.roles) for (const r of params.roles) qs.append('roles', r)
  if (params.search?.trim()) qs.set('search', params.search.trim())
  if (params.active != null) qs.set('active', String(params.active))
  if (params.createdFrom) qs.set('created_from', params.createdFrom)
  if (params.createdTo) qs.set('created_to', params.createdTo)
  return getJson<ProfileListResult>(
    `/api/v1/profiles?${qs.toString()}`,
    'No se pudieron cargar los usuarios',
    token
  )
}

// GET /api/v1/profiles/{id} — un perfil por id (requiere permiso profiles.read / staff). Sustituye
// las lecturas puntuales `supabase.from('profiles').select(...).eq('id', …).single()` de otro usuario.
export async function fetchProfile(id: string, token: string): Promise<ApiUser> {
  return getJson<ApiUser>(`/api/v1/profiles/${id}`, 'No se pudo cargar el perfil', token)
}

// PATCH /api/v1/profiles/{id}/active — revoca (active:false) o reactiva (active:true) a un usuario.
// Reemplaza el UPDATE directo `from('profiles').update({ active })` de "Revocar acceso".
export async function setProfileActive(
  id: string,
  active: boolean,
  token: string
): Promise<ApiUser> {
  return patchJson<ApiUser>(
    `/api/v1/profiles/${id}/active`,
    { active },
    'No se pudo actualizar el estado del usuario',
    token
  )
}

// Campos que /elegir-rol envía para finalizar el rol propio. specialty/country/medical_license/
// whatsapp_number solo aplican cuando role === 'doctor' (el backend los ignora para 'patient').
export interface FinalizeRolePayload {
  role: 'patient' | 'doctor'
  // El ID del catálogo, no el nombre: `users.specialty_id` es la FK con la que el backend decide
  // qué puede atender el médico. El nombre lo resuelve él desde esa fila.
  specialty_id?: string | null
  country?: string | null
  medical_license?: string | null
  whatsapp_number?: string | null
}

// POST /api/v1/profiles/me/finalize-role — finaliza el rol del titular del JWT una sola vez.
// Reemplaza la RPC `set_my_role`; igual que ella, nunca puede otorgar admin/specialist.
export async function finalizeMyRole(
  payload: FinalizeRolePayload,
  token: string
): Promise<ApiUser> {
  return postJson<ApiUser>(
    '/api/v1/profiles/me/finalize-role',
    payload,
    'No se pudo guardar tu elección',
    token
  )
}

// POST /api/v1/users — requiere permiso users.create. `initial_role` nunca debe ser 'super_admin':
// el backend lo rechaza siempre con 422, incluso para un caller super_admin.
export async function createUser(payload: UserCreate, token: string): Promise<ApiUser> {
  return postJson<ApiUser>('/api/v1/users', payload, 'No se pudo crear el usuario', token)
}

// GET /api/v1/roles — requiere permiso roles.assign. Catálogo de roles (patient/doctor/admin/super_admin).
export async function fetchRoles(
  token: string,
  params?: { skip?: number; limit?: number }
): Promise<RoleCatalogItem[]> {
  const qs = new URLSearchParams()
  if (params?.skip != null) qs.set('skip', String(params.skip))
  if (params?.limit != null) qs.set('limit', String(params.limit))
  return getJson<RoleCatalogItem[]>(
    `/api/v1/roles?${qs.toString()}`,
    'No se pudo cargar el catálogo de roles',
    token
  )
}

// GET /api/v1/users/{id}/roles — requiere permiso roles.assign. Roles activos (multi-rol) de un usuario.
export async function fetchUserRoles(userId: string, token: string): Promise<UserRoleAssignment[]> {
  return getJson<UserRoleAssignment[]>(
    `/api/v1/users/${userId}/roles`,
    'No se pudieron cargar los roles del usuario',
    token
  )
}

// POST /api/v1/users/{id}/roles — requiere permiso roles.assign. Otorgar 'super_admin' exige que
// quien llama ya tenga 'super_admin' entre sus propios roles (si no, el backend lo rechaza con 403).
export async function assignRole(
  userId: string,
  roleCode: string,
  token: string
): Promise<UserRoleAssignment> {
  return postJson<UserRoleAssignment>(
    `/api/v1/users/${userId}/roles`,
    { role_code: roleCode },
    'No se pudo asignar el rol',
    token
  )
}

// DELETE /api/v1/users/{id}/roles/{role_id} — role_id es el id del catálogo de roles (el campo
// `role_id` de una asignación, NO el `id` de la propia asignación). Misma guarda de super_admin que assignRole.
export async function revokeRole(userId: string, roleId: string, token: string): Promise<void> {
  return deleteJson(`/api/v1/users/${userId}/roles/${roleId}`, 'No se pudo revocar el rol', token)
}
