// Pestaña "Gráficos" del módulo Marketing: el tablero para decidir con la campaña de las encuestas.
//
// De lo general a lo concreto, como se lee un tablero:
//   1. Embudo de la campaña: enviados → abrieron → clic → respondieron, con Kit + la plataforma.
//   2. Respuestas desde el envío: cuándo llegan, para decidir cuándo mandar un recordatorio.
//   3. Qué respondieron: la disponibilidad y las formas de participar de UNA encuesta.
// El selector de arriba acota los tres a una encuesta, o las junta todas.
//
// Kit es opcional: sin clave en la API, o con Kit caído, el tablero enseña lo de la plataforma y
// dice por qué falta lo demás, en vez de fallar entero.
import { useEffect, useState } from 'react'
import { getAccessToken } from '../../../lib/admin'
import { ApiError } from '../../../lib/apiClient'
import { fetchMarketingPerformance, MarketingPerformance } from '../../../lib/marketing'
import CampaignPerformance, { Scope, totalsFor } from './CampaignPerformance'
import { fmtAgo, fmtInt, fmtPct, rate, SURVEY_COLORS, SURVEY_LABELS, SURVEY_ORDER } from './format'
import ResponsesTimeline from './ResponsesTimeline'
import SurveyAnswers from './SurveyAnswers'

const SCOPES: Scope[] = ['todas', ...SURVEY_ORDER]
const scopeLabel = (s: Scope) => (s === 'todas' ? 'Todas' : SURVEY_LABELS[s])

export default function MarketingDashboard() {
  const [scope, setScope] = useState<Scope>('todas')
  const [perf, setPerf] = useState<MarketingPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 0 = la carga al abrir la pestaña; cada "Actualizar" lo sube y pide a la API que vuelva a
  // consultar a Kit. `cancelled` descarta una respuesta que llegue después de otra más nueva.
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchMarketingPerformance(reloads > 0, await getAccessToken())
        if (!cancelled) {
          setPerf(data)
          setError('')
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setError(
            e instanceof ApiError ? e.message : 'No se pudo cargar el rendimiento de la campaña.'
          )
        }
      }
      if (!cancelled) {
        setLoading(false)
        setRefreshing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloads])

  return (
    <div className="dashboard">
      <div className="toolbar">
        <div className="segmented" role="radiogroup" aria-label="Encuesta del tablero">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              className={scope === s ? 'on' : ''}
              onClick={() => setScope(s)}
            >
              {s !== 'todas' && <i style={{ background: SURVEY_COLORS[s] }} aria-hidden="true" />}
              {scopeLabel(s)}
            </button>
          ))}
        </div>
        <div className="freshness">
          {perf?.kit_status === 'ok' && perf.kit_fetched_at && (
            <span>Datos de Kit {fmtAgo(perf.kit_fetched_at)}</span>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setRefreshing(true)
              setReloads((n) => n + 1)
            }}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="notice notice-danger">{error}</div>}
      {perf?.kit_status === 'not_configured' && (
        <div className="notice notice-info">
          Kit no está conectado: falta <code>KIT_API_KEY</code> en la API. Se muestran las
          respuestas, pero no los enviados, aperturas ni clics.
        </div>
      )}
      {perf?.kit_status === 'unavailable' && (
        <div className="notice notice-warning">
          Kit no respondió, así que por ahora solo se muestran las respuestas. Prueba a actualizar
          en unos minutos.
        </div>
      )}

      {loading && !perf && (
        <div aria-label="Cargando el tablero" className="skeletons">
          <div className="skeleton row" />
          <div className="skeleton chart" />
        </div>
      )}

      {perf && (
        <>
          <CampaignPerformance perf={perf} scope={scope} />
          <ResponsesTimeline perf={perf} scope={scope} />
        </>
      )}

      {scope === 'todas' ? (
        perf && <PickSurvey perf={perf} onPick={setScope} />
      ) : (
        <SurveyAnswers key={scope} survey={scope} />
      )}

      <style jsx>{`
        .dashboard {
          display: grid;
          gap: 24px;
        }
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .segmented {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 4px;
          background: #eef2f6;
          border-radius: 12px;
        }
        .segmented button {
          border: 0;
          background: transparent;
          color: #475569;
          font-weight: 600;
          font-size: 14px;
          padding: 8px 14px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .segmented button:hover {
          color: #0f172a;
        }
        .segmented button:focus-visible {
          outline: 2px solid #0f6e56;
          outline-offset: 1px;
        }
        .segmented .on {
          background: #ffffff;
          color: #0f172a;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.08),
            0 1px 6px rgba(15, 23, 42, 0.06);
        }
        .segmented i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .freshness {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #64748b;
          font-size: 13px;
        }
        .notice {
          margin: 0;
        }
        .skeletons {
          display: grid;
          gap: 16px;
        }
        .skeleton {
          border-radius: 16px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e9eef4 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
        }
        .row {
          height: 120px;
        }
        .chart {
          height: 320px;
        }
        @keyframes shimmer {
          to {
            background-position: -200% 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .skeleton {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

// Con "Todas", el detalle de las respuestas se abre por encuesta (sus preguntas no son las mismas):
// una tarjeta por encuesta con lo esencial para elegir por dónde empezar.
function PickSurvey({
  perf,
  onPick
}: {
  perf: MarketingPerformance
  onPick: (scope: Scope) => void
}) {
  return (
    <section aria-labelledby="que-respondieron">
      <h2 id="que-respondieron">Qué respondieron</h2>
      <p className="lead">
        Elige una encuesta para ver su disponibilidad y sus formas de participar.
      </p>
      <div className="grid grid-3">
        {SURVEY_ORDER.map((slug) => {
          const t = totalsFor(perf, slug)
          return (
            <button key={slug} type="button" className="pick" onClick={() => onPick(slug)}>
              <span className="title">
                <i style={{ background: SURVEY_COLORS[slug] }} aria-hidden="true" />
                {SURVEY_LABELS[slug]}
              </span>
              <span className="big">{fmtInt(t.responses)}</span>
              <span className="sub">
                {t.responses === 1 ? 'respuesta' : 'respuestas'}
                {t.recipients !== null &&
                  ` · ${fmtPct(rate(t.responsesAfterSend, t.recipients))} de respuesta`}
              </span>
              <span className="cta">Ver respuestas →</span>
            </button>
          )
        })}
      </div>
      <style jsx>{`
        h2 {
          margin: 0;
          font-size: 20px;
          color: #0f172a;
        }
        .lead {
          margin: 4px 0 16px;
          color: #64748b;
          font-size: 14px;
        }
        .pick {
          display: grid;
          gap: 4px;
          text-align: left;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 16px 18px;
          font: inherit;
          transition:
            border-color 0.15s,
            box-shadow 0.15s;
        }
        .pick:hover,
        .pick:focus-visible {
          border-color: #0f6e56;
          box-shadow: 0 0 0 3px #e1f5ee;
          outline: none;
        }
        .title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: #1e293b;
        }
        .title i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .big {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
          margin-top: 6px;
        }
        .sub {
          color: #64748b;
          font-size: 13px;
        }
        .cta {
          color: #0f6e56;
          font-weight: 700;
          font-size: 13px;
          margin-top: 8px;
        }
      `}</style>
    </section>
  )
}
