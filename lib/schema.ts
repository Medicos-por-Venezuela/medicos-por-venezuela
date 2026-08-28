// Datos estructurados (JSON-LD) del sitio público.
//
// POR QUÉ IMPORTA AQUÍ MÁS DE LO NORMAL. Salud es un vertical YMYL ("Your Money or Your Life"): es
// donde Google aplica el listón más alto de E-E-A-T. El schema no da posiciones por sí solo, pero
// es lo que declara de forma legible por máquina que esta organización existe, que es una ONG
// médica, y que detrás hay personas con nombre y especialidad. Y para los buscadores generativos
// —ChatGPT, Perplexity, AI Overviews— es la diferencia entre ser una página más y ser una entidad
// que se puede citar.
//
// TODO lo que se declara aquí es comprobable en la propia página. Nada de datos inventados: no hay
// `foundingDate` porque nadie ha dado una fecha, ni `nonprofitStatus` porque ese enumerado es por
// jurisdicción y el copy aprobado retiró la mención a Estados Unidos, ni `aggregateRating` porque
// no hay reseñas reales. Un dato falso en JSON-LD no es un adorno de más: es una declaración
// formal, y en salud se paga cara.
//
// El tipo es doble, `MedicalOrganization` + `NGO`. Las dos son ciertas y schema.org admite varios
// tipos en el mismo nodo; juntas dicen exactamente lo que es esto y ninguna sola lo dice.
//
// El `@id` es la clave de todo el montaje: la organización se define UNA vez, en el home, y las
// demás páginas la referencian por `@id` en vez de repetirla. Así los buscadores ven una entidad
// con varias páginas, y no varias organizaciones parecidas.

import { EQUIPO, ESPECIALISTAS, MARCA, QUIENES_SOMOS } from '../components/home/copy'

export const SITIO = 'https://medicosporvenezuela.org'

// Identificadores estables de las entidades. Al ser rutas con fragmento, no chocan con URLs reales.
const ID_ORGANIZACION = `${SITIO}/#organizacion`
const ID_SITIO_WEB = `${SITIO}/#sitio`

const LOGO = `${SITIO}/img/logo-medicos-por-venezuela.png`

// Referencia corta a la organización, para no repetir el nodo entero en cada página.
const refOrganizacion = { '@id': ID_ORGANIZACION }

type Persona = { nombre: string; cargo?: string; especialidad?: string; foto?: string }

function comoPersona(p: Persona) {
  return {
    '@type': 'Person',
    name: p.nombre,
    // `jobTitle` recoge el cargo tal como lo publica la organización. En los especialistas es la
    // especialidad, que es lo que la tarjeta muestra debajo del nombre.
    jobTitle: p.cargo ?? p.especialidad,
    ...(p.foto ? { image: `${SITIO}${p.foto}` } : {}),
    worksFor: refOrganizacion
  }
}

// La organización. Se emite en el home y se referencia desde el resto.
function organizacion() {
  return {
    '@type': ['MedicalOrganization', 'NGO'],
    '@id': ID_ORGANIZACION,
    name: MARCA.nombre,
    alternateName: 'MEDxVZLA',
    url: SITIO,
    logo: {
      '@type': 'ImageObject',
      url: LOGO,
      width: 1000,
      height: 384
    },
    slogan: MARCA.tagline,
    // La misma frase del pie. Si cambia allí, cambia aquí: sale del mismo módulo de copy.
    description: QUIENES_SOMOS.parrafos[0],
    email: MARCA.correo,
    sameAs: [MARCA.instagramUrl],
    // Sin `address`: la organización no tiene sede física y una dirección inventada sería peor que
    // ninguna. `areaServed` sí es cierto y es lo que de verdad describe el alcance.
    areaServed: {
      '@type': 'Country',
      name: 'Venezuela'
    },
    knowsLanguage: 'es',
    // Los diez especialistas que el home publica con nombre, especialidad y retrato.
    member: ESPECIALISTAS.perfiles.map((p) => comoPersona(p)),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: MARCA.correo,
      availableLanguage: 'Spanish',
      areaServed: 'VE'
    }
  }
}

// JSON-LD del home: la organización más el sitio web al que pertenece.
//
// Sin `potentialAction`/`SearchAction`: el sitio no tiene buscador, y declarar uno que no existe
// es justo el tipo de dato falso que este archivo evita.
export function schemaHome() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizacion(),
      {
        '@type': 'WebSite',
        '@id': ID_SITIO_WEB,
        url: SITIO,
        name: MARCA.nombre,
        inLanguage: 'es',
        publisher: refOrganizacion
      }
    ]
  }
}

// JSON-LD de `/quienes-somos`: la página "acerca de" y las seis personas del equipo que muestra.
//
// Los especialistas NO se repiten aquí y el equipo no aparece en el home: cada página declara lo
// que enseña. Repetir en todas partes a todo el mundo no añade señal, solo peso.
export function schemaQuienesSomos() {
  const personas = EQUIPO.grupos.flatMap((g) => g.personas.map((p) => comoPersona(p)))

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        '@id': `${SITIO}/quienes-somos#pagina`,
        url: `${SITIO}/quienes-somos`,
        name: `${QUIENES_SOMOS.eyebrow} — ${MARCA.nombre}`,
        description: QUIENES_SOMOS.titulo,
        inLanguage: 'es',
        isPartOf: { '@id': ID_SITIO_WEB },
        about: refOrganizacion,
        mainEntity: refOrganizacion
      },
      // Nodo mínimo de la organización: solo el `@id` y lo que esta página aporta de nuevo (quiénes
      // la forman). El nodo completo vive en el home.
      {
        '@type': ['MedicalOrganization', 'NGO'],
        '@id': ID_ORGANIZACION,
        name: MARCA.nombre,
        url: SITIO,
        member: personas
      },
      ...personas
    ]
  }
}

// Se serializa con `JSON.stringify` a secas y se escapa el `<` para que una cadena que contuviera
// "</script>" no pudiera cerrar la etiqueta antes de tiempo. Hoy el copy no tiene nada de eso, pero
// el copy lo edita gente y esto no debe depender de que nadie escriba nunca un signo de menor.
export function comoScript(datos: object): string {
  return JSON.stringify(datos).replace(/</g, '\\u003c')
}
