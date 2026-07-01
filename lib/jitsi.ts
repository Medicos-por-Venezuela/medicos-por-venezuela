// Generates a unique, unguessable Jitsi Meet room URL for a consultation.
// Defaults to public meet.jit.si; set NEXT_PUBLIC_JITSI_DOMAIN to your self-hosted
// instance (e.g. meet.medicosporvenezuela.org) to switch with no code change.
export function newRoomUrl(): string {
  const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.jit.si'
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `https://${domain}/vamed-${id}`
}

// Append Jitsi URL-hash config so the room opens straight in the browser instead of showing the
// mobile "descarga la app / abrir en la app" interstitial. `disableDeepLinking` (and the newer
// nested `deeplinking.disabled`) turn that page off, so phone users continue in the browser with no
// extra tap. Applied when opening a room, so it also fixes URLs already stored in the DB.
export function browserRoomUrl(url: string): string {
  if (!url || url.includes('disableDeepLinking')) return url
  const sep = url.includes('#') ? '&' : '#'
  return `${url}${sep}config.disableDeepLinking=true&config.deeplinking.disabled=true`
}
