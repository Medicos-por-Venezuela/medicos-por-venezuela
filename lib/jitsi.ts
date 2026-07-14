// Self-hosted Jitsi (salas abiertas, sin moderador). NO usamos el público meet.jit.si por defecto
// porque ahora obliga al primero en entrar a loguearse como moderador ("no moderators have yet
// arrived"). Override con NEXT_PUBLIC_JITSI_DOMAIN si la instancia cambia de host.
const JITSI_DOMAIN = process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.medicosporvenezuela.org'

// Generates a unique, unguessable Jitsi Meet room URL for a consultation.
export function newRoomUrl(): string {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `https://${JITSI_DOMAIN}/vamed-${id}`
}

// Prepara la URL para abrir la sala en el navegador. Se aplica al abrir, así que también arregla
// URLs ya guardadas en la BD. Hace dos cosas:
//  1. Sana salas legacy guardadas en meet.jit.si (que hoy exige moderador/login) apuntándolas a
//     nuestra instancia abierta. Es el único punto por donde paciente y médico abren la sala.
//  2. Añade el hash-config para saltar el interstitial móvil "descarga/abre la app"
//     (`disableDeepLinking` clásico + el nuevo anidado `deeplinking.disabled`).
export function browserRoomUrl(url: string): string {
  if (!url) return url
  url = url.replace('https://meet.jit.si/', `https://${JITSI_DOMAIN}/`)
  if (url.includes('disableDeepLinking')) return url
  const sep = url.includes('#') ? '&' : '#'
  return `${url}${sep}config.disableDeepLinking=true&config.deeplinking.disabled=true`
}
