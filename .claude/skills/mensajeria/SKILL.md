---
name: mensajeria
description: Contexto y checklist para la interfaz del módulo de mensajería médico ↔ paciente (buzón del médico en /panel-medico, hilo en el detalle de la consulta, mensajes del paciente en /mi-caso y sala de espera, consentimiento de WhatsApp en el registro). Cargar antes de tocar lib/messages.ts, componentes de buzón/hilo, preferencias de notificación o el consentimiento. Usar cuando el usuario mencione buzón, inbox, chat, mensajes, WhatsApp o consentimiento.
---

# Mensajería médico ↔ paciente (frontend)

Contexto canónico (acuerdos con el cliente, decisiones, preguntas abiertas):
`../api-medicos-por-venezuela/.knowledge/mensajeria.md`. Lo propio de la UI:
`.knowledge/mensajeria.md`. Spec canónica y tareas: `../api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/`;
la parte de UI: `tasks/mensajeria-medico-paciente/` de este repo. Léelos antes de escribir.

## Regla de oro

**La UI no existe hasta que existe el endpoint.** Cada pantalla de este módulo consume
`/api/v1/consultations/{id}/messages`, `/api/v1/inbox` y su SSE. Si el endpoint no está en
`../api-medicos-por-venezuela/src/routers/messages.py`, primero se hace allí (skill
`nueva-funcionalidad` de la API). Aquí no se lee `messages` por Supabase: está deny-all a propósito.

## Dónde encaja cada pieza

| Pieza                                    | Dónde                                                            | Qué reutiliza                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Contador de no leídos + entrada al buzón | `pages/panel-medico.tsx` (cabecera `components/PanelHeader.tsx`) | Realtime ya suscrito en el panel dispara refetch; no abrir otro canal                                   |
| Buzón del médico                         | `pages/panel-medico/mensajes.tsx` (nueva)                        | Lista paginada de hilos por `GET /inbox`; SSE `GET /inbox/stream` con el patrón de `lib/waitingRoom.ts` |
| Hilo en el detalle                       | `pages/panel-medico/consulta/[id].tsx`, bloque «Mensajes»        | Ya carga la consulta y su cadena; el hilo se pide por `consultation_id`                                 |
| Mensajes del paciente con cuenta         | `pages/mi-caso.tsx`                                              | `components/SalaEsperaEnVivo.tsx` y su SSE: se añade el evento `message`                                |
| Mensajes del paciente sin cuenta         | `pages/sala-espera.tsx`                                          | Token `X-Consultation-Token` desde `sessionStorage`, igual que la sala                                  |
| Consentimiento WhatsApp                  | `pages/registro-paciente.tsx` + `components/AceptaTerminos.tsx`  | Casilla aparte de los términos; se guarda en la API, no solo en cliente                                 |
| Preferencia «nuevo mensaje»              | `lib/notificationPrefs.ts` + `pages/panel-medico/perfil.tsx`     | Evento `message_received` con etiqueta en español                                                       |
| Cliente REST                             | `lib/messages.ts` (nuevo)                                        | `lib/apiClient.ts`: `getJson/postJson`, `ApiError.status`                                               |

## Reglas de UI del módulo

- Nunca teléfono del médico al paciente ni del paciente al médico en estas pantallas.
- Cuerpo `null` (sin grant) → «Contenido no disponible», no error ni reintento.
- Estados visibles al médico: `enviado`, `entregado`, `leído`, `fallido` (WhatsApp) y `leído en web`.
- Envío con estado disputado: un 409 de la API (consulta cerrada, hilo bloqueado) se muestra y se
  refresca el hilo; nunca se reintenta a ciegas.
- Realtime/SSE + `setState`: siempre `setX(prev => …)`; el SSE solo trae ids y contadores, la UI
  refetch.
- Mobile-first: el médico responde desde el teléfono; el compositor va fijo abajo.
- Texto en español; sin `window.confirm`; `ConfirmDialog` para «marcar como resuelto» si se añade.
- Al sumar WhatsApp como canal: actualizar `pages/legal/privacidad.tsx` y su fecha
  (`e2e/terminos.spec.ts`).

## E2E obligatorios (nacen con la pantalla)

- `e2e/mensajes-medico.spec.ts`: el médico ve el hilo de su consulta, envía, ve el estado; no ve
  hilos de otros.
- `e2e/mensajes-paciente.spec.ts`: paciente con cuenta lee y responde en `/mi-caso`; paciente sin
  cuenta lo hace por token en `/sala-espera`.
- `e2e/mensajes-admin.spec.ts`: el admin ve contadores, no cuerpos.
- Ningún spec dispara envíos reales por WhatsApp ni correo: el backend en local corre sin
  `WHATSAPP_ACCESS_TOKEN` y con `MAILTRAP_INBOX_ID`.

## Cierre

`pnpm exec tsc --noEmit`, `pnpm lint`, `NEXT_DIST_DIR=.next-e2e pnpm build`, `pnpm test:e2e`,
QA a 390 px. Entrada en `changeslog.md`; rutas nuevas en `CLAUDE.md`; horas reales en el `todo.md`.
