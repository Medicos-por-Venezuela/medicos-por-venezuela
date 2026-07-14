// Shared types, constants and the auth guard used by every /admin/* page. Extracted from the
// original monolithic pages/admin/dashboard.tsx so each page (dashboard, pacientes, doctores,
// catálogos) can reuse the same session/role check instead of duplicating it.
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useMountEffect } from './hooks'
import { supabase } from './supabase'

export type Profile = {
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

export type Patient = {
  full_name: string
  cedula: string | null
  phone_whatsapp: string | null
  email: string | null
  affected_zone: string | null
  age_range: string | null
  needs_tags: string[] | null
  description: string | null
}

export type Consultation = {
  id: string
  patient_id: string
  code: string
  status: string
  priority: string
  category: string | null
  specialty_id: string | null
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
  patients: Patient | null
}

export const STATUS_OPTIONS = [
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
export const CLOSED_STATUSES = ['closed', 'closed_by_admin']
// "En progreso" = a doctor has engaged the case and it isn't formally closed yet. Includes derived
// outcomes (referred/urgent) and negative endings (no-show/cancelled) — everything past the queue
// that isn't a formal close.
export const IN_PROGRESS_STATUSES = [
  'in_progress',
  'referred_to_specialist',
  'urgent_in_person',
  'patient_no_show',
  'cancelled',
  'contacted_whatsapp'
]
export const ROLE_OPTIONS = ['all', 'doctor', 'specialist', 'admin', 'super_admin']
// The "Médicos y administradores" table is staff-only — patients never appear there.
export const STAFF_ROLES = ['doctor', 'specialist', 'admin', 'super_admin']
export const USERS_PAGE_SIZE = 50

// Timestamps are stored as UTC (timestamptz); always render them in Venezuela time
// (America/Caracas) so they're consistent regardless of the admin's browser timezone.
export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }) : '—'
export const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString('es-VE', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Caracas'
      })
    : '—'

// True if an ISO timestamp falls within an inclusive [from, to] date range (either bound optional).
// `from`/`to` come from <input type="date"> as 'YYYY-MM-DD'.
export function inDateRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime()
  if (from && t < new Date(from + 'T00:00:00').getTime()) return false
  if (to && t > new Date(to + 'T23:59:59.999').getTime()) return false
  return true
}

// Session + role guard shared by every /admin/* page (except the login page itself): redirects to
// /admin unless there's a session AND the profile is an active admin/super_admin.
export function useAdminGuard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useMountEffect(() => {
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
      setProfile(me as Profile)
      setLoading(false)
    })()
  })

  return { profile, loading }
}

export async function adminLogout(router: ReturnType<typeof useRouter>) {
  await supabase.auth.signOut()
  router.push('/')
}

// Bearer token for authenticated calls to api-medicos-por-venezuela (catalogs.manage endpoints).
// The backend validates the same Supabase JWT it accepts for the frontend's own auth.
export async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Sesión expirada, vuelve a iniciar sesión.')
  return data.session.access_token
}
