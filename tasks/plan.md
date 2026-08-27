# Implementation Plan: Login unificado `/login`

> Spec: [`tasks/spec.md`](./spec.md) · Checklist: [`tasks/todo.md`](./todo.md)

## Overview

Una sola ruta `/login` para paciente, médico y admin. El trabajo real no es escribir un
login nuevo: es **extraer el fan-out por rol que ya existe y es correcto** en
`pages/auth/callback.tsx:76-91` a un helper compartido, y luego apuntar todas las puertas a
`/login`. **Nota posterior:** se creía además que esto arreglaba un bug de enrutado del
médico-admin; no era cierto. Ver "Corrección al diagnóstico inicial" en `tasks/spec.md`.

## Architecture Decisions

**1. Un solo helper `lib/postLogin.ts`, no tres copias.**
Hoy la lógica de "¿a dónde mando a este usuario?" está triplicada y las copias divergieron:
`login-medico.tsx` y `mi-caso.tsx` usan `isAdminRole()` (rol legacy, uno solo), `callback.tsx`
usa `effectiveAdminRole()`. Se creyó que esa divergencia era un bug; el sanity check de T6 demostró
que no lo era (`GET /auth/me` ya devuelve el rol efectivo). El helper compartido sigue valiendo la
pena: cuatro copias a mano de la misma decisión son cuatro sitios donde puede divergir de verdad.

**2. El helper devuelve una decisión, no ejecuta el redirect.**
`{ kind: 'redirect' } | { kind: 'blocked' }`. `/login` muestra el mensaje de cuenta desactivada
en su propia página; el callback lo pinta en su `notice`. Si el helper hiciera el `router.replace`
él mismo, el caso `active: false` obligaría a inventar una página de error o a rebotar al usuario.

**3. Las rutas viejas redirigen, no se borran.**
`/login-medico` está enlazada desde `registro-medico.tsx:469` y probablemente desde marcadores
de usuarios reales. Un 404 es peor que un hop. `admin/login.tsx` es
`export { default } from './index'`, así que convertir `admin/index.tsx` en redirect arregla el
alias gratis.

**4. `useAdminGuard` apunta a `/login`, no a `/admin`.**
Hoy hace `router.push('/admin')` al fallar. Con `/admin` convertido en redirect eso funcionaría
igual, pero con doble salto y una URL intermedia visible. Un carácter de cambio evita ambos.

**5. Orden: helper → `/login` → desmontar lo viejo.**
Cada tarea deja el sitio funcionando. Hasta la tarea 4 conviven las dos puertas, así que un
`git revert` de cualquier commit intermedio no rompe el acceso de nadie.

## Dependency Graph

```
T1  lib/postLogin.ts  (+ callback.tsx pasa a usarlo)
     │
     └── T2  pages/login.tsx
              │
              ├── T3  mi-caso.tsx pierde el formulario
              ├── T4  rutas viejas → redirect
              │        │
              │        └── T5  call sites (12 router.push + 2 Link)
              │                 │
              │                 ├── T6  spec E2E del fan-out
              │                 └── T7  documentación
```

`T3` y `T4` son independientes entre sí — paralelizables si hace falta. El resto es secuencial.

## Task List

### Fase 1: Fundación

- [ ] **T1** — `lib/postLogin.ts` + refactor de `auth/callback.tsx`
- [ ] **T2** — `pages/login.tsx`

### Checkpoint A — la puerta nueva funciona

- [ ] `pnpm build`, `pnpm exec tsc --noEmit`, `pnpm lint` en verde
- [ ] Manual: los 4 roles entran por `/login` y aterrizan donde toca
- [ ] Manual: `e2e-dual@example.com` llega a `/admin/dashboard` (comportamiento que ya era correcto
      antes del cambio; el spec E2E lo fija para que no se rompa)
- [ ] Google sigue funcionando por `/auth/callback` (no hubo cambio de comportamiento)
- [ ] Las puertas viejas siguen vivas: nadie quedó fuera si hay que revertir aquí

### Fase 2: Desmontar lo viejo

- [ ] **T3** — `/mi-caso` queda solo como portal
- [ ] **T4** — `/login-medico`, `/admin`, `/admin/login` → redirect; `useAdminGuard` → `/login`
- [ ] **T5** — Reemplazar los 12 `router.push('/login-medico')` y los 2 `Link`

### Checkpoint B — una sola puerta

- [ ] `grep -rn "login-medico" pages components lib` solo devuelve el propio redirect
- [ ] `grep -n "email\|password\|authed" pages/mi-caso.tsx` no devuelve estado de login
- [ ] Los 11 specs E2E existentes siguen verdes (`pnpm test:e2e`)
- [ ] Manual: sin sesión, `/mi-caso` y `/panel-medico` mandan a `/login` **sin bucle**
- [ ] Manual: los 3 botones de la home llegan a `/login`; la home se ve idéntica

### Fase 3: Red de seguridad y docs

- [ ] **T6** — `e2e/login-fanout.spec.ts` + sembrar cuenta de paciente
- [ ] **T7** — README, CLAUDE.md, AGENTS.md, changeslog.md

### Checkpoint C — listo para revisión

- [ ] Los 11 criterios de "Success Criteria" del spec, verificados uno a uno
- [ ] `pnpm test:e2e` completo en verde, incluido el spec nuevo
- [ ] `pnpm format:check` limpio
- [ ] `changeslog.md` actualizado (protocolo del repo)

## Risks and Mitigations

| Riesgo                                                                                                | Impacto                               | Mitigación                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bucle de redirect**: `/login` manda a `/mi-caso`, `/mi-caso` rebota a `/login`                      | **Alto** — deja a los pacientes fuera | `/mi-caso` solo redirige cuando `getSession()` devuelve `null`. Si hay sesión pero `/auth/me` falla, mantiene el comportamiento actual (portal sin datos), nunca redirige. Cubierto por el criterio 6 y por el checkpoint B |
| `effectiveAdminRole` añade un `GET /auth/me/permissions` a cada login de no-admin                     | **Materializado**                     | Se descartó `effectiveAdminRole` por esto mismo: su veredicto ya está contenido en `profile.role`. El helper usa `isAdminRole(profile.role)` y no cuesta ninguna petición extra                                             |
| El E2E necesita Docker + Supabase local; puede no estar disponible                                    | Medio                                 | T6 es la última tarea y no bloquea a T1-T5. Si el entorno no está, se marca explícitamente como no ejecutado en vez de darlo por verde                                                                                      |
| `AuthPanel` (usado hoy solo por `admin/index.tsx`) queda huérfano al convertirlo en redirect          | Bajo                                  | `/login` pasa a ser su consumidor. Si al final no lo usa, el componente sí se borra                                                                                                                                         |
| El markup inline de `login-medico.tsx` desaparece y con él detalles sutiles (el `onKeyDown` de Enter) | Bajo                                  | `/login` replica Enter-para-enviar explícitamente. Está en los criterios de aceptación de T2                                                                                                                                |
| Un marcador externo a `/login-medico`                                                                 | Bajo                                  | Por eso redirige en vez de borrarse (decisión 3)                                                                                                                                                                            |

## Parallelization

- **Secuencial obligatorio:** T1 → T2 → (T3 ∥ T4) → T5 → T6
- **Paralelizable:** T3 y T4 tocan archivos disjuntos
- **Independiente:** T7 (docs) puede redactarse en cualquier momento, pero se cierra al final
  porque `changeslog.md` describe el resultado

## Out of Scope

Ver `tasks/spec.md` → "Out of Scope". En resumen: `users.verified`, `role_chosen`, unificar los
registros y cualquier cambio de esquema o backend. Confirmado con el usuario: **primero el login,
después la limpieza de campos.**

## Open Questions

Ninguna bloqueante. Las dos decisiones por defecto (UI con `AuthPanel`, redirect en cliente)
están en el spec y son reversibles en un commit.
