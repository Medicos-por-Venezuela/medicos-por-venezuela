// Tarjeta de indicador del tablero de Marketing: qué se mide, la cifra, y sobre qué se calcula.
// La tercera línea es la que vuelve honesta a una tasa: "43,1 %" solo dice algo si se ve que es
// "688 de 1.598".
import type { ReactNode } from 'react'

export default function StatCard({
  label,
  value,
  detail,
  accent = false
}: {
  label: string
  value: string
  detail?: ReactNode
  accent?: boolean // la cifra que más importa del grupo
}) {
  return (
    <div className={accent ? 'stat accent' : 'stat'}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {detail && <div className="detail">{detail}</div>}
      <style jsx>{`
        .stat {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 16px 18px;
          min-width: 0;
        }
        .accent {
          border-color: #b9dccf;
          box-shadow: inset 0 3px 0 #0f6e56;
        }
        .label {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .value {
          color: #0f172a;
          font-size: 30px;
          font-weight: 800;
          line-height: 1.15;
          margin-top: 6px;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }
        .detail {
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          margin-top: 6px;
        }
      `}</style>
    </div>
  )
}
