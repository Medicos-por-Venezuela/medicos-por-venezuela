// Cliente de los reportes del backend (`GET /api/v1/reports/*`): vista previa en JSON y
// exportación a Excel de médicos y pacientes. Solo super_admin (permiso `reports.export`).
//
// El contrato es GENÉRICO a propósito: el backend manda `columns` (clave + cabecera) junto a las
// `rows`, y la tabla se pinta recorriendo esas columnas. Así el reporte gana campos sin tocar
// este archivo ni la página — y, sobre todo, la tabla que se ve y el Excel que se descarga no
// pueden mostrar columnas distintas, porque salen de la misma respuesta.
import { getFile, getJson } from './apiClient'

export type ReportKind = 'doctors' | 'patients'

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

export type ReportFilters = DoctorReportFilters & PatientReportFilters

// Los filtros vacíos se OMITEN de la query, no se envían como cadena vacía: `?status=` haría
// que FastAPI intente parsear '' como entero y devuelva un 422 en vez de "sin filtro".
function toQuery(filters: ReportFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
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
  const name = filename || `${kind === 'doctors' ? 'medicos' : 'pacientes'}.xlsx`
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
