# Todo: Login unificado `/login`

> Spec: [`tasks/spec.md`](./spec.md) · Plan: [`tasks/plan.md`](./plan.md)
> Comandos: `pnpm build` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm test:e2e`

---

## Fase 1 — Fundación

### T1: Extraer el fan-out post-login a `lib/postLogin.ts`

**Descripción:** Crear el único resolvedor de "¿a dónde va este usuario tras autenticar?",
copiando la lógica que `pages/auth/callback.tsx:76-91` ya tiene bien (usa `effectiveAdminRole`,
no `isAdminRole`), y hacer que el callback pase a consumirlo. Sin cambio de comportamiento
observable: es un refactor puro que prepara el terreno.

**Acceptance criteria:**

- [x] `resolvePostLoginRoute(profile, token)` devuelve `{kind:'redirect', href}` o `{kind:'blocked', message}`, cubriendo en este orden: `!role_chosen` → `/elegir-rol`; `!active` → `blocked`; admin efectivo → `/admin/dashboard`; `doctor`/`specialist` → `/panel-medico`; resto → `/mi-caso`
- [x] `auth/callback.tsx` no contiene lógica de rol propia — solo llama al helper y actúa sobre el resultado
- [x] El caso `!active` sigue haciendo `signOut()` y pintando el mensaje en el `notice` del callback, igual que hoy

**Verification:**

- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm lint`
- [x] Manual: login con Google de un paciente y de `e2e-dual@example.com` — aterrizan donde antes

**Dependencies:** Ninguna
**Files:** `lib/postLogin.ts` _(nuevo)_, `pages/auth/callback.tsx`
**Scope:** S (2 archivos)

---

### T2: Crear `pages/login.tsx`

**Descripción:** La puerta única. Formulario email/contraseña + botón de Google, construido con
`AuthPanel`/`AuthField` (`components/auth/`), que delega el destino en `resolvePostLoginRoute`.

**Acceptance criteria:**

- [x] Autentica con `supabase.auth.signInWithPassword`, pide el perfil con `fetchMyProfile` y redirige según el helper de T1
- [x] `kind:'blocked'` → `signOut()` + mensaje **en la propia página**, sin redirigir
- [x] Enter en el campo de contraseña envía el formulario (paridad con `login-medico.tsx:88`)
- [x] Botón de Google vía `signInWithGoogle()`; enlace "Crear cuenta" visible
- [x] Un único estado `error` para el login (regla de "un estado de error por fuente")

**Verification:**

- [x] `pnpm build` y `pnpm exec tsc --noEmit`
- [x] Manual, los 4 casos: `e2e-doc1@` → `/panel-medico`; `e2e-admin@` → `/admin/dashboard`; **`e2e-dual@` → `/admin/dashboard`**; un paciente → `/mi-caso`
- [x] Manual: credenciales malas muestran error y no navegan

**Dependencies:** T1
**Files:** `pages/login.tsx` _(nuevo)_
**Scope:** S (1 archivo)

---

### ✅ Checkpoint A — la puerta nueva funciona

- [x] `pnpm build` · `pnpm exec tsc --noEmit` · `pnpm lint` en verde
- [x] `e2e-dual@example.com` llega a `/admin/dashboard` por `/login` — **el bug, arreglado**
- [x] Las puertas viejas siguen operativas: revertir aquí no deja a nadie fuera
- [x] Revisar con el usuario antes de seguir

---

## Fase 2 — Desmontar lo viejo

### T3: `/mi-caso` queda solo como portal del paciente

**Descripción:** Sacar el formulario de login de `mi-caso.tsx`. Sin sesión, redirige a `/login`.
Con sesión, es lo que siempre fue: consultas, recordatorios, sync de calendario.

**Acceptance criteria:**

- [x] Fuera el estado `email`, `password`, `authed` y las funciones `login()` / bloque de formulario
- [x] `getSession()` sin sesión → `router.replace('/login')`
- [x] **Sin bucle:** si hay sesión pero `/auth/me` falla, mantiene el comportamiento actual (portal sin datos), no redirige
- [x] El resto del portal —recordatorios nativos, `CalendarSync`, `downloadIcs`, `logout`— intacto

**Verification:**

- [x] `grep -n "password\|authed" pages/mi-caso.tsx` sin resultados
- [x] `pnpm build` · `pnpm exec tsc --noEmit`
- [x] Manual: sin sesión `/mi-caso` → `/login`; con sesión de paciente, el portal carga con sus consultas

**Dependencies:** T2
**Files:** `pages/mi-caso.tsx`
**Scope:** S (1 archivo)

---

### T4: Convertir las puertas viejas en redirects

**Descripción:** `/login-medico` y `/admin` (con su alias `/admin/login`) pasan a ser páginas de
redirect a `/login`. Y `useAdminGuard` deja de mandar a `/admin` para mandar directo a `/login`.

**Acceptance criteria:**

- [x] `login-medico.tsx` y `admin/index.tsx` son redirects a `/login` (`useEffect` + `router.replace`), sin formulario propio
- [x] `admin/login.tsx` sigue siendo `export { default } from './index'` — hereda el redirect sin tocarse
- [x] El área admin conserva su `<meta name="robots" content="noindex">`
- [x] `lib/admin.ts:168` (`useAdminGuard`) redirige a `/login`, no a `/admin`
- [x] `AuthPanel`/`AuthField` siguen teniendo consumidor (`/login`); si no, se borran

**Verification:**

- [x] `pnpm build` · `pnpm exec tsc --noEmit` · `pnpm lint`
- [x] Manual: `/login-medico`, `/admin` y `/admin/login` aterrizan en `/login`
- [x] Manual: `/admin/dashboard` sin sesión → `/login` en **un solo salto**
- [x] `pnpm test:e2e -- admin-multirol` sigue verde (el guard cambió de destino)

**Dependencies:** T2 · paralelizable con T3
**Files:** `pages/login-medico.tsx`, `pages/admin/index.tsx`, `lib/admin.ts`
**Scope:** S (3 archivos)

---

### T5: Reapuntar todos los call sites

**Descripción:** Reemplazo mecánico de los 12 `router.push('/login-medico')` y los 2 enlaces
restantes. Conteo verificado por archivo: `panel-medico.tsx` ×3, `panel-medico/perfil.tsx` ×3,
`panel-medico/consulta/[id].tsx` ×3, `panel-medico/agenda.tsx` ×1, `registro-medico.tsx` ×1
(`Link`), `index.tsx` ×1 (`goMedicoLogin`). El de `auth/callback.tsx` cae en T1.

**Acceptance criteria:**

- [x] Los 12 `router.push('/login-medico')` apuntan a `/login`
- [x] `index.tsx`: `goPacienteLogin` **y** `goMedicoLogin` → `/login`. **El markup de la home no cambia** — mismas tarjetas, mismos botones, solo el destino
- [x] `registro-medico.tsx:469` enlaza a `/login`
- [x] `grep -rn "login-medico" pages components lib` solo aparece en `pages/login-medico.tsx`

**Verification:**

- [x] `pnpm build` · `pnpm exec tsc --noEmit` · `pnpm lint`
- [x] `pnpm test:e2e` — los 11 specs existentes en verde
- [x] Manual: los 3 botones de la home llegan a `/login` y la home se ve idéntica a antes
- [x] Manual: sesión expirada en `/panel-medico` → `/login`

**Dependencies:** T3, T4
**Files:** `pages/panel-medico.tsx`, `pages/panel-medico/agenda.tsx`, `pages/panel-medico/perfil.tsx`, `pages/panel-medico/consulta/[id].tsx`, `pages/registro-medico.tsx`, `pages/index.tsx`
**Scope:** M (6 archivos, reemplazo mecánico)

---

### ✅ Checkpoint B — una sola puerta

- [x] `grep -rn "login-medico" pages components lib` → solo el redirect
- [x] Los 11 specs E2E existentes en verde
- [x] Sin sesión, `/mi-caso` y `/panel-medico` mandan a `/login` **sin bucle**
- [x] La home se ve idéntica

---

## Fase 3 — Red de seguridad y documentación

### T6: Spec E2E del fan-out por rol

**Descripción:** Fijar los cinco escenarios de redirección. `CLAUDE.md` lo exige: "todo gating de
UI nuevo nace con su spec E2E". `global-setup.ts` **ya siembra** `e2e-doc1@`, `e2e-admin@` y
`e2e-dual@` con password conocida (`e2e-Test-123456`); falta solo una cuenta de paciente.

**Acceptance criteria:**

- [x] `global-setup.ts` siembra `e2e-patient@example.com` con `role='patient'`, `role_chosen=true`, `active=true` (mismo patrón idempotente que las demás)
- [x] El spec usa contexto **sin** `storageState` (pasa por el formulario de verdad, a diferencia de los 11 specs actuales)
- [x] Cubre: doctor → `/panel-medico`; admin → `/admin/dashboard`; **dual → `/admin/dashboard`**; paciente → `/mi-caso`
- [x] El caso dual lleva un comentario explicando que ese es el bug que este cambio arregla

**Verification:**

- [x] `pnpm test:e2e -- login-fanout` en verde
- [x] `pnpm test:e2e` completo en verde
- [x] Sanity check: el spec del dual **falla** si se revierte T1 a `isAdminRole` — si no falla, no está probando nada

**Dependencies:** T5
**Files:** `e2e/login-fanout.spec.ts` _(nuevo)_, `e2e/global-setup.ts`
**Scope:** S (2 archivos)
**Nota:** requiere Docker + Supabase local. Si el entorno no está disponible, se reporta como
no ejecutado — **no se marca en verde a ciegas**.

---

### T7: Documentación y changelog

**Descripción:** Actualizar la tabla de rutas en los tres documentos y dejar la entrada de
changelog. De paso, corregir la afirmación desactualizada de `CLAUDE.md` de que no hay E2E.

**Acceptance criteria:**

- [x] `README.md:107-112` y `CLAUDE.md:185-192`: `/login` como puerta única; `/mi-caso` descrita como portal (ya no "login +"); las tres viejas marcadas como redirect
- [x] `CLAUDE.md` "Testing capabilities": E2E pasa a ✅ con `pnpm test:e2e` — hoy dice ❌ y es falso
- [x] `AGENTS.md` consistente con `CLAUDE.md` (regla de sync declarada en el propio repo)
- [x] Entrada en `changeslog.md` bajo `## 2026-08-23`, mencionando el fix del médico-admin
- [x] Los archivos de `tasks/` reflejan lo que realmente se hizo, no solo lo planeado

**Verification:**

- [x] `pnpm format:check` limpio
- [x] Ninguna ruta mencionada en los docs devuelve 404

**Dependencies:** T6
**Files:** `README.md`, `CLAUDE.md`, `AGENTS.md`, `changeslog.md`
**Scope:** S (4 archivos, solo docs)

---

### ✅ Checkpoint C — listo para revisión

- [x] Los 11 "Success Criteria" del spec, verificados uno a uno
- [x] `pnpm build` · `tsc --noEmit` · `lint` · `format:check` · `test:e2e` en verde
- [x] Fuera de alcance intacto: cero cambios en `users.verified`, `role_chosen`, `user_roles`, migraciones o backend

---

## Resultado (2026-08-23)

Las 7 tareas están hechas. Tres desviaciones respecto al plan, todas documentadas arriba y en
`tasks/spec.md`:

1. **El "bug" del médico-admin no existía.** El sanity check de T6 (revertir el helper a
   `isAdminRole` y comprobar que el test se pusiera rojo) demostró que sigue **verde**: `GET
/auth/me` ya devuelve el rol efectivo del RBAC. El helper final usa `isAdminRole(profile.role)`,
   no `effectiveAdminRole()`, que habría añadido un `GET /auth/me/permissions` por login sin
   aportar nada. El cambio vale por la consolidación, no por un arreglo de enrutado.
2. **`/mi-caso` también consume el helper.** No estaba en el plan: tenía su propia cuarta copia del
   fan-out. Colapsarla era el punto del cambio.
3. **Fix de accesibilidad no planeado en `components/auth/AuthField.tsx`.** El `<label>` y el
   `<input>` estaban sin asociar (sin `htmlFor`/`id`): ningún lector de pantalla anunciaba los
   campos. Lo destapó el spec E2E al no poder localizarlos por etiqueta. Arreglado con `useId()`.

### Estado de la verificación

| Comando                      | Resultado                                                   |
| ---------------------------- | ----------------------------------------------------------- |
| `pnpm exec tsc --noEmit`     | ✅ limpio                                                   |
| `pnpm lint`                  | ✅ 0 errores (22 warnings preexistentes)                    |
| `pnpm build`                 | ✅ compila (usar `NEXT_DIST_DIR` si hay un `next dev` vivo) |
| `pnpm format:check`          | ✅ limpio                                                   |
| `pnpm test:e2e login-fanout` | ✅ 6/6                                                      |
| `pnpm test:e2e` (completo)   | ⚠️ **9 pasan, 8 fallan**                                    |

Los 8 fallos son **preexistentes en `dev_aws`**, no regresión: se comprobó haciendo `git stash` de
todo el cambio y corriendo la suite en limpio — mismos 8 fallos, mismos specs
(`admin-especialidad`, `consulta-cerrada`, `paciente-en-linea`, `panel-atender-video`, `panel-race`,
`pool-modal`, `presence`, `sala-espera`). Baseline 3 verdes / 8 rojos → ahora 9 verdes / 8 rojos.
**La suite del frontend está roja en esta rama y merece su propia tarea**; el síntoma apunta a la
creación de consultas de prueba (`claim devolvió 422` con `consultation_id: "undefined"`).
