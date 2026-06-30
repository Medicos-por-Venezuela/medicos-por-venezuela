import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import DataTable, { Column } from '../../components/DataTable'
import { supabase } from '../../lib/supabase'

type Profile = {
  id: string
  email: string
  full_name: string
  role: string
  specialty: string | null
  medical_license: string | null
  whatsapp_number: string | null
  country: string | null
  verified: boolean
  active: boolean
  last_seen_at: string | null
}

const PAGE_SIZE = 20
const ALL = 'Todos'
const NONE = 'Sin especialidad'
const ONLINE_WINDOW_MS = 3 * 60 * 1000

function specialtyKey(d: Profile): string {
  return d.specialty || NONE
}

export default function AdminMedicosPorEspecialidad() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [doctors, setDoctors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // Filter + pagination state
  const [selected, setSelected] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
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

      let allDoctors: Profile[] = []
      let from = 0
      const pageSize = 1000
      // Supabase/PostgREST returns at most 1000 rows per request by default.
      // Paginate until we fetch every doctor.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: pageRows } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['doctor', 'specialist'])
          .order('full_name')
          .range(from, from + pageSize - 1)
        if (!pageRows || pageRows.length === 0) break
        allDoctors = allDoctors.concat(pageRows as Profile[])
        if (pageRows.length < pageSize) break
        from += pageSize
      }
      setDoctors(allDoctors)

      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = Date.now()

  // Unique specialties, sorted alphabetically with "Sin especialidad" last.
  const specialties = useMemo(() => {
    const set = new Set<string>()
    doctors.forEach((d) => set.add(specialtyKey(d)))
    return Array.from(set).sort((a, b) => {
      if (a === NONE) return 1
      if (b === NONE) return -1
      return a.localeCompare(b)
    })
  }, [doctors])

  // Tab list with per-tab counts: ["Todos (n)", "Medicina general (n)", ...]
  const tabs = useMemo(() => {
    const counts: Record<string, number> = {}
    doctors.forEach((d) => {
      const k = specialtyKey(d)
      counts[k] = (counts[k] || 0) + 1
    })
    return [ALL, ...specialties].map((s) => ({
      key: s,
      label: `${s} (${s === ALL ? doctors.length : counts[s] || 0})`
    }))
  }, [doctors, specialties])

  // Filtered by specialty tab.
  const byTab = useMemo(() => {
    if (selected === ALL) return doctors
    return doctors.filter((d) => specialtyKey(d) === selected)
  }, [doctors, selected])

  // Then filtered by the search box across all text fields.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter((d) =>
      `${d.full_name} ${d.email} ${d.specialty || ''} ${d.medical_license || ''} ${d.whatsapp_number || ''} ${d.country || ''}`
        .toLowerCase()
        .includes(q)
    )
  }, [byTab, search])

  // Pagination (20 per page).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function selectTab(key: string) {
    setSelected(key)
    setPage(1)
    setMobileOpen(false)
  }

  function clearSearch() {
    setSearch('')
    setPage(1)
  }

  const columns: Column<Profile>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (d) => <strong>{d.full_name}</strong>,
      primary: true
    },
    {
      key: 'email',
      header: 'Email',
      render: (d) => <span style={{ color: '#64748b' }}>{d.email}</span>
    },
    { key: 'specialty', header: 'Especialidad', render: (d) => specialtyKey(d) },
    { key: 'license', header: 'Matrícula', render: (d) => d.medical_license || '—' },
    {
      key: 'online',
      header: 'Online',
      render: (d) =>
        d.last_seen_at && now - new Date(d.last_seen_at).getTime() < ONLINE_WINDOW_MS ? 'Sí' : 'No'
    },
    {
      key: 'status',
      header: 'Estado',
      render: (d) =>
        d.active ? (
          <span className="badge badge-green">Activo</span>
        ) : (
          <span className="badge badge-red">Revocado</span>
        ),
      mobileBadge: true
    }
  ]

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
        <title>Médicos por especialidad — Admin</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="page">
        <div className="container">
          <div className="topbar">
            <div>
              <h1 style={{ margin: 0 }}>Médicos por especialidad</h1>
              <p style={{ margin: 0, color: '#64748b' }}>
                {profile?.full_name} · {doctors.length} médicos · {specialties.length}{' '}
                especialidades
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => router.push('/admin/dashboard')}>
                Dashboard
              </button>
              <button className="btn btn-outline" onClick={() => router.push('/panel-medico')}>
                Panel médico
              </button>
            </div>
          </div>

          {/* Filter: tabs on desktop */}
          <div
            className="filter-tabs tag-row"
            style={{ marginBottom: 16 }}
            role="tablist"
            aria-label="Filtrar por especialidad"
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={selected === t.key}
                aria-current={selected === t.key ? 'true' : undefined}
                className={`tag${selected === t.key ? ' selected' : ''}`}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filter: dropdown button on mobile */}
          <div className="filter-dropdown" style={{ marginBottom: 16 }}>
            <button
              className="btn btn-muted btn-full"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-haspopup="listbox"
              style={{ justifyContent: 'space-between' }}
            >
              <span>Filtrar: {selected}</span>
              <span>{mobileOpen ? '▲' : '▼'}</span>
            </button>
            {mobileOpen && (
              <div className="filter-dropdown-panel" role="listbox" aria-label="Especialidades">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    role="option"
                    aria-selected={selected === t.key}
                    className={`tag${selected === t.key ? ' selected' : ''}`}
                    onClick={() => selectTab(t.key)}
                    style={{ borderRadius: 10, textAlign: 'left' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Single reusable table */}
          <section className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12
              }}
            >
              <h2 style={{ margin: 0 }}>
                {selected}{' '}
                <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
                  ({filtered.length})
                </span>
              </h2>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flex: '1 1 200px',
                  maxWidth: 320,
                  justifyContent: 'flex-end'
                }}
              >
                <input
                  id="search-medicos"
                  type="search"
                  placeholder="Buscar: nombre, correo, matrícula..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  title="Buscar por nombre, correo, especialidad, matrícula, teléfono o país"
                  style={{ minWidth: 160 }}
                />
                {search && (
                  <button className="btn btn-muted" onClick={clearSearch} title="Limpiar búsqueda">
                    ✕
                  </button>
                )}
              </div>
            </div>
            {paged.length === 0 ? (
              <p style={{ color: '#64748b' }}>No hay médicos en esta categoría.</p>
            ) : (
              <DataTable
                items={paged}
                getKey={(d) => d.id}
                emptyMessage="No hay médicos en esta categoría."
                columns={columns}
              />
            )}

            {/* Pagination (only when needed) */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 16,
                  flexWrap: 'wrap',
                  gap: 8
                }}
                role="navigation"
                aria-label="Paginación de médicos"
              >
                <button
                  className="btn btn-muted"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ← Anterior
                </button>
                <span style={{ color: '#64748b', fontSize: 14 }} aria-live="polite">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  className="btn btn-muted"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
