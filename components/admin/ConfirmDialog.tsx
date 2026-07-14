// Shared centered confirmation modal — extracted from the inline role="dialog" pattern that used
// to be copy-pasted (pages/admin/pacientes.tsx's delete-confirmation dialog, then again verbatim in
// components/DoctorPoolModal.tsx's own comment about it). Same backdrop/card/button markup and
// styles as that original, just parameterized so a third copy-paste isn't needed.
// Accesibilidad: Escape cancela (salvo busy) y el foco entra a "Cancelar" al abrir — el
// window.confirm nativo al que reemplaza hacía ambas cosas; sin esto quedaba por debajo.
import { ReactNode, useCallback, useId } from 'react'
import { useEscapeToClose } from '../../lib/hooks'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  busy = false,
  danger = false
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  busy?: boolean
  danger?: boolean
}) {
  const titleId = useId()
  const cancelUnlessBusy = useCallback(() => {
    if (!busy) onCancel()
  }, [busy, onCancel])
  useEscapeToClose(open, cancelUnlessBusy)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !busy && onCancel()}
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
        <h2 id={titleId} style={{ marginTop: 0 }}>
          {title}
        </h2>
        <div>{message}</div>
        <div className="grid grid-2" style={{ marginTop: 8 }}>
          <button
            className={`btn btn-full${danger ? '' : ' btn-primary'}`}
            style={danger ? { background: '#dc2626', color: '#fff' } : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
          {/* autoFocus en Cancelar: el foco entra al modal y la acción por defecto es la segura. */}
          <button className="btn btn-muted" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
