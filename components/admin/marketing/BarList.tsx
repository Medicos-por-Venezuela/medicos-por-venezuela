// Barras horizontales de una pregunta. El 100 % es el total de respuestas, no la opción más
// votada: una barra a media anchura dice "la mitad de quienes respondieron", que es lo que se
// quiere leer para decidir.
import type { OptionCount } from '../../../lib/marketing'
import { fmtInt, fmtPct, rate } from './format'

export default function BarList({
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
        const share = rate(item.count, total) ?? 0
        return (
          <li key={item.code}>
            <div className="head">
              <span className="name">{item.label}</span>
              <span className="num">
                {fmtInt(item.count)} <span className="pct">{fmtPct(share)}</span>
              </span>
            </div>
            <div className="track" aria-hidden="true">
              {/* Con 1 de 300 el porcentaje redondea a 0: un mínimo de 3 px evita que una opción
                  que alguien marcó se vea igual que una que nadie marcó. */}
              <div
                className="fill"
                style={{ width: `${share * 100}%`, minWidth: item.count ? 3 : 0 }}
              />
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
          gap: 14px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 6px;
        }
        .name {
          font-size: 14px;
          color: #1e293b;
        }
        .num {
          font-weight: 700;
          font-size: 14px;
          color: #0f172a;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .pct {
          color: #64748b;
          font-weight: 500;
          margin-left: 6px;
        }
        .track {
          height: 8px;
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
