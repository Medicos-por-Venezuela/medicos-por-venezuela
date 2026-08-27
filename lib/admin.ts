// Shared types, constants and the auth guard used by every /admin/* page. Extracted from the
// original monolithic pages/admin/dashboard.tsx so each page (dashboard, pacientes, doctores,
// catálogos) can reuse the same session/role check instead of duplicating it.
import { useRouter } from 'next/router'
import { useState } from 'react'
import { getJson } from './apiClient'
import { useMountEffect } from './hooks'
import { supabase } from './supabase'
import { fetchMyPermissions } from './users'

export type Profile = {
  id: string
  email: string
  full_name: string
  role: string
  specialty: string | null
  medical_license: string | null
  country: string | null
  whatsapp_number: string | null
  verified: boolean
  active: boolean
  last_seen_at: string | null
  created_at: string
}

export type Patient = {
  full_name: string
  cedula: string | null
  phone_whatsapp: string | null
  email: string | null
  affected_zone: string | null
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
}

export type Consultation = {
  id: string
  patient_id: string
  code: string
  status: string
  priority: string
  category: string | null
  specialty_id: string | null
  chief_complaint: string | null
  referred_specialty: string | null
  internal_note: string | null
  assigned_doctor_id: string | null
  assigned_doctor_name?: string | null // resuelto server-side por el backend (GET /consultations)
  created_at: string
  entered_call_at: string | null
  opened_at: string | null
  closed_at: string | null
  contacted: boolean
  admin_seguimiento: string | null // super_admin id following up the case
  nota_admin: string | null
  patients: Patient | null
}

export const STATUS_OPTIONS = [
  'waiting',
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'closed',
  'cancelled',
  'patient_no_show',
  'closed_by_admin',
  'contacted_whatsapp'
]
// A case counts as "closed" (green row) ONLY when it's Cerrada or Cerrada por admin.
// Everything else — including cancelled, no-show, waiting, in progress — is still open (red row).
export const CLOSED_STATUSES = ['closed', 'closed_by_admin']
// "En progreso" = a doctor has engaged the case and it isn't formally closed yet. Includes derived
// outcomes (referred/urgent) and negative endings (no-show/cancelled) — everything past the queue
// that isn't a formal close.
export const IN_PROGRESS_STATUSES = [
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'patient_no_show',
  'cancelled',
  'contacted_whatsapp'
]
export const ROLE_OPTIONS = ['all', 'doctor', 'specialist', 'admin', 'super_admin']
// The "Médicos y administradores" table is staff-only — patients never appear there.
export const STAFF_ROLES = ['doctor', 'specialist', 'admin', 'super_admin']
export const USERS_PAGE_SIZE = 50

// Timestamps are stored as UTC (timestamptz); always render them in Venezuela time
// (America/Caracas) so they're consistent regardless of the admin's browser timezone.
export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }) : '—'
export const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString('es-VE', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Caracas'
      })
    : '—'

// True if an ISO timestamp falls within an inclusive [from, to] date range (either bound optional).
// `from`/`to` come from <input type="date"> as 'YYYY-MM-DD'.
export function inDateRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime()
  if (from && t < new Date(from + 'T00:00:00').getTime()) return false
  if (to && t > new Date(to + 'T23:59:59.999').getTime()) return false
  return true
}

// Rol admin EFECTIVO considerando el multi-rol RBAC del backend: `profiles.role` es UN solo rol
// legacy — un usuario puede ser doctor de rol principal y tener admin/super_admin adicionales en
// `user_roles`. Si el legacy no alcanza, consulta los roles RBAC efectivos (GET
// /auth/me/permissions) y devuelve el más alto, o null si tampoco los tiene.
export async function effectiveAdminRole(
  legacyRole: string,
  accessToken: string
): Promise<'admin' | 'super_admin' | null> {
  if (legacyRole === 'super_admin' || legacyRole === 'admin') {
    return legacyRole as 'admin' | 'super_admin'
  }
  try {
    const perms = await fetchMyPermissions(accessToken)
    if (perms.roles.includes('super_admin')) return 'super_admin'
    if (perms.roles.includes('admin')) return 'admin'
  } catch {
    // Backend caído/no accesible: se queda con el veredicto del rol legacy.
  }
  return null
}

// Session + role guard shared by every /admin/* page: redirects to /login (la puerta única del
// sitio) unless there's a session AND the user is an active admin/super_admin — by legacy role OR
// by RBAC multi-role (e.g. primary doctor + super_admin in user_roles). Antes mandaba a /admin,
// que ahora es solo un redirect: ir directo a /login ahorra el salto intermedio.
export function useAdminGuard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useMountEffect(() => {
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/login')
        return
      }
      // El perfil se pide al backend (único gateway a la BD), NO a la tabla profiles de Supabase.
      // GET /auth/me devuelve role + active del titular del JWT. El auth sigue en Supabase:
      // getSession solo da la sesión y el token con que autenticamos la llamada.
      let me: Profile
      try {
        me = await getJson<Profile>(
          '/api/v1/auth/me',
          'No se pudo cargar el perfil',
          sessionData.session.access_token
        )
      } catch {
        await supabase.auth.signOut()
        router.push('/login')
        return
      }
      const adminRole = me.active
        ? await effectiveAdminRole(me.role, sessionData.session.access_token)
        : null
      if (!adminRole) {
        await supabase.auth.signOut()
        router.push('/login')
        return
      }
      // El perfil expone el rol admin EFECTIVO: así toda la UI admin (p. ej. isSuperAdmin en
      // pacientes.tsx) funciona igual para un dual doctor+super_admin que para uno puro.
      setProfile({ ...me, role: adminRole } as Profile)
      setLoading(false)
    })()
  })

  return { profile, loading }
}

export async function adminLogout(router: ReturnType<typeof useRouter>) {
  await supabase.auth.signOut()
  router.push('/')
}

// Bearer token for authenticated calls to api-medicos-por-venezuela (catalogs.manage endpoints).
// The backend validates the same Supabase JWT it accepts for the frontend's own auth.
export async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Sesión expirada, vuelve a iniciar sesión.')
  return data.session.access_token
}
