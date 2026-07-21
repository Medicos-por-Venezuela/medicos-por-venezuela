// Preferencias de notificación del médico (Ajustes del perfil). El backend es la fuente de verdad
// del catálogo (qué eventos y canales existen); aquí solo ponemos las etiquetas en español y el
// gate de push. Opt-out: una preferencia ausente = habilitada.
import { getJson, patchJson } from './apiClient'

// { evento: { push?, email? } }. Ausente = habilitado.
export type NotificationPrefs = Record<string, { push?: boolean; email?: boolean }>
// { evento: [canales aplicables] } — lo devuelve el backend.
export type NotificationCatalog = Record<string, string[]>

export interface PrefsPayload {
  prefs: NotificationPrefs
  catalog: NotificationCatalog
}

// Etiquetas en español por evento (el backend solo maneja las keys). Un evento sin entrada aquí
// se muestra con su key como respaldo.
export const EVENT_LABELS: Record<string, { label: string; desc: string }> = {
  appointment_reminder: {
    label: 'Recordatorio de cita próxima',
    desc: 'Aviso ~30 min antes de cada cita de tu agenda.'
  },
  appointment_confirm: {
    label: 'Confirmación al agendar o referir',
    desc: 'Cuando agendas un seguimiento o refieres a un especialista (tu propia acción).'
  },
  interconsultation_assigned: {
    label: 'Te asignan una interconsulta',
    desc: 'Cuando un colega te invita a dar una segunda opinión en vivo.'
  },
  referral_received: {
    label: 'Te refieren una cita',
    desc: 'Cuando otro médico te agenda un paciente como especialista.'
  }
}

export const CHANNEL_LABELS: Record<string, string> = {
  push: 'Teléfono/navegador',
  email: 'Correo'
}

export async function fetchNotificationPrefs(token: string): Promise<PrefsPayload> {
  return getJson<PrefsPayload>(
    '/api/v1/me/notification-preferences',
    'No se pudieron cargar tus preferencias',
    token
  )
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
  token: string
): Promise<PrefsPayload> {
  return patchJson<PrefsPayload>(
    '/api/v1/me/notification-preferences',
    { prefs },
    'No se pudieron guardar tus preferencias',
    token
  )
}

// ¿El usuario quiere `event` por push? Opt-out: ausente = habilitado. Se usa para gatear las
// notificaciones nativas del navegador antes de dispararlas.
export function isPushEnabled(prefs: NotificationPrefs | null, event: string): boolean {
  return prefs?.[event]?.push !== false
}
