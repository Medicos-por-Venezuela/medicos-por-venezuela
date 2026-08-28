# Tareas: refrescamiento del Home

> Plan: [`tasks/plan.md`](./plan.md) · Spec: [`.knowledge/spec-home-refresh.md`](../../.knowledge/spec-home-refresh.md)
>
> **Definition of Done de cada tarea** (además de sus criterios): `pnpm exec tsc --noEmit` sin
> errores, `pnpm lint` sin warnings nuevos sobre los 21 preexistentes, `pnpm format:check` limpio.

---

## Fase 1 — Cimientos

### T1: Assets — fuente, logos y foto optimizada

**Descripción:** Meter en `public/` lo que el home necesita: los cuatro pesos de Nunito Sans en
woff2, los logos SVG renombrados, y `oriana.jpg` convertida. Es la tarea de mayor riesgo (falta la
fuente) y por eso va primera.

**Criterios de aceptación:**

- [x] `public/img/hero-interconsulta.webp` existe, **≤ 40 KB**, 960 × 1120, recorte `north` — 32 KB
- [x] Los 5 logos SVG en `public/brand/` con nombres legibles (`logo-navy.svg`, `iso-white.svg`, …)
- [x] Nunito Sans 600/700/800/900 en woff2 en `public/brand/` — **resuelto con la fuente
      VARIABLE** que aportó el equipo (`wght 200..1000`). Un solo archivo de **28 KB** cubre
      todos los pesos, más 30 KB de itálica real; cuatro estáticas habrían pesado ~160 KB.
      Generadas con `scripts/build-fonts.mjs`, que fija los ejes que no usamos (wdth, opsz,
      YTLC) y recorta a latin + flechas. Antes los pesos 300–900 medían todos 606,44 px;
      ahora miden 450,13 / 457,92 / 465,83 / 475,11 / 485,55 / 496,23 — interpola de verdad.
      La itálica es la cara real: el navegador **pide** su woff2 y su dibujo difiere de la
      redonda inclinada a mano en 4704 píxeles. `OFL.txt` viaja con los ficheros.
- [x] El JPG de 5 MB y el prototipo de 10 MB **no** están en `public/`

**Verificación:**

- [x] `du -h public/img/hero-interconsulta.webp` → 32 KB
- [x] Abrir el WebP y comprobar que la doctora sale entera y nítida
- [x] `pnpm build` en verde — compila y genera las 23 rutas. Ojo: el build del repo **ya venía
      rojo desde la base** por `e2e/global-setup.ts(53,46) TS2339` (tipos de
      `@supabase/supabase-js`, ajeno a este trabajo); excluyendo `e2e` del typecheck sale verde.

**Dependencias:** ninguna
**Archivos:** `public/img/`, `public/brand/`, `scripts/optimize-hero-image.mjs` (script reproducible)
**Tamaño:** S

> ✅ Resuelto (2026-08-13): el equipo aportó Nunito Sans como **fuente variable**, que era
> justamente la alternativa que este aviso señalaba. No hizo falta cambiar de tipografía.

---

### T2: Tokens de marca y tipografía, scopeados

**Descripción:** Definir los 8 tokens `--h-*` y las `@font-face`, en un ámbito que **no toque
`:root`**, siguiendo el patrón `.patient-theme` que ya existe en `globals.css`.

**Criterios de aceptación:**

- [x] Los 8 tokens de la tabla del spec, definidos en el scope del home (`.home-theme`)
- [x] `@font-face` con `font-display: swap` — dos declaraciones (redonda e itálica) con
      `font-weight: 200 1000`. El **rango** es lo que activa la interpolación: con un peso
      suelto el navegador trata la familia como de una sola cara y la reutiliza para todo
- [x] `<link rel="preload">` del peso que usa el titular del hero
- [x] `git diff styles/globals.css` **no muestra cambios en `:root`** — 0 líneas eliminadas en
      todo el archivo (`git diff | grep -c "^-[^-]"` → 0): el cambio es puramente aditivo

**Verificación:**

- [x] Font: la variable llega a estado `loaded` y **se aplica de verdad** (el wordmark mide
      234 px frente a 190 px con la pila del sistema). Sin FOIT: `font-display: swap`
- [x] Aislamiento comprobado en `/`, `/login-medico`, `/panel-medico` y `/admin`: `--h-navy` sale
      **vacío en `:root`** en las cuatro, `.home-theme` existe solo en `/`, y fuera del home el
      cuerpo conserva su fuente (`-apple-system`) y su color (`rgb(23,32,42)`)

**Dependencias:** T1
**Archivos:** `components/home/theme.tsx` (o el bloque `<style jsx global>`), `pages/_document.tsx`
**Tamaño:** S

---

### T3: Primitivas de movimiento

**Descripción:** Extraer el `useReveal` que hoy vive dentro de `pages/index.tsx` a un hook
compartido, añadir `useCountUp`, y un único guard de `prefers-reduced-motion` del que dependan
ambos. Se definen **antes** que las secciones para que las doce usen los mismos tiempos.

**Criterios de aceptación:**

- [x] `usePrefersReducedMotion()` en `lib/hooks.ts`; `useReveal`/`useCountUp` en
      `components/home/motion.ts`. **Desvío consciente** del plan: `lib/hooks.ts` lo importa todo
      el sitio, y `useReveal` depende de `IntersectionObserver` y de clases (`reveal`,
      `is-visible`) que solo existen dentro de `.home-theme`. El guard sí queda compartido, que
      era lo que el criterio buscaba: una única fuente de verdad
- [x] `useCountUp(valor, ms)` que respeta el guard
- [x] `usePrefersReducedMotion()` como única fuente: si es `true`, reveal desactivado y count-up
      devuelve el valor final de inmediato
- [x] Sin dependencias nuevas

**Verificación:**

- [x] Con `reduce`: opacidad 1, `transform: none`, transición 1e-05s, animación `none`. Control
      **sin** `reduce`: opacidad 0, `translateY(12px)`, 0,5 s y animación `home-fade-up` 0,52 s —
      o sea, la media query hace trabajo real, no es un no-op
- [x] `pnpm exec tsc --noEmit` sin errores en el código de este trabajo (queda el de `e2e/`,
      preexistente y ajeno)

**Dependencias:** T2
**Archivos:** `lib/hooks.ts`, `components/home/motion.ts`
**Tamaño:** S

---

### ✅ Checkpoint A

- [x] `pnpm build` en verde (con la salvedad del error preexistente de `e2e/`)
- [x] Foto ≤ 40 KB y nítida en 2× — 32 KB, 960 × 1120
- [x] Los 4 pesos cargan — vía fuente variable, con los 6 pesos medidos distintos entre sí
- [x] `:root` intacto

---

## Fase 2 — Estructura y hero

### T4: Navbar y Footer

**Descripción:** El marco de la página. El navbar lleva logo + tagline en itálica, 6 enlaces
(tres de ellos anclas del propio home), y el botón `Ingresar →`. El footer lleva tagline,
descripción, contacto, aviso legal y copyright.

**Criterios de aceptación:**

- [x] Navbar: `Ingresar →` a `/login-medico`; Quiénes Somos / Cómo Funciona / Impacto como anclas
      `#`+id de sección; **Blog y Especialistas sin enlace** (`<span aria-disabled>`)
- [x] Menú usable en 360 px: hamburguesa con `aria-expanded`/`aria-controls`, 6 enlaces, y al
      abrirlo tampoco hay scroll horizontal. El tagline **no** va en el navbar (se sigue el
      prototipo); sí va en el footer — pregunta abierta 4
- [x] Footer con el aviso legal completo del copy y `info@medicosporvenezuela.org`
- [x] Ningún `href="#"`

**Verificación:**

- [~] Clic en cada enlace: los 5 destinos reales navegan, `#inicio` ancla bien, y Especialistas/
  Blog no son enlaces. Pero `#quienes-somos`, `#como-funciona` e `#impacto` **todavía no
  tienen sección a la que saltar** (llegan en T5–T9): hoy el clic no hace nada. Se cierra
  en el Checkpoint C, no antes
- [x] 360 px sin scroll horizontal — medido a 360/768/1440 px: `scrollWidth == clientWidth` y
      ningún elemento se sale del viewport
- [x] **Fallo encontrado y corregido**: styled-jsx no pone su clase de scope en los componentes
      (`Link`, `Image`), solo en los elementos nativos. `.marca`, `Únete`, `Ingresar` y los tres
      enlaces de "Plataforma" salían sin estilo — navy sobre navy, invisibles. Arreglado con
      `:global()` acotado por un ancestro scopeado

**Dependencias:** T2
**Archivos:** `components/home/Navbar.tsx`, `components/home/Footer.tsx`, `components/home/copy.ts`
**Tamaño:** M

---

### T5: Hero

**Descripción:** La sección de mayor riesgo y la más visible. Split: a la izquierda titular,
subtítulo, badge, dos CTA y tres métricas; a la derecha la foto con el badge "Interconsulta en
curso" y el overlay "24/7 · Disponible · Confidencial". Incluye el **gesto mayor**.

**Criterios de aceptación:**

- [x] Copy exacto del `.docx`, con las métricas en **+2.000** (no +3.000). Los valores salen
      de `METRICAS`, no repetidos en `HERO`, para que la cifra viva en un solo sitio
- [x] `Solicitar consulta →` a `/registro-paciente`; `Conocer la plataforma` a `#como-funciona`
      (la sección llega en T7; hasta entonces el ancla no tiene destino, igual que las del
      navbar)
- [x] Foto vía `next/image` con `priority` y `sizes`. Medido en red: a 360 px descarga la
      variante **w=384 (10 KB)** y a 1440 px la **w=750 (22 KB)** — una sola por viewport,
      sin doble descarga. `priority` sí actúa: hay `<link rel=preload as=image>` en el head
- [x] `alt` reescrito: "Una médica con bata blanca y estetoscopio atiende una consulta desde
      su computadora portátil en un consultorio." El del prototipo decía "Dos médicos
      venezolanos", que no es lo que muestra esta foto
- [x] Gesto: los seis bloques entran con `home-fade-up` y retardos medidos de
      0 / 60 / 120 / 180 / 240 / 300 ms; la foto anima `hero-foto` durante 0,9 s
- [x] Con `reduce`: duración 1e-05s en foto y en los seis bloques, `transform` identidad y
      opacidad 1 — no se ve entrar nada

**Verificación:**

- [x] 360 / 768 / 1440 px, y además un barrido de 13 anchos (320 a 1920): sin scroll
      horizontal en ninguno y apilado por debajo de 900 px. El titular va de 34 px a 54 px
- [x] **Defecto encontrado y corregido**: los separadores de las métricas eran `<span>`, y al
      envolverse la fila quedaba una rayita colgando. Pasaba a 360, 480 **y 1100 px** — este
      último con la pantalla ancha y la columna estrecha, así que un breakpoint de viewport
      no lo habría cogido. Ahora son `border-left` bajo una **container query** sobre el
      ancho de la columna, que es la medida de la que realmente depende
- [~] Falta Lighthouse. Los indicadores que sí se midieron apuntan bien: la foto del hero
  baja de 5,0 MB a 10 KB en móvil, va con `priority` + preload, y la fuente se precarga
- [x] Emulado `prefers-reduced-motion: reduce` (ver arriba)

**Dependencias:** T3
**Archivos:** `components/home/Hero.tsx`, `components/home/copy.ts`, `pages/index.tsx`
**Tamaño:** M

---

### 🛑 Checkpoint B — parar y enseñar

- [x] Hero como el prototipo en los tres anchos
- [x] **Gesto aprobado por el autor** (2026-08-13: "el gesto está bien"). En la misma
      revisión pidió quitar el padding heredado de `.hero` y bajar el superior de la
      columna de 110 px a 60 px — hecho
- [x] Sin movimiento con `reduce`
- [ ] **No seguir con las otras nueve secciones sin este visto bueno**

---

## Fase 3 — Resto de secciones

### T6: Las 3 puertas de entrada + CTA final

**Descripción:** Las dos rejillas de tres tarjetas que cargan los destinos reales. Van juntas
porque comparten estructura y son las que de verdad convierten.

**Criterios de aceptación:**

- [x] Paciente → `/registro-paciente` · Voluntario → `/registro-medico`
- [x] **Médico en Venezuela → `/registro-medico`**, con el comentario en `RUTAS` y repetido
      en `Puertas.tsx`: hoy no existe flujo público de interconsulta
- [x] Pie de tarjeta "Disponible 24/7 · Confidencial · Sin costo"
- [x] Hover con easing de 150 ms (borde superior azul): medido, pasa de `rgba(0,0,0,0)` a
      `rgb(0,102,254)` con `transition-duration: 0.15s`. También en `:focus-visible`, para
      que quien navega con teclado vea dónde está

**Verificación:**

- [x] Las 6 tarjetas se visitaron de verdad, no se dio por hecho: las 6 devuelven HTTP 200 y
      ninguna cae en la 404 de Next
- [x] Barrido de anchos (360 a 1440) sin scroll horizontal
- [x] **Defecto corregido**: el cierre usaba `grid-template-columns: repeat(auto-fit, …)` y a
      768 px seguían entrando 3 columnas mientras la media query aplicaba los bordes del
      apilado — la tercera tarjeta se descolgaba. Es el mismo error que con las métricas del
      hero: mezclar un layout intrínseco con un breakpoint de viewport. Ahora el número de
      columnas es explícito, así que "última de la fila" es `:last-child` y punto
- [x] **Defecto corregido**: sin JavaScript, las secciones con `useReveal` se quedaban en
      `opacity: 0` **para siempre**. El texto sí estaba en el HTML (se indexa), pero una
      persona no veía nada. Resuelto con un `<noscript>` que neutraliza `.reveal`; es el
      único caso que no puede arreglarse desde JS
- [x] **Defecto corregido**: con la navbar fija de 76 px, saltar a un ancla dejaba la
      cabecera de la sección tapada (el eyebrow de "Únete" aterrizaba en y=56). Añadido
      `scroll-margin-top: var(--h-navbar)` a todo `[id]` del home, para que T7–T9 lo
      hereden. De paso, el 76 vivía duplicado en JS dentro de `Navbar.tsx`: ahora es un
      token y hay una sola fuente
      **Dependencias:** T5
      **Archivos:** `components/home/Puertas.tsx`, `components/home/CtaFinal.tsx`, `copy.ts`
      **Tamaño:** M

---

### T7: Quiénes Somos + Valores

**Descripción:** Dos secciones de texto. Quiénes Somos con eyebrow, título, dos párrafos y CTA;
Valores con los cuatro ítems (Verificados, Autónomos, Gratuitos, Confidenciales).

**Criterios de aceptación:**

- [x] `id="quienes-somos"`. Medido al pulsar el enlace del navbar: la sección aterriza en
      `top: 76` con el borde inferior de la barra en 76, o sea justo debajo y sin taparse
- [x] "Conoce nuestra historia →" sin enlace: es un `<span aria-disabled="true">` sin `href` y
      con `cursor: default`
- [x] Reveal al hacer scroll: ambas secciones a `opacity: 0` al cargar y a `1` tras llegar

**Verificación:**

- [x] El ancla del navbar hace scroll hasta aquí (ver arriba)
- [x] Anchos 360 / 768 / 900 / 901 / 1100 / 1440 sin scroll horizontal. Los 4 valores pasan de
      una fila con filete vertical a apilados con filete horizontal en el mismo punto de corte
      (900 px) que las otras rejillas
- [~] **Faltan dos assets del prototipo**: la foto de Quiénes Somos ("médico venezolano en
  consulta virtual", 460 px) y las cuatro fotos circulares de 52 px de los valores. Ninguna
  está entregada. La sección va a una columna con el ancho de lectura limitado a 720 px, y
  los valores solo en texto; cuando lleguen, se recupera el split del prototipo
- [x] **Copy**: los valores del prototipo (Calidad / Credibilidad / Autonomía / Gratuidad) NO
      son los del `.docx` (Verificados / Autónomos / Gratuitos / **Confidenciales**) — cambia
      hasta uno de los cuatro conceptos. Se sigue el `.docx`, confirmado como aprobado el
      2026-08-13
      **Dependencias:** T6
      **Archivos:** `components/home/QuienesSomos.tsx`, `components/home/Valores.tsx`, `copy.ts`
      **Tamaño:** S

---

### T8: Cómo Funciona (tabs)

**Descripción:** La única sección con estado: tres tabs (paciente por defecto) con cross-fade de
200 ms.

**Criterios de aceptación:**

- [x] Tab de paciente activo al cargar (`aria-selected=true` en "Soy paciente")
- [x] `role="tablist"` / `"tab"` / `"tabpanel"` con `aria-selected`, `aria-controls` y
      `aria-labelledby` enlazados. **Roving tabindex** `[0, -1, -1]`: se llega a las pestañas en
      1 salto de tabulador y desde la pestaña activa otro Tab lleva al panel, no a la siguiente
      pestaña. Flechas ← → con vuelta circular, Home/End, y Enter/Espacio también seleccionan
- [x] Fundido de 200 ms (`como-entra`), a 1e-05s con `reduce` y con el panel a opacidad 1 —
      comprobado que no se queda invisible. **No es un cross-fade literal**: el panel saliente
      no se desvanece a la vez, porque superponer paneles de distinta altura daría saltos de
      maquetación. Entra con fundido, sale al instante
- [x] `id="como-funciona"`; al pulsar el enlace del navbar la cabecera no queda tapada por la
      barra

**Verificación:**

- [x] Los tres tabs recorridos solo con teclado: cada flecha mueve foco Y selección, y el
      contenido cambia de verdad (tres `panel-*` distintos, con su intro y su paso 03 propio —
      el paso 01 es idéntico en los tres flujos, así que no sirve para comprobarlo)
- [x] 360 / 768 / 1440 px sin scroll horizontal; las pestañas envuelven a dos filas en 360
- [~] **Falta un asset**: el prototipo pone a la izquierda una foto de "médico atendiendo
  consulta por videollamada" que no está entregada. La sección va a una columna
- [x] **Copy**: en el `.docx`, la sección del home solo trae el título y la nota de los tabs;
      los doce pasos salen de la sección "PÁGINA: CÓMO FUNCIONA" del mismo documento, que es
      donde están escritos
      **Dependencias:** T7
      **Archivos:** `components/home/ComoFunciona.tsx`, `copy.ts`
      **Tamaño:** M

---

### T9: Especialistas + Testimonios + Métricas + Blog

**Descripción:** Las cuatro secciones de rejilla. Especialistas con 6 placeholders usando
`avatar.png` y el check verde; Testimonios con las 6 citas reales; Métricas con count-up; Blog con
3 placeholders y badge "Próximamente".

**Criterios de aceptación:**

- [x] Especialistas: 6 tarjetas con `avatar-placeholder.png`, "✓ Verificado" en `--h-green`,
      "Ver todos los especialistas" como texto inerte. **Sin nombres inventados**: una tarjeta
      con un nombre y una especialidad plausibles junto a un "✓ Verificado" es una credencial
      falsa, aunque sea de mentira para maquetar. Dicen "Perfil por publicar / Especialidad /
      País". ⚠️ **No puede publicarse así**: hay que meter los perfiles reales
- [x] Testimonios: las 6 citas textuales del copy, en `<blockquote>` + `<cite>` y atribuidas a
      "Paciente, Venezuela". Sin la foto circular del prototipo: son pacientes anónimos, y
      ponerle cara a un testimonio médico sería atribuírselo a alguien que no lo dio
- [x] Métricas: **+2.000** · +200 · +20 · Presencia global, con count-up que respeta `reduce`
      (medido a los 120 ms, mucho antes de que acabara una animación de 900 ms: ya en su valor
      final)
- [x] **Fallo corregido en la primitiva de T3**: `useCountUp` arrancaba en 0, así que sin
      JavaScript las cifras se quedaban en "+0" — números falsos en la sección que argumenta el
      impacto. Ahora arranca en el valor final y la animación baja a 0 solo cuando el observer
      dispara. Comprobado sin JS: se leen +2.000 / +200 / +20
- [x] Blog: badge "Próximamente", tarjetas no clicables (`<article>`, no `<a>`) y sin titulares
      inventados. Un titular con pinta de artículo real que no lleva a ningún sitio promete
      contenido que no existe
- [x] `id="impacto"` para el ancla del navbar

**Verificación:**

- [x] **Ningún enlace muerto en todo el home**: 23 `<a>`, 0 con `href` vacío o `#`, y las 7
      anclas resuelven a una sección existente. Los 5 CTA sin destino son texto con
      `aria-disabled`, no enlaces
- [x] El count-up respeta `reduce` y ya no muestra ceros sin JavaScript
- [x] Anchos 360 / 560 / 768 / 900 / 1100 / 1440 sin scroll horizontal; las cuatro rejillas
      bajan de 3-4 columnas a 1 de forma escalonada
- [x] Otra colisión con `globals.css`: Blog usaba `.badge`, que la clase global vestía de
      píldora gris. Renombrada a `.proximo`. El chequeo de colisiones ya es parte de la rutina
      **Dependencias:** T8
      **Archivos:** `components/home/Especialistas.tsx`, `Testimonios.tsx`, `Metricas.tsx`, `Blog.tsx`, `copy.ts`
      **Tamaño:** M

---

### ✅ Checkpoint C

- [x] 12 secciones en orden: nav · portada · puertas · quienes · valores · como · especialistas ·
      testimonios · impacto · blog · cierre · pie
- [x] Cero `href="#"`: 23 enlaces, 0 muertos, 0 anclas rotas
- [x] `tsc`, `lint`, `build` en verde sin warnings nuevos (14, por debajo de los 21 de la base)

---

## Fase 4 — Registro y cierre

### T10: Re-tematizar /registro-paciente y /registro-medico

**Descripción:** Solo colores y tipografía. **Nada de estructura, campos ni lógica.** Se usa el
patrón que ya existe: redefinir tokens dentro de una clase de tema.

**Criterios de aceptación:**

- [x] `.patient-theme` redefine los tokens con la paleta nueva
- [x] `registro-medico` **ya tenía** su clase (`.registro-medico-page`) — la tarea estaba
      desactualizada. Se le quitaron las cuatro reglas propias con el azul y el dorado del home
      ANTIGUO y ahora comparte bloque con `.patient-theme`
- [x] Nunito Sans aplicada en ambas (medido: `font-family` del `<main>` = "Nunito Sans")
- [x] `git diff` de esas dos páginas: **vacío**. Ni el `className` hizo falta, porque ya tenían
      su clase de tema. Incluso el enlace con `style={{ color: 'var(--home-blue)' }}` de
      `registro-medico` se resolvió redefiniendo ese token dentro del tema
- [x] `:root` sigue intacto — comparado byte a byte contra HEAD

**Verificación:**

- [x] Formulario de paciente de punta a punta: lo cubre `e2e/registro-paciente.spec.ts`
      ("formulario → signup → sala de espera con videoconsulta"), en verde
- [x] `/panel-medico`, `/admin`, `/mi-caso` y `/login-medico` idénticos: siguen con la fuente de
      sistema y `--green: #0f6e56`, y ninguno tiene `.home-theme`

**Dependencias:** T2
**Archivos:** `styles/globals.css` (solo las clases de tema), `pages/registro-paciente.tsx`, `pages/registro-medico.tsx`
**Tamaño:** S

---

### T11: Verificación final y changelog

**Descripción:** Recorrer los 10 criterios de aceptación del spec y dejar constancia.

**Criterios de aceptación:**

- [x] Los 10 criterios del spec, comprobados uno a uno (ver el detalle en el changelog)
- [x] E2E pasando: **11 de 11**. Estaban 8 en rojo, y NO por este trabajo: `POST /consultations`
      empezó a exigir `specialty_id` (cambio de backend de esta misma sesión) y los specs lo
      creaban solo con `patient_id` → 422 → `id` `undefined` → fallo en cascada. Arreglado con
      `e2e/helpers.ts`, que lee una especialidad general del catálogo real
- [x] `changeslog.md` actualizado según el protocolo del repo
- [x] Capturas a 360 / 768 / 1440 px entregadas

**Verificación:** `tsc` · `lint` · `format:check` · `build` · `test:e2e`
**Dependencias:** T10
**Archivos:** `changeslog.md`
**Tamaño:** S

---

### ✅ Checkpoint D — listo para revisión

- [x] Los 10 criterios del spec
- [x] Panel y admin sin cambios visuales
- [x] Changelog actualizado
- [x] E2E en verde (11/11)
- [x] **Accesibilidad WCAG 2.1 AA (axe-core)**: el home pasa con **0 violaciones** en los cinco
      estados auditados (1440/768/360, menú móvil abierto, tercera pestaña activa). Se partía de 18
- [ ] **Pendiente antes de publicar**: las 3 tarjetas de blog siguen siendo placeholder, y faltan
      las 4 fotos del prototipo que no se entregaron. Los 10 especialistas ya son reales
- [x] **Iconos de la banda de Valores** — entregados el 2026-08-28 y montados. Se generan con
      `node scripts/optimize-value-icons.mjs` desde `nueva/iconos-valores/`
- [x] **Fotos y datos de los 10 especialistas** — entregados el 2026-08-28. La rejilla ya no tiene
      placeholders: nombres, especialidades y retratos reales. Se generan con
      `node scripts/optimize-specialist-photos.mjs` desde `nueva/especialistas/`
- [ ] **Confirmar el reparto de los iconos de Valores.** Los archivos de origen venían con los
      nombres de los valores del PROTOTIPO (Calidad, Credibilidad, Autonomía, Gratuidad), no con
      los del copy, y algún dibujo no cuadra ni con su propio nombre: `Gratis.png` son cinco
      estrellas y `Autonomía.png` es un médico. El reparto actual respeta los tres nombres de
      archivo que sí coinciden y deja el cuarto por descarte, así que **"Confidenciales" se quedó
      con un pulgar arriba**, que es lo que peor encaja — la confidencialidad se dibuja con un
      candado. Pedir un icono de candado o confirmar el reparto
- [ ] **`next dev` no hidrata en este entorno** (Next 16.3 + Turbopack + `cacheComponents`): el
      cliente descarga todos los chunks pero React nunca monta —no hay fibras en `#__next`— así que
      la página se sirve, se lee y se indexa, pero no responde a un clic. `next build` + `next start`
      SÍ hidratan, y con eso se verificó el trabajo del 2026-08-28. No es del refrescamiento del
      home: afecta a todas las páginas. Merece rama propia
- [ ] **Publicar `feat/stats-publicas` del backend antes que este home.** Las cifras del hero y de
      la banda de Impacto salen de `GET /api/v1/stats/public`, que vive en esa rama del repo
      `api-medicos-por-venezuela`. Si el home se publica antes, la portada se queda con las cifras
      de respaldo de `METRICAS` — ciertas, pero más bajas que las reales
- [ ] **La etiqueta dice "Consultas realizadas" y ahora se cuentan TODAS las consultas creadas**
      (decisión del equipo, 2026-08-28), incluidas las que siguen en espera, las canceladas y los
      no-show. Si se quiere que la etiqueta sea literal, o se cambia el texto a algo como
      "Consultas recibidas", o se filtra por estado en `get_public_stats` del backend
- [ ] **Varias fotos de especialistas traen el logotipo de la bata deformado** ("NEDx VZLA" en vez
      de "MEDx VZLA" en la de Alejandro Marcano, y texto ilegible en el gafete de otra). A 236 px no
      se lee, pero conviene que el equipo lo sepa antes de usarlas en cualquier sitio más grande
- [ ] **Advertencia de urgencias retirada del pie** por el copy aprobado del 2026-08-28
      ("no reemplaza la atención médica presencial de urgencia"). Era una salvaguarda clínica;
      queda aquí por si el equipo la quiere recuperar en otro sitio de la página
- [ ] **Crítico, en otra rama**: 21 de 25 campos de `/registro-paciente` y `/registro-medico` no
      tienen nombre accesible (etiquetas visibles sin asociar). Exige tocar el marcado de esas
      páginas, fuera del "solo colores y tipografía" de T10
- [ ] Lighthouse sobre el hero (único criterio de T5 que quedó sin medir)