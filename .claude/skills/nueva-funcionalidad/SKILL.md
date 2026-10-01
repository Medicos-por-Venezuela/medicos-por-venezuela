---
name: nueva-funcionalidad
description: Construye una funcionalidad nueva en el frontend (Next.js 16 Pages Router + React 19 + TypeScript, datos por la API FastAPI, Supabase solo Auth y Realtime, hosting AWS Amplify) siguiendo el flujo del repo — spec → plan → todo en tasks/<cambio>/, rama feat/* desde dev_aws, build/tsc/lint/E2E, changeslog y sincronía CLAUDE.md↔AGENTS.md. Usar cuando el usuario pida "agregar", "implementar", "construir" o "nueva pantalla/funcionalidad" en medicos-por-venezuela.
---

# Nueva funcionalidad (frontend)

## 0. Contexto que se carga siempre

1. `CLAUDE.md` (fuente de verdad: auth, rutas, arquitectura, lecciones de review) y `AGENTS.md`.
   Después de cualquier cambio de stack, testing o SDD, los dos deben quedar consistentes en el
   mismo commit.
2. `node_modules/next/dist/docs/` para cualquier API de Next que vayas a usar: este Next **no** es
   el de tu entrenamiento (ver bloque `nextjs-agent-rules` al final de `AGENTS.md`). **Stack real
   verificado en `package.json` y `pnpm-lock.yaml`: Next 16.3, React 19.2, TypeScript 6, Pages
   Router, hosting AWS Amplify (`customHttp.yml`).** `README.md`, `CLAUDE.md` y `AGENTS.md` aún
   dicen Next 14 / Vercel / `pages/api/videoconsulta.ts`: está desactualizado, no lo repitas.
3. `.knowledge/` (`TODOs.md`, `mensajeria.md`) y `tasks/` (si ya hay carpeta del cambio, se
   continúa).
4. Si la funcionalidad necesita datos, primero mira si el endpoint existe en la API
   (`../api-medicos-por-venezuela/src/routers/`). Hoy **todo** el dato va por REST
   (`lib/apiClient.ts`); Supabase queda para Auth y Realtime (señal mínima sobre
   `consultations`, Presence y Broadcast). **Nada nuevo se lee por PostgREST/anon key**:
   si falta un endpoint, la funcionalidad empieza en el repo de la API (skill
   `nueva-funcionalidad` de allí) y este repo la consume vía `lib/apiClient.ts`.
5. `git branch -r --sort=-committerdate | head`: otro desarrollador trabaja en paralelo.

## 1. Spec / plan / todo

`tasks/<cambio>/spec.md`, `plan.md`, `todo.md` con el formato de `tasks/cola-por-especialidad/`.
Si el cambio abarca los dos repos, la spec canónica vive en la API y aquí va una copia corta que
la enlaza y detalla solo la parte de UI (rutas, componentes, estados, E2E).

En el plan: decisiones numeradas con porqué; orden de fases que deja el sitio funcionando en cada
commit; horas estimadas por fase (se cobra y reporta por horas en Workana).

## 2. Construcción — reglas del repo

- **Rama:** `feat/<cambio>` desde `dev_aws`; PR contra `dev_aws` (CI: lint, format, tsc, build).
  `main` recibe PR desde `dev_aws`. Nunca commit directo.
- **pnpm** siempre; nunca `npm`/`yarn`.
- **Datos:** `lib/apiClient.ts` (JWT de Supabase como Bearer, `ApiError.status`). Un `lib/<recurso>.ts`
  por recurso con funciones tipadas; las páginas no llaman `fetch` directo.
- **Realtime + `setState`:** siempre `setX(prev => …)`. Escrituras de estado disputado (tomar,
  cerrar) son condicionales en el backend; el frontend trata 409 como "otro ganó" y refresca.
- **Modales:** `components/admin/ConfirmDialog.tsx`; nunca `window.confirm` nuevos.
- **Un estado de error por fuente** de datos.
- **Mobile-first**, CSS global con clases existentes (`card`, `btn`, `kpi`, `table`); sin framework.
- **Contenido clínico:** solo lo que la API entrega tras su grant; nunca en `localStorage`,
  querystrings, GA4 (`PARAMS_PRIVADOS`) ni logs.
- **Todo gating de UI nuevo nace con su spec E2E** en `e2e/` (los specs existentes cubren flujos
  felices; un gating sin spec se rompe en silencio). Reusa `e2e/helpers.ts` y las cuentas de
  `e2e/global-setup.ts`. Ningún spec envía formularios que manden correos reales.
- Texto de UI en español, sin datos de contacto del médico visibles al paciente ni al revés.

## 3. Verificación

```bash
pnpm exec tsc --noEmit
pnpm lint
NEXT_DIST_DIR=.next-e2e pnpm build      # nunca `pnpm build` con `next dev` corriendo
pnpm test:e2e                           # Docker + Supabase local + API levantada
```

Más QA manual en el navegador a 390 px y escritorio.

## 4. Cierre

- Marca `todo.md`; anota horas reales por fase al pie.
- **`changeslog.md`**: entrada arriba, bajo `## AAAA-MM-DD`, qué cambió y por qué, ficheros clave.
  Tras un rebase, re-audita esa entrada.
- Actualiza `CLAUDE.md` (rutas, servicios, lecciones) y `AGENTS.md` si cambió algo de lo que
  documentan. Si la pantalla suma un proveedor o un dato personal nuevo, actualiza
  `pages/legal/privacidad.tsx` y su fecha (`e2e/terminos.spec.ts`).
- Commits Conventional Commits en español (`feat(panel-medico): …`); commitlint los rechaza si no.
