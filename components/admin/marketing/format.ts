// Formatos y colores del tablero de Marketing.
//
// Números en español de Venezuela ("1.598", "43,1 %") y fechas en hora de Caracas: el panel lo
// leen personas en distintos países, y "11 p. m." tiene que significar lo mismo para todas.
import type { SurveySlug } from '../../../lib/marketing'

const TIME_ZONE = 'America/Caracas'

const integer = new Intl.NumberFormat('es-VE')
const percent = new Intl.NumberFormat('es-VE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})
const dateTime = new Intl.DateTimeFormat('es-VE', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit'
})
const dayOnly = new Intl.DateTimeFormat('es-VE', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short'
})
const hourOnly = new Intl.DateTimeFormat('es-VE', { timeZone: TIME_ZONE, hour: 'numeric' })
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export const fmtInt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : integer.format(n)

// Una tasa sin denominador no existe: sin datos, o con denominador 0, es `null` (se pinta "—"),
// nunca 0 % ni NaN.
export function rate(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (numerator === null || numerator === undefined || !denominator) return null
  return numerator / denominator
}

export const fmtPct = (value: number | null): string =>
  value === null ? '—' : percent.format(value)

export const fmtDateTime = (iso: string): string => dateTime.format(new Date(iso))
export const fmtDay = (iso: string): string => dayOnly.format(new Date(iso))
export const fmtHour = (iso: string): string => hourOnly.format(new Date(iso))

export function fmtAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000)
  // "este minuto" (lo que da RelativeTimeFormat con 0) suena a máquina.
  if (minutes === 0) return 'hace un momento'
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  return relative.format(Math.round(minutes / 60), 'hour')
}

export const SURVEY_LABELS: Record<SurveySlug, string> = {
  psicologos: 'Psicólogos',
  especialistas: 'Especialistas',
  'medicos-generales': 'Médico General'
}

// Paleta de Okabe-Ito: distinguible también con daltonismo, y con contraste de al menos 3:1 sobre
// blanco (lo mínimo para una línea o un punto de una gráfica).
export const SURVEY_COLORS: Record<SurveySlug, string> = {
  psicologos: '#009e73',
  especialistas: '#0072b2',
  'medicos-generales': '#d55e00'
}

export const SURVEY_ORDER: SurveySlug[] = ['psicologos', 'especialistas', 'medicos-generales']
