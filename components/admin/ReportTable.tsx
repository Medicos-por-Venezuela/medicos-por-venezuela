// Tabla genérica de un `ReportPreview` —las columnas y filas que manda el backend— con su
// paginación. La usan Reportes y Marketing: las dos pintan lo que venga sin conocer los campos, que
// es lo que garantiza que la tabla que se ve y el Excel que se descarga tengan las mismas columnas.
import { useState } from 'react'
import type { ReportPreview } from '../../lib/reports'

type Row = ReportPreview['rows'][number]

// Con `wrapText`, un texto más largo que esto se recorta y lleva "Ver más". Sin el recorte, una sola
// respuesta con varias opciones marcadas estiraba su fila hasta nueve o diez líneas, y el listado se
// volvía una columna interminable. Solo en pantalla: el Excel trae siempre el texto completo.
const PREVIEW_CHARS = 60

// Recorta en el último espacio antes del límite, para no dejar una palabra partida; si no hay un
// espacio razonablemente cerca (una URL, un correo), corta en el límite.
function shorten(text: string): string {
  const cut = text.slice(0, PREVIEW_CHARS)
  const space = cut.lastIndexOf(' ')
  return `${(space > PREVIEW_CHARS / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

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
  // Celdas desplegadas, por `rowKey:columna`. Cada celda se abre por separado: en una fila con varias
  // respuestas largas, desplegar una no tiene por qué alargar las demás.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  function toggle(cell: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cell)) next.delete(cell)
      else next.add(cell)
      return next
    })
  }

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
              preview.rows.map((row, i) => {
                const key = rowKey(row, i)
                return (
                  <tr key={key}>
                    {columns.map((c) => {
                      const text = cellText(row[c.key], c.kind)
                      const cell = `${key}:${c.key}`
                      const long = wrapText && c.kind !== 'datetime' && text.length > PREVIEW_CHARS
                      const open = expanded.has(cell)
                      return (
                        <td
                          key={c.key}
                          // `pre-wrap` parte solo entre palabras (y respeta los saltos de línea de
                          // un texto libre): un correo nunca se corta a la mitad, estira su columna.
                          style={
                            wrapText && c.kind !== 'datetime'
                              ? { minWidth: 180, maxWidth: 360, whiteSpace: 'pre-wrap' }
                              : { whiteSpace: 'nowrap' }
                          }
                        >
                          {long && !open ? shorten(text) : text}
                          {long && (
                            <button
                              type="button"
                              className="link-button"
                              aria-expanded={open}
                              onClick={() => toggle(cell)}
                              style={{ display: 'block', marginTop: 4, fontSize: 13 }}
                            >
                              {open ? 'Ver menos' : 'Ver más'}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
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
