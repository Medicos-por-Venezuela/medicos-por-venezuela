# Spec (UI): Mensajería médico ↔ paciente

> Spec canónica (dominio, requisitos R1–R14, preguntas abiertas):
> `../../../api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/spec.md`.
> Contexto de UI: `.knowledge/mensajeria.md`. Este documento solo fija lo que se ve y se toca en
> este repo. Fases posteriores: `plan.md` y `todo.md` de esta carpeta.

## Objective

Dar al médico un buzón y un hilo por consulta dentro de `/panel-medico`, y al paciente la lectura
y respuesta desde `/mi-caso` (cuenta) o `/sala-espera` (token), sin exponer teléfonos y sin leer
nada por Supabase. En Fase 2, mostrar el estado de entrega por WhatsApp y recoger el
consentimiento en el registro del paciente.

## Requisitos de interfaz

### U1 — Bloque «Mensajes» en el detalle de la consulta (`/panel-medico/consulta/[id]`)

- CA1.1 Lista cronológica del hilo (`GET /consultations/{id}/messages`), burbujas por dirección,
  fecha relativa (`tiempoTranscurrido`), estado (web: leído/no leído; WhatsApp: enviado,
  entregado, leído, fallido).
- CA1.2 Compositor fijo abajo en móvil; `Ctrl+Enter` envía; máximo 2000 caracteres con contador.
- CA1.3 Al abrir el bloque se llama `POST …/messages/read`; el contador del panel se actualiza.
- CA1.4 Si la API responde 409 (consulta fuera de ventana) el compositor se deshabilita con el
  mensaje de la API; no se reintenta.
- CA1.5 Cuerpo `null` → «Contenido no disponible».

### U2 — Buzón del médico (`/panel-medico/mensajes`, nueva ruta)

- CA2.1 Lista paginada de `GET /inbox` con filtro «solo no leídos»; cada fila enlaza al detalle.
- CA2.2 Se suscribe a `GET /inbox/stream` (patrón de `lib/waitingRoom.ts`, respaldo JSON) y
  refetch al recibir `inbox`.
- CA2.3 Enlace y contador de no leídos en `components/PanelHeader.tsx` y tarjeta en `/panel-medico`.

### U3 — Paciente con cuenta (`/mi-caso`)

- CA3.1 Bajo la sala en vivo, hilo + compositor; usa la sesión (`owns_patient`).
- CA3.2 El evento `message` del SSE de la sala dispara refetch.

### U4 — Paciente sin cuenta (`/sala-espera`)

- CA4.1 Mismo componente que U3 con `X-Consultation-Token` desde `sessionStorage`.
- CA4.2 Un enlace de correo con `?t=` fresco aterriza aquí y abre el hilo.

### U5 — Preferencia «Nuevo mensaje de paciente»

- CA5.1 `lib/notificationPrefs.ts` añade `message_received` con etiqueta en español; aparece en
  `/panel-medico/perfil` con el resto.

### U6 — Consentimiento de WhatsApp (Fase 2)

- CA6.1 En `/registro-paciente`, casilla independiente de los términos: «Acepto recibir mensajes
  de mi médico por WhatsApp desde el número de Médicos por Venezuela»; se envía como
  `whatsapp_consent` a la API.
- CA6.2 En `/mi-caso`, interruptor para conceder o revocar (`POST/DELETE /patients/{id}/whatsapp-consent`).
- CA6.3 `pages/legal/privacidad.tsx` describe el canal y actualiza `ACTUALIZADO`.

### U7 — Estados de entrega (Fase 2)

- CA7.1 En U1, cada mensaje del médico muestra el estado de WhatsApp y, si `failed`, el aviso
  «No se pudo entregar por WhatsApp; el paciente recibió un correo».

## Componentes

```
components/mensajes/HiloMensajes.tsx        lista + compositor (reutilizado por U1, U3, U4)
components/mensajes/EstadoEntrega.tsx       chip de estado
components/mensajes/ConsentimientoWhatsApp.tsx
lib/messages.ts                             listMessages, sendMessage, markRead, inbox, inboxStream
pages/panel-medico/mensajes.tsx             buzón
```

## E2E

`e2e/mensajes-medico.spec.ts`, `e2e/mensajes-paciente.spec.ts`, `e2e/mensajes-admin.spec.ts`
(ver skill `mensajeria`). Ningún spec provoca envíos reales por WhatsApp ni correo.

## Fuera de alcance

Adjuntos, «escribiendo…», push Web/FCM, chat en tiempo real bidireccional, cita presencial.
