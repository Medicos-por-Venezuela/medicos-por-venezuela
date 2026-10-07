import React, { useEffect, useRef } from 'react'

interface ModalVisorImagenProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string | null
  fileName?: string | null
}

export default function ModalVisorImagen({
  isOpen,
  onClose,
  imageUrl,
  fileName
}: ModalVisorImagenProps) {
  const cerrarRef = useRef<HTMLButtonElement>(null)
  // Quien abrió el visor: al cerrar, el foco vuelve ahí (la miniatura del adjunto) y no al
  // principio del documento, que deja a quien navega con teclado perdido a mitad del hilo.
  const focoPrevioRef = useRef<HTMLElement | null>(null)

  // `onClose` en una ref, y el effect de abajo depende SOLO de `isOpen`.
  //
  // Este effect mueve el foco: al entrar lo lleva al botón de cerrar y al salir lo devuelve. Por
  // eso no puede depender de una identidad inestable. Los llamantes pasan la función en línea
  // (`onClose={() => setModalOpen(false)}`), que cambia de identidad en cada render del padre; si
  // `onClose` estuviera entre las dependencias, cada render del hilo —el sondeo de 8 s y cada
  // tecla del compositor— limpiaría y volvería a ejecutar el effect, y con el visor abierto el
  // foco saltaría al botón de cerrar sin que el usuario haya hecho nada. Montar y desmontar
  // depende de que el visor esté abierto, de nada más.
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    focoPrevioRef.current = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      const previo = focoPrevioRef.current
      focoPrevioRef.current = null
      // `isConnected`: si la burbuja que lo abrió se fue en un refetch, no hay dónde volver.
      if (previo && previo.isConnected) previo.focus()
    }
  }, [isOpen])

  if (!isOpen || !imageUrl) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imagen clínica"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            marginBottom: '8px',
            color: 'var(--white)'
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '80%'
            }}
          >
            {fileName || 'Imagen adjunta'}
          </span>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor de imagen"
            style={{
              flex: '0 0 auto',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              color: 'var(--white)',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}
          >
            ✕
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={fileName || 'Vista previa clínica'}
          style={{
            maxWidth: '100%',
            maxHeight: '80vh',
            objectFit: 'contain',
            borderRadius: '6px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.5)'
          }}
        />
      </div>
    </div>
  )
}
