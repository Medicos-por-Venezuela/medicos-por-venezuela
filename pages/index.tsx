import Head from 'next/head'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  return (
    <>
      <Head>
        <title>Médicos por Venezuela</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1rem 2rem' }}>
        <div style={{ width: '100%', maxWidth: '600px', background: 'linear-gradient(135deg, #0d5c47, #0f6e56)', borderRadius: '0 0 24px 24px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🇻🇪</div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '0.5rem' }}>Médicos por Venezuela</h1>
          <p style={{ fontSize: '15px', opacity: 0.88, lineHeight: 1.5, marginBottom: '1rem' }}>
            Teleconsultas gratuitas para afectados del terremoto de Caracas
          </p>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px', padding: '5px 16px', fontSize: '13px' }}>
            Médicos venezolanos desde todo el mundo
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: '600px', marginBottom: '1.5rem' }}>
          <button onClick={() => router.push('/registro-paciente')} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e1f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🤒</div>
            <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Soy paciente</h2>
            <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.4 }}>Necesito hablar con un médico o psicólogo</p>
            <div style={{ marginTop: '8px', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: '#0f6e56', color: 'white', width: '100%' }}>
              Solicitar consulta →
            </div>
          </button>

          <button onClick={() => router.push('/registro-medico')} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e6f1fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🩺</div>
            <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Soy Médico/Psicólogo</h2>
            <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.4 }}>Quiero ofrecer mi ayuda voluntaria</p>
            <div style={{ marginTop: '8px', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: '#185fa5', color: 'white', width: '100%' }}>
              Registrarme →
            </div>
          </button>
        </div>

        <p style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>
          Servicio gratuito · Confidencial · Disponible 24/7
        </p>
      </main>
    </>
  )
}
