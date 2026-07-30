// Notificaciones nativas del navegador (Notification API) para las citas del módulo Agenda.
// ponytail: sin service worker + Web Push, estas solo disparan con la PESTAÑA ABIERTA. Son un
// complemento del email (que es el canal confiable, lo manda el backend). Upgrade futuro: service
// worker + push para avisar con la pestaña cerrada.

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
export function notify(title: string, body?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
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
