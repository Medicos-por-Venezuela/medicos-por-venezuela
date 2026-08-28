import { getJson } from './apiClient'
import { SPECIALTIES } from './utils'

// Backend (api-medicos-por-venezuela) is always tried first; these are only the
// fallback if it's unreachable — the form must never break because the backend is down.
// (Used to gate on a separate NEXT_PUBLIC_API_BASE_URL that was never set in .env, so
// these calls silently never reached the backend — see lib/apiClient.ts's API_URL,
// which both this module and lib/doctors.ts/lib/patients.ts now share.)
// Las zonas son los estados de Venezuela; espejo de db/migrations/20260802_120000_seed_zonas_estados_venezuela.sql.
const ZONAS_FALLBACK = [
  'Amazonas',
  'Anzoátegui',
  'Apure',
  'Aragua',
  'Barinas',
  'Bolívar',
  'Carabobo',
  'Cojedes',
  'Delta Amacuro',
  'Distrito Capital',
  'Falcón',
  'Guárico',
  'La Guaira',
  'Lara',
  'Mérida',
  'Miranda',
  'Monagas',
  'Nueva Esparta',
  'Portuguesa',
  'Sucre',
  'Táchira',
  'Trujillo',
  'Yaracuy',
  'Zulia'
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
      'No se pudo cargar zonas'
    )
    // Las zonas se siembran con name === state (ej. "Miranda"/"Miranda"): mostrar solo el
    // estado en vez de "Miranda - Miranda". El `${state} - ${name}` cubre filas heredadas
    // por sector que un admin pudiera volver a crear.
    const zones = data
      .map((z) => (z.state === z.name ? z.state : `${z.state} - ${z.name}`))
      .filter(Boolean)
    return zones.length ? zones : ZONAS_FALLBACK
  } catch (e) {
    console.error('No se pudo cargar el catálogo de zonas del backend:', e)
    return ZONAS_FALLBACK
  }
}

// Cifras de la portada. Llegan YA REDONDEADAS a la baja desde el backend (`GET /stats/public`,
// público, sin token): el conteo exacto no sale de la base, así que este cliente no tiene nada que
// redondear ni debe intentarlo.
export type PublicStats = {
  doctors: number
  consultations: number
  specialties: number
}

// Devuelve `null` —y no un fallback— cuando el backend no responde: las cifras de respaldo son
// copy aprobado y viven en `components/home/copy.ts`, junto al resto del texto del home. Meterlas
// aquí las dejaría a dos sitios de distancia de donde se editan.
export async function fetchPublicStats(): Promise<PublicStats | null> {
  try {
    return await getJson<PublicStats>('/api/v1/stats/public', 'No se pudieron cargar las cifras')
  } catch (e) {
    console.error('No se pudieron cargar las cifras públicas del backend:', e)
    return null
  }
}
