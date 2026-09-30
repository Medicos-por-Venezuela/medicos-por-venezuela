import { useId } from 'react'
import { useEscapeToClose } from '../lib/hooks'

export default function ConfirmarCorreoModal({
  open,
  email,
  onClose,
  onConfirm,
  onCorregir
}: {
  open: boolean
  email: string
  onClose: () => void
  onConfirm: () => void
  onCorregir?: () => void
}) {
  const tituloId = useId()
  useEscapeToClose(open, onClose)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: '100%' }}
      >
        <h2 id={tituloId} style={{ marginTop: 0 }}>
          ¿Está seguro de registrarse con el correo?
        </h2>
        <p style={{ fontSize: '18px', fontWeight: 800, margin: '12px 0', wordBreak: 'break-all' }}>
          {email}
        </p>
        <p style={{ color: '#64748b', marginBottom: 20 }}>
          Verifique su información antes de continuar.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-muted btn-full"
            onClick={() => {
              onClose()
              onCorregir?.()
            }}
            style={{ flex: 1 }}
          >
            Corregir
          </button>
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={onConfirm}
            autoFocus
            style={{ flex: 1 }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
