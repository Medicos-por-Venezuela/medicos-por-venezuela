import { getJson } from './apiClient'
import { SPECIALTIES } from './utils'

// Backend (api-medicos-por-venezuela) is always tried first; these are only the
// fallback if it's unreachable — the form must never break because the backend is down.
// (Used to gate on a separate NEXT_PUBLIC_API_BASE_URL that was never set in .env, so
// these calls silently never reached the backend — see lib/apiClient.ts's API_URL,
// which both this module and lib/doctors.ts/lib/patients.ts now share.)
const ZONAS_FALLBACK = [
  'La Guaira - Catia La Mar',
  'La Guaira - Maiquetía',
  'La Guaira - La Guaira (centro)',
  'La Guaira - Macuto',
  'La Guaira - Caraballeda',
  'La Guaira - Naiguatá',
  'La Guaira - Carayaca',
  'La Guaira - Caruao',
  'La Guaira - Otro sector',
  'Caracas - Centro',
  'Caracas - Este',
  'Caracas - Oeste',
  'Caracas - Sur',
  'Miranda',
  'Aragua',
  'Carabobo',
  'Otro'
]

export async function fetchSpecialtyCatalog(): Promise<string[]> {
  try {
    const data = await getJson<{ name: string }[]>(
      '/api/v1/specialties',
      'No se pudo cargar especialidades'
    )
    const names = data.map((s) => s.name).filter(Boolean)
    return names.length ? names : SPECIALTIES
  } catch (e) {
    console.error('No se pudo cargar el catálogo de especialidades del backend:', e)
    return SPECIALTIES
  }
}

export async function fetchAffectedZoneCatalog(): Promise<string[]> {
  try {
    const data = await getJson<{ name: string; state: string }[]>(
      '/api/v1/affected-zones/list',
      'No se pudo cargar zonas afectadas'
    )
    // Zonas de estado completo (sin desglose de sector) se sembraron con name === state
    // (ej. "Miranda"/"Miranda"): mostrar solo el estado en vez de "Miranda - Miranda".
    const zones = data
      .map((z) => (z.state === z.name ? z.state : `${z.state} - ${z.name}`))
      .filter(Boolean)
    return zones.length ? zones : ZONAS_FALLBACK
  } catch (e) {
    console.error('No se pudo cargar el catálogo de zonas afectadas del backend:', e)
    return ZONAS_FALLBACK
  }
}
