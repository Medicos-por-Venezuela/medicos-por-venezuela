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
  email: string | null
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
  contacted: boolean
  patients: Patient | null
}

const STATUS_OPTIONS = [
  'waiting',
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'closed',
  'cancelled',
  'patient_no_show',
  'closed_by_admin'
]
const ROLE_OPTIONS = ['all', 'doctor', 'specialist', 'admin', 'super_admin']
// The "Médicos y administradores" table is staff-only — patients never appear there.
const STAFF_ROLES = ['doctor', 'specialist', 'admin', 'super_admin']
const USERS_PAGE_SIZE = 50

// Sortable columns of the cases table, with fixed widths so the table distributes space evenly
// (table-layout: fixed). The trailing "Acciones" column is not sortable.
const CASE_COLS: { key: string; label: string; width: string }[] = [
  { key: 'patient', label: 'Paciente', width: '17%' },
  { key: 'need', label: 'Necesidad / motivo', width: '17%' },
  { key: 'status', label: 'Estado', width: '10%' },
  { key: 'contacted', label: 'Contactado', width: '10%' },
  { key: 'doctor', label: 'Médico', width: '11%' },
  { key: 'dates', label: 'Fechas', width: '11%' },
  { key: 'note', label: 'Nota interna', width: '14%' }
]

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
  // Exact totals via count queries — the profiles/consultations arrays are capped (1000/200 rows),
  // so deriving KPI numbers from them undercounts. These come straight from the DB.
  const [counts, setCounts] = useState({
    doctors: 0,
    onlineDoctors: 0,
    consultations: 0,
    waiting: 0,
    open: 0,
    closed: 0,
    referred: 0,
    urgent: 0
  })
  // Specialties of the currently-online doctors, as [specialty, count] sorted desc.
  const [onlineBySpecialty, setOnlineBySpecialty] = useState<[string, number][]>([])
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
  // Per-row inline edits of the internal note in the cases table (keyed by consultation id).
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

  // Users (doctors/admins) table filters
  const [userSearch, setUserSearch] = useState('')
  const [userRole, setUserRole] = useState('all')
  const [userState, setUserState] = useState('all') // all | active | revoked
  const [userFrom, setUserFrom] = useState('')
  const [userTo, setUserTo] = useState('')
  // Server-side paginated staff list for the Médicos y administradores table (no 1000-row cap).
  const [usersRows, setUsersRows] = useState<Profile[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(0)
  const [usersLoading, setUsersLoading] = useState(false)
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('')

  // Consultations table filters
  const [caseSearch, setCaseSearch] = useState('')
  const [caseStatusFilter, setCaseStatusFilter] = useState('all')
  const [caseFrom, setCaseFrom] = useState('')
  const [caseTo, setCaseTo] = useState('')
  // Cases table sorting (defaults to newest-first, matching the query order).
  const [sortKey, setSortKey] = useState('dates')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    init()
  }, [])

  // Debounce the user search box so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearch), 300)
    return () => clearTimeout(t)
  }, [userSearch])

  // Any filter change resets to the first page.
  useEffect(() => {
    setUsersPage(0)
  }, [debouncedUserSearch, userRole, userState, userFrom, userTo])

  // (Re)load the current page of staff users when the profile is ready or filters/page change.
  useEffect(() => {
    if (profile) loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, debouncedUserSearch, userRole, userState, userFrom, userTo, usersPage])

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
    const staffRoles = ['doctor', 'specialist']
    const onlineThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const consCount = () =>
      supabase.from('consultations').select('id', { count: 'exact', head: true })
    const [
      profilesRes,
      consultationsRes,
      patientsRes,
      doctorsCnt,
      onlineDocsRes,
      totalConsCnt,
      waitingCnt,
      openCnt,
      closedCnt,
      referredCnt,
      urgentCnt
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase
        .from('consultations')
        .select(
          '*, patients(full_name, cedula, phone_whatsapp, email, affected_zone, age_range, needs_tags, description)'
        )
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('patients').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', staffRoles),
      supabase
        .from('profiles')
        .select('specialty')
        .in('role', staffRoles)
        .gte('last_seen_at', onlineThreshold),
      consCount(),
      consCount().eq('status', 'waiting'),
      consCount().eq('status', 'in_progress'),
      consCount().eq('status', 'closed'),
      consCount().eq('status', 'referred_to_specialist'),
      consCount().eq('status', 'urgent_in_person')
    ])

    if (profilesRes.data) setProfiles(profilesRes.data as Profile[])
    if (consultationsRes.data) setConsultations(consultationsRes.data as Consultation[])
    setPatientsCount(patientsRes.count || 0)
    setCounts({
      doctors: doctorsCnt.count || 0,
      onlineDoctors: onlineDocsRes.data?.length || 0,
      consultations: totalConsCnt.count || 0,
      waiting: waitingCnt.count || 0,
      open: openCnt.count || 0,
      closed: closedCnt.count || 0,
      referred: referredCnt.count || 0,
      urgent: urgentCnt.count || 0
    })

    // Group the online doctors by specialty for the "connected specialties" list.
    const bySpec: Record<string, number> = {}
    const onlineDocs = (onlineDocsRes.data || []) as { specialty: string | null }[]
    onlineDocs.forEach((d) => {
      const key = d.specialty || 'Sin especialidad'
      bySpec[key] = (bySpec[key] || 0) + 1
    })
    setOnlineBySpecialty(Object.entries(bySpec).sort((a, b) => b[1] - a[1]))
  }

  const now = Date.now()
  const isSuperAdmin = profile?.role === 'super_admin'
  const isOnline = (lastSeen: string | null) =>
    !!lastSeen && now - new Date(lastSeen).getTime() < 3 * 60 * 1000
  const doctors = profiles.filter((p) => ['doctor', 'specialist'].includes(p.role))
  const activeDoctors = doctors.filter((d) => d.active)
  // Used only for the "Derivaciones por especialidad" breakdown (over the loaded recent cases).
  const referred = consultations.filter((c) => c.status === 'referred_to_specialist')

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

  // Staff-only, server-side filtered + paginated list for the Médicos y administradores table.
  async function loadUsers() {
    setUsersLoading(true)
    let q = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .in('role', userRole === 'all' ? STAFF_ROLES : [userRole])
      .order('created_at', { ascending: false })
    const term = debouncedUserSearch.trim().replace(/[(),]/g, ' ')
    if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,specialty.ilike.%${term}%`)
    if (userState === 'active') q = q.eq('active', true)
    if (userState === 'revoked') q = q.eq('active', false)
    if (userFrom) q = q.gte('created_at', `${userFrom}T00:00:00`)
    if (userTo) q = q.lte('created_at', `${userTo}T23:59:59.999`)
    const start = usersPage * USERS_PAGE_SIZE
    const { data, count, error } = await q.range(start, start + USERS_PAGE_SIZE - 1)
    if (error) {
      console.error(error)
      setMessage('No se pudieron cargar los usuarios.')
    } else {
      setUsersRows((data || []) as Profile[])
      setUsersTotal(count || 0)
    }
    setUsersLoading(false)
  }

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

  const sortedConsultations = useMemo(() => {
    const value = (c: Consultation): string | number => {
      switch (sortKey) {
        case 'patient':
          return c.patients?.full_name || ''
        case 'need':
          return c.category || c.chief_complaint || ''
        case 'status':
          return STATUS_LABELS[c.status] || c.status
        case 'contacted':
          return c.contacted ? 1 : 0
        case 'doctor':
          return doctorName(c.assigned_doctor_id)
        case 'dates':
          return new Date(c.created_at).getTime()
        case 'note':
          return c.internal_note || ''
        default:
          return ''
      }
    }
    return [...filteredConsultations].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })
    // doctorName derives from `profiles`; include it so re-sort happens when doctors load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredConsultations, sortKey, sortDir, profiles])

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

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
    if (['closed', 'patient_no_show', 'closed_by_admin'].includes(caseStatus))
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

  async function toggleContacted(c: Consultation) {
    const next = !c.contacted
    // Optimistic: flip locally, then persist; revert on error.
    setConsultations((prev) => prev.map((x) => (x.id === c.id ? { ...x, contacted: next } : x)))
    const { error } = await supabase
      .from('consultations')
      .update({ contacted: next })
      .eq('id', c.id)
    if (error) {
      console.error(error)
      setMessage('No se pudo actualizar "Contactado".')
      setConsultations((prev) => prev.map((x) => (x.id === c.id ? { ...x, contacted: !next } : x)))
    }
  }

  async function saveNote(c: Consultation) {
    const draft = noteDrafts[c.id] ?? ''
    const { error } = await supabase
      .from('consultations')
      .update({ internal_note: draft })
      .eq('id', c.id)
    if (error) {
      console.error(error)
      setMessage('No se pudo guardar la nota.')
      return
    }
    setConsultations((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, internal_note: draft } : x))
    )
    setNoteDrafts((d) => {
      const rest = { ...d }
      delete rest[c.id]
      return rest
    })
    setMessage('Nota actualizada.')
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
            <Kpi value={counts.doctors} label="Médicos registrados" />
            <Kpi value={counts.onlineDoctors} label="Médicos online" />
            <Kpi value={patientsCount} label="Pacientes registrados" />
            <Kpi value={counts.consultations} label="Consultas totales" />
            <Kpi value={counts.waiting} label="Consultas esperando" />
            <Kpi value={counts.open} label="Consultas abiertas" />
            <Kpi value={counts.closed} label="Consultas cerradas" />
            <Kpi value={counts.referred} label="Derivadas a especialista" />
          </div>

          {counts.urgent > 0 && (
            <div className="notice notice-danger" style={{ marginBottom: 18 }}>
              <strong>{counts.urgent}</strong> consultas marcadas como urgentes/presenciales.
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
                      Selecciona una consulta de la lista para reasignar el médico, cambiar el
                      estado o editar la nota.
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
                  <table className="table cases-table" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      {CASE_COLS.map((col) => (
                        <col key={col.key} style={{ width: col.width }} />
                      ))}
                      <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        {CASE_COLS.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => toggleSort(col.key)}
                            style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                            title="Ordenar"
                          >
                            {col.label}
                            {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                          </th>
                        ))}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedConsultations.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ color: '#64748b' }}>
                            No hay consultas que coincidan con el filtro.
                          </td>
                        </tr>
                      ) : (
                        sortedConsultations.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <strong>{c.patients?.full_name || 'Paciente'}</strong>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{c.code}</div>
                              <Line label="Cédula" value={c.patients?.cedula} />
                              <Line label="Tel" value={c.patients?.phone_whatsapp} />
                              <Line label="Email" value={c.patients?.email} />
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
                            </td>
                            <td>
                              {STATUS_LABELS[c.status] || c.status}
                              <Line label="Prioridad" value={c.priority} />
                              <Line label="Derivado a" value={c.referred_specialty} />
                            </td>
                            <td>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  cursor: 'pointer'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={c.contacted}
                                  onChange={() => toggleContacted(c)}
                                  style={{ width: 'auto' }}
                                />
                                {c.contacted ? (
                                  <span className="badge badge-green">Contactado</span>
                                ) : (
                                  <span
                                    className="badge"
                                    style={{ background: '#e2e8f0', color: '#64748b' }}
                                  >
                                    Sin contactar
                                  </span>
                                )}
                              </label>
                            </td>
                            <td>{doctorName(c.assigned_doctor_id)}</td>
                            <td>
                              <Line label="Creada" value={fmtDate(c.created_at)} />
                              {c.opened_at && <Line label="Abierta" value={fmtDate(c.opened_at)} />}
                              {c.closed_at && <Line label="Cerrada" value={fmtDate(c.closed_at)} />}
                            </td>
                            <td>
                              <textarea
                                rows={2}
                                style={{ width: '100%', fontSize: 12, padding: '4px 6px' }}
                                placeholder="Sin nota"
                                value={noteDrafts[c.id] ?? (c.internal_note || '')}
                                onChange={(e) =>
                                  setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                                }
                              />
                              {(noteDrafts[c.id] ?? (c.internal_note || '')) !==
                                (c.internal_note || '') && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ marginTop: 4, padding: '4px 10px', fontSize: 12 }}
                                  onClick={() => saveNote(c)}
                                >
                                  Guardar nota
                                </button>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: 13 }}
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
                                      padding: '4px 10px',
                                      fontSize: 13
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
                  <style jsx>{`
                    .cases-table td {
                      overflow-wrap: anywhere;
                    }
                  `}</style>
                </div>
              </section>
            </>
          )}

          {tab === 'medicos' && (
            <>
              <section className="card" style={{ marginBottom: 18 }}>
                <h2 style={{ marginTop: 0 }}>
                  Especialidades conectadas ahora{' '}
                  <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
                    ({counts.onlineDoctors} médicos online)
                  </span>
                </h2>
                {onlineBySpecialty.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No hay médicos conectados en este momento.</p>
                ) : (
                  <div className="tag-row">
                    {onlineBySpecialty.map(([spec, n]) => (
                      <span key={spec} className="badge badge-green">
                        {spec}: {n}
                      </span>
                    ))}
                  </div>
                )}
              </section>
              <section className="card">
                <h2 style={{ marginTop: 0 }}>
                  Médicos y administradores{' '}
                  <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
                    ({usersTotal})
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
                      {usersRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ color: '#64748b' }}>
                            {usersLoading
                              ? 'Cargando...'
                              : 'No hay usuarios que coincidan con el filtro.'}
                          </td>
                        </tr>
                      ) : (
                        usersRows.map((p) => (
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <span style={{ color: '#64748b', fontSize: 13 }}>
                    {usersTotal === 0
                      ? 'Sin resultados'
                      : `Mostrando ${usersPage * USERS_PAGE_SIZE + 1}–${Math.min(
                          (usersPage + 1) * USERS_PAGE_SIZE,
                          usersTotal
                        )} de ${usersTotal}`}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-muted"
                      disabled={usersPage === 0 || usersLoading}
                      onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
                    >
                      Anterior
                    </button>
                    <button
                      className="btn btn-muted"
                      disabled={(usersPage + 1) * USERS_PAGE_SIZE >= usersTotal || usersLoading}
                      onClick={() => setUsersPage((p) => p + 1)}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </section>
            </>
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
