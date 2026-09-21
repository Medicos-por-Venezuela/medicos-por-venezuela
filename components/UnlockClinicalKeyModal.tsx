// Modal para desbloquear la clave clínica con passphrase.
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
  const [passphrase, setPassphrase] = useState('')
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
      setPassphrase('')
      setError('')
    }
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!passphrase.trim()) return
    setProcessing(true)
    try {
      await unlockClinicalKey(passphrase.trim())
      setPassphrase('')
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
        style={{ maxWidth: 420, width: '100%' }}
      >
        <h2 id="unlock-title" style={{ marginTop: 0 }}>
          Desbloquear dirección del paciente
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
          La dirección está cifrada de extremo a extremo. Introduce la passphrase clínica para
          descifrarla.
        </p>
        {error && (
          <div className="notice notice-danger" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <label className="label" htmlFor="clinical-passphrase">
            Passphrase clínica
          </label>
          <input
            id="clinical-passphrase"
            type="password"
            autoComplete="off"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase clínica"
            style={{ width: '100%', marginBottom: 16 }}
            disabled={processing}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              disabled={processing || !passphrase.trim()}
            >
              {processing ? 'Desbloqueando...' : 'Desbloquear'}
            </button>
            <button
              type="button"
              className="btn btn-muted"
              onClick={() => {
                setPassphrase('')
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
          La clave nunca sale de este navegador.
        </p>
      </div>
    </div>
  )
}
