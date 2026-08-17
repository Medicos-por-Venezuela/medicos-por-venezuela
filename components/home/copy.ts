// Textos del home, en un solo módulo.
//
// El copy viene de `nueva/MEDxVZLA_Copy_Web_v1.docx` (The Climb, agosto 2026) y está **aprobado**
// (confirmado el 2026-08-13). Vive aparte de los componentes para que cambiar una palabra no sea
// cambiar un componente.
//
// REGLA cuando el `.docx` y el prototipo discrepan —y discrepan en varios sitios—: **el texto sale
// del `.docx`, la maqueta sale del prototipo**. El prototipo lleva versiones anteriores del copy
// (descripciones más largas en las puertas, y unos valores con otros nombres: Calidad /
// Credibilidad / Autonomía / Gratuidad en lugar de Verificados / Autónomos / Gratuitos /
// **Confidenciales**, que además cambia uno de los cuatro). Manda el `.docx`.
//
// Las secciones se van añadiendo aquí a medida que se construyen (ver tasks/todo.md).
//
// AUDITORÍA (2026-08-13): de las 78 cadenas visibles del home, 67 salen del `.docx`. Las que NO,
// y de dónde vienen — todas viven igualmente en este archivo, no sueltas por los componentes:
//   · Del PROTOTIPO, no del copy: "Interconsulta en curso", "24/7", "Disponible · Confidencial"
//     (el rótulo y la franja de la foto del hero); "01/02/03" (numeración de las puertas);
//     "Plataforma", "Organización", "Contacto" (títulos de columna del pie) y "Ser voluntario",
//     "Interconsulta médica" (etiquetas de enlace del pie). "Contacto" e "Interconsulta médica"
//     no aparecen en el `.docx` **en absoluto**; el resto solo dentro de otras frases.
//   · Decisión del equipo: "+2.000" en lugar del "+3.000" del copy.
//   · Escrito para accesibilidad: el `alt` de la foto y los `aria-label` de las secciones. Un
//     documento de copy no los cubre, pero un lector de pantalla sí los lee.
// Al revés también: el `.docx` tiene secciones que la web aún no muestra (las de T8-T9).

export const MARCA = {
  nombre: 'Médicos por Venezuela',
  tagline: 'Conocimiento médico al servicio de Venezuela.',
  web: 'medicosporvenezuela.org',
  correo: 'info@medicosporvenezuela.org',
  instagram: '@medicosxvenezuela',
  instagramUrl: 'https://instagram.com/medicosxvenezuela'
} as const

// Cifras curadas por el equipo. NO salen del backend: `GET /stats` exige el permiso `stats.read`,
// y abrirlo al público expondría el pulso operativo de la organización a cualquiera que mire el
// network tab. Además son números redondeados de marketing, no lecturas en vivo.
// `medicos` se corrigió de "+3.000" a "+2.000": la base tiene ~2.960 médicos, así que la cifra
// del copy original era falsa, y este sitio vende precisamente verificación.
// Se guardan como NÚMERO, no como texto: la sección de Impacto los anima con un contador y
// necesita la cifra. Así el 2000 vive en un solo sitio en vez de en un string y un número que se
// pueden desincronizar.
export const METRICAS = {
  medicos: 2000,
  consultas: 200,
  especialidades: 20
} as const

// Separador de miles a mano en lugar de `Intl.NumberFormat`: el formato tiene que salir idéntico
// en el servidor y en el navegador. Si el Node del build va con ICU reducido, Intl daría "2,000"
// donde el navegador da "2.000" y React avisaría de un desajuste de hidratación.
export const conMiles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// El "+" es parte del mensaje: son cifras redondeadas hacia abajo, no exactas.
export const masDe = (n: number) => `+${conMiles(n)}`

// Destinos reales. Los que no existen NO son enlaces (ver `NAV`): un `href="#"` en la home de una
// organización médica erosiona justo la credibilidad que el copy defiende.
export const RUTAS = {
  paciente: '/registro-paciente',
  voluntario: '/registro-medico',
  // Provisional: no existe un flujo público de "solicitar interconsulta" — hoy solo se puede
  // invitar a un colega desde un caso ya abierto dentro del panel. Un médico en Venezuela igual
  // tiene que registrarse antes de pedir nada. PENDIENTE de verificar con las owners.
  medicoVenezuela: '/registro-medico',
  ingresar: '/login-medico'
} as const

export const HERO = {
  eyebrow: 'Plataforma activa · Acceso gratuito',
  // El titular va partido porque la segunda mitad se pinta en azul, como en el prototipo.
  titulo: 'La medicina venezolana ',
  tituloAcento: 'no tiene fronteras.',
  subtitulo:
    'Desde cualquier parte del mundo, nuestra red de especialistas verificados ofrece orientación ' +
    'médica gratuita a pacientes y colegas dentro del país. ',
  subtituloFuerte: 'Porque la distancia no debería decidir quién recibe atención.',
  ctaPrimario: 'Solicitar consulta →',
  ctaSecundario: 'Conocer la plataforma',
  // El `alt` del prototipo decía "Dos médicos venezolanos revisando un caso clínico": la foto que
  // tenemos es de UNA médica sola. Describir lo que no está en la imagen es peor que no describir.
  fotoAlt:
    'Una médica con bata blanca y estetoscopio atiende una consulta desde su computadora portátil ' +
    'en un consultorio.',
  fotoBadge: 'Interconsulta en curso',
  fotoDato: '24/7',
  fotoDatoPie: 'Disponible · Confidencial',
  // Tres métricas, no cuatro: las del prototipo. Los valores salen de METRICAS para que la cifra
  // viva en un solo sitio y no haya dos "+2.000" que se puedan desincronizar.
  metricas: [
    { valor: masDe(METRICAS.medicos), etiqueta: 'Médicos verificados' },
    { valor: masDe(METRICAS.consultas), etiqueta: 'Consultas realizadas' },
    { valor: '100%', etiqueta: 'Gratuito' }
  ]
} as const

// Las tres puertas de entrada. El prototipo trae descripciones más largas para estas tres
// tarjetas; se sigue el `.docx` (ver la regla de la cabecera del archivo).
export const PUERTAS = {
  pie: 'Disponible 24/7 · Confidencial · Sin costo',
  tarjetas: [
    {
      numero: '01',
      titulo: 'Soy paciente',
      descripcion: 'Necesito orientación médica gratuita, hoy',
      accion: 'Solicitar consulta →',
      href: RUTAS.paciente
    },
    {
      numero: '02',
      titulo: 'Soy médico en Venezuela',
      descripcion: 'Necesito apoyo clínico especializado',
      accion: 'Solicitar interconsulta →',
      // Provisional: hoy no existe un flujo público de interconsulta (ver RUTAS.medicoVenezuela).
      href: RUTAS.medicoVenezuela
    },
    {
      numero: '03',
      titulo: 'Quiero ser voluntario',
      descripcion: 'Pongo mi conocimiento al servicio de Venezuela',
      accion: 'Registrarme →',
      href: RUTAS.voluntario
    }
  ]
} as const

export const QUIENES_SOMOS = {
  eyebrow: 'Quiénes Somos',
  titulo: 'Una red médica construida sobre el compromiso, no sobre la distancia.',
  parrafos: [
    'Somos una red de especialistas verificados que ofrece orientación médica gratuita a ' +
      'pacientes y médicos dentro de Venezuela, a través de la telemedicina y la interconsulta ' +
      'especializada.',
    'Nacimos en medio del terremoto y hoy nos constituimos formalmente como organización sin ' +
      'fines de lucro, porque el compromiso con Venezuela no fue una respuesta de emergencia. Es ' +
      'una decisión permanente.'
  ],
  // Sin destino: la página "Quiénes Somos" está fuera del alcance de este trabajo (ver el spec).
  // Se pinta como texto, no como enlace, igual que Especialistas y Blog en el navbar.
  cta: 'Conoce nuestra historia →'
} as const

// Los cuatro valores del `.docx`. OJO: el prototipo muestra otros cuatro (Calidad, Credibilidad,
// Autonomía, Gratuidad) y uno de ellos ni siquiera se corresponde — "Confidenciales" no aparece
// allí. Manda el `.docx`, que es la versión aprobada.
// El prototipo acompaña cada valor de una foto circular de 52 px; esos assets no están entregados,
// así que van solo en texto.
export const VALORES = [
  {
    titulo: 'Verificados',
    descripcion: 'Cada profesional en nuestra red ha sido verificado de forma independiente.'
  },
  {
    titulo: 'Autónomos',
    descripcion: 'Independientes de intereses políticos, económicos o institucionales.'
  },
  {
    titulo: 'Gratuitos',
    descripcion: 'Sin costo para el paciente. Siempre. Sin excepciones.'
  },
  {
    titulo: 'Confidenciales',
    descripcion: 'Tu consulta y tus datos son privados. Solo tu médico los ve.'
  }
] as const

// Especialistas. La rejilla es un PLACEHOLDER declarado como tal en el `.docx`: "Se muestran 6
// tarjetas placeholder. Oriana y Ada seleccionan los especialistas reales."
//
// Los seis perfiles NO llevan nombres inventados. En el sitio de una organización médica, una
// tarjeta con un nombre y una especialidad plausibles junto a un "✓ Verificado" es una credencial
// falsa, aunque sea de mentira para maquetar. El texto deja claro que es una plantilla.
// ⚠️ ESTO NO PUEDE SALIR A PRODUCCIÓN ASÍ: hay que sustituirlo por los perfiles reales.
export const ESPECIALISTAS = {
  eyebrow: 'Nuestros Especialistas',
  titulo: 'Conocimiento médico al servicio de Venezuela.',
  subtitulo:
    'Cada especialista en nuestra red ha sido verificado de forma independiente. No son ' +
    'voluntarios anónimos — son profesionales con nombre, trayectoria y credenciales reales, que ' +
    'eligieron seguir aportando desde donde estén.',
  // Sin destino: la página de Especialistas está fuera del alcance de este trabajo.
  cta: 'Ver todos los especialistas →',
  verificado: 'Verificado',
  plazas: 6,
  plaza: {
    nombre: 'Perfil por publicar',
    especialidad: 'Especialidad',
    pais: 'País'
  }
} as const

// Testimonios reales de pacientes, tal cual el `.docx`. El prototipo pone una foto circular junto
// a cada cita; aquí no: son pacientes anónimos ("Paciente, Venezuela"), y ponerles una cara —real
// o de archivo— sería atribuir un testimonio médico a alguien que no lo dio.
export const TESTIMONIOS = {
  eyebrow: 'Testimonios',
  titulo: 'Las voces que nos impulsan a seguir.',
  autor: 'Paciente, Venezuela',
  citas: [
    'Ya me atendió la cardióloga. Fui muy bien atendida por la profesional.',
    'Ya hablé con el doctor sobre mi tensión y la ansiedad. Me dijo qué debía hacer. Todo muy bien.',
    'Excelente el trabajo que realizan. Gracias infinitas a todos los médicos que ayudan desde afuera.',
    'Fue muy eficiente. El sistema me costó un poco al inicio, pero lo logré y el doctor me ayudó.',
    'El médico me llamó. Dios los bendiga por tan maravillosa iniciativa.',
    'Pude conversar con el especialista, muchas gracias.'
  ]
} as const

// Impacto: la banda azul de cifras, destino del ancla "Impacto" del navbar. Las tres primeras se
// animan con un contador; "Presencia global" no es un número y se pinta tal cual.
export const IMPACTO = [
  { numero: METRICAS.medicos, etiqueta: 'Médicos verificados en la red' },
  { numero: METRICAS.consultas, etiqueta: 'Consultas realizadas' },
  { numero: METRICAS.especialidades, etiqueta: 'Especialidades disponibles' },
  { texto: 'Presencia global', etiqueta: 'Médicos voluntarios en múltiples países del mundo' }
] as const

// Blog. Tres tarjetas placeholder y badge "Próximamente", como pide el `.docx`. No son enlaces:
// el blog no existe todavía. Tampoco llevan titulares inventados, por lo mismo que los perfiles.
export const BLOG = {
  eyebrow: 'Blog',
  badge: 'Próximamente',
  titulo: 'El conocimiento también se comparte.',
  cta: 'Ver todos los artículos →',
  plazas: 3,
  plaza: {
    categoria: 'Categoría',
    titulo: 'Título del artículo',
    fecha: 'Próximamente'
  }
} as const

// Cómo Funciona. En el `.docx`, la sección del home solo trae el título y una nota
// ("Los tabs permiten cambiar entre los 3 flujos. Por defecto se muestra el flujo de pacientes").
// Los pasos salen de la sección "PÁGINA: CÓMO FUNCIONA" del mismo documento, que es donde están
// escritos: es la única fuente, y la nota del home remite justamente a esos tres flujos.
export const COMO_FUNCIONA = {
  eyebrow: 'Cómo Funciona',
  titulo: 'Acceder es sencillo. Así funciona.',
  intro:
    'Médicos por Venezuela funciona de forma distinta según quién eres. Elige tu perfil y ' +
    'conoce cómo acceder.',
  // El orden importa: paciente primero, que es el que se muestra al cargar.
  flujos: [
    {
      id: 'paciente',
      etiqueta: 'Soy paciente',
      intro:
        'Si necesitas orientación médica y no sabes a dónde acudir, estás en el lugar correcto. ' +
        'Un especialista verificado puede atenderte desde donde estés.',
      pasos: [
        {
          numero: '01',
          titulo: 'Entra a la plataforma',
          descripcion:
            'Desde medicosporvenezuela.org, sin descarga, sin instalación. Funciona desde ' +
            'cualquier dispositivo con conexión a internet.'
        },
        {
          numero: '02',
          titulo: 'Regístrate y describe tu consulta',
          descripcion:
            'Crea tu cuenta e ingresa los detalles de tu consulta. Tu información es ' +
            'completamente confidencial.'
        },
        {
          numero: '03',
          titulo: 'Espera a ser atendido',
          descripcion:
            'Un médico verificado tomará tu caso. Los tiempos de espera dependen de la ' +
            'disponibilidad de médicos conectados en ese momento.'
        },
        {
          numero: '04',
          titulo: 'Recibe atención especializada',
          descripcion: 'Tu médico escuchará tu caso, lo evaluará y te indicará qué hacer.'
        }
      ]
    },
    {
      id: 'medico',
      etiqueta: 'Soy médico en Venezuela',
      intro:
        'Si tienes un caso que supera tus recursos actuales y necesitas una segunda opinión ' +
        'especializada, aquí tienes una red de especialistas verificados disponibles para ' +
        'apoyarte.',
      pasos: [
        {
          numero: '01',
          titulo: 'Entra a la plataforma',
          descripcion: 'Desde medicosporvenezuela.org, sin descarga, sin instalación.'
        },
        {
          numero: '02',
          titulo: 'Regístrate con tus credenciales',
          descripcion:
            'Tu verificación es automática a través del SACS. Tus datos son confidenciales y ' +
            'nunca se comparten con terceros.'
        },
        {
          numero: '03',
          titulo: 'Describe el caso clínico',
          descripcion:
            'Ingresa los detalles del caso que necesitas interconsultar. Solo el especialista ' +
            'asignado tendrá acceso.'
        },
        {
          numero: '04',
          titulo: 'Recibe la interconsulta',
          descripcion:
            'Un especialista verificado revisará tu caso y te dará su criterio clínico para que ' +
            'puedas continuar con la atención de tu paciente.'
        }
      ]
    },
    {
      id: 'voluntario',
      etiqueta: 'Quiero ser voluntario',
      intro:
        'Si eres médico y quieres seguir aportando a Venezuela desde donde estés, el proceso es ' +
        'simple. Sin turnos fijos, sin compromisos contractuales. Tú decides cuándo y cuánto.',
      pasos: [
        {
          numero: '01',
          titulo: 'Entra a la plataforma',
          descripcion: 'Desde medicosporvenezuela.org, sin descarga, sin instalación.'
        },
        {
          numero: '02',
          titulo: 'Regístrate con tus credenciales',
          descripcion:
            'Tu verificación es automática a través del SACS. Tus datos son confidenciales y ' +
            'nunca se comparten con terceros.'
        },
        {
          numero: '03',
          titulo: 'Conéctate cuando puedas',
          descripcion:
            'Sin horarios fijos ni presión de disponibilidad. Te conectas cuando tienes tiempo y ' +
            'atiendes lo que hay en cola en ese momento.'
        },
        {
          numero: '04',
          titulo: 'Atiende y deja huella',
          descripcion:
            'Cada consulta queda registrada. Recibes constancia de tu voluntariado y formas ' +
            'parte de la red médica venezolana de mayor credibilidad del país.'
        }
      ]
    }
  ]
} as const

// Cierre de la página. El prototipo lo pone sobre una foto ("médico venezolano sonriendo, ambiente
// clínico") que NO está entre los assets entregados: se resuelve con el navy y su degradado. Si
// aparece la foto, entra como fondo de esta sección sin tocar el resto.
export const CTA_FINAL = {
  eyebrow: 'Únete',
  titulo: 'Tres formas de acceder a MEDxVZLA.',
  tarjetas: [
    {
      pretitulo: 'Para pacientes',
      titulo: 'Accede a tu consulta médica gratuita hoy.',
      descripcion: 'Un profesional verificado te atiende desde donde estés.',
      accion: 'Solicitar consulta →',
      href: RUTAS.paciente
    },
    {
      pretitulo: 'Para médicos en Venezuela',
      titulo: 'Obtén el apoyo clínico que tu caso necesita.',
      descripcion:
        'Interconsulta gratuita con especialistas verificados. Sin burocracia. Cuando lo necesites.',
      accion: 'Solicitar interconsulta →',
      href: RUTAS.medicoVenezuela
    },
    {
      pretitulo: 'Para voluntarios',
      titulo: 'Suma tu conocimiento donde más se necesita.',
      descripcion:
        'Voluntariado flexible. Sin compromisos fijos. Tu especialidad sigue siendo de Venezuela.',
      accion: 'Registrarme →',
      href: RUTAS.voluntario
    }
  ]
} as const

type NavItem = { label: string; href?: string; ancla?: string }

// El prototipo marca 6 entradas. Quiénes Somos, Cómo Funciona e Impacto son secciones de esta
// misma página, así que son anclas. Especialistas y Blog todavía no tienen página: se pintan
// como texto, no como enlace.
export const NAV: NavItem[] = [
  { label: 'Inicio', ancla: 'inicio' },
  { label: 'Quiénes Somos', ancla: 'quienes-somos' },
  { label: 'Especialistas' },
  { label: 'Cómo Funciona', ancla: 'como-funciona' },
  { label: 'Impacto', ancla: 'impacto' },
  { label: 'Blog' },
  { label: 'Únete', href: RUTAS.voluntario }
]

export const FOOTER = {
  descripcion:
    'Organización sin fines de lucro registrada en Estados Unidos. Conectamos profesionales de ' +
    'la salud verificados con quienes los necesitan dentro de Venezuela.',
  avisoLegal:
    'Médicos por Venezuela es una organización sin fines de lucro registrada en Estados Unidos. ' +
    'La orientación ofrecida a través de esta plataforma no reemplaza la atención médica ' +
    'presencial de urgencia. Si tienes una emergencia médica, acude a tu servicio de salud más ' +
    'cercano.',
  copyright: '© 2026 Médicos por Venezuela',
  columnas: [
    {
      titulo: 'Plataforma',
      enlaces: [
        { label: 'Solicitar consulta', href: RUTAS.paciente },
        { label: 'Interconsulta médica', href: RUTAS.medicoVenezuela },
        { label: 'Ser voluntario', href: RUTAS.voluntario }
      ]
    },
    {
      titulo: 'Organización',
      // Sin `href`: estas páginas no existen todavía.
      enlaces: [
        { label: 'Quiénes Somos', ancla: 'quienes-somos' },
        { label: 'Especialistas' },
        { label: 'Impacto', ancla: 'impacto' },
        { label: 'Blog' }
      ]
    }
  ]
} as const
