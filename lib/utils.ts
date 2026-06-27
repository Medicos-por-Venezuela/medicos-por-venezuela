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

// Maps a doctor specialty to the patient "tipo de ayuda" / category values it covers
// (values come from the NECESIDADES list in registro-paciente). '*' = handles anything.
export const SPECIALTY_NEEDS: Record<string, string[]> = {
  'Medicina general': ['*'],
  'Medicina interna': ['Medicina general', 'Enfermedad crónica', 'Medicamentos', 'Primeros auxilios'],
  'Pediatría': ['Niño / pediatría'],
  'Traumatología': ['Lesión física'],
  'Ginecología / obstetricia': ['Embarazo'],
  'Cardiología': ['Enfermedad crónica'],
  'Psicología': ['Apoyo emocional', 'Crisis de ansiedad'],
  'Psiquiatría': ['Apoyo emocional', 'Crisis de ansiedad'],
  'Neurología': ['Enfermedad crónica'],
  'Cirugía': ['Lesión física'],
  'Otra': ['*']
}

// True if a consultation (its category and the patient's needs_tags) aligns with a doctor specialty.
export function matchesSpecialty(specialty: string | null | undefined, category: string | null, needsTags: string[] | null): boolean {
  if (!specialty) return false
  const covered = SPECIALTY_NEEDS[specialty]
  if (!covered) return false
  if (covered.includes('*')) return true
  const values = [category, ...(needsTags || [])].filter(Boolean) as string[]
  return values.some(v => covered.includes(v))
}

// Needs reserved for specific specialties only — they must NOT fall back to general doctors.
// Mental-health cases stay with psychologists/psychiatrists.
export const RESERVED_NEEDS: Record<string, string[]> = {
  'Apoyo emocional': ['Psicología', 'Psiquiatría'],
  'Crisis de ansiedad': ['Psicología', 'Psiquiatría']
}

// Hard eligibility: a doctor may attend a case unless it contains a reserved need their
// specialty isn't allowed for (e.g. a general doctor can never take a psychology case).
export function canAttend(specialty: string | null | undefined, category: string | null, needsTags: string[] | null): boolean {
  const values = [category, ...(needsTags || [])].filter(Boolean) as string[]
  return values.every(v => {
    const allowed = RESERVED_NEEDS[v]
    return !allowed || (!!specialty && allowed.includes(specialty))
  })
}
