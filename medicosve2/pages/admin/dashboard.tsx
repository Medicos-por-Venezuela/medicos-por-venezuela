import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { STATUS_LABELS } from '../../lib/utils'

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

type Application = {
  id: string
  full_name: string
  email: string
  specialty: string
  country: string
  whatsapp_number: string
  medical_license: string | null
  availability: string | null
  status: string
  created_at: string
}

type Consultation = {
  id: string
  code: string
  status: string
  priority: string
  category: string | null
  referred_specialty: string | null
  created_at: string
  patients: { full_name: string; affected_zone: string; needs_tags: string[] | null } | null
}

export default function AdminDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [patientsCount, setPatientsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login-medico')
      return
    }

    const { data: me, error } = await supabase.from('profiles').select('*').single()
    if (error || !me || !['admin', 'super_admin'].includes(me.role)) {
      router.push('/panel-medico')
      return
    }
    setProfile(me)
    await loadAll()
    setLoading(false)
  }

  async function loadAll() {
    const [profilesRes, applicationsRes, consultationsRes, patientsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('doctor_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('consultations').select('*, patients(full_name, affected_zone, needs_tags)').order('created_at', { ascending: false }).limit(200),
      supabase.from('patients').select('id', { count: 'exact', head: true })
    ])

    if (profilesRes.data) setProfiles(profilesRes.data as Profile[])
    if (applicationsRes.data) setApplications(applicationsRes.data as Application[])
    if (consultationsRes.data) setConsultations(consultationsRes.data as Consultation[])
    setPatientsCount(patientsRes.count || 0)
  }

  const now = Date.now()
  const doctors = profiles.filter(p => ['doctor', 'specialist'].includes(p.role))
  const onlineDoctors = doctors.filter(d => d.last_seen_at && now - new Date(d.last_seen_at).getTime() < 3 * 60 * 1000)
  const waiting = consultations.filter(c => c.status === 'waiting')
  const open = consultations.filter(c => c.status === 'in_progress')
  const closed = consultations.filter(c => c.status === 'closed')
  const referred = consultations.filter(c => c.status === 'referred_to_specialist')
  const urgent = consultations.filter(c => c.status === 'urgent_in_person')
  const pendingApps = applications.filter(a => a.status === 'pending')

  const bySpecialty = useMemo(() => {
    const counts: Record<string, number> = {}
    referred.forEach(c => {
      const key = c.referred_specialty || 'Sin especialidad'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
  }, [referred])

  async function updateApplicationStatus(id: string, status: string) {
    const { error } = await supabase.from('doctor_applications').update({ status }).eq('id', id)
    if (error) setMessage('No se pudo actualizar la solicitud.')
    else {
      setMessage('Solicitud actualizada.')
      await loadAll()
    }
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
      <Head><title>Dashboard admin — Médicos por Venezuela</title></Head>
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
              <h2 style={{ marginTop: 0 }}>Solicitudes de médicos</h2>
              {pendingApps.length === 0 ? <p style={{ color: '#64748b' }}>No hay solicitudes pendientes.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>Nombre</th><th>Especialidad</th><th>Contacto</th><th>Acción</th></tr></thead>
                    <tbody>
                      {pendingApps.map(a => (
                        <tr key={a.id}>
                          <td><strong>{a.full_name}</strong><br /><span style={{ color: '#64748b' }}>{a.country}</span><br />Lic.: {a.medical_license || 'No indicada'}</td>
                          <td>{a.specialty}<br /><span style={{ color: '#64748b' }}>{a.availability || ''}</span></td>
                          <td>{a.email}<br />{a.whatsapp_number}</td>
                          <td>
                            <div className="grid">
                              <button className="btn btn-secondary" onClick={() => updateApplicationStatus(a.id, 'approved')}>Marcar aprobada</button>
                              <button className="btn btn-muted" onClick={() => updateApplicationStatus(a.id, 'rejected')}>Rechazar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="notice notice-warning" style={{ marginTop: 14 }}>
                Al aprobar una solicitud, todavía debes crear el usuario en Supabase Auth y verificar su perfil. Mira la guía incluida en el ZIP.
              </div>
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Derivaciones por especialidad</h2>
              {bySpecialty.length === 0 ? <p style={{ color: '#64748b' }}>No hay derivaciones pendientes.</p> : (
                <table className="table">
                  <thead><tr><th>Especialidad</th><th>Cantidad</th></tr></thead>
                  <tbody>{bySpecialty.map(([s, count]) => <tr key={s}><td>{s}</td><td>{count}</td></tr>)}</tbody>
                </table>
              )}
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
                        <td>{p.verified ? <span className="badge badge-green">Verificado</span> : <span className="badge badge-orange">Pendiente</span>} {p.active ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
                        <td>{p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 3 * 60 * 1000 ? 'Sí' : 'No'}</td>
                        <td><button className="btn btn-muted" onClick={() => toggleDoctor(p.id, p.active)}>{p.active ? 'Desactivar' : 'Activar'}</button></td>
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
                  <thead><tr><th>Paciente</th><th>Estado</th><th>Tipo</th><th>Zona</th></tr></thead>
                  <tbody>
                    {consultations.map(c => (
                      <tr key={c.id}>
                        <td>{c.patients?.full_name || 'Paciente'}<br /><span style={{ color: '#64748b' }}>{c.code}</span></td>
                        <td>{STATUS_LABELS[c.status] || c.status}</td>
                        <td>{c.referred_specialty || c.category || c.patients?.needs_tags?.join(', ') || '-'}</td>
                        <td>{c.patients?.affected_zone || '-'}</td>
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
