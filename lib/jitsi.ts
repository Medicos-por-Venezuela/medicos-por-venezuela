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
