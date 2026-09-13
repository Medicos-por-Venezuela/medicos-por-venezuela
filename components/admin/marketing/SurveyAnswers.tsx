// "Qué respondieron": los agregados de las respuestas de UNA encuesta, para decidir sin leerlas una
// por una. Cuándo hay cobertura, cuántas horas ofrecen, cómo quieren participar y desde dónde se
// conectan. Se filtra por fechas y por forma de participar: la cobertura que sirve para armar
// turnos es la de quienes van a atender pacientes, no la de toda la encuesta.
//
// Se monta con `key={encuesta}`: al cambiar de encuesta arranca de cero, y un filtro de forma de
// participar de una encuesta no se arrastra a otra, donde no existe (el backend daría 422).
import { useEffect, useState } from 'react'
import { getAccessToken } from '../../../lib/admin'
import { ApiError } from '../../../lib/apiClient'
import {
  fetchSurveyStats,
  SurveySlug,
  SurveyStats,
  SurveyStatsFilters
} from '../../../lib/marketing'
import { useFilterState } from '../../../lib/useFilterState'
import AvailabilityHeatmap from './AvailabilityHeatmap'
import BarList from './BarList'
import { fmtInt } from './format'
import StatCard from './StatCard'

// Las franjas con más respuestas, sin contar "Es variable": una franja que no es una franja no
// sirve para armar un turno. Devuelve todas las empatadas, para no presentar como ganadora a la
// primera en orden de la semana.
function topSlots(stats: SurveyStats): { labels: string[]; count: number } {
  let best: { labels: string[]; count: number } = { labels: [], count: 0 }
  for (const [i, day] of stats.days.entries()) {
    for (const [j, moment] of stats.moments.entries()) {
      if (day.code === 'variable' || moment.code === 'variable') continue
      const count = stats.availability[i]?.[j] ?? 0
      const label = `${day.label} · ${moment.label}`
      if (count > best.count) best = { labels: [label], count }
      else if (count > 0 && count === best.count) best.labels.push(label)
    }
  }
  return best
}

export default function SurveyAnswers({ survey }: { survey: SurveySlug }) {
  const { filters, setFilter, clearFilters } = useFilterState<SurveyStatsFilters>()
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // `cancelled` descarta la respuesta de una petición que ya no corresponde a los filtros.
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
          setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las respuestas.')
          setStats(null)
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [survey, filters])

  const top = stats ? topSlots(stats) : null

  return (
    <section aria-labelledby="que-respondieron">
      <div className="section-head">
        <div>
          <h2 id="que-respondieron">Qué respondieron</h2>
          <p>Disponibilidad, horas y formas de participar de quienes respondieron.</p>
        </div>
        <div className="filters">
          <select
            aria-label="Cómo quieren participar"
            value={filters.role ?? ''}
            disabled={!stats}
            onChange={(e) => setFilter('role', e.target.value)}
          >
            <option value="">Todas las formas de participar</option>
            {(stats?.roles ?? []).map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.answered_from ?? ''}
            onChange={(e) => setFilter('answered_from', e.target.value)}
            title="Respondieron desde (inclusive)"
            aria-label="Respondieron desde"
          />
          <input
            type="date"
            value={filters.answered_to ?? ''}
            onChange={(e) => setFilter('answered_to', e.target.value)}
            title="Respondieron hasta (inclusive)"
            aria-label="Respondieron hasta"
          />
          <button type="button" className="btn btn-muted" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </div>

      {stats && stats.filters.length > 0 && (
        <div className="tag-row chips">
          {stats.filters.map(([label, value]) => (
            <span key={label} className="badge badge-blue">
              {label}: {value}
            </span>
          ))}
        </div>
      )}

      {error && <div className="notice notice-danger">{error}</div>}
      {!stats && loading && <div className="skeleton" aria-label="Cargando respuestas" />}

      {stats && stats.total === 0 && (
        <div className="notice notice-info">
          {stats.filters.length > 0
            ? 'Ninguna respuesta coincide con estos filtros.'
            : 'Todavía no hay respuestas en esta encuesta.'}
        </div>
      )}

      {stats && stats.total > 0 && (
        <div aria-busy={loading} className={loading ? 'content busy' : 'content'}>
          <div className="stats">
            <StatCard
              label="Respuestas"
              value={fmtInt(stats.total)}
              detail={stats.filters.length ? 'Con estos filtros' : 'Todas las de la encuesta'}
            />
            <StatCard
              label="Horas por semana"
              value={`${fmtInt(stats.min_weekly_hours)} h`}
              detail="Como mínimo, entre todos: suma el piso de cada rango"
            />
            <StatCard
              label="Franja con más disponibilidad"
              value={top && top.count ? fmtInt(top.count) : '—'}
              detail={
                top && top.count
                  ? top.labels.length > 1
                    ? `${top.labels[0]} (empata con ${top.labels.length - 1} más)`
                    : top.labels[0]
                  : 'Nadie marcó una franja concreta'
              }
            />
          </div>

          <div className="card panel">
            <h3>¿Cuándo hay disponibilidad?</h3>
            <p className="hint">
              Cuántas respuestas marcaron cada día y cada momento. Se preguntan por separado, así
              que es cobertura posible: quien marcó lunes y sábado, mañana y noche, cuenta en las
              cuatro casillas.
            </p>
            <AvailabilityHeatmap
              days={stats.days}
              moments={stats.moments}
              availability={stats.availability}
            />
          </div>

          <div className="grid grid-2 pair">
            <div className="card panel">
              <h3>¿Cómo quieren participar?</h3>
              <p className="hint">% de las respuestas. Pueden marcar varias: no suman 100 %.</p>
              <BarList items={stats.roles} total={stats.total} />
            </div>
            <div className="card panel">
              <h3>¿Cuántas horas a la semana?</h3>
              <p className="hint">% de las respuestas.</p>
              <BarList items={stats.weekly_hours} total={stats.total} />
            </div>
          </div>

          {stats.timezones && (
            <div className="card panel">
              <h3>¿Desde dónde se conectan?</h3>
              <p className="hint">
                % de las respuestas. Solo las zonas que alguien marcó, de la que más a la que menos.
              </p>
              <BarList items={stats.timezones} total={stats.total} hideEmpty sortByCount />
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        section {
          display: grid;
          gap: 16px;
        }
        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
        }
        h2 {
          margin: 0;
          font-size: 20px;
          color: #0f172a;
        }
        .section-head p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 14px;
        }
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .filters select {
          flex: 1 1 240px;
          max-width: 360px;
        }
        .filters input {
          flex: 0 1 150px;
        }
        .chips {
          margin: 0;
        }
        .content {
          display: grid;
          gap: 16px;
          transition: opacity 0.2s;
        }
        .busy {
          opacity: 0.6;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .panel {
          margin: 0;
        }
        .pair {
          gap: 16px;
        }
        h3 {
          margin: 0;
          font-size: 16px;
          color: #0f172a;
        }
        .hint {
          margin: 4px 0 16px;
          color: #64748b;
          font-size: 13px;
        }
        .skeleton {
          height: 320px;
          border-radius: 16px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e9eef4 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
        }
        @keyframes shimmer {
          to {
            background-position: -200% 0;
          }
        }
        @media (max-width: 850px) {
          .stats {
            grid-template-columns: 1fr;
          }
          .filters select {
            max-width: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .skeleton {
            animation: none;
          }
        }
      `}</style>
    </section>
  )
}
