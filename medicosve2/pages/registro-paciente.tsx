import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const ZONAS = ['Caracas - Centro', 'Caracas - Este', 'Caracas - Oeste', 'Caracas - Sur', 'Miranda', 'La Guaira', 'Aragua', 'Carabobo', 'Otro']
const NECESIDADES = ['Medicina general', 'Lesión física', 'Primeros auxilios', 'Apoyo emocional', 'Crisis de ansiedad', 'Niño / pediatría', 'Embarazo', 'Medicamentos', 'Enfermedad crónica', 'Otra']

export default function RegistroPaciente() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [zona, setZona] = useState('')
  const [edad, setEdad] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const submit = async () => {
    setError('')
    if (!nombre.trim() || !telefono.trim() || !zona) {
      setError('Completa nombre, WhatsApp y zona.')
      return
    }
    if (tags.length === 0) {
      setError('Selecciona al menos un tipo de ayuda.')
      return
    }
    if (!consent) {
      setError('Debes aceptar el consentimiento para poder continuar.')
      return
    }

    setLoading(true)
    try {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          full_name: nombre.trim(),
          phone_whatsapp: telefono.trim(),
          affected_zone: zona,
          age_range: edad || null,
          needs_tags: tags,
          description: descripcion.trim() || null,
          consent: true,
          consent_at: new Date().toISOString()
        })
        .select('id, full_name')
        .single()

      if (patientError) throw patientError

      const { error: consultationError } = await supabase
        .from('consultations')
        .insert({
          patient_id: patient.id,
          status: 'waiting',
          priority: tags.some(t => ['Lesión física', 'Embarazo', 'Niño / pediatría'].includes(t)) ? 'review' : 'normal',
          category: tags[0],
          chief_complaint: descripcion.trim() || tags.join(', '),
          code: `MPV-${Date.now()}`
        })

      if (consultationError) throw consultationError
      router.push(`/sala-espera?nombre=${encodeURIComponent(patient.full_name)}`)
    } catch (e) {
      console.error(e)
      setError('No se pudo registrar la solicitud. Revisa la conexión o avisa al equipo administrador.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Solicitar consulta — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="narrow">
          <Link href="/" className="link-button">← Volver</Link>
          <div className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Solicitar orientación</h1>
            <p style={{ color: '#64748b' }}>
              Comparte solo la información mínima necesaria. Un médico voluntario podrá contactarte por WhatsApp.
            </p>

            <div className="notice notice-danger" style={{ marginBottom: 16 }}>
              Si tienes síntomas graves, busca atención presencial urgente. Esta web no reemplaza emergencias.
            </div>

            <div className="grid">
              <div>
                <label className="label">Nombre o alias *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. María" />
              </div>
              <div>
                <label className="label">WhatsApp con código de país *</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej. 584121234567" />
                <div className="hint">Usa solo un número donde puedas recibir mensajes.</div>
              </div>
              <div className="grid grid-2">
                <div>
                  <label className="label">Zona afectada *</label>
                  <select value={zona} onChange={e => setZona(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Edad aproximada</label>
                  <select value={edad} onChange={e => setEdad(e.target.value)}>
                    <option value="">Prefiero no decir</option>
                    <option value="0-2">0-2 años</option>
                    <option value="3-12">3-12 años</option>
                    <option value="13-17">13-17 años</option>
                    <option value="18-40">18-40 años</option>
                    <option value="41-65">41-65 años</option>
                    <option value="65+">65+ años</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Tipo de ayuda *</label>
                <div className="tag-row">
                  {NECESIDADES.map(tag => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`tag ${tags.includes(tag) ? 'selected' : ''}`}>{tag}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Descripción breve</label>
                <textarea rows={4} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Describe en pocas palabras qué ocurre. Evita datos innecesarios." />
              </div>
              <label className="notice notice-warning" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: 'auto', marginTop: 5 }} />
                <span>
                  Acepto compartir voluntariamente esta información para recibir orientación médica solidaria. Entiendo que la comunicación puede continuar por WhatsApp y que esto no reemplaza atención presencial ni servicios de emergencia.
                </span>
              </label>
              {error && <div className="notice notice-danger">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>{loading ? 'Enviando...' : 'Solicitar consulta gratuita'}</button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
