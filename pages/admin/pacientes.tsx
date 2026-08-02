import { useEffect, useMemo, useState } from 'react'
import AdminLayout, { AdminLoading, Line } from '../../components/admin/AdminLayout'
import {
  CLOSED_STATUSES,
  Consultation,
  fmtDateTime,
  getAccessToken,
  inDateRange,
  STATUS_OPTIONS,
  useAdminGuard
} from '../../lib/admin'
import { useEscapeToClose } from '../../lib/hooks'
import { eligibleSpecialties, SPECIALTIES, STATUS_LABELS } from '../../lib/utils'
// Todo el acceso a datos pasa por el backend (no Supabase directo): consultas con paciente anidado,
// updates/eventos, buscador de médicos (/doctors/pool) y baja lógica del paciente.
import {
  addConsultationEvent,
  fetchConsultations,
  updateConsultation
} from '../../lib/consultations'
// Catálogo real de especialidades ({id, name}) del backend: la consulta matchea con el médico por
// `specialty_id` (el registro del paciente ya la setea), así que el admin re-rutea editando ESA
// columna — el mismo catálogo que usa el registro.
import { fetchDoctorPool, fetchSpecialties } from '../../lib/doctors'
import { archivePatient } from '../../lib/patients'
import { ApiUser, fetchProfiles } from '../../lib/users'

// Sortable columns of the cases table, with fixed widths so the table distributes space evenly
// (table-layout: fixed). The trailing "Acciones" column is not sortable.
const CASE_COLS: { key: string; label: string; width: string }[] = [
  { key: 'patient', label: 'Paciente', width: '10%' },
  { key: 'phone', label: 'Contacto', width: '12%' },
  { key: 'need', label: 'Categoría / motivo', width: '15%' },
  { key: 'status', label: 'Estado', width: '11%' },
  { key: 'contacted', label: 'Admin panel', width: '15%' },
  { key: 'doctor', label: 'Médico', width: '15%' },
  { key: 'dates', label: 'Fechas', width: '12%' }
]

export default function AdminPacientes() {
  const { profile, loading } = useAdminGuard()
  // super_admins (para el combobox "Admin responsable del seguimiento"); del backend, no de Supabase.
  const [superAdmins, setSuperAdmins] = useState<ApiUser[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [message, setMessage] = useState('')

  // Case oversight panel state
  const [selected, setSelected] = useState<Consultation | null>(null)
  const [caseStatus, setCaseStatus] = useState('')
  const [caseDoctor, setCaseDoctor] = useState('')
  const [caseNote, setCaseNote] = useState('')
  const [caseSpecialtyId, setCaseSpecialtyId] = useState('')
  const [specialtyCatalog, setSpecialtyCatalog] = useState<{ id: string; name: string }[]>([])
  const [savingCase, setSavingCase] = useState(false)
  // Searchable "Médico asignado" combobox (queries the DB so it reaches all doctors, not the 1000 cap).
  const [caseDoctorName, setCaseDoctorName] = useState('')
  const [doctorQuery, setDoctorQuery] = useState('')
  const [doctorMenuOpen, setDoctorMenuOpen] = useState(false)
  const [doctorOptions, setDoctorOptions] = useState<
    { id: string; full_name: string; specialty: string | null; role: string }[]
  >([])
  // Super-admin-only: delete a patient and all their cases (confirmation gated). The target can be
  // set from the manage panel or from a row's trash button, so it's its own piece of state.
  const [deleteTarget, setDeleteTarget] = useState<Consultation | null>(null)
  const [deleting, setDeleting] = useState(false)
  useEscapeToClose(!!deleteTarget, () => {
    if (!deleting) setDeleteTarget(null)
  })
  // Per-row inline edits of the notes in the cases table (keyed by consultation id).
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [notaAdminDrafts, setNotaAdminDrafts] = useState<Record<string, string>>({})
  // Inline (cases table) "Médico" reassignment combobox — one open row at a time, searched in the DB.
  const [rowDocMenu, setRowDocMenu] = useState<string | null>(null) // consultation id with its menu open
  const [rowDocQuery, setRowDocQuery] = useState('')
  const [rowDocOptions, setRowDocOptions] = useState<
    { id: string; full_name: string; specialty: string | null; role: string }[]
  >([])

  // Consultations table filters
  const [caseSearch, setCaseSearch] = useState('')
  const [caseStatusFilter, setCaseStatusFilter] = useState('all')
  const [caseFrom, setCaseFrom] = useState('')
  const [caseTo, setCaseTo] = useState('')
  // Cases table sorting (defaults to newest-first, matching the query order).
  const [sortKey, setSortKey] = useState('dates')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (profile) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // Búsqueda de médicos por /doctors/pool (no leer `users` directo). El pool devuelve `user_id`
  // (la clave que espera `assigned_doctor_id`, que referencia users.id) y `specialty_id` (el nombre
  // se resuelve con el catálogo). Solo los que tienen cuenta (user_id) son asignables.
  async function searchDoctors(term: string) {
    const token = await getAccessToken()
    // exclude_self:false -> el admin (aunque sea médico) ve TODOS los médicos asignables, como antes.
    const page = await fetchDoctorPool(
      { search: term.trim() || undefined, limit: 20, exclude_self: false },
      token
    )
    return page.items
      .filter((d) => d.user_id)
      .map((d) => ({
        id: d.user_id as string,
        full_name: d.full_name,
        specialty: specialtyName(d.specialty_id),
        role: 'Médico'
      }))
  }

  // Search doctors for the "Médico asignado" combobox (debounced; only while the menu is open).
  useEffect(() => {
    if (!doctorMenuOpen) return
    const t = setTimeout(async () => {
      setDoctorOptions(await searchDoctors(doctorQuery))
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorQuery, doctorMenuOpen])

  // Same search, for the inline "Médico" combobox in the cases table (debounced; only while a row's
  // menu is open).
  useEffect(() => {
    if (!rowDocMenu) return
    const t = setTimeout(async () => {
      setRowDocOptions(await searchDoctors(rowDocQuery))
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowDocQuery, rowDocMenu])

  async function loadAll() {
    // Todo por el backend: la lista de consultas ya trae el paciente anidado y el nombre del médico
    // asignado (assigned_doctor_name, resuelto server-side), así que no hay que cargar `users` en
    // masa ni resolver nombres. Los super_admins (combobox de seguimiento) salen de /profiles.
    const token = await getAccessToken()
    const [consultationsData, superAdminsRes] = await Promise.all([
      fetchConsultations(token, { limit: 200 }),
      // Sin filtro active: incluye super_admins inactivos, para que un seguimiento ya asignado a uno
      // desactivado siga mostrándose en el combobox (paridad con el listado viejo).
      fetchProfiles(token, { roles: ['super_admin'], limit: 100 })
    ])
    setConsultations(consultationsData)
    setSuperAdmins(superAdminsRes.items)
    // El catálogo de especialidades no cambia entre recargas del listado: una sola vez.
    if (specialtyCatalog.length === 0) {
      try {
        const list = await fetchSpecialties()
        setSpecialtyCatalog(
          list.filter((s) => s.status === 'active').map((s) => ({ id: s.id, name: s.name }))
        )
      } catch {
        // Sin catálogo el select queda solo con "— Sin especialidad —"; el resto del panel sigue.
      }
    }
  }

  const isSuperAdmin = profile?.role === 'super_admin'
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

  const specialtyName = (id: string | null) =>
    (id && specialtyCatalog.find((s) => s.id === id)?.name) || ''

  const filteredConsultations = useMemo(() => {
    const q = caseSearch.trim().toLowerCase()
    return consultations.filter((c) => {
      if (caseStatusFilter !== 'all' && c.status !== caseStatusFilter) return false
      if (!inDateRange(c.created_at, caseFrom, caseTo)) return false
      if (
        q &&
        !`${c.patients?.full_name || ''} ${c.code} ${c.patients?.affected_zone || ''} ${
          c.patients?.phone_whatsapp || ''
        } ${c.patients?.cedula || ''} ${c.patients?.email || ''}`
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
        case 'phone':
          return c.patients?.phone_whatsapp || ''
        case 'need':
          return c.category || c.chief_complaint || ''
        case 'status':
          return STATUS_LABELS[c.status] || c.status
        case 'contacted':
          return c.contacted ? 1 : 0
        case 'doctor':
          return c.assigned_doctor_name || ''
        case 'dates':
          return new Date(c.created_at).getTime()
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
  }, [filteredConsultations, sortKey, sortDir])

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
    setCaseSpecialtyId(c.specialty_id || '')
    setCaseDoctorName(c.assigned_doctor_name || '')
    setDoctorQuery('')
    setDoctorMenuOpen(false)
    setMessage('')
  }

  async function saveCase() {
    if (!selected || savingCase) return
    const update: Record<string, unknown> = {
      status: caseStatus,
      assigned_doctor_id: caseDoctor || null,
      internal_note: caseNote,
      specialty_id: caseSpecialtyId || null
    }
    if (['closed', 'patient_no_show', 'closed_by_admin'].includes(caseStatus))
      update.closed_at = new Date().toISOString()
    if (caseStatus === 'in_progress' && !selected.assigned_doctor_id && !caseDoctor) {
      setMessage('Asigna un médico para poner el caso en progreso.')
      return
    }

    setSavingCase(true)
    try {
      const token = await getAccessToken()
      await updateConsultation(selected.id, update, token)
      await addConsultationEvent(
        selected.id,
        {
          event_type: 'admin_update',
          note:
            `Estado: ${STATUS_LABELS[caseStatus] || caseStatus}; médico: ${caseDoctorName || 'Sin asignar'}` +
            ((caseSpecialtyId || null) !== (selected.specialty_id || null)
              ? `; especialidad: ${specialtyName(caseSpecialtyId) || '—'}`
              : '')
        },
        token
      )
      setMessage('Caso actualizado.')
      setSelected(null)
      await loadAll()
    } catch (e) {
      console.error(e)
      setMessage('No se pudo actualizar el caso.')
    } finally {
      setSavingCase(false)
    }
  }

  async function deletePatient() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Baja lógica: el backend marca deleted_at y filtra al paciente de las listas (no hard delete).
      await archivePatient(deleteTarget.patient_id, await getAccessToken())
      setMessage('Paciente archivado (baja lógica); sus casos quedan para trazabilidad.')
      if (selected?.id === deleteTarget.id) setSelected(null)
      setDeleteTarget(null)
      await loadAll()
    } catch (e) {
      console.error(e)
      setMessage('No se pudo archivar el paciente.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  async function toggleContacted(c: Consultation) {
    const next = !c.contacted
    // Optimistic: flip locally, then persist; revert on error.
    setConsultations((prev) => prev.map((x) => (x.id === c.id ? { ...x, contacted: next } : x)))
    try {
      await updateConsultation(c.id, { contacted: next }, await getAccessToken())
    } catch (e) {
      console.error(e)
      setMessage('No se pudo actualizar "Contactado".')
      setConsultations((prev) => prev.map((x) => (x.id === c.id ? { ...x, contacted: !next } : x)))
    }
  }

  // Inline status change from the cases table (no need to open "Gestionar caso").
  async function updateCaseStatus(c: Consultation, newStatus: string) {
    if (newStatus === c.status) return
    const prevStatus = c.status
    const update: { status: string; closed_at?: string } = { status: newStatus }
    if (['closed', 'patient_no_show', 'closed_by_admin'].includes(newStatus))
      update.closed_at = new Date().toISOString()
    // Optimistic: change locally, then persist; revert on error.
    setConsultations((list) => list.map((x) => (x.id === c.id ? { ...x, status: newStatus } : x)))
    try {
      const token = await getAccessToken()
      await updateConsultation(c.id, update, token)
      await addConsultationEvent(
        c.id,
        { event_type: 'admin_update', note: `Estado: ${STATUS_LABELS[newStatus] || newStatus}` },
        token
      )
      setMessage('Estado actualizado.')
    } catch (e) {
      console.error(e)
      setMessage('No se pudo cambiar el estado.')
      setConsultations((list) =>
        list.map((x) => (x.id === c.id ? { ...x, status: prevStatus } : x))
      )
    }
  }

  // Inline (cases table) assignment of the follow-up super_admin.
  async function updateAdminSeguimiento(c: Consultation, value: string) {
    const next = value || null
    const prev = c.admin_seguimiento
    setConsultations((list) =>
      list.map((x) => (x.id === c.id ? { ...x, admin_seguimiento: next } : x))
    )
    try {
      await updateConsultation(c.id, { admin_seguimiento: next }, await getAccessToken())
    } catch (e) {
      console.error(e)
      setMessage('No se pudo actualizar el seguimiento.')
      setConsultations((list) =>
        list.map((x) => (x.id === c.id ? { ...x, admin_seguimiento: prev } : x))
      )
    }
  }

  // Inline (cases table) reassignment of the attending doctor. `doctor` is null to unassign.
  async function assignDoctorInline(
    c: Consultation,
    doctor: { id: string; full_name: string } | null
  ) {
    const doctorId = doctor?.id || null
    const prev = { id: c.assigned_doctor_id, name: c.assigned_doctor_name }
    // Optimista: fija id y nombre (el nombre viene del pool; el backend lo confirma en la próxima carga).
    setConsultations((list) =>
      list.map((x) =>
        x.id === c.id
          ? { ...x, assigned_doctor_id: doctorId, assigned_doctor_name: doctor?.full_name || null }
          : x
      )
    )
    setRowDocMenu(null)
    setRowDocQuery('')
    try {
      const token = await getAccessToken()
      await updateConsultation(c.id, { assigned_doctor_id: doctorId }, token)
      await addConsultationEvent(
        c.id,
        {
          event_type: 'admin_update',
          note: `Médico asignado: ${doctor ? doctor.full_name : 'Sin asignar'}`
        },
        token
      )
      setMessage('Médico actualizado.')
    } catch (e) {
      console.error(e)
      setMessage('No se pudo asignar el médico.')
      setConsultations((list) =>
        list.map((x) =>
          x.id === c.id ? { ...x, assigned_doctor_id: prev.id, assigned_doctor_name: prev.name } : x
        )
      )
    }
  }

  // Inline (cases table) save of the admin note.
  async function saveNotaAdmin(c: Consultation) {
    const draft = notaAdminDrafts[c.id] ?? ''
    try {
      await updateConsultation(c.id, { nota_admin: draft }, await getAccessToken())
    } catch (e) {
      console.error(e)
      setMessage('No se pudo guardar la nota admin.')
      return
    }
    setConsultations((list) => list.map((x) => (x.id === c.id ? { ...x, nota_admin: draft } : x)))
    setNotaAdminDrafts((d) => {
      const rest = { ...d }
      delete rest[c.id]
      return rest
    })
    setMessage('Nota admin actualizada.')
  }

  async function saveNote(c: Consultation) {
    const draft = noteDrafts[c.id] ?? ''
    try {
      await updateConsultation(c.id, { internal_note: draft }, await getAccessToken())
    } catch (e) {
      console.error(e)
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

  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Pacientes / Casos" profile={profile}>
      {message && (
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Gestionar caso</h2>
          {!selected ? (
            <p style={{ color: '#64748b' }}>
              Selecciona una consulta de la lista para reasignar el médico, cambiar el estado o
              editar la nota.
            </p>
          ) : (
            <div className="grid">
              <div>
                <h3 style={{ marginBottom: 4 }}>{selected.patients?.full_name || 'Paciente'}</h3>
                <p style={{ marginTop: 0, color: '#64748b' }}>
                  {selected.code} · {selected.patients?.affected_zone || '-'}
                </p>
              </div>
              <div>
                <label className="label">Médico asignado</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={doctorMenuOpen ? doctorQuery : caseDoctorName}
                    placeholder="Buscar médico por nombre, especialidad o email…"
                    onFocus={() => {
                      setDoctorQuery('')
                      setDoctorMenuOpen(true)
                    }}
                    onChange={(e) => setDoctorQuery(e.target.value)}
                    onBlur={() => setDoctorMenuOpen(false)}
                  />
                  {doctorMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        zIndex: 30,
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        maxHeight: 240,
                        overflowY: 'auto',
                        boxShadow: '0 8px 24px rgba(15,23,42,0.12)'
                      }}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setCaseDoctor('')
                          setCaseDoctorName('')
                          setDoctorMenuOpen(false)
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          border: 'none',
                          background: 'transparent',
                          color: '#64748b'
                        }}
                      >
                        Sin asignar
                      </button>
                      {doctorOptions.map((d) => (
                        <button
                          type="button"
                          key={d.id}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setCaseDoctor(d.id)
                            setCaseDoctorName(`${d.full_name} (${d.specialty || d.role})`)
                            setDoctorMenuOpen(false)
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            border: 'none',
                            background: caseDoctor === d.id ? 'var(--green-light)' : 'transparent'
                          }}
                        >
                          {d.full_name}{' '}
                          <span style={{ color: '#94a3b8', fontSize: 13 }}>
                            ({d.specialty || d.role})
                          </span>
                        </button>
                      ))}
                      {doctorOptions.length === 0 && (
                        <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 13 }}>
                          {doctorQuery.trim() ? 'Sin resultados' : 'Escribe para buscar…'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                <label className="label">Especialidad</label>
                {/* `specialty_id` es la columna con la que la consulta matchea con el médico
                    (el registro del paciente la setea): cambiarla re-rutea el caso. */}
                <select
                  value={caseSpecialtyId}
                  onChange={(e) => setCaseSpecialtyId(e.target.value)}
                >
                  <option value="">— Sin especialidad —</option>
                  {(caseSpecialtyId && !specialtyCatalog.some((s) => s.id === caseSpecialtyId)
                    ? [{ id: caseSpecialtyId, name: 'Especialidad inactiva/desconocida' }]
                    : []
                  )
                    .concat(specialtyCatalog)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="label">Nota interna</label>
                <textarea rows={4} value={caseNote} onChange={(e) => setCaseNote(e.target.value)} />
              </div>
              <div className="grid grid-2">
                <button className="btn btn-primary" onClick={saveCase} disabled={savingCase}>
                  {savingCase ? 'Guardando...' : 'Guardar cambios'}
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
            placeholder="Buscar nombre, teléfono, cédula, email, código o zona"
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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 16px',
            margin: '4px 0 12px',
            fontSize: 12,
            color: '#64748b'
          }}
        >
          <span style={{ fontWeight: 600, color: '#334155' }}>Fechas:</span>
          {[
            { l: 'A', c: '#dc2626', t: 'El paciente registró su caso' },
            { l: 'B', c: '#2563eb', t: 'El paciente ingresó en la videollamada' },
            { l: 'C', c: '#ca8a04', t: 'Un médico de la especialidad ingresó en la videollamada' },
            { l: 'D', c: '#16a34a', t: 'El médico asignado cerró el caso' }
          ].map((item) => (
            <span key={item.l} style={{ whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, color: item.c }}>{item.l}</span> {item.t}
            </span>
          ))}
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
                    style={{
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                      verticalAlign: 'bottom',
                      lineHeight: 1.2
                    }}
                    title="Ordenar"
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
                <th style={{ textAlign: 'center' }}>×</th>
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
                      <button
                        type="button"
                        onClick={() => selectCase(c)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          cursor: 'pointer',
                          font: 'inherit',
                          fontWeight: 700,
                          color: CLOSED_STATUSES.includes(c.status) ? '#16a34a' : '#dc2626',
                          textAlign: 'left'
                        }}
                        title={
                          CLOSED_STATUSES.includes(c.status)
                            ? 'Caso cerrado — abrir / gestionar'
                            : 'Caso abierto — abrir / gestionar'
                        }
                      >
                        {c.patients?.full_name || 'Paciente'}
                      </button>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{c.code}</div>
                      <Line label="Zona" value={c.patients?.affected_zone} />
                      <Line label="Edad" value={c.patients?.age_range} />
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div title="Teléfono" style={{ color: '#0f172a', fontWeight: 600 }}>
                        {c.patients?.phone_whatsapp || '—'}
                      </div>
                      {c.patients?.cedula && (
                        <div title="Cédula / DNI" style={{ color: '#a16207' }}>
                          {c.patients.cedula}
                        </div>
                      )}
                      {c.patients?.email && (
                        <div title="Email" style={{ color: '#2563eb', wordBreak: 'break-all' }}>
                          {c.patients.email}
                        </div>
                      )}
                    </td>
                    <td>
                      <Line label="Categoría" value={c.category} />
                      <Line label="Motivo" value={c.chief_complaint} />
                      {/* Especialidad asignada (la columna del match); los casos viejos sin
                          specialty_id caen a las especialidades derivadas del tipo/necesidades. */}
                      <Line
                        label="La pueden atender"
                        value={
                          specialtyName(c.specialty_id) ||
                          eligibleSpecialties(
                            c.category || null,
                            c.patients?.needs_tags || null
                          ).join(', ')
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={c.status}
                        onChange={(e) => updateCaseStatus(c, e.target.value)}
                        style={{ fontSize: 12, padding: '4px 6px', width: '100%' }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s] || s}
                          </option>
                        ))}
                      </select>
                      <Line label="Prioridad" value={c.priority} />
                      <Line label="Derivado a" value={c.referred_specialty} />
                    </td>
                    <td>
                      <label
                        style={{
                          display: 'inline-flex',
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
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: c.contacted ? '#16a34a' : '#64748b'
                          }}
                        >
                          {c.contacted ? 'Ya fue contactado' : 'No ha sido contactado'}
                        </span>
                      </label>
                      <select
                        value={c.admin_seguimiento || ''}
                        onChange={(e) => updateAdminSeguimiento(c, e.target.value)}
                        title="Admin responsable del seguimiento"
                        style={{ width: '100%', fontSize: 12, padding: '2px 4px', marginTop: 4 }}
                      >
                        <option value="">Sin asignar</option>
                        {superAdmins.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                      </select>
                      <textarea
                        rows={2}
                        placeholder="Nota admin"
                        value={notaAdminDrafts[c.id] ?? (c.nota_admin || '')}
                        onChange={(e) =>
                          setNotaAdminDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                        }
                        style={{ width: '100%', fontSize: 12, padding: '4px 6px', marginTop: 4 }}
                      />
                      {(notaAdminDrafts[c.id] ?? (c.nota_admin || '')) !== (c.nota_admin || '') && (
                        <button
                          className="btn btn-secondary"
                          style={{ marginTop: 4, padding: '4px 10px', fontSize: 12 }}
                          onClick={() => saveNotaAdmin(c)}
                        >
                          Guardar nota admin
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <input
                          value={
                            rowDocMenu === c.id
                              ? rowDocQuery
                              : c.assigned_doctor_name || 'Sin asignar'
                          }
                          placeholder="Buscar médico…"
                          onFocus={() => {
                            setRowDocQuery('')
                            setRowDocOptions([])
                            setRowDocMenu(c.id)
                          }}
                          onChange={(e) => setRowDocQuery(e.target.value)}
                          onBlur={() => setRowDocMenu((cur) => (cur === c.id ? null : cur))}
                          style={{ fontSize: 12, padding: '4px 6px' }}
                        />
                        {rowDocMenu === c.id && (
                          <div
                            style={{
                              position: 'absolute',
                              zIndex: 30,
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: 4,
                              background: '#fff',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              maxHeight: 200,
                              overflowY: 'auto',
                              boxShadow: '0 8px 24px rgba(15,23,42,0.12)'
                            }}
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                assignDoctorInline(c, null)
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 10px',
                                border: 'none',
                                background: 'transparent',
                                color: '#64748b',
                                fontSize: 12
                              }}
                            >
                              Sin asignar
                            </button>
                            {rowDocOptions.map((d) => (
                              <button
                                type="button"
                                key={d.id}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  assignDoctorInline(c, d)
                                }}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '6px 10px',
                                  border: 'none',
                                  fontSize: 12,
                                  background:
                                    c.assigned_doctor_id === d.id
                                      ? 'var(--green-light)'
                                      : 'transparent'
                                }}
                              >
                                {d.full_name}{' '}
                                <span style={{ color: '#94a3b8' }}>({d.specialty || d.role})</span>
                              </button>
                            ))}
                            {rowDocOptions.length === 0 && (
                              <div style={{ padding: '6px 10px', color: '#94a3b8', fontSize: 12 }}>
                                {rowDocQuery.trim() ? 'Sin resultados' : 'Escribe para buscar…'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Nota médico"
                        value={noteDrafts[c.id] ?? (c.internal_note || '')}
                        onChange={(e) => setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                        style={{ width: '100%', fontSize: 12, padding: '4px 6px' }}
                      />
                      {(noteDrafts[c.id] ?? (c.internal_note || '')) !==
                        (c.internal_note || '') && (
                        <button
                          className="btn btn-secondary"
                          style={{ marginTop: 4, padding: '4px 10px', fontSize: 12 }}
                          onClick={() => saveNote(c)}
                        >
                          Guardar nota médico
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <span
                          title="El paciente registró su caso"
                          style={{ fontWeight: 700, color: '#dc2626' }}
                        >
                          A
                        </span>{' '}
                        {fmtDateTime(c.created_at)}
                      </div>
                      {c.entered_call_at && (
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          <span
                            title="El paciente ingresó en la videollamada"
                            style={{ fontWeight: 700, color: '#2563eb' }}
                          >
                            B
                          </span>{' '}
                          {fmtDateTime(c.entered_call_at)}
                        </div>
                      )}
                      {c.opened_at && (
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          <span
                            title="Un médico de la especialidad ingresó en la videollamada"
                            style={{ fontWeight: 700, color: '#ca8a04' }}
                          >
                            C
                          </span>{' '}
                          {fmtDateTime(c.opened_at)}
                        </div>
                      )}
                      {c.closed_at && (
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          <span
                            title="El médico asignado cerró el caso"
                            style={{ fontWeight: 700, color: '#16a34a' }}
                          >
                            D
                          </span>{' '}
                          {fmtDateTime(c.closed_at)}
                        </div>
                      )}
                    </td>
                    <td>
                      {isSuperAdmin && (
                        <button
                          className="btn"
                          title="Eliminar paciente y todos sus casos"
                          aria-label="Eliminar paciente"
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            padding: '5px 8px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          onClick={() => setDeleteTarget(c)}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
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
              {/* autoFocus: mueve el foco al modal al abrir (en la opción segura). */}
              <button
                className="btn btn-muted"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                autoFocus
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
