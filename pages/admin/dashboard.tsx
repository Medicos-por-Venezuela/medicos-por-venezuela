import { useEffect, useState } from 'react'
import AdminLayout, { AdminLoading, Kpi } from '../../components/admin/AdminLayout'
import { CLOSED_STATUSES, IN_PROGRESS_STATUSES, useAdminGuard } from '../../lib/admin'
import { useOnlineDoctors } from '../../lib/presence'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const { profile, loading } = useAdminGuard()
  // "Médicos online" en vivo por Realtime Presence (el admin solo observa, no se anuncia).
  const onlineDoctors = useOnlineDoctors()
  const [counts, setCounts] = useState({
    doctors: 0,
    patients: 0,
    waiting: 0,
    open: 0,
    closed: 0,
    urgent: 0
  })

  useEffect(() => {
    if (profile) loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function loadStats() {
    const staffRoles = ['doctor', 'specialist']
    const consCount = () =>
      supabase.from('consultations').select('id', { count: 'exact', head: true })
    const [doctorsCnt, patientsCnt, waitingCnt, openCnt, closedCnt, urgentCnt] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', staffRoles),
      supabase.from('patients').select('id', { count: 'exact', head: true }),
      consCount().eq('status', 'waiting').not('entered_call_at', 'is', null),
      consCount().in('status', IN_PROGRESS_STATUSES),
      consCount().in('status', CLOSED_STATUSES),
      consCount().eq('status', 'urgent_in_person')
    ])

    setCounts({
      doctors: doctorsCnt.count || 0,
      patients: patientsCnt.count || 0,
      waiting: waitingCnt.count || 0,
      open: openCnt.count || 0,
      closed: closedCnt.count || 0,
      urgent: urgentCnt.count || 0
    })
  }

  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Dashboard administrativo" profile={profile}>
      <div className="dash-kpis">
        <Kpi value={counts.doctors} label="Médicos registrados" />
        <Kpi value={onlineDoctors.length} label="Médicos online" />
        <Kpi value={counts.patients} label="Pacientes registrados" />
        <Kpi value={counts.waiting} label="Consultas esperando" />
        <Kpi value={counts.open} label="Consultas en progreso" />
        <Kpi value={counts.closed} label="Consultas cerradas" />
      </div>

      {counts.urgent > 0 && (
        <div className="notice notice-danger">
          <strong>{counts.urgent}</strong> consultas marcadas como urgentes/presenciales.
        </div>
      )}
    </AdminLayout>
  )
}
