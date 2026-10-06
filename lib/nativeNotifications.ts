// Notificaciones nativas del navegador (Notification API) para las citas del módulo Agenda.
// ponytail: sin service worker + Web Push, estas solo disparan con la PESTAÑA ABIERTA. Son un
// complemento del email (que es el canal confiable, lo manda el backend). Upgrade futuro: service
// worker + push para avisar con la pestaña cerrada.

import { playNotificationSound, type SoundKind } from './sound'

// Pide permiso una vez (si el usuario aún no decidió). No molesta si ya está granted/denied.
export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

// Muestra una notificación ya (si hay permiso). Silenciosa si no se puede.
//
// El aviso sonoro es OPT-IN (`{ sound: true }`) y no al revés: esta función la comparten módulos
// que nacieron sin sonido —los recordatorios de la agenda y el aviso de cita confirmada del
// detalle de la consulta—, y hacerlo por defecto les metía un pitido que nadie pidió. Sin la
// opción, el comportamiento es exactamente el de siempre: si no hay permiso, no pasa nada.
export function notify(
  title: string,
  body?: string,
  options?: { sound?: boolean; soundKind?: SoundKind }
): void {
  if (typeof window === 'undefined') return

  // El sonido va antes del gate de permiso porque es un canal aparte: quien lo pide explícitamente
  // (la mensajería) quiere oírlo aunque el navegador tenga las notificaciones bloqueadas.
  if (options?.sound === true) {
    playNotificationSound(options.soundKind || 'message')
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    // Algunos navegadores exigen service worker para Notification: lo ignoramos (techo conocido).
  }
}

// Programa recordatorios locales ~`leadMinutes` antes de cada cita (solo con la pestaña abierta).
// Devuelve una función de limpieza para cancelarlos (encaja como cleanup de un useEffect, evita
// duplicar timeouts al recargar la agenda). No programa citas pasadas ni a más de ~24h (setTimeout
// con delays enormes es poco fiable; esas las cubre el email del backend).
export function scheduleLocalReminders(
  appts: { when: Date; title: string; body: string }[],
  leadMinutes = 30
): () => void {
  if (typeof window === 'undefined') return () => {}
  const ids: number[] = []
  for (const a of appts) {
    const delay = a.when.getTime() - leadMinutes * 60_000 - Date.now()
    if (delay <= 0 || delay > 24 * 60 * 60_000) continue
    ids.push(window.setTimeout(() => notify(a.title, a.body), delay))
  }
  return () => ids.forEach((id) => window.clearTimeout(id))
}
