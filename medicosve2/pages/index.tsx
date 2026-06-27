import Head from 'next/head'
import Link from 'next/link'

export default function Home() {
  return (
    <>
      <Head>
        <title>Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="container">
          <section className="hero">
            <p style={{ margin: 0, opacity: 0.9, fontWeight: 800 }}>Red solidaria de orientación médica</p>
            <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: '12px 0' }}>Médicos por Venezuela</h1>
            <p style={{ maxWidth: 760, fontSize: 19, opacity: 0.95 }}>
              Conectamos a personas afectadas por el sismo con médicos voluntarios por WhatsApp.
              El objetivo es orientación inicial y derivación cuando sea necesario.
            </p>
            <div className="notice notice-warning" style={{ marginTop: 24, color: '#78350f' }}>
              <strong>Emergencia:</strong> si hay dificultad respiratoria, sangrado fuerte, pérdida de conciencia,
              dolor fuerte en el pecho, embarazo con síntomas graves, fractura evidente o un niño en mal estado,
              busca atención presencial urgente.
            </div>
          </section>

          <div className="grid grid-2" style={{ marginTop: 22 }}>
            <Link className="card" href="/registro-paciente">
              <h2 style={{ marginTop: 0 }}>Soy paciente</h2>
              <p style={{ color: '#64748b' }}>Necesito orientación médica o apoyo emocional.</p>
              <span className="btn btn-primary">Solicitar ayuda</span>
            </Link>

            <Link className="card" href="/registro-medico">
              <h2 style={{ marginTop: 0 }}>Soy médico</h2>
              <p style={{ color: '#64748b' }}>Quiero registrarme como voluntario.</p>
              <span className="btn btn-secondary">Registrar voluntario</span>
            </Link>
          </div>

          <p style={{ textAlign: 'center', color: '#64748b', marginTop: 24 }}>
            Servicio gratuito · Datos mínimos · Sin almacenar conversaciones completas de WhatsApp
          </p>
        </div>
      </main>
    </>
  )
}
