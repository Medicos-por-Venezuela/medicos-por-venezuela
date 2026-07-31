// Bloque "Sincronizar con mi calendario": expone la URL de suscripción (webcal/ics) del usuario
// para agregarla en Google Calendar / iPhone / Outlook y que sus citas se sincronicen solas.
// Reusable por médico (/panel-medico) y paciente (/mi-caso): el token sale de la sesión actual.
import { useState } from 'react'
import { getAccessToken } from '../lib/admin'
import { fetchCalendarUrl, rotateCalendarUrl, type CalendarUrl } from '../lib/calendar'

export default function CalendarSync({ hint }: { hint?: string }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<CalendarUrl | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function open_() {
    setOpen(true)
    if (url || busy) return
    setBusy(true)
    setError('')
    try {
      setUrl(await fetchCalendarUrl(await getAccessToken()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la URL.')
    } finally {
      setBusy(false)
    }
  }

  async function rotate() {
    if (
      !window.confirm(
        '¿Regenerar la URL? La anterior dejará de sincronizar en los calendarios ya suscritos.'
      )
    )
      return
    setBusy(true)
    setError('')
    try {
      setUrl(await rotateCalendarUrl(await getAccessToken()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo regenerar.')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url.ics_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Si el navegador bloquea el portapapeles, el usuario puede copiar del input de abajo.
    }
  }

  if (!open) {
    return (
      <button className="btn btn-outline" onClick={open_}>
        📅 Sincronizar con mi calendario
      </button>
    )
  }

  return (
    <div className="card-flat" style={{ marginBottom: 12 }}>
      <strong>Sincronizar con mi calendario</strong>
      <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 10px' }}>
        {hint ||
          'Agrega esta dirección en Google Calendar, iPhone/Apple, Outlook u otra app y tus citas se sincronizan solas. No compartas la URL: da acceso a tu agenda.'}
      </p>
      {error && (
        <div className="notice notice-danger" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      {busy && !url && <p style={{ color: '#64748b' }}>Cargando…</p>}
      {url && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <a className="btn btn-primary" href={url.webcal_url}>
              Suscribirme ahora
            </a>
            <button className="btn btn-muted" onClick={copy}>
              {copied ? 'Copiado ✓' : 'Copiar URL'}
            </button>
            <button className="btn btn-muted" onClick={rotate} disabled={busy}>
              Regenerar
            </button>
          </div>
          <input
            readOnly
            value={url.ics_url}
            onFocus={(e) => e.currentTarget.select()}
            style={{ width: '100%', fontSize: 12, color: '#475569' }}
          />
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', color: '#0f6e56', fontSize: 13 }}>
              ¿Cómo la agrego?
            </summary>
            <ul style={{ color: '#475569', fontSize: 13, margin: '8px 0 0', paddingLeft: 18 }}>
              <li>
                <strong>Botón “Suscribirme ahora”</strong>: abre el diálogo del sistema si tu
                dispositivo lo soporta (iPhone/Mac).
              </li>
              <li>
                <strong>Google Calendar</strong> (desde una computadora): Otros calendarios → Desde
                URL → pega la dirección.
              </li>
              <li>
                <strong>iPhone</strong>: Ajustes → Calendario → Cuentas → Añadir cuenta → Otra →
                Añadir calendario suscrito → pega la dirección.
              </li>
            </ul>
          </details>
        </>
      )}
    </div>
  )
}
