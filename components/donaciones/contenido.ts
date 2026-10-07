// Los TEXTOS y los DATOS de la página de donaciones, sacados de la plantilla.
//
// Están aquí y no incrustados en el marcado por dos razones: los componentes se leen (la tarjeta
// del equipo son nueve figuras idénticas con otros datos) y, sobre todo, porque cada cadena
// existe en castellano y en inglés y así los dos idiomas viven en la misma línea — si alguien
// corrige una frase, ve la pareja.
//
// La página es BILINGÜE A LA MANERA DE LA PLANTILLA: el DOM lleva SIEMPRE los dos idiomas y el
// CSS esconde el que no toca (`.donaciones[data-lang="es"] [lang="en"]`). Es lo que hace que
// cambiar de idioma no vuelva a pintar nada y, sobre todo, que el servidor y el cliente rindan
// exactamente el mismo HTML: no hay un texto "inicial" que pueda diferir. Ver el componente
// `Bilingue`.

/** Un par de cadenas: la castellana y la inglesa. */
export type Par = { es: string; en: string }

/** Lo que la plantilla llamaba `CONFIG`. */
export const CONFIG: { whatsappComprobante: string; urlLanding: string } = {
  /**
   * WhatsApp al que mandar el comprobante. VACÍO en la plantilla: mientras lo esté, el aviso
   * "¿Ya donaste?" no se pinta (`hidden`), igual que en el original. Al poner un enlace
   * (`https://wa.me/58…`) aparece solo.
   */
  whatsappComprobante: '',
  /** La URL que se comparte por WhatsApp. */
  urlLanding: 'https://dona.medicosxvenezuela.workers.dev'
}

/** El enlace de PayPal de la organización, tal cual lo trae la plantilla. */
export const URL_PAYPAL =
  'https://www.paypal.com/qrcodes/managed/103a3936-1924-44ac-a00d-ce6a82bd0f8b'

export const URL_INSTAGRAM = 'https://www.instagram.com/medicosxvenezuela/'
export const URL_SITIO = 'https://www.medicosporvenezuela.org'

/** Los importes del primer paso de la caja. `'otro'` abre el campo libre. */
export const MONTOS = [1, 5, 10, 25, 50] as const
export const MONTO_POR_OMISION = 10

/** El texto que se comparte por WhatsApp, en los dos idiomas. */
export const TEXTO_COMPARTIR: Par = {
  es:
    'Médicos venezolanos atienden gratis por videollamada a quien no puede pagar una consulta. ' +
    'Conoce y apoya el proyecto: ',
  en:
    'Venezuelan doctors are treating patients for free by video call. Learn about and support ' +
    'the project: '
}

/** El `<title>` de la página en cada idioma. */
export const TITULO: Par = {
  es: 'Dona a Médicos por Venezuela',
  en: 'Give to Médicos por Venezuela'
}

/**
 * Las alturas de las 34 barras de la onda del reproductor, en la escala del original
 * (se pintan a `valor * 0.44` píxeles). Es un dibujo, no la forma real del audio.
 */
export const ONDA: readonly number[] = [
  69, 80, 24, 72, 54, 81, 70, 78, 56, 67, 75, 47, 63, 81, 54, 14, 69, 51, 67, 38, 54, 84, 70, 99,
  54, 80, 51, 63, 85, 73, 76, 51, 84, 41
]

/** Un tramo de subtítulo de la nota de voz: desde/hasta en segundos, y el texto en cada idioma. */
export type Subtitulo = { desde: number; hasta: number } & Par

/** Los subtítulos de la nota de voz de Luis, sincronizados a mano con el audio. */
export const SUBTITULOS: readonly Subtitulo[] = [
  {
    desde: 0,
    hasta: 5.8,
    es: 'Eso fue una luz… me apareció un ángel, unos ángeles, los dos,',
    en: 'It was a light… an angel appeared to me, angels, the two of them,'
  },
  {
    desde: 5.8,
    hasta: 11.8,
    es: 'porque me atendieron de maravilla por videollamada.',
    en: 'because they treated me wonderfully by video call.'
  },
  {
    desde: 11.8,
    hasta: 19.1,
    es: 'Me han tratado muy bien, muy bien, a distancia, pero muy bien. Me mandaron unos antibióticos para la médula,',
    en: "They've treated me very, very well, from a distance, but very well. They prescribed antibiotics for my spinal cord,"
  },
  {
    desde: 19.1,
    hasta: 30.1,
    es: 'porque tengo mielitis por una placa que me colocaron en el cuello, y eso presentó una infección.',
    en: 'because I have myelitis from a plate they put in my neck, and it got infected.'
  },
  {
    desde: 30.1,
    hasta: 35.3,
    es: 'Todos los días están atentos, me escriben mensajes.',
    en: 'Every day they check on me, they send me messages.'
  },
  {
    desde: 35.3,
    hasta: 41.2,
    es: 'No alcanzo el tiempo para agradecer, porque estoy muy, muy agradecido',
    en: "I don't have enough time to thank you, because I'm so, so grateful"
  },
  {
    desde: 41.2,
    hasta: 47.3,
    es: 'por tan maravillosa atención. No pensé que iba a existir esa alternativa.',
    en: 'for such wonderful care. I never thought this option would exist.'
  },
  {
    desde: 47.3,
    hasta: 52.8,
    es: 'Es lo mejor que nos ha pasado en cuatro años.',
    en: "It's the best thing that has happened to us in four years."
  },
  {
    desde: 52.8,
    hasta: 58,
    es: 'Muchas gracias. Dios los bendiga a todos.',
    en: 'Thank you so much. God bless you all.'
  }
]

/** Un testimonio del carrusel "Luis no es el único". */
export type Voz = { cita: Par; pie: Par }

export const VOCES: readonly Voz[] = [
  {
    cita: {
      es: '«Ya me atendió la cardióloga. Fui muy bien atendida por la profesional.»',
      en: '“The cardiologist already saw me. The doctor took great care of me.”'
    },
    pie: { es: 'Paciente, Venezuela', en: 'Patient, Venezuela' }
  },
  {
    cita: {
      es: '«Ya hablé con el doctor sobre mi tensión y la ansiedad. Me dijo qué debía hacer. Todo muy bien.»',
      en: '“I talked to the doctor about my blood pressure and anxiety. He told me what to do. Everything went well.”'
    },
    pie: { es: 'Paciente, Venezuela', en: 'Patient, Venezuela' }
  },
  {
    cita: {
      es: '«Excelente el trabajo que realizan. Gracias infinitas a todos los médicos que ayudan desde afuera.»',
      en: '“Excellent work. Endless thanks to all the doctors helping from abroad.”'
    },
    pie: { es: 'Paciente, Venezuela', en: 'Patient, Venezuela' }
  },
  {
    cita: {
      es: '«Fue muy eficiente. El sistema me costó un poco al inicio, pero lo logré y el doctor me ayudó.»',
      en: '“It was very efficient. The system was a bit hard for me at first, but I made it and the doctor helped me.”'
    },
    pie: { es: 'Paciente, Venezuela', en: 'Patient, Venezuela' }
  },
  {
    cita: {
      es: '«El médico me llamó. Dios los bendiga por tan maravillosa iniciativa.»',
      en: '“The doctor called me. God bless you for such a wonderful initiative.”'
    },
    pie: { es: 'Paciente, Venezuela', en: 'Patient, Venezuela' }
  },
  {
    cita: {
      es: '«Pude conversar con el especialista, muchas gracias.»',
      en: '“I was able to talk with the specialist, thank you so much.”'
    },
    pie: { es: 'Paciente, Venezuela', en: 'Patient, Venezuela' }
  }
]

/**
 * Una persona del equipo.
 *
 * `iniciales` es el respaldo: `.foto::before` las pinta con `content: attr(data-ini)` debajo de
 * la foto, así que si la imagen no carga la tarjeta sigue teniendo sentido en vez de dejar un
 * hueco. `especialidad` y `rol` son opcionales porque en la plantilla no todas las tienen.
 */
export type MiembroEquipo = {
  nombre: string
  iniciales: string
  foto: string
  especialidad?: Par
  rol?: Par
}

/**
 * El equipo, en el orden del carrusel de la plantilla.
 *
 * Las fotos venían enlazadas desde Google Drive (`lh3.googleusercontent.com/d/<id>=w600`). Ahora
 * viven en `public/donaciones/equipo/`: el propio LEEME de la plantilla advertía de que un cambio
 * de permisos en Drive dejaría la página mostrando solo las iniciales, y además la CSP del sitio
 * (`img-src 'self' data: …` en `next.config.js`) no admite imágenes de terceros.
 */
export const EQUIPO: readonly MiembroEquipo[] = [
  {
    nombre: 'Dra. Oriana Ramírez',
    iniciales: 'OR',
    foto: '/donaciones/equipo/oriana-ramirez.jpg',
    especialidad: { es: 'Medicina interna', en: 'Internal medicine' },
    rol: { es: 'Cofundadora', en: 'Co-founder' }
  },
  {
    nombre: 'Adarvelys Valor',
    iniciales: 'AV',
    foto: '/donaciones/equipo/adarvelys-valor.jpg',
    rol: { es: 'Cofundadora', en: 'Co-founder' }
  },
  {
    nombre: 'Dr. Jesús Ramírez',
    iniciales: 'JR',
    foto: '/donaciones/equipo/jesus-ramirez.png',
    especialidad: { es: 'Medicina interna', en: 'Internal medicine' }
  },
  {
    nombre: 'Dr. Gabriel Vilchez',
    iniciales: 'GV',
    foto: '/donaciones/equipo/gabriel-vilchez.jpg',
    especialidad: { es: 'Infectología', en: 'Infectious diseases' }
  },
  {
    nombre: 'Dra. Johana Palacios',
    iniciales: 'JP',
    foto: '/donaciones/equipo/johana-palacios.jpg',
    especialidad: { es: 'Cirugía y patología', en: 'Surgery and pathology' }
  },
  {
    nombre: 'Dra. Sara Altuna',
    iniciales: 'SA',
    foto: '/donaciones/equipo/sara-altuna.jpg',
    especialidad: { es: 'Medicina interna y oncología', en: 'Internal medicine and oncology' }
  },
  {
    nombre: 'Dra. Sirio Barreto',
    iniciales: 'SB',
    foto: '/donaciones/equipo/sirio-barreto.jpg',
    especialidad: { es: 'Neurología', en: 'Neurology' }
  },
  {
    nombre: 'Dr. Michael Sicurella',
    iniciales: 'MS',
    foto: '/donaciones/equipo/michael-sicurella.jpg',
    especialidad: { es: 'Medicina familiar', en: 'Family medicine' }
  },
  {
    nombre: 'Luis Enrique Bolívar',
    iniciales: 'LB',
    foto: '/donaciones/equipo/luis-enrique-bolivar.jpg',
    especialidad: { es: 'Psicología', en: 'Psychology' }
  }
]
