import { useId, useEffect, useState, useRef } from 'react'
import { useEscapeToClose } from '../lib/hooks'
import {
  sendEmailVerification,
  verifyEmailCode,
  type VerificationPurpose
} from '../lib/emailVerification'
import { ApiError } from '../lib/apiClient'

export default function VerificacionCodigoModal({
  open,
  email,
  purpose,
  onClose,
  onVerified
}: {
  open: boolean
  email: string
  purpose: VerificationPurpose
  onClose: () => void
  onVerified: (token: string) => void
}) {
  const tituloId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  useEscapeToClose(open, onClose)

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Enviar código al montar y cada vez que se abre el modal
  useEffect(() => {
    if (!open) return
    setCode('')
    setError('')
    setInfo('')
    enviarCodigo()
  }, [open, email, purpose])

  // Cuenta atrás del reenvío
  useEffect(() => {
    if (resendSeconds <= 0) return
    const id = setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [resendSeconds])

  // Enfocar el input al abrir
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  async function enviarCodigo() {
    setLoading(true)
    setError('')
    try {
      const resp = await sendEmailVerification(email, purpose)
      setResendSeconds(resp.resend_seconds)
      if (resp.debug_code) {
        setInfo(`Código de prueba (solo local): ${resp.debug_code}`)
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429) {
          setError(e.message || 'Demasiados envíos. Espera un momento antes de reenviar.')
        } else if (e.status === 503) {
          setError('No se pudo enviar el correo. Intenta de nuevo más tarde.')
        } else {
          setError(e.message || 'Error al enviar el código.')
        }
      } else {
        setError('Error de conexión al enviar el código.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function manejarVerificar(codigo: string = code) {
    if (codigo.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const resp = await verifyEmailCode(email, purpose, codigo)
      onVerified(resp.verification_token)
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 422) {
          setError(e.message || 'Código incorrecto o expirado.')
        } else if (e.status === 429) {
          setError(e.message || 'Demasiados intentos. Espera un momento antes de volver a probar.')
        } else {
          setError(e.message || 'Error al verificar el código.')
        }
      } else {
        setError('Error de conexión al verificar el código.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function manejarReenviar() {
    if (resendSeconds > 0) return
    await enviarCodigo()
    setCode('')
  }

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
          Verifica tu correo
        </h2>
        <p style={{ marginBottom: 8, color: '#64748b' }}>Hemos enviado un código de 6 dígitos a</p>
        <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: 20, wordBreak: 'break-all' }}>
          {email}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={i === 0 ? inputRef : undefined}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={code[i] || ''}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '')
                if (v.length > 1) return
                const nuevo = code.slice(0, i) + v + code.slice(i + 1)
                setCode(nuevo)
                if (v && i < 5 && inputRef.current?.parentElement) {
                  const nextInput = inputRef.current.parentElement.querySelectorAll('input')[
                    i + 1
                  ] as HTMLInputElement
                  nextInput?.focus()
                }
                if (nuevo.length === 6) manejarVerificar(nuevo)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !code[i] && i > 0) {
                  const prevInput = inputRef.current?.parentElement?.querySelectorAll('input')[
                    i - 1
                  ] as HTMLInputElement
                  prevInput?.focus()
                }
              }}
              style={{
                width: 40,
                height: 48,
                textAlign: 'center',
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '0.1em',
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                outline: 'none'
              }}
              disabled={loading}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {error && (
          <div className="notice notice-danger" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {info && (
          <div className="notice notice-info" style={{ marginBottom: 12, fontSize: 13 }}>
            {info}
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={() => manejarVerificar()}
          disabled={loading || code.length !== 6}
          style={{ marginBottom: 12 }}
        >
          {loading ? 'Verificando...' : 'Verificar'}
        </button>

        <button
          type="button"
          className="btn btn-muted btn-full"
          onClick={manejarReenviar}
          disabled={resendSeconds > 0 || loading}
        >
          {resendSeconds > 0 ? `Reenviar código (${resendSeconds}s)` : 'Reenviar código'}
        </button>

        <p style={{ marginTop: 16, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
          Revisa tu carpeta de spam si no lo ves.
        </p>
        <p style={{ marginTop: 4, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
          Este paso es necesario para verificar tu correo.
        </p>
      </div>
    </div>
  )
}
