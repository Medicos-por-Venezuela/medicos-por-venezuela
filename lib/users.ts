// Client for the multi-role RBAC endpoints of api-medicos-por-venezuela (user creation +
// role assignment). Separate from lib/admin.ts's `Profile` type, which is the OLD Supabase-direct
// single-role profile used by doctores.tsx/pacientes.tsx — do not mix the two.
import { deleteJson, getJson, postJson } from './apiClient'

export { ApiError } from './apiClient'

export interface ApiUser {
  id: string
  email: string
  full_name: string
  role: string
  active: boolean
  verified: boolean
  created_at: string
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

// GET /api/v1/profiles — requiere permiso profiles.read. Devuelve un arreglo plano (sin total),
// por eso la paginación es "cargar más"/siguiente por offset, no por total de páginas.
export async function fetchProfiles(
  token: string,
  params: { skip?: number; limit?: number; role?: string; search?: string }
): Promise<ApiUser[]> {
  const qs = new URLSearchParams()
  if (params.skip != null) qs.set('skip', String(params.skip))
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.role) qs.set('role', params.role)
  // Búsqueda server-side por nombre o email (ILIKE en el backend): con ~3000 usuarios,
  // paginar sin buscar es inservible.
  if (params.search?.trim()) qs.set('search', params.search.trim())
  return getJson<ApiUser[]>(
    `/api/v1/profiles?${qs.toString()}`,
    'No se pudieron cargar los usuarios',
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
