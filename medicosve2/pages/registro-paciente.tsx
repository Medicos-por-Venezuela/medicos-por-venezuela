import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ZONAS = ['Caracas - Centro','Caracas - Este','Caracas - Oeste','Caracas - Sur','Miranda','La Guaira','Aragua','Carabobo','Otro']
const NECESIDADES = ['Apoyo emocional','Consulta médica general','Crisis de ansiedad','Lesión física','Pérdida de familiar','Primeros auxilios','Duelo','Atención psicológica','Medicamentos / receta']

const campo = { display: 'flex', flexDirection: 'column' as const, gap: '6px' }
const label = { fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }
const hint = { fontSize: '12px', color: '#888', fontWeight: 400 }

export default function RegistroPaciente() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [zona, setZona] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [consent, setConsent] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const handleSubmit = async () => {
    setError('')
    if (!nombre || !telefono || !zona) { setError('Completa nombre, teléfono y zona.'); return }
    if (tags.length === 0) { setError('Selecciona al menos un tipo de ayuda.'); return }
    if (!consent) { setError('Debes aceptar el uso de tus datos.'); return }
    setLoading(true)
    try {
      const { data: patient, error: e1 } = await supabase.from('patients').insert({
        full_name: nombre, phone_whatsapp: telefono, affected_zone: zona,
        needs_tags: tags, description: descripcion, consent: true, consent_at: new Date().toISOString(),
      }).select().single()
      if (e1) throw e1
      const { error: e2 } = await supabase.from('consultations').insert({
        patient_id: patient.id, status: 'waiting', priority: 'normal',
        chief_complaint: descripcion || tags.join(', '), code: 'TEMP-' + Date.now(),
      })
      if (e2) throw e2
      router.push('/sala-espera?nombre=' + encodeURIComponent(nombre))
    } catch { setError('Error al registrarte. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <>
      <Head><title>Solicitar consulta — Médicos por Venezuela</title></Head>
      <main style={{ minHeight: '100vh', padding: '1.5rem 1rem 3rem', background: '#f9fafb' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#555', fontSize: '14px', padding: '0', marginBottom: '1.25rem', cursor: 'pointer' }}>← Volver</button>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Solicitar consulta</h1>
          <p style={{ fontSize: '14px', color: '#555', marginBottom: '1.5rem' }}>Tus datos son confidenciales.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={campo}>
              <span style={label}>Nombre completo *</span>
              <input type="text" placeholder="María González" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div style={campo}>
              <span style={label}>Teléfono WhatsApp *</span>
              <input type="tel" placeholder="+58 412 000 0000" value={telefono} onChange={e => setTelefono(e.target.value)} />
              <span style={hint}>Aquí recibirás el link para la videollamada</span>
            </div>
            <div style={campo}>
              <span style={label}>Zona afectada *</span>
              <select value={zona} onChange={e => setZona(e.target.value)}>
                <option value="">Selecciona tu zona...</option>
                {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div style={campo}>
              <span style={label}>¿Qué tipo de ayuda necesitas? *</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {NECESIDADES.map(n => (
                  <button key={n} type="button" className={`tag${tags.includes(n) ? ' selected' : ''}`} onClick={() => toggleTag(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div style={campo}>
              <span style={label}>Descripción <span style={hint}>(opcional)</span></span>
              <textarea rows={3} placeholder="Cuéntanos cómo te sientes..." value={descripcion} onChange={e => setDescripcion(e.target.value)} />
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '12px 14px' }}>
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', cursor: 'pointer', lineHeight: 1.5 }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: 'auto', marginTop: '2px' }} />
                <span>Acepto que mis datos sean usados únicamente para conectarme con un médico voluntario. Esta es una consulta de orientación.</span>
              </label>
            </div>
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#b91c1c' }}>{error}</div>}
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Registrando...' : 'Solicitar consulta gratuita'}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
