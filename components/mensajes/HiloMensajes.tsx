import React, { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  AuthOptions,
  listMessages,
  markRead,
  Message,
  sendMessage,
  uploadAttachment,
  validateAttachmentFile
} from '../../lib/messages'
import { fmtDateTime } from '../../lib/admin'
import { tiempoTranscurrido } from '../../lib/utils'
import AdjuntoMensaje from './AdjuntoMensaje'
import EstadoEntrega from './EstadoEntrega'
import IndicadorPresenciaPaciente from './IndicadorPresenciaPaciente'
import { playNotificationSound } from '../../lib/sound'
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
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [sending, setSending] = useState<boolean>(false)
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)

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
  const canSend = !readOnly && currentUserRole !== 'admin' && currentUserRole !== 'super_admin'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Cargar mensajes y marcar como leídos
  const loadMessages = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      const list = await listMessages(consultationId, { limit: 100 }, auth)

      // Si no es la carga inicial y entraron nuevos mensajes del otro participante, emitir aviso sonoro
      if (!isInitial && !isFirstLoadRef.current && list.length > 0 && lastMsgIdRef.current) {
        const lastIdx = list.findIndex((m) => m.id === lastMsgIdRef.current)
        const newMsgs = lastIdx === -1 ? list : list.slice(lastIdx + 1)
        const hasIncoming = newMsgs.some((m) => {
          if (isDoctor) return m.sender_role === 'patient' || m.direction === 'patient_to_doctor'
          if (isPatient) return m.sender_role === 'doctor' || m.direction === 'doctor_to_patient'
          return false
        })

        if (hasIncoming) {
          playNotificationSound('message')
          const latest = newMsgs[newMsgs.length - 1]
          notify(
            isDoctor ? 'Nuevo mensaje del paciente' : 'Nuevo mensaje del médico',
            latest?.body ? latest.body.slice(0, 80) : 'Ha llegado un nuevo mensaje en la consulta'
          )
        }
      }

      if (list.length > 0) {
        lastMsgIdRef.current = list[list.length - 1].id
      }
      isFirstLoadRef.current = false

      setMessages(list)
      setError(null)
      if (isInitial) setTimeout(scrollToBottom, 100)

      // Marcar leídos si no es de solo lectura y no es admin
      if (canSend) {
        markRead(consultationId, auth).catch(() => {})
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudieron cargar los mensajes')
      }
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages(true)
    const interval = setInterval(() => loadMessages(false), 8000)
    return () => clearInterval(interval)
  }, [consultationId, auth?.token, auth?.consultationToken])

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
    if (!canSend) return
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
    if (!canSend) return

    const file = e.dataTransfer.files?.[0]
    if (file) handleSelectFile(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!canSend) return
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
    if (!canSend || sending) return

    const trimmedText = text.trim()
    if (!trimmedText && !selectedFile) return

    setSending(true)
    setComposerError(null)

    try {
      const attachmentIds: string[] = []

      // Paso 1: Subir adjunto si existe
      if (selectedFile) {
        setUploadingAttachment(true)
        const uploadRes = await uploadAttachment(consultationId, selectedFile, auth)
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
        auth
      )

      setText('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMessages((prev) => [...prev, newMsg])
      setTimeout(scrollToBottom, 50)
      if (onMessageSent) onMessageSent(newMsg)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
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

  return (
    <div
      className={`hilo-mensajes-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '520px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden'
      }}
      data-testid="hilo-mensajes"
    >
      {/* Cabecera del hilo */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
            Mensajes del caso
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>({messages.length})</span>
          <button
            type="button"
            onClick={() => playNotificationSound('message')}
            title="Probar sonido de notificación"
            aria-label="Probar sonido de notificación"
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '11px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            🔔 Probar sonido
          </button>
        </div>

        {/* REGLA DE ORO DE ASIMETRÍA: Solo se renderiza si el usuario actual es médico */}
        {isDoctor && (
          <IndicadorPresenciaPaciente online={patientOnline} lastSeenAt={patientLastSeenAt} />
        )}
      </div>

      {(currentUserRole === 'admin' || currentUserRole === 'super_admin') && (
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            color: '#475569',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          data-testid="aviso-admin-auditoria"
        >
          <span>🔒</span>
          <span>
            <strong>Vista de auditoría administrativa:</strong> Los mensajes clínicos están
            protegidos por cifrado confidencial (fail-closed). Para responder en el hilo, debes
            ingresar como el médico tratante asignado.
          </span>
        </div>
      )}

      {/* Lista de mensajes con scroll */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: '#f8fafc'
        }}
        data-testid="lista-mensajes"
      >
        {loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', margin: 'auto', fontSize: '13px' }}>
            Cargando mensajes...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '13px'
            }}
          >
            {error}
          </div>
        )}

        {!loading && messages.length === 0 && !error && (
          <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto', fontSize: '13px' }}>
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
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                  fontSize: '12px',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  margin: '4px 0'
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
                maxWidth: '78%'
              }}
              data-testid="mensaje-item"
              data-direction={msg.direction}
            >
              {/* Etiqueta de remitente si es recibido */}
              {!isMyMessage && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginBottom: '2px',
                    marginLeft: '4px'
                  }}
                >
                  {isFromDoctor ? 'Médico tratante' : 'Paciente'}
                </span>
              )}

              {/* Burbuja del mensaje */}
              <div
                style={{
                  backgroundColor: isMyMessage ? '#0d9488' : '#ffffff',
                  color: isMyMessage ? '#ffffff' : '#1e293b',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  borderTopRightRadius: isMyMessage ? '2px' : '14px',
                  borderTopLeftRadius: !isMyMessage ? '2px' : '14px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  border: isMyMessage ? 'none' : '1px solid #e2e8f0',
                  wordBreak: 'break-word',
                  fontSize: '14px',
                  lineHeight: '1.45'
                }}
              >
                {/* Texto del cuerpo (o aviso fail-closed si es null) */}
                {msg.body !== null ? (
                  msg.body && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                ) : (
                  <div style={{ fontStyle: 'italic', opacity: 0.85, fontSize: '13px' }}>
                    🔒 Contenido no disponible (confidencial)
                  </div>
                )}

                {/* Adjuntos del mensaje */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ marginTop: msg.body ? '6px' : '0' }}>
                    {msg.attachments.map((att) => (
                      <AdjuntoMensaje
                        key={att.id}
                        attachment={att}
                        consultationId={consultationId}
                        auth={auth}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Metadatos: Hora y estado de entrega */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                  gap: '4px',
                  marginTop: '2px',
                  fontSize: '11px',
                  color: '#94a3b8',
                  padding: '0 4px'
                }}
              >
                <span>{fmtDateTime(msg.sent_at)}</span>
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
      {isCaseClosed && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#fef3c7',
            borderTop: '1px solid #fde68a',
            color: '#92400e',
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
            borderTop: '1px solid #e2e8f0',
            backgroundColor: isDragging ? '#f0fdf4' : '#ffffff',
            border: isDragging ? '2px dashed #10b981' : undefined
          }}
          data-testid="compositor-mensajes"
        >
          {/* Error del compositor / archivos no permitidos */}
          {composerError && (
            <div
              style={{
                marginBottom: '8px',
                padding: '6px 10px',
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#b91c1c',
                fontSize: '12px'
              }}
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
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                marginBottom: '8px',
                fontSize: '12px',
                color: '#334155'
              }}
              data-testid="chip-adjunto-preview"
            >
              <span>📎</span>
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
              <span style={{ color: '#64748b' }}>({(selectedFile.size / 1024).toFixed(0)} KB)</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={sending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '0 4px'
                }}
                title="Quitar archivo"
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
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadingAttachment}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 10px',
                cursor: 'pointer',
                color: '#475569',
                fontSize: '15px'
              }}
              title="Adjuntar PDF o imagen (JPG, PNG, WEBP). GIF no permitido."
              aria-label="Adjuntar archivo"
              data-testid="btn-adjuntar"
            >
              📎
            </button>

            {/* Área de texto */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isDoctor
                  ? 'Escribe una respuesta para el paciente...'
                  : 'Escribe tu mensaje para el médico...'
              }
              maxLength={2000}
              rows={2}
              disabled={sending}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                resize: 'none',
                fontFamily: 'inherit'
              }}
              data-testid="input-mensaje-texto"
            />

            {/* Botón Enviar */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={sending || (!text.trim() && !selectedFile)}
              style={{
                backgroundColor: !text.trim() && !selectedFile ? '#94a3b8' : '#0d9488',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: (!text.trim() && !selectedFile) || sending ? 'not-allowed' : 'pointer'
              }}
              data-testid="btn-enviar-mensaje"
            >
              {sending ? (uploadingAttachment ? 'Subiendo...' : 'Enviando...') : 'Enviar'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#94a3b8',
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
