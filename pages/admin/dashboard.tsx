import { useState } from 'react'
import AdminLayout, { AdminLoading, Kpi } from '../../components/admin/AdminLayout'
import ConsultationsMonitorModal from '../../components/admin/ConsultationsMonitorModal'
import DoctorPoolModal from '../../components/DoctorPoolModal'
import { getAccessToken, useAdminGuard } from '../../lib/admin'
import { fetchInProgressConsultations, ConsultationMonitorItem } from '../../lib/consultations'
import { usePolling } from '../../lib/hooks'
import { useOnlineDoctors } from '../../lib/presence'
import { DashboardStats, fetchDashboardStats } from '../../lib/stats'

const POLL_INTERVAL_MS = 30_000

export default function AdminDashboard() {
  const { profile, loading } = useAdminGuard()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsError, setStatsError] = useState('')

  // "Médicos online" en vivo por Realtime Presence (el admin solo observa, no se anuncia). El resto
  // de KPIs viene del backend, pero la presencia real es WebSocket, no el last_seen_at del backend.
  const onlineDoctors = useOnlineDoctors()

  const [poolOpen, setPoolOpen] = useState(false)

  const [monitorOpen, setMonitorOpen] = useState(false)
  const [monitorItems, setMonitorItems] = useState<ConsultationMonitorItem[]>([])
  const [monitorLoading, setMonitorLoading] = useState(false)
  const [monitorError, setMonitorError] = useState('')

  // Reemplaza las 7 consultas directas a Supabase por una sola llamada al backend
  // (GET /stats/dashboard). getAccessToken() puede fallar en el primer tick si la sesión de
  // useAdminGuard todavía no resolvió — el catch lo absorbe y el siguiente tick (30s) reintenta.
  async function loadStats() {
    try {
      const token = await getAccessToken()
      const data = await fetchDashboardStats(token)
      setStats(data)
      setStatsError('')
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'No se pudieron cargar las estadísticas.')
    }
  }

  // Carga una vez al montar + refresco periódico (~30s) sin useEffect crudo — ver lib/hooks.ts.
  usePolling(loadStats, POLL_INTERVAL_MS)

  // Handler de clic (no un efecto): trae el detalle solo cuando el admin abre el monitor.
  async function openMonitor() {
    setMonitorOpen(true)
    setMonitorLoading(true)
    setMonitorError('')
    try {
      const token = await getAccessToken()
      const items = await fetchInProgressConsultations(token)
      setMonitorItems(items)
    } catch (e) {
      setMonitorError(e instanceof Error ? e.message : 'No se pudo cargar el detalle.')
    } finally {
      setMonitorLoading(false)
    }
  }

  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Dashboard administrativo" profile={profile}>
      {statsError && (
        <div className="notice notice-danger" style={{ marginBottom: 16 }}>
          {statsError}
        </div>
      )}

      <div className="dash-kpis">
        <Kpi value={stats?.doctors_registered ?? '—'} label="Médicos registrados" />
        <Kpi
          value={onlineDoctors.length}
          label="Médicos online"
          onClick={() => setPoolOpen(true)}
        />
        <Kpi value={stats?.patients_registered ?? '—'} label="Pacientes registrados" />
        <Kpi value={stats?.consultations_waiting ?? '—'} label="Consultas esperando" />
        <Kpi
          value={stats?.consultations_in_progress ?? '—'}
          label="Consultas en progreso"
          onClick={openMonitor}
        />
        <Kpi value={stats?.consultations_closed ?? '—'} label="Consultas cerradas" />
      </div>

      {!!stats && stats.consultations_urgent > 0 && (
        <div className="notice notice-danger">
          <strong>{stats.consultations_urgent}</strong> consultas marcadas como
          urgentes/presenciales.
        </div>
      )}

      {/* excludeSelf={false}: el admin puede ser médico y estar online; el KPI (Presence) lo
          cuenta, así que la lista del pool debe incluirlo para que ambos cuadren. */}
      <DoctorPoolModal open={poolOpen} onClose={() => setPoolOpen(false)} excludeSelf={false} />

      <ConsultationsMonitorModal
        open={monitorOpen}
        onClose={() => setMonitorOpen(false)}
        items={monitorItems}
        loading={monitorLoading}
        error={monitorError}
        canExport={profile?.role === 'super_admin'}
      />
    </AdminLayout>
  )
}
