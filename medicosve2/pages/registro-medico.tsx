import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ESPECIALIDADES = ['Médico general','Médico de familia','Psicólogo clínico','Psiquiatra','Pediatra','Traumatólogo','Cardiólogo','Ginecólogo','Neurólogo','Internista','Cirujano','Otra especialidad']
const PAISES = ['Venezuela','Colombia','España','Chile','Argentina','Perú','Ecuador','México','Estados Unidos','Panamá','República Dominicana','Uruguay','Italia','Portugal','Otro']
const PLATAFORMAS = [{ val: 'google_meet', label: 'Google Meet' }, { val: 'zoom', label: 'Zoom' }, { val: 'whatsapp', label: 'WhatsApp' }]

const campo = { display: 'flex', flexDirection: 'column' as const, gap: '6px' }
const lbl = { fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }

export default function RegistroMedico() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [pais, setPais] = useState('')
  const [telefono, setTelefono] = useState('')
  const [plataforma, setPlataforma] = useState('google_meet')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!nombre || !especialidad || !pais || !telefono) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      const { data: doctor, error: e } = await supabase.from('doctors').insert({
        full_name: nombre, specialty: especialidad, country: pais,
        phone_whatsapp: telefono, preferred_platform: plataforma, status: 'active',
      }).select().single()
      if (e) throw e
      if (typeof window !== 'undefined') {
        localStorage.setItem('doctor_id', doctor.id)
        localStorage.setItem('doctor_name', doctor.full_name)
      }
      router.push('/panel-medico')
    } catch { setError('Error al registrarte. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <>
      <Head><title>Registro médico — Médicos por Venezuela</title></Head>
      <main style={{ minHeight: '100vh', padding: '1.5rem 1rem 3rem', background: '#f9fafb' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#555', fontSize: '14px', padding: 0, marginBottom: '1.25rem', cursor: 'pointer' }}>← Volver</button>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Registro de voluntario</h1>
          <p style={{ fontSize: '14px', color: '#555', marginBottom: '1.5rem' }}>Gracias por tu solidaridad. Solo te registras una vez.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={campo}>
              <span style={lbl}>Nombre completo *</span>
              <input type="text" placeholder="Dra. María Rodríguez" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={campo}>
                <span style={lbl}>Especialidad *</span>
                <select value={especialidad} onChange={e => setEspecialidad(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div style={campo}>
                <span style={lbl}>País donde resides *</span>
                <select value={pais} onChange={e => setPais(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={campo}>
              <span style={lbl}>Teléfono WhatsApp *</span>
              <input type="tel" placeholder="+34 600 000 000" value={telefono} onChange={e => setTelefono(e.target.value)} />
            </div>
            <div style={campo}>
              <span style={lbl}>Plataforma preferida para videollamada</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {PLATAFORMAS.map(p => (
                  <button key={p.val} type="button" onClick={() => setPlataforma(p.val)}
                    style={{ flex: 1, padding: '10px 8px', border: `2px solid ${plataforma === p.val ? '#0f6e56' : '#e5e7eb'}`, borderRadius: '10px', background: plataforma === p.val ? '#e1f5ee' : 'white', fontSize: '13px', fontWeight: 600, color: plataforma === p.val ? '#0f6e56' : '#555', cursor: 'pointer' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: '#e1f5ee', border: '1px solid #5dcaa5', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#085041', lineHeight: 1.5 }}>
              Este servicio es de orientación médica voluntaria en contexto de emergencia.
            </div>
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#b91c1c' }}>{error}</div>}
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Registrando...' : 'Registrarme y entrar al panel →'}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
