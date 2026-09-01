export function minutesSince(value?: string | null) {
  if (!value) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
}

/**
 * Tiempo transcurrido, legible: "45 min", "1 hora", "10 horas", "1 día", "1 día 8 horas".
 *
 * Las tarjetas del panel imprimían los minutos crudos, así que un caso de la noche anterior
 * decía "hace 1024 min" — un número que hay que dividir mentalmente para saber si es de hace
 * un rato o de ayer. La unidad tiene que cambiar con la magnitud.
 *
 * Se corta en dos unidades a propósito: días y horas bastan para decidir a quién atender, y
 * "1 día 8 horas 12 min" no cabe en una tarjeta. Los minutos solo aparecen por debajo de la
 * hora, que es donde importan.
 *
 * NO reemplaza a `minutesSince`: esa sigue siendo el número para comparar (el KPI de
 * "sin atender +20 min" filtra con ella). Esto es solo presentación.
 */
export function tiempoTranscurrido(value?: string | null): string {
  const totalMin = minutesSince(value)
  if (totalMin < 60) return `${totalMin} min`

  const totalHoras = Math.floor(totalMin / 60)
  if (totalHoras < 24) return `${totalHoras} ${totalHoras === 1 ? 'hora' : 'horas'}`

  const dias = Math.floor(totalHoras / 24)
  const horas = totalHoras % 24
  const etiquetaDias = `${dias} ${dias === 1 ? 'día' : 'días'}`
  // Las horas se omiten cuando son cero: "2 días" se lee mejor que "2 días 0 horas".
  if (horas === 0) return etiquetaDias
  return `${etiquetaDias} ${horas} ${horas === 1 ? 'hora' : 'horas'}`
}

// Roles con permisos de administración, y los que pueden entrar al panel médico. Viven aquí
// (y no en cada página) para que la lista sea una sola: duplicarla es cómo un rol nuevo entra
// en un guard y se olvida en el otro.
// `readonly`: son listas de autorización (aunque el control real sean las RLS y el RBAC del
// backend); que nadie las mute desde otro módulo por accidente.
export const ADMIN_ROLES: readonly string[] = ['admin', 'super_admin']
export const PANEL_ALLOWED_ROLES: readonly string[] = ['doctor', 'specialist', ...ADMIN_ROLES]

export function isAdminRole(role?: string | null): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}

export function isPanelRole(role?: string | null): boolean {
  return !!role && PANEL_ALLOWED_ROLES.includes(role)
}

// Clase del badge de estado en el panel médico (cola y detalle muestran el mismo color).
export function statusBadgeClass(status: string): string {
  if (status === 'urgent_in_person') return 'badge-red'
  if (status === 'referred_to_specialist') return 'badge-blue'
  if (status === 'in_progress') return 'badge-orange'
  return 'badge-green'
}

export const STATUS_LABELS: Record<string, string> = {
  waiting: 'Esperando',
  in_progress: 'Abierta',
  scheduled: 'Agendada',
  referred_to_specialist: 'Derivada a especialista',
  urgent_in_person: 'Debe ir a atención presencial urgente',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
  patient_no_show: 'Paciente no se presentó',
  closed_by_admin: 'Cerrada por admin',
  contacted_whatsapp: 'Ya contactado vía WhatsApp'
}

export const SPECIALTIES = [
  'Medicina general',
  'Pediatría',
  'Traumatología',
  'Ginecología',
  'Obstetricia',
  'Cardiología',
  'Medicina interna',
  'Psicología',
  'Psiquiatría',
  'Neurología',
  'Cirugía',
  'Oncología',
  'Oncología médica',
  'Fisiatría',
  'Cuidados paliativos y manejo del dolor',
  'Geriatría',
  'Reumatología',
  'Otra'
]

// El match de un caso con un medico es `consultations.specialty_id` (el backend expone el nombre
// resuelto en el panel). Aqui NO hay mapa de "necesidad -> especialidad": el que habia era el
// fallback de las consultas anteriores a esa columna, estaba copiado a mano del backend y se
// desincronizo del catalogo real en cuanto una especialidad se renombro. Se borro de los dos
// lados; la reserva de salud mental, que si es un permiso, la aplica el backend (get_panel y
// /claim), nunca el cliente.

// Preferencia de orden en "atender al siguiente": el caso pide EXACTAMENTE la especialidad del
// medico. Es preferencia, no permiso -- si no hay ninguno se atiende al mas antiguo.
export function matchesConsultation(
  specialty: string | null | undefined,
  consultationSpecialty: string | null
): boolean {
  return !!consultationSpecialty && specialty === consultationSpecialty
}
