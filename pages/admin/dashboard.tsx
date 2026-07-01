import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  NEEDS,
  SPECIALTIES,
  STATUS_LABELS,
  effectiveSpecialties,
  eligibleSpecialties
} from '../../lib/utils'

// True if two specialty lists contain the same set (order-independent).
function sameSpecialtySet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

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
  entered_call_at: string | null
  opened_at: string | null
  closed_at: string | null
  contacted: boolean
  admin_seguimiento: string | null // super_admin id following up the case
  nota_admin: string | null
  attended_via_whatsapp: boolean
  required_specialties: string[] | null
  patients: Patient | null
}

type ConsultationEvent = {
  id: string
  event_type: string
  created_by: string | null
  note: string | null
  created_at: string
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    opened: 'Consulta abierta',
    closed: 'Consulta cerrada',
    patient_no_show: 'Paciente ausente',
    admin_update: 'Actualización administrativa',
    patient_entered_call: 'Paciente ingresó a la videollamada',
    patient_wants_whatsapp: 'Paciente prefirió ser contactado por WhatsApp'
  }
  return labels[type] || type
}

const STATUS_OPTIONS = [
  'waiting',
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'closed',
  'cancelled',
  'patient_no_show',
  'closed_by_admin',
  'contacted_whatsapp'
]
// A case counts as "closed" (green row) ONLY when it's Cerrada or Cerrada por admin.
// Everything else — including cancelled, no-show, waiting, in progress — is still open (red row).
const CLOSED_STATUSES = ['closed', 'closed_by_admin']
// "En progreso" = a doctor has engaged the case and it isn't formally closed yet. Includes derived
// outcomes (referred/urgent) and negative endings (no-show/cancelled) — everything past the queue
// that isn't a formal close.
const IN_PROGRESS_STATUSES = [
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'patient_no_show',
  'cancelled',
  'contacted_whatsapp'
]
const ROLE_OPTIONS = ['all', 'doctor', 'specialist', 'admin', 'super_admin']
// The "Médicos y administradores" table is staff-only — patients never appear there.
const STAFF_ROLES = ['doctor', 'specialist', 'admin', 'super_admin']
const USERS_PAGE_SIZE = 50

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

// Timestamps are stored as UTC (timestamptz); always render them in Venezuela time
// (America/Caracas) so they're consistent regardless of the admin's browser timezone.
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }) : '—'
const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString('es-VE', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Caracas'
      })
    : '—'

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

  // Inline patient-phone edit in the cases table (pencil → input → check). Keyed by consultation id.
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  // Case oversight panel state
  const [selected, setSelected] = useState<Consultation | null>(null)
  const [caseStatus, setCaseStatus] = useState('')
  const [caseDoctor, setCaseDoctor] = useState('')
  const [caseNote, setCaseNote] = useState('')
  const [caseSeguimiento, setCaseSeguimiento] = useState('') // admin_seguimiento (super_admin id)
  const [caseNotaAdmin, setCaseNotaAdmin] = useState('')
  // Editable "tipo de ayuda" of the selected case (fixes a wrong patient selection; re-routes it).
  const [caseNeeds, setCaseNeeds] = useState<string[]>([])
  // Which specialties can see the case. Starts from the derived/override set; if the admin changes it
  // away from what the tipo de ayuda derives, it's saved as an override (required_specialties).
  const [caseSpecs, setCaseSpecs] = useState<string[]>([])
  // Audit trail ("Referencia y trazabilidad") for the selected case.
  const [caseEvents, setCaseEvents] = useState<ConsultationEvent[]>([])
  const [caseEventAuthorsById, setCaseEventAuthorsById] = useState<
    Record<string, { full_name: string; role: string }>
  >({})
  // The "Gestionar caso" panel, so clicking a case scrolls up to it.
  const manageRef = useRef<HTMLDivElement | null>(null)
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
  // Per-row inline edits of the notes in the cases table (keyed by consultation id).
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [notaAdminDrafts, setNotaAdminDrafts] = useState<Record<string, string>>({})
  // Inline (cases table) "Médico" reassignment combobox — one open row at a time, searched in the DB.
  const [rowDocMenu, setRowDocMenu] = useState<string | null>(null) // consultation id with its menu open
  const [rowDocQuery, setRowDocQuery] = useState('')
  const [rowDocOptions, setRowDocOptions] = useState<
    { id: string; full_name: string; specialty: string | null; role: string }[]
  >([])
  // Names of doctors picked via search (may live beyond the loaded 1000 profiles) so the cell still
  // shows the right name after assigning.
  const [doctorNameCache, setDoctorNameCache] = useState<Record<string, string>>({})

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

  // Search doctors for the "Médico asignado" combobox (debounced; only while the menu is open).
  useEffect(() => {
    if (!doctorMenuOpen) return
    const t = setTimeout(async () => {
      let q = supabase
        .from('profiles')
        .select('id, full_name, specialty, role')
        .in('role', ['doctor', 'specialist'])
        .eq('active', true)
        .order('full_name')
        .limit(20)
      const term = doctorQuery.trim().replace(/[(),]/g, ' ')
      if (term)
        q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,specialty.ilike.%${term}%`)
      const { data } = await q
      setDoctorOptions(
        (data || []) as {
          id: string
          full_name: string
          specialty: string | null
          role: string
        }[]
      )
    }, 250)
    return () => clearTimeout(t)
  }, [doctorQuery, doctorMenuOpen])

  // Same search, for the inline "Médico" combobox in the cases table (debounced; only while a row's
  // menu is open).
  useEffect(() => {
    if (!rowDocMenu) return
    const t = setTimeout(async () => {
      let q = supabase
        .from('profiles')
        .select('id, full_name, specialty, role')
        .in('role', ['doctor', 'specialist'])
        .eq('active', true)
        .order('full_name')
        .limit(20)
      const term = rowDocQuery.trim().replace(/[(),]/g, ' ')
      if (term)
        q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,specialty.ilike.%${term}%`)
      const { data } = await q
      setRowDocOptions(
        (data || []) as {
          id: string
          full_name: string
          specialty: string | null
          role: string
        }[]
      )
    }, 250)
    return () => clearTimeout(t)
  }, [rowDocQuery, rowDocMenu])

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
      consCount().eq('status', 'waiting').not('entered_call_at', 'is', null),
      consCount().in('status', IN_PROGRESS_STATUSES),
      consCount().in('status', CLOSED_STATUSES),
      consCount().eq('status', 'referred_to_specialist'),
      consCount().eq('status', 'urgent_in_person')
    ])

    if (profilesRes.data) setProfiles(profilesRes.data as Profile[])
    if (consultationsRes.data) setConsultations(consultationsRes.data as Consultation[])

    // Resolve names of assigned doctors that may live beyond the loaded 1000 profiles, so the cases
    // table shows the real name (not a generic "Médico") for cases claimed by older doctors.
    if (consultationsRes.data) {
      const assignedIds = Array.from(
        new Set(
          (consultationsRes.data as Consultation[])
            .map((c) => c.assigned_doctor_id)
            .filter((id): id is string => !!id)
        )
      )
      if (assignedIds.length > 0) {
        const { data: docs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', assignedIds)
        if (docs)
          setDoctorNameCache((m) => ({
            ...m,
            ...Object.fromEntries(
              (docs as { id: string; full_name: string }[]).map((d) => [d.id, d.full_name])
            )
          }))
      }
    }

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
  const doctorName = (id: string | null) =>
    doctors.find((d) => d.id === id)?.full_name ||
    (id ? doctorNameCache[id] || 'Médico' : 'Sin asignar')

  // Super-admins available in the "Seguimiento" dropdown (who is following up a case).
  const superAdmins = useMemo(() => profiles.filter((p) => p.role === 'super_admin'), [profiles])

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
          return doctorName(c.assigned_doctor_id)
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

  async function loadCaseEvents(consultationId: string) {
    const { data, error } = await supabase
      .from('consultation_events')
      .select('id, event_type, created_by, note, created_at')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setCaseEvents([])
      setCaseEventAuthorsById({})
      return
    }

    const rows = (data || []) as ConsultationEvent[]
    setCaseEvents(rows)

    const authorIds = Array.from(
      new Set(rows.map((e) => e.created_by).filter((id): id is string => !!id))
    )
    if (authorIds.length === 0) {
      setCaseEventAuthorsById({})
      return
    }

    const { data: authors } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', authorIds)

    setCaseEventAuthorsById(
      Object.fromEntries(
        (authors || []).map((a) => [a.id, { full_name: a.full_name, role: a.role }])
      )
    )
  }

  function selectCase(c: Consultation) {
    setSelected(c)
    void loadCaseEvents(c.id)
    setCaseStatus(c.status)
    setCaseDoctor(c.assigned_doctor_id || '')
    setCaseNote(c.internal_note || '')
    setCaseSeguimiento(c.admin_seguimiento || '')
    setCaseNotaAdmin(c.nota_admin || '')
    setCaseDoctorName(c.assigned_doctor_id ? doctorName(c.assigned_doctor_id) : '')
    setCaseNeeds(c.patients?.needs_tags || [])
    setCaseSpecs(
      effectiveSpecialties(c.required_specialties, c.category, c.patients?.needs_tags || null)
    )
    setDoctorQuery('')
    setDoctorMenuOpen(false)
    setMessage('')
    // Bring the "Gestionar caso" panel (near the top) into view. Deferred so it runs after render.
    requestAnimationFrame(() =>
      manageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  }

  async function saveCase() {
    if (!selected) return
    // Only store an override when the admin's specialty selection differs from what the tipo de ayuda
    // derives; otherwise keep it null so it stays derived.
    const derivedSpecs = eligibleSpecialties(caseNeeds[0] || null, caseNeeds)
    const update: Record<string, unknown> = {
      status: caseStatus,
      assigned_doctor_id: caseDoctor || null,
      internal_note: caseNote,
      category: caseNeeds[0] || null,
      required_specialties: sameSpecialtySet(caseSpecs, derivedSpecs) ? null : caseSpecs
    }
    if (['closed', 'patient_no_show', 'closed_by_admin'].includes(caseStatus))
      update.closed_at = new Date().toISOString()
    if (caseStatus === 'in_progress' && !selected.assigned_doctor_id && !caseDoctor) {
      setMessage('Asigna un médico para poner el caso en progreso.')
      return
    }

    // Use `.select()` so we can detect BOTH a DB error and a silent 0-row update (RLS/no match returns
    // no error but changes nothing) — that silent case is what made saves appear to "not stick".
    const { data: consRows, error } = await supabase
      .from('consultations')
      .update(update)
      .eq('id', selected.id)
      .select('id')
    if (error || !consRows || consRows.length === 0) {
      console.error(error)
      setMessage(
        error
          ? `No se pudo actualizar el caso: ${error.message}`
          : 'No se pudo actualizar el caso (sin permisos o no encontrado).'
      )
      return
    }

    // The tipo de ayuda lives on the patient row (needs_tags); persist the admin's edit so the
    // eligible specialties re-derive from it.
    const { data: patRows, error: needsError } = await supabase
      .from('patients')
      .update({ needs_tags: caseNeeds })
      .eq('id', selected.patient_id)
      .select('id')
    if (needsError || !patRows || patRows.length === 0) {
      console.error(needsError)
      setMessage(
        needsError
          ? `Se guardó el caso, pero no se pudo actualizar el tipo de ayuda: ${needsError.message}`
          : 'Se guardó el caso, pero no se pudo actualizar el tipo de ayuda (sin permisos o paciente no encontrado).'
      )
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

  // Inline edit of a patient's phone from the cases table. Verified with `.select()` so a silent
  // 0-row update (RLS/no match) is caught. Updates every case of the same patient locally.
  async function savePhone(c: Consultation) {
    if (!c.patient_id) return
    const value = phoneDraft.trim()
    setSavingPhone(true)
    const { data, error } = await supabase
      .from('patients')
      .update({ phone_whatsapp: value })
      .eq('id', c.patient_id)
      .select('id')
    setSavingPhone(false)
    if (error || !data || data.length === 0) {
      setMessage(
        error
          ? `No se pudo actualizar el teléfono: ${error.message}`
          : 'No se pudo actualizar el teléfono (sin permisos o paciente no encontrado).'
      )
      return
    }
    setConsultations((prev) =>
      prev.map((x) =>
        x.patient_id === c.patient_id && x.patients
          ? { ...x, patients: { ...x.patients, phone_whatsapp: value } }
          : x
      )
    )
    if (selected?.patient_id === c.patient_id && selected.patients) {
      setSelected({ ...selected, patients: { ...selected.patients, phone_whatsapp: value } })
    }
    setEditingPhoneId(null)
    setMessage('Teléfono actualizado.')
  }

  // Inline status change from the cases table (no need to open "Gestionar caso").
  async function updateCaseStatus(c: Consultation, newStatus: string) {
    if (newStatus === c.status) return
    const prevStatus = c.status
    const update: Record<string, unknown> = { status: newStatus }
    if (['closed', 'patient_no_show', 'closed_by_admin'].includes(newStatus))
      update.closed_at = new Date().toISOString()
    // Optimistic: change locally, then persist; revert on error.
    setConsultations((list) => list.map((x) => (x.id === c.id ? { ...x, status: newStatus } : x)))
    const { error } = await supabase.from('consultations').update(update).eq('id', c.id)
    if (error) {
      console.error(error)
      setMessage('No se pudo cambiar el estado.')
      setConsultations((list) =>
        list.map((x) => (x.id === c.id ? { ...x, status: prevStatus } : x))
      )
      return
    }
    await supabase.from('consultation_events').insert({
      consultation_id: c.id,
      event_type: 'admin_update',
      note: `Estado: ${STATUS_LABELS[newStatus] || newStatus}`
    })
    if (selected?.id === c.id) void loadCaseEvents(c.id)
    setMessage('Estado actualizado.')
  }

  // Inline (cases table) assignment of the follow-up super_admin.
  async function updateAdminSeguimiento(c: Consultation, value: string) {
    const next = value || null
    const prev = c.admin_seguimiento
    setConsultations((list) =>
      list.map((x) => (x.id === c.id ? { ...x, admin_seguimiento: next } : x))
    )
    const { error } = await supabase
      .from('consultations')
      .update({ admin_seguimiento: next })
      .eq('id', c.id)
    if (error) {
      console.error(error)
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
    const prev = c.assigned_doctor_id
    if (doctor) setDoctorNameCache((m) => ({ ...m, [doctor.id]: doctor.full_name }))
    setConsultations((list) =>
      list.map((x) => (x.id === c.id ? { ...x, assigned_doctor_id: doctorId } : x))
    )
    setRowDocMenu(null)
    setRowDocQuery('')
    const { error } = await supabase
      .from('consultations')
      .update({ assigned_doctor_id: doctorId })
      .eq('id', c.id)
    if (error) {
      console.error(error)
      setMessage('No se pudo asignar el médico.')
      setConsultations((list) =>
        list.map((x) => (x.id === c.id ? { ...x, assigned_doctor_id: prev } : x))
      )
      return
    }
    await supabase.from('consultation_events').insert({
      consultation_id: c.id,
      event_type: 'admin_update',
      note: `Médico asignado: ${doctor ? doctor.full_name : 'Sin asignar'}`
    })
    setMessage('Médico actualizado.')
  }

  // Inline (cases table) save of the admin note.
  async function saveNotaAdmin(c: Consultation) {
    const draft = notaAdminDrafts[c.id] ?? ''
    const { error } = await supabase
      .from('consultations')
      .update({ nota_admin: draft })
      .eq('id', c.id)
    if (error) {
      console.error(error)
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
      <main className="page dash-page">
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

          <div className="dash-kpis">
            <Kpi value={counts.doctors} label="Médicos registrados" />
            <Kpi value={counts.onlineDoctors} label="Médicos online" />
            <Kpi value={patientsCount} label="Pacientes registrados" />
            <Kpi value={counts.waiting} label="Consultas esperando" />
            <Kpi value={counts.open} label="Consultas en progreso" />
            <Kpi value={counts.closed} label="Consultas cerradas" />
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
              <div style={{ marginBottom: 18 }} ref={manageRef}>
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
                        <label className="label">Tipo de ayuda</label>
                        <div className="tag-row">
                          {NEEDS.map((tag) => {
                            const on = caseNeeds.includes(tag)
                            return (
                              <button
                                type="button"
                                key={tag}
                                className={`tag ${on ? 'selected' : ''}`}
                                onClick={() => {
                                  const next = on
                                    ? caseNeeds.filter((t) => t !== tag)
                                    : [...caseNeeds, tag]
                                  setCaseNeeds(next)
                                  setCaseSpecs(eligibleSpecialties(next[0] || null, next))
                                }}
                              >
                                {tag}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="label">Especialidades que pueden ver este caso</label>
                        <div className="tag-row">
                          {SPECIALTIES.map((s) => {
                            const on = caseSpecs.includes(s)
                            return (
                              <button
                                type="button"
                                key={s}
                                className={`tag ${on ? 'selected' : ''}`}
                                onClick={() =>
                                  setCaseSpecs((prev) =>
                                    on ? prev.filter((x) => x !== s) : [...prev, s]
                                  )
                                }
                              >
                                {s}
                              </button>
                            )
                          })}
                        </div>
                        <p className="hint" style={{ marginTop: 6 }}>
                          {sameSpecialtySet(
                            caseSpecs,
                            eligibleSpecialties(caseNeeds[0] || null, caseNeeds)
                          )
                            ? 'Derivadas del tipo de ayuda.'
                            : 'Personalizadas (anulan el tipo de ayuda).'}
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
                                    background:
                                      caseDoctor === d.id ? 'var(--green-light)' : 'transparent'
                                  }}
                                >
                                  {d.full_name}{' '}
                                  <span style={{ color: '#94a3b8', fontSize: 13 }}>
                                    ({d.specialty || d.role})
                                  </span>
                                </button>
                              ))}
                              {doctorOptions.length === 0 && (
                                <div
                                  style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 13 }}
                                >
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
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <h3 style={{ margin: '0 0 8px' }}>Referencia y trazabilidad</h3>
                        {caseEvents.length === 0 ? (
                          <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>
                            Todavía no hay historial registrado para este caso.
                          </p>
                        ) : (
                          <div>
                            {caseEvents.map((event, i) => {
                              const author = event.created_by
                                ? caseEventAuthorsById[event.created_by]
                                : null
                              return (
                                <div
                                  key={event.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: '8px 0',
                                    borderTop: i === 0 ? 'none' : '1px solid var(--border)'
                                  }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <strong style={{ fontSize: 13 }}>
                                      {eventLabel(event.event_type)}
                                    </strong>
                                    {event.note && (
                                      <span style={{ color: '#475569', fontSize: 13 }}>
                                        {' '}
                                        — {event.note}
                                      </span>
                                    )}
                                    <span style={{ color: '#94a3b8', fontSize: 12 }}>
                                      {' · '}
                                      {author?.full_name || 'usuario del sistema'}
                                      {author?.role ? ` (${author.role})` : ''}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      color: '#64748b',
                                      fontSize: 12,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {fmtDateTime(event.created_at)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                    {
                      l: 'C',
                      c: '#ca8a04',
                      t: 'Un médico de la especialidad ingresó en la videollamada'
                    },
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
                              {editingPhoneId === c.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    value={phoneDraft}
                                    onChange={(e) => setPhoneDraft(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') savePhone(c)
                                      if (e.key === 'Escape') setEditingPhoneId(null)
                                    }}
                                    style={{ fontSize: 12, padding: '2px 4px', width: 120 }}
                                  />
                                  <button
                                    type="button"
                                    title="Guardar teléfono"
                                    onClick={() => savePhone(c)}
                                    disabled={savingPhone}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: '#16a34a',
                                      fontSize: 15,
                                      padding: 0
                                    }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    title="Cancelar"
                                    onClick={() => setEditingPhoneId(null)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: '#dc2626',
                                      fontSize: 14,
                                      padding: 0
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div
                                  title="Teléfono"
                                  style={{
                                    color: '#0f172a',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                  }}
                                >
                                  <span>{c.patients?.phone_whatsapp || '—'}</span>
                                  <button
                                    type="button"
                                    title="Editar teléfono"
                                    onClick={() => {
                                      setEditingPhoneId(c.id)
                                      setPhoneDraft(c.patients?.phone_whatsapp || '')
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      color: '#94a3b8',
                                      fontSize: 14,
                                      padding: 0
                                    }}
                                  >
                                    ✎
                                  </button>
                                </div>
                              )}
                              {c.patients?.cedula && (
                                <div title="Cédula" style={{ color: '#a16207' }}>
                                  {c.patients.cedula}
                                </div>
                              )}
                              {c.patients?.email && (
                                <div
                                  title="Email"
                                  style={{ color: '#2563eb', wordBreak: 'break-all' }}
                                >
                                  {c.patients.email}
                                </div>
                              )}
                            </td>
                            <td>
                              <Line label="Categoría" value={c.category} />
                              <Line label="Motivo" value={c.chief_complaint} />
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
                              <Line
                                label="Especialidades"
                                value={effectiveSpecialties(
                                  c.required_specialties,
                                  c.category,
                                  c.patients?.needs_tags || null
                                ).join(', ')}
                              />
                              {c.attended_via_whatsapp && (
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#16a34a',
                                    marginTop: 4
                                  }}
                                >
                                  Doctor contactará vía WhatsApp
                                </div>
                              )}
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
                                    fontSize: 11,
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
                                style={{
                                  width: '100%',
                                  fontSize: 12,
                                  padding: '2px 4px',
                                  marginTop: 4
                                }}
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
                                style={{
                                  width: '100%',
                                  fontSize: 12,
                                  padding: '4px 6px',
                                  marginTop: 4
                                }}
                              />
                              {(notaAdminDrafts[c.id] ?? (c.nota_admin || '')) !==
                                (c.nota_admin || '') && (
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
                                      : doctorName(c.assigned_doctor_id)
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
                                        <span style={{ color: '#94a3b8' }}>
                                          ({d.specialty || d.role})
                                        </span>
                                      </button>
                                    ))}
                                    {rowDocOptions.length === 0 && (
                                      <div
                                        style={{
                                          padding: '6px 10px',
                                          color: '#94a3b8',
                                          fontSize: 12
                                        }}
                                      >
                                        {rowDocQuery.trim()
                                          ? 'Sin resultados'
                                          : 'Escribe para buscar…'}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <textarea
                                rows={2}
                                placeholder="Nota médico"
                                value={noteDrafts[c.id] ?? (c.internal_note || '')}
                                onChange={(e) =>
                                  setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                                }
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
                  <table className="table users-table">
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
