import Seo from '../components/Seo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { browserRoomUrl } from '../lib/jitsi'
import { markEnteredCall } from '../lib/patients'
import { trackPatientInRoom } from '../lib/patientPresence'

export default function SalaEspera() {
  const router = useRouter()
  const nombre = typeof router.query.nombre === 'string' ? router.query.nombre : 'paciente'
  const room = typeof router.query.room === 'string' ? router.query.room : ''
  const code = typeof router.query.code === 'string' ? router.query.code : ''
  const cid = typeof router.query.cid === 'string' ? router.query.cid : ''
  const [showWarning, setShowWarning] = useState(false)
  // El token de sala se guarda en un ref y se BORRA de la URL: una credencial en la barra de
  // direcciones acaba en el historial, en el `Referer` y en cualquier captura que el paciente
  // comparta. Caduca a las 24 h, pero mientras vive es la llave de su videoconsulta.
  // Ref y no estado a propósito: solo se lee dentro de openRoom (un handler), así que guardarlo
  // en estado provocaría un render de más sin que nada de la UI dependa de él.
  const roomToken = useRef('')

  useEffect(() => {
    if (!router.isReady) return
    const t = typeof router.query.t === 'string' ? router.query.t : ''
    if (!t) return
    roomToken.current = t
    const url = new URL(window.location.href)
    url.searchParams.delete('t')
    window.history.replaceState(null, '', url.toString())
  }, [router.isReady, router.query.t])

  // Open the Jitsi room. Triggered from the "Entendido" button inside the warning modal, so the
  // window.open() call still runs inside a user gesture and isn't blocked as a pop-up.
  const openRoom = () => {
    setShowWarning(false)
    // Record that the patient actually entered the call (admin metrics count a case as "esperando"
    // only from this point on). Fire-and-forget (por el backend, público) para no retrasar la sala.
    if (cid) {
      markEnteredCall(cid, roomToken.current).catch((e) =>
        console.error('Error marcando entrada a la videollamada:', e)
      )
    }
    if (room) window.open(browserRoomUrl(room), '_blank', 'noopener,noreferrer')
  }

  // Mientras esta página está abierta, el paciente se anuncia "en sala" por Realtime Presence
  // (reemplaza el heartbeat `mark_patient_waiting` + `patient_last_seen_at`): el médico lo ve en vivo
  // sin polling ni escritura a la BD. Al cerrar la pestaña, Presence lo da de baja solo.
  useEffect(() => {
    if (!cid) return
    return trackPatientInRoom(cid)
  }, [cid])

  return (
    <>
      <Seo
        titulo="Sala de espera — Médicos por Venezuela"
        descripcion={
          'Tu solicitud está registrada. Aquí tienes el enlace de la videoconsulta y el estado ' +
          'de la espera.'
        }
        ruta="/sala-espera"
        noindex
      />
      <main className="page">
        <div className="narrow">
          <div className="card">
            <span className="badge badge-green">Solicitud recibida</span>
            <h1>Gracias, {nombre}</h1>

            {room ? (
              <>
                <p>Tu sala de videoconsulta está lista.</p>
                <div className="notice notice-info" style={{ marginTop: 8 }}>
                  ℹ️ Funciona mejor desde el navegador, no hay necesidad de bajarse la app.
                </div>
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => setShowWarning(true)}
                  style={{ marginTop: 8 }}
                >
                  Entrar a la videoconsulta
                </button>
                <div className="notice notice-warning" style={{ marginTop: 12 }}>
                  Una vez dentro, <strong>espera a que tu médico asignado se conecte</strong>. Puede
                  tardar varios minutos. Mantén esta página abierta.
                </div>
                <div className="notice notice-info" style={{ marginTop: 12 }}>
                  📱 De igual manera, un profesional de la salud podría{' '}
                  <strong>contactarte por WhatsApp</strong> al número que registraste — mantente
                  pendiente de tus mensajes.
                </div>
                <p style={{ color: '#64748b', fontSize: 14, marginTop: 12 }}>
                  Guarda este enlace{code ? ` (código ${code})` : ''} para volver a entrar si se
                  corta la conexión.
                </p>
                <div className="notice notice-info" style={{ marginTop: 12 }}>
                  <strong>Para que funcione bien:</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    <li>
                      Al abrir el enlace, elige <strong>“Continuar en el navegador”</strong> (no
                      necesitas descargar la app).
                    </li>
                    <li>
                      Pulsa <strong>“Permitir”</strong> cuando te pida cámara y micrófono.
                    </li>
                    <li>
                      Busca un lugar con <strong>mejor señal móvil</strong> y lo más{' '}
                      <strong>silencioso</strong> posible.
                    </li>
                    <li>
                      Procura estar <strong>a solas</strong> para proteger tu privacidad (salvo
                      consulta de un niño/a, donde debe acompañarte un adulto responsable).
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <p>
                Tu solicitud quedó en espera. Un médico voluntario podrá contactarte por WhatsApp
                cuando tome el caso.
              </p>
            )}

            <div className="notice notice-warning" style={{ margin: '16px 0' }}>
              Si tu situación empeora o hay señales de alarma, busca atención presencial urgente. No
              esperes a que respondan por WhatsApp.
            </div>
            <Link className="btn btn-muted" href="/">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>

      {showWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="warning-title"
          onClick={() => setShowWarning(false)}
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
              onClick={() => setShowWarning(false)}
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
                No cierres la videollamada: espera ahí a que tu médico se conecte (puede tardar
                varios minutos).
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
            <button className="btn btn-primary btn-full" onClick={openRoom}>
              Entendido, entrar a la videoconsulta
            </button>
          </div>
        </div>
      )}
    </>
  )
}
