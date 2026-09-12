// Tabla genérica de un `ReportPreview` —las columnas y filas que manda el backend— con su
// paginación. La usan Reportes y Marketing: las dos pintan lo que venga sin conocer los campos, que
// es lo que garantiza que la tabla que se ve y el Excel que se descarga tengan las mismas columnas.
import type { ReportPreview } from '../../lib/reports'

type Row = ReportPreview['rows'][number]

// Las fechas llegan del backend YA convertidas a hora de Venezuela y SIN zona (un ISO naive,
// p. ej. "2026-09-03T14:30:00"). Se formatean como texto a propósito: pasarlas por `new Date()`
// haría que el navegador las interprete como hora local del equipo y volviera a desplazarlas —
// un admin en España vería +6 horas sobre la hora que dice el Excel del mismo reporte.
function fmtNaive(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return value
  const [, y, mo, d, hh, mm] = m
  return `${d}/${mo}/${y} ${hh}:${mm}`
}

function cellText(value: string | number | null | undefined, kind: 'text' | 'datetime'): string {
  if (value === null || value === undefined || value === '') return '—'
  if (kind === 'datetime' && typeof value === 'string') return fmtNaive(value)
  return String(value)
}

export default function ReportTable({
  preview,
  loading,
  page,
  pageSize,
  onPageChange,
  emptyText,
  rowKey = (_row, index) => String(index),
  wrapText = false
}: {
  preview: ReportPreview | null
  loading: boolean
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  emptyText: string
  rowKey?: (row: Row, index: number) => string
  // Texto libre largo (las respuestas de una encuesta): las celdas de texto se parten en varias
  // líneas en vez de estirar la tabla a lo ancho. Las fechas nunca se parten.
  wrapText?: boolean
}) {
  const columns = preview?.columns ?? []
  const total = preview?.total ?? 0

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ whiteSpace: 'nowrap' }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!preview || preview.rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} style={{ color: '#64748b' }}>
                  {loading ? 'Cargando...' : emptyText}
                </td>
              </tr>
            ) : (
              preview.rows.map((row, i) => (
                <tr key={rowKey(row, i)}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      // `pre-wrap` parte solo entre palabras (y respeta los saltos de línea de un
                      // texto libre): un correo nunca se corta a la mitad, estira su columna.
                      style={
                        wrapText && c.kind !== 'datetime'
                          ? { minWidth: 180, maxWidth: 360, whiteSpace: 'pre-wrap' }
                          : { whiteSpace: 'nowrap' }
                      }
                    >
                      {cellText(row[c.key], c.kind)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginTop: 12,
          flexWrap: 'wrap'
        }}
      >
        <span style={{ color: '#64748b', fontSize: 13 }}>
          {total === 0
            ? 'Sin resultados'
            : `Mostrando ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} de ${total}`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-muted"
            disabled={page === 0 || loading}
            onClick={() => onPageChange(Math.max(0, page - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn btn-muted"
            disabled={(page + 1) * pageSize >= total || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </>
  )
}
