import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SPECIALTIES, STATUS_LABELS } from '../../lib/utils'

type Profile = {
  id: string
  email: string
  full_name: string
  role: string
  specialty: string | null
  verified: boolean
  active: boolean
  last_seen_at: string | null
}

type Consultation = {
  id: string
  code: string
  status: string
  priority: string
  category: string | null
  referred_specialty: string | null
  internal_note: string | null
  assigned_doctor_id: string | null
  created_at: string
  patients: { full_name: string; affected_zone: string; needs_tags: string[] | null } | null
}

const STATUS_OPTIONS = ['waiting', 'in_progress', 'referred_to_specialist', 'urgent_in_person', 'closed', 'cancelled', 'patient_no_show']

export default function AdminDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [patientsCount, setPatientsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Case oversight panel state
  const [selected, setSelected] = useState<Consultation | null>(null)
  const [caseStatus, setCaseStatus] = useState('')
  const [caseDoctor, setCaseDoctor] = useState('')
  const [caseNote, setCaseNote] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/admin')
      return
    }

    const { data: me, error } = await supabase.from('profiles').select('*').eq('id', sessionData.session.user.id).single()
    if (error || !me || !me.active || !['admin', 'super_admin'].includes(me.role)) {
      await supabase.auth.signOut()
      router.push('/admin')
      return
    }
    setProfile(me)
    await loadAll()
    setLoading(false)
  }

  async function loadAll() {
    const [profilesRes, consultationsRes, patientsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('consultations').select('*, patients(full_name, affected_zone, needs_tags)').order('created_at', { ascending: false }).limit(200),
      supabase.from('patients').select('id', { count: 'exact', head: true })
    ])

    if (profilesRes.data) setProfiles(profilesRes.data as Profile[])
    if (consultationsRes.data) setConsultations(consultationsRes.data as Consultation[])
    setPatientsCount(patientsRes.count || 0)
  }

  const now = Date.now()
  const doctors = profiles.filter(p => ['doctor', 'specialist'].includes(p.role))
  const activeDoctors = doctors.filter(d => d.active)
  const onlineDoctors = doctors.filter(d => d.last_seen_at && now - new Date(d.last_seen_at).getTime() < 3 * 60 * 1000)
  const waiting = consultations.filter(c => c.status === 'waiting')
  const open = consultations.filter(c => c.status === 'in_progress')
  const closed = consultations.filter(c => c.status === 'closed')
  const referred = consultations.filter(c => c.status === 'referred_to_specialist')
  const urgent = consultations.filter(c => c.status === 'urgent_in_person')

  const bySpecialty = useMemo(() => {
    const counts: Record<string, number> = {}
    referred.forEach(c => {
      const key = c.referred_specialty || 'Sin especialidad'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
  }, [referred])

  const doctorName = (id: string | null) => doctors.find(d => d.id === id)?.full_name || (id ? 'Médico' : 'Sin asignar')

  function selectCase(c: Consultation) {
    setSelected(c)
    setCaseStatus(c.status)
    setCaseDoctor(c.assigned_doctor_id || '')
    setCaseNote(c.internal_note || '')
    setMessage('')
  }

  async function saveCase() {
    if (!selected) return
    const update: Record<string, unknown> = {
      status: caseStatus,
      assigned_doctor_id: caseDoctor || null,
      internal_note: caseNote
    }
    if (caseStatus === 'closed' || caseStatus === 'patient_no_show') update.closed_at = new Date().toISOString()
    if (caseStatus === 'in_progress' && !selected.assigned_doctor_id && !caseDoctor) {
      setMessage('Asigna un médico para poner el caso en progreso.')
      return
    }

    const { error } = await supabase.from('consultations').update(update).eq('id', selected.id)
    if (error) {
      console.error(error)
      setMessage('No se pudo actualizar el caso.')
      return
    }
    await supabase.from('consultation_events').insert({
      consultation_id: selected.id,
      event_type: 'admin_update',
      note: `Estado: ${STATUS_LABELS[caseStatus] || caseStatus}; médico: ${doctorName(caseDoctor || null)}`
    })
    setMessage('Caso actualizado.')
    setSelected(null)
    await loadAll()
  }

  async function toggleDoctor(id: string, active: boolean) {
    const { error } = await supabase.from('profiles').update({ active: !active }).eq('id', id)
    if (error) setMessage('No se pudo actualizar el usuario.')
    else await loadAll()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <main className="page"><div className="container"><div className="card">Cargando...</div></div></main>

  return (
    <>
      <Head><title>Dashboard admin — Médicos por Venezuela</title><meta name="robots" content="noindex" /></Head>
      <main className="page">
        <div className="container">
          <div className="topbar">
            <div>
              <h1 style={{ margin: 0 }}>Dashboard administrativo</h1>
              <p style={{ margin: 0, color: '#64748b' }}>{profile?.full_name} · administrador</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => router.push('/panel-medico')}>Panel médico</button>
              <button className="btn btn-muted" onClick={logout}>Salir</button>
            </div>
          </div>

          {message && <div className="notice notice-info" style={{ marginBottom: 16 }}>{message}</div>}

          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <Kpi value={doctors.length} label="Médicos registrados" />
            <Kpi value={onlineDoctors.length} label="Médicos online" />
            <Kpi value={patientsCount} label="Pacientes registrados" />
            <Kpi value={consultations.length} label="Consultas totales recientes" />
            <Kpi value={waiting.length} label="Consultas esperando" />
            <Kpi value={open.length} label="Consultas abiertas" />
            <Kpi value={closed.length} label="Consultas cerradas" />
            <Kpi value={referred.length} label="Derivadas a especialista" />
          </div>

          {urgent.length > 0 && <div className="notice notice-danger" style={{ marginBottom: 18 }}><strong>{urgent.length}</strong> consultas marcadas como urgentes/presenciales.</div>}

          <div className="grid grid-2">
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Gestionar caso</h2>
              {!selected ? (
                <p style={{ color: '#64748b' }}>Selecciona una consulta de la lista para reasignar el médico, cambiar el estado o editar la nota.</p>
              ) : (
                <div className="grid">
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{selected.patients?.full_name || 'Paciente'}</h3>
                    <p style={{ marginTop: 0, color: '#64748b' }}>{selected.code} · {selected.patients?.affected_zone || '-'}</p>
                  </div>
                  <div>
                    <label className="label">Médico asignado</label>
                    <select value={caseDoctor} onChange={e => setCaseDoctor(e.target.value)}>
                      <option value="">Sin asignar</option>
                      {activeDoctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.specialty || d.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Estado</label>
                    <select value={caseStatus} onChange={e => setCaseStatus(e.target.value)}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Nota interna</label>
                    <textarea rows={4} value={caseNote} onChange={e => setCaseNote(e.target.value)} />
                  </div>
                  <div className="grid grid-2">
                    <button className="btn btn-primary" onClick={saveCase}>Guardar cambios</button>
                    <button className="btn btn-muted" onClick={() => setSelected(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Derivaciones por especialidad</h2>
              {bySpecialty.length === 0 ? <p style={{ color: '#64748b' }}>No hay derivaciones pendientes.</p> : (
                <table className="table">
                  <thead><tr><th>Especialidad</th><th>Cantidad</th></tr></thead>
                  <tbody>{bySpecialty.map(([s, count]) => <tr key={s}><td>{s}</td><td>{count}</td></tr>)}</tbody>
                </table>
              )}
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Especialidades disponibles para derivar: {SPECIALTIES.length}.</p>
            </section>
          </div>

          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Médicos y administradores</h2>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Online</th><th></th></tr></thead>
                  <tbody>
                    {profiles.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.full_name}</strong><br /><span style={{ color: '#64748b' }}>{p.email}</span><br />{p.specialty || ''}</td>
                        <td>{p.role}</td>
                        <td>{p.active ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Revocado</span>}</td>
                        <td>{p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 3 * 60 * 1000 ? 'Sí' : 'No'}</td>
                        <td>
                          {['admin', 'super_admin'].includes(p.role)
                            ? <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                            : <button className="btn btn-muted" onClick={() => toggleDoctor(p.id, p.active)}>{p.active ? 'Revocar acceso' : 'Reactivar'}</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Consultas recientes</h2>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Paciente</th><th>Estado</th><th>Médico</th><th></th></tr></thead>
                  <tbody>
                    {consultations.map(c => (
                      <tr key={c.id}>
                        <td>{c.patients?.full_name || 'Paciente'}<br /><span style={{ color: '#64748b' }}>{c.code}</span></td>
                        <td>{STATUS_LABELS[c.status] || c.status}</td>
                        <td>{doctorName(c.assigned_doctor_id)}</td>
                        <td><button className="btn btn-secondary" onClick={() => selectCase(c)}>Gestionar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}

function Kpi({ value, label }: { value: number; label: string }) {
  return <div className="kpi"><div className="kpi-value">{value}</div><div className="kpi-label">{label}</div></div>
}
