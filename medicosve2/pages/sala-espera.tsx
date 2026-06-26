import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function SalaEspera() {
  const router = useRouter()
  const nombre = typeof router.query.nombre === 'string' ? router.query.nombre : 'paciente'

  return (
    <>
      <Head><title>Sala de espera — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <div className="card">
            <span className="badge badge-green">Solicitud recibida</span>
            <h1>Gracias, {nombre}</h1>
            <p>
              Tu solicitud quedó en espera. Un médico voluntario podrá contactarte por WhatsApp cuando tome el caso.
            </p>
            <div className="notice notice-warning" style={{ margin: '16px 0' }}>
              Si tu situación empeora o hay señales de alarma, busca atención presencial urgente. No esperes a que respondan por WhatsApp.
            </div>
            <Link className="btn btn-primary" href="/">Volver al inicio</Link>
          </div>
        </div>
      </main>
    </>
  )
}
