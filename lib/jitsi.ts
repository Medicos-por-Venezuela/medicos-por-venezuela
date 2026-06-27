// Generates a unique, unguessable public Jitsi Meet room URL for a consultation.
// Public meet.jit.si needs no server-side config; just keep room names random.
export function newRoomUrl(): string {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `https://meet.jit.si/vamed-${id}`
}
