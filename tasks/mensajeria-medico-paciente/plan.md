# Implementation Plan (UI): Mensajería médico ↔ paciente

> Spec UI: [`spec.md`](./spec.md) · Checklist: [`todo.md`](./todo.md) · Plan canónico:
> `../../../api-medicos-por-venezuela/tasks/mensajeria-medico-paciente/plan.md`
> Spec complementaria en tiempo real: `spec-chat-tiempo-real.md`

## Architecture Decisions

**1. Un solo componente de hilo para tres pantallas (`HiloMensajes`).** `HiloMensajes` recibe `consultationId`, `auth` (`session` | `token`), y `role` (`doctor` | `patient`). Encapsula carga cronológica, envío, subida desacoplada de adjuntos y marcado de leído. Si `role === 'patient'`, la UI omite por completo cualquier indicador de presencia del médico (`IndicadorPresenciaPaciente` no se monta) y la cabecera muestra únicamente los datos profesionales de la consulta.

**2. El SSE solo avisa; la verdad llega por REST.** Al evento `message`/`inbox` se hace refetch.
Ningún cuerpo se guarda en estado a partir del stream. `setX(prev => …)` siempre.

**3. Sin lecturas a Supabase.** `messages` está deny-all; todo por `lib/messages.ts` sobre
`lib/apiClient.ts`. Si falta un endpoint, se vuelve a la API.

**4. La UI no se abre hasta que el endpoint existe.** Cada tarea de UI declara el endpoint que
consume y se ejecuta después de que su tarea de API esté en `dev`.

**5. Nada de teléfonos.** Los tipos de `lib/messages.ts` no incluyen `phone`; si la API lo
mandara, no se pinta.

**6. Subida desacoplada de archivos clínicos (PDF e imágenes) y bloqueo estricto de GIF.**

- Formatos permitidos: documentos PDF (`application/pdf`, `.pdf`) e imágenes rasterizadas (`image/jpeg`, `.jpg`/`.jpeg`, `image/png`, `.png`, `image/webp`, `.webp`).
- Bloqueo de formato GIF: selector HTML con `accept="application/pdf,image/jpeg,image/png,image/webp"` (evitando comodines como `image/*`). Validación reactiva en cliente al seleccionar, arrastrar o pegar archivos que detecta `image/gif` o extensión `/\.gif$/i` y cancela la operación de inmediato con notificación visual («Formato GIF no permitido. Solo se admiten documentos PDF e imágenes JPG, PNG o WEBP»), sin disparar llamadas de red fallidas.
- Límite de tamaño: 10 MB (`10485760` bytes) validado antes de la subida.
- Subida desacoplada en dos pasos: primero se sube el archivo a `POST /consultations/{id}/attachments` mediante `lib/messages.ts:uploadAttachment` (usando `FormData` y soportando `Authorization: Bearer` o `X-Consultation-Token`), obteniendo `{ id, file_name, mime_type, file_size_bytes }` que se previsualiza en el compositor. Luego, al enviar el mensaje, se invoca `POST /consultations/{id}/messages` con `{ body, attachment_ids: [id], client_msg_id }`.
- Visualización y descarga segura: las descargas y miniaturas pasan por `GET /consultations/{id}/attachments/{id}` con cabeceras de autorización y `X-Content-Type-Options: nosniff`. Como las etiquetas `<img src>` estándar no pueden enviar cabeceras personalizadas (`X-Consultation-Token` o `Bearer`), se implementa `fetchAttachmentBlob` en `lib/messages.ts` para obtener el `Blob` y crear URLs de objeto seguras (`URL.createObjectURL(blob)`) con revocación (`revokeObjectURL`) al desmontar para evitar fugas de memoria.

**7. Asimetría estricta de presencia entre médico y paciente.**

- El médico tratante visualiza si el paciente está en línea (`patient_online: boolean`), su última actividad (`patient_last_seen_at`), o «Desconectado» / «Aún no ha entrado» si es nulo, tanto en su buzón (`/panel-medico/mensajes`) como en el hilo de la consulta (`/panel-medico/consulta/[id]`).
- La vista del paciente (`/mi-caso`, `/sala-espera`) no solicita, no recibe y no renderiza ningún indicador de conexión ni última vez del médico profesional. Esto resguarda al voluntariado médico frente a expectativas de inmediatez.

## Fases y horas

Presupuesto de Fase 1 sincronizado estrictamente con el plan canónico de backend (5 h Front para completar el total de 20 h de la Fase 1):

| Tarea                                                                                                                                                                                        | Horas                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| F1.1 `lib/messages.ts` + tipos (`MessageAttachment`, `InboxThread`, `Message`, upload/download helpers con auth y manejo de Blob)                                                            | 0,5                                                 |
| F1.2 `HiloMensajes`, `AdjuntoMensaje`, `ModalVisorImagen`, `IndicadorPresenciaPaciente`, `EstadoEntrega` + bloque consulta (U1) con upload PDF/imágenes, bloqueo GIF y presencia de paciente | 1,5                                                 |
| F1.3 Buzón `/panel-medico/mensajes` (U2) con presencia de pacientes (`patient_online`) + contador en `PanelHeader` y tarjeta                                                                 | 1,0                                                 |
| F1.4 `/mi-caso` y `/sala-espera` (U3, U4) con subida de adjuntos (sin GIF) y asimetría estricta (cero presencia médica) + preferencia (U5)                                                   | 1,0                                                 |
| F1.5 E2E médico/paciente/admin (verificación de subida PDF/imagen, bloqueo GIF en cliente, asimetría de presencia), `changeslog.md`, `CLAUDE.md`                                             | 1,0                                                 |
| **Fase 1**                                                                                                                                                                                   | **5**                                               |
| F2.1 Consentimiento en registro y `/mi-caso` (U6) + privacidad                                                                                                                               | 1                                                   |
| F2.2 Estados de entrega (U7) + E2E                                                                                                                                                           | 1                                                   |
| **Fase 2**                                                                                                                                                                                   | **2** (+1 h de infraestructura en el plan canónico) |

## Riesgos

- Ficheros grandes (`consulta/[id].tsx` 1218 líneas): el bloque se añade como componente aparte
  y un solo punto de montaje, sin reorganizar el resto.
- Subida de archivos en conexiones inestables: la UI debe mostrar estado de subida (cargando/progreso) y permitir reintentar o descartar antes de enviar.
- Validación de tipos de archivo: usuarios que intenten renombrar archivos `.gif` a `.png` o subir GIFs arrastrados o pegados; la UI valida tipo MIME del navegador y extensión `/\.gif$/i`, y atrapa el 422 de la API si la validación profunda de magic bytes en el servidor lo rechaza.
- Fugas de memoria por URLs de objetos Blob: cada llamada a `URL.createObjectURL` para visualizar imágenes o descargar PDFs debe tener su correspondiente llamada a `URL.revokeObjectURL` en la limpieza (`useEffect` return).
- Otro desarrollador activo en `dev_aws`: rebase antes de abrir el PR y re-auditar la entrada del
  changelog.
