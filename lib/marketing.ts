// Cliente de las encuestas de marketing del backend (`/api/v1/marketing/surveys/*`).
//
// Dos públicos distintos:
//   · El formulario PÚBLICO (`/encuesta/<slug>`), al que el médico llega desde el correo masivo y
//     que responde sin sesión.
//   · El módulo Marketing del panel (solo super_admin, permiso `marketing.read`), que lista y
//     exporta las respuestas —con el mismo contrato genérico que los reportes (`ReportPreview`:
//     columnas + filas), así que se pinta con la misma tabla— y pinta sus totales y gráficos.
import { getFile, getJson, postJson } from './apiClient'
import { ReportPreview, saveBlob } from './reports'

// El mismo slug en la URL pública, en el endpoint y en la base: no hay equivalencias que mantener.
export type SurveySlug = 'psicologos' | 'especialistas' | 'medicos-generales'

// Lo que manda el formulario. Las opciones van como CÓDIGOS ('atender_pacientes'), no con su
// texto: el backend valida los códigos de cada encuesta y resuelve las etiquetas al listar.
export interface SurveyAnswers {
  email: string
  roles: string[]
  role_active_detail: string | null
  role_other_detail: string | null
  moments: string[]
  days: string[]
  weekly_hours: string | null
  availability_notes: string | null
  timezone: string | null
  timezone_other: string | null
  notes: string | null
  // Honeypot anti-bot (el mismo del registro de médicos): debe llegar vacío.
  website: string
}

export interface SurveyReceipt {
  survey: SurveySlug
  created_at: string
  updated_at: string
}

export function submitSurveyResponse(
  survey: SurveySlug,
  answers: SurveyAnswers
): Promise<SurveyReceipt> {
  return postJson<SurveyReceipt>(
    `/api/v1/marketing/surveys/${survey}/responses`,
    answers,
    'No pudimos guardar tu respuesta'
  )
}

// Filtros del listado. Espejo de `response_filters` en el router del backend.
export interface SurveyResponseFilters {
  search?: string // correo
  answered_from?: string // 'YYYY-MM-DD', sobre la última respuesta
  answered_to?: string
}

// Los filtros vacíos se OMITEN: `?answered_from=` haría que FastAPI intente parsear '' como fecha
// y devuelva un 422 en vez de "sin filtro" (mismo criterio que lib/reports.ts).
function toQuery(
  filters: SurveyResponseFilters | SurveyStatsFilters,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function fetchSurveyResponses(
  survey: SurveySlug,
  filters: SurveyResponseFilters,
  page: { skip: number; limit: number },
  token: string
): Promise<ReportPreview> {
  const query = toQuery(filters, { skip: String(page.skip), limit: String(page.limit) })
  return getJson<ReportPreview>(
    `/api/v1/marketing/surveys/${survey}/responses${query}`,
    'No se pudieron cargar las respuestas',
    token
  )
}

// El .xlsx con TODAS las respuestas que cumplen el filtro. Por fetch + blob por el mismo motivo
// que los reportes: el endpoint exige el JWT en una cabecera, que un `<a href>` no manda.
export async function downloadSurveyResponses(
  survey: SurveySlug,
  filters: SurveyResponseFilters,
  token: string
): Promise<string> {
  const { blob, filename } = await getFile(
    `/api/v1/marketing/surveys/${survey}/responses/export${toQuery(filters)}`,
    'No se pudieron exportar las respuestas',
    token
  )
  const name = filename || `encuesta-${survey}.xlsx`
  saveBlob(blob, name)
  return name
}

export interface SurveyTotal {
  survey: SurveySlug
  total: number
}

// Respuestas de cada encuesta, sin filtros: el número de cada pestaña.
export function fetchSurveyTotals(token: string): Promise<SurveyTotal[]> {
  return getJson<SurveyTotal[]>(
    '/api/v1/marketing/surveys',
    'No se pudieron cargar los totales',
    token
  )
}

export interface OptionCount {
  code: string
  label: string // el texto que vio quien respondió, el de ESA encuesta
  count: number // respuestas que marcaron la opción
}

// Agregados de una encuesta. Espejo de `SurveyStatsResponse` en el backend. Cada lista trae TODAS
// las opciones de la pregunta en el orden del formulario, también las que tienen 0.
export interface SurveyStats {
  survey: SurveySlug
  total: number
  filters: [string, string][]
  roles: OptionCount[]
  days: OptionCount[]
  moments: OptionCount[]
  // `availability[i][j]`: respuestas que marcaron el día `days[i]` y el momento `moments[j]`.
  // Día y momento se preguntan por separado, así que es cobertura posible, no un turno pactado.
  availability: number[][]
  weekly_hours: OptionCount[]
  min_weekly_hours: number
  timezones: OptionCount[] | null // null en la encuesta que no lo pregunta (médicos generales)
}

export interface SurveyStatsFilters {
  role?: string // código de una forma de participar de ESA encuesta
  answered_from?: string
  answered_to?: string
}

export function fetchSurveyStats(
  survey: SurveySlug,
  filters: SurveyStatsFilters,
  token: string
): Promise<SurveyStats> {
  return getJson<SurveyStats>(
    `/api/v1/marketing/surveys/${survey}/stats${toQuery(filters)}`,
    'No se pudieron cargar los gráficos',
    token
  )
}
