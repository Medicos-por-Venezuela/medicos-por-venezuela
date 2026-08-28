# Datos estructurados — detección, generación y validación

**Fecha:** 2026-08-28 · **Implementado en:** `lib/schema.ts`, `pages/index.tsx`,
`pages/quienes-somos.tsx` · **Salida generada:** `generated-schema.json`

## 1. Detección — situación de partida

Analizadas las dos páginas públicas de contenido sobre el build de producción:

| Página           | JSON-LD | Microdatos | RDFa |
| ---------------- | ------- | ---------- | ---- |
| `/`              | 0       | 0          | 0    |
| `/quienes-somos` | 0       | 0          | 0    |

**El sitio no tenía ningún dato estructurado.** No había nada que corregir ni ningún tipo obsoleto
que retirar: se parte de cero.

## 2. Qué se implementó

Formato JSON-LD, que es el que Google declara preferido, y **en el HTML del servidor**, no
inyectado desde JavaScript: la guía de renderizado de Google de diciembre de 2025 avisa de que los
datos estructurados que solo aparecen tras ejecutar JS pueden procesarse con retraso. Estas páginas
son estáticas, así que el bloque sale ya en la respuesta.

### Home (`/`) — 3.473 bytes

| Nodo                          | Qué declara                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MedicalOrganization` + `NGO` | La entidad: nombre, `MEDxVZLA` como nombre alternativo, logotipo, lema, descripción, correo, Instagram, país atendido, idioma, punto de contacto |
| ↳ `member` × 10               | Los diez especialistas del home, con nombre, especialidad (`jobTitle`) y retrato                                                                 |
| `WebSite`                     | El sitio, en español, publicado por la organización                                                                                              |

**Tipo doble a propósito.** `MedicalOrganization` y `NGO` son las dos ciertas, schema.org admite
varios tipos en un mismo nodo, y ninguna sola dice lo que es esto: una es "organización médica" sin
decir que no tiene ánimo de lucro; la otra es "ONG" sin decir que es médica.

### `/quienes-somos` — 2.625 bytes

| Nodo                          | Qué declara                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| `AboutPage`                   | La página, en español, parte del sitio, y `about` → la organización |
| `MedicalOrganization` + `NGO` | Nodo mínimo, solo con el `@id` y los seis miembros del equipo       |
| `Person` × 6                  | Cofundadoras y equipo, con su cargo y `worksFor` → la organización  |

### Entidad única entre páginas

La organización se define **una sola vez**, en el home, con
`@id: https://medicosporvenezuela.org/#organizacion`. Las demás páginas la referencian por ese `@id`
en lugar de repetir el nodo. Los buscadores ven así **una entidad con varias páginas**, y no varias
organizaciones parecidas — que es el error habitual de repetir el bloque de Organization entero en
cada plantilla.

Los especialistas van solo en el home y el equipo solo en `/quienes-somos`: **cada página declara lo
que enseña.** Repetir a todo el mundo en todas partes no añade señal, solo peso.

## 3. Validación

Comprobado con un validador propio sobre el HTML servido de las dos páginas (no sobre el código
fuente, sino sobre lo que recibiría un rastreador):

| Comprobación                                       | Resultado |
| -------------------------------------------------- | --------- |
| JSON sintácticamente válido                        | ✅        |
| `@context` = `https://schema.org`                  | ✅        |
| `@type` en todos los nodos                         | ✅        |
| Todas las URLs absolutas (`url`, `logo`, `image`)  | ✅        |
| Sin texto de relleno (`[Nombre]`, `TODO`, `Lorem`) | ✅        |
| `Organization` con `name` y `url`                  | ✅        |
| Todo `Person` con `name`                           | ✅        |
| Sin tipos obsoletos                                | ✅        |
| Un solo bloque JSON-LD por página                  | ✅        |

**Pendiente de validación externa:** el [Rich Results Test](https://search.google.com/test/rich-results)
y el [Schema Markup Validator](https://validator.schema.org/) necesitan una URL pública. Se pasan
cuando esto se despliegue.

## 4. Decisiones de omisión — y por qué

Cada propiedad ausente lo está por una razón, no por olvido. En salud, un dato falso en JSON-LD no
es un adorno de más: es una declaración formal.

| Propiedad          | Por qué NO está                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foundingDate`     | Nadie ha dado una fecha de fundación. El copy dice "nacimos en medio del terremoto", que no es una fecha                                                                        |
| `nonprofitStatus`  | El enumerado de schema.org es por jurisdicción (`Nonprofit501c3`, etc.) y el copy aprobado del 2026-08-28 retiró justamente la mención a Estados Unidos                         |
| `address`          | No hay sede física. Una dirección inventada es peor que ninguna, y activa señales de negocio local que no aplican                                                               |
| `telephone`        | La organización no publica teléfono; el canal es el correo y el formulario                                                                                                      |
| `aggregateRating`  | **No hay reseñas reales.** Los testimonios del home son citas de pacientes, no puntuaciones, y fabricar una valoración en un sitio médico es exactamente lo que Google penaliza |
| `SearchAction`     | El sitio no tiene buscador. Declarar uno que no existe es el mismo tipo de dato falso                                                                                           |
| `medicalSpecialty` | Son más de veinte y la lista vive en el backend. Con la página de `/especialistas` construida, tendrá sentido declararlas ahí                                                   |
| `FAQPage`          | Google retiró los resultados enriquecidos de FAQ para todos los sitios el 7 de mayo de 2026. Cuando exista `/preguntas-frecuentes`, el tipo correcto es `QAPage`                |

## 5. Efecto lateral: el logotipo en mapa de bits

El `logo` de una organización debe ser una imagen que el rastreador pueda usar, y el sitio solo
tenía SVG. Se genera `public/img/logo-medicos-por-venezuela.png` (1000 × 384, 22 KB) desde el mismo
SVG de marca, con `scripts/build-logo-raster.mjs`.

Sirve dos veces: aquí, y para la imagen de Open Graph cuando se implemente — **WhatsApp, Facebook y
X no renderizan SVG**, y WhatsApp es el canal por el que este público comparte el sitio.

Fondo blanco y no transparente, a propósito: el logotipo es navy y sobre el modo oscuro de WhatsApp
desaparecería.

## 6. Siguientes pasos

| Cuándo                                               | Qué añadir                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Al desplegar                                         | Pasar las dos páginas por el Rich Results Test y el validador de schema.org           |
| Con `/interconsulta-medica` y `/voluntariado-medico` | `Service` con `provider` → `@id` de la organización                                   |
| Con `/especialistas`                                 | `ProfilePage` o `ItemList` de `Person`, y ahí sí `medicalSpecialty`                   |
| Con `/preguntas-frecuentes`                          | `QAPage` (**no** `FAQPage`)                                                           |
| Con el blog                                          | `BlogPosting` con `author` → `Person` del médico que firma. Requisito YMYL, no adorno |
| Con más de una página en la ruta                     | `BreadcrumbList`                                                                      |
