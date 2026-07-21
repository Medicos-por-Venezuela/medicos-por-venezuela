export function minutesSince(value?: string | null) {
  if (!value) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
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

// The specialties a case is routed to: those whose scope fits it (matchesSpecialty) AND that are
// allowed to attend it (canAttend, which enforces the psychology reservation). Used by the admin
// panel to show, per case, which specialties can pick it up.
export function eligibleSpecialties(category: string | null, needsTags: string[] | null): string[] {
  return SPECIALTIES.filter(
    (s) => matchesSpecialty(s, category, needsTags) && canAttend(s, category, needsTags)
  )
}

// El registro del paciente ahora pide la especialidad y la guarda en consultations.specialty_id:
// esa columna ES el matching (el backend expone el nombre resuelto en el panel). category/needs
// quedan como fallback para consultas viejas sin especialidad. Espejo exacto de
// src/services/specialties.py (matches_consultation / can_attend_consultation) del backend.
const PSYCH_SPECIALTIES = ['Psicología', 'Psiquiatría']

// Match de preferencia: igualdad exacta con la especialidad solicitada por el paciente;
// fallback al matching legacy (category/needs) solo para consultas sin specialty_id.
export function matchesConsultation(
  specialty: string | null | undefined,
  consultationSpecialty: string | null,
  category: string | null,
  needsTags: string[] | null
): boolean {
  if (consultationSpecialty) return specialty === consultationSpecialty
  return matchesSpecialty(specialty, category, needsTags)
}

// Elegibilidad dura con la especialidad explícita. La reserva de psicología se mantiene:
// un caso de salud mental solo va a Psicología/Psiquiatría, y Psicología solo atiende salud
// mental. Un caso físico explícito lo puede tomar cualquier no-psicólogo (que la especialidad
// coincida es la PREFERENCIA de attend-next, no un bloqueo — nadie se queda sin atender).
export function canAttendConsultation(
  specialty: string | null | undefined,
  consultationSpecialty: string | null,
  category: string | null,
  needsTags: string[] | null
): boolean {
  if (consultationSpecialty && PSYCH_SPECIALTIES.includes(consultationSpecialty)) {
    return !!specialty && PSYCH_SPECIALTIES.includes(specialty)
  }
  if (consultationSpecialty) return specialty !== 'Psicología'
  return canAttend(specialty, category, needsTags)
}
