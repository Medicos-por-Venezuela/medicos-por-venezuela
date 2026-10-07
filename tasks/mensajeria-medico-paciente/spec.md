# Spec (UI): Mensajería médico ↔ paciente

> Spec canónica (dominio, requisitos R1–R15, preguntas abiertas):
> `../../../api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/spec.md`.
> Spec complementaria en tiempo real: `spec-chat-tiempo-real.md`.
> Contexto de UI: `.knowledge/mensajeria.md`. Este documento solo fija lo que se ve y se toca en
> este repo. Fases posteriores: `plan.md` y `todo.md` de esta carpeta.

## Objective

Dar al médico un buzón y un hilo por consulta dentro de `/panel-medico` con visualización de presencia del paciente, y al paciente la lectura y respuesta desde `/mi-caso` (cuenta) o `/sala-espera` (token) bajo una regla de asimetría estricta de presencia (el paciente nunca puede ver si el médico profesional está en línea). Ambos actores pueden adjuntar e intercambiar documentos PDF e imágenes (JPG, PNG, WEBP), con prohibición terminante del formato GIF (`image/gif`), sin exponer números de teléfono y sin leer nada por Supabase. En Fase 2, mostrar el estado de entrega por WhatsApp y recoger el consentimiento en el registro del paciente.

## Requisitos de interfaz

### U1 — Bloque «Mensajes» en el detalle de la consulta (`/panel-medico/consulta/[id]`)

- CA1.1 Lista cronológica del hilo (`GET /consultations/{id}/messages`), burbujas por dirección,
  fecha relativa (`tiempoTranscurrido`), estado (web: leído/no leído; WhatsApp: enviado,
  entregado, leído, fallido).
- CA1.2 **Presencia del paciente visible para el médico**: La cabecera del bloque muestra si el paciente está en línea:
  - Si `patient_online === true`: punto verde y texto «En línea».
  - Si `patient_online === false` y `patient_last_seen_at` tiene valor: punto gris y texto relativo «Desconectado · últ. vez hace...».
  - Si `patient_online === false` y `patient_last_seen_at === null`: punto gris y texto «Desconectado» o «Aún no ha entrado».
- CA1.3 **Compositor y subida de archivos**: Compositor fijo abajo en móvil; botón de adjunto `[📎]` con selector de archivos (`accept="application/pdf,image/jpeg,image/png,image/webp"`), soporte de arrastrar y soltar (drag & drop) sobre el compositor y pegado desde el portapapeles (`paste`). Previsualización del archivo adjunto antes del envío (chip con miniatura o icono de PDF, nombre, tamaño formateado y botón quitar `✕`). Progreso de subida visible con estado de carga.
- CA1.4 **Prohibición estricta de GIF y límites de archivo**:
  - Si el usuario intenta seleccionar, arrastrar o pegar un archivo con MIME `image/gif` o extensión `.gif` (comprobación insensible a mayúsculas/minúsculas `/\.gif$/i`), la UI bloquea la acción de inmediato sin disparar petición de red, mostrando una alerta descriptiva: «Formato GIF no permitido. Solo se admiten documentos PDF e imágenes JPG, PNG o WEBP».
  - Límite de tamaño: máximo 10 MB (`10485760` bytes). Si se excede, se descarta en cliente con aviso: «El archivo supera el tamaño máximo permitido de 10 MB».
  - Si la API respondiera HTTP 422 (p. ej. validación profunda de magic bytes en el servidor), la interfaz atrapa `ApiError` y muestra el mensaje de rechazo de forma clara.
- CA1.5 **Visualización de adjuntos en burbujas**:
  - Imágenes: miniatura responsiva protegida; clic para abrir `ModalVisorImagen.tsx` (lightbox en resolución completa).
  - Documentos PDF: tarjeta con icono de PDF, nombre de archivo sanitizado, tamaño legible (ej. `2.4 MB`) y botón de descarga/visualización segura.
  - Como el endpoint `GET /consultations/{id}/attachments/{id}` requiere cabeceras de autorización (`Authorization: Bearer ...` o `X-Consultation-Token`) y aplica `X-Content-Type-Options: nosniff`, no se usan etiquetas `<img src="...">` desprotegidas; los adjuntos se obtienen vía `lib/messages.ts:fetchAttachmentBlob` generando URLs de objeto seguras (`URL.createObjectURL(blob)`) con revocación al desmontar (`revokeObjectURL`).
- CA1.6 `Ctrl+Enter` o botón «Enviar»; máximo 2000 caracteres con contador; el botón de envío se activa si hay texto no vacío o si hay un archivo adjunto listo para enviar.
- CA1.7 Al abrir el bloque se llama `POST …/messages/read`; el contador del panel se actualiza.
- CA1.8 Si la API responde 409 (consulta fuera de ventana) el compositor y el botón de adjuntos se deshabilitan con el mensaje de la API; no se reintenta.
- CA1.9 Cuerpo y adjuntos `null` (sin grant) → «Contenido no disponible».

### U2 — Buzón del médico (`/panel-medico/mensajes`, nueva ruta)

- CA2.1 Lista paginada de `GET /inbox` con filtro «solo no leídos»; cada fila enlaza al detalle.
- CA2.2 **Presencia del paciente en la lista**: Cada tarjeta o fila muestra el estado de conexión del paciente: punto verde «En línea», punto gris «Desconectado · hace...» o «Aún no ha entrado» si `patient_last_seen_at` es nulo.
- CA2.3 Se suscribe a `GET /inbox/stream` (patrón de `lib/waitingRoom.ts`, respaldo JSON) y refetch al recibir `inbox`.
- CA2.4 Enlace y contador de no leídos en `components/PanelHeader.tsx` y tarjeta en `/panel-medico`.

### U3 — Paciente con cuenta (`/mi-caso`)

- CA3.1 Bajo la sala en vivo, hilo + compositor con soporte de adjuntos (PDF e imágenes JPG/PNG/WEBP); usa la sesión (`owns_patient`).
- CA3.2 **Asimetría estricta de presencia médica**: La interfaz de `/mi-caso` **NUNCA** muestra si el médico (profesional) está en línea ni su última hora de conexión. La cabecera muestra única y exclusivamente los datos de la consulta («Dra. Pérez · Cardiología»). No se renderiza ningún indicador de estado, ni badge, ni texto de última vez, ni suscripción a eventos de presencia del médico. Esto protege al médico voluntario de la presión de disponibilidad inmediata.
- CA3.3 **Bloqueo estricto de GIF**: Validación en cliente idéntica a U1 (selector restringido sin comodín `image/*`, comprobación en drop/paste/change de MIME `image/gif` y extensión `/\.gif$/i`), mostrando advertencia inmediata y descartando el archivo sin enviar peticiones.
- CA3.4 Visualización y descarga segura de adjuntos clínicos (imágenes y PDFs) enviados por el médico o por el paciente.
- CA3.5 El evento `message` del SSE de la sala dispara refetch.

### U4 — Paciente sin cuenta (`/sala-espera`)

- CA4.1 Mismo componente que U3 con `X-Consultation-Token` desde `sessionStorage`.
- CA4.2 Subida y descarga de archivos autorizada por token de consulta en cabecera `X-Consultation-Token` (PDF e imágenes, GIF prohibido).
- CA4.3 **Asimetría de presencia médica**: Al igual que en U3, el paciente sin cuenta no tiene ninguna visibilidad sobre la presencia o conexión del médico profesional.
- CA4.4 Un enlace de correo con `?t=` fresco aterriza aquí y abre el hilo.

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

### U8 — Gestión técnica de archivos adjuntos clínicos (PDF e imágenes, GIF prohibido)

- CA8.1 **MIMEs y extensiones permitidas**: `application/pdf` (`.pdf`), `image/jpeg` (`.jpg`, `.jpeg`), `image/png` (`.png`), `image/webp` (`.webp`). Tamaño máximo: 10 MB (`10485760` bytes).
- CA8.2 **Bloqueo absoluto de GIF**: El selector HTML excluye explícitamente `image/gif` (`accept="application/pdf,image/jpeg,image/png,image/webp"`). Todo intento de carga mediante selección manual, drag & drop o pegado de un `.gif` (insensible a mayúsculas `/\.gif$/i`) se detiene en cliente con alerta descriptiva. En caso de evasión, la API responde con HTTP 422 y la UI informa el rechazo.
- CA8.3 **Subida desacoplada en dos pasos**:
  1. El archivo se sube a `POST /consultations/{id}/attachments` mediante `lib/messages.ts:uploadAttachment`, recibiendo `AttachmentUploadResponse` (`{ id, file_name, mime_type, file_size_bytes }`) antes de enviar el mensaje.
  2. El compositor guarda el adjunto preparado. Al pulsar «Enviar», se llama a `POST /consultations/{id}/messages` con `{ body?: string, attachment_ids: [id], client_msg_id?: string }`.
- CA8.4 **Descarga y seguridad**: Las descargas y vistas previas pasan por `GET /consultations/{id}/attachments/{id}` con cabeceras de autorización (`Authorization: Bearer ...` o `X-Consultation-Token`). No se exponen URLs directas al almacenamiento en nube. Se utiliza `fetchAttachmentBlob` con `URL.createObjectURL(blob)` para visualización en miniatura o descarga autenticada, revocando la URL de objeto al desmontar.

### U9 — Regla formal de Asimetría de Presencia en la Interfaz

- CA9.1 **Médico**:
  - En `/panel-medico/consulta/[id]` y en `/panel-medico/mensajes`, el médico profesional ve si el paciente está en línea (`patient_online: true` con punto verde) o la hora de última actividad (`patient_last_seen_at`), o «Desconectado» / «Aún no ha entrado» si es nulo.
- CA9.2 **Paciente**:
  - En `/mi-caso` y en `/sala-espera`, el paciente **NUNCA** ve si el médico está conectado. No se renderiza ningún componente de presencia médica (`IndicadorPresenciaPaciente` no se monta), ni badge de estado, ni texto de «última vez activo», ni indicadores de conexión.

## Tipos TypeScript (`lib/messages.ts`)

```typescript
export interface MessageAttachment {
  id: string
  message_id?: string
  consultation_id: string
  uploader_role: 'doctor' | 'patient'
  file_name: string | null // null si no hay grant clínico
  mime_type: string
  file_size_bytes: number
  created_at: string
}

export interface AttachmentUploadResponse {
  id: string
  file_name: string
  mime_type: string
  file_size_bytes: number
}

export interface Message {
  id: string
  consultation_id: string
  sender_role: 'doctor' | 'patient' | 'system'
  sender_user_id: string | null
  direction: 'doctor_to_patient' | 'patient_to_doctor' | 'system'
  channel: 'web' | 'whatsapp'
  kind: 'text' | 'attachment' | 'call'
  body: string | null // null si no hay grant clínico
  attachments?: MessageAttachment[]
  sent_at: string
  delivered_at: string | null
  read_at: string | null
  delivery_status: 'sent' | 'delivered' | 'read' | 'failed'
  client_msg_id?: string | null
}

export interface InboxThread {
  consultation_id: string
  code: string
  specialty_name: string
  patient_display_name: string
  status: string
  last_message_at: string | null
  last_direction: 'doctor_to_patient' | 'patient_to_doctor' | 'system' | null
  unread_count: number
  // Solo presentes en las vistas del médico profesional (asimetría estricta)
  patient_online?: boolean
  patient_last_seen_at?: string | null
}

export interface SendMessagePayload {
  body?: string
  attachment_ids?: string[]
  client_msg_id?: string
}

export interface AuthOptions {
  token?: string // JWT de Supabase para staff y pacientes con cuenta
  consultationToken?: string // X-Consultation-Token para pacientes anónimos
}
```

## Componentes

```
components/mensajes/HiloMensajes.tsx               lista + compositor con upload PDF/imagen y bloqueo GIF (reutilizado por U1, U3, U4)
components/mensajes/AdjuntoMensaje.tsx             tarjeta PDF o miniatura de imagen autenticada
components/mensajes/ModalVisorImagen.tsx           lightbox para ver imagen en tamaño completo
components/mensajes/IndicadorPresenciaPaciente.tsx chip/punto verde «En línea» (solo para médicos)
components/mensajes/EstadoEntrega.tsx              chip de estado (web/WhatsApp)
components/mensajes/ConsentimientoWhatsApp.tsx     casilla / interruptor
lib/messages.ts                                    listMessages, sendMessage, uploadAttachment, fetchAttachmentBlob, markRead, inbox, inboxStream
pages/panel-medico/mensajes.tsx                    buzón con lista de hilos y presencia de pacientes
```

## E2E

`e2e/mensajes-medico.spec.ts`, `e2e/mensajes-paciente.spec.ts`, `e2e/mensajes-admin.spec.ts`
(ver skill `mensajeria`).

- El médico ve el hilo, envía texto y adjuntos (PDF/imagen), visualiza si el paciente está en línea y estados de entrega.
- El paciente envía texto y adjuntos (PDF/imagen), recibe mensajes, y se comprueba de forma explícita que **no existe** ningún indicador de presencia del médico en la pantalla.
- Se prueba el intento de subir un `.gif` (o `.GIF`), verificando el bloqueo inmediato en cliente con mensaje de alerta y sin realizar petición HTTP fallida.
- Se prueba la subida exitosa de un PDF y una imagen PNG/JPG por parte del médico y del paciente.
- Ningún spec provoca envíos reales por WhatsApp ni correo.

## Fuera de alcance

- Audios de voz, notas de voz, edición o borrado de mensajes (los adjuntos PDF e imágenes no-GIF sí forman parte del alcance de la mensajería).
- Formato GIF (`image/gif`): terminantemente prohibido tanto en cliente como en servidor por razones de sobriedad clínica, seguridad y ancho de banda.
- Visibilidad del estado de presencia del médico hacia el paciente: estrictamente prohibida por diseño.
- «Escribiendo…» en tiempo real en la versión de buzón asíncrono (ver `spec-chat-tiempo-real.md` para la variante websocket v2).
- Push real (Web Push / FCM): `lib/firebase.ts` del frontend está sin conectar y no forma parte de este encargo.
- Cita presencial como tipo de agenda (P6).
