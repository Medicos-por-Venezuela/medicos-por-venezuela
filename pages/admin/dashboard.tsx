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
  created_at: string
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
const ROLE_OPTIONS = ['all', 'doctor', 'specialist', 'admin', 'super_admin', 'patient']
const PAGE_SIZE = 5

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('es-VE') : '—')

// True if an ISO timestamp falls within an inclusive [from, to] date range (either bound optional).
// `from`/`to` come from <input type="date"> as 'YYYY-MM-DD'.
function inDateRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime()
  if (from && t < new Date(from + 'T00:00:00').getTime()) return false
  if (to && t > new Date(to + 'T23:59:59.999').getTime()) return false
  return true
}

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

  // Users (doctors/admins) table filters
  const [userSearch, setUserSearch] = useState('')
  const [userRole, setUserRole] = useState('all')
  const [userState, setUserState] = useState('all') // all | active | revoked
  const [userFrom, setUserFrom] = useState('')
  const [userTo, setUserTo] = useState('')

  // Consultations table filters
  const [caseSearch, setCaseSearch] = useState('')
  const [caseStatusFilter, setCaseStatusFilter] = useState('all')
  const [caseFrom, setCaseFrom] = useState('')
  const [caseTo, setCaseTo] = useState('')

  const [userPage, setUserPage] = useState(1)
  const [casePage, setCasePage] = useState(1)

  useEffect(() => { init() }, [])
  useEffect(() => { setUserPage(1) }, [userSearch, userRole, userState, userFrom, userTo])
  useEffect(() => { setCasePage(1) }, [caseSearch, caseStatusFilter, caseFrom, caseTo])

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

  const filteredProfiles = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return profiles.filter(p => {
      if (userRole !== 'all' && p.role !== userRole) return false
      if (userState === 'active' && !p.active) return false
      if (userState === 'revoked' && p.active) return false
      if (!inDateRange(p.created_at, userFrom, userTo)) return false
      if (q && !`${p.full_name} ${p.email} ${p.specialty || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [profiles, userSearch, userRole, userState, userFrom, userTo])

  const filteredConsultations = useMemo(() => {
    const q = caseSearch.trim().toLowerCase()
    return consultations.filter(c => {
      if (caseStatusFilter !== 'all' && c.status !== caseStatusFilter) return false
      if (!inDateRange(c.created_at, caseFrom, caseTo)) return false
      if (q && !`${c.patients?.full_name || ''} ${c.code} ${c.patients?.affected_zone || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [consultations, caseSearch, caseStatusFilter, caseFrom, caseTo])

  const userTotalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE))
  const caseTotalPages = Math.max(1, Math.ceil(filteredConsultations.length / PAGE_SIZE))
  const safeUserPage = Math.min(userPage, userTotalPages)
  const safeCasePage = Math.min(casePage, caseTotalPages)
  const paginatedProfiles = filteredProfiles.slice((safeUserPage - 1) * PAGE_SIZE, safeUserPage * PAGE_SIZE)
  const paginatedConsultations = filteredConsultations.slice((safeCasePage - 1) * PAGE_SIZE, safeCasePage * PAGE_SIZE)

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
                <div className="admin-table-wrap">
                  <table className="table admin-responsive-table">
                    <thead><tr><th>Especialidad</th><th>Cantidad</th></tr></thead>
                    <tbody>{bySpecialty.map(([s, count]) => <tr key={s}><td data-label="Especialidad">{s}</td><td data-label="Cantidad">{count}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Especialidades disponibles para derivar: {SPECIALTIES.length}.</p>
            </section>
          </div>

          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <section className="card">
              <h2 style={{ marginTop: 0 }}>Médicos y administradores <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>({filteredProfiles.length} de {profiles.length})</span></h2>
              <div className="admin-filters">
                <input placeholder="Buscar nombre o email" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                <select value={userRole} onChange={e => setUserRole(e.target.value)}>
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r === 'all' ? 'Todos los roles' : r}</option>)}
                </select>
                <select value={userState} onChange={e => setUserState(e.target.value)}>
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="revoked">Revocados</option>
                </select>
                <input type="date" value={userFrom} onChange={e => setUserFrom(e.target.value)} title="Registrado desde" />
                <input type="date" value={userTo} onChange={e => setUserTo(e.target.value)} title="Registrado hasta" />
              </div>
              <div className="admin-table-wrap">
                <table className="table admin-responsive-table">
                  <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Registrado</th><th>Online</th><th></th></tr></thead>
                  <tbody>
                    {filteredProfiles.length === 0 ? (
                      <tr><td colSpan={6} style={{ color: '#64748b' }}>No hay usuarios que coincidan con el filtro.</td></tr>
                    ) : paginatedProfiles.map(p => (
                      <tr key={p.id}>
                        <td data-label="Usuario"><strong>{p.full_name}</strong><br /><span style={{ color: '#64748b' }}>{p.email}</span><br />{p.specialty || ''}</td>
                        <td data-label="Rol">{p.role}</td>
                        <td data-label="Estado">{p.active ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Revocado</span>}</td>
                        <td data-label="Registrado">{fmtDate(p.created_at)}</td>
                        <td data-label="Online">{p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 3 * 60 * 1000 ? 'Sí' : 'No'}</td>
                        <td data-label="Acciones">
                          {['admin', 'super_admin'].includes(p.role)
                            ? <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                            : <button className="btn btn-muted" onClick={() => toggleDoctor(p.id, p.active)}>{p.active ? 'Revocar acceso' : 'Reactivar'}</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={safeUserPage}
                totalPages={userTotalPages}
                totalItems={filteredProfiles.length}
                pageSize={PAGE_SIZE}
                onPageChange={setUserPage}
              />
            </section>

            <section className="card">
              <h2 style={{ marginTop: 0 }}>Consultas recientes <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>({filteredConsultations.length} de {consultations.length})</span></h2>
              <div className="admin-filters">
                <input placeholder="Buscar paciente, código o zona" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} />
                <select value={caseStatusFilter} onChange={e => setCaseStatusFilter(e.target.value)}>
                  <option value="all">Todos los estados</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                </select>
                <input type="date" value={caseFrom} onChange={e => setCaseFrom(e.target.value)} title="Creada desde" />
                <input type="date" value={caseTo} onChange={e => setCaseTo(e.target.value)} title="Creada hasta" />
              </div>
              <div className="admin-table-wrap">
                <table className="table admin-responsive-table">
                  <thead><tr><th>Paciente</th><th>Estado</th><th>Médico</th><th>Creada</th><th></th></tr></thead>
                  <tbody>
                    {filteredConsultations.length === 0 ? (
                      <tr><td colSpan={5} style={{ color: '#64748b' }}>No hay consultas que coincidan con el filtro.</td></tr>
                    ) : paginatedConsultations.map(c => (
                      <tr key={c.id}>
                        <td data-label="Paciente">{c.patients?.full_name || 'Paciente'}<br /><span style={{ color: '#64748b' }}>{c.code}</span></td>
                        <td data-label="Estado">{STATUS_LABELS[c.status] || c.status}</td>
                        <td data-label="Médico">{doctorName(c.assigned_doctor_id)}</td>
                        <td data-label="Creada">{fmtDate(c.created_at)}</td>
                        <td data-label="Acciones">
                          <div className="admin-row-actions">
                            <button className="btn btn-secondary" onClick={() => router.push(`/panel-medico/consulta/${c.id}`)}>Gestionar</button>
                            <button className="btn btn-muted" onClick={() => selectCase(c)}>Editar rápido</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={safeCasePage}
                totalPages={caseTotalPages}
                totalItems={filteredConsultations.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCasePage}
              />
            </section>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .admin-filters {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }

        .admin-table-wrap {
          width: 100%;
        }

        .admin-responsive-table thead {
          display: none;
        }

        .admin-responsive-table,
        .admin-responsive-table tbody,
        .admin-responsive-table tr,
        .admin-responsive-table td {
          display: block;
          width: 100%;
        }

        .admin-responsive-table tr {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px;
          margin-bottom: 12px;
          background: var(--white);
        }

        .admin-responsive-table td {
          border-bottom: 0;
          padding: 8px 0;
        }

        .admin-responsive-table td::before {
          content: attr(data-label);
          display: block;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 2px;
        }

        .admin-responsive-table td[colspan]::before {
          content: none;
        }

        .admin-row-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .admin-pagination {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-top: 12px;
          color: var(--muted);
          font-size: 13px;
        }

        .admin-pagination-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        @media (min-width: 640px) {
          .admin-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .admin-pagination {
            grid-template-columns: 1fr auto;
            align-items: center;
          }

          .admin-pagination-actions {
            display: flex;
            justify-content: flex-end;
          }
        }

        @media (min-width: 900px) {
          .admin-filters {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .admin-row-actions {
            display: flex;
            flex-wrap: wrap;
          }

          .admin-table-wrap {
            overflow-x: auto;
          }

          .admin-responsive-table {
            display: table;
          }

          .admin-responsive-table thead {
            display: table-header-group;
          }

          .admin-responsive-table tbody {
            display: table-row-group;
          }

          .admin-responsive-table tr {
            display: table-row;
            border: 0;
            border-radius: 0;
            padding: 0;
            margin-bottom: 0;
            background: transparent;
          }

          .admin-responsive-table td {
            display: table-cell;
            width: auto;
            border-bottom: 1px solid var(--border);
            padding: 10px 8px;
          }

          .admin-responsive-table td::before {
            content: none;
          }
        }
      `}</style>
    </>
  )
}

function Kpi({ value, label }: { value: number; label: string }) {
  return <div className="kpi"><div className="kpi-value">{value}</div><div className="kpi-label">{label}</div></div>
}

function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  if (totalItems === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="admin-pagination">
      <span>Mostrando {from}-{to} de {totalItems}</span>
      <div className="admin-pagination-actions">
        <button className="btn btn-muted" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button>
        <button className="btn btn-muted" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Siguiente</button>
      </div>
    </div>
  )
}
