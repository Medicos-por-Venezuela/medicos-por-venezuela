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
  medical_license: string | null
  country: string | null
  whatsapp_number: string | null
  verified: boolean
  active: boolean
  last_seen_at: string | null
  created_at: string
}

type Patient = {
  full_name: string
  cedula: string | null
  phone_whatsapp: string | null
  affected_zone: string | null
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
}

type Consultation = {
  id: string
  patient_id: string
  code: string
  status: string
  priority: string
  category: string | null
  chief_complaint: string | null
  referred_specialty: string | null
  internal_note: string | null
  assigned_doctor_id: string | null
  created_at: string
  opened_at: string | null
  closed_at: string | null
  patients: Patient | null
}

const STATUS_OPTIONS = [
  'waiting',
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'closed',
  'cancelled',
  'patient_no_show'
]
const ROLE_OPTIONS = ['all', 'doctor', 'specialist', 'admin', 'super_admin', 'patient']

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

  // Which section is shown: patients/cases vs doctors/admins.
  const [tab, setTab] = useState<'casos' | 'medicos'>('casos')

  // Case oversight panel state
  const [selected, setSelected] = useState<Consultation | null>(null)
  const [caseStatus, setCaseStatus] = useState('')
  const [caseDoctor, setCaseDoctor] = useState('')
  const [caseNote, setCaseNote] = useState('')
  // Super-admin-only: delete a patient and all their cases (confirmation gated). The target can be
  // set from the manage panel or from a row's trash button, so it's its own piece of state.
  const [deleteTarget, setDeleteTarget] = useState<Consultation | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/admin')
      return
    }

    const { data: me, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionData.session.user.id)
      .single()
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
      supabase
        .from('consultations')
        .select(
          '*, patients(full_name, cedula, phone_whatsapp, affected_zone, age_range, needs_tags, description)'
        )
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('patients').select('id', { count: 'exact', head: true })
    ])

    if (profilesRes.data) setProfiles(profilesRes.data as Profile[])
    if (consultationsRes.data) setConsultations(consultationsRes.data as Consultation[])
    setPatientsCount(patientsRes.count || 0)
  }

  const now = Date.now()
  const isSuperAdmin = profile?.role === 'super_admin'
  const isOnline = (lastSeen: string | null) =>
    !!lastSeen && now - new Date(lastSeen).getTime() < 3 * 60 * 1000
  const doctors = profiles.filter((p) => ['doctor', 'specialist'].includes(p.role))
  const activeDoctors = doctors.filter((d) => d.active)
  const onlineDoctors = doctors.filter((d) => isOnline(d.last_seen_at))
  const waiting = consultations.filter((c) => c.status === 'waiting')
  const open = consultations.filter((c) => c.status === 'in_progress')
  const closed = consultations.filter((c) => c.status === 'closed')
  const referred = consultations.filter((c) => c.status === 'referred_to_specialist')
  const urgent = consultations.filter((c) => c.status === 'urgent_in_person')

  const bySpecialty = useMemo(() => {
    const counts: Record<string, number> = {}
    referred.forEach((c) => {
      const key = c.referred_specialty || 'Sin especialidad'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
  }, [referred])

  const doctorName = (id: string | null) =>
    doctors.find((d) => d.id === id)?.full_name || (id ? 'Médico' : 'Sin asignar')

  const filteredProfiles = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return profiles.filter((p) => {
      if (userRole !== 'all' && p.role !== userRole) return false
      if (userState === 'active' && !p.active) return false
      if (userState === 'revoked' && p.active) return false
      if (!inDateRange(p.created_at, userFrom, userTo)) return false
      if (q && !`${p.full_name} ${p.email} ${p.specialty || ''}`.toLowerCase().includes(q))
        return false
      return true
    })
  }, [profiles, userSearch, userRole, userState, userFrom, userTo])

  const filteredConsultations = useMemo(() => {
    const q = caseSearch.trim().toLowerCase()
    return consultations.filter((c) => {
      if (caseStatusFilter !== 'all' && c.status !== caseStatusFilter) return false
      if (!inDateRange(c.created_at, caseFrom, caseTo)) return false
      if (
        q &&
        !`${c.patients?.full_name || ''} ${c.code} ${c.patients?.affected_zone || ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
  }, [consultations, caseSearch, caseStatusFilter, caseFrom, caseTo])

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
    if (caseStatus === 'closed' || caseStatus === 'patient_no_show')
      update.closed_at = new Date().toISOString()
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

  async function deletePatient() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.rpc('admin_delete_patient', {
      p_patient_id: deleteTarget.patient_id
    })
    setDeleting(false)
    if (error) {
      console.error(error)
      setMessage('No se pudo eliminar el paciente.')
      setDeleteTarget(null)
      return
    }
    setMessage('Paciente y todos sus casos fueron eliminados.')
    if (selected?.id === deleteTarget.id) setSelected(null)
    setDeleteTarget(null)
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

  if (loading)
    return (
      <main className="page">
        <div className="container">
          <div className="card">Cargando...</div>
        </div>
      </main>
    )

  return (
    <>
      <Head>
        <title>Dashboard admin — Médicos por Venezuela</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="page">
        <div className="container">
          <div className="topbar">
            <div>
              <h1 style={{ margin: 0 }}>Dashboard administrativo</h1>
              <p style={{ margin: 0, color: '#64748b' }}>{profile?.full_name} · administrador</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => router.push('/panel-medico')}>
                Panel médico
              </button>
              <button className="btn btn-muted" onClick={logout}>
                Salir
              </button>
            </div>
          </div>

          {message && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

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

          {urgent.length > 0 && (
            <div className="notice notice-danger" style={{ marginBottom: 18 }}>
              <strong>{urgent.length}</strong> consultas marcadas como urgentes/presenciales.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <button
              className={`btn ${tab === 'casos' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTab('casos')}
            >
              Pacientes / Casos
            </button>
            <button
              className={`btn ${tab === 'medicos' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTab('medicos')}
            >
              Médicos y administradores
            </button>
          </div>

          {tab === 'casos' && (
            <>
              <div className="grid grid-2" style={{ marginBottom: 18 }}>
                <section className="card">
                  <h2 style={{ marginTop: 0 }}>Gestionar caso</h2>
                  {!selected ? (
                    <p style={{ color: '#64748b' }}>
                      Selecciona una consulta de la lista para reasignar el médico, cambiar el estado
                      o editar la nota.
                    </p>
                  ) : (
                    <div className="grid">
                      <div>
                        <h3 style={{ marginBottom: 4 }}>
                          {selected.patients?.full_name || 'Paciente'}
                        </h3>
                        <p style={{ marginTop: 0, color: '#64748b' }}>
                          {selected.code} · {selected.patients?.affected_zone || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="label">Médico asignado</label>
                        <select value={caseDoctor} onChange={(e) => setCaseDoctor(e.target.value)}>
                          <option value="">Sin asignar</option>
                          {activeDoctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.full_name} ({d.specialty || d.role})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Estado</label>
                        <select value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)}>
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s] || s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Nota interna</label>
                        <textarea
                          rows={4}
                          value={caseNote}
                          onChange={(e) => setCaseNote(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-2">
                        <button className="btn btn-primary" onClick={saveCase}>
                          Guardar cambios
                        </button>
                        <button className="btn btn-muted" onClick={() => setSelected(null)}>
                          Cancelar
                        </button>
                      </div>
                      {isSuperAdmin && (
                        <button
                          className="btn btn-full"
                          style={{ background: '#dc2626', color: '#fff' }}
                          onClick={() => setDeleteTarget(selected)}
                        >
                          Eliminar paciente y todos sus casos
                        </button>
                      )}
                    </div>
                  )}
                </section>

                <section className="card">
                  <h2 style={{ marginTop: 0 }}>Derivaciones por especialidad</h2>
                  {bySpecialty.length === 0 ? (
                    <p style={{ color: '#64748b' }}>No hay derivaciones pendientes.</p>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Especialidad</th>
                          <th>Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySpecialty.map(([s, count]) => (
                          <tr key={s}>
                            <td>{s}</td>
                            <td>{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>
                    Especialidades disponibles para derivar: {SPECIALTIES.length}.
                  </p>
                </section>
              </div>

              <section className="card">
                <h2 style={{ marginTop: 0 }}>
                  Pacientes / Casos{' '}
                  <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
                    ({filteredConsultations.length} de {consultations.length})
                  </span>
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <input
                    style={{ flex: '1 1 160px' }}
                    placeholder="Buscar paciente, código o zona"
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                  />
                  <select
                    style={{ flex: '0 1 160px' }}
                    value={caseStatusFilter}
                    onChange={(e) => setCaseStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos los estados</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s] || s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    style={{ flex: '0 1 140px' }}
                    value={caseFrom}
                    onChange={(e) => setCaseFrom(e.target.value)}
                    title="Creada desde"
                  />
                  <input
                    type="date"
                    style={{ flex: '0 1 140px' }}
                    value={caseTo}
                    onChange={(e) => setCaseTo(e.target.value)}
                    title="Creada hasta"
                  />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>Necesidad / motivo</th>
                        <th>Estado</th>
                        <th>Médico</th>
                        <th>Fechas</th>
                        <th>Nota interna</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConsultations.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ color: '#64748b' }}>
                            No hay consultas que coincidan con el filtro.
                          </td>
                        </tr>
                      ) : (
                        filteredConsultations.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <strong>{c.patients?.full_name || 'Paciente'}</strong>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{c.code}</div>
                              <Line label="Cédula" value={c.patients?.cedula} />
                              <Line label="Tel" value={c.patients?.phone_whatsapp} />
                              <Line label="Zona" value={c.patients?.affected_zone} />
                              <Line label="Edad" value={c.patients?.age_range} />
                            </td>
                            <td>
                              <Line
                                label="Necesidades"
                                value={c.patients?.needs_tags?.join(', ') || null}
                              />
                              <Line label="Categoría" value={c.category} />
                              <Line label="Motivo" value={c.chief_complaint} />
                              <Line label="Descripción" value={c.patients?.description} />
                            </td>
                            <td>
                              {STATUS_LABELS[c.status] || c.status}
                              <Line label="Prioridad" value={c.priority} />
                              <Line label="Derivado a" value={c.referred_specialty} />
                            </td>
                            <td>{doctorName(c.assigned_doctor_id)}</td>
                            <td>
                              <Line label="Creada" value={fmtDate(c.created_at)} />
                              {c.opened_at && <Line label="Abierta" value={fmtDate(c.opened_at)} />}
                              {c.closed_at && <Line label="Cerrada" value={fmtDate(c.closed_at)} />}
                            </td>
                            <td>{c.internal_note || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => selectCase(c)}
                                >
                                  Gestionar
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    className="btn"
                                    title="Eliminar paciente y todos sus casos"
                                    aria-label="Eliminar paciente"
                                    style={{
                                      background: '#fee2e2',
                                      color: '#dc2626',
                                      padding: '8px 12px'
                                    }}
                                    onClick={() => setDeleteTarget(c)}
                                  >
                                    🗑
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {tab === 'medicos' && (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>
                Médicos y administradores{' '}
                <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
                  ({filteredProfiles.length} de {profiles.length})
                </span>
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <input
                  style={{ flex: '1 1 160px' }}
                  placeholder="Buscar nombre o email"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <select
                  style={{ flex: '0 1 130px' }}
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === 'all' ? 'Todos los roles' : r}
                    </option>
                  ))}
                </select>
                <select
                  style={{ flex: '0 1 130px' }}
                  value={userState}
                  onChange={(e) => setUserState(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="revoked">Revocados</option>
                </select>
                <input
                  type="date"
                  style={{ flex: '0 1 140px' }}
                  value={userFrom}
                  onChange={(e) => setUserFrom(e.target.value)}
                  title="Registrado desde"
                />
                <input
                  type="date"
                  style={{ flex: '0 1 140px' }}
                  value={userTo}
                  onChange={(e) => setUserTo(e.target.value)}
                  title="Registrado hasta"
                />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Registrado</th>
                      <th>Online</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: '#64748b' }}>
                          No hay usuarios que coincidan con el filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredProfiles.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.full_name}</strong>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{p.email}</div>
                            <Line label="Especialidad" value={p.specialty} />
                            <Line label="País" value={p.country} />
                            <Line label="WhatsApp" value={p.whatsapp_number} />
                            <Line label="Licencia" value={p.medical_license} />
                          </td>
                          <td>{p.role}</td>
                          <td>
                            {p.active ? (
                              <span className="badge badge-green">Activo</span>
                            ) : (
                              <span className="badge badge-red">Revocado</span>
                            )}
                            <div style={{ marginTop: 4 }}>
                              {p.verified ? (
                                <span className="badge badge-green">Verificado</span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{ background: '#e2e8f0', color: '#64748b' }}
                                >
                                  No verificado
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{fmtDate(p.created_at)}</td>
                          <td>{isOnline(p.last_seen_at) ? 'Sí' : 'No'}</td>
                          <td>
                            {['admin', 'super_admin'].includes(p.role) ? (
                              <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                            ) : (
                              <button
                                className="btn btn-muted"
                                onClick={() => toggleDoctor(p.id, p.active)}
                              >
                                {p.active ? 'Revocar acceso' : 'Reactivar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          onClick={() => !deleting && setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, width: '100%' }}
          >
            <h2 id="delete-title" style={{ marginTop: 0 }}>
              Eliminar paciente
            </h2>
            <p>
              Vas a eliminar a{' '}
              <strong>{deleteTarget.patients?.full_name || 'este paciente'}</strong> y{' '}
              <strong>todos sus casos y registros</strong>.
            </p>
            <p style={{ color: '#dc2626', fontWeight: 700 }}>Esta acción no se puede deshacer.</p>
            <div className="grid grid-2" style={{ marginTop: 8 }}>
              <button
                className="btn btn-full"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={deletePatient}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
              <button
                className="btn btn-muted"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Line({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ fontSize: 12, color: '#64748b' }}>
      <span style={{ color: '#94a3b8' }}>{label}:</span> {value}
    </div>
  )
}

function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div className="kpi">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}
