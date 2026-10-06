import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  AuthOptions,
  ClinicalAccess,
  listMessages,
  markRead,
  Message,
  MessagesThread,
  sendMessage,
  uploadAttachment,
  validateAttachmentFile
} from '../../lib/messages'
import { fmtDateTime } from '../../lib/admin'
import { minutesSince, tiempoTranscurrido } from '../../lib/utils'
import AdjuntoMensaje from './AdjuntoMensaje'
import EstadoEntrega from './EstadoEntrega'
import IndicadorPresenciaPaciente from './IndicadorPresenciaPaciente'
import { notify } from '../../lib/nativeNotifications'

interface HiloMensajesProps {
  consultationId: string
  currentUserRole: 'doctor' | 'patient' | 'admin' | string
  auth?: AuthOptions
  patientOnline?: boolean
  patientLastSeenAt?: string | null
  isCaseClosed?: boolean
  readOnly?: boolean
  onMessageSent?: (msg: Message) => void
  className?: string
}

// Estado del hilo cargado, etiquetado con la consulta a la que pertenece. Llevar el `id` dentro
// del estado permite DERIVAR el "cargando" en el render (`thread.id !== consultationId`) en vez
// de hacer `setLoading(true)` dentro del effect, que es el render en cascada que marcaba ESLint
// (react-hooks/set-state-in-effect).
interface ThreadState {
  id: string
  list: Message[]
  error: string | null
  // `null` mientras no ha llegado la primera respuesta: no se puede decidir «sin grant» antes de
  // que la API lo diga, o el hilo pintaría el aviso de auditoría a todo el mundo durante la carga.
  clinicalAccess: ClinicalAccess | null
}

// CA1.1: la fecha del mensaje se lee en relativo ("hace 5 min"); la absoluta queda en el `title`
// para quien necesite el detalle exacto.
function fechaRelativa(sentAt: string): string {
  if (minutesSince(sentAt) < 1) return 'ahora mismo'
  return `hace ${tiempoTranscurrido(sentAt)}`
}

export default function HiloMensajes({
  consultationId,
  currentUserRole,
  auth,
  patientOnline,
  patientLastSeenAt,
  isCaseClosed = false,
  readOnly = false,
  onMessageSent,
  className = ''
}: HiloMensajesProps) {
  const [thread, setThread] = useState<ThreadState | null>(null)
  const [sending, setSending] = useState<boolean>(false)
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  // CA1.8: la API respondió 409 (consulta fuera de la ventana de mensajería). Con esto puesto,
  // el compositor y el botón de adjuntos quedan deshabilitados: reintentar solo da otro 409.
  const [ventanaCerrada, setVentanaCerrada] = useState<string | null>(null)

  // Compositor state
  const [text, setText] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastMsgIdRef = useRef<string | null>(null)
  const isFirstLoadRef = useRef<boolean>(true)

  const isDoctor = currentUserRole === 'doctor' || currentUserRole === 'specialist'
  const isPatient = currentUserRole === 'patient'
  const esRolDeAuditoria = currentUserRole === 'admin' || currentUserRole === 'super_admin'

  // El objeto `auth` llega literal desde las páginas (`auth={{ token }}`), así que cambia de
  // identidad en cada render. Memorizarlo por sus dos valores lo vuelve estable y deja que los
  // hooks declaren sus dependencias de verdad (sin `exhaustive-deps` silenciado) tanto aquí como
  // en `AdjuntoMensaje`.
  const authToken = auth?.token
  const authConsultationToken = auth?.consultationToken
  const authOptions = useMemo<AuthOptions>(
    () => ({ token: authToken, consultationToken: authConsultationToken }),
    [authToken, authConsultationToken]
  )

  // Mensajes y error del hilo VIGENTE: si `consultationId` cambia, lo cargado ya no vale y la
  // vista vuelve a "cargando" sin tocar el estado.
  const current = thread && thread.id === consultationId ? thread : null
  const messages = current?.list ?? []
  const error = current?.error ?? null
  const loading = current === null
  const clinicalAccess = current?.clinicalAccess ?? null

  // «Sin grant clínico» lo DECLARA la API (`clinical_access: "none"`), no se adivina por el rol:
  // es la diferencia entre un cuerpo nulo por permiso y un mensaje que solo trae un adjunto.
  // Mientras no haya respuesta (`null`) no se asume nada, para no parpadear.
  const sinGrantClinico = clinicalAccess === 'none'

  // Dos niveles a propósito: lo que el ROL permite (estable, es lo que miran los hooks) y lo que
  // además permite el grant que declaró la API (solo para pintar). Si `canSend` entrara en las
  // dependencias de los hooks, la primera respuesta las cambiaría y recargaría el hilo otra vez.
  const puedeEscribirPorRol = !readOnly && !esRolDeAuditoria
  const canSend = puedeEscribirPorRol && !sinGrantClinico

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Traer el hilo. Esta función NO toca estado: pedir y aplicar van separados a propósito, para
  // que el `setThread` viva siempre dentro del callback de la promesa (lo que pide
  // react-hooks/set-state-in-effect) y no en el cuerpo del effect.
  const fetchHilo = useCallback(
    () => listMessages(consultationId, { limit: 100 }, authOptions),
    [consultationId, authOptions]
  )

  const aplicarHilo = useCallback(
    (hilo: MessagesThread, isInitial: boolean) => {
      const list = hilo.items

      // Si entraron mensajes nuevos del otro participante (y no es la primera carga), avisar.
      if (!isInitial && !isFirstLoadRef.current && list.length > 0 && lastMsgIdRef.current) {
        const lastIdx = list.findIndex((m) => m.id === lastMsgIdRef.current)
        const newMsgs = lastIdx === -1 ? list : list.slice(lastIdx + 1)
        const hasIncoming = newMsgs.some((m) => {
          if (isDoctor) return m.sender_role === 'patient' || m.direction === 'patient_to_doctor'
          if (isPatient) return m.sender_role === 'doctor' || m.direction === 'doctor_to_patient'
          return false
        })

        if (hasIncoming) {
          const latest = newMsgs[newMsgs.length - 1]
          // El sonido es opt-in en `notify` (no suena salvo que se pida): la mensajería lo pide.
          notify(
            isDoctor ? 'Nuevo mensaje del paciente' : 'Nuevo mensaje del médico',
            latest?.body ? latest.body.slice(0, 80) : 'Ha llegado un nuevo mensaje en la consulta',
            { sound: true, soundKind: 'message' }
          )
        }
      }

      if (list.length > 0) {
        lastMsgIdRef.current = list[list.length - 1].id
      }
      isFirstLoadRef.current = false

      setThread({
        id: consultationId,
        list,
        error: null,
        clinicalAccess: hilo.clinical_access
      })
      if (isInitial) setTimeout(scrollToBottom, 100)

      // Marcar leídos (CA1.7). El `unread_count` del cuerpo evita el POST cuando no hay nada que
      // marcar: antes salía uno cada 8 segundos aunque el hilo estuviera al día.
      if (puedeEscribirPorRol && hilo.clinical_access !== 'none' && hilo.unread_count > 0) {
        markRead(consultationId, authOptions).catch(() => {})
      }
    },
    [consultationId, authOptions, puedeEscribirPorRol, isDoctor, isPatient]
  )

  const aplicarErrorHilo = useCallback(
    (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'No se pudieron cargar los mensajes'
      setThread((prev) =>
        prev && prev.id === consultationId
          ? { ...prev, error: msg }
          : {
              id: consultationId,
              list: [],
              error: msg,
              // Sin respuesta no se sabe qué acceso hay: `null`, no «sin grant».
              clinicalAccess: null
            }
      )
    },
    [consultationId]
  )

  const refrescarHilo = useCallback(
    (isInitial = false) => {
      fetchHilo()
        .then((list) => aplicarHilo(list, isInitial))
        .catch(aplicarErrorHilo)
    },
    [fetchHilo, aplicarHilo, aplicarErrorHilo]
  )

  useEffect(() => {
    refrescarHilo(true)
    const interval = setInterval(() => refrescarHilo(false), 8000)
    return () => clearInterval(interval)
  }, [refrescarHilo])

  // Manejo de selección/drop de archivos con validación estricta
  const handleSelectFile = (file: File) => {
    setComposerError(null)
    const validation = validateAttachmentFile(file)
    if (!validation.valid) {
      setComposerError(validation.error || 'Archivo no permitido')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setSelectedFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleSelectFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canSend || ventanaCerrada) return
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!canSend || ventanaCerrada) return

    const file = e.dataTransfer.files?.[0]
    if (file) handleSelectFile(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!canSend || ventanaCerrada) return
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile()
        if (file) {
          e.preventDefault()
          handleSelectFile(file)
          break
        }
      }
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setComposerError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Enviar mensaje (subida desacoplada en 2 pasos si hay archivo)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!canSend || sending || ventanaCerrada) return

    const trimmedText = text.trim()
    if (!trimmedText && !selectedFile) return

    setSending(true)
    setComposerError(null)

    try {
      const attachmentIds: string[] = []

      // Paso 1: Subir adjunto si existe
      if (selectedFile) {
        setUploadingAttachment(true)
        const uploadRes = await uploadAttachment(consultationId, selectedFile, authOptions)
        attachmentIds.push(uploadRes.id)
        setUploadingAttachment(false)
      }

      // Paso 2: Enviar el mensaje con los attachment_ids vinculados
      const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newMsg = await sendMessage(
        consultationId,
        {
          body: trimmedText || null,
          attachment_ids: attachmentIds,
          client_msg_id: clientMsgId
        },
        authOptions
      )

      setText('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setThread((prev) =>
        prev && prev.id === consultationId ? { ...prev, list: [...prev.list, newMsg] } : prev
      )
      setTimeout(scrollToBottom, 50)
      if (onMessageSent) onMessageSent(newMsg)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        // CA1.8: la ventana de mensajería de esta consulta está cerrada. Se muestra el motivo de
        // la API, se cierra el compositor y se refresca el hilo; nunca se reintenta a ciegas.
        setVentanaCerrada(err.message || 'Esta consulta ya no admite mensajes nuevos.')
        setComposerError(null)
        refrescarHilo()
      } else if (err instanceof ApiError) {
        setComposerError(err.message)
      } else {
        setComposerError('No se pudo enviar el mensaje. Intente de nuevo.')
      }
    } finally {
      setSending(false)
      setUploadingAttachment(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const composerBloqueado = Boolean(ventanaCerrada)
  const textareaId = `hilo-mensaje-texto-${consultationId}`
  const etiquetaCompositor = isDoctor
    ? 'Escribe una respuesta para el paciente'
    : 'Escribe tu mensaje para el médico'

  return (
    <div
      className={`hilo-mensajes-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        // Altura adaptada al viewport: 520 px en escritorio, nunca más del 60 % de la pantalla
        // (en un móvil bajo, una caja fija de 520 px obligaba a hacer doble scroll).
        height: 'clamp(300px, 60vh, 520px)',
        maxWidth: '100%',
        backgroundColor: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}
      data-testid="hilo-mensajes"
    >
      {/* Cabecera del hilo. `flexWrap` para que a 360 px el indicador de presencia caiga a la
          línea siguiente en vez de desbordar a lo ancho. */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px 12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
            Mensajes del caso
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>({messages.length})</span>
        </div>

        {/* REGLA DE ORO DE ASIMETRÍA: Solo se renderiza si el usuario actual es médico */}
        {isDoctor && (
          <IndicadorPresenciaPaciente online={patientOnline} lastSeenAt={patientLastSeenAt} />
        )}
      </div>

      {/* Aviso de auditoría: se pinta cuando la API dice que esta respuesta salió SIN grant
          clínico (`clinical_access: "none"`), que es exactamente cuando los cuerpos vienen en
          null. Antes se adivinaba por el rol del usuario. */}
      {sinGrantClinico && (
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            color: 'var(--muted)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}
          data-testid="aviso-admin-auditoria"
        >
          <span aria-hidden="true">🔒</span>
          <span>
            <strong>Vista de auditoría administrativa:</strong> Los mensajes clínicos están
            protegidos por cifrado confidencial (fail-closed). Para responder en el hilo, debes
            ingresar como el médico tratante asignado.
          </span>
        </div>
      )}

      {/* Lista de mensajes con scroll. `role="log"` + `aria-live="polite"` para que un lector de
          pantalla anuncie los mensajes que entran; `aria-relevant="additions"` y
          `aria-atomic="false"` para que anuncie SOLO el mensaje nuevo y no relea el hilo. */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-atomic="false"
        aria-label="Mensajes de la conversación"
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'var(--bg)'
        }}
        data-testid="lista-mensajes"
      >
        {loading && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--muted)',
              margin: 'auto',
              fontSize: '13px'
            }}
          >
            Cargando mensajes...
          </div>
        )}

        {error && (
          <div className="notice notice-danger" style={{ fontSize: '13px' }} role="alert">
            {error}
          </div>
        )}

        {!loading && messages.length === 0 && !error && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--muted)',
              margin: 'auto',
              fontSize: '13px'
            }}
          >
            No hay mensajes en esta conversación todavía.
          </div>
        )}

        {messages.map((msg) => {
          const isFromDoctor = msg.direction === 'doctor_to_patient'
          const isFromPatient = msg.direction === 'patient_to_doctor'
          const isSystem = msg.direction === 'system' || msg.kind === 'system_notice'

          // Determina si el mensaje fue enviado por el usuario actual
          const isMyMessage = (isDoctor && isFromDoctor) || (isPatient && isFromPatient)

          if (isSystem) {
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: 'center',
                  maxWidth: '90%',
                  backgroundColor: 'var(--white)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  margin: '4px 0',
                  textAlign: 'center'
                }}
              >
                {msg.body || 'Aviso del sistema'}
              </div>
            )
          }

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignSelf: isMyMessage ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                minWidth: 0
              }}
              data-testid="mensaje-item"
              data-direction={msg.direction}
            >
              {/* Etiqueta de remitente si es recibido */}
              {!isMyMessage && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--muted)',
                    marginBottom: '2px',
                    marginLeft: '4px'
                  }}
                >
                  {isFromDoctor ? 'Médico tratante' : 'Paciente'}
                </span>
              )}

              {/* Burbuja del mensaje. Propios: azul de marca con texto blanco (4,85:1, AA).
                  Recibidos: blanco con el gris de texto de la marca (16,4:1). */}
              <div
                style={{
                  backgroundColor: isMyMessage ? 'var(--brand)' : 'var(--white)',
                  color: isMyMessage ? 'var(--white)' : 'var(--text)',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  borderTopRightRadius: isMyMessage ? '2px' : '14px',
                  borderTopLeftRadius: !isMyMessage ? '2px' : '14px',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                  border: isMyMessage ? 'none' : '1px solid var(--border)',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  fontSize: '14px',
                  lineHeight: '1.45'
                }}
              >
                {/* Texto del cuerpo. El candado (CA1.9) sale solo cuando el cuerpo es null
                    PORQUE no hay grant, que es lo que declara `clinical_access`: un mensaje que
                    solo trae un adjunto también llega con `body: null` y antes mostraba
                    «Contenido no disponible» al propio médico que lo había enviado. */}
                {msg.body ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                ) : (
                  (msg.clinical_access ?? clinicalAccess) === 'none' && (
                    <div style={{ fontStyle: 'italic', fontSize: '13px' }}>
                      🔒 Contenido no disponible (confidencial)
                    </div>
                  )
                )}

                {/* Adjuntos del mensaje */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ marginTop: msg.body ? '6px' : '0' }}>
                    {msg.attachments.map((att) => (
                      <AdjuntoMensaje
                        key={att.id}
                        attachment={att}
                        consultationId={consultationId}
                        auth={authOptions}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Metadatos: fecha relativa (CA1.1), con la absoluta en el `title`, y estado */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                  gap: '4px',
                  marginTop: '2px',
                  fontSize: '11px',
                  color: 'var(--muted)',
                  padding: '0 4px'
                }}
              >
                <time dateTime={msg.sent_at} title={fmtDateTime(msg.sent_at)}>
                  {fechaRelativa(msg.sent_at)}
                </time>
                {isMyMessage && (
                  <EstadoEntrega
                    deliveryStatus={msg.delivery_status}
                    channel={msg.channel}
                    readAt={msg.read_at}
                    deliveredAt={msg.delivered_at}
                  />
                )}
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Aviso si la consulta está cerrada (ventana de gracia de 72h) */}
      {isCaseClosed && !ventanaCerrada && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--orange-light)',
            borderTop: '1px solid var(--border)',
            color: 'var(--orange)',
            fontSize: '13px',
            textAlign: 'center'
          }}
          data-testid="aviso-consulta-cerrada"
        >
          ⏱️ Este caso está finalizado. La mensajería admite seguimiento médico-paciente durante 72
          horas.
        </div>
      )}

      {/* Compositor de mensajes y adjuntos */}
      {canSend && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            backgroundColor: isDragging ? 'var(--brand-light)' : 'var(--white)',
            outline: isDragging ? '2px dashed var(--brand)' : undefined,
            outlineOffset: '-4px'
          }}
          data-testid="compositor-mensajes"
        >
          {/* CA1.8: ventana de mensajería cerrada (409). El compositor queda inutilizable y se
              explica por qué; no hay botón de reintento porque reintentar no cambia nada. */}
          {ventanaCerrada && (
            <div
              className="notice notice-warning"
              style={{ marginBottom: '8px', fontSize: '12px' }}
              role="alert"
              data-testid="aviso-ventana-cerrada"
            >
              <strong>{ventanaCerrada}</strong> Por eso el campo de texto y el botón de adjuntos
              están deshabilitados: volver a intentarlo no cambiaría nada.
            </div>
          )}

          {/* Error del compositor / archivos no permitidos */}
          {composerError && (
            <div
              className="notice notice-danger"
              style={{ marginBottom: '8px', fontSize: '12px' }}
              role="alert"
              data-testid="error-compositor"
            >
              ⚠️ {composerError}
            </div>
          )}

          {/* Chip de previsualización del archivo adjunto seleccionado */}
          {selectedFile && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                marginBottom: '8px',
                maxWidth: '100%',
                fontSize: '12px',
                color: 'var(--text)'
              }}
              data-testid="chip-adjunto-preview"
            >
              <span aria-hidden="true">📎</span>
              <strong
                style={{
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {selectedFile.name}
              </strong>
              <span style={{ color: 'var(--muted)' }}>
                ({(selectedFile.size / 1024).toFixed(0)} KB)
              </span>
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={sending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '0 4px'
                }}
                title="Quitar archivo"
                aria-label={`Quitar el archivo ${selectedFile.name}`}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            {/* Input oculto para subir archivos */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              data-testid="file-input-adjunto"
            />

            {/* Botón de adjuntar archivo */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadingAttachment || composerBloqueado}
              style={{ padding: '9px 11px', fontSize: '15px', flex: '0 0 auto' }}
              title="Adjuntar PDF o imagen (JPG, PNG, WEBP). GIF no permitido."
              aria-label="Adjuntar archivo PDF o imagen"
              data-testid="btn-adjuntar"
            >
              <span aria-hidden="true">📎</span>
            </button>

            {/* Área de texto. Etiquetada con `aria-label`: el `placeholder` solo no es una
                etiqueta (desaparece al escribir y varios lectores de pantalla no lo anuncian), y
                aquí no cabe una etiqueta visible sin romper la fila del compositor. */}
            <textarea
              id={textareaId}
              aria-label={etiquetaCompositor}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={composerBloqueado ? 'Mensajería cerrada' : `${etiquetaCompositor}...`}
              maxLength={2000}
              rows={2}
              disabled={sending || composerBloqueado}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 12px',
                fontSize: '14px',
                resize: 'none'
              }}
              data-testid="input-mensaje-texto"
            />

            {/* Botón Enviar */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSendMessage()}
              disabled={sending || composerBloqueado || (!text.trim() && !selectedFile)}
              style={{ padding: '10px 16px', fontSize: '14px', flex: '0 0 auto' }}
              data-testid="btn-enviar-mensaje"
            >
              {sending ? (uploadingAttachment ? 'Subiendo...' : 'Enviando...') : 'Enviar'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '2px 10px',
              fontSize: '11px',
              color: 'var(--muted)',
              marginTop: '4px'
            }}
          >
            <span>PDF o imágenes (JPG, PNG, WEBP) hasta 10 MB. GIF no admitido.</span>
            <span>{text.length}/2000 · Ctrl+Enter</span>
          </div>
        </div>
      )}
    </div>
  )
}
