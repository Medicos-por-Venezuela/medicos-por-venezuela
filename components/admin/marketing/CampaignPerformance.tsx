// "Embudo de la campaña": del correo de Kit a la respuesta en la plataforma.
//
// Cada tasa lleva escrito su denominador. Una tasa de clics de 7 % no se lee igual sobre los
// enviados que sobre quienes abrieron, y confundirlas es la forma más común de sacar una
// conclusión equivocada de un embudo. Por eso:
//   · apertura, clics, respuesta y bajas se calculan sobre los ENVIADOS (comparables entre sí y
//     con el panel de Kit);
//   · cada paso del embudo dice además la conversión desde el paso anterior;
//   · "Respondieron" cuenta solo lo llegado desde el primer envío: las respuestas anteriores son
//     pruebas o llegaron por otro lado, e inflarían la tasa.
import type { MarketingCampaign, MarketingPerformance, SurveySlug } from '../../../lib/marketing'
import {
  fmtDateTime,
  fmtInt,
  fmtPct,
  rate,
  SURVEY_COLORS,
  SURVEY_LABELS,
  SURVEY_ORDER
} from './format'
import StatCard from './StatCard'

export type Scope = 'todas' | SurveySlug

interface Totals {
  recipients: number | null
  opened: number | null
  clicked: number | null
  unsubscribed: number | null
  responsesAfterSend: number | null
  responses: number
  campaigns: (MarketingCampaign & { survey: SurveySlug })[]
}

// Suma el alcance elegido. Solo entran en las tasas las encuestas con datos de Kit: sumar las
// respuestas de una encuesta sin envíos al numerador inflaría la tasa de las demás.
export function totalsFor(perf: MarketingPerformance, scope: Scope): Totals {
  const surveys = perf.surveys.filter((s) => scope === 'todas' || s.survey === scope)
  const withKit = surveys.filter((s) => s.recipients !== null)
  const sum = (pick: (s: (typeof surveys)[number]) => number | null) =>
    withKit.length ? withKit.reduce((acc, s) => acc + (pick(s) ?? 0), 0) : null
  return {
    recipients: sum((s) => s.recipients),
    opened: sum((s) => s.opened),
    clicked: sum((s) => s.clicked),
    unsubscribed: sum((s) => s.unsubscribed),
    responsesAfterSend: sum((s) => s.responses_after_send),
    responses: surveys.reduce((acc, s) => acc + s.responses, 0),
    campaigns: surveys
      .flatMap((s) => s.campaigns.map((c) => ({ ...c, survey: s.survey })))
      .sort((a, b) => a.sent_at.localeCompare(b.sent_at))
  }
}

export default function CampaignPerformance({
  perf,
  scope
}: {
  perf: MarketingPerformance
  scope: Scope
}) {
  const t = totalsFor(perf, scope)
  const hasKit = t.recipients !== null
  const earlier =
    hasKit && t.responsesAfterSend !== null
      ? perf.surveys
          .filter((s) => (scope === 'todas' || s.survey === scope) && s.recipients !== null)
          .reduce((acc, s) => acc + s.responses - (s.responses_after_send ?? 0), 0)
      : 0

  return (
    <section aria-labelledby="embudo" className="block">
      <div className="head">
        <h2 id="embudo">Embudo de la campaña</h2>
        <p>Del correo enviado con Kit a la respuesta guardada en la plataforma.</p>
      </div>

      <div className="stats">
        <StatCard
          label="Enviados"
          value={fmtInt(t.recipients)}
          detail={
            hasKit
              ? `${fmtInt(t.campaigns.length)} ${t.campaigns.length === 1 ? 'envío' : 'envíos'} de Kit`
              : 'Sin datos de Kit'
          }
        />
        <StatCard
          label="Tasa de apertura"
          value={fmtPct(rate(t.opened, t.recipients))}
          detail={hasKit ? `${fmtInt(t.opened)} de ${fmtInt(t.recipients)} lo abrieron` : '—'}
        />
        <StatCard
          label="Tasa de clics"
          value={fmtPct(rate(t.clicked, t.recipients))}
          detail={
            hasKit
              ? `${fmtInt(t.clicked)} personas · ${fmtPct(rate(t.clicked, t.opened))} de quienes lo abrieron`
              : '—'
          }
        />
        <StatCard
          accent
          label={hasKit ? 'Tasa de respuesta' : 'Respuestas'}
          value={hasKit ? fmtPct(rate(t.responsesAfterSend, t.recipients)) : fmtInt(t.responses)}
          detail={
            hasKit
              ? `${fmtInt(t.responsesAfterSend)} respondieron · ${fmtPct(rate(t.responsesAfterSend, t.clicked))} de quienes hicieron clic`
              : 'Guardadas en la plataforma'
          }
        />
        <StatCard
          label="Bajas"
          value={fmtPct(rate(t.unsubscribed, t.recipients))}
          detail={hasKit ? `${fmtInt(t.unsubscribed)} se dieron de baja` : '—'}
        />
      </div>

      {hasKit && (
        <div className="grid grid-2 pair">
          <div className="card panel">
            <h3>De enviados a respuestas</h3>
            <p className="hint">% de los enviados, y conversión desde el paso anterior.</p>
            <Funnel
              steps={[
                { label: 'Enviados', value: t.recipients ?? 0, verb: '' },
                { label: 'Abrieron', value: t.opened ?? 0, verb: 'lo abrió' },
                { label: 'Hicieron clic', value: t.clicked ?? 0, verb: 'hizo clic' },
                { label: 'Respondieron', value: t.responsesAfterSend ?? 0, verb: 'respondió' }
              ]}
            />
            {earlier > 0 && (
              <p className="footnote">
                {fmtInt(earlier)} {earlier === 1 ? 'respuesta llegó' : 'respuestas llegaron'} antes
                del primer envío y no cuentan en la tasa.
              </p>
            )}
          </div>
          {scope === 'todas' ? (
            <Comparison perf={perf} />
          ) : (
            <CampaignList campaigns={t.campaigns} />
          )}
        </div>
      )}

      <style jsx>{`
        .block {
          display: grid;
          gap: 16px;
        }
        h2 {
          margin: 0;
          font-size: 20px;
          color: #0f172a;
        }
        .head p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 14px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
        .panel {
          margin: 0;
          min-width: 0;
        }
        h3 {
          margin: 0;
          font-size: 16px;
          color: #0f172a;
        }
        .hint {
          margin: 4px 0 18px;
          color: #64748b;
          font-size: 13px;
        }
        .footnote {
          margin: 16px 0 0;
          color: #64748b;
          font-size: 12px;
        }
        @media (max-width: 1180px) {
          .stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  )
}

function Funnel({ steps }: { steps: { label: string; value: number; verb: string }[] }) {
  const base = steps[0].value
  // Del más oscuro al más claro; cada tono con contraste suficiente sobre el fondo de la pista.
  const shades = ['#0b5c47', '#1f7a5f', '#3f9a7e', '#6fb89e']
  return (
    <ol>
      {steps.map((step, i) => {
        const ofBase = rate(step.value, base) ?? 0
        const previous = i > 0 ? steps[i - 1] : null
        return (
          <li key={step.label}>
            {previous && (
              <div className="step">
                <span aria-hidden="true">↓</span> {fmtPct(rate(step.value, previous.value))}{' '}
                {step.verb}
              </div>
            )}
            <div className="row">
              <span className="name">{step.label}</span>
              <div className="track" aria-hidden="true">
                <div
                  className="fill"
                  style={{
                    width: `${ofBase * 100}%`,
                    minWidth: step.value ? 3 : 0,
                    background: shades[i]
                  }}
                />
              </div>
              <span className="num">
                {fmtInt(step.value)} <span className="pct">{fmtPct(ofBase)}</span>
              </span>
            </div>
          </li>
        )
      })}
      <style jsx>{`
        ol {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .row {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr) 130px;
          align-items: center;
          gap: 12px;
        }
        .name {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }
        .track {
          height: 28px;
          border-radius: 8px;
          background: #f1f5f9;
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: 8px;
        }
        .num {
          text-align: right;
          font-weight: 700;
          font-size: 15px;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .pct {
          color: #64748b;
          font-weight: 500;
          font-size: 13px;
          margin-left: 6px;
        }
        .step {
          margin: 6px 0 6px 122px;
          color: #475569;
          font-size: 12px;
          font-weight: 600;
        }
        @media (max-width: 480px) {
          .row {
            grid-template-columns: 1fr auto;
          }
          .track {
            grid-column: 1 / -1;
            grid-row: 2;
            height: 20px;
          }
          .step {
            margin-left: 0;
          }
        }
      `}</style>
    </ol>
  )
}

// Las tres encuestas lado a lado, para ver qué público responde mejor. La mejor tasa de cada
// columna va resaltada (solo si hay al menos dos encuestas con datos para comparar).
function Comparison({ perf }: { perf: MarketingPerformance }) {
  const rows = SURVEY_ORDER.map((slug) => {
    const t = totalsFor(perf, slug)
    return {
      slug,
      recipients: t.recipients,
      open: rate(t.opened, t.recipients),
      click: rate(t.clicked, t.recipients),
      responses: t.responsesAfterSend,
      response: rate(t.responsesAfterSend, t.recipients)
    }
  })
  const best = (key: 'open' | 'click' | 'response') => {
    const values = rows.map((r) => r[key]).filter((v): v is number => v !== null)
    return values.length > 1 ? Math.max(...values) : null
  }
  const top = { open: best('open'), click: best('click'), response: best('response') }
  const rates = ['open', 'click', 'response'] as const

  return (
    <div className="card panel">
      <h3>Por encuesta</h3>
      <p className="hint">
        Tasas sobre los enviados de cada encuesta. En verde y negrita, la mejor de cada columna.
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Encuesta</th>
              <th scope="col" className="num">
                Enviados
              </th>
              <th scope="col" className="num">
                Apertura
              </th>
              <th scope="col" className="num">
                Clics
              </th>
              <th scope="col" className="num">
                Respuestas · tasa
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <th scope="row">
                  <i style={{ background: SURVEY_COLORS[r.slug] }} aria-hidden="true" />
                  {SURVEY_LABELS[r.slug]}
                </th>
                <td className="num">{fmtInt(r.recipients)}</td>
                {/* Las celdas van escritas aquí y no en un helper: styled-jsx solo le pone su
                    clase a lo que está en el JSX del propio componente, y en un helper `.top` y
                    `.sr-only` no aplicaban. */}
                {rates.map((key) => {
                  const isTop = r[key] !== null && r[key] === top[key]
                  return (
                    <td key={key} className={isTop ? 'num top' : 'num'}>
                      {key === 'response' && <span className="count">{fmtInt(r.responses)}</span>}
                      {fmtPct(r[key])}
                      {isTop && <span className="sr-only"> (la mejor)</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .panel {
          margin: 0;
          min-width: 0;
        }
        h3 {
          margin: 0;
          font-size: 16px;
          color: #0f172a;
        }
        .hint {
          margin: 4px 0 14px;
          color: #64748b;
          font-size: 13px;
        }
        /* position: relative para que el texto oculto de lector de pantalla (posición absoluta)
           quede dentro del contenedor con scroll y no ensanche la página en un teléfono. */
        .scroll {
          overflow-x: auto;
          position: relative;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        th,
        td {
          padding: 10px 8px;
          border-bottom: 1px solid #eef2f6;
          white-space: nowrap;
        }
        thead th {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          text-align: left;
        }
        tbody th {
          text-align: left;
          font-weight: 600;
          color: #1e293b;
        }
        tbody tr:last-child th,
        tbody tr:last-child td {
          border-bottom: 0;
        }
        i {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 8px;
          vertical-align: middle;
        }
        .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          color: #334155;
        }
        .top {
          color: #0b5c47;
          font-weight: 800;
        }
        .count {
          color: #0f172a;
          font-weight: 700;
          margin-right: 8px;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}

function CampaignList({ campaigns }: { campaigns: MarketingCampaign[] }) {
  return (
    <div className="card panel">
      <h3>Envíos</h3>
      <p className="hint">Cada correo enviado con Kit para esta encuesta.</p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Asunto</th>
              <th scope="col">Enviado</th>
              <th scope="col" className="num">
                Enviados
              </th>
              <th scope="col" className="num">
                Apertura
              </th>
              <th scope="col" className="num">
                Clics
              </th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="subject">{c.subject}</td>
                <td>{fmtDateTime(c.sent_at)}</td>
                <td className="num">{fmtInt(c.recipients)}</td>
                <td className="num">{fmtPct(rate(c.opened, c.recipients))}</td>
                <td className="num">{fmtPct(rate(c.clicked, c.recipients))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .panel {
          margin: 0;
          min-width: 0;
        }
        h3 {
          margin: 0;
          font-size: 16px;
          color: #0f172a;
        }
        .hint {
          margin: 4px 0 14px;
          color: #64748b;
          font-size: 13px;
        }
        /* position: relative para que el texto oculto de lector de pantalla (posición absoluta)
           quede dentro del contenedor con scroll y no ensanche la página en un teléfono. */
        .scroll {
          overflow-x: auto;
          position: relative;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        th,
        td {
          padding: 10px 8px;
          border-bottom: 1px solid #eef2f6;
          white-space: nowrap;
          text-align: left;
        }
        thead th {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }
        tbody tr:last-child td {
          border-bottom: 0;
        }
        /* El asunto se parte en líneas: recortado con puntos suspensivos, en una tarjeta de media
           anchura empujaba las columnas de las tasas fuera de la vista. */
        .subject {
          white-space: normal;
          min-width: 160px;
          color: #1e293b;
          font-weight: 600;
        }
        .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          color: #334155;
        }
      `}</style>
    </div>
  )
}
