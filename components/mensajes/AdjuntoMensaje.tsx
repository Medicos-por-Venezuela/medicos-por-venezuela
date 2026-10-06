import React, { useEffect, useState } from 'react'
import { AuthOptions, fetchAttachmentBlob, MessageAttachment } from '../../lib/messages'
import ModalVisorImagen from './ModalVisorImagen'

interface AdjuntoMensajeProps {
  attachment: MessageAttachment
  consultationId: string
  auth?: AuthOptions
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function AdjuntoMensaje({ attachment, consultationId, auth }: AdjuntoMensajeProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState<boolean>(false)

  const isImage = attachment.mime_type.startsWith('image/')
  const isPdf = attachment.mime_type === 'application/pdf'
  const isConfidential = attachment.file_name === null

  // Carga el Blob de imagen de manera segura si hay grant clínico
  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    if (isImage && !isConfidential) {
      setLoading(true)
      fetchAttachmentBlob(consultationId, attachment.id, auth)
        .then(({ blob }) => {
          if (!active) return
          createdUrl = URL.createObjectURL(blob)
          setBlobUrl(createdUrl)
          setLoading(false)
        })
        .catch((err) => {
          if (!active) return
          setError('No se pudo cargar la vista previa')
          setLoading(false)
        })
    }

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [attachment.id, consultationId, isImage, isConfidential, auth?.token, auth?.consultationToken])

  const handleDownloadPdf = async () => {
    if (isConfidential || loading) return
    try {
      setLoading(true)
      const { blob, filename } = await fetchAttachmentBlob(consultationId, attachment.id, auth)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || attachment.file_name || 'documento.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setError('Error al descargar el archivo')
    } finally {
      setLoading(false)
    }
  }

  // Si no hay grant clínico (ej. usuario admin en modo fail-closed)
  if (isConfidential) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#f1f5f9',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#64748b'
        }}
        data-testid="adjunto-confidencial"
      >
        <span>🔒 Archivo clínico confidencial</span>
      </div>
    )
  }

  // Renderizado de Imagen
  if (isImage) {
    return (
      <div style={{ marginTop: '6px' }}>
        {loading && (
          <div
            style={{
              width: '160px',
              height: '120px',
              backgroundColor: '#e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#64748b'
            }}
          >
            Cargando imagen...
          </div>
        )}

        {error && <div style={{ color: '#ef4444', fontSize: '12px' }}>{error}</div>}

        {blobUrl && (
          <>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'block'
              }}
              title="Clic para ampliar imagen"
              aria-label={`Ver imagen: ${attachment.file_name || 'adjunto'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blobUrl}
                alt={attachment.file_name || 'Imagen clínica'}
                style={{
                  maxWidth: '220px',
                  maxHeight: '180px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              />
            </button>

            <ModalVisorImagen
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              imageUrl={blobUrl}
              fileName={attachment.file_name}
            />
          </>
        )}
      </div>
    )
  }

  // Renderizado de PDF / Documento
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        marginTop: '6px',
        maxWidth: '280px'
      }}
      data-testid="adjunto-pdf"
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#fee2e2',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          fontWeight: 700,
          fontSize: '11px'
        }}
      >
        PDF
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#1e293b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={attachment.file_name || 'Documento PDF'}
        >
          {attachment.file_name || 'Documento PDF'}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          {formatFileSize(attachment.file_size_bytes)}
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownloadPdf}
        disabled={loading}
        style={{
          backgroundColor: '#0d9488',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
        title="Descargar PDF"
        aria-label={`Descargar ${attachment.file_name || 'PDF'}`}
      >
        {loading ? '...' : 'Abrir'}
      </button>
    </div>
  )
}
