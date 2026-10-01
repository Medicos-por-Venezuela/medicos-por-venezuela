# TODO (UI): Mensajería médico ↔ paciente

> Spec: [`spec.md`](./spec.md) · Plan: [`plan.md`](./plan.md)
> Estado: **no iniciado**. Depende de que la API tenga en `dev` las tareas T1.1–T1.6 (Fase 1) y
> T2.1–T2.5 (Fase 2) de `api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/todo.md`.

## Fase 1 — Buzón web

- [ ] F1.1 `lib/messages.ts` (`listMessages`, `sendMessage`, `markRead`, `inbox`, `inboxStream`) — 0,5 h
- [ ] F1.2 `components/mensajes/HiloMensajes.tsx`, `EstadoEntrega.tsx`; bloque «Mensajes» en `pages/panel-medico/consulta/[id].tsx` (U1) — 1,5 h
- [ ] F1.3 `pages/panel-medico/mensajes.tsx`; contador y enlace en `PanelHeader`; tarjeta en `/panel-medico` (U2) — 1,5 h
- [ ] F1.4 Hilo en `/mi-caso` (sesión) y `/sala-espera` (token); `message_received` en `lib/notificationPrefs.ts` (U3–U5) — 1 h
- [ ] F1.5 `e2e/mensajes-medico.spec.ts`, `e2e/mensajes-paciente.spec.ts`, `e2e/mensajes-admin.spec.ts`; `changeslog.md`; rutas en `CLAUDE.md` — 0,5 h

### Checkpoint Fase 1

- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `NEXT_DIST_DIR=.next-e2e pnpm build`, `pnpm test:e2e` verdes
- [ ] QA manual a 390 px y escritorio (médico, paciente con cuenta, paciente por token, admin)
- [ ] PR `feat/mensajeria-buzon` → `dev_aws`

## Fase 2 — WhatsApp

- [ ] F2.1 Casilla de consentimiento en `/registro-paciente`; interruptor en `/mi-caso`; `pages/legal/privacidad.tsx` + fecha; `e2e/terminos.spec.ts` (U6) — 1 h
- [ ] F2.2 Estados de entrega y aviso de fallo en `HiloMensajes` (U7); E2E — 1 h

### Checkpoint Fase 2

- [ ] Verificación completa y PR `feat/mensajeria-whatsapp` → `dev_aws`
- [ ] `changeslog.md` y `CLAUDE.md` (servicios: WhatsApp API Cloud de Meta como canal)

## Horas reales

| Fase | Estimadas | Reales | Nota |
| ---- | --------- | ------ | ---- |
| 1    | 5         |        |      |
| 2    | 2         |        |      |
