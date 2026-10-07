# TODO (UI): Mensajería médico ↔ paciente

> Spec: [`spec.md`](./spec.md) · Plan: [`plan.md`](./plan.md) · Spec tiempo real: [`spec-chat-tiempo-real.md`](./spec-chat-tiempo-real.md)
> Backend TODO: [`../../../api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/todo.md`](../../../api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/todo.md)
> Estado: **no iniciado**. Depende de que la API tenga en `dev` las tareas T1.1–T1.6 (Fase 1) y
> T2.1–T2.5 (Fase 2) de la API.

## Fase 1 — Buzón web y archivos adjuntos clínicos (5 h)

- [x] F1.1 `lib/messages.ts` (`listMessages`, `sendMessage`, `uploadAttachment`, `fetchAttachmentBlob`, `markRead`, `inbox`, `inboxStream`) y contratos TypeScript (`Message`, `MessageAttachment`, `InboxThread` con `patient_online` y `patient_last_seen_at`, `AttachmentUploadResponse`, `SendMessagePayload`, `AuthOptions`) — 0,5 h
- [x] F1.2 `components/mensajes/HiloMensajes.tsx`, `AdjuntoMensaje.tsx` (con soporte Blob y `revokeObjectURL`), `ModalVisorImagen.tsx`, `IndicadorPresenciaPaciente.tsx` (en línea, desconectado con última vez, y aún no ha entrado), `EstadoEntrega.tsx`; selector de archivos con `accept="application/pdf,image/jpeg,image/png,image/webp"`, drag & drop, paste y rechazo inmediato de GIF (`/\.gif$/i` sin disparar petición HTTP); bloque «Mensajes» en `pages/panel-medico/consulta/[id].tsx` (U1) con indicador de presencia del paciente — 1,5 h
- [x] F1.3 `pages/panel-medico/mensajes.tsx` mostrando `IndicadorPresenciaPaciente` en cada conversación; contador y enlace en `PanelHeader`; tarjeta en `/panel-medico` (U2) — 1,0 h
- [x] F1.4 Hilo en `/mi-caso` (sesión) y `/sala-espera` (token) con subida desacoplada de adjuntos (PDF/imágenes, GIF bloqueado) y regla de asimetría estricta (omisión total en DOM de presencia médica); `message_received` en `lib/notificationPrefs.ts` (U3–U5) — 1,0 h
- [x] F1.5 `e2e/mensajes-medico.spec.ts`, `e2e/mensajes-paciente.spec.ts`, `e2e/mensajes-admin.spec.ts`; tests específicos de subida de PDF e imagen, intento y bloqueo de GIF con alerta inmediata, y verificación de asimetría de presencia (médico ve paciente online, paciente nunca ve médico online); `changeslog.md`; rutas en `CLAUDE.md` — 1,0 h

### Checkpoint Fase 1

- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `NEXT_DIST_DIR=.next-e2e pnpm build`, `pnpm test:e2e` verdes
- [ ] QA manual a 390 px y escritorio (médico, paciente con cuenta, paciente por token, admin)
- [ ] Verificación de subida de archivos (PDF e imágenes JPG/PNG/WEBP exitosos en médico y paciente con flujo desacoplado)
- [ ] Verificación de rechazo de GIF (alerta inmediata en cliente al intentar seleccionar, arrastrar o pegar un `.gif` sin disparar request)
- [ ] Verificación de asimetría de presencia: médico ve estado online/desconectado del paciente; paciente no ve ningún dato ni indicador de presencia médica
- [ ] PR `feat/mensajeria-buzon` → `dev_aws`

## Fase 2 — WhatsApp (2 h)

- [ ] F2.1 Casilla de consentimiento en `/registro-paciente`; interruptor en `/mi-caso`; `pages/legal/privacidad.tsx` + fecha; `e2e/terminos.spec.ts` (U6) — 1 h
- [ ] F2.2 Estados de entrega y aviso de fallo en `HiloMensajes` (U7); E2E — 1 h

### Checkpoint Fase 2

- [ ] Verificación completa y PR `feat/mensajeria-whatsapp` → `dev_aws`
- [ ] `changeslog.md` y `CLAUDE.md` (servicios: WhatsApp API Cloud de Meta como canal)

## Horas reales

| Fase | Estimadas | Reales | Nota                                                                    |
| ---- | --------- | ------ | ----------------------------------------------------------------------- |
| 1    | 5         |        | Sincronizada con el plan canónico de backend (15 h API + 5 h UI = 20 h) |
| 2    | 2         |        | (+1 h de infraestructura en el plan canónico)                           |
