# Estrategia SEO — medicosporvenezuela.org

**Fecha:** 2026-08-28 · **Plantilla base:** `generic.md` (ninguna del catálogo encaja: no es SaaS,
ni comercio, ni negocio local, ni medio; es una ONG médica sin sede física con tres públicos en
tres sitios distintos).

> **Lo que este documento NO trae, y por qué.** No hay volúmenes de búsqueda, ni dificultad de
> palabra clave, ni autoridad de dominio. No hay Search Console conectado ni ninguna herramienta de
> datos, así que cualquier cifra de esas sería inventada — y un plan con números inventados es peor
> que uno sin ellos, porque se toman decisiones creyéndolos. **Instrumentar es la tarea 1 de la
> fase 1.** Lo que sí está medido: el estado técnico del sitio (§4, comprobado hoy sobre el build
> de producción) y el panorama competitivo (`COMPETITOR-ANALYSIS.md`).

## 1. El negocio, en términos de búsqueda

No es un sitio: son **tres embudos que casi no se solapan**, y hoy comparten una sola página.

| Público                 | Dónde está                                   | Qué busca                                                                | Volumen      | Valor por visita            |
| ----------------------- | -------------------------------------------- | ------------------------------------------------------------------------ | ------------ | --------------------------- |
| **Paciente**            | Venezuela, móvil, mala conexión              | síntoma + "gratis", "consulta médica online"                             | Alto         | Bajo (muchos no convierten) |
| **Médico en Venezuela** | Venezuela, consultorio                       | "interconsulta", "segunda opinión especializada", especialidad           | **Muy bajo** | **Muy alto**                |
| **Médico voluntario**   | Diáspora (EE. UU., España, Chile, Colombia…) | "voluntariado médico venezolano", "ayudar a Venezuela desde el exterior" | Bajo         | Alto (es la oferta)         |

Consecuencia directa: **una sola página no puede rankear para los tres**. Hoy el home lo intenta y
por eso no compite en ninguno. La arquitectura de `SITE-STRUCTURE.md` existe para separarlos.

## 2. Realidad competitiva

Detalle en `COMPETITOR-ANALYSIS.md`. El resumen que condiciona la estrategia:

- El nicho **"telemedicina gratis Venezuela" está ocupado desde 2017** por actores con años de
  ventaja: MVO, SOS Telemedicina (UCV, dominio universitario), Asistensi.
- **Ninguno ocupa los otros dos embudos.** No hay competidor claro para "interconsulta entre
  médicos venezolanos" ni para "voluntariado médico para la diáspora". Ahí la competencia es débil y
  la organización tiene una oferta real que los demás no tienen.
- **Por eso la apuesta no es pelear por el término más buscado**, sino ganar los dos que nadie ha
  reclamado y usar el tercero (paciente) como captación de marca, no de posiciones.

## 3. Diferenciales defendibles (materia prima del E-E-A-T)

No son eslóganes: cada uno se puede demostrar en la página, que es lo que un buscador —clásico o
generativo— puede verificar.

1. **Verificación automática contra el SACS**, el registro oficial venezolano. Es la única
   organización del panorama que verifica credenciales contra la fuente y lo dice.
2. **Gratuito siempre, sin plan ni membresía.** MVO y Asistensi tienen modelos de pago o de
   cobertura; aquí no hay ninguno.
3. **Diez especialistas con nombre, cara y especialidad**, ya publicados. Es exactamente lo que pide
   el criterio de "Experiencia" de Google para contenido médico (YMYL).
4. **Equipo con nombre y trayectoria** en `/quienes-somos`, con las cofundadoras identificadas.
5. **Recepción clínica en la interconsulta**: hay una persona del equipo entre el caso y el
   especialista. Ningún competidor describe un proceso así.

**Aviso YMYL.** Salud es "Your Money or Your Life": Google aplica ahí el listón más alto de E-E-A-T
que tiene. Todo contenido clínico debe ir **firmado por un médico identificable, con credencial
visible y fecha**. Un artículo médico sin autor real es, en este vertical, contraproducente.

## 4. Estado técnico actual (medido, no estimado)

Comprobado hoy sobre el build de producción, ocho rutas públicas:

| Hallazgo                                 | Alcance                                                                       | Gravedad    |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ----------- |
| **Sin `robots.txt`**                     | Todo el sitio (404)                                                           | Alta        |
| **Sin `sitemap.xml`**                    | Todo el sitio (404)                                                           | Alta        |
| **Sin Open Graph ni Twitter Cards**      | 8 de 8 páginas                                                                | **Crítica** |
| **Sin `canonical`**                      | 8 de 8 páginas                                                                | Media       |
| **Sin `meta description`**               | 6 de 8 páginas                                                                | Media       |
| **Sin `<title>` ni `<h1>`**              | `/mi-caso`, `/elegir-rol`                                                     | Media       |
| **Superficies de aplicación indexables** | `/sala-espera`, `/mi-caso`, `/elegir-rol`, `/auth/callback`, `/panel-medico*` | Media       |

Lo de Open Graph es crítico, y no por posicionamiento: **el canal de distribución de este público es
WhatsApp**. Hoy, cuando alguien comparte el enlace, sale sin imagen, sin título y sin descripción.
Cada enlace compartido —el mecanismo de crecimiento más probable de esta organización— llega roto.
Es la corrección con mejor relación esfuerzo/impacto de todo el plan.

Lo que ya está bien y no hay que tocar: HTTPS, `<html lang="es">`, diseño móvil primero, imágenes en
WebP con `sizes`, tipografía variable precargada, contraste AA auditado y `noindex` en `/admin`.

## 5. Pilares de contenido

| Pilar                           | Público             | Página cabecera         | Objetivo                                   |
| ------------------------------- | ------------------- | ----------------------- | ------------------------------------------ |
| **Interconsulta especializada** | Médico en Venezuela | `/interconsulta-medica` | Posiciones. Competencia débil              |
| **Voluntariado médico**         | Diáspora            | `/voluntariado-medico`  | Posiciones + captación de médicos          |
| **Consulta gratuita**           | Paciente            | `/consulta-gratuita`    | Conversión, no posiciones                  |
| **Salud mental**                | Paciente            | `/psicologia`           | Nicho propio, con demanda y menos saturado |
| **Quiénes somos**               | Los tres            | `/quienes-somos` ✅     | E-E-A-T, entidad, citas de IA              |

## 6. GEO — buscadores generativos

Para esta organización importa más que el ranking clásico: quien pregunta a ChatGPT "¿dónde puede un
venezolano conseguir atención médica gratis?" está a una respuesta de convertirse en paciente.

- **Datos citables y concretos** en la página, no dentro de una imagen: cuántos médicos verificados,
  cuántas especialidades, cómo se verifica (SACS), qué cuesta (nada). Ya están en la banda de
  Impacto y desde el 2026-08-28 salen del backend, así que son ciertos.
- **Entidad consistente**: mismo nombre, misma descripción y mismo dominio en todas partes. El
  `MedicalOrganization` de `SCHEMA.md` lo declara formalmente.
- **Formato extraíble**: definiciones, pasos numerados, preguntas con respuesta directa. La sección
  "Cómo Funciona" ya tiene esa forma.
- `llms.txt`: opcional y de baja prioridad — Google lo trata como un fichero de texto cualquiera.

## 7. KPIs

Las líneas base están **sin medir**: no hay analítica histórica (GA4 se instaló hoy). Los objetivos
son rangos razonables para una ONG con dominio nuevo y sin presupuesto de enlaces, no promesas.

| Métrica                                | Línea base          | 3 meses         | 6 meses             | 12 meses          |
| -------------------------------------- | ------------------- | --------------- | ------------------- | ----------------- |
| Páginas indexadas                      | sin medir (sin GSC) | 8–12            | 20–30               | 40–60             |
| Tráfico orgánico / mes                 | sin medir           | establecer base | +50 % sobre la base | ×3 sobre la base  |
| Consultas de paciente desde orgánico   | sin medir           | instrumentado   | 15 % del total      | 30 % del total    |
| Registros de voluntario desde orgánico | sin medir           | instrumentado   | 10 / mes            | 30 / mes          |
| Core Web Vitals (campo, CrUX)          | sin datos           | recogiendo      | LCP < 2,5 s         | los tres en verde |
| Menciones en IA (ChatGPT / AIO)        | sin medir           | establecer base | citado en 1 de 5    | 2 de 5            |

**Hoy no se puede rellenar ninguna de estas casillas.** La fase 1 existe justamente para poder
rellenarlas.

## 8. Riesgos

| Riesgo                                          | Mitigación                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Contenido médico sin autor identificable → YMYL | Todo artículo clínico firmado por un médico de la red, con credencial y fecha                                                        |
| El blog se lanza y se abandona                  | Mejor 6 artículos buenos al año que 24 planificados y 3 publicados. La cadencia de `CONTENT-CALENDAR.md` es deliberadamente baja     |
| Publicar perfiles de médicos reales             | Los diez actuales están publicados con su consentimiento; cualquier página nueva de especialista necesita el mismo permiso explícito |
| Competir de frente con SOS Telemedicina (UCV)   | No competir: es una universidad, con una autoridad de dominio inalcanzable a corto plazo. Ir a los embudos que no cubre              |
| Optimizar para tráfico que no convierte         | El KPI que manda es registros, no visitas                                                                                            |
