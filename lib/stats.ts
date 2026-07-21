// Cliente para GET /api/v1/stats/dashboard (backend api-medicos-por-venezuela). Sustituye a las
// 7 consultas directas que el dashboard admin hacía antes contra Supabase (ver
// pages/admin/dashboard.tsx) por una sola llamada autenticada.
import { getJson } from './apiClient'

export interface DashboardStats {
  doctors_registered: number
  doctors_online: number
  patients_registered: number
  consultations_waiting: number
  consultations_in_progress: number
  consultations_closed: number
  consultations_urgent: number
}

// GET /api/v1/stats/dashboard — requiere Bearer (permiso `stats.read`; admin y super_admin lo
// tienen por defecto).
export async function fetchDashboardStats(token: string): Promise<DashboardStats> {
  return getJson<DashboardStats>(
    '/api/v1/stats/dashboard',
    'No se pudieron cargar las estadísticas del dashboard',
    token
  )
}
