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
  cancelled: 'Cancelada',
  patient_no_show: 'Paciente no se presentó',
  closed_by_admin: 'Cerrada por admin'
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

// Maps a doctor specialty to the patient "tipo de ayuda" / category values it covers
// (values come from the NECESIDADES list in registro-paciente). '*' = handles anything.
export const SPECIALTY_NEEDS: Record<string, string[]> = {
  'Medicina general': ['*'],
  'Medicina interna': [
    'Medicina general',
    'Enfermedad crónica',
    'Medicamentos',
    'Primeros auxilios'
  ],
  Pediatría: ['Niño / pediatría'],
  Traumatología: ['Lesión física'],
  Ginecología: ['Embarazo'],
  Obstetricia: ['Embarazo'],
  Cardiología: ['Enfermedad crónica'],
  Psicología: ['Apoyo emocional', 'Crisis de ansiedad'],
  Psiquiatría: ['Apoyo emocional', 'Crisis de ansiedad'],
  Neurología: ['Enfermedad crónica'],
  Cirugía: ['Lesión física'],
  Oncología: ['Enfermedad crónica'],
  'Oncología médica': ['Enfermedad crónica'],
  Fisiatría: ['Lesión física'],
  'Cuidados paliativos y manejo del dolor': ['Enfermedad crónica'],
  Geriatría: ['Enfermedad crónica', 'Medicina general'],
  Reumatología: ['Enfermedad crónica'],
  Otra: ['*']
}

// True if a consultation (its category and the patient's needs_tags) aligns with a doctor specialty.
export function matchesSpecialty(
  specialty: string | null | undefined,
  category: string | null,
  needsTags: string[] | null
): boolean {
  if (!specialty) return false
  const covered = SPECIALTY_NEEDS[specialty]
  if (!covered) return false
  if (covered.includes('*')) return true
  const values = [category, ...(needsTags || [])].filter(Boolean) as string[]
  return values.some((v) => covered.includes(v))
}

// Needs reserved for specific specialties only — they must NOT fall back to general doctors.
// Mental-health cases stay with psychologists/psychiatrists.
export const RESERVED_NEEDS: Record<string, string[]> = {
  'Apoyo emocional': ['Psicología', 'Psiquiatría'],
  'Crisis de ansiedad': ['Psicología', 'Psiquiatría']
}

// Hard eligibility (two-way separation between psychology and physical-health care):
// 1) Reserved needs (psychology) can only go to the allowed mental-health specialties
//    (Psicología/Psiquiatría) — never to a general/physical-health doctor.
// 2) Psicología only ever attends psychology cases — never physical-health cases.
export function canAttend(
  specialty: string | null | undefined,
  category: string | null,
  needsTags: string[] | null
): boolean {
  const values = [category, ...(needsTags || [])].filter(Boolean) as string[]

  const reservedOk = values.every((v) => {
    const allowed = RESERVED_NEEDS[v]
    return !allowed || (!!specialty && allowed.includes(specialty))
  })
  if (!reservedOk) return false

  if (specialty === 'Psicología') {
    const isPsychCase = values.some((v) => !!RESERVED_NEEDS[v])
    if (!isPsychCase) return false
  }
  return true
}
