export function normalizeWhatsapp(phone: string) {
  const digits = (phone || '').replace(/\D/g, '')
  return digits
}

export function whatsappUrl(phone: string, text: string) {
  const digits = normalizeWhatsapp(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function minutesSince(value?: string | null) {
  if (!value) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
}

export const STATUS_LABELS: Record<string, string> = {
  waiting: 'Esperando',
  in_progress: 'Abierta',
  referred_to_specialist: 'Derivada a especialista',
  urgent_in_person: 'Debe ir a atención presencial urgente',
  closed: 'Cerrada',
  cancelled: 'Cancelada'
}

export const SPECIALTIES = [
  'Medicina general',
  'Pediatría',
  'Traumatología',
  'Ginecología / obstetricia',
  'Cardiología',
  'Medicina interna',
  'Psicología',
  'Psiquiatría',
  'Neurología',
  'Cirugía',
  'Otra'
]
