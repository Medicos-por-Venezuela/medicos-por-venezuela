// Modal para desbloquear la clave clínica con la clave de descifrado.
// Patrón de overlay role="dialog" + useEscapeToClose (ver ConsultationsMonitorModal.tsx / DoctorPoolModal.tsx).
import { useState } from 'react'
import { useMountEffect } from '../lib/hooks'
import { unlockClinicalKey } from '../lib/patientAddressCrypto'

type Props = {
  open: boolean
  onClose: () => void
  onUnlocked: () => void
}

export default function UnlockClinicalKeyModal({ open, onClose, onUnlocked }: Props) {
  if (!open) return null
  return <Dialog onClose={onClose} onUnlocked={onUnlocked} />
}

function Dialog({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: () => void }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  // Escape para cerrar mientras el modal está abierto.
  useMountEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  // Limpia input y error al desmontar (cuando open pasa a false).
  useMountEffect(() => {
    return () => {
      setClave('')
      setError('')
    }
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!clave.trim()) return
    setProcessing(true)
    try {
      await unlockClinicalKey(clave)
      setClave('')
      onUnlocked()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desbloquear.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-title"
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
        style={{ maxWidth: 460, width: '100%' }}
      >
        <h2 id="unlock-title" style={{ marginTop: 0 }}>
          Ver dirección del paciente
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
          La dirección está guardada cifrada: solo se puede leer con la clave de descifrado. La
          clave la reparte la organización (no es tu contraseña de la plataforma) y no se envía al
          servidor.
        </p>
        {error && (
          <div className="notice notice-danger" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <label className="label" htmlFor="clinical-passphrase">
            Clave de descifrado
          </label>
          <input
            id="clinical-passphrase"
            type="password"
            autoComplete="off"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Clave de descifrado"
            style={{ width: '100%', marginBottom: 16 }}
            disabled={processing}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              disabled={processing || !clave.trim()}
            >
              {processing ? 'Verificando...' : 'Desbloquear'}
            </button>
            <button
              type="button"
              className="btn btn-muted"
              onClick={() => {
                setClave('')
                setError('')
                onClose()
              }}
              disabled={processing}
            >
              Cancelar
            </button>
          </div>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          La clave se queda en este navegador; no se guarda en el servidor.
        </p>
      </div>
    </div>
  )
}
