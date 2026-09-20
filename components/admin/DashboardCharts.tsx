// Gráficos del dashboard admin (chart.js). Se importa dinámicamente dentro del efecto para no
// tocar `window` durante el SSR de Next (Pages Router).
import { useEffect, useRef } from 'react'
import type { Chart as ChartInstance } from 'chart.js'

// Paleta fija: el panel no tiene tema con variables de gráficos y chart.js necesita colores.
const PALETTE = [
  '#1d4ed8',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#64748b'
]

type Slice = { label: string; total: number }

// Top N + el resto agregado en una sola porción ("Otras"), para que la torta sea legible:
// hay 37 zonas y 26 especialidades distintas en producción.
function topN(items: Slice[], n: number): { labels: string[]; values: number[]; rest: number } {
  const sorted = [...items].sort((a, b) => b.total - a.total)
  const head = sorted.slice(0, n)
  const rest = sorted.slice(n).reduce((acc, i) => acc + i.total, 0)
  return { labels: head.map((i) => i.label), values: head.map((i) => i.total), rest }
}

export default function DashboardCharts({
  byZone = [],
  bySpecialty = []
}: {
  // Opcionales con default: el backend y el frontend se despliegan por separado, y con una API
  // vieja estos campos no vienen. Sin el default, `byZone.map` rompería el dashboard entero.
  byZone?: { zone: string; total: number }[]
  bySpecialty?: { specialty: string; total: number }[]
}) {
  const zoneRef = useRef<HTMLCanvasElement>(null)
  const specialtyRef = useRef<HTMLCanvasElement>(null)

  // Torta: de qué zona llegan las consultas (todas, sin importar el estado).
  useEffect(() => {
    let chart: ChartInstance | undefined
    let cancelled = false
    const { labels, values, rest } = topN(
      byZone.map((z) => ({ label: z.zone, total: z.total })),
      8
    )
    const dataLabels = rest > 0 ? [...labels, 'Otras zonas'] : labels
    const dataValues = rest > 0 ? [...values, rest] : values

    void (async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      if (cancelled || !zoneRef.current) return
      chart = new Chart(zoneRef.current, {
        type: 'doughnut',
        data: {
          labels: dataLabels,
          datasets: [{ data: dataValues, backgroundColor: PALETTE, borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} consultas` }
            }
          }
        }
      })
    })()

    return () => {
      cancelled = true
      chart?.destroy()
    }
  }, [byZone])

  // Barras horizontales: especialidad más pedida. Se invierten para que la más buscada quede
  // arriba (en un bar horizontal el primer ítem se dibuja abajo).
  useEffect(() => {
    let chart: ChartInstance | undefined
    let cancelled = false
    const { labels, values, rest } = topN(
      bySpecialty.map((s) => ({ label: s.specialty, total: s.total })),
      10
    )
    const dataLabels = [...labels, ...(rest > 0 ? ['Otras especialidades'] : [])].reverse()
    const dataValues = [...values, ...(rest > 0 ? [rest] : [])].reverse()

    void (async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      if (cancelled || !specialtyRef.current) return
      chart = new Chart(specialtyRef.current, {
        type: 'bar',
        data: {
          labels: dataLabels,
          datasets: [{ data: dataValues, backgroundColor: PALETTE[0], borderRadius: 4 }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => `${ctx.parsed.x} consultas` }
            }
          },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: { ticks: { font: { size: 11 } } }
          }
        }
      })
    })()

    return () => {
      cancelled = true
      chart?.destroy()
    }
  }, [bySpecialty])

  return (
    <div className="dash-charts">
      <div className="card chart-card">
        <h3>Consultas por zona</h3>
        <p className="chart-sub">Todas las consultas, sin importar el estado.</p>
        <div className="chart-canvas">
          <canvas ref={zoneRef} />
        </div>
      </div>
      <div className="card chart-card">
        <h3>Especialidad más buscada</h3>
        <p className="chart-sub">Especialidad que pidió el paciente al crear la consulta.</p>
        <div className="chart-canvas">
          <canvas ref={specialtyRef} />
        </div>
      </div>
    </div>
  )
}
