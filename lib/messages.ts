/**
 * Cliente de mensajería médico ↔ paciente (api-medicos-por-venezuela).
 * Gestiona hilos de chat, adjuntos clínicos (PDF/imágenes, GIF prohibido)
 * y la asimetría estricta de presencia entre médicos y pacientes.
 */

import { ApiError, getFile, getJson, postFormData, postJson } from './apiClient'

export { ApiError }

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
}

export interface InboxThread {
  consultation_id: string
  code: string
  specialty?: string | null
  specialty_name?: string
  patient_name: string
  patient_display_name?: string
  status: string
  last_message_at: string
  last_direction: 'doctor_to_patient' | 'patient_to_doctor' | 'system' | string
  unread_count: number
  // Solo presentes en las vistas del médico profesional (asimetría estricta)
  patient_online?: boolean
  patient_last_seen_at?: string | null
  active_call?: string | null
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
 */
export async function listMessages(
  consultationId: string,
  options?: ListMessagesOptions,
  auth?: AuthOptions
): Promise<Message[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  if (options?.afterId) params.set('after_id', options.afterId)
  if (options?.beforeId) params.set('before_id', options.beforeId)

  const qs = params.toString() ? `?${params.toString()}` : ''
  const path = `/api/v1/consultations/${consultationId}/messages${qs}`
  const { token, extraHeaders } = resolveAuthHeaders(auth)

  const rawMessages = await getJson<Message[]>(
    path,
    'No se pudieron cargar los mensajes de la consulta',
    token,
    extraHeaders
  )

  return rawMessages.map((msg) => ({
    ...msg,
    attachments: msg.attachments || []
  }))
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
