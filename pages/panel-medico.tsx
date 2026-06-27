import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SPECIALTIES, STATUS_LABELS, minutesSince, whatsappUrl } from '../lib/utils'

type Patient = {
  id: string
  full_name: string
  phone_whatsapp: string
  affected_zone: string
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
}

type Consultation = {
  id: string
  code: string
  status: string
  priority: string
  category: string | null
  chief_complaint: string | null
  created_at: string
  opened_at: string | null
  closed_at: string | null
  referred_specialty: string | null
  internal_note: string | null
  video_room_url: string | null
  assigned_doctor_id: string | null
  patients: Patient | null
}

type Profile = {
  id: string
  full_name: string
  role: string
  specialty: string | null
  verified: boolean
  active: boolean
}

export default function PanelMedico() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [selected, setSelected] = useState<Consultation | null>(null)
  const [note, setNote] = useState('')
  const [refSpecialty, setRefSpecialty] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    const updateOnline = async () => {
      await supabase.rpc('mark_myself_online')
    }
    updateOnline()
    const timer = window.setInterval(updateOnline, 60000)
    return () => window.clearInterval(timer)
  }, [profile?.id])

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login-medico')
      return
    }

    const { data: p, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, specialty, verified, active')
      .eq('id', sessionData.session.user.id)
      .single()

    if (profileError || !p || !p.active || !p.verified) {
      await supabase.auth.signOut()
      router.push('/login-medico')
      return
    }

    if (!['doctor', 'specialist', 'admin', 'super_admin'].includes(p.role)) {
      router.push('/')
      return
    }

    setProfile(p)
    await loadConsultations()
    setLoading(false)
  }

  async function loadConsultations() {
    const { data, error } = await supabase
      .from('consultations')
      .select('*, patients(id, full_name, phone_whatsapp, affected_zone, age_range, needs_tags, description)')
      .in('status', ['waiting', 'in_progress', 'referred_to_specialist', 'urgent_in_person'])
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      setMessage('No se pudieron cargar las consultas.')
      return
    }
    setConsultations((data || []) as Consultation[])
  }

  const waiting = useMemo(() => consultations.filter(c => c.status === 'waiting'), [consultations])
  const mine = useMemo(() => consultations.filter(c => c.assigned_doctor_id === profile?.id && c.status === 'in_progress'), [consultations, profile?.id])
  const referred = useMemo(() => consultations.filter(c => c.status === 'referred_to_specialist'), [consultations])
  const urgent = useMemo(() => consultations.filter(c => c.status === 'urgent_in_person'), [consultations])

  async function addEvent(consultationId: string, eventType: string, eventNote?: string) {
    await supabase.from('consultation_events').insert({
      consultation_id: consultationId,
      event_type: eventType,
      note: eventNote || null
    })
  }

  async function openConsultation(c: Consultation) {
    if (!profile) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('consultations')
      .update({
        status: 'in_progress',
        assigned_doctor_id: profile.id,
        opened_at: c.opened_at || now
      })
      .eq('id', c.id)

    if (error) {
      setMessage('No se pudo abrir la consulta.')
      return
    }

    await addEvent(c.id, 'opened', `Abierta por ${profile.full_name}`)
    const patientName = c.patients?.full_name || 'paciente'
    const text = `Hola ${patientName}. Soy ${profile.full_name}, médico voluntario de Médicos por Venezuela. Recibí tu solicitud de orientación. ¿Puedes contarme brevemente cómo estás ahora?`
    const url = whatsappUrl(c.patients?.phone_whatsapp || '', text)
    window.open(url, '_blank')
    setSelected({ ...c, status: 'in_progress', assigned_doctor_id: profile.id, opened_at: c.opened_at || now })
    setNote(c.internal_note || '')
    await loadConsultations()
  }

  async function saveNote() {
    if (!selected) return
    const { error } = await supabase.from('consultations').update({ internal_note: note }).eq('id', selected.id)
    if (error) setMessage('No se pudo guardar la nota.')
    else setMessage('Nota guardada.')
  }

  async function closeConsultation() {
    if (!selected || !profile) return
    const { error } = await supabase
      .from('consultations')
      .update({ status: 'closed', internal_note: note, closed_at: new Date().toISOString() })
      .eq('id', selected.id)

    if (error) {
      setMessage('No se pudo cerrar la consulta.')
      return
    }
    await addEvent(selected.id, 'closed', `Cerrada por ${profile.full_name}`)
    setSelected(null)
    setNote('')
    await loadConsultations()
  }

  async function referConsultation() {
    if (!selected || !refSpecialty) {
      setMessage('Selecciona una especialidad para derivar.')
      return
    }
    const { error } = await supabase
      .from('consultations')
      .update({ status: 'referred_to_specialist', referred_specialty: refSpecialty, internal_note: note, assigned_doctor_id: null })
      .eq('id', selected.id)

    if (error) {
      setMessage('No se pudo derivar la consulta.')
      return
    }
    await addEvent(selected.id, 'referred', `Derivada a ${refSpecialty}`)
    setSelected(null)
    setRefSpecialty('')
    await loadConsultations()
  }

  async function markUrgent(c: Consultation) {
    const { error } = await supabase
      .from('consultations')
      .update({ status: 'urgent_in_person', assigned_doctor_id: profile?.id || c.assigned_doctor_id })
      .eq('id', c.id)

    if (error) {
      setMessage('No se pudo marcar como urgente.')
      return
    }
    await addEvent(c.id, 'urgent_flagged', 'Se recomienda atención presencial urgente')
    await loadConsultations()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <main className="page"><div className="container"><div className="card">Cargando...</div></div></main>
  }

  return (
    <>
      <Head><title>Panel médico — Médicos por Venezuela</title></Head>
      <main className="page">
        <div className="container">
          <div className="topbar">
            <div>
              <h1 style={{ margin: 0 }}>Panel médico</h1>
              <p style={{ margin: 0, color: '#64748b' }}>{profile?.full_name} · <span className="badge badge-green">Activo</span></p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['admin', 'super_admin'].includes(profile?.role || '') && <button className="btn btn-outline" onClick={() => router.push('/admin/dashboard')}>Panel admin</button>}
              <button className="btn btn-muted" onClick={logout}>Salir</button>
            </div>
          </div>

          {message && <div className="notice notice-info" style={{ marginBottom: 16 }}>{message}</div>}

          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <div className="kpi"><div className="kpi-value">{waiting.length}</div><div className="kpi-label">Esperando</div></div>
            <div className="kpi"><div className="kpi-value">{mine.length}</div><div className="kpi-label">Mis abiertas</div></div>
            <div className="kpi"><div className="kpi-value">{referred.length}</div><div className="kpi-label">Derivadas</div></div>
            <div className="kpi"><div className="kpi-value">{urgent.length}</div><div className="kpi-label">Urgentes</div></div>
          </div>

          <div className="grid grid-2">
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Consultas disponibles</h2>
              {waiting.length === 0 ? <p style={{ color: '#64748b' }}>No hay pacientes esperando.</p> : (
                <div className="grid">
                  {waiting.map(c => <ConsultationCard key={c.id} c={c} onOpen={() => openConsultation(c)} onUrgent={() => markUrgent(c)} />)}
                </div>
              )}

              <h2>Derivadas a especialista</h2>
              {referred.length === 0 ? <p style={{ color: '#64748b' }}>No hay derivaciones pendientes.</p> : (
                <div className="grid">
                  {referred.map(c => <ConsultationCard key={c.id} c={c} onOpen={() => openConsultation(c)} onUrgent={() => markUrgent(c)} />)}
                </div>
              )}
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Consulta seleccionada</h2>
              {!selected ? (
                <p style={{ color: '#64748b' }}>Abre una consulta para contactar al paciente por WhatsApp y gestionar el estado.</p>
              ) : (
                <div className="grid">
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{selected.patients?.full_name}</h3>
                    <p style={{ marginTop: 0, color: '#64748b' }}>{selected.patients?.affected_zone} · {selected.patients?.age_range || 'Edad no indicada'}</p>
                    <div className="tag-row">{selected.patients?.needs_tags?.map(t => <span key={t} className="tag">{t}</span>)}</div>
                  </div>
                  <div className="notice">
                    <strong>Motivo:</strong><br />{selected.chief_complaint || selected.patients?.description || 'Sin descripción'}
                  </div>
                  <div>
                    <label className="label">Nota operativa interna</label>
                    <textarea rows={5} value={note} onChange={e => setNote(e.target.value)} placeholder="Evita escribir historia clínica completa. Solo información necesaria para coordinación." />
                  </div>
                  {selected.video_room_url && (
                    <a className="btn btn-primary" href={selected.video_room_url} target="_blank" rel="noreferrer">
                      Unirse a videoconsulta
                    </a>
                  )}
                  <button className="btn btn-secondary" onClick={saveNote}>Guardar nota</button>
                  <div className="grid grid-2">
                    <select value={refSpecialty} onChange={e => setRefSpecialty(e.target.value)}>
                      <option value="">Especialidad para derivar...</option>
                      {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-warning" onClick={referConsultation}>Derivar a especialista</button>
                  </div>
                  <div className="grid grid-2">
                    <button className="btn btn-danger" onClick={() => markUrgent(selected)}>Marcar urgente presencial</button>
                    <button className="btn btn-primary" onClick={closeConsultation}>Cerrar consulta</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}

function ConsultationCard({ c, onOpen, onUrgent }: { c: Consultation; onOpen: () => void; onUrgent: () => void }) {
  return (
    <div className="card-flat">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <div>
          <strong>{c.patients?.full_name || 'Paciente'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>{c.patients?.affected_zone} · hace {minutesSince(c.created_at)} min</div>
        </div>
        <span className={`badge ${c.status === 'urgent_in_person' ? 'badge-red' : c.status === 'referred_to_specialist' ? 'badge-blue' : 'badge-green'}`}>{STATUS_LABELS[c.status] || c.status}</span>
      </div>
      <p>{c.chief_complaint || c.patients?.description || 'Sin descripción'}</p>
      {c.referred_specialty && <p><span className="badge badge-blue">{c.referred_specialty}</span></p>}
      <div className="tag-row" style={{ marginBottom: 12 }}>{c.patients?.needs_tags?.slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}</div>
      {c.video_room_url && (
        <a className="btn btn-primary btn-full" href={c.video_room_url} target="_blank" rel="noreferrer" style={{ marginBottom: 8 }}>
          Unirse a videoconsulta
        </a>
      )}
      <div className="grid grid-2">
        <button className="btn btn-primary" onClick={onOpen}>Abrir WhatsApp</button>
        <button className="btn btn-danger" onClick={onUrgent}>Urgente</button>
      </div>
    </div>
  )
}
