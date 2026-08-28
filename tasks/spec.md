# Spec: Login unificado `/login`

> Intención confirmada con el usuario vía `interview-me` (2026-08-23).
> Fases posteriores: `tasks/plan.md`, `tasks/todo.md`.

## Objective

Reemplazar las tres puertas de login del sitio por una sola ruta `/login` que sirve a
pacientes, médicos y administradores, y que tras autenticar redirige según el rol
efectivo resuelto por el RBAC existente.

Hoy hay tres formularios de login que hacen casi lo mismo:

| Ruta                                                | Qué es                                               | Fan-out por rol                         |
| --------------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `pages/login-medico.tsx`                            | Login médico (email/pass + Google)                   | `isAdminRole(profile.role)`             |
| `pages/mi-caso.tsx`                                 | Mitad formulario de login, mitad portal del paciente | `isAdminRole(profile.role)` en `load()` |
| `pages/admin/index.tsx` (+ alias `admin/login.tsx`) | Puerta privada de admin, `noindex`                   | `effectiveAdminRole()`                  |

### Corrección al diagnóstico inicial

**Este cambio NO arregla un bug de enrutado.** El spec afirmaba originalmente que `/login-medico`
mandaba al panel médico a un médico con `admin`/`super_admin` en `user_roles`, porque decide con
`isAdminRole(profile.role)` (rol legado, uno solo) en vez de `effectiveAdminRole()` (RBAC real).

El sanity check de T6 lo desmintió: al revertir el helper a `isAdminRole`, el test del dual siguió
**verde**. La causa está en el backend — `GET /auth/me` no devuelve la columna legada, sino el rol
**efectivo** (`src/routers/auth.py:41`, `resp.role = effective_role(principal.roles)`), y
`_ROLE_PRIORITY` (`src/core/security.py:33`) pone `super_admin` y `admin` en cabeza. Un dual llega
al frontend ya como `super_admin`, así que `isAdminRole()` acierta.

Consecuencias:

- El helper usa `isAdminRole(profile.role)`, no `effectiveAdminRole()`. Este último dispararía un
  `GET /auth/me/permissions` extra en **cada** login de paciente y de médico para recalcular algo
  que `profile.role` ya contiene.
- El valor del cambio es la **consolidación**: una sola puerta y una sola copia del fan-out (antes
  tres, mantenidas a mano).
- Queda documentada una dependencia silenciosa: el frontend depende de que `/auth/me` colapse el
  multi-rol. `e2e/login-fanout.spec.ts` es lo que chilla si eso cambia.

### Usuarios

- **Paciente** — el que más lo nota. Hoy "Iniciar sesión" en la home lo manda a `/mi-caso`,
  una página que es mitad formulario y mitad portal.
- **Médico** — entra por la misma puerta; si además es admin, ahora sí llega al dashboard.
- **Admin** — pierde la puerta separada; el guard de `/admin/*` no cambia.

## Tech Stack

- Next.js (Pages Router) + TypeScript + React
- Supabase Auth (`signInWithPassword`, `signInWithOAuth` con Google)
- Backend propio FastAPI (`api-medicos-por-venezuela`) — único gateway a la BD.
  Rol y estado vienen de `GET /api/v1/auth/me`; el set RBAC de `GET /api/v1/auth/me/permissions`.
- Playwright para E2E, ESLint + Prettier, commitlint + husky

## Commands

```
Dev:        pnpm dev
Build:      pnpm build
Types:      pnpm exec tsc --noEmit
Lint:       pnpm lint
Format:     pnpm format:check
E2E:        pnpm test:e2e
```

> Nota: `CLAUDE.md` afirma que no existe harness E2E. Está desactualizado — hay
> `playwright.config.ts`, 11 specs en `e2e/` y script `test:e2e`. Corregirlo entra en el alcance.

## Project Structure

```
pages/            → Rutas (Pages Router)
pages/auth/       → callback de OAuth
pages/admin/      → Sección privada de administración
components/auth/  → AuthPanel + AuthField (UI compartida de login)
lib/              → Helpers: supabase, auth, admin (RBAC), utils, consultations
e2e/              → Specs Playwright
tasks/            → Artefactos SDD de este cambio (spec, plan, todo)
```

## Code Style

El helper nuevo. Comentario en español explicando el _porqué_, no el _qué_ — la convención
del repo:

```ts
// lib/postLogin.ts (versión final; ver "Corrección al diagnóstico inicial")
import type { MyProfile } from './consultations'
import { isAdminRole } from './utils'

export type PostLoginRoute =
  { kind: 'redirect'; href: string } | { kind: 'blocked'; message: string }

// Único fan-out post-login del sitio: lo usan /login, /auth/callback y /mi-caso. Antes
// estaba triplicado y las tres copias había que mantenerlas a mano.
export async function resolvePostLoginRoute(profile: MyProfile): Promise<PostLoginRoute> {
  if (!profile.role_chosen) return { kind: 'redirect', href: '/elegir-rol' }
  if (!profile.active) {
    return { kind: 'blocked', message: 'Tu cuenta está desactivada. Contacta a un administrador.' }
  }
  // `profile.role` ya es el rol EFECTIVO del RBAC: GET /auth/me lo sobrescribe.
  if (isAdminRole(profile.role)) return { kind: 'redirect', href: '/admin/dashboard' }
  if (['doctor', 'specialist'].includes(profile.role)) {
    return { kind: 'redirect', href: '/panel-medico' }
  }
  return { kind: 'redirect', href: '/mi-caso' }
}
```

Convenciones vigentes que este cambio respeta:

- Sin lecturas directas a Supabase/PostgREST: rol y estado siempre por el backend.
- `kind: 'blocked'` no redirige — el caller decide cómo mostrarlo. Evita el patrón "te
  mando a una página que te rebota" y deja el mensaje donde el usuario está mirando.
- Un estado de error por fuente (lección de code review en `CLAUDE.md`).

## Testing Strategy

| Nivel  | Qué cubre aquí                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| Tipos  | `tsc --noEmit` — atrapa cualquier import huérfano de `/login-medico`                                                |
| Build  | `pnpm build` — atrapa rutas rotas y `Link` a páginas inexistentes                                                   |
| E2E    | Los 11 specs existentes deben seguir verdes. `e2e/global-setup.ts` y los specs que autentican pasan a usar `/login` |
| Manual | Los cinco escenarios de "Success Criteria" en el navegador                                                          |

Cobertura nueva: un spec E2E que fije el fan-out por rol. `CLAUDE.md` lo exige —
"todo gating de UI nuevo nace con su spec E2E".

## Boundaries

**Always**

- Rol y estado por `GET /auth/me`; nunca lectura directa a `users`/`profiles`.
- Un solo fan-out post-login compartido; si aparece un tercer caller, usa el helper.
- Actualizar `changeslog.md` como paso final (protocolo del repo).
- Mantener `CLAUDE.md` y `AGENTS.md` consistentes entre sí (regla de sync declarada).

**Ask first**

- Cambiar `next.config.js` (hoy no define `redirects`).
- Tocar `useAdminGuard` más allá de su destino de redirect.
- Cualquier cosa que altere la superficie de la API o el esquema.

**Never**

- Borrar `pages/login-medico.tsx` sin dejar redirect: hay enlaces externos y desde
  `registro-medico.tsx:469`.
- Quitar el `noindex` del área admin.
- Tocar `users.verified`, `role_chosen`, `user_roles` o cualquier migración. **Fuera de alcance
  por decisión explícita del usuario** — va en un cambio posterior.
- Introducir `window.confirm` nuevos o dejar de usar el `ConfirmDialog` compartido.

## Success Criteria

Cinco escenarios de fan-out, todos observables desde el navegador:

1. Paciente con credenciales válidas entra en `/login` → aterriza en `/mi-caso` y ve su portal.
2. Médico (`doctor`/`specialist`) sin admin → aterriza en `/panel-medico`.
3. Médico con `admin`/`super_admin` en `user_roles` → aterriza en `/admin/dashboard`
   (funciona porque `/auth/me` ya colapsa el multi-rol; ver "Corrección al diagnóstico inicial").
4. Cuenta con `role_chosen: false` (signup de Google sin rol) → `/elegir-rol`.
5. Cuenta con `active: false` → NO redirige; se cierra la sesión y `/login` muestra
   "Tu cuenta está desactivada" en la propia página.

Más:

6. `/mi-caso` sin sesión → `/login`. Con sesión → portal, **sin formulario de login**.
   El archivo ya no contiene estado `email`/`password`/`authed`.
7. `/login-medico`, `/admin` y `/admin/login` redirigen a `/login`.
8. Los tres botones de la home apuntan a `/login`. **La UI de la home no cambia** — mismo
   markup, mismas tarjetas, solo el destino.
9. Un médico con ficha y sin cédula sigue yendo a `/panel-medico/perfil`. Ese flujo ya
   existe y no se toca.
10. `grep -rn "login-medico" pages components lib` solo aparece en el propio redirect.
11. `pnpm build`, `tsc --noEmit`, `pnpm lint`, `pnpm test:e2e` en verde.

## Out of Scope

Confirmado explícitamente con el usuario — va en cambios posteriores:

- **Eliminar `users.verified`.** El grep del backend confirma que nace `true` (trigger
  `handle_new_auth_user`) y ninguna ruta lo pone en `false`: es un flag write-once-true.
  El gate real de cuenta es `active`; el de credencial es `doctors.verified` (SACS/FPV).
  Tocarlo implica migración SQL, `Principal.is_staff`, una función SQL `security definer`,
  el modelo y tres schemas.
- **`role_chosen`.** Revisado: NO es redundante con `user_roles`. `set_my_role` no inserta
  en `user_roles` (solo el endpoint de admin lo hace), así que un auto-registrado tiene cero
  filas ahí y el RBAC cae al rol legacy. Y como `users.role` es NOT NULL, el trigger debe
  meter `'patient'` a un signup de Google — sin `role_chosen`, "eligió paciente" y "aún no
  eligió" son indistinguibles. Se queda.
- Unificar los registros (`/registro-medico` + `/registro-paciente`).
- Rediseño visual de la home o de las pantallas de auth.

## Open Questions

Ninguna bloqueante. Dos decisiones tomadas por defecto, reversibles:

1. `/login` usa `AuthPanel`/`AuthField` en vez del markup inline de `login-medico.tsx`.
   Es la UI de auth ya compartida; el markup inline queda huérfano al borrarse su única página.
2. Las rutas viejas redirigen desde el cliente (`useEffect` + `router.replace`), no vía
   `redirects` en `next.config.js`, porque el proyecto no usa esa config hoy y añadirla
   por tres rutas es más superficie de la que ahorra.
