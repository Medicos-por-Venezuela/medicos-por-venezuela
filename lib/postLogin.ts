import type { MyProfile } from './consultations'
import { isAdminRole } from './utils'

export type PostLoginRoute =
  { kind: 'redirect'; href: string } | { kind: 'blocked'; message: string }

// Único fan-out post-login del sitio: lo usan /login, /auth/callback y /mi-caso. Antes estaba
// triplicado y las tres copias tenían que mantenerse a mano.
//
// Devuelve una decisión en vez de navegar: el caso `!active` tiene que poder mostrar su mensaje en
// la página donde el usuario ya está mirando. Si el helper hiciera el router.replace, ese caso
// obligaría a inventar una página de error o a rebotarlo sin explicación.
export function resolvePostLoginRoute(profile: MyProfile): PostLoginRoute {
  if (!profile.role_chosen) return { kind: 'redirect', href: '/elegir-rol' }
  if (!profile.active) {
    return { kind: 'blocked', message: 'Tu cuenta está desactivada. Contacta a un administrador.' }
  }
  // `profile.role` NO es la columna legada `users.role`: GET /auth/me lo sobrescribe con el rol
  // EFECTIVO del RBAC (`effective_role(principal.roles)`), y en _ROLE_PRIORITY super_admin y admin
  // van primero. Un dual doctor+super_admin llega aquí ya como 'super_admin'.
  //
  // Por eso NO se usa effectiveAdminRole(): para un no-admin dispara un GET /auth/me/permissions
  // extra cuyo veredicto ya está contenido en `profile.role`. Sería una petición de más en cada
  // login de paciente y de médico a cambio de nada.
  if (isAdminRole(profile.role)) return { kind: 'redirect', href: '/admin/dashboard' }
  if (['doctor', 'specialist'].includes(profile.role)) {
    return { kind: 'redirect', href: '/panel-medico' }
  }
  return { kind: 'redirect', href: '/mi-caso' }
}
