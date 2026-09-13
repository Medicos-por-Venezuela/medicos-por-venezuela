// "Respuestas desde el envío": respuestas acumuladas por hora (o por día) desde el primer envío,
// con cada envío marcado sobre el eje. Es la gráfica para decidir CUÁNDO actuar: si la curva ya se
// aplanó, es momento de un recordatorio; si sigue subiendo, todavía no.
//
// SVG propio, sin librería. Se puede recorrer con el teclado (flechas) además de con el ratón, y
// el resumen va en `aria-label` para lectores de pantalla.
import { KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MarketingPerformance, SurveySlug } from '../../../lib/marketing'
import type { Scope } from './CampaignPerformance'
import {
  fmtDateTime,
  fmtDay,
  fmtHour,
  fmtInt,
  SURVEY_COLORS,
  SURVEY_LABELS,
  SURVEY_ORDER
} from './format'

const HEIGHT = 280
const MARGIN = { top: 24, right: 16, bottom: 44, left: 44 }

// Escala "redonda" para el eje Y (1, 2 o 5 × 10ⁿ), con pasos enteros: son personas.
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return Math.max(1, nice * power)
}

// El tooltip va del lado contrario al cursor, para no tapar los puntos que describe. En un teléfono
// no hay sitio a los lados: se centra sobre el cursor, sin salirse de la gráfica.
function tooltipPosition(pointX: number, width: number) {
  if (width < 520) {
    return {
      left: Math.min(Math.max(pointX, 100), width - 100),
      top: MARGIN.top,
      transform: 'translateX(-50%)'
    }
  }
  return pointX > width / 2
    ? { left: pointX - 14, top: MARGIN.top, transform: 'translateX(-100%)' }
    : { left: pointX + 14, top: MARGIN.top }
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export default function ResponsesTimeline({
  perf,
  scope
}: {
  perf: MarketingPerformance
  scope: Scope
}) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const { granularity, buckets, responses } = perf.timeline

  const series = useMemo(() => {
    const slugs: SurveySlug[] = scope === 'todas' ? SURVEY_ORDER : [scope]
    return slugs.map((slug) => {
      const fresh = responses[slug] ?? []
      let running = 0
      return {
        slug,
        fresh,
        cumulative: fresh.map((n) => (running += n)),
        total: fresh.reduce((a, b) => a + b, 0)
      }
    })
  }, [responses, scope])
  const slugs = series.map((s) => s.slug)

  const total = series.reduce((acc, s) => acc + s.total, 0)
  const stepMs = granularity === 'hour' ? 3_600_000 : 86_400_000
  const campaigns = perf.surveys
    .filter((s) => slugs.includes(s.survey))
    .flatMap((s) => s.campaigns.map((c) => ({ ...c, survey: s.survey })))

  // Lo que se lee de un vistazo: el tramo con más respuestas nuevas y en cuánto tiempo desde el
  // primer envío llegó el 80 % de lo recibido (con menos de 10 respuestas no dice nada).
  const perBucket = buckets.map((_, i) => series.reduce((acc, s) => acc + (s.fresh[i] ?? 0), 0))
  const peakIndex = perBucket.reduce((best, n, i) => (n > perBucket[best] ? i : best), 0)
  const firstSent = campaigns.length
    ? Math.min(...campaigns.map((c) => new Date(c.sent_at).getTime()))
    : null
  let to80: string | null = null
  if (firstSent !== null && total >= 10 && buckets.length) {
    let running = 0
    let index = perBucket.length - 1
    for (const [i, n] of perBucket.entries()) {
      running += n
      if (running >= total * 0.8) {
        index = i
        break
      }
    }
    const reachedAt = new Date(buckets[index]).getTime() + stepMs
    const hours = Math.max(1, Math.round((reachedAt - firstSent) / 3_600_000))
    to80 = hours < 48 ? `${fmtInt(hours)} h` : `${fmtInt(Math.round(hours / 24))} días`
  }

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const maxValue = Math.max(0, ...series.map((s) => s.cumulative[s.cumulative.length - 1] ?? 0))
  const yStep = niceStep(Math.max(maxValue, 4) / 4)
  const yMax = Math.max(yStep, Math.ceil(maxValue / yStep) * yStep)
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => i * yStep)
  const x = (i: number) =>
    MARGIN.left + (buckets.length > 1 ? (i / (buckets.length - 1)) * innerWidth : innerWidth / 2)
  const y = (v: number) => MARGIN.top + innerHeight - (v / yMax) * innerHeight
  const t0 = buckets.length ? new Date(buckets[0]).getTime() : 0
  const xAt = (iso: string) => x((new Date(iso).getTime() - t0) / stepMs)

  // Etiquetas del eje X: una cada tantos tramos, según el ancho. Por horas, el día se escribe
  // debajo solo cuando cambia, para no repetirlo en cada marca.
  const every = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(innerWidth / 80))))
  const ticks = buckets.map((iso, i) => ({ iso, i })).filter(({ i }) => i % every === 0)

  const pathFor = (values: number[]) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    setActive(Math.min(buckets.length - 1, Math.max(0, Math.round(ratio * (buckets.length - 1)))))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!buckets.length) return
    const last = buckets.length - 1
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? last) - 1),
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      Home: 0,
      End: last
    }
    if (event.key in moves) {
      event.preventDefault()
      setActive(moves[event.key])
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  const bucketLabel = (iso: string) => (granularity === 'hour' ? fmtDateTime(iso) : fmtDay(iso))
  const summary =
    total === 0
      ? 'Todavía no hay respuestas desde el envío.'
      : `Respuestas acumuladas: ${series
          .map((s) => `${SURVEY_LABELS[s.slug]} ${fmtInt(s.total)}`)
          .join(', ')}.`

  return (
    <section aria-labelledby="en-el-tiempo" className="card panel">
      <div className="head">
        <div>
          <h3 id="en-el-tiempo">Respuestas desde el envío</h3>
          <p className="hint">
            Acumuladas por {granularity === 'hour' ? 'hora' : 'día'}, en hora de Venezuela. Las
            líneas punteadas son los envíos.
          </p>
        </div>
        <dl className="facts">
          <div>
            <dt>En el periodo</dt>
            <dd>{fmtInt(total)}</dd>
          </div>
          {total > 0 && (
            <div>
              <dt>Pico</dt>
              <dd>
                {fmtInt(perBucket[peakIndex])}{' '}
                <small>
                  {granularity === 'hour'
                    ? fmtDateTime(buckets[peakIndex])
                    : fmtDay(buckets[peakIndex])}
                </small>
              </dd>
            </div>
          )}
          {to80 && (
            <div>
              <dt>80 % de las respuestas</dt>
              <dd>en {to80}</dd>
            </div>
          )}
        </dl>
      </div>

      {scope === 'todas' && (
        <ul className="legend">
          {series.map((s) => (
            <li key={s.slug}>
              <i style={{ background: SURVEY_COLORS[s.slug] }} aria-hidden="true" />
              {SURVEY_LABELS[s.slug]} <strong>{fmtInt(s.total)}</strong>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={ref}
        className="chart"
        tabIndex={0}
        role="group"
        aria-label={`${summary} Usa las flechas para recorrer la gráfica.`}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {width > 0 && buckets.length > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={summary}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.slug} id={`area-${s.slug}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={SURVEY_COLORS[s.slug]} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={SURVEY_COLORS[s.slug]} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + innerWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  className={tick === 0 ? 'axis' : 'grid'}
                />
                <text x={MARGIN.left - 10} y={y(tick)} className="y-label">
                  {fmtInt(tick)}
                </text>
              </g>
            ))}

            {ticks.map(({ iso, i }) => {
              const previous = i - every >= 0 ? buckets[i - every] : null
              const newDay =
                granularity === 'hour' && (!previous || fmtDay(previous) !== fmtDay(iso))
              return (
                <g key={iso}>
                  <text x={x(i)} y={HEIGHT - MARGIN.bottom + 18} className="x-label">
                    {granularity === 'hour' ? fmtHour(iso) : fmtDay(iso)}
                  </text>
                  {newDay && (
                    <text x={x(i)} y={HEIGHT - MARGIN.bottom + 34} className="x-day">
                      {fmtDay(iso)}
                    </text>
                  )}
                </g>
              )
            })}

            {campaigns.map((c) => {
              const cx = xAt(c.sent_at)
              if (cx < MARGIN.left || cx > MARGIN.left + innerWidth) return null
              return (
                <g key={c.id}>
                  <line
                    x1={cx}
                    x2={cx}
                    y1={MARGIN.top - 8}
                    y2={MARGIN.top + innerHeight}
                    className="send"
                    stroke={scope === 'todas' ? SURVEY_COLORS[c.survey] : '#475569'}
                  />
                  <title>{`Envío: ${c.subject} (${fmtDateTime(c.sent_at)})`}</title>
                </g>
              )
            })}

            {series.length === 1 && (
              <path
                d={`${pathFor(series[0].cumulative)} L${x(buckets.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
                fill={`url(#area-${series[0].slug})`}
              />
            )}
            {series.map((s) => (
              <path
                key={s.slug}
                d={pathFor(s.cumulative)}
                fill="none"
                stroke={SURVEY_COLORS[s.slug]}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {active !== null && (
              <g>
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={MARGIN.top}
                  y2={MARGIN.top + innerHeight}
                  className="guide"
                />
                {series.map((s) => (
                  <circle
                    key={s.slug}
                    cx={x(active)}
                    cy={y(s.cumulative[active] ?? 0)}
                    r={4.5}
                    fill="#ffffff"
                    stroke={SURVEY_COLORS[s.slug]}
                    strokeWidth={2.5}
                  />
                ))}
              </g>
            )}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        )}

        {active !== null && width > 0 && (
          <div className="tooltip" role="status" style={tooltipPosition(x(active), width)}>
            <div className="when">{bucketLabel(buckets[active])}</div>
            {series.map((s) => (
              <div key={s.slug} className="line">
                <i style={{ background: SURVEY_COLORS[s.slug] }} aria-hidden="true" />
                <span>{SURVEY_LABELS[s.slug]}</span>
                <strong>{fmtInt(s.cumulative[active] ?? 0)}</strong>
                <small>+{fmtInt(s.fresh[active] ?? 0)}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .panel {
          margin: 0;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        h3 {
          margin: 0;
          font-size: 16px;
          color: #0f172a;
        }
        .hint {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
        }
        .facts {
          display: flex;
          gap: 24px;
          margin: 0;
        }
        .facts dt {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }
        .facts dd {
          margin: 2px 0 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
        }
        .facts small {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
        }
        .legend {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          margin: 16px 0 0;
          padding: 0;
          font-size: 13px;
          color: #334155;
        }
        .legend i,
        .line i {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 6px;
        }
        .chart {
          position: relative;
          margin-top: 12px;
          border-radius: 10px;
          outline: none;
        }
        .chart:focus-visible {
          box-shadow: 0 0 0 3px #b9dccf;
        }
        svg {
          display: block;
          overflow: visible;
        }
        .grid {
          stroke: #eef2f6;
        }
        .axis {
          stroke: #cbd5e1;
        }
        .y-label {
          fill: #64748b;
          font-size: 12px;
          text-anchor: end;
          dominant-baseline: middle;
          font-variant-numeric: tabular-nums;
        }
        .x-label {
          fill: #64748b;
          font-size: 12px;
          text-anchor: middle;
        }
        .x-day {
          fill: #334155;
          font-size: 11px;
          font-weight: 700;
          text-anchor: middle;
        }
        .send {
          stroke-width: 1.5;
          stroke-dasharray: 4 4;
          opacity: 0.8;
        }
        .guide {
          stroke: #94a3b8;
          stroke-width: 1;
        }
        .tooltip {
          position: absolute;
          pointer-events: none;
          background: #0f172a;
          color: #f8fafc;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          min-width: 200px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
        }
        .when {
          font-weight: 700;
          margin-bottom: 6px;
        }
        .line {
          display: grid;
          grid-template-columns: auto 1fr auto auto;
          align-items: center;
          gap: 8px;
          line-height: 1.7;
        }
        .line strong {
          font-variant-numeric: tabular-nums;
        }
        .line small {
          color: #94a3b8;
          font-variant-numeric: tabular-nums;
        }
        @media (max-width: 640px) {
          .facts {
            gap: 16px;
            flex-wrap: wrap;
          }
          .facts small {
            display: block;
          }
        }
      `}</style>
    </section>
  )
}
