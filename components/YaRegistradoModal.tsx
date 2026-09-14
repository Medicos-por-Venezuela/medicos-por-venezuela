// Aviso de /registro-medico cuando el correo (o la cédula) ya está registrado: en vez de dejar que
// el alta cree una cuenta nueva que luego no podría guardar la ficha —así nacían las cuentas
// huérfanas—, se le manda a iniciar sesión o a recuperar la clave. Los dos caminos son ENLACES.
//
// Mismo marco y accesibilidad que components/admin/ConfirmDialog.tsx (Escape cierra, el foco entra
// al modal), pero no se reutiliza porque aquel es una confirmación con dos botones y esto son dos
// enlaces a otras páginas.
import Link from 'next/link'
import { useId } from 'react'
import { useEscapeToClose } from '../lib/hooks'

export type MotivoYaRegistrado = 'medico' | 'cuenta' | 'cedula' | 'clave'

const TEXTO: Record<MotivoYaRegistrado, { titulo: string; antes: string; cerrar: string }> = {
  medico: {
    titulo: 'Ya estás registrado',
    antes: 'Usted ya está registrado como Médico.',
    cerrar: 'Usar otro correo'
  },
  cuenta: {
    titulo: 'Este correo ya tiene una cuenta',
    antes: 'Este correo ya tiene una cuenta en Médicos por Venezuela.',
    cerrar: 'Usar otro correo'
  },
  cedula: {
    titulo: 'Esta cédula ya está registrada',
    antes:
      'Esta cédula ya está registrada como Médico. Entre con el correo con el que se registró.',
    cerrar: 'Revisar mis datos'
  },
  // Un registro que se cortó: el correo tiene cuenta, pero la contraseña escrita no es la suya.
  clave: {
    titulo: 'La contraseña no coincide',
    antes:
      'Ya empezó un registro con este correo, pero la contraseña no coincide. Recupere su clave y ' +
      'vuelva a este formulario para terminarlo.',
    cerrar: 'Volver al formulario'
  }
}

export default function YaRegistradoModal({
  motivo,
  onClose
}: {
  motivo: MotivoYaRegistrado | null
  onClose: () => void
}) {
  const tituloId = useId()
  useEscapeToClose(motivo !== null, onClose)

  if (!motivo) return null
  const { titulo, antes, cerrar } = TEXTO[motivo]

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
          {titulo}
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          {antes} Por favor{' '}
          {/* autoFocus: el foco entra al modal en el primer camino, como en ConfirmDialog. */}
          <Link href="/login" className="link-button" style={enlace} autoFocus>
            inicie sesión
          </Link>{' '}
          o{' '}
          <Link href="/auth/recuperar" className="link-button" style={enlace}>
            pida recordar su clave
          </Link>
          .
        </p>
        <button type="button" className="btn btn-muted btn-full" onClick={onClose}>
          {cerrar}
        </button>
      </div>
    </div>
  )
}

// Enlaces dentro del texto, pero con área táctil de verdad: el sitio es mobile-first. Inline (no
// inline-block) a propósito: el padding vertical agranda la zona de toque sin partir el párrafo.
const enlace = {
  fontWeight: 800,
  padding: '6px 2px'
} as const
