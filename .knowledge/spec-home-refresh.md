# Spec: refrescamiento de imagen del Home

> Estado: **pendiente de aprobación**. Intent confirmado con el autor el 2026-08-13.
> Fuentes: `nueva/MEDxVZLA - Sitio Web.html` (prototipo de The Climb),
> `nueva/MEDxVZLA_Copy_Web_v1.docx` (copy), `nueva/material/` (marca), `nueva/oriana.jpg` (foto).

## Objetivo

Reconstruir **solo `pages/index.tsx`** siguiendo el prototipo de The Climb, con el copy nuevo y la
marca de `nueva/material/`. Es un refrescamiento de imagen sobre lo que la plataforma ya hace: no
se crean flujos ni páginas nuevas.

**Usuarios:** las tres puertas del copy — paciente que busca orientación, médico en Venezuela que
busca apoyo clínico, y médico voluntario. Antes que ellos, **Oriana Ramírez y Adarvelys Valor**,
que tienen que aprobar el refrescamiento; el home es lo que van a mirar.

**Éxito:** el home se ve como el prototipo, las tres puertas llevan a flujos que existen, la foto
del hero pesa decenas de KB en vez de 5 MB, y nada de lo que ya funcionaba se rompe.

## Suposiciones (corregir antes de implementar)

1. El copy del `.docx` es el texto final salvo el cambio de `+3.000` → `+2.000`. Sigue
   "pendiente de aprobación por Oriana y Ada", así que puede cambiar.
2. Los textos van **en español, hardcodeados** en el componente. No hay i18n en el repo.
3. `nueva/` es material de origen y **no se despliega**: los binarios (prototipo de 10 MB, JPG de
   5 MB, brandbook) no deben acabar en `public/`.
4. El sitio se sigue sirviendo con Next en modo servidor (no export estático), así que
   `next/image` puede optimizar.
5. La foto es de una persona identificable y la organización tiene derecho a publicarla.

## Alcance

**Dentro:**

- `pages/index.tsx` reconstruido según el prototipo.
- Tokens de marca nueva **scopeados al home** (`--home-*` + `<style jsx>`), sin tocar `:root`.
- `pages/registro-paciente.tsx` y `pages/registro-medico.tsx`: **solo colores y tipografía**,
  sin tocar estructura, campos ni lógica.
- Optimización de `oriana.jpg` y su entrada en `public/`.
- Fuente Nunito Sans (pesos 600–900) y logos SVG en `public/`.

**Fuera:**

- Páginas Quiénes Somos, Especialistas, Impacto y Blog.
- Panel médico, admin y cualquier flujo autenticado.
- CMS o backend para las métricas.
- Flujo público de "solicitar interconsulta".
- La foto de cofundadora del prototipo (va en Quiénes Somos, otra página).

## Tech stack

Next.js 16.3 (Pages Router) · React 19 · TypeScript 5 · CSS global plano + `<style jsx>`.
Sin framework de CSS y **sin añadir dependencias** (ver Límites).

## Comandos

```bash
pnpm dev                    # desarrollo
pnpm build                  # build de producción
pnpm exec tsc --noEmit      # tipos
pnpm lint                   # ESLint
pnpm format:check           # Prettier (lo verifica el CI)
pnpm test:e2e               # Playwright (requiere Supabase local + SUPABASE_SERVICE_ROLE_KEY)
```

## Estructura

```
pages/index.tsx              → el home (se reescribe)
components/home/             → subcomponentes nuevos del home (ver abajo)
public/brand/                → logos SVG + fuente
public/img/                  → oriana.webp
styles/globals.css           → NO se toca `:root`
.knowledge/spec-home-refresh.md → este documento
```

`pages/index.tsx` tiene hoy 1313 líneas. El prototipo trae 9 secciones; meterlas todas en un
archivo lo llevaría muy por encima de las 1000 líneas que el propio review del repo marca como
señal de alarma. Se parte en `components/home/`: `Navbar`, `Hero`, `Puertas`, `QuienesSomos`,
`Valores`, `ComoFunciona`, `Especialistas`, `Testimonios`, `Metricas`, `Blog`, `CtaFinal`,
`Footer`. `index.tsx` queda como composición.

## Marca

### Paleta (extraída del prototipo, coincide con `material/`)

| Token           | Hex       | Uso                           |
| --------------- | --------- | ----------------------------- |
| `--h-navy`      | `#18202b` | fondo oscuro, texto principal |
| `--h-blue`      | `#0066fe` | CTA primario, acentos         |
| `--h-blue-dark` | `#0052cc` | hover del CTA                 |
| `--h-blue-deep` | `#003d5f` | bordes, hover secundario      |
| `--h-grey`      | `#4a5a6e` | texto secundario              |
| `--h-grey-bg`   | `#f4f4f4` | fondos claros                 |
| `--h-green`     | `#4ade80` | check "✓ Verificado"          |
| `--h-white`     | `#ffffff` | texto sobre oscuro            |

> El blanco de marca es `#fef9f8` (roto), pero el prototipo usa `#ffffff` puro. Se sigue el
> prototipo; si Oriana/Ada prefieren el de marca, es cambiar un token.

### Logos (`nueva/material/logos/Logos SVG/`)

| Archivo                         | Forma             | Color     | Destino                       |
| ------------------------------- | ----------------- | --------- | ----------------------------- |
| `Mesa de trabajo 1.svg`         | horizontal 2.61:1 | `#18202b` | `public/brand/logo-navy.svg`  |
| `Mesa de trabajo 1 copia.svg`   | horizontal        | `#fef9f8` | `public/brand/logo-white.svg` |
| `Mesa de trabajo 1 copia 2.svg` | horizontal        | `#0066fe` | `public/brand/logo-blue.svg`  |
| `Mesa de trabajo 1 copia 4.svg` | isotipo 1.22:1    | `#18202b` | `public/brand/iso-navy.svg`   |
| `Mesa de trabajo 1 copia 5.svg` | isotipo           | `#fef9f8` | `public/brand/iso-white.svg`  |

Se renombran al copiarlos: "Mesa de trabajo 1 copia 5" no dice nada en un `import`.

### Tipografía

Nunito Sans. `material/Fuentes/` trae **solo el peso bold**, y el prototipo usa 600/700/800/900.
Se sirven los pesos 600–900 como **woff2 autoalojados** en `public/brand/` con `font-display: swap`
y `<link rel="preload">` para el peso del hero.

No se usa Google Fonts: mete una petición a un tercero en la home de una organización médica y la
CSP actual (`connect-src` limitado a Supabase y la API) tendría que abrirse.

## Secciones (orden del prototipo)

1. **Navbar** — logo + tagline en itálica · Inicio · Quiénes Somos · Especialistas · Cómo Funciona ·
   Impacto · Blog · Únete · botón `Ingresar →`
2. **Hero** — split: izquierda titular + subtítulo + badge + 2 CTA + 3 métricas · derecha la foto
   con el badge "Interconsulta en curso" y el overlay "24/7 · Disponible · Confidencial"
3. **Las 3 puertas de entrada** — 3 tarjetas sobre `--h-navy`
4. **Quiénes Somos** — eyebrow, título, 2 párrafos, CTA
5. **Valores** — 4 ítems (Verificados, Autónomos, Gratuitos, Confidenciales)
6. **Cómo Funciona** — 3 tabs (paciente por defecto)
7. **Especialistas** — 6 tarjetas placeholder con `avatar.png` y el check verde
8. **Testimonios** — 6 citas reales, grid
9. **Métricas** — 4 cifras
10. **Blog** — 3 tarjetas placeholder + badge "Próximamente"
11. **CTA final** — 3 tarjetas
12. **Footer** — tagline, descripción, contacto, aviso legal, copyright

### Destinos de enlaces

| Elemento                                              | Destino                          | Nota                                                                                                          |
| ----------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Soy paciente / Solicitar consulta                     | `/registro-paciente`             | existe                                                                                                        |
| Quiero ser voluntario / Registrarme                   | `/registro-medico`               | existe                                                                                                        |
| **Soy médico en Venezuela / Solicitar interconsulta** | `/registro-medico`               | **provisional**, verificar con las owners: hoy la interconsulta solo existe entre médicos ya dentro del panel |
| Ingresar                                              | `/login-medico`                  | existe                                                                                                        |
| Quiénes Somos · Cómo Funciona · Impacto               | ancla `#seccion` del propio home |                                                                                                               |
| Blog                                                  | sin enlace, badge "Próximamente" |                                                                                                               |
| Especialistas · "Ver todos los especialistas"         | sin enlace                       | la página no existe; no dejar `href="#"` que simule que sí                                                    |

**Ningún enlace apunta a `href="#"`.** Un enlace que no lleva a ningún sitio en la home de una
organización médica erosiona justo lo que el copy vende. Lo que no existe se renderiza como texto
o con badge "Próximamente", no como enlace muerto.

## Métricas

Hardcodeadas en una constante única del módulo, con comentario de que las mantiene el equipo:

```ts
// Cifras curadas por el equipo (no salen del backend: `GET /stats` exige permiso `stats.read`
// y exponerlo publicaría el pulso operativo de la organización). Al cambiarlas, tocar solo aquí.
const METRICAS = {
  medicos: '+2.000', // la base tiene ~2.960; el copy decía +3.000, corregido a la baja
  consultas: '+200',
  especialidades: '+20',
  gratuito: '100%'
} as const
```

## Foto del hero

Origen `nueva/oriana.jpg`: 3117 × 4675 px, **5,0 MB**. Una doctora con bata y estetoscopio
trabajando con un portátil.

- **Destino:** `public/img/hero-interconsulta.webp`, 960 × 1120 (2× del hueco 480 × 560), WebP
  q70 → **~32 KB** (99,4 % menos).
- **Recorte:** `fit: cover, position: north` — quita suelo por abajo y conserva a la doctora.
- **`alt`:** se reescribe. El del prototipo dice _"Dos médicos venezolanos revisando un caso
  clínico en interconsulta"_ y en la foto hay **una sola doctora**. Propuesto:
  _"Médica venezolana revisando un caso clínico durante una interconsulta"_.
- **Render:** `next/image` con `priority` (está sobre el pliegue) y `sizes` para no servir 2× en
  móvil. Evita además el warning `@next/next/no-img-element` que ya arrastra el repo.
- El JPG de 5 MB **no entra en `public/`**; se queda en `nueva/` como material de origen.

Medido sobre el original para elegir: WebP q82 48 KB · **q70 32 KB** · q60 29 KB ·
AVIF q45 22 KB · JPEG q78 61 KB.

## Movimiento

Sobrio en todo el home, con **un gesto mayor en el hero**. El prototipo define 26 estados hover
pero **cero transiciones**: dice qué cambia, no cómo.

**Base (sobrio):**

- Hover: `transition: 150ms ease-out` en color, fondo y borde. Los 26 estados salen del prototipo,
  no se inventan.
- Reveal al hacer scroll: reutilizar el hook `useReveal` que ya existe en `pages/index.tsx`
  (IntersectionObserver). Fade + 12 px de desplazamiento, escalonado dentro de cada sección.
- Métricas: count-up al entrar en viewport, 900 ms, easing de salida.
- Tabs de "Cómo Funciona": cross-fade de 200 ms.

**Gesto del hero (propuesta, a aprobar):** al cargar, la columna de texto entra escalonada
(titular → subtítulo → CTAs → métricas, 60 ms entre cada uno) mientras la foto hace un
`scale(1.06) → 1` de 900 ms con `ease-out`. Un solo movimiento amplio y contenido: se nota que el
sitio es nuevo sin que parezca una landing de startup, que es lo contrario de lo que vende una ONG
médica.

**`prefers-reduced-motion: reduce` desactiva todo**: sin reveal, sin count-up (cifra final
directa), sin scale. No es opcional en un sitio de salud — hay gente que navega con vértigo o
migraña.

## Estilo de código

Igual que el repo: sin punto y coma, comillas simples, `printWidth` 100, componentes función.
Los tokens del home van en un bloque `<style jsx global>` **scopeado al componente del home**:

```tsx
// Tokens del refrescamiento, deliberadamente `--h-*` y NO en `:root`: `globals.css` lo importa
// `_app.tsx` y tocarlo repintaría también el panel médico y el admin, que están fuera de alcance.
<style jsx>{`
  .hero {
    --h-navy: #18202b;
    --h-blue: #0066fe;
    background: var(--h-navy);
  }
`}</style>
```

## Estrategia de pruebas

El repo **no tiene tests unitarios** y no se añaden en este cambio (montar Vitest es otro trabajo).
Verificación:

- `pnpm exec tsc --noEmit` sin errores.
- `pnpm lint` sin errores y **sin warnings nuevos** (hoy hay 21 preexistentes; se comparan).
- `pnpm format:check` limpio.
- `pnpm build` OK.
- **E2E:** deben seguir pasando. Comprobado: **ninguno navega por el home** (entran directo a
  `/registro-paciente`, `/panel-medico`, etc.), así que reescribir `index.tsx` no debería tocarlos.
- **Manual:** 360 px, 768 px y 1440 px; con y sin `prefers-reduced-motion`; y clic en las tres
  puertas comprobando que caen donde dice la tabla de destinos.

## Límites

**Siempre:**

- Mobile-first y responsive en los tres anchos (regla del CLAUDE.md).
- `alt` real en toda imagen; jerarquía de encabezados correcta (un solo `<h1>`).
- Actualizar `changeslog.md` al terminar (protocolo del repo).
- Contraste AA sobre `--h-navy`.

**Preguntar antes:**

- Añadir cualquier dependencia (animación, carruseles, iconos). El objetivo es cero.
- Tocar `:root` en `globals.css` o cualquier página fuera de las tres del alcance.
- Cambiar textos del copy más allá del `+2.000` ya acordado.
- Publicar `/stats` sin autenticación.

**Nunca:**

- Copiar el JPG de 5 MB ni el prototipo de 10 MB a `public/`.
- Dejar enlaces `href="#"` que simulen páginas inexistentes.
- Romper `/registro-paciente` o `/registro-medico` más allá de color y tipografía.

## Criterios de aceptación

1. `pages/index.tsx` renderiza las 12 secciones en el orden del prototipo, con el copy del `.docx`.
2. Las tres puertas navegan a `/registro-paciente`, `/registro-medico` y `/registro-medico`.
3. Ningún `href="#"` en el home.
4. `public/img/hero-interconsulta.webp` ≤ 40 KB y se ve nítido en pantalla 2×.
5. Las métricas del hero dicen **+2.000**, no +3.000.
6. `:root` de `globals.css` sin cambios (comprobable con `git diff`).
7. El panel médico y el admin se ven exactamente igual que antes.
8. Con `prefers-reduced-motion: reduce` no hay ninguna animación.
9. `tsc`, `lint`, `format:check` y `build` en verde, sin warnings nuevos.
10. Los E2E existentes pasan.

## Preguntas abiertas

1. **Gesto del hero:** ¿se aprueba el escalonado + `scale` descrito arriba?
2. **"Solicitar interconsulta" → `/registro-medico`** es provisional. ¿Qué debería hacer de verdad?
   El registro asume voluntario que _atiende_, no médico local que _pide_.
3. **Blanco de marca:** el prototipo usa `#ffffff`, la marca `#fef9f8`. ¿Cuál manda?
4. **Tagline del navbar:** el copy lo pone bajo el logo "pequeño, en itálica". En móvil no cabe
   junto al logo; ¿se oculta o se apila?
