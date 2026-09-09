// Cliente de los reportes del backend (`GET /api/v1/reports/*`): vista previa en JSON y
// exportación a Excel de médicos, pacientes y consultas. Solo super_admin (permiso `reports.export`).
//
// El contrato es GENÉRICO a propósito: el backend manda `columns` (clave + cabecera) junto a las
// `rows`, y la tabla se pinta recorriendo esas columnas. Así el reporte gana campos sin tocar
// este archivo ni la página — y, sobre todo, la tabla que se ve y el Excel que se descarga no
// pueden mostrar columnas distintas, porque salen de la misma respuesta.
import { getFile, getJson } from './apiClient'

export type ReportKind = 'doctors' | 'patients' | 'consultations'

export interface ReportColumn {
  key: string
  header: string
  kind: 'text' | 'datetime'
}

export interface ReportPreview {
  columns: ReportColumn[]
  // Valores ya presentados por el backend (etiquetas en español, "Sí"/"No", fechas ISO).
  rows: Record<string, string | number | null>[]
  // Filas que cumplen el filtro: lo que traerá el Excel, no lo que cabe en esta página.
  total: number
  // Filtros aplicados, legibles, como pares [etiqueta, valor]. Los mismos que imprime la
  // portada del archivo exportado.
  filters: [string, string][]
}

// Filtros de médicos. Espejo de `doctor_filters` en el router del backend; los cinco primeros
// son los mismos que usa la tabla de /admin/doctores.
export interface DoctorReportFilters {
  status?: string // '0' de baja | '1' activo | '2' expulsado
  verified?: string // 'true' | 'false'
  can_practice?: string // 'true' | 'false'
  blocked_reason?: string
  search?: string
  specialty_id?: string
  professional_type_id?: string
  created_from?: string
  created_to?: string
}

// Filtros de pacientes. Espejo de `patient_filters` en el router del backend.
export interface PatientReportFilters {
  search?: string
  origin?: string // 'publica' | 'consultorio'
  affected_zone?: string
  age_range?: string
  need_tag?: string
  has_account?: string // 'true' | 'false'
  has_consultations?: string // 'true' | 'false'
  consent?: string // 'true' | 'false'
  include_archived?: string // 'true'
  created_from?: string
  created_to?: string
}

// Filtros de consultas. Espejo de `consultation_filters` en el router del backend.
//
// `status` es una LISTA (el backend acepta el parámetro repetido) y no una cadena: el informe
// por defecto es el set del monitor del dashboard, que son seis estados a la vez. Con un solo
// valor habría que inventar un alias tipo "en_progreso" y mantener su definición en dos sitios.
export interface ConsultationReportFilters {
  status?: string[]
  assigned_doctor_id?: string
  specialty_id?: string
  unassigned?: string // 'true' | 'false'
  search?: string
  created_from?: string
  created_to?: string
}

// `status` COLISIONA entre reportes y por eso se declara aparte, en vez de dejar que el
// intersection lo resuelva: en médicos es un código único ('0'|'1'|'2') y en consultas una lista
// de estados. Sin sacarlo, TypeScript infiere `string & string[]` —un tipo que nada satisface— y
// el error aparece lejos, en la página. Nunca se usan a la vez: cada reporte lee el suyo.
export type ReportFilters = Omit<DoctorReportFilters, 'status'> &
  PatientReportFilters &
  Omit<ConsultationReportFilters, 'status'> & {
    status?: string | string[]
  }

// Lee un filtro que puede ser lista como texto, para los `<select>` de valor único. Devuelve ''
// si lo que hay es una lista: un select no puede representarla, y pintar "a,b" sería peor.
export function filterText(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

// Los filtros vacíos se OMITEN de la query, no se envían como cadena vacía: `?status=` haría
// que FastAPI intente parsear '' como entero y devuelva un 422 en vez de "sin filtro".
function toQuery(filters: ReportFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value === undefined || value === null || value === '') continue
    // Un array se manda como parámetro REPETIDO (`?status=a&status=b`), que es lo que espera
    // FastAPI para un `list[str]`. Serializarlo con `String(value)` produciría "a,b" y el
    // backend lo tomaría como un único estado inexistente.
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      for (const v of value) params.append(key, v)
      continue
    }
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

// Nombre de archivo de respaldo por si la cabecera `Content-Disposition` no llegara; el bueno,
// con fecha de Venezuela, lo fija el backend.
const FALLBACK_FILENAMES: Record<ReportKind, string> = {
  doctors: 'medicos',
  patients: 'pacientes',
  consultations: 'consultas'
}

// Una página del reporte + el total que se exportaría. Sirve para ajustar el filtro ANTES de
// descargar: el total dice cuántas filas traería el archivo.
export async function fetchReportPreview(
  kind: ReportKind,
  filters: ReportFilters,
  page: { skip: number; limit: number },
  token: string
): Promise<ReportPreview> {
  const query = toQuery(filters, { skip: String(page.skip), limit: String(page.limit) })
  return getJson<ReportPreview>(
    `/api/v1/reports/${kind}${query}`,
    'No se pudo cargar la vista previa del reporte',
    token
  )
}

// Descarga el .xlsx con TODAS las filas que cumplen el filtro y se lo entrega al navegador.
//
// El endpoint exige el JWT en `Authorization`, y un `<a href>` no manda cabeceras: por eso hay
// que traer el archivo por fetch y disparar la descarga desde un blob. La URL del objeto se
// revoca al terminar; si no, el blob (que puede pesar megas) queda retenido hasta que se
// recargue la página.
export async function downloadReport(
  kind: ReportKind,
  filters: ReportFilters,
  token: string
): Promise<string> {
  const { blob, filename } = await getFile(
    `/api/v1/reports/${kind}/export${toQuery(filters)}`,
    'No se pudo exportar el reporte',
    token
  )
  // Fallback solo por si la cabecera no llegara (ver `filenameFromDisposition`): el nombre
  // bueno, con fecha de Venezuela, lo fija el backend.
  const name = filename || `${FALLBACK_FILENAMES[kind]}.xlsx`
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
  return name
}
