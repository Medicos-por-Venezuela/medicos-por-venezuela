// Contenido de las tres encuestas de marketing: textos y opciones, tal como los aprobó el equipo en
// los diseños HTML. El componente (`EncuestaForm.tsx`) es uno solo; lo que cambia de una encuesta a
// otra vive aquí.
//
// Los `code` son el contrato con el backend (`src/services/marketing.py`): se guardan los códigos,
// no los textos, y el backend los valida por encuesta y resuelve las etiquetas al listar. Cambiar un
// texto es libre; cambiar un código exige cambiarlo en los dos repos.
import type { SurveySlug } from '../../lib/marketing'

export interface Option {
  code: string
  label: string
}

export interface OptionGroup {
  label: string
  options: Option[]
}

export interface Survey {
  slug: SurveySlug
  intro: string
  roleQuestion: string
  roles: Option[]
  // Roles que abren las preguntas de disponibilidad. `null` = se preguntan siempre.
  availabilityRoles: string[] | null
  // Rol con su propio "Cuéntanos qué tienes en mente", además del de "Otra".
  activeDetailRole: string | null
  momentHint: string
  asksTimezone: boolean
  thanks: string
}

// "Otra forma que quiero proponerles" y la zona horaria "Otra": las dos abren un campo de texto.
export const OTHER = 'otra'

export const MOMENTS: Option[] = [
  { code: 'manana', label: 'Mañana' },
  { code: 'tarde', label: 'Tarde' },
  { code: 'noche', label: 'Noche' },
  { code: 'variable', label: 'Es variable' }
]

export const DAYS: Option[] = [
  { code: 'lunes', label: 'Lunes' },
  { code: 'martes', label: 'Martes' },
  { code: 'miercoles', label: 'Miércoles' },
  { code: 'jueves', label: 'Jueves' },
  { code: 'viernes', label: 'Viernes' },
  { code: 'sabado', label: 'Sábado' },
  { code: 'domingo', label: 'Domingo' },
  { code: 'variable', label: 'Es variable' }
]

export const WEEKLY_HOURS: Option[] = [
  { code: 'menos_de_1', label: 'Menos de 1 hora a la semana' },
  { code: 'entre_1_y_3', label: 'Entre 1 y 3 horas a la semana' },
  { code: 'entre_3_y_6', label: 'Entre 3 y 6 horas a la semana' },
  { code: 'mas_de_6', label: 'Más de 6 horas a la semana' }
]

export const TIMEZONE_GROUPS: OptionGroup[] = [
  {
    label: 'América del Sur',
    options: [
      { code: 'venezuela', label: 'Venezuela (GMT-4)' },
      { code: 'colombia_peru_ecuador', label: 'Colombia, Perú, Ecuador (GMT-5)' },
      { code: 'bolivia_chile_paraguay', label: 'Bolivia, Chile, Paraguay (GMT-4)' },
      { code: 'argentina_uruguay_brasil', label: 'Argentina, Uruguay, Brasil (GMT-3)' }
    ]
  },
  {
    label: 'Norte, Centroamérica y Caribe',
    options: [
      { code: 'mexico_centro', label: 'México · Centro (GMT-6)' },
      { code: 'panama_costa_rica', label: 'Panamá, Costa Rica (GMT-6)' },
      { code: 'dominicana_puerto_rico', label: 'República Dominicana, Puerto Rico (GMT-4)' },
      { code: 'eeuu_canada_este', label: 'Estados Unidos / Canadá · Este (GMT-5)' },
      { code: 'eeuu_canada_centro', label: 'Estados Unidos / Canadá · Centro (GMT-6)' },
      { code: 'eeuu_canada_montana', label: 'Estados Unidos / Canadá · Montaña (GMT-7)' },
      { code: 'eeuu_canada_pacifico', label: 'Estados Unidos / Canadá · Pacífico (GMT-8)' }
    ]
  },
  {
    label: 'Europa',
    options: [
      { code: 'reino_unido_portugal', label: 'Reino Unido, Portugal (GMT+0)' },
      {
        code: 'espana_italia_francia_alemania',
        label: 'España, Italia, Francia, Alemania (GMT+1)'
      },
      { code: 'europa_este', label: 'Europa del Este (GMT+2)' }
    ]
  },
  {
    label: 'Otras regiones',
    options: [
      { code: 'medio_oriente', label: 'Medio Oriente (GMT+3)' },
      { code: 'asia', label: 'Asia (GMT+7 a GMT+9)' },
      { code: 'australia_nueva_zelanda', label: 'Australia y Nueva Zelanda (GMT+10 a GMT+12)' },
      { code: OTHER, label: 'Otra (se la indico abajo)' }
    ]
  }
]

const OTHER_ROLE: Option = { code: OTHER, label: 'Otra forma que quiero proponerles' }

// Psicólogos y especialistas comparten la introducción: a los dos se les pregunta con cuánto tiempo
// pueden comprometerse, sin la parte de "ahora que ya puedes pedir interconsultas".
const INTRO_COMPROMISO =
  'Responde esta encuesta para contarnos con cuánto tiempo puedes comprometerte con la ' +
  'plataforma. Valoramos tu aporte, y tener esa idea clara nos ayuda a organizarnos mejor. Si ' +
  'más adelante tu situación cambia, lo puedes ajustar.'

export const SURVEYS: Record<SurveySlug, Survey> = {
  psicologos: {
    slug: 'psicologos',
    intro: INTRO_COMPROMISO,
    roleQuestion: '¿Cómo prefieres participar en esta etapa?',
    roles: [
      { code: 'atender_pacientes', label: 'Atender pacientes a través de la plataforma' },
      {
        code: 'responder_interconsultas',
        label: 'Responder interconsultas (estudios de caso) cuando un colega lo necesite'
      },
      {
        code: 'rol_activo',
        label: 'Asumir un rol más activo (coordinar, liderar) dentro del equipo de psicología'
      },
      OTHER_ROLE
    ],
    availabilityRoles: null,
    activeDetailRole: null,
    momentHint: 'Puedes marcar varios. Según tu hora local.',
    asksTimezone: true,
    thanks:
      'Gracias por tu tiempo y por seguir contribuyendo a la salud mental de Venezuela. Ya tenemos ' +
      'tu disponibilidad. Pronto nos comunicaremos contigo.'
  },
  especialistas: {
    slug: 'especialistas',
    intro: INTRO_COMPROMISO,
    roleQuestion: '¿Cómo prefieres participar en esta etapa?',
    roles: [
      { code: 'responder_interconsultas', label: 'Responder interconsultas cuando pueda' },
      { code: 'atender_pacientes', label: 'Atender pacientes directamente en mi especialidad' },
      { code: 'atender_y_responder', label: 'Atender pacientes y responder interconsultas' },
      { code: 'coordinar_especialidad', label: 'Coordinar mi especialidad dentro de la red' },
      OTHER_ROLE
    ],
    availabilityRoles: null,
    activeDetailRole: null,
    momentHint: 'Puedes marcar varios. Según tu hora local.',
    asksTimezone: true,
    thanks:
      'Gracias por tu tiempo y por seguir contribuyendo a este proyecto que beneficia a Venezuela. ' +
      'Ya tenemos tu disponibilidad. Pronto nos comunicaremos contigo.'
  },
  // Quien solo va a PEDIR interconsultas no se compromete a un horario: la disponibilidad solo se
  // pregunta si además quiere atender, asumir un rol o proponer otra cosa. Sin zona horaria: la
  // encuesta va a médicos en Venezuela ("Horas de Venezuela").
  'medicos-generales': {
    slug: 'medicos-generales',
    intro:
      'Responde esta encuesta para contarnos cómo quieres participar ahora que ya puedes pedir ' +
      'interconsultas, y si quieres seguir atendiendo pacientes a través de la plataforma, ' +
      'cuéntanos con cuánto tiempo puedes comprometerte. Valoramos tu aporte, y tener esa idea ' +
      'clara nos ayuda a organizarnos mejor. Si más adelante tu situación cambia, lo puedes ajustar.',
    roleQuestion: '¿De qué forma te gustaría participar?',
    roles: [
      {
        code: 'pedir_interconsultas',
        label: 'Pedir interconsultas cuando tenga un caso que lo necesite'
      },
      { code: 'atender_pacientes', label: 'Seguir atendiendo pacientes a través de la plataforma' },
      { code: 'rol_activo', label: 'Asumir un rol más activo (coordinar, liderar)' },
      OTHER_ROLE
    ],
    availabilityRoles: ['atender_pacientes', 'rol_activo', OTHER],
    activeDetailRole: 'rol_activo',
    momentHint: 'Puedes marcar varios. Horas de Venezuela.',
    asksTimezone: false,
    thanks:
      'Gracias por tu tiempo y por seguir contribuyendo a este proyecto que beneficia a Venezuela. ' +
      'Ya tenemos tu respuesta. Pronto nos comunicaremos contigo.'
  }
}
