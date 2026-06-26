import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

type Consulta = {
  id: string
  code: string
  status: string
  priority: string
  queued_at: string
  chief_complaint: string
  patients: { full_name: string; phone_whatsapp: string; affected_zone: string; needs_tags: string[] }
}

export default function PanelMedicoInterno() {
  const router = useRouter()
  const [doctorId, setDoctorId] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [cola, setCola] = useState<Consulta[]>([])
  const [actual, setActual] = useState<Consulta | null>(null)
  const [notas, setNotas] = useState('')
  const [mensajes, setMensajes] = useState<any[]>([])
  const [nuevoMsg, setNuevoMsg] = useState('')
  const [vista, setVista] = useState<'cola' | 'consulta' | 'chat'>('cola')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = localStorage.getItem('doctor_id') || ''
    const name = localStorage.getItem('doctor_name') || ''
    if (!id) { router.push('/registro-medico'); return }
    setDoctorId(id)
    setDoctorName(name)
    fetchCola()
  }, [])

  const fetchCola = async () => {
    const { data } = await supabase
      .from('consultations')
      .select('*, patients(full_name, phone_whatsapp, affected_zone, needs_tags)')
      .in('status', ['waiting', 'follow_up_chat'])
      .order('queued_at', { ascending: true })
    setCola((data || []) as Consulta[])
    setLoading(false)
  }

  useEffect(() => {
    const ch = supabase.channel('panel').on('postgres_changes', { event: '*', schema: 'public', table: 'consultations' }, fetchCola).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const fetchMensajes = async (id: string) => {
    const { data } = await supabase.from('messages').select('*').eq('consultation_id', id).order('sent_at', { ascending: true })
    setMensajes(data || [])
  }

  const iniciar = async (c: Consulta) => {
    await supabase.from('consultations').update({ status: 'in_progress', doctor_id: doctorId, platform_used: 'google_meet', meeting_link: 'https://meet.google.com/new', started_at: new Date().toISOString() }).eq('id', c.id)
    setActual(c)
    setVista('consulta')
    window.open('https://meet.google.com/new', '_blank')
    fetchCola()
  }

  const dejarAbierta = async () => {
    if (!actual) return
    await supabase.from('consultations').update({ status: 'follow_up_chat', clinical_notes: notas }).eq('id', actual.id)
    fetchMensajes(actual.id)
    setVista('chat')
    fetchCola()
  }

  const cerrar = async () => {
    if (!actual) return
    await supabase.from('consultations').update({ status: 'completed', clinical_notes: notas, ended_at: new Date().toISOString() }).eq('id', actual.id)
    setActual(null); setNotas(''); setMensajes([]); setVista('cola')
    fetchCola()
  }

  const enviar = async () => {
    if (!nuevoMsg.trim() || !actual) return
    await supabase.from('messages').insert({ consultation_id: actual.id, sender_role: 'doctor', body: nuevoMsg })
    setNuevoMsg('')
    fetchMensajes(actual.id)
  }

  const mins = (q: string) => Math.floor((Date.now() - new Date(q).getTime()) / 60000)
  const waiting = cola.filter(c => c.status === 'waiting')
  const chats = cola.filter(c => c.status === 'follow_up_chat')

  const headerStyle = { background: '#0f6e56', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }
  const cardStyle = { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '10px' }

  return (
    <main style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Panel del médico</div>
            <div style={{ fontSize: '13px', opacity: 0.8 }}>{doctorName}</div>
          </div>
          <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}>● Activo</span>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: 'white' }}>
          <div style={{ flex: 1, padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: waiting.length > 0 ? '#dc2626' : '#0f6e56' }}>{waiting.length}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>esperando</div>
          </div>
          <div style={{ flex: 1, padding: '1rem', textAlign: 'center', borderLeft: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{chats.length}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>en seguimiento</div>
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          {vista === 'cola' && (
            <>
              {loading && <p style={{ color: '#888', textAlign: 'center' }}>Cargando...</p>}
              {!loading && waiting.length === 0 && chats.length === 0 && (
                <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>No hay pacientes esperando.</p>
              )}
              {waiting.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Esperando consulta</div>
                  {waiting.map(p => (
                    <div key={p.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{p.patients.full_name}</span>
                        <span style={{ fontSize: '12px', color: '#888' }}>⏱ {mins(p.queued_at)} min</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {p.priority === 'urgent' && <span className="badge-urgente">Urgente</span>}
                        {p.patients.needs_tags?.slice(0,3).map((t:string) => <span key={t} className="badge-normal">{t}</span>)}
                      </div>
                      <p style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>{p.chief_complaint}</p>
                      <button className="btn-primary" onClick={() => iniciar(p)}>📹 Iniciar videollamada</button>
                    </div>
                  ))}
                </>
              )}
              {chats.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', marginTop: '1rem' }}>Consultas con chat abierto</div>
                  {chats.map(p => (
                    <div key={p.id} style={cardStyle}>
                      <div style={{ fontWeight: 600, marginBottom: '8px' }}>{p.patients.full_name}</div>
                      <button className="btn-primary" onClick={() => { setActual(p); fetchMensajes(p.id); setVista('chat') }}>💬 Ver chat de seguimiento</button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {vista === 'consulta' && actual && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{actual.patients.full_name}</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>{actual.patients.affected_zone}</div>
                </div>
              </div>
              <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Motivo de consulta</div>
                <p style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>{actual.chief_complaint}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {actual.patients.needs_tags?.map((t:string) => <span key={t} className="badge-normal">{t}</span>)}
                </div>
              </div>
              <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Notas clínicas <span style={{ color: '#aaa', fontWeight: 400 }}>(privadas)</span></div>
                <textarea rows={4} placeholder="Anamnesis, diagnóstico, indicaciones..." value={notas} onChange={e => setNotas(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={dejarAbierta} style={{ padding: '1rem', border: '1.5px solid #e5e7eb', borderRadius: '12px', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                  💬 Dejar abierta con chat
                </button>
                <button onClick={cerrar} style={{ padding: '1rem', border: '1.5px solid #0f6e56', borderRadius: '12px', background: '#e1f5ee', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#0f6e56' }}>
                  ✅ Cerrar consulta
                </button>
              </div>
            </>
          )}

          {vista === 'chat' && actual && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{actual.patients.full_name}</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>Chat de seguimiento</div>
                </div>
                <button onClick={cerrar} style={{ padding: '8px 16px', border: '1.5px solid #0f6e56', borderRadius: '8px', background: 'white', color: '#0f6e56', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  Cerrar consulta
                </button>
              </div>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', minHeight: '200px', marginBottom: '1rem' }}>
                {mensajes.length === 0 ? (
                  <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', marginTop: '1rem' }}>Escribe tu primera recomendación abajo.</p>
                ) : mensajes.map(m => (
                  <div key={m.id} style={{ marginBottom: '10px', textAlign: m.sender_role === 'doctor' ? 'right' : 'left' }}>
                    <div style={{ display: 'inline-block', background: m.sender_role === 'doctor' ? '#e1f5ee' : '#f0f0f0', borderRadius: '10px', padding: '8px 12px', maxWidth: '80%', fontSize: '14px', lineHeight: 1.5 }}>
                      {m.body}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                      {m.sender_role === 'doctor' ? 'Médico' : 'Paciente'} · {new Date(m.sent_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
              <textarea rows={3} placeholder="Escribe una recomendación..." value={nuevoMsg} onChange={e => setNuevoMsg(e.target.value)} style={{ marginBottom: '8px' }} />
              <button className="btn-primary" onClick={enviar}>Enviar mensaje al paciente</button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
