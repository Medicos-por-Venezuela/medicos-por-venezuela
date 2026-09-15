import type { MyProfile } from './consultations'
import { isAdminRole } from './utils'

export type PostLoginRoute =
  { kind: 'redirect'; href: string } | { kind: 'blocked'; message: string }

// Mensaje para una cuenta de Auth sin ficha de médico ni registro de paciente. Casi siempre es un
// registro de médico que creó la cuenta y no llegó a guardar la ficha: por eso le dice cómo
// terminarlo (el formulario reconoce el correo y lo completa con la misma contraseña).
export const SIN_REGISTRO_MESSAGE =
  'Tu cuenta no tiene un registro activo como médico ni como paciente. Si eres médico, completa ' +
  'tu registro en "Soy médico" con este mismo correo y contraseña. Si crees que es un error, ' +
  'contacta a un administrador.'

// Único fan-out post-login del sitio: lo usan /login, /auth/callback, /auth/recuperar y /mi-caso.
// Antes estaba triplicado y las tres copias tenían que mantenerse a mano.
//
// Devuelve una decisión en vez de navegar: los casos bloqueados tienen que poder mostrar su mensaje
// en la página donde el usuario ya está mirando. Si el helper hiciera el router.replace, obligaría
// a inventar una página de error o a rebotarlo sin explicación.
export function resolvePostLoginRoute(profile: MyProfile): PostLoginRoute {
  // Primero, antes de exigir registro: un acceso con Google que aún no eligió rol no tiene ficha
  // todavía y es justo en /elegir-rol donde empieza a tenerla. Termina el alta en esa sesión; si
  // se va sin terminarla, en el siguiente login cae en el bloqueo de abajo.
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
  // Estar en Supabase Auth no basta para entrar: sin ficha en `doctors` ni paciente en `patients`
  // es una cuenta que el sistema no conoce. El admin va antes porque no necesita registro.
  //
  // `=== false` y no `!`: el frontend y la API se despliegan a distinto ritmo, y una API que todavía
  // no manda el campo lo deja `undefined`. Con `!` eso bloquearía el login de TODOS los médicos y
  // pacientes hasta que la API llegara a producción.
  if (profile.has_account_record === false) {
    return { kind: 'blocked', message: SIN_REGISTRO_MESSAGE }
  }
  if (['doctor', 'specialist'].includes(profile.role)) {
    return { kind: 'redirect', href: '/panel-medico' }
  }
  return { kind: 'redirect', href: '/mi-caso' }
}
