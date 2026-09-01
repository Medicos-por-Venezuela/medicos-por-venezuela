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
// SEGUNDA RONDA (2026-08-28). The Climb entregó copy corregido y este archivo lo recoge. Lo que
// cambió respecto a la v1: el orden y el texto de las tres puertas (la de médico pasa a la 01 y
// se llama "Soy médico, necesito apoyo clínico"), una sección NUEVA de psicología entre las
// puertas y Quiénes Somos, el orden de los tabs de Cómo Funciona (interconsulta primero) con un
// paso nuevo de "Recepción Clínica" en dos de los tres flujos, el equipo con nombres y biografías
// dentro de Quiénes Somos, y un aviso legal más corto en el pie. La paleta por sección también
// cambió; eso vive en los componentes, no aquí.
//
// Las secciones se van añadiendo aquí a medida que se construyen (ver tasks/home-refresh/todo.md).
//
// AUDITORÍA (2026-08-13): de las 78 cadenas visibles del home, 67 salen del `.docx`. Las que NO,
// y de dónde vienen — todas viven igualmente en este archivo, no sueltas por los componentes:
//   · Del PROTOTIPO, no del copy: "01/02/03" (numeración de las puertas).
//     La franja de la foto del hero ("24/7" + "Disponible · Confidencial") se retiró entera el
//     2026-09-01, junto con el rótulo "Interconsulta en curso" que ya se había ido el 2026-08-28;
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
  // Con `www.`: es la forma canónica que sirve Instagram, y sin ella hay un salto 301 de por
  // medio. Importa más de lo que parece porque esta URL no es solo el enlace del pie: es el
  // `sameAs` del JSON-LD (`lib/schema.ts`), o sea lo que le dice a Google que esta cuenta y esta
  // organización son la misma entidad. Es la ÚNICA red de la organización — no hay X.
  instagramUrl: 'https://www.instagram.com/medicosxvenezuela'
} as const

// RESPALDO de las tres cifras de la portada. Desde el 2026-08-28 las de verdad salen del backend
// (`GET /stats/public`, ver `components/home/cifras.ts`); estas son lo que se pinta en el servidor,
// lo que ve quien no tenga JavaScript y lo que queda si el backend no responde.
//
// Siguen siendo CIERTAS, que es el requisito: son menores que las reales. `medicos` ya se había
// corregido de "+3.000" a "+2.000" porque la base tenía ~2.960 y la cifra del copy original era
// falsa — en un sitio que vende verificación, eso no es un detalle.
//
// Se guardan como NÚMERO, no como texto: la banda de Impacto los anima con un contador y necesita
// la cifra. Así el 2000 vive en un solo sitio en vez de en un string y un número que se pueden
// desincronizar.
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
  // `/login` es el acceso único del sitio desde que se unificó el login: decide el destino por rol.
  // `/login-medico` ya no tiene formulario, solo redirige aquí — enlazar al que redirige sería
  // hacer pasar a todo el mundo por un salto de más.
  ingresar: '/login',
  quienesSomos: '/quienes-somos',
  // El CTA de Psicología va al MISMO registro de paciente que la telemedicina, con un parámetro
  // que deja preseleccionada la especialidad. Lo lee `pages/registro-paciente.tsx`, que resuelve
  // Psicología por el flag `mental_health_only` del catálogo y no por el nombre.
  psicologia: '/registro-paciente?especialidad=psicologia'
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
  // Tres métricas, no cuatro: las del prototipo. Las dos primeras se piden al backend en vivo, de
  // ahí que aquí solo vaya la CLAVE y no el número: la cifra la pone el componente con `useCifras`,
  // para que el hero y la banda de Impacto no puedan decir cosas distintas. "100%" es una promesa
  // de la organización, no un conteo, así que va literal.
  metricas: [
    { clave: 'doctors', etiqueta: 'Médicos verificados' },
    { clave: 'consultations', etiqueta: 'Consultas realizadas' },
    { valor: '100%', etiqueta: 'Gratuito' }
  ]
} as const

// Las tres puertas de entrada. Orden y textos de la segunda ronda de copy (2026-08-28): la puerta
// del médico venezolano pasa a ser la 01 y se renombra a "Soy médico, necesito apoyo clínico"; el
// paciente baja a la 02. Las descripciones son ahora frases completas, no fragmentos.
export const PUERTAS = {
  pie: 'Disponible 24/7 · Confidencial · Sin costo',
  tarjetas: [
    {
      numero: '01',
      titulo: 'Soy médico, necesito apoyo clínico',
      descripcion:
        'Ejerzo en Venezuela y necesito el respaldo de un especialista para continuar la ' +
        'atención de mi paciente.',
      accion: 'Pedir interconsulta →',
      // Provisional: hoy no existe un flujo público de interconsulta (ver RUTAS.medicoVenezuela).
      href: RUTAS.medicoVenezuela
    },
    {
      numero: '02',
      titulo: 'Soy paciente',
      descripcion:
        'Necesito orientación médica gratuita. Un especialista verificado puede atenderme desde ' +
        'donde esté.',
      accion: 'Solicitar consulta →',
      href: RUTAS.paciente
    },
    {
      numero: '03',
      titulo: 'Quiero ser voluntario',
      descripcion:
        'Soy médico y quiero poner mi conocimiento al servicio de Venezuela desde donde esté.',
      accion: 'Registrarme →',
      href: RUTAS.voluntario
    }
  ]
} as const

// Psicología. Sección nueva de la segunda ronda, entre las puertas y Quiénes Somos, sobre el azul
// eléctrico de marca. El CTA va al MISMO registro de paciente que la telemedicina: no hay un flujo
// aparte para salud mental, y mandar a la gente a una ruta distinta sería inventarse un producto
// que no existe. La especialidad se elige dentro del registro (el catálogo marca Psicología con su
// propio flag; ver `fix/registro-medico-psicologia-por-flag`).
export const PSICOLOGIA = {
  titulo: '¿Necesitas atención psicológica?',
  texto:
    'En Médicos por Venezuela creemos que la salud mental es parte de la salud. Por eso contamos ' +
    'con un equipo de psicólogos verificados, listos para atender a cualquier venezolano de forma ' +
    'gratuita y confidencial, desde donde esté.',
  cta: 'Hablar con un psicólogo →',
  href: RUTAS.psicologia
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
  // Ahora SÍ tiene destino: la página `/quienes-somos`, que cuenta la historia y presenta al
  // equipo. Hasta el 2026-08-28 se pintaba como texto inerte porque esa página no existía.
  cta: 'Conoce nuestra historia →',
  ctaHref: RUTAS.quienesSomos
} as const

// El equipo. NO vive en el home: por decisión del equipo (2026-08-28), las cofundadoras y el resto
// de las personas se cuentan en `/quienes-somos`, a la que se llega desde "Conoce nuestra historia".
// El "Quiénes Somos" del menú sigue siendo el ancla de la sección del home.
//
// A diferencia de la rejilla de Especialistas, estos son nombres REALES entregados por la
// organización. Van sin retrato: las fotos entregadas son para Especialistas, y una imagen de
// archivo aquí pondría una cara ajena junto al nombre de una persona real.
export const EQUIPO = {
  eyebrow: 'Nuestro equipo',
  titulo: 'Las personas detrás de Médicos por Venezuela.',
  grupos: [
    {
      titulo: 'Nuestras Cofundadoras',
      personas: [
        {
          nombre: 'Oriana Ramírez',
          cargo: 'Cofundadora · Médico Internista',
          bio:
            'La idea de Médicos por Venezuela nació de Oriana. Salió de Venezuela en 2011 y nunca ' +
            'pudo desconectarse del sufrimiento de su gente. Durante años recibió mensajes de ' +
            'familiares y amigos que necesitaban ayuda médica y ya no confiaban en las ' +
            'instituciones de su país. Decidió que podía hacer algo concreto al respecto. Y lo hizo.'
        },
        {
          nombre: 'Adarvelys Valor',
          cargo: 'Cofundadora · Médico Ocupacional',
          bio:
            'Ada convirtió la idea en realidad. Con años de experiencia trabajando con empresas e ' +
            'instituciones fuera del ámbito hospitalario, aportó a Médicos por Venezuela algo que ' +
            'pocas organizaciones médicas tienen: la capacidad de pensar como institución desde el ' +
            'primer día. Es quien traduce la visión en estructura y mantiene todo funcionando con ' +
            'coherencia.'
        }
      ]
    },
    {
      titulo: 'Nuestro Equipo',
      personas: [
        {
          nombre: 'Sara Altuna',
          cargo: 'Médico Internista · Oncóloga · Venezuela',
          bio:
            'Médico venezolana con años de experiencia, ejerce desde Venezuela y forma parte del ' +
            'equipo que demuestra que la vocación y el compromiso no tienen fronteras. Su trabajo ' +
            'en medicina interna y oncología dentro del país la convierte en una voz esencial: ' +
            'sabe de primera mano lo que significa ejercer en Venezuela hoy.'
        },
        {
          nombre: 'Johanna Palacios',
          cargo: 'Cirujana · Patóloga · España',
          bio:
            'Médico venezolana con años de experiencia, hoy ejerce desde España y sigue aportando ' +
            'a Venezuela desde la distancia. Su formación en cirugía y patología le da una ' +
            'perspectiva clínica única dentro del equipo, y su compromiso con el proyecto ' +
            'demuestra que emigrar no significa dejar de servir a su país.'
        },
        {
          nombre: 'Luis Enrique Bolívar Velázquez',
          cargo: 'Psicólogo · Líder del equipo de psicología',
          bio:
            'Con 29 años de trayectoria profesional y 17 años dedicados al área clínica, Luis ' +
            'Enrique lidera el equipo de psicología de Médicos por Venezuela. Su enfoque humanista ' +
            'integra herramientas de terapia cognitivo-conductual, Gestalt y sistémica, ' +
            'permitiéndole acompañar a cada paciente desde donde está, sin juicios y sin barreras. ' +
            'Cree firmemente que acceder a atención psicológica de calidad no debería ser un ' +
            'privilegio, y esa convicción es lo que lo trajo a este proyecto.'
        },
        {
          nombre: 'Gabriel Vilches',
          cargo: 'Infectólogo · Estados Unidos',
          bio:
            'Médico venezolano con años de experiencia en infectología, ejerce desde Estados ' +
            'Unidos y forma parte del equipo que impulsa a Médicos por Venezuela desde adentro. Su ' +
            'especialidad es clave en un país donde las enfermedades infecciosas siguen siendo una ' +
            'de las principales causas de consulta, y su compromiso con el proyecto lo demuestra ' +
            'cada día.'
        }
      ]
    }
  ]
} as const

// Los iconos llegaron el 2026-08-28 y se generan con `scripts/optimize-value-icons.mjs`. Van con
// `alt` vacío: cada uno repite el título que tiene justo al lado, así que un lector de pantalla
// que los anunciara diría el valor dos veces.
// ⚠️ Los archivos de origen venían con los nombres de los valores del PROTOTIPO (Calidad,
// Credibilidad, Autonomía, Gratuidad), no con los del copy, y algún dibujo no cuadra ni con su
// propio nombre. El de "Confidenciales" es un pulgar arriba, que es lo que peor encaja —la
// confidencialidad se dibuja con un candado—. Pendiente de confirmar con el equipo.
export const VALORES = [
  {
    titulo: 'Verificados',
    descripcion: 'Cada profesional en nuestra red ha sido verificado de forma independiente.',
    icono: '/img/valores/verificados.webp'
  },
  {
    titulo: 'Autónomos',
    descripcion: 'Independientes de intereses políticos, económicos o institucionales.',
    icono: '/img/valores/autonomos.webp'
  },
  {
    titulo: 'Gratuitos',
    descripcion: 'Sin costo para el paciente. Siempre. Sin excepciones.',
    icono: '/img/valores/gratuitos.webp'
  },
  {
    titulo: 'Confidenciales',
    descripcion: 'Tu consulta y tus datos son privados. Solo tu médico los ve.',
    icono: '/img/valores/confidenciales.webp'
  }
] as const

// Especialistas. Diez perfiles REALES: nombres, especialidades y retratos entregados por la
// organización el 2026-08-28. Hasta esa fecha eran seis tarjetas placeholder declaradas como tales
// —"Perfil por publicar"— porque una tarjeta con un nombre plausible junto a un "✓ Verificado" es
// una credencial falsa aunque sea de mentira para maquetar. Ya no hace falta: son personas.
//
// El campo `pais` se eliminó a petición del equipo. Las especialidades van tal como las entregó la
// organización (de ahí que unas nombren la disciplina y otras el rol): son credenciales, no copy, y
// no se reescriben. La única excepción es Yanara García Leyva, a quien se le quitó el "Especialista
// en" del principio — la sección ya se llama "Nuestros Especialistas" y esa fórmula ocupaba cuatro
// líneas en la tarjeta.
//
// Adarvelys Valor llegó sin especialidad en el archivo; se toma la del copy aprobado, donde figura
// como Médico Ocupacional. Su apellido y el de Johanna Palacios se escriben como en ese copy y como
// en la página del equipo, no como en el nombre del archivo ("Johana palacios").
//
// Orden alfabético por nombre de pila. Los retratos se generan con
// `scripts/optimize-specialist-photos.mjs`.
export const ESPECIALISTAS = {
  eyebrow: 'Nuestros Especialistas',
  titulo: 'Conocimiento médico al servicio de Venezuela.',
  subtitulo:
    'Cada especialista en nuestra red ha sido verificado de forma independiente. No son ' +
    'voluntarios anónimos — son profesionales con nombre, trayectoria y credenciales reales, que ' +
    'eligieron seguir aportando desde donde estén.',
  verificado: 'Verificado',
  perfiles: [
    {
      nombre: 'Adarvelys Valor',
      especialidad: 'Médico Ocupacional',
      foto: '/img/especialistas/adarvelys-valor.webp'
    },
    {
      nombre: 'Alejandro Marcano',
      especialidad: 'Cirugía ortopédica y traumatología deportiva',
      foto: '/img/especialistas/alejandro-marcano.webp'
    },
    {
      nombre: 'Antonio Briceño',
      especialidad: 'Traumatología y Ortopedia',
      foto: '/img/especialistas/antonio-briceno.webp'
    },
    {
      nombre: 'Jesús Ramírez',
      especialidad: 'Médico internista',
      foto: '/img/especialistas/jesus-ramirez.webp'
    },
    {
      nombre: 'Johanna Palacios',
      especialidad: 'Cirujana y patóloga',
      foto: '/img/especialistas/johanna-palacios.webp'
    },
    {
      nombre: 'Lizbeth Villavicencio',
      especialidad: 'Psicología',
      foto: '/img/especialistas/lizbeth-villavicencio.webp'
    },
    {
      nombre: 'Michael Sicurella',
      especialidad: 'Médico de Familia',
      foto: '/img/especialistas/michael-sicurella.webp'
    },
    {
      nombre: 'Sara Altuna',
      especialidad: 'Internista Oncóloga',
      foto: '/img/especialistas/sara-altuna.webp'
    },
    {
      nombre: 'Sirio Barreto',
      especialidad: 'Neurología',
      foto: '/img/especialistas/sirio-barreto.webp'
    },
    {
      nombre: 'Yanara García Leyva',
      especialidad: 'Medicina Familiar y Dermatología',
      foto: '/img/especialistas/yanara-garcia-leyva.webp'
    }
  ]
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

// Impacto: la banda de cifras, destino del ancla "Impacto" del navbar. Las tres primeras salen del
// backend y se animan con un contador; "Presencia global" no es un número y se pinta tal cual.
// Igual que en el hero, aquí va la CLAVE y no el valor: el número lo pone `useCifras`.
export const IMPACTO = [
  { clave: 'doctors', etiqueta: 'Médicos verificados en la red' },
  { clave: 'consultations', etiqueta: 'Consultas realizadas' },
  { clave: 'specialties', etiqueta: 'Especialidades disponibles' },
  { texto: 'Presencia global', etiqueta: 'Médicos voluntarios en múltiples países del mundo' }
] as const

// Blog. Tres tarjetas placeholder y badge "Próximamente", como pide el `.docx`. No son enlaces:
// el blog no existe todavía. Tampoco llevan titulares inventados, por lo mismo que los perfiles.
// El "Ver todos los artículos →" se retiró el 2026-08-28 junto con la entrada del menú, por lo
// mismo que el de Especialistas: no hay página a la que remitir.
export const BLOG = {
  eyebrow: 'Blog',
  badge: 'Próximamente',
  titulo: 'El conocimiento también se comparte.',
  plazas: 3,
  plaza: {
    categoria: 'Categoría',
    titulo: 'Título del artículo',
    fecha: 'Próximamente'
  }
} as const

// Cómo Funciona. Los pasos salen de la sección "PÁGINA: CÓMO FUNCIONA" del copy, que es donde
// están escritos; la sección del home remite justamente a esos tres flujos.
//
// Cada flujo termina en su propio botón de registro (2026-08-28): el mismo destino y el mismo texto
// que su puerta de entrada del principio del home.
//
// SEGUNDA RONDA (2026-08-28): cambia el ORDEN de los tabs —interconsulta primero, paciente
// segundo, voluntario tercero— y entra un paso nuevo, "Recepción Clínica", en los dos primeros
// flujos. No es un paso de más: es el que describe que hay una persona del equipo entre el caso y
// el especialista. Sustituye a "Describe el caso clínico" (médico) y a "Espera a ser atendido"
// (paciente), que era justamente lo que ese paso hacía sin nombrarlo. El flujo de voluntario NO lo
// lleva, y se queda igual que en la primera ronda.
export const COMO_FUNCIONA = {
  eyebrow: 'Cómo Funciona',
  titulo: 'Acceder es sencillo. Así funciona.',
  intro:
    'Médicos por Venezuela funciona de forma distinta según quién eres. Elige tu perfil y ' +
    'conoce cómo acceder.',
  // El orden importa: el médico que pide interconsulta va primero, y es el que se muestra al
  // cargar la página.
  flujos: [
    {
      id: 'medico',
      etiqueta: 'Soy médico, necesito apoyo clínico',
      // Mismo destino y mismo texto que su puerta de entrada: quien baja leyendo los pasos no debería
      // tener que volver arriba para encontrar el botón.
      cta: 'Pedir interconsulta →',
      href: RUTAS.medicoVenezuela,
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
          titulo: 'Recepción Clínica',
          descripcion:
            'Un miembro de nuestro equipo recibirá tu interconsulta, evaluará el caso y te ' +
            'conectará con el especialista indicado para apoyarte.'
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
      id: 'paciente',
      etiqueta: 'Soy paciente',
      cta: 'Solicitar consulta →',
      href: RUTAS.paciente,
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
          titulo: 'Recepción Clínica',
          descripcion:
            'Un miembro de nuestro equipo recibirá tu caso, lo evaluará y te derivará al ' +
            'especialista correspondiente.'
        },
        {
          numero: '04',
          titulo: 'Recibe atención especializada',
          descripcion: 'Tu médico escuchará tu caso, lo evaluará y te indicará qué hacer.'
        }
      ]
    },
    {
      id: 'voluntario',
      etiqueta: 'Quiero ser voluntario',
      cta: 'Registrarme →',
      href: RUTAS.voluntario,
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

// Quiénes Somos, Cómo Funciona e Impacto son secciones del HOME, así que son anclas — y se
// escriben con `/` delante en el Navbar, porque la barra también se pinta en `/quienes-somos`, y
// allí un `#ancla` a secas no llevaría a ninguna parte.
// "Especialistas" y "Blog" se retiraron del menú el 2026-08-28: ninguna de las dos páginas existe,
// y sus secciones del home ya no tienen un "ver todos" al que remitir. Con eso, TODAS las entradas
// del menú llevan a algún sitio: no queda ni un `<span>` inerte.
export const NAV: NavItem[] = [
  { label: 'Inicio', ancla: 'inicio' },
  { label: 'Quiénes Somos', ancla: 'quienes-somos' },
  { label: 'Cómo Funciona', ancla: 'como-funciona' },
  { label: 'Impacto', ancla: 'impacto' },
  { label: 'Únete', href: RUTAS.voluntario }
]

// El aviso legal se acortó en la segunda ronda de copy (2026-08-28): fuera la mención a Estados
// Unidos y fuera la advertencia de que la orientación no sustituye la atención presencial de
// urgencia. La `descripcion` de la columna de marca también decía "registrada en Estados Unidos";
// se quita ahí igualmente, porque si no el pie se contradice consigo mismo a dos párrafos de
// distancia. ⚠️ La advertencia de urgencias era una salvaguarda clínica, no un texto de relleno:
// se retira porque lo pide el copy aprobado, y queda anotado aquí por si alguien la echa en falta.
export const FOOTER = {
  descripcion:
    'Organización sin fines de lucro registrada. Conectamos profesionales de la salud ' +
    'verificados con quienes los necesitan dentro de Venezuela.',
  avisoLegal: 'Médicos por Venezuela es una organización sin fines de lucro registrada.',
  copyright: '© 2026 Médicos por Venezuela',
  // Franja de créditos, debajo del aviso legal. The Climb va como texto —no se dio una URL—; solo
  // Softronic lleva enlace. Se parte en tres trozos para no meter marcado dentro de una cadena.
  colaboracion: {
    antes: 'Esto es posible gracias a una colaboración entre ',
    climb: 'The Climb',
    entre: ' y ',
    softronic: 'Softronic',
    softronicUrl: 'https://softronic.dev/es'
  },
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
      enlaces: [
        // Ahora es una página propia, no el ancla del home.
        { label: 'Quiénes Somos', href: RUTAS.quienesSomos },
        { label: 'Impacto', ancla: 'impacto' }
      ]
    }
  ]
} as const
