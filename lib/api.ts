import { SPECIALTIES } from './utils'

// Optional dedicated backend (api-medicos-por-venezuela). When unset, or when it's
// unreachable, every helper here falls back to the static catalogs — the form must
// never break because the backend is down or not configured for this environment.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL

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
  if (!API_BASE) return SPECIALTIES
  try {
    const res = await fetch(`${API_BASE}/specialties`)
    if (!res.ok) throw new Error(`status ${res.status}`)
    const data: { name: string }[] = await res.json()
    const names = data.map((s) => s.name).filter(Boolean)
    return names.length ? names : SPECIALTIES
  } catch (e) {
    console.error('No se pudo cargar el catálogo de especialidades del backend:', e)
    return SPECIALTIES
  }
}

export async function fetchAffectedZoneCatalog(): Promise<string[]> {
  if (!API_BASE) return ZONAS_FALLBACK
  try {
    const res = await fetch(`${API_BASE}/affected-zones/list`)
    if (!res.ok) throw new Error(`status ${res.status}`)
    const data: { name: string; state: string }[] = await res.json()
    const zones = data.map((z) => `${z.state} - ${z.name}`).filter(Boolean)
    return zones.length ? zones : ZONAS_FALLBACK
  } catch (e) {
    console.error('No se pudo cargar el catálogo de zonas afectadas del backend:', e)
    return ZONAS_FALLBACK
  }
}
