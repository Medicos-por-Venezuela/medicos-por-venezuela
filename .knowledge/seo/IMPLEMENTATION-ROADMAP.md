# Hoja de ruta

**Fecha:** 2026-08-28. Ordenada por impacto real, no por el orden del manual.

Marcado ✅ lo que ya se hizo en la rama `feat/home-refresh-marca`.

## Fase 1 — cimientos (semanas 1–4)

Nada de esto es contenido. Es lo que hace que el contenido cuente.

| #    | Tarea                                                                   | Impacto   | Esfuerzo | Estado   |
| ---- | ----------------------------------------------------------------------- | --------- | -------- | -------- |
| 1.1  | **Open Graph + Twitter Cards en todas las páginas públicas**            | Crítico   | S        | ⬜       |
| 1.2  | **`robots.txt`**                                                        | Alto      | XS       | ⬜       |
| 1.3  | **`sitemap.xml`** (solo rutas indexables)                               | Alto      | S        | ⬜       |
| 1.4  | **`noindex` en las superficies de aplicación**                          | Alto      | XS       | ⬜       |
| 1.5  | **`canonical` en todas las páginas**                                    | Medio     | S        | ⬜       |
| 1.6  | **`meta description` en las 6 páginas que no la tienen**                | Medio     | S        | ⬜       |
| 1.7  | **`<title>` y `<h1>` en `/mi-caso` y `/elegir-rol`**                    | Medio     | XS       | ⬜       |
| 1.8  | **JSON-LD: `MedicalOrganization` + `WebSite` + `AboutPage` + `Person`** | Alto      | M        | ✅ hecho |
| 1.9  | **Google Analytics 4**                                                  | Necesario | M        | ✅ hecho |
| 1.10 | **Verificar el dominio en Search Console y enviar el sitemap**          | Necesario | XS       | ⬜       |
| 1.11 | **Bing Webmaster Tools** (alimenta las citas de Copilot)                | Medio     | XS       | ⬜       |

**1.1 es la primera por una razón que no es de posicionamiento.** El canal de distribución de este
público es WhatsApp, y hoy cada enlace compartido llega sin imagen, sin título y sin descripción.
Es la corrección con mejor relación esfuerzo/impacto de todo el plan, y no depende de que Google
haga nada.

**1.10 es la que desbloquea el resto del plan.** Sin Search Console no hay línea base, y sin línea
base ningún KPI de `SEO-STRATEGY.md` se puede rellenar.

## Fase 2 — los embudos (semanas 5–12)

| #   | Tarea                                                        | Depende de |
| --- | ------------------------------------------------------------ | ---------- |
| 2.1 | `/interconsulta-medica` — hueco de mercado nº 1              | 1.x        |
| 2.2 | `/voluntariado-medico` — hueco de mercado nº 2               | 1.x        |
| 2.3 | `/especialistas` — el contenido ya existe, hay que moverlo   | —          |
| 2.4 | Devolver "Especialistas" al menú, ya con destino real        | 2.3        |
| 2.5 | `/psicologia` y `/consulta-gratuita`                         | 2.1, 2.2   |
| 2.6 | `/preguntas-frecuentes` con las dudas reales de recepción    | —          |
| 2.7 | Enlazado interno según `SITE-STRUCTURE.md`                   | 2.1–2.6    |
| 2.8 | `/legal/privacidad`                                          | Legal      |
| 2.9 | `Service` y `QAPage` en las páginas nuevas (ver `SCHEMA.md`) | 2.1–2.6    |

## Fase 3 — autoridad (semanas 13–24)

| #   | Tarea                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Blog: 2 artículos/mes, cada uno firmado por un médico (`CONTENT-CALENDAR.md`)                                                                     |
| 3.2 | **Prensa, no link building.** Efecto Cocuyo, Analítica, ACN y Alta Densidad ya han cubierto el tema. Hay cifras reales del backend que ofrecerles |
| 3.3 | ASOVTT (asociación gremial del sector): alianza y mención                                                                                         |
| 3.4 | Núcleos de la diáspora médica venezolana en EE. UU., España y Chile                                                                               |
| 3.5 | Core Web Vitals con datos de campo (CrUX) una vez haya tráfico                                                                                    |
| 3.6 | Medir citas en ChatGPT, Perplexity y AI Overviews                                                                                                 |

## Fase 4 — consolidación (meses 7–12)

| #   | Tarea                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | **Informe anual con datos propios.** Es el activo de enlaces más valioso que puede producir esta organización: nadie más tiene esos números |
| 4.2 | Fichas individuales de especialista, si dan su consentimiento                                                                               |
| 4.3 | Schema avanzado (`MedicalWebPage`, `MedicalCondition`) donde el contenido lo justifique                                                     |
| 4.4 | Revisar y actualizar lo publicado en las fases 1–3                                                                                          |

## Dependencias que no dependen de quien escribe código

| Bloqueo                         | Quién lo desbloquea         | Bloquea a                 |
| ------------------------------- | --------------------------- | ------------------------- |
| Acceso a Search Console         | Quien administre el dominio | 1.10, y con ello los KPIs |
| Médico que firme los artículos  | Las cofundadoras            | Toda la fase 3            |
| Política de privacidad          | Asesoría legal              | 2.8                       |
| Imagen para Open Graph          | Diseño (The Climb)          | 1.1                       |
| Consentimiento de especialistas | Las cofundadoras            | 4.2                       |

## Qué NO hacer

- **No comprar enlaces.** Para una ONG médica, el riesgo reputacional supera cualquier ganancia.
- **No publicar contenido clínico sin autor médico.** Vertical YMYL.
- **No perseguir "telemedicina Venezuela".** Ocupado desde 2017 y, en un caso, por una universidad.
- **No devolver Blog ni Especialistas al menú hasta que existan.** Un enlace muerto en la home de
  una organización médica erosiona justo la credibilidad que el contenido defiende.
- **No escribir cifras a mano.** Las de la portada ya salen del backend redondeadas a la baja.
