/**
 * Cliente de mensajería médico ↔ paciente (api-medicos-por-venezuela).
 * Gestiona hilos de chat, adjuntos clínicos (PDF/imágenes, GIF prohibido)
 * y la asimetría estricta de presencia entre médicos y pacientes.
 */

import { useEffect, useRef } from 'react'
import { API_URL, ApiError, getFile, getJson, postFormData, postJson } from './apiClient'
import { supabase } from './supabase'

export { ApiError }

/**
 * Nivel de acceso clínico con el que la API generó la respuesta (`ClinicalAccessMixin`).
 * `none` significa que los campos clínicos vienen en null POR PERMISO, no porque estén vacíos:
 * es la señal que distingue «no hay grant» de «este mensaje solo trae un adjunto».
 */
export type ClinicalAccess = 'full' | 'summary' | 'none'

export interface MessageAttachment {
  id: string
  message_id?: string | null
  consultation_id: string
  uploader_role: 'doctor' | 'patient' | 'system' | string
  uploader_user_id?: string | null
  file_name: string | null // null si no hay grant clínico (fail-closed)
  mime_type: string
  file_size_bytes: number
  created_at: string
  clinical_access?: ClinicalAccess
}

export interface AttachmentUploadResponse {
  id: string
  file_name: string | null
  mime_type: string
  file_size_bytes: number
  created_at?: string
}

export interface Message {
  id: string
  consultation_id: string
  sender_role: 'doctor' | 'patient' | 'system' | string
  sender_user_id: string | null
  direction: 'doctor_to_patient' | 'patient_to_doctor' | 'system'
  channel: 'web' | 'whatsapp' | 'system'
  kind:
    'text' | 'image' | 'document' | 'call_event' | 'system_notice' | 'attachment' | 'call' | string
  call_session_id?: string | null
  body: string | null // null si no hay grant clínico (fail-closed)
  client_msg_id?: string | null
  sent_at: string
  delivered_at: string | null
  read_at: string | null
  delivery_status: 'sent' | 'delivered' | 'read' | 'failed' | string
  attachments: MessageAttachment[]
  clinical_access?: ClinicalAccess
}

/**
 * Cuerpo de `GET /consultations/{id}/messages`. Desde las correcciones de la API ya NO es un
 * array: envuelve los mensajes en `items` y añade el contador de no leídos del llamante y el
 * nivel de acceso clínico. `unread_count` se lee de AQUÍ y no de la cabecera `X-Unread-Count`
 * (que sigue existiendo por compatibilidad): el cuerpo es la fuente de verdad.
 */
export interface MessagesThread {
  consultation_id: string
  unread_count: number
  items: Message[]
  clinical_access: ClinicalAccess
}

export interface InboxThread {
  consultation_id: string
  code: string
  specialty?: string | null
  specialty_name?: string
  patient_name: string
  patient_display_name?: string
  status: string
  // La API lo construye sobre `messages`, así que un hilo del buzón siempre tiene último
  // mensaje; se declara anulable porque la spec de dominio lo permite y porque imprimir
  // «hace 0 min» por un nulo es peor que decir que no se sabe.
  last_message_at: string | null
  // TRES valores desde R16, no dos: el aviso de videollamada que el médico deja en el hilo es un
  // mensaje de sistema (`direction: "system"`), así que puede ser el último del hilo. Una consulta
  // cuyo ÚNICO mensaje sea ese aviso sí aparece en el buzón, con `unread_count: 0` (la dirección
  // `system` queda fuera de los dos contadores). Quien lo pinte tiene que cubrir el tercer caso:
  // ver `etiquetaUltimaDireccion`.
  last_direction: 'doctor_to_patient' | 'patient_to_doctor' | 'system' | string
  unread_count: number
  // Solo presentes en las vistas del médico profesional (asimetría estricta)
  patient_online?: boolean
  patient_last_seen_at?: string | null
  active_call?: string | null
}

/**
 * Cuerpo de `POST /consultations/{id}/video-call` (R16, CA16.4).
 *
 * `room_url` es la sala Jitsi y solo se le devuelve al médico tratante: se abre en una ventana
 * aparte pasando SIEMPRE por `browserRoomUrl` (reescribe salas legacy y salta el interstitial
 * móvil). `message_id` es el mensaje de sistema que quedó en el hilo para que el paciente se
 * entere; su cuerpo es SOLO el texto del aviso: no lleva URL ni token (CA16.6), porque un enlace
 * con token dentro del cuerpo deja un secreto de 24 h escrito en el historial clínico y a la vista
 * en pantalla. El acceso del paciente lo construye la interfaz con el `consultation_id` y la
 * credencial con la que ya está leyendo el hilo.
 */
export interface VideoCallStart {
  room_url: string
  message_id: string
}

/**
 * Quién escribió el último mensaje de un hilo del buzón, en español y cubriendo los TRES valores
 * de `last_direction`. Sin el caso `system` un hilo cuyo último mensaje sea el aviso de
 * videollamada (R16) se pintaría como si lo hubiera escrito el paciente o el propio médico, que
 * es justo lo que no es: no lo escribió nadie y no cuenta como no leído.
 */
export function etiquetaUltimaDireccion(dir: InboxThread['last_direction']): string {
  if (dir === 'patient_to_doctor') return 'Último mensaje: del paciente'
  if (dir === 'doctor_to_patient') return 'Último mensaje: tu respuesta'
  if (dir === 'system') return 'Último mensaje: aviso del sistema'
  // Un valor que esta versión del cliente no conoce todavía: se dice que no se sabe, no se
  // adivina una dirección.
  return 'Último mensaje: sin clasificar'
}

export interface SendMessagePayload {
  body?: string | null
  attachment_ids?: string[]
  client_msg_id?: string | null
}

export interface AuthOptions {
  token?: string // JWT de Supabase para staff y pacientes con cuenta
  consultationToken?: string // X-Consultation-Token para pacientes anónimos
}

export interface ListMessagesOptions {
  limit?: number
  offset?: number
  afterId?: string
  beforeId?: string
}

export interface InboxOptions {
  onlyUnread?: boolean
  limit?: number
  offset?: number
}

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]

/**
 * Valida un archivo antes de iniciar la subida al backend.
 * Rechaza estrictamente GIF y archivos mayores a 10 MB.
 */
export function validateAttachmentFile(file: File): { valid: boolean; error?: string } {
  // 1. Bloqueo inmediato de GIF (por MIME o extensión case-insensitive)
  if (file.type === 'image/gif' || /\.gif$/i.test(file.name)) {
    return {
      valid: false,
      error: 'Formato GIF no permitido. Solo se admiten documentos PDF e imágenes JPG, PNG o WEBP.'
    }
  }

  // 2. Validación de tamaño (máx 10 MB)
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: 'El archivo supera el tamaño máximo permitido de 10 MB.'
    }
  }

  // 3. Validación de MIME types y extensiones válidas
  const isAllowedMime = ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)
  const isAllowedExt = /\.(pdf|jpe?g|png|webp)$/i.test(file.name)

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error:
        'Tipo de archivo no permitido. Solo se admiten documentos PDF e imágenes JPG, PNG o WEBP.'
    }
  }

  return { valid: true }
}

function resolveAuthHeaders(auth?: AuthOptions): {
  token?: string
  extraHeaders?: Record<string, string>
} {
  const extraHeaders: Record<string, string> = {}
  if (auth?.consultationToken) {
    extraHeaders['X-Consultation-Token'] = auth.consultationToken
  }
  return {
    token: auth?.token,
    extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined
  }
}

/**
 * Lista los mensajes de una consulta en orden cronológico con paginación por cursor o límite.
 * Devuelve el hilo completo: `items`, `unread_count` y `clinical_access`.
 */
export async function listMessages(
  consultationId: string,
  options?: ListMessagesOptions,
  auth?: AuthOptions
): Promise<MessagesThread> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  if (options?.afterId) params.set('after_id', options.afterId)
  if (options?.beforeId) params.set('before_id', options.beforeId)

  const qs = params.toString() ? `?${params.toString()}` : ''
  const path = `/api/v1/consultations/${consultationId}/messages${qs}`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  const raw = await getJson<Partial<MessagesThread>>(
    path,
    'No se pudieron cargar los mensajes de la consulta',
    token,
    extraHeaders
  )

  // Defensivo campo a campo. `items` y `clinical_access` los declara la API con valor por
  // omisión (`[]` y `"none"`); `consultation_id` y `unread_count` son requeridos y sin default,
  // así que el respaldo de esos dos es solo red de seguridad ante un cuerpo recortado. La
  // ausencia de `clinical_access` se trata como «sin grant» (fail-closed), nunca como acceso.
  return {
    consultation_id: raw.consultation_id || consultationId,
    unread_count: raw.unread_count ?? 0,
    clinical_access: raw.clinical_access || 'none',
    items: (raw.items || []).map((msg) => ({
      ...msg,
      attachments: msg.attachments || []
    }))
  }
}

/**
 * Envía un mensaje en el hilo de la consulta (médico tratante o paciente).
 */
export async function sendMessage(
  consultationId: string,
  payload: SendMessagePayload,
  auth?: AuthOptions
): Promise<Message> {
  const path = `/api/v1/consultations/${consultationId}/messages`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  return postJson<Message>(
    path,
    {
      body: payload.body || null,
      attachment_ids: payload.attachment_ids || [],
      client_msg_id: payload.client_msg_id || null
    },
    'No se pudo enviar el mensaje',
    token,
    extraHeaders
  )
}

/**
 * Sube un archivo adjunto clínico (Paso 1 del flujo desacoplado).
 * Devuelve AttachmentUploadResponse con el ID generado.
 */
export async function uploadAttachment(
  consultationId: string,
  file: File,
  auth?: AuthOptions
): Promise<AttachmentUploadResponse> {
  const validation = validateAttachmentFile(file)
  if (!validation.valid) {
    throw new ApiError(422, validation.error || 'Archivo inválido')
  }

  const formData = new FormData()
  formData.append('file', file)

  const path = `/api/v1/consultations/${consultationId}/attachments`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  return postFormData<AttachmentUploadResponse>(
    path,
    formData,
    'No se pudo subir el archivo adjunto',
    token,
    extraHeaders
  )
}

/**
 * Descarga o visualiza un adjunto con cabeceras de autenticación y protección de datos clínicos.
 */
export async function fetchAttachmentBlob(
  consultationId: string,
  attachmentId: string,
  auth?: AuthOptions
): Promise<{ blob: Blob; filename: string | null }> {
  const path = `/api/v1/consultations/${consultationId}/attachments/${attachmentId}`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  return getFile(path, 'No se pudo obtener el archivo adjunto', token, extraHeaders)
}

/**
 * Marca como leídos los mensajes de la otra dirección en este hilo.
 */
export async function markRead(
  consultationId: string,
  auth?: AuthOptions
): Promise<{ marked: number }> {
  const path = `/api/v1/consultations/${consultationId}/messages/read`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  return postJson<{ marked: number }>(
    path,
    {},
    'No se pudo actualizar el estado de lectura',
    token,
    extraHeaders
  )
}

/**
 * Inicia la videoconsulta desde el hilo (R16). Asegura la sala de la consulta (idempotente: dos
 * clics devuelven la misma URL) y deja en el hilo un mensaje de sistema con el aviso y el enlace
 * de entrada para el paciente.
 *
 * Solo el médico tratante: el paciente —con sesión o con `X-Consultation-Token`— recibe 404, igual
 * que un médico ajeno o un admin no tratante (CA16.3). Un 409 significa que la consulta ya no
 * admite mensajes, y su `message` trae el motivo exacto para mostrarlo tal cual.
 */
export async function startVideoCall(
  consultationId: string,
  auth?: AuthOptions
): Promise<VideoCallStart> {
  const path = `/api/v1/consultations/${consultationId}/video-call`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  return postJson<VideoCallStart>(
    path,
    {},
    'No se pudo iniciar la videoconsulta',
    token,
    extraHeaders
  )
}

/**
 * Lista el buzón consolidado de conversaciones del médico (GET /api/v1/inbox).
 * Incluye presencia asimétrica del paciente (`patient_online`, `patient_last_seen_at`).
 */
export async function getInboxSummary(
  options?: InboxOptions,
  auth?: AuthOptions
): Promise<InboxThread[]> {
  const params = new URLSearchParams()
  if (options?.onlyUnread) params.set('only_unread', 'true')
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))

  const qs = params.toString() ? `?${params.toString()}` : ''
  const path = `/api/v1/inbox${qs}`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  const rawThreads = await getJson<InboxThread[]>(
    path,
    'No se pudo cargar el buzón de mensajes',
    token,
    extraHeaders
  )

  return rawThreads.map((t) => ({
    ...t,
    specialty_name: t.specialty_name || t.specialty || undefined,
    patient_display_name: t.patient_display_name || t.patient_name
  }))
}

/* ---------------------------------------------------------------------------
 * SSE del buzón del médico — `GET /api/v1/inbox/stream` (CA2.3, R8.2)
 *
 * El evento es una SEÑAL, no datos: trae `unread_total` y los ids de los hilos que cambiaron, y
 * el cliente pide la lista por REST como ya hacía (CA8.3: ningún cuerpo clínico viaja por SSE).
 *
 * Con `fetch` y no con `EventSource`, por lo mismo que `lib/waitingRoom.ts`: `EventSource` no
 * puede mandar cabeceras y el JWT acabaría en la URL (logs de proxies, historial). El endpoint
 * exige permiso `messages.read`, así que esto es SOLO para el médico: no se monta en ninguna ruta
 * de paciente.
 *
 * Una sola conexión para toda la app, con recuento de suscriptores: la cabecera (`PanelHeader`,
 * montada en todas las rutas de `/panel-medico`) y el buzón comparten el mismo stream. Sin esto
 * habría DOS conexiones abiertas en `/panel-medico/mensajes`, cada una con su sondeo en el
 * servidor, y navegar entre el buzón y el detalle las iría duplicando.
 * ------------------------------------------------------------------------- */

export interface InboxSignal {
  unread_total: number
  updated: string[]
}

/** `null` = tic de respaldo (el stream no está disponible): refresca por REST, sin payload. */
export type InboxListener = (signal: InboxSignal | null) => void

// La API corta el stream a los ~300 s a propósito (`WAITING_ROOM_STREAM_MAX_SECONDS`).
const INBOX_RECONNECT_MS = 1_500
// Respaldo cuando el stream no pasa (proxy, red): el mismo ritmo que tenía el sondeo que sustituye.
const INBOX_FALLBACK_POLL_MS = 12_000
// Sin sesión o sin permiso: espera que se duplica a cada fallo seguido, con tope.
const INBOX_CREDENTIAL_RETRY_MS = 30_000
const INBOX_CREDENTIAL_RETRY_MAX_MS = 300_000

type InboxStreamEnd = 'ended' | 'unauthorized' | 'forbidden' | 'error' | 'aborted'

const inboxListeners = new Set<InboxListener>()
let inboxController: AbortController | null = null

function emitInboxSignal(signal: InboxSignal | null): void {
  // Copia de la lista: un oyente que se da de baja al recibir el evento no debe romper el bucle.
  for (const listener of Array.from(inboxListeners)) {
    try {
      listener(signal)
    } catch {
      // Un oyente que falla no tumba a los demás ni al stream.
    }
  }
}

// Espera `ms`, o menos si se aborta. El oyente de `abort` se RETIRA en los dos caminos: esta
// función se llama en cada vuelta del bucle (cada 12 s en modo respaldo) sobre el MISMO
// `AbortSignal`, así que dejarlo puesto acumulaba un oyente por vuelta —cientos en una guardia
// larga— y al abortar se disparaban todos juntos.
function waitMs(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    let timer = 0
    const onAbort = () => {
      window.clearTimeout(timer)
      resolve()
    }
    timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    // `once`: si gana el abort, el oyente se retira solo; si gana el temporizador, lo retira él.
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

// Lee el stream hasta que termina. Solo atiende a `event: inbox` con el JSON de la señal; el
// `retry:` inicial y los comentarios de latido (líneas que empiezan por `:`) se ignoran, que es
// lo que toca: la reconexión la gobierna el bucle de abajo, no el navegador.
async function readInboxStream(
  url: string,
  token: string,
  signal: AbortSignal,
  onSignal: (s: InboxSignal) => void
): Promise<InboxStreamEnd> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
      cache: 'no-store'
    })
  } catch {
    return signal.aborted ? 'aborted' : 'error'
  }
  if (res.status === 401) return 'unauthorized'
  if (res.status === 403) return 'forbidden'
  if (!res.ok || !res.body) return 'error'

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return 'ended'
      buffer += decoder.decode(value, { stream: true })
      let cut = buffer.indexOf('\n\n')
      while (cut >= 0) {
        const block = buffer.slice(0, cut)
        buffer = buffer.slice(cut + 2)
        let event = 'message'
        const data: string[] = []
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data.push(line.slice(5).trim())
        }
        if (event === 'inbox' && data.length) {
          try {
            const parsed = JSON.parse(data.join('\n')) as Partial<InboxSignal>
            onSignal({
              unread_total: parsed.unread_total ?? 0,
              updated: parsed.updated || []
            })
          } catch {
            // Un bloque ilegible no tumba el buzón: el siguiente cambio llega completo.
          }
        }
        cut = buffer.indexOf('\n\n')
      }
    }
  } catch {
    return signal.aborted ? 'aborted' : 'error'
  }
}

async function runInboxLoop(controller: AbortController): Promise<void> {
  const { signal } = controller
  const url = `${API_URL}/api/v1/inbox/stream`
  // Fallos de credencial seguidos (sin sesión, 401, 403). Gobiernan una espera que crece sola:
  // el bucle NO termina por ellos —terminar dejaba a los suscriptores sin stream y sin tics,
  // es decir, a un médico mudo con el badge congelado hasta recargar— pero tampoco puede
  // reintentar cada segundo contra una API que ya dijo que no.
  let fallosDeCredencial = 0

  try {
    while (!signal.aborted) {
      // Sesión fresca en cada conexión: una guardia abierta dura más que un access_token de
      // Supabase (1 h), y con uno caducado la API responde 401 aunque el médico siga teniendo
      // derecho a su buzón. Con `autoRefreshToken`, pedirla con el token vencido dispara la
      // renovación, que sí va por red; sin sesión no hay nada que renovar y no genera tráfico.
      //
      // El `try` no es decorativo: `getSession()` devuelve el error en `{ data, error }` y no
      // lanza, pero si alguna vez lanzara, la excepción sacaría a este bucle con suscriptores
      // vivos —el badge mudo que el bucle existe para evitar— y moriría como unhandled rejection
      // en el `void runInboxLoop(...)` que lo arranca. Se trata como «sin credencial» y entra en
      // el retroceso de abajo, que reintenta.
      let token: string | undefined
      try {
        const { data } = await supabase.auth.getSession()
        token = data.session?.access_token
      } catch {
        token = undefined
      }

      const end: InboxStreamEnd = token
        ? await readInboxStream(url, token, signal, emitInboxSignal)
        : 'unauthorized'

      if (end === 'aborted') return

      if (end === 'ended') {
        // La API corta el stream a los pocos minutos a propósito: se reconecta.
        fallosDeCredencial = 0
        await waitMs(INBOX_RECONNECT_MS, signal)
        continue
      }

      // Un tic sin payload en cualquier fallo: los suscriptores refrescan por REST, que es donde
      // cada pantalla tiene su propio manejo de error y de sesión (la página redirige a /login si
      // hace falta). Un médico sin avisos es peor que uno con retraso.
      emitInboxSignal(null)

      if (end === 'unauthorized' || end === 'forbidden') {
        // 30 s, 1 min, 2 min… hasta 5 min. Si la sesión se recupera (Supabase renueva el token),
        // la vuelta siguiente vuelve a abrir el stream y todo sigue sin que nadie recargue.
        const espera = Math.min(
          INBOX_CREDENTIAL_RETRY_MS * 2 ** fallosDeCredencial,
          INBOX_CREDENTIAL_RETRY_MAX_MS
        )
        fallosDeCredencial += 1
        await waitMs(espera, signal)
        continue
      }

      // 'error': el stream no está disponible (red, proxy que no lo deja pasar). Modo respaldo,
      // al mismo ritmo que el sondeo que sustituyó, reintentando el stream en cada vuelta.
      fallosDeCredencial = 0
      await waitMs(INBOX_FALLBACK_POLL_MS, signal)
    }
  } finally {
    // Liberar el hueco SIEMPRE, por donde sea que se salga: dejar `inboxController` ocupado haría
    // que el siguiente suscriptor se encontrara la plaza tomada y se quedara mudo, sin stream y
    // sin tics de respaldo.
    if (inboxController === controller) inboxController = null
  }
}

/**
 * Se suscribe a la señal del buzón. Devuelve la función para darse de baja; la conexión se abre
 * con el primer suscriptor y se cierra con el último.
 */
export function subscribeInboxSignal(listener: InboxListener): () => void {
  inboxListeners.add(listener)
  if (!inboxController && typeof window !== 'undefined') {
    const controller = new AbortController()
    inboxController = controller
    void runInboxLoop(controller)
  }
  return () => {
    inboxListeners.delete(listener)
    if (inboxListeners.size === 0 && inboxController) {
      inboxController.abort()
      inboxController = null
    }
  }
}

/**
 * Hook del stream del buzón. `enabled` en false no abre nada (rutas de paciente, sesión caída).
 * `onSignal` puede cambiar en cada render sin reabrir la conexión.
 */
export function useInboxSignal(enabled: boolean, onSignal: InboxListener): void {
  const listenerRef = useRef<InboxListener>(onSignal)

  useEffect(() => {
    listenerRef.current = onSignal
  }, [onSignal])

  useEffect(() => {
    if (!enabled) return
    return subscribeInboxSignal((signal) => listenerRef.current(signal))
  }, [enabled])
}
