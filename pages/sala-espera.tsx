import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SalaEspera() {
  const router = useRouter()
  const nombre = typeof router.query.nombre === 'string' ? router.query.nombre : 'paciente'
  const room = typeof router.query.room === 'string' ? router.query.room : ''
  const code = typeof router.query.code === 'string' ? router.query.code : ''
  const cid = typeof router.query.cid === 'string' ? router.query.cid : ''
  const [showWarning, setShowWarning] = useState(false)

  // Open the Jitsi room. Triggered from the "Entendido" button inside the warning modal, so the
  // window.open() call still runs inside a user gesture and isn't blocked as a pop-up.
  const openRoom = () => {
    setShowWarning(false)
    if (room) window.open(room, '_blank', 'noopener,noreferrer')
  }

  // Waiting-room heartbeat: while this page is open, tell the backend the patient is present every
  // ~20s so the doctor panel can distinguish people actually waiting from those who submitted and left.
  useEffect(() => {
    if (!cid) return

    const ping = async () => {
      const { error } = await supabase.rpc('mark_patient_waiting', {
        p_consultation_id: cid
      })

      if (error) {
        console.error('Error actualizando presencia del paciente:', error)
      }
    }

    ping()

    const timer = window.setInterval(ping, 15000)

    const onVisible = () => {
      ping()
    }

    window.addEventListener('focus', ping)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', ping)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cid])

  return (
    <>
      <Head>
        <title>Sala de espera — Médicos por Venezuela</title>
      </Head>
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
            <button className="btn btn-primary btn-full" onClick={openRoom}>
              Entendido, entrar a la videoconsulta
            </button>
          </div>
        </div>
      )}
    </>
  )
}
