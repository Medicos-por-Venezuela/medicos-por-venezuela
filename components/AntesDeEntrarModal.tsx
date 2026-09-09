// Lo que hay que decirle al paciente ANTES de abrir la sala de Jitsi.
//
// Vive aquí, y no dentro de `/sala-espera` donde nació, porque ahora lo abren DOS páginas: la
// sala de espera a la que cae al registrarse, y `/mi-caso`, por donde vuelve el que cerró aquella
// pestaña. Es contenido clínico-operativo —"no cierres la videollamada", "espera a tu médico"— y
// con dos copias la siguiente corrección se aplicaría en una sola. Es además la regla del
// proyecto: nada de diálogos inline copiados (ver CLAUDE.md).
//
// El `onConfirm` tiene que abrir la sala DENTRO de este clic: `window.open` fuera de un gesto del
// usuario lo bloquea el navegador como pop-up. Por eso el modal no abre nada por su cuenta; solo
// avisa a quien lo montó.
import { useEscapeToClose } from '../lib/hooks'

export default function AntesDeEntrarModal({
  open,
  onCancel,
  onConfirm
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEscapeToClose(open, onCancel)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="warning-title"
      onClick={onCancel}
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
        style={{
          maxWidth: 440,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative'
        }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            border: 'none',
            background: 'transparent',
            fontSize: 22,
            lineHeight: 1,
            cursor: 'pointer',
            color: '#64748b'
          }}
        >
          ✕
        </button>
        <h2 id="warning-title" style={{ marginTop: 0, paddingRight: 24 }}>
          Antes de entrar a la videoconsulta
        </h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, lineHeight: 1.6 }}>
          <li style={{ color: '#dc2626', fontWeight: 700 }}>
            Escribe tu nombre completo cuando la videollamada te lo pida.
          </li>
          <li style={{ color: '#dc2626', fontWeight: 700 }}>
            No cierres la videollamada: espera ahí a que tu médico se conecte (puede tardar varios
            minutos).
          </li>
          <li>
            Al abrir el enlace, elige <strong>“Continuar en el navegador”</strong> (no necesitas
            descargar la app).
          </li>
          <li>
            Pulsa <strong>“Permitir”</strong> cuando te pida cámara y micrófono.
          </li>
          <li>Mantén también esta página abierta en otra pestaña.</li>
        </ul>
        <div style={{ margin: '0 0 16px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
            Si te aparece esta pantalla, toca{' '}
            <span style={{ color: '#dc2626' }}>«Unirse en el navegador»</span>:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- captura estática servida
              desde /public; el <img> es el que tenía la sala de espera, esto es una extracción */}
          <img
            src="/instruccion-jitsi.png"
            alt="Pantalla de Jitsi: toca «Unirse en el navegador» para continuar sin descargar la app"
            style={{
              width: '100%',
              maxWidth: 260,
              height: 'auto',
              borderRadius: 8,
              border: '1px solid #e5e7eb'
            }}
          />
        </div>
        {/* autoFocus: el foco entra al modal al abrirlo, como hacía el diálogo nativo que este
            patrón reemplazó en el resto del sitio (ver components/admin/ConfirmDialog.tsx). */}
        <button className="btn btn-primary btn-full" onClick={onConfirm} autoFocus>
          Entendido, entrar a la videoconsulta
        </button>
      </div>
    </div>
  )
}
