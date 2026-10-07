---
name: corregir-bug
description: Corrige un comportamiento existente del frontend (Next.js 16 Pages Router + React 19, datos por la API FastAPI, Supabase solo Auth y Realtime) con el flujo reproducir → E2E que falla → fix mínimo → verificación → changeslog. Usar cuando el usuario reporte "no funciona", "se rompe", "no aparece", "arreglar" o "corregir" en medicos-por-venezuela.
---

# Corregir un bug (frontend)

## 1. Reproducir antes de tocar

1. Lee `CLAUDE.md` (sección del área y "Lecciones de code review") y `.knowledge/TODOs.md`: parte
   de lo que parece roto está documentado como pendiente o como decisión (p. ej. Twilio aparcado,
   notificaciones nativas solo con pestaña abierta, `users.verified` inerte).
2. Decide en qué capa está: página/componente, `lib/*.ts`, RLS/función de `supabase_schema.sql`,
   o la API (`../api-medicos-por-venezuela`). Si es la API, el fix va allí con su skill
   `corregir-bug`; aquí solo se adapta el consumo.
3. Reproduce en el navegador (móvil 390 px y escritorio) y escribe el spec E2E en `e2e/` que
   **falla** hoy. Si el bug es de Realtime/estado, reproduce la carrera (dos contextos de
   Playwright, como `e2e/panel-race.spec.ts`).
4. `git log -S"<símbolo>"` y ramas remotas recientes: puede venir de un merge reciente o estar
   ya en curso en otra rama.

## 2. Diagnóstico

Causa raíz en dos líneas y por qué no lo atrapó nada. Comprueba primero las causas típicas del
repo: `setState` con objeto capturado tras un `await` (pisa Realtime), `window.confirm` encolando
mensajes Realtime, dos fetches compartiendo un `error`, `redirectTo` construido desde un host no
permitido, `pnpm build` con `next dev` corriendo (chunks rotos), o un `.next` sucio.

## 3. Fix mínimo

- Solo la ruta del bug; sin refactors ni "mejoras" al lado.
- Mantén la accesibilidad de lo que reemplaces (Escape, foco) y el comportamiento mobile-first.
- Si el bug es de datos que el navegador no debería poder leer, la corrección **no** es abrir
  RLS: es un endpoint en la API que valide pertenencia.
- Si el bug está en `supabase_schema.sql`, el cambio se hace como migración en la API
  (`db/migrations/`), no editando el SQL histórico a mano en producción.

## 4. Verificación

```bash
pnpm exec tsc --noEmit && pnpm lint
NEXT_DIST_DIR=.next-e2e pnpm build
pnpm test:e2e            # el spec nuevo en verde y los demás sin cambios
```

## 5. Registro

- Rama `fix/<que-arregla>` desde `dev_aws`, PR a `dev_aws`. Commit `fix(<scope>): <qué y por qué>`.
- Entrada en `changeslog.md` (arriba, con fecha, ficheros clave y el spec E2E que lo fija).
- Si el bug enseña una regla nueva, añádela a "Lecciones de code review" en `CLAUDE.md`.
- Si lo reportó el cliente por Workana, anota horas y resumen en `tasks/backlog-correcciones.md`.
