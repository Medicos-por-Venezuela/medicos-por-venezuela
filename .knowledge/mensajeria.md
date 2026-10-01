# Módulo Mensajería — contexto para el frontend

La fuente canónica de acuerdos con el cliente, estado del backend, decisiones y preguntas
abiertas es `../api-medicos-por-venezuela/.knowledge/mensajeria.md`. No dupliques ese contenido
aquí: este archivo solo añade lo que atañe a la interfaz.

## Resumen en tres líneas

Encargo por horas (Workana, 12 USD/h, autorizado 2026-09-28): buzón del médico en la web, hilo
por consulta, el paciente responde por WhatsApp (Fase 2, API oficial de Meta) o por web; nadie ve
el teléfono del otro. Fase 1 ≈ 20 h (buzón web), Fase 2 ≈ 20 h (puente WhatsApp).

## Lo que ya existe en este repo y se reutiliza

- Sala de espera en vivo: `lib/waitingRoom.ts` (SSE + respaldo JSON) y
  `components/SalaEsperaEnVivo.tsx`, usadas por `/sala-espera` y `/mi-caso`. El hilo del paciente
  se cuelga de ahí.
- Preferencias de notificación: `lib/notificationPrefs.ts` replica las etiquetas del catálogo de
  la API; hay que sumar el evento `message_received`.
- Notificaciones nativas del navegador: `lib/nativeNotifications.ts` (solo con pestaña abierta).
- `lib/firebase.ts` (FCM) añadido el 2026-09-28 por Leonardo Alvarado; sin uso ni endpoint de
  tokens en la API. No construir sobre él sin acordarlo.
- Detalle de caso del médico: `/panel-medico/consulta/[id]` — ahí va la pestaña o bloque
  «Mensajes». Panel: `/panel-medico` — ahí el contador de no leídos y la entrada al buzón.
- Cliente REST: `lib/apiClient.ts`; un `lib/messages.ts` nuevo por recurso.
- `pages/legal/privacidad.tsx`: al sumar WhatsApp como canal hay que actualizar el texto y la
  fecha (`e2e/terminos.spec.ts`) y pedir el consentimiento en el registro del paciente.

## Reglas de UI para este módulo

- Nunca mostrar teléfono del médico al paciente ni del paciente al médico en pantallas de
  mensajería. El «Contactar por WhatsApp» del modal previo a la videollamada queda como está.
- El cuerpo de los mensajes llega ya descifrado por la API solo si hay grant; si llega `null`,
  la UI muestra «Contenido no disponible», no un error.
- Estados de entrega visibles para el médico: enviado, entregado, leído, fallido (WhatsApp) y
  leído en web.
- Mobile-first: el buzón se usa desde el teléfono del médico.
