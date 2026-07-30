// Sincronización de la agenda con calendarios (Google, Apple/iPhone, Outlook…) vía iCalendar.
// Dos vías: (1) feed de suscripción webcal:// (se sincroniza solo) servido por el backend; (2)
// descarga de un .ics por cita (import puntual), generada aquí en el navegador sin backend.
import { getJson, postJson } from './apiClient'

export interface CalendarUrl {
  ics_url: string // https, para copiar/pegar (ej. en Google Calendar → "Desde URL")
  webcal_url: string // abre el diálogo "Agregar calendario" del SO
}

// GET /agenda/calendar-url — URL de suscripción del usuario (genera el token la 1ª vez).
export async function fetchCalendarUrl(token: string): Promise<CalendarUrl> {
  return getJson<CalendarUrl>(
    '/api/v1/agenda/calendar-url',
    'No se pudo obtener la URL del calendario',
    token
  )
}

// POST /agenda/calendar-url/rotate — regenera el token (revoca la URL anterior).
export async function rotateCalendarUrl(token: string): Promise<CalendarUrl> {
  return postJson<CalendarUrl>(
    '/api/v1/agenda/calendar-url/rotate',
    {},
    'No se pudo regenerar la URL del calendario',
    token
  )
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// Date → 'YYYYMMDDTHHMMSSZ' (UTC), como exige iCal para DTSTART/DTEND.
function dtUtc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

// Descarga un .ics de UNA cita (import puntual al calendario del usuario). No se sincroniza solo:
// para eso está el feed de suscripción (fetchCalendarUrl).
export function downloadIcs(opts: {
  uid: string
  start: Date
  durationMin?: number
  title: string
  description?: string
}): void {
  const end = new Date(opts.start.getTime() + (opts.durationMin ?? 30) * 60000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Medicos por Venezuela//Agenda//ES',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${dtUtc(new Date())}`,
    `DTSTART:${dtUtc(opts.start)}`,
    `DTEND:${dtUtc(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    ...(opts.description ? [`DESCRIPTION:${esc(opts.description)}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cita.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
