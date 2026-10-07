import React, { useCallback, useEffect, useState } from 'react'
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
  const [descargando, setDescargando] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState<boolean>(false)

  // Estable: el visor no debe recibir una función nueva en cada render (ver la nota de
  // `ModalVisorImagen`). El arreglo de fondo está allí, pero esto evita el churn en el origen.
  const cerrarVisor = useCallback(() => setModalOpen(false), [])

  const isImage = attachment.mime_type.startsWith('image/')
  const isConfidential = attachment.file_name === null

  // La vista previa está "cargando" mientras no haya ni blob ni error: es un valor DERIVADO, no
  // un `setLoading(true)` dentro del effect (el render en cascada que marcaba ESLint,
  // react-hooks/set-state-in-effect).
  const cargandoPreview = isImage && !isConfidential && !blobUrl && !error

  // Carga el Blob de imagen de manera segura si hay grant clínico
  useEffect(() => {
    if (!isImage || isConfidential) return

    let active = true
    let createdUrl: string | null = null

    fetchAttachmentBlob(consultationId, attachment.id, auth)
      .then(({ blob }) => {
        if (!active) return
        createdUrl = URL.createObjectURL(blob)
        setBlobUrl(createdUrl)
      })
      .catch(() => {
        if (!active) return
        setError('No se pudo cargar la vista previa')
      })

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [attachment.id, consultationId, isImage, isConfidential, auth])

  const handleDownloadPdf = async () => {
    if (isConfidential || descargando) return
    try {
      setDescargando(true)
      // Un reintento que sale bien no debe dejar en pantalla el aviso del intento anterior.
      setError(null)
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
      setDescargando(false)
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
          backgroundColor: 'var(--bg)',
          border: '1px dashed var(--border)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'var(--muted)'
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
        {cargandoPreview && (
          <div
            style={{
              width: '160px',
              maxWidth: '100%',
              height: '120px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--muted)'
            }}
          >
            Cargando imagen...
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: '12px' }}>{error}</div>}

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
                  maxWidth: 'min(220px, 100%)',
                  maxHeight: '180px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
                }}
              />
            </button>

            <ModalVisorImagen
              isOpen={modalOpen}
              onClose={cerrarVisor}
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
    <div style={{ marginTop: '6px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          maxWidth: 'min(280px, 100%)'
        }}
        data-testid="adjunto-pdf"
      >
        <div
          style={{
            flex: '0 0 auto',
            width: '32px',
            height: '32px',
            backgroundColor: 'var(--red-light)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--red)',
            fontWeight: 700,
            fontSize: '11px'
          }}
          aria-hidden="true"
        >
          PDF
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={attachment.file_name || 'Documento PDF'}
          >
            {attachment.file_name || 'Documento PDF'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {formatFileSize(attachment.file_size_bytes)}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDownloadPdf}
          disabled={descargando}
          style={{ flex: '0 0 auto', padding: '5px 10px', fontSize: '12px' }}
          title="Descargar PDF"
          aria-label={`Descargar ${attachment.file_name || 'PDF'}`}
        >
          {descargando ? '...' : 'Abrir'}
        </button>
      </div>

      {/* Una descarga que falla tiene que decirlo: `setError` se escribía y no se pintaba en
          ninguna parte de esta rama, así que un documento clínico que no bajaba dejaba al
          usuario sin saber si había pulsado bien. */}
      {error && (
        <div
          style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}
          role="alert"
          data-testid="adjunto-error"
        >
          {error}
        </div>
      )}
    </div>
  )
}
