import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SalaEspera() {
  const router = useRouter()
  const nombre = typeof router.query.nombre === 'string' ? router.query.nombre : 'paciente'
  const room = typeof router.query.room === 'string' ? router.query.room : ''
  const code = typeof router.query.code === 'string' ? router.query.code : ''
  const cid = typeof router.query.cid === 'string' ? router.query.cid : ''

  // Waiting-room heartbeat: while this page is open, tell the backend the patient is present every
  // ~20s so the doctor panel can distinguish people actually waiting from those who submitted and left.
  useEffect(() => {
    if (!cid) return
    const ping = () => { supabase.rpc('mark_patient_waiting', { p_consultation_id: cid }) }
    ping()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') ping()
    }, 20000)
    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cid])

  return (
    <>
      <Head><title>Sala de espera — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <div className="card">
            <span className="badge badge-green">Solicitud recibida</span>
            <h1>Gracias, {nombre}</h1>

            {room ? (
              <>
                <p>Tu sala de videoconsulta está lista.</p>
                <a className="btn btn-primary btn-full" href={room} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
                  Entrar a la videoconsulta
                </a>
                <div className="notice notice-warning" style={{ marginTop: 12 }}>
                  Una vez dentro, <strong>espera a que tu médico asignado se conecte</strong>. Puede tardar varios minutos.
                  Mantén esta página abierta.
                </div>
                <p style={{ color: '#64748b', fontSize: 14, marginTop: 12 }}>
                  Guarda este enlace{code ? ` (código ${code})` : ''} para volver a entrar si se corta la conexión.
                </p>
                <div className="notice notice-info" style={{ marginTop: 12 }}>
                  <strong>Para que funcione bien:</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    <li>Al abrir el enlace, elige <strong>“Continuar en el navegador”</strong> (no necesitas descargar la app).</li>
                    <li>Pulsa <strong>“Permitir”</strong> cuando te pida cámara y micrófono.</li>
                    <li>Busca un lugar con <strong>mejor señal móvil</strong> y lo más <strong>silencioso</strong> posible.</li>
                    <li>Procura estar <strong>a solas</strong> para proteger tu privacidad (salvo consulta de un niño/a, donde debe acompañarte un adulto responsable).</li>
                  </ul>
                </div>
              </>
            ) : (
              <p>
                Tu solicitud quedó en espera. Un médico voluntario podrá contactarte por WhatsApp cuando tome el caso.
              </p>
            )}

            <div className="notice notice-warning" style={{ margin: '16px 0' }}>
              Si tu situación empeora o hay señales de alarma, busca atención presencial urgente. No esperes a que respondan por WhatsApp.
            </div>
            <Link className="btn btn-muted" href="/">Volver al inicio</Link>
          </div>
        </div>
      </main>
    </>
  )
}
