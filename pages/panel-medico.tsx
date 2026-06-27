import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, canAttend, matchesSpecialty, minutesSince } from '../lib/utils'

type Patient = {
  id: string
  full_name: string
  cedula: string | null
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
  patient_last_seen_at: string | null
  assigned_doctor_id: string | null
  patients: Patient | null
}

// A patient counts as "in the waiting room" if their /sala-espera page pinged within this window
// (it pings every ~20s, so we allow a couple of missed beats before treating them as gone).
const PRESENCE_WINDOW_MS = 5 * 60 * 1000
function isPatientPresent(c: Consultation): boolean {
  if (!c.patient_last_seen_at) return false
  return Date.now() - new Date(c.patient_last_seen_at).getTime() < PRESENCE_WINDOW_MS
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
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [myClosed, setMyClosed] = useState(0)

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

  // Poll the queue so patient presence (and cases claimed by other doctors) stay fresh.
  useEffect(() => {
    if (!profile?.id) return
    const timer = window.setInterval(() => { loadConsultations() }, 20000)
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
    await loadConsultations(p.id)
    setLoading(false)
  }

  async function loadConsultations(doctorId?: string) {
    const { data, error } = await supabase
      .from('consultations')
      .select('*, patients(id, full_name, cedula, phone_whatsapp, affected_zone, age_range, needs_tags, description)')
      .in('status', ['waiting', 'in_progress', 'referred_to_specialist', 'urgent_in_person'])
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      setMessage('No se pudieron cargar las consultas.')
      return
    }
    setConsultations((data || []) as Consultation[])

    // How many cases this doctor has closed.
    const id = doctorId || profile?.id
    if (id) {
      const { count } = await supabase
        .from('consultations')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_doctor_id', id)
        .eq('status', 'closed')
      setMyClosed(count || 0)
    }
  }

  const waiting = useMemo(() => consultations.filter(c => c.status === 'waiting'), [consultations])
  const myOpenConsultations = useMemo(
  () => consultations.filter(c => c.status === 'in_progress' && c.assigned_doctor_id === profile?.id),
  [consultations, profile?.id]
)
  // Only patients whose waiting-room page is still pinging count as actually present in the queue.
  const waitingPresent = useMemo(() => waiting.filter(isPatientPresent), [waiting])
  // Present waiting patients that align with this doctor's specialty (and that they're allowed to take).
  const mySpecialtyWaiting = useMemo(
    () => waitingPresent.filter(c =>
      canAttend(profile?.specialty, c.category, c.patients?.needs_tags || null) &&
      matchesSpecialty(profile?.specialty, c.category, c.patients?.needs_tags || null)
    ),
    [waitingPresent, profile?.specialty]
  )

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
    // Atomic claim: the update only matches while the case is still 'waiting', so if another
    // doctor grabbed it first it returns 0 rows. We must NOT open the video room in that case,
    // otherwise two doctors could land in the same meeting.
    const { data: claimed, error } = await supabase
      .from('consultations')
      .update({
        status: 'in_progress',
        assigned_doctor_id: profile.id,
        opened_at: c.opened_at || now
      })
      .eq('id', c.id)
      .eq('status', 'waiting')
      .select('id')

    if (error) {
      setMessage('No se pudo abrir la consulta.')
      return
    }
    if (!claimed || claimed.length === 0) {
      setMessage('Este paciente ya fue tomado por otro médico.')
      await loadConsultations()
      return
    }

    await addEvent(c.id, 'opened', `Abierta por ${profile.full_name}`)
    if (c.video_room_url) window.open(c.video_room_url, '_blank')
    setSelected({ ...c, status: 'in_progress', assigned_doctor_id: profile.id, opened_at: c.opened_at || now })
    setNote(c.internal_note || '')
    await loadConsultations()
  }

  // Take the next waiting patient: prefer one matching the doctor's specialty (oldest first),
  // otherwise fall back to the oldest waiting patient so nobody is left unattended.
  async function attendNext() {
    setMessage('')
    // Only consider patients actually present in the waiting room, so we never open an empty call.
    // Hard filter too: never assign cases reserved for other specialties (e.g. psychology
    // cases only go to psychologists/psychiatrists).
    const eligible = waitingPresent.filter(c => canAttend(profile?.specialty, c.category, c.patients?.needs_tags || null))
    if (eligible.length === 0) {
      setMessage(waitingPresent.length ? 'No hay pacientes en sala para tu especialidad ahora.' : 'No hay pacientes en sala en este momento.')
      return
    }
    const next = eligible.find(c => matchesSpecialty(profile?.specialty, c.category, c.patients?.needs_tags || null)) || eligible[0]
    await openConsultation(next)
  }

  async function saveNote() {
    if (!selected) return
    const { error } = await supabase.from('consultations').update({ internal_note: note }).eq('id', selected.id)
    if (error) setMessage('No se pudo guardar la nota.')
    else setMessage('Nota guardada.')
  }

  async function closeConsultation(outcome: 'closed' | 'patient_no_show' = 'closed') {
    if (!selected || !profile) return
    const noShow = outcome === 'patient_no_show'
    const { error } = await supabase
      .from('consultations')
      .update({ status: outcome, internal_note: note, closed_at: new Date().toISOString() })
      .eq('id', selected.id)

    if (error) {
      setMessage(noShow ? 'No se pudo marcar como ausente.' : 'No se pudo cerrar la consulta.')
      return
    }
    await addEvent(
      selected.id,
      noShow ? 'patient_no_show' : 'closed',
      noShow ? `Paciente no estaba en la sala de espera (${profile.full_name})` : `Cerrada por ${profile.full_name}`
    )
    setSelected(null)
    setNote('')
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
              <h1 style={{ margin: 0 }}>{profile?.full_name}</h1>
              <p style={{ margin: 0, color: '#64748b' }}>{profile?.specialty || 'Sin especialidad'} · <span className="badge badge-green">Activo</span></p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['admin', 'super_admin'].includes(profile?.role || '') && <button className="btn btn-outline" onClick={() => router.push('/admin/dashboard')}>Panel admin</button>}
              <button className="btn btn-muted" onClick={logout}>Salir</button>
            </div>
          </div>

          {message && <div className="notice notice-info" style={{ marginBottom: 16 }}>{message}</div>}

          <div className="grid grid-3" style={{ marginBottom: 18 }}>
            <div className="kpi"><div className="kpi-value">{waitingPresent.length}</div><div className="kpi-label">En sala esperando ahora</div></div>
            <div className="kpi"><div className="kpi-value">{mySpecialtyWaiting.length}</div><div className="kpi-label">En sala asignados a esta especialidad</div></div>
            <div className="kpi"><div className="kpi-value">{myClosed}</div><div className="kpi-label">Consultas cerradas por mí</div></div>
          </div>

          <button className="btn btn-primary btn-full" style={{ marginBottom: 18, fontSize: 16, padding: '15px 18px' }} onClick={attendNext} disabled={waitingPresent.length === 0}>
            Atender al siguiente paciente en sala{waitingPresent.length ? ` · ${waitingPresent.length} en sala` : ''}
          </button>

          <div className="grid grid-2">
            <section className="card">
  <h2>Mis consultas abiertas</h2>

  {myOpenConsultations.length === 0 ? (
    <p style={{ color: '#64748b' }}>No tienes consultas abiertas.</p>
  ) : (
    <div className="grid">
      {myOpenConsultations.map(c => (
        <div key={c.id} className="card-flat">
          <strong>{c.patients?.full_name || 'Paciente'}</strong>
          <p>{c.chief_complaint || c.patients?.description || 'Sin descripción'}</p>

          <button
            className="btn btn-primary btn-full"
            onClick={() => {
              setSelected(c)
              setNote(c.internal_note || '')
            }}
          >
            Continuar / cerrar consulta
          </button>
        </div>
      ))}
    </div>
  )}
</section>
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Consultas disponibles</h2>
              {waiting.length === 0 ? <p style={{ color: '#64748b' }}>No hay pacientes esperando.</p> : (
                <div className="grid">
                  {waiting.map(c => <ConsultationCard key={c.id} c={c} onOpen={() => openConsultation(c)} />)}
                </div>
              )}
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Consulta seleccionada</h2>
              {!selected ? (
                <p style={{ color: '#64748b' }}>Atiende una consulta para iniciar la videoconsulta y gestionar el estado.</p>
              ) : (
                <div className="grid">
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{selected.patients?.full_name}</h3>
                    <p style={{ marginTop: 0, color: '#64748b' }}>{selected.patients?.affected_zone} · {selected.patients?.age_range || 'Edad no indicada'}</p>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Cédula: {selected.patients?.cedula || '—'} · Tel. (solo seguimiento): {selected.patients?.phone_whatsapp || '—'}</p>
                    <div className="tag-row" style={{ marginTop: 8 }}>{selected.patients?.needs_tags?.map(t => <span key={t} className="tag">{t}</span>)}</div>
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
                  <button className="btn btn-primary btn-full" onClick={() => closeConsultation('closed')}>Cerrar consulta</button>
                  <button className="btn btn-outline btn-full" onClick={() => closeConsultation('patient_no_show')}>Paciente no estaba en la sala de espera</button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}

function ConsultationCard({ c, onOpen }: { c: Consultation; onOpen: () => void }) {
  return (
    <div className="card-flat">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <div>
          <strong>{c.patients?.full_name || 'Paciente'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>{c.patients?.affected_zone} · hace {minutesSince(c.created_at)} min</div>
          <div style={{ marginTop: 4 }}>
            {isPatientPresent(c)
              ? <span className="badge badge-green">● En sala</span>
              : <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>○ Sin conexión</span>}
          </div>
        </div>
        <span className={`badge ${c.status === 'urgent_in_person' ? 'badge-red' : c.status === 'referred_to_specialist' ? 'badge-blue' : 'badge-green'}`}>{STATUS_LABELS[c.status] || c.status}</span>
      </div>
      <p>{c.chief_complaint || c.patients?.description || 'Sin descripción'}</p>
      {c.referred_specialty && <p><span className="badge badge-blue">{c.referred_specialty}</span></p>}
      <div className="tag-row" style={{ marginBottom: 12 }}>{c.patients?.needs_tags?.slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}</div>
      <button className="btn btn-primary btn-full" onClick={onOpen}>Atender</button>
    </div>
  )
}
