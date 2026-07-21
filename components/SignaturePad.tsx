// Canvas de firma nativo (sin dependencias): se dibuja con mouse/dedo (pointer events) y devuelve el
// dataURL PNG. Se usa al cerrar/agendar una consulta (acto médico firmado). Módulo Agenda.
import { useRef, useState } from 'react'

export default function SignaturePad({
  onSign,
  onCancel,
  title = 'Firma del médico',
  hint = 'Firma en el recuadro para dejar constancia del cierre. Base para los récipes.',
  submitLabel = 'Firmar y continuar',
  busy = false
}: {
  onSign: (dataUrl: string) => void
  onCancel: () => void
  title?: string
  hint?: string
  submitLabel?: string
  busy?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Coords corregidas por la escala CSS (el canvas se muestra a width:100% pero su resolución
  // interna es fija), para que el trazo caiga donde toca el usuario.
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget
    const rect = c.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height
    }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.stroke()
    setHasDrawn(true)
  }

  function clear() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height)
    setHasDrawn(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: '100%' }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>{hint}</p>
        <canvas
          ref={canvasRef}
          width={440}
          height={180}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            touchAction: 'none',
            width: '100%',
            display: 'block'
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-muted" onClick={clear} disabled={busy}>
            Limpiar
          </button>
          <button className="btn btn-muted" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            disabled={!hasDrawn || busy}
            onClick={() => {
              const url = canvasRef.current?.toDataURL('image/png')
              if (url) onSign(url)
            }}
          >
            {busy ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
