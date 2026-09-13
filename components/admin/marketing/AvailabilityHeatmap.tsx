// Tabla de calor días × momentos de una encuesta.
//
// Cinco niveles fijos en vez de una opacidad continua: con opacidad, las casillas intermedias
// dejaban el número en 2,5:1 de contraste (blanco sobre verde medio), y el número es justo lo que
// se lee. Cada nivel trae su color de texto verificado (≥ 5:1). La intensidad es relativa a la
// casilla con más respuestas, y la leyenda "menos → más" lo dice.
import type { OptionCount } from '../../../lib/marketing'
import { fmtInt } from './format'

const LEVELS = [
  { upTo: 0.2, background: '#e3f3ec', color: '#0f3d31' },
  { upTo: 0.4, background: '#bfe3d5', color: '#0f3d31' },
  { upTo: 0.6, background: '#86c9b1', color: '#0b2e25' },
  { upTo: 0.8, background: '#1f7a5f', color: '#ffffff' },
  { upTo: 1, background: '#0b5c47', color: '#ffffff' }
]

const levelOf = (ratio: number) => LEVELS.find((l) => ratio <= l.upTo) ?? LEVELS[LEVELS.length - 1]

const plural = (n: number) => `${fmtInt(n)} ${n === 1 ? 'respuesta' : 'respuestas'}`

export default function AvailabilityHeatmap({
  days,
  moments,
  availability
}: {
  days: OptionCount[]
  moments: OptionCount[]
  availability: number[][]
}) {
  // La matriz trae solo los días y momentos del formulario; un código retirado al final de
  // `days`/`moments` no tiene fila ni columna.
  const rows = days.slice(0, availability.length)
  const columns = moments.slice(0, availability[0]?.length ?? 0)
  const max = Math.max(0, ...availability.flat())

  return (
    <div className="wrap">
      <div className="scroll">
        <table>
          <caption className="sr-only">Respuestas por día de la semana y momento del día</caption>
          <thead>
            <tr>
              <th scope="col" className="corner">
                Día
              </th>
              {columns.map((m) => (
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
            {rows.map((day, i) => (
              <tr key={day.code}>
                <th scope="row">{day.label}</th>
                {columns.map((moment, j) => {
                  const count = availability[i][j]
                  const level = count ? levelOf(count / max) : null
                  return (
                    <td
                      key={moment.code}
                      className="cell"
                      aria-label={`${day.label}, ${moment.label}: ${plural(count)}`}
                      title={`${day.label} · ${moment.label}: ${plural(count)}`}
                      style={
                        level
                          ? { background: level.background, color: level.color }
                          : { background: '#f8fafc', color: '#64748b', fontWeight: 500 }
                      }
                    >
                      {fmtInt(count)}
                    </td>
                  )
                })}
                <td className="total">{fmtInt(day.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend" aria-hidden="true">
        <span>Menos</span>
        {LEVELS.map((l) => (
          <i key={l.upTo} style={{ background: l.background }} />
        ))}
        <span>Más</span>
      </div>
      <style jsx>{`
        .scroll {
          overflow-x: auto;
          position: relative;
        }
        table {
          border-collapse: separate;
          border-spacing: 4px;
          width: 100%;
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
        .corner {
          text-align: left;
        }
        th[scope='row'] {
          color: #1e293b;
          font-size: 14px;
          padding-right: 12px;
        }
        .cell {
          height: 44px;
          min-width: 56px;
          border-radius: 8px;
          text-align: center;
          font-weight: 700;
          font-size: 14px;
          font-variant-numeric: tabular-nums;
        }
        .total {
          color: #475569;
          text-align: center;
          font-variant-numeric: tabular-nums;
          padding: 0 8px;
        }
        .legend {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 10px;
          color: #64748b;
          font-size: 12px;
        }
        .legend span {
          margin: 0 4px;
        }
        .legend i {
          width: 22px;
          height: 10px;
          border-radius: 3px;
          display: inline-block;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }
        /* En un teléfono las cabeceras largas se parten en dos líneas y las casillas se estrechan,
           para que la tabla entera quepa sin desplazarse de lado. */
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
            padding-right: 4px;
          }
          .cell {
            min-width: 34px;
            height: 38px;
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
