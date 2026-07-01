import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { browserRoomUrl } from '../lib/jitsi'

export default function SalaEspera() {
  const router = useRouter()
  const nombre = typeof router.query.nombre === 'string' ? router.query.nombre : 'paciente'
  const room = typeof router.query.room === 'string' ? router.query.room : ''
  const code = typeof router.query.code === 'string' ? router.query.code : ''
  const cid = typeof router.query.cid === 'string' ? router.query.cid : ''
  const [showWarning, setShowWarning] = useState(false)
  // Patient picked "Prefiero ser contactado/a por WhatsApp" — flag the case for the doctors' pool.
  const [whatsappChosen, setWhatsappChosen] = useState(false)
  const [choosingWhatsapp, setChoosingWhatsapp] = useState(false)

  // Open the Jitsi room. Triggered from the "Entendido" button inside the warning modal, so the
  // window.open() call still runs inside a user gesture and isn't blocked as a pop-up.
  const openRoom = () => {
    setShowWarning(false)
    // Record that the patient actually entered the call (admin metrics count a case as "esperando"
    // only from this point on). Fire-and-forget so it never delays opening the room.
    if (cid) {
      supabase.rpc('mark_patient_entered_call', { p_consultation_id: cid }).then(({ error }) => {
        if (error) console.error('Error marcando entrada a la videollamada:', error)
      })
    }
    if (room) window.open(browserRoomUrl(room), '_blank', 'noopener,noreferrer')
  }

  // Patient prefers to be contacted by WhatsApp instead of waiting in the video room. Flags the case
  // so it enters the doctors' contact pool immediately (no 20-min wait).
  const chooseWhatsapp = async () => {
    if (!cid) {
      setWhatsappChosen(true)
      return
    }
    setChoosingWhatsapp(true)
    const { error } = await supabase.rpc('mark_patient_wants_whatsapp', { p_consultation_id: cid })
    setChoosingWhatsapp(false)
    if (error) {
      console.error('Error marcando preferencia de WhatsApp:', error)
      return
    }
    setWhatsappChosen(true)
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
              whatsappChosen ? (
                <div
                  className="notice"
                  style={{
                    marginTop: 8,
                    background: 'var(--green-light)',
                    border: '1px solid #86efac',
                    color: '#166534'
                  }}
                >
                  <strong>Listo.</strong> Un médico voluntario te contactará por{' '}
                  <strong>WhatsApp</strong> lo antes posible. Mantén tu teléfono a la mano y con el
                  número que registraste.
                </div>
              ) : (
                <>
                  <p>¿Cómo prefieres que te ayudemos?</p>
                  <button
                    className="btn btn-full"
                    onClick={chooseWhatsapp}
                    disabled={choosingWhatsapp}
                    style={{
                      marginTop: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      background: '#25d366',
                      color: '#fff',
                      fontWeight: 700
                    }}
                  >
                    <svg
                      viewBox="0 0 32 32"
                      width="20"
                      height="20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M16.003 3C9.373 3 3.997 8.376 3.997 15.004c0 2.117.553 4.184 1.603 6.005L3 29l8.17-2.567a12.03 12.03 0 0 0 4.83 1.006h.004C22.63 27.44 28 22.064 28 15.436 28 8.808 22.63 3 16.003 3zm0 21.87h-.003a9.87 9.87 0 0 1-5.03-1.378l-.36-.214-4.85 1.524 1.55-4.727-.235-.375a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.437-9.885 9.9-9.885 2.645 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.897 6.99c0 5.45-4.437 9.885-9.9 9.885z" />
                      <path d="M21.43 17.79c-.297-.148-1.758-.867-2.03-.967-.272-.099-.47-.148-.668.15-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.76-1.653-2.058-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.15-.174.198-.298.297-.496.099-.198.05-.372-.025-.52-.074-.15-.668-1.612-.916-2.207-.241-.58-.486-.5-.668-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.478 0 1.462 1.065 2.875 1.213 3.073.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
                    </svg>
                    {choosingWhatsapp ? 'Guardando…' : 'Prefiero ser contactado/a por WhatsApp'}
                  </button>
                  <button
                    className="btn btn-secondary btn-full"
                    onClick={() => setShowWarning(true)}
                    style={{ marginTop: 8 }}
                  >
                    Ingresar a videollamada para ayuda inmediata
                  </button>
                  <div className="notice notice-info" style={{ marginTop: 12 }}>
                    ℹ️ La videollamada funciona mejor desde el navegador, no hay necesidad de
                    bajarse la app.
                  </div>
                  <div className="notice notice-warning" style={{ marginTop: 12 }}>
                    Si entras a la videollamada, <strong>espera a que tu médico se conecte</strong>.
                    Puede tardar varios minutos. Mantén esta página abierta.
                  </div>
                  <p style={{ color: '#64748b', fontSize: 14, marginTop: 12 }}>
                    Guarda este enlace{code ? ` (código ${code})` : ''} para volver a entrar si se
                    corta la conexión.
                  </p>
                  <div className="notice notice-info" style={{ marginTop: 12 }}>
                    <strong>Para que la videollamada funcione bien:</strong>
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
              )
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
