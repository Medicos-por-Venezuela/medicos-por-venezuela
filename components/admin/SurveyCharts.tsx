// Pestaña "Gráficos" del módulo Marketing: los agregados de una encuesta, para decidir con las
// respuestas sin leerlas una por una. Cuándo hay cobertura, cuántas horas ofrecen, cómo quieren
// participar y desde dónde se conectan.
//
// Sin librería de gráficos a propósito: son barras y una tabla de calor, que el HTML pinta solo, y
// no justifican una dependencia nueva (su peso en el bundle, sus CVE). Además, la tabla de calor
// sigue siendo una <table>: se lee con lector de pantalla y se puede copiar a una hoja de cálculo.
import { useEffect, useState } from 'react'
import { Kpi } from './AdminLayout'
import { getAccessToken } from '../../lib/admin'
import { ApiError } from '../../lib/apiClient'
import {
  fetchSurveyStats,
  OptionCount,
  SurveySlug,
  SurveyStats,
  SurveyStatsFilters
} from '../../lib/marketing'

const MUTED = { margin: '0 0 14px', color: '#64748b', fontSize: 14 } as const

// El par día × momento con más respuestas, sin contar "Es variable": una franja que no es una
// franja no sirve para armar un turno. `null` si ninguna franja concreta tiene a nadie.
function bestSlot(stats: SurveyStats): { label: string; count: number } | null {
  let best: { label: string; count: number } | null = null
  for (const [i, day] of stats.days.entries()) {
    for (const [j, moment] of stats.moments.entries()) {
      if (day.code === 'variable' || moment.code === 'variable') continue
      const count = stats.availability[i]?.[j] ?? 0
      if (count > 0 && (!best || count > best.count)) {
        best = { label: `${day.label} · ${moment.label}`, count }
      }
    }
  }
  return best
}

const plural = (n: number) => `${n} ${n === 1 ? 'respuesta' : 'respuestas'}`

export default function SurveyCharts({
  surveys,
  initialSurvey
}: {
  surveys: { slug: SurveySlug; label: string }[]
  initialSurvey: SurveySlug
}) {
  const [survey, setSurvey] = useState<SurveySlug>(initialSurvey)
  const [filters, setFilters] = useState<SurveyStatsFilters>({})
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // `cancelled` descarta la respuesta de una petición que ya no corresponde, como en la lista:
  // cambiar rápido de encuesta no puede pintar los gráficos de la anterior bajo el nombre de otra.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchSurveyStats(survey, filters, await getAccessToken())
        if (!cancelled) setStats(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los gráficos.')
          setStats(null)
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [survey, filters])

  function setFilter(key: keyof SurveyStatsFilters, value: string) {
    setFilters((prev) => {
      if ((prev[key] ?? '') === value) return prev
      const next = { ...prev }
      if (value === '') delete next[key]
      else next[key] = value
      return next
    })
  }

  // Las formas de participar son distintas en cada encuesta: la elegida no existe en la siguiente
  // (el backend respondería 422), así que se suelta. Las fechas sí se conservan.
  function switchSurvey(next: SurveySlug) {
    setSurvey(next)
    setFilters((prev) => {
      if (!prev.role) return prev
      const rest = { ...prev }
      delete rest.role
      return rest
    })
  }

  // Solo los gráficos de la encuesta elegida: mientras llegan los de la nueva, los de la anterior no
  // se enseñan con otro nombre encima.
  const current = stats?.survey === survey ? stats : null
  const best = current ? bestSlot(current) : null

  return (
    <>
      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Filtros</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select
            aria-label="Encuesta"
            style={{ flex: '0 1 200px' }}
            value={survey}
            onChange={(e) => switchSurvey(e.target.value as SurveySlug)}
          >
            {surveys.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Cómo quieren participar"
            style={{ flex: '1 1 260px' }}
            value={filters.role ?? ''}
            disabled={!current}
            onChange={(e) => setFilter('role', e.target.value)}
          >
            <option value="">Todas las formas de participar</option>
            {(current?.roles ?? []).map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            style={{ flex: '0 1 150px' }}
            value={filters.answered_from ?? ''}
            onChange={(e) => setFilter('answered_from', e.target.value)}
            title="Respondieron desde (inclusive)"
            aria-label="Respondieron desde"
          />
          <input
            type="date"
            style={{ flex: '0 1 150px' }}
            value={filters.answered_to ?? ''}
            onChange={(e) => setFilter('answered_to', e.target.value)}
            title="Respondieron hasta (inclusive)"
            aria-label="Respondieron hasta"
          />
          <button type="button" className="btn btn-muted" onClick={() => setFilters({})}>
            Limpiar filtros
          </button>
        </div>
        <p style={{ ...MUTED, margin: '12px 0 0', fontSize: 13 }}>
          Elige una forma de participar para ver solo a quienes la marcaron: por ejemplo, la
          cobertura de quienes van a atender pacientes.
        </p>
        {current && current.filters.length > 0 && (
          <div className="tag-row" style={{ marginTop: 12 }}>
            {current.filters.map(([label, value]) => (
              <span key={label} className="badge badge-blue">
                {label}: {value}
              </span>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="notice notice-danger" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      {!current && loading && <p style={MUTED}>Cargando gráficos...</p>}

      {current && current.total === 0 && (
        <div className="notice notice-info">
          {current.filters.length > 0
            ? 'Ninguna respuesta coincide con estos filtros.'
            : 'Todavía no hay respuestas en esta encuesta.'}
        </div>
      )}

      {current && current.total > 0 && (
        <div aria-busy={loading} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="grid grid-3" style={{ marginBottom: 18 }}>
            <Kpi value={current.total} label="Respuestas" />
            <Kpi
              value={`${current.min_weekly_hours} h`}
              label="Horas por semana, como mínimo, entre todos"
            />
            <Kpi
              value={best ? best.count : '—'}
              label={
                best ? `Franja con más disponibilidad: ${best.label}` : 'Ninguna franja marcada'
              }
            />
          </div>

          <section className="card" style={{ marginBottom: 18 }}>
            <h2 style={{ marginTop: 0 }}>¿Cuándo hay disponibilidad?</h2>
            <p style={MUTED}>
              Cuántas respuestas marcaron cada día y cada momento: mientras más oscura la casilla,
              más cobertura. Día y momento se preguntan por separado, así que es cobertura posible:
              quien marcó lunes y sábado, mañana y noche, cuenta en las cuatro casillas.
            </p>
            <AvailabilityTable stats={current} />
          </section>

          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            <section className="card">
              <h2 style={{ marginTop: 0 }}>¿Cómo quieren participar?</h2>
              <p style={MUTED}>Pueden marcar varias formas: los porcentajes no suman 100.</p>
              <BarList items={current.roles} total={current.total} />
            </section>
            <section className="card">
              <h2 style={{ marginTop: 0 }}>¿Cuántas horas a la semana?</h2>
              <p style={MUTED}>
                Las horas mínimas suman el piso de cada rango: menos de 1 hora cuenta 0 y más de 6
                cuenta 6.
              </p>
              <BarList items={current.weekly_hours} total={current.total} />
            </section>
          </div>

          {current.timezones && (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>¿Desde dónde se conectan?</h2>
              <p style={MUTED}>Solo las zonas que alguien marcó, de la que más a la que menos.</p>
              <BarList items={current.timezones} total={current.total} hideEmpty sortByCount />
            </section>
          )}
        </div>
      )}
    </>
  )
}

// Tabla de calor días × momentos. La intensidad es relativa a la casilla con más respuestas; el
// número va siempre escrito, porque un color solo no se puede leer ni comparar con exactitud.
function AvailabilityTable({ stats }: { stats: SurveyStats }) {
  // La matriz trae solo los días y momentos del formulario; un código retirado que aparezca al final
  // de `days`/`moments` no tiene fila ni columna.
  const days = stats.days.slice(0, stats.availability.length)
  const moments = stats.moments.slice(0, stats.availability[0]?.length ?? 0)
  const max = Math.max(0, ...stats.availability.flat())

  return (
    <div className="scroll">
      <table>
        <caption className="sr-only">Respuestas por día de la semana y momento del día</caption>
        <thead>
          <tr>
            <th scope="col" className="day">
              Día
            </th>
            {moments.map((m) => (
              <th key={m.code} scope="col">
                {m.label}
              </th>
            ))}
            <th scope="col" className="total">
              Marcaron el día
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => (
            <tr key={day.code}>
              <th scope="row">{day.label}</th>
              {moments.map((moment, j) => {
                const count = stats.availability[i][j]
                const ratio = max ? count / max : 0
                return (
                  <td
                    key={moment.code}
                    className={count ? 'cell' : 'cell empty'}
                    aria-label={`${day.label}, ${moment.label}: ${plural(count)}`}
                    title={`${day.label} · ${moment.label}: ${plural(count)} de ${stats.total}`}
                    style={
                      count
                        ? {
                            background: `rgba(15, 110, 86, ${0.12 + 0.88 * ratio})`,
                            color: ratio > 0.5 ? '#ffffff' : '#0b4f3f'
                          }
                        : undefined
                    }
                  >
                    {count}
                  </td>
                )
              })}
              <td className="total">{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style jsx>{`
        .scroll {
          overflow-x: auto;
        }
        table {
          border-collapse: separate;
          border-spacing: 4px;
          min-width: 100%;
        }
        th {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          padding: 4px 6px;
          white-space: nowrap;
        }
        th[scope='row'],
        .day {
          text-align: left;
        }
        th[scope='row'] {
          color: #17202a;
          font-size: 14px;
        }
        .cell {
          min-width: 56px;
          height: 42px;
          border-radius: 8px;
          text-align: center;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .empty {
          background: #f1f5f9;
          color: #94a3b8;
          font-weight: 400;
        }
        .total {
          color: #64748b;
          text-align: center;
          font-variant-numeric: tabular-nums;
          padding: 0 6px;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
        }
        /* En un teléfono las cabeceras largas ("Es variable", "Marcaron el día") se parten en dos
           líneas y las casillas se estrechan: así la tabla entera cabe sin desplazarse de lado. */
        @media (max-width: 480px) {
          table {
            border-spacing: 3px;
          }
          th {
            white-space: normal;
            font-size: 11px;
            padding: 2px;
          }
          th[scope='row'] {
            font-size: 13px;
          }
          .cell {
            min-width: 34px;
            height: 36px;
            font-size: 13px;
          }
          .total {
            padding: 0 2px;
          }
        }
      `}</style>
    </div>
  )
}

// Barras horizontales. El 100 % es el total de respuestas (no la opción más votada): así una barra
// a media anchura dice "la mitad de quienes respondieron", que es lo que se quiere leer.
function BarList({
  items,
  total,
  hideEmpty = false,
  sortByCount = false
}: {
  items: OptionCount[]
  total: number
  hideEmpty?: boolean
  sortByCount?: boolean
}) {
  let rows = hideEmpty ? items.filter((i) => i.count > 0) : items
  if (sortByCount) rows = [...rows].sort((a, b) => b.count - a.count)

  return (
    <ul>
      {rows.map((item) => {
        const pct = total ? Math.round((item.count / total) * 100) : 0
        return (
          <li key={item.code}>
            <div className="head">
              <span>{item.label}</span>
              <span className="num">
                {item.count} <small>({pct}%)</small>
              </span>
            </div>
            <div className="track" aria-hidden="true">
              {/* Con 1 de 300 el porcentaje redondea a 0: un mínimo de 3 px evita que una opción
                  que alguien marcó se vea igual que una que nadie marcó. */}
              <div className="fill" style={{ width: `${pct}%`, minWidth: item.count ? 3 : 0 }} />
            </div>
          </li>
        )
      })}
      <style jsx>{`
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .num {
          font-weight: 700;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        small {
          color: #64748b;
          font-weight: 400;
        }
        .track {
          height: 10px;
          border-radius: 999px;
          background: #eef2f6;
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: 999px;
          background: #0f6e56;
        }
      `}</style>
    </ul>
  )
}
