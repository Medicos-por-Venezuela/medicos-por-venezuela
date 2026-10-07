# Implementation Plan (UI): Mensajería médico ↔ paciente

> Spec UI: [`spec.md`](./spec.md) · Checklist: [`todo.md`](./todo.md) · Plan canónico:
> `../../../api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/plan.md`

## Architecture Decisions

**1. Un solo componente de hilo para tres pantallas.** `HiloMensajes` recibe `consultationId` y
un `auth` (`session` | `token`) y encapsula carga, envío y marcado. Tres copias divergirían igual
que divergieron las tres puertas de login.

**2. El SSE solo avisa; la verdad llega por REST.** Al evento `message`/`inbox` se hace refetch.
Ningún cuerpo se guarda en estado a partir del stream. `setX(prev => …)` siempre.

**3. Sin lecturas a Supabase.** `messages` está deny-all; todo por `lib/messages.ts` sobre
`lib/apiClient.ts`. Si falta un endpoint, se vuelve a la API.

**4. La UI no se abre hasta que el endpoint existe.** Cada tarea de UI declara el endpoint que
consume y se ejecuta después de que su tarea de API esté en `dev`.

**5. Nada de teléfonos.** Los tipos de `lib/messages.ts` no incluyen `phone`; si la API lo
mandara, no se pinta.

## Fases y horas

| Tarea                                                                          | Horas                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| F1.1 `lib/messages.ts` + tipos                                                 | 0,5                                                 |
| F1.2 `HiloMensajes` + `EstadoEntrega` + bloque en el detalle (U1)              | 1,5                                                 |
| F1.3 Buzón `/panel-medico/mensajes` + contador en `PanelHeader` y tarjeta (U2) | 1,5                                                 |
| F1.4 `/mi-caso` y `/sala-espera` (U3, U4) + preferencia (U5)                   | 1                                                   |
| F1.5 E2E médico/paciente/admin, `changeslog.md`, `CLAUDE.md` rutas             | 0,5                                                 |
| **Fase 1**                                                                     | **5**                                               |
| F2.1 Consentimiento en registro y `/mi-caso` (U6) + privacidad                 | 1                                                   |
| F2.2 Estados de entrega (U7) + E2E                                             | 1                                                   |
| **Fase 2**                                                                     | **2** (+1 h de infraestructura en el plan canónico) |

## Riesgos

- Ficheros grandes (`consulta/[id].tsx` 1218 líneas): el bloque se añade como componente aparte
  y un solo punto de montaje, sin reorganizar el resto.
- Otro desarrollador activo en `dev_aws`: rebase antes de abrir el PR y re-auditar la entrada del
  changelog.
