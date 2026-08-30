# Changelog

Reverse-chronological log of completed tasks (newest first). Update this **every time a task is
finished** — see the protocol in [CLAUDE.md](CLAUDE.md) ("Change log protocol").

Each entry: date, a short summary of what changed and why, and the key files/areas touched.

## 2026-08-30

- **feat(auth): recuperación de contraseña — no existía** — un usuario que olvidaba la clave se
  quedaba fuera sin salida. No había enlace en `/login` ni página que recibiera el enlace del
  correo, así que un correo de recuperación aterrizaba en la raíz del sitio (el `Site URL`) y ahí
  no pasaba nada: el cliente se crea con `detectSessionInUrl: false`, y la portada ni siquiera
  mira el `#access_token` que trae el enlace. Reportado en producción.
  - **`/auth/recuperar` (nueva)** contiene las **dos mitades** del flujo, no dos rutas: son la
    misma conversación partida por un correo. Sin token en el fragmento pide el email; con token,
    crea la sesión y pide la contraseña nueva.
  - **No se distingue si el correo existe.** Se pasa a "revisa tu correo" pase lo que pase,
    también si Supabase devolvió error: un mensaje distinto según si la cuenta existe convierte la
    pantalla en un detector de qué personas tienen cuenta aquí, que en un sitio de salud es justo
    lo que no puede filtrarse. Supabase tampoco lo distingue, por lo mismo.
  - **Cuentas de Google:** no tienen contraseña que recuperar, así que el formulario lo dice. **No
    se detecta automáticamente** a propósito — comprobarlo exigiría responder distinto según el
    correo escrito, que es la fuga que evita el punto anterior.
  - **El fragmento se borra de la barra de direcciones** en cuanto la sesión está creada. Los
    tokens ya no hacen falta ahí, y mientras sigan en la URL viajan a donde se copie el enlace y
    quedan en el historial. El `refresh_token` no caduca en una hora como el de acceso.
  - **Red de seguridad en `_app.tsx`, para las DOS mitades de auth.** Supabase devuelve los tokens
    en el fragmento de la URL; cuando el `redirect_to` no está en la lista de Redirect URLs del
    proyecto, los descarta y cae al `Site URL`, la raíz. Y en la raíz no los recoge nadie, porque
    el cliente lleva `detectSessionInUrl: false`. El usuario ve la home, sin sesión, y reintenta.
    Ha pasado con las dos: los correos de recuperación del panel de Supabase van sin `redirectTo`
    y aterrizan siempre ahí, y el login con Google lo hacía porque la lista solo tenía el host
    `www`. Síntoma reportado: **«tuve que darle dos veces a entrar con Google»**.
    Ahora un fragmento con `type=recovery` se reenvía a `/auth/recuperar` y cualquier otro con
    `access_token` a `/auth/callback`, conservando el fragmento. Con `location.replace` y no con
    el router de Next: el router puede perder el hash, y `replace` no deja la URL con el token en
    el historial. Es defensa en profundidad, **no el arreglo** —lo que toca arreglar es la lista
    de Redirect URLs—, pero un fallo de configuración no debería dejar a nadie fuera sin
    explicación. Un fragmento con `error=` y sin token sigue sin hacer nada, igual que antes.
  - `/auth/recuperar` hereda el `Disallow: /auth/` del robots.txt y lleva su `noindex`.
  - Archivos: `pages/auth/recuperar.tsx` (nuevo), `pages/login.tsx`, `pages/_app.tsx`, `CLAUDE.md`.

- **Nota de infraestructura (fuera del repo): el login con Google estaba roto en el apex.** La
  lista de Redirect URLs de Supabase solo tenía `https://www.medicosporvenezuela.org/**`, y el
  host canónico pasó a ser el apex. Como `lib/auth.ts` construye el `redirectTo` con
  `window.location.origin`, quien entraba por el apex generaba una URL no autorizada; al
  descartarla, Supabase cae al `Site URL` y el usuario vuelve a la home con los tokens en el
  fragmento, que nadie recoge. Reportado por una médica que no podía entrar. **Se arregla añadiendo
  `https://medicosporvenezuela.org/**` a la lista**, sin desplegar nada.

- **El HTML no se cacheaba en el borde: PageSpeed movil oscilaba entre 80 y 100** — la primera
  tanda de caché cubrió `/brand/**`, `/img/**` y los estáticos de la raíz, pero **dejó fuera el
  documento HTML**, que es la primera petición y bloquea todo lo demás.
  - **Medido contra producción:** el HTML sale **sin ninguna cabecera de caché**, así que
    CloudFront no lo guarda jamás — cinco peticiones seguidas, cinco `X-Cache: Miss from
cloudfront`. Cada visita de cada usuario atraviesa el CDN hasta el origen.
  - **El síntoma no era lentitud, era varianza.** Tres pasadas de Lighthouse contra la misma URL
    de producción dieron **96, 100 y 80**, con el LCP oscilando entre **1,3 s y 4,7 s**. El 79 que
    reportó PageSpeed era una muestra real del extremo malo de esa horquilla, no un error de
    medición ni una regresión.
  - **Es seguro cachearlo:** las 25 rutas se generan estáticas en el build (`○ (Static)`), así que
    no hay HTML por usuario — la autenticación ocurre en el cliente, después de hidratar.
  - **Arreglo:** `public, max-age=0, s-maxage=600, stale-while-revalidate=86400` en las cuatro
    rutas públicas. El `max-age=0` mantiene al navegador revalidando, así que un despliegue le
    llega al usuario al instante; el `s-maxage` es lo único que quita el viaje al origen. Amplify
    invalida CloudFront en cada deploy, así que los 10 minutos no retrasan una publicación.
  - Van enumeradas y no con un patrón general (`/**`): ese patrón alcanzaría a `/_next/*` y
    pisaría el `immutable` de un año que Next ya pone donde sí corresponde.

- **`robots.txt`, `sitemap.xml` y `site.webmanifest` seguían en `max-age=5`** — se quedaron fuera
  de la primera tanda porque no están en `ESTATICOS_RAIZ` de `next.config.js`.
  - Los dos primeros van a **una hora, no a la semana de los iconos**: Google cachea `robots.txt`
    hasta 24 h por su cuenta, y un `robots.txt` con una semana de caché es un error que tarda una
    semana en poder corregirse. Aquí la caché no ahorra tiempo de carga a nadie, solo peticiones.
  - El manifiesto sí va con la semana de los iconos: cambia con la marca y al mismo ritmo.

- **Nota de infraestructura (fuera del repo).** El apex ya es el host canónico y sirve 200; las 4
  URLs del sitemap responden directo, sin redirección. Pero `www` volvió a servir **200 con el
  mismo contenido** en vez de redirigir: la regla de Amplify usa `<*>` dentro de una URL absoluta y
  no está casando. Mitigado mientras tanto porque la canónica de `www` apunta al apex, pero
  **falta el 301** para transferir la señal de las URLs con www que Google tiene indexadas.

## 2026-08-29

- **Rendimiento móvil: el LCP del home baja 877 ms y la puntuación sube de 90 a 96** — medianas de
  tres pasadas de Lighthouse 13.4.1 por escenario sobre el build de producción, perfil móvil con
  `throttling-method=simulate` (baseline 90/91/90, con los arreglos 96/96/96). En producción
  PageSpeed marcaba 99 en escritorio y **80 en móvil**; de ahí salió esta tanda.
  - **La marca de agua del hero era el elemento LCP en móvil.** Un `<Image>` de `next/image`
    apuntando a `/brand/iso-navy.svg`, decorativo, `aria-hidden` y al **4 % de opacidad**. Como
    `next/image` marca sus imágenes con `loading="lazy"`, el navegador ni siquiera empezaba a
    pedirlo: medido contra producción, **1113,9 ms de `resourceLoadDelay`** dentro de un LCP de
    5160 ms. La métrica con la que Google juzga cuándo "aparece" la página estaba midiendo un
    adorno invisible.
  - **Por qué solo en móvil:** en escritorio la foto del hero sí cabe en el viewport y es unas 40
    veces más grande, así que gana ella y el LCP es contenido real. En móvil la foto se queda
    fuera del fold —solo asoma una franja de ~40 px— y el adorno pasaba a ser lo mayor pintado.
    Esa es la explicación de la brecha 99/80, no una diferencia de peso ni de responsividad.
  - **Arreglo:** la marca de agua pasa a ser un `<svg>` en línea (`components/home/MarcaAgua.tsx`,
    generado desde el SVG de marca). Un SVG en línea **no es candidato a LCP** —el algoritmo solo
    mira `<img>`, `<image>`, el póster de un `<video>` y los fondos CSS—, así que desaparece del
    cálculo y el LCP pasa a ser texto. De paso se ahorra una petición.
    Descartado añadirle `priority` al `<Image>`: arregla el retraso con una línea, pero deja el
    LCP anclado a una decoración para siempre.
  - **La fuente de marca no se precargaba.** Con el LCP ya en texto, la fase dominante pasó a ser
    `elementRenderDelay`: **1271 ms**. El `@font-face` vive en `globals.css`, así que el navegador
    no sabía que la fuente existía hasta haber descargado y parseado el CSS — dos viajes de red en
    cadena. Se añade un `<link rel="preload">` en `_document.tsx` para la redonda (la itálica no:
    solo la usa el tagline, y precargarla gastaría otros 30 KB de la ruta crítica). El
    `elementRenderDelay` cae a **187 ms**. `crossOrigin` es obligatorio aunque el fichero sea del
    mismo origen: sin él la fuente se descarga dos veces.
  - Archivos: `components/home/MarcaAgua.tsx` (nuevo), `components/home/Hero.tsx`,
    `pages/_document.tsx`.

- **Las reglas de caché de `next.config.js` no llegaban a producción** — medido con `curl` contra
  el sitio desplegado: `/brand/*.woff2`, `/og-image.png` y `/img/*.webp` salían con
  `Cache-Control: max-age=5, stale-while-revalidate`, el valor por defecto de Amplify, y no el
  `max-age=604800` que pide el `headers()` del `next.config.js`. Amplify sirve los ficheros de
  `public/` desde su propia capa de CDN, sin pasar por el runtime que aplica `headers()`. Solo
  `/_next/static/*` salía bien (`max-age=31536000, immutable`), porque Amplify lo trata como caso
  especial — por eso el fallo pasaba desapercibido.
  - **El efecto:** cinco segundos de caché es, en la práctica, ninguna. La fuente variable
    (28,8 KB), los diez retratos y la imagen del hero se revalidaban en **cada navegación**, en un
    sitio cuyo público entra desde Venezuela y por móvil.
  - **Arreglo:** `customHttp.yml` en la raíz, que es el mecanismo que Amplify sí lee. Replica las
    mismas reglas; no se toca `next.config.js`, que sigue siendo correcto en local y en cualquier
    otro proveedor.
  - **No afecta a la puntuación de PageSpeed** (mide carga en frío); sí a las visitas repetidas y
    al promedio de campo de CrUX a 28 días. **Pendiente de verificar con `curl -I` tras el
    despliegue.**

- **fix(seo): `/panel-medico`, `/mi-caso` y `/elegir-rol` se servían sin `noindex` ni `<title>`** —
  las tres están en el `Disallow` de `robots.txt`, cuyo comentario afirma que además llevan
  `noindex` en su propio `<head>`. No era cierto para estas tres: su `<head>` real solo traía
  `charset`, `viewport` y `theme-color`.
  - **La causa:** el `<Seo>` estaba dentro del árbol que se devuelve **después** del `return`
    temprano del estado de carga. En el servidor ese estado inicial siempre es "cargando", así que
    el HTML que recibe un crawler era siempre esa pantalla, con el `<head>` vacío y un **200**.
    Estas rutas no tienen gate en servidor: el control de acceso llega tras la hidratación.
  - **Por qué importa:** `Disallow` pide que no se rastree, pero una URL enlazada desde fuera puede
    acabar indexada igualmente —Google la lista sin descripción—, y el `noindex` solo funciona si
    Google puede entrar a leerlo. Es exactamente la doble señal que el comentario de `robots.txt`
    dice cubrir.
  - **Arreglo:** el `<Seo …noindex />` se declara antes de los `return` tempranos y se emite en
    todas las ramas. Verificado sobre el HTML prerenderizado: las tres rutas ya salen con
    `noindex` y con su `<title>`.
  - Archivos: `pages/panel-medico.tsx`, `pages/mi-caso.tsx`, `pages/elegir-rol.tsx`.

- **Auditoría SEO completa del dominio de producción** — siete especialistas en paralelo
  (técnico, rendimiento, contenido/E-E-A-T, schema, sitemap, GEO y visual). Informes y capturas
  fuera del repo, en `medicosporvenezuela.org-audit/`. El hallazgo estructural que **no** se
  arregla desde el código queda anotado abajo.
  - **Canonicalización apex vs www.** `medicosporvenezuela.org` responde **302** (temporal) hacia
    `www.medicosporvenezuela.org`, que es quien sirve el 200. Pero `SITIO` en `lib/schema.ts` es el
    apex, y de ahí salen la canónica, `og:url`, los `@id` del JSON-LD y las cuatro URLs del
    `sitemap.xml`: **cada URL que el sitio declara como oficial es una que redirige**. En Search
    Console las cuatro saldrían como "Página con redirección".
    El comentario de `lib/analytics.ts` da por hecho lo contrario ("si hoy redirige al apex"); la
    analítica se salva solo porque `www` está en `DOMINIOS_PRODUCCION`.
    **Decisión: el apex es el host canónico.** El código ya es consistente con eso y no se toca;
    el arreglo es en la consola de Amplify — apex sirve 200 y `www` redirige con **301**. Hasta
    entonces, no dar de alta el sitemap en Search Console.

## 2026-08-28

- **fix(home): en móvil la rejilla de Especialistas no aparecía nunca** — se quedaba en
  `opacity: 0` para siempre, así que la sección salía vacía. En escritorio se veía bien.
  - **La causa no era la imagen ni el `aspect-ratio`.** Era `useReveal`, que observaba con
    `threshold: 0.15`: un umbral expresado como **fracción del elemento**. Para un elemento más
    alto que la pantalla, eso pide más píxeles de los que el teléfono tiene, y el observer no se
    dispara jamás.
  - **Lo introdujo el propio cambio de esta rama:** la rejilla pasó de 6 tarjetas a 10, y en móvil
    va a una columna, así que mide **5.147 px**. El 15 % son **772 px visibles a la vez**, y ningún
    teléfono real llega: un iPhone SE deja ~560 px útiles y un iPhone 14, ~730. Con 6 tarjetas la
    sección medía la mitad y entraba de sobra.
  - **Por qué no se detectó antes:** la verificación se hizo a 375 × 812, y 772 < 812 por 40 px.
    El emulador era el único tamaño donde funcionaba.
  - **Arreglo:** el disparo pasa a medirse sobre la **altura de la pantalla** con
    `rootMargin: '0px 0px -15% 0px'` en vez de sobre el alto del elemento con `threshold`. El ritmo
    al hacer scroll es el mismo, pero ahora una sección no puede volver a esconderse por crecer.
    Se aplica también a `useCountUp`, que compartía la constante.
  - **Verificado** sobre el build de producción, comprobando la condición geométrica del observer
    para las nueve secciones con reveal en cuatro alturas de pantalla (560, 690, 730 y 812 px):
    antes, Especialistas fallaba en tres de las cuatro; ahora pasan las nueve en las cuatro,
    incluida la última de la página, que era el riesgo de usar `rootMargin` negativo.

- **Carga del home: 697 KB → 463 KB de JavaScript** — medido sobre el build, no estimado.
  - **El SDK de Supabase estaba en la portada.** `_app.tsx` monta `PresenceProvider` en las trece
    rutas, y ese provider importaba `lib/supabase`, así que **229 KB de auth + realtime** —un
    tercio de la primera carga— viajaban a cada visitante anónimo que entraba a leer la portada,
    para no usarlos nunca. Se parte en dos: `lib/presence.tsx` se queda con el contexto y los
    hooks, y `lib/presenceCanal.tsx` (nuevo) con todo lo que habla con Supabase, cargado con
    `next/dynamic({ ssr: false })`. **Los dos efectos van copiados palabra por palabra**: no cambia
    a quién se anuncia, ni cuándo se re-suscribe, ni el `setTimeout(…, 0)` que evita el deadlock
    del lock de auth-js. Lo único que cambia es cuándo llega el código — la presencia arranca un
    viaje de red más tarde, después de hidratar. `ssr: false` es inocuo porque el componente
    devuelve `null`: los hijos del provider se siguen renderizando en el servidor, que es lo que se
    indexa. Las páginas que sí necesitan Supabase (`/login` 640 KB, `/panel-medico` 655 KB) lo
    siguen cargando igual.
  - **Los estáticos de `public/` se revalidaban en cada navegación.** Next los sirve con
    `cache-control: public, max-age=0`: la fuente de marca (29 KB), los iconos y las fotos pedían
    un 304 por página. Entra una regla en `next.config.js` con una semana +
    `stale-while-revalidate`. **No `immutable`**: estas rutas no llevan hash de contenido, así que
    con `immutable` un cambio de marca no llegaría nunca a quien ya hubiera visitado el sitio.
  - PENDIENTE: el visitante anónimo ya no carga Supabase en la ruta crítica, pero el chunk sigue
    descargándose tras hidratar, porque el provider se monta en todas las rutas. Saltárselo del
    todo para quien no tiene sesión exige mirar `localStorage` antes de cargar el SDK, y eso acopla
    el código a un detalle interno de Supabase con un fallo silencioso si cambia (médicos que
    aparecen desconectados). No se hizo por eso.
  - Archivos: `lib/presence.tsx`, `lib/presenceCanal.tsx` (nuevo), `next.config.js`.

- **Instagram, la única red de la organización** — `MARCA.instagramUrl` pasa a la forma canónica con
  `www.` (confirmado con el equipo, 2026-08-28). No es cosmético: esa URL es el `sameAs` del JSON-LD,
  o sea lo que le dice a Google que la cuenta y la organización son la misma entidad, y sin `www.`
  había un 301 de por medio. No hay cuenta de X: por eso `twitter:site` se queda fuera.
  - Archivos: `components/home/copy.ts`.

- **Meta tags, iconos e imagen para compartir** — una auditoría del dominio de producción dio
  **24/100 en Open Graph**. El `<head>` del sitio tenía cuatro etiquetas: `title`, `charset`,
  `viewport` y `description`. Nada más — ni `og:image`, ni canónica, ni un solo favicon en
  `public/`.
  - **`components/Seo.tsx` (nuevo).** Todo lo que cambia de página a página en un componente:
    título, descripción, canónica, Open Graph completo y tarjeta de X. Antes cada una de las
    trece páginas ponía su `<title>` a mano y ninguna ponía nada más; así es justamente como se
    acaba con trece títulos y cero descripciones. Lo usan las trece.
  - **Lo que se veía roto de verdad.** Sin `og:image`, compartir el enlace por WhatsApp —el canal
    de este público— daba un rectángulo gris. Sin `apple-touch-icon`, iOS usa una **captura de la
    página** como icono al añadirla a la pantalla de inicio. Y sin `.ico`/`.png`, Google Search
    pinta el globo genérico: **no lee favicons en SVG**.
  - **`scripts/build-iconos.mjs` (nuevo).** Genera los ocho ficheros desde los SVG de
    `public/brand/`: `favicon.svg`, 16, 32, `.ico` (16+32+48, armado a mano porque sharp no
    escribe ICO), `apple-touch-icon`, 192, 512, 512 maskable y `og-image.png` (1200x630). El
    isotipo son siete estrellas y **a 16 px se funden en una mancha**: los tamaños de pestaña
    llevan solo la estrella central, cuya caja se mide con `getBBox()` en vez de estimarla. La
    imagen de OG la pinta Chromium (Playwright, ya es dependencia) porque lleva texto con la
    tipografía de marca, con el titular del hero palabra por palabra — quien abre el enlace tiene
    que reconocer la página.
  - **Título y descripción del home.** El título eran 69 caracteres (`nombre — tagline`) y se
    cortaba en X y en Google; ahora 51. La descripción eran los 45 del tagline, la mitad del
    espacio del resultado desaprovechado; ahora 159, diciendo qué se hace, para quién y a qué
    precio.
  - **Indexación.** Las páginas privadas y de tránsito (login, panel, admin, callback, sala de
    espera, mi caso, elegir rol) van con `noindex`; entran además `robots.txt` y `sitemap.xml`,
    que no existían. Las dos cosas hacen falta y no son la misma: `Disallow` pide que no se
    rastree, `noindex` que no se indexe. Nota: en varias de esas páginas el `<head>` está detrás
    de un early return por sesión, así que el `noindex` solo sale tras hidratar — de ahí que el
    `Disallow` las cubra igualmente.
  - **`_document.tsx`** recoge lo que no cambia nunca (iconos, manifiesto, `theme-color`) y
    **`site.webmanifest`** entra nuevo. `twitter:site` se queda fuera a propósito: la organización
    publica en Instagram, no en X, y poner una cuenta que no existe atribuiría el contenido a un
    tercero.
  - Archivos: `components/Seo.tsx`, `scripts/build-iconos.mjs`, `pages/_document.tsx`, las trece
    páginas de `pages/`, y en `public/`: `favicon.*`, `favicon-16x16.png`, `favicon-32x32.png`,
    `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
    `og-image.png`, `site.webmanifest`, `robots.txt`, `sitemap.xml`.

- **Home — segunda ronda de copy de The Climb** — el documento corregido cambia textos, el orden de
  varias secciones y el color de fondo de casi todas. **Solo el home**; el panel médico y el admin
  no se tocan.
  - **Orden y paleta.** El copy fija ahora fondo por sección: 01 Hero `#f4f4f4` · 02 Puertas
    `#18202b` · **03 Psicología `#0066fe` (sección nueva)** · 04 Quiénes Somos `#f4f4f4` ·
    05 Cómo Funciona `#18202b` · 06 Especialistas `#0066fe` · 07 Testimonios `#f4f4f4` ·
    08 Impacto `#003d5f` · 09 Blog `#f4f4f4` · 10 CTA final y 11 pie `#18202b`. Cambian de fondo
    cinco secciones; el mapa completo queda comentado en `pages/index.tsx` para poder cotejarlo de
    un vistazo. La banda de Valores no aparece en el orden del documento: se mantiene como cierre
    de Quiénes Somos —decisión del equipo— y comparte su blanco roto.
  - **Contraste recalculado, no heredado.** Cómo Funciona pasó de claro a navy y Testimonios de
    azul marino a claro: los dos llevan todo el texto recalculado. El caso exigente es
    `--h-blue` (#0066fe), el fondo de Psicología y Especialistas: da **4,85:1 contra blanco puro**,
    apenas por encima del 4,5:1 de AA, y **cualquier transparencia se cae del mínimo**
    (`--h-sobre-oscuro-medio`, el blanco al 80 % que usan las secciones navy, se queda en 3,63:1).
    Por eso esas dos secciones usan `--h-white` sin `opacity` y hacen la jerarquía con tamaño y
    peso. Se retiraron ahí el `opacity: 0.75` del "Ver todos" (3,2:1) y el check verde de las
    fichas (2,78:1). Auditoría propia sobre el DOM renderizado, a 1440 y a 375 px: **0 nodos por
    debajo del mínimo**, sin contar la franja del hero, que va sobre un degradado encima de la foto.
  - **Puertas de entrada:** nuevo orden y textos. La del médico venezolano pasa a la 01 y se llama
    "Soy médico, necesito apoyo clínico"; el paciente baja a la 02. Descripciones completas en vez
    de fragmentos.
  - **Psicología:** banda nueva entre las puertas y Quiénes Somos. El CTA va al **mismo** registro
    de paciente que la telemedicina: no hay un flujo aparte para salud mental, y mandar a la gente
    a otra ruta sería prometer algo que no existe.
  - **Cómo Funciona:** los tabs cambian de orden (interconsulta primero, y es el activo al cargar)
    y entra un paso nuevo, **"Recepción Clínica"**, en los flujos de médico y de paciente — el que
    dice que hay una persona del equipo entre el caso y el especialista. Sustituye a "Describe el
    caso clínico" y a "Espera a ser atendido", que era justo lo que ese paso hacía sin nombrarlo.
    El flujo de voluntario no lo lleva y queda igual.
  - **Quiénes Somos:** debajo del texto entra el equipo en dos grupos —2 cofundadoras y 4 personas—
    con cargo y biografía. Son nombres **reales** entregados por la organización, a diferencia de
    la rejilla de Especialistas. Van sin retrato a propósito: las fotos que llegan son para
    Especialistas, y una imagen de archivo aquí pondría una cara ajena junto al nombre de una
    persona real.
  - **Pie:** el aviso legal se reduce a "Médicos por Venezuela es una organización sin fines de
    lucro registrada". ⚠️ Con ello desaparece la advertencia de que la orientación **no sustituye
    la atención presencial de urgencia**, que era una salvaguarda clínica, no relleno. Se retira
    porque lo pide el copy aprobado y queda anotado en `copy.ts`. La descripción de la columna de
    marca también decía "registrada en Estados Unidos"; se quita ahí igualmente, porque si no el
    pie se contradecía consigo mismo a dos párrafos de distancia.
  - **Pendiente de assets** (ver `tasks/todo.md`): los iconos de la banda de Valores y las fotos de
    los 10 especialistas, que además amplían la rejilla de 6 plazas a 10.
  - **Verificación:** `tsc --noEmit` · `eslint` · `prettier --check` sobre lo tocado · `next build`
    · orden, fondos y textos comprobados sobre el DOM renderizado · sin desbordamiento horizontal
    a 375 px. **No verificado:** el cambio de pestaña con el ratón, porque el `next dev` de este
    entorno no llega a hidratar (rechaza `_clientMiddlewareManifest.js` por MIME `application/json`);
    la lógica del tablist no se tocó, solo sus datos y colores.
  - **Archivos:** `components/home/{copy.ts,Psicologia.tsx,QuienesSomos.tsx,ComoFunciona.tsx,`
    `Especialistas.tsx,Testimonios.tsx,Hero.tsx,Valores.tsx,Metricas.tsx}`, `pages/index.tsx`,
    `tasks/todo.md`.

- **Home — segunda tanda de ajustes del mismo día** — assets entregados y cuatro decisiones del
  equipo. Sigue siendo **solo el home** más una página nueva; el panel médico y el admin no cambian.
  - **Iconos de Valores.** Los cuatro PNG entregados (500 × 500, RGBA, relleno plano) pasan a WebP
    de 96 px con `scripts/optimize-value-icons.mjs`, siguiendo el patrón del hero: el origen vive
    en `nueva/iconos-valores/` (sin versionar) y solo se versiona lo que se sirve. ~3 KB cada uno.
    Van con `alt` vacío porque repiten el título que tienen al lado.
    ⚠️ Los nombres de archivo son los de los valores del PROTOTIPO (Calidad, Credibilidad,
    Autonomía, Gratuidad), no los del copy, y algún dibujo no cuadra ni con su propio nombre
    (`Gratis.png` son cinco estrellas). El reparto respeta los tres que sí coinciden, así que
    **"Confidenciales" se queda con un pulgar arriba** — lo que peor encaja. En `tasks/todo.md`.
  - **Página `/quienes-somos`.** Las cofundadoras y el equipo salen del home y pasan a una página
    propia, a la que se llega desde "Conoce nuestra historia →" (que era texto inerte y ahora es un
    enlace de verdad). El "Quiénes Somos" del MENÚ sigue siendo el ancla de la sección del home:
    fue una decisión explícita del equipo. La página reutiliza el copy aprobado de la organización
    en una cabecera navy y añade abajo a las seis personas; no se inventó texto institucional.
  - **Efecto lateral de tener una segunda página:** Navbar y Footer los comparten las dos, así que
    sus anclas pasan de `#seccion` a `/#seccion`. Desde `/quienes-somos`, un `#seccion` a secas no
    llevaba a ninguna parte. Comprobado: el salto aterriza a 76 px del borde, justo debajo de la
    barra fija.
  - **Psicología preselecciona la especialidad.** El CTA entra como
    `/registro-paciente?especialidad=psicologia` y el formulario llega con "Conozco la especialidad"
    marcado y Psicología elegida. Se localiza por el flag `mental_health_only` del catálogo, NUNCA
    por el nombre — renombrarla en la base rompería un `find` por cadena, que es exactamente lo que
    ya pasó con "Pediatría". Si el catálogo no la trae, no se preselecciona nada y el formulario se
    comporta como siempre.
  - **Especialistas: 10 plazas y sin "Ver todos".** La rejilla pasa de 6 a 10 y de 3 a 5 columnas.
    El número de columnas no es estético: los filetes se dibujan con bordes por celda, y con una
    última fila a medias queda media banda abierta que parece un fallo. 5/2/1 son los divisores de 10. Se retiran el enlace "Ver todos los especialistas →" y la entrada "Especialistas" del menú
    —y también la del pie, que si no contradecía al menú—: esa página no existe.
  - **Pie: franja de créditos.** "Esto es posible gracias a una colaboración entre The Climb y
    Softronic", con Softronic enlazando a softronic.dev. The Climb va como texto porque no se dio
    una URL. El enlace va subrayado y no solo en otro color.
  - **Verificación, esta vez sobre el build de producción** (`next build` + `next start`), que es
    donde sí hidrata: la preselección de Psicología funciona y **no** se activa sin el parámetro;
    las pestañas de Cómo Funciona cambian; la rejilla de especialistas da 10 celdas en 5 columnas
    de 234 px y 2 filas exactas; el salto desde `/quienes-somos` al home aterriza bajo la barra.
    Contraste recalculado sobre el DOM a 1280 y 375 px: **0 nodos por debajo del mínimo** en las
    dos páginas (sin contar la franja del hero, que va sobre un degradado encima de la foto), y sin
    desbordamiento horizontal.
  - **Hallazgo, fuera de alcance:** `next dev` NO hidrata en este entorno (Next 16.3 + Turbopack +
    `cacheComponents`): los chunks se descargan pero React nunca monta, así que ninguna página
    responde a un clic en desarrollo. No es del home —afecta a todo el sitio— y `next start` no lo
    tiene. Anotado en `tasks/todo.md`.
  - **Archivos:** `components/home/{copy.ts,Equipo.tsx,QuienesSomosCabecera.tsx,QuienesSomos.tsx,`
    `Valores.tsx,Especialistas.tsx,Navbar.tsx,Footer.tsx}`, `pages/{quienes-somos.tsx,`
    `registro-paciente.tsx}`, `scripts/optimize-value-icons.mjs`, `public/img/valores/*`,
    `tasks/todo.md`.

- **Home — tercera tanda del mismo día: assets reales y cifras reales** — llegan los diez retratos
  de especialistas y se cierran cuatro peticiones más del equipo. Toca también el repo del backend.
  - **Diez especialistas de verdad.** Se acabaron las plazas "Perfil por publicar": nombres,
    especialidades y retratos entregados por la organización. La tarjeta cambia de forma —foto
    arriba a sangre y datos debajo, como un directorio médico— porque la cara es lo que sostiene la
    confianza que esa sección defiende, y un avatar de 64 px en una esquina ya no servía. Fuera el
    campo "País", a petición del equipo.
  - **El recorte de los retratos, calculado y no automático.** Los diez originales son 9:16 pero el
    encuadre va de plano de busto a cuerpo entero: un recorte fijo, o el `attention` de sharp
    —ambos probados—, dejan una rejilla donde unos parecen de cerca y otros de lejos. La solución
    mide la cabeza de cada foto y deriva el recorte de ahí: el alto sale de igualar el tamaño de la
    cabeza, y el borde superior de igualar el aire sobre la coronilla. Dos medidas por foto y una
    regla, en `scripts/optimize-specialist-photos.mjs`. 204 KB los diez, a 640 × 800.
  - **Fuera del menú: Blog** (y con él el "Ver todos los artículos →", igual que se hizo con
    Especialistas). Con eso **el menú ya no tiene ni una entrada inerte**: las cinco llevan a algún
    sitio. Las secciones de Blog y Especialistas siguen en la página.
  - **Cómo Funciona cierra cada flujo con su botón de registro**, con el mismo texto y el mismo
    destino que su puerta de entrada del principio: quien baja leyendo los cuatro pasos ya no tiene
    que subir otra vez para encontrar por dónde se entra.
  - **Las cifras de la portada ya son reales.** Hero e Impacto piden `GET /api/v1/stats/public` al
    backend — endpoint NUEVO, en la rama `feat/stats-publicas` del repo `api-medicos-por-venezuela`.
    Antes eran números escritos a mano que envejecían: el copy original decía "+3.000 médicos"
    cuando la base tenía ~2.960, y hubo que bajarlo a "+2.000" para no mentir. Ahora dice +2.500,
    que es cierto y sale del conteo.
    - **El redondeo se hace en el SERVIDOR**, no en el navegador: el endpoint no pide token, así que
      devolver el conteo exacto publicaría el pulso operativo de la organización a quien mire la
      pestaña de red. Escalones: medios millares por encima de 1.000 (2.900 → 2.500) y centenas por
      debajo (379 → 300, 450 → 400), más decenas por debajo de 100 para que 47 no se publique como
      "+0". **Siempre a la baja**, nunca al más cercano: la cifra publicada tiene que ser una que la
      organización pueda defender.
    - **Consultas: todas las creadas**, sin filtrar por estado (decisión del equipo). ⚠️ La etiqueta
      sigue diciendo "Consultas realizadas" y ahí entran también las que están en espera, las
      canceladas y los no-show. Anotado en `tasks/todo.md`.
    - Una sola petición aunque la usen dos secciones, y **respaldo** en `METRICAS`: es lo que se
      pinta en el servidor, lo que ve quien no tenga JavaScript y lo que queda si el backend no
      responde. Comprobado en el HTML servido: sin JS se leen +2.000 y +200, que son ciertas.
  - **Backend (`feat/stats-publicas`):** `GET /stats/public` sin token, tres `COUNT(*)` y ninguna
    fila leída, con el redondeo en el servicio. 13 pruebas en `tests/test_stats.py` (los escalones,
    que nunca redondee hacia arriba para 0..2999, que el endpoint no pida token y que cuente todas
    las consultas y solo los médicos activos). **Suite completa: 326 pasan, 0 fallan.** `ruff check`
    y `ruff format` limpios.
  - **Fuera el rótulo "Interconsulta en curso"** de la esquina de la foto del hero. Venía del
    prototipo, no del copy. La franja "24/7 · Disponible · Confidencial" se queda.
  - **Borrado:** `public/img/avatar-placeholder.png` (54 KB), que lo había añadido esta misma rama
    para las plazas vacías y ya no lo usa nadie.
  - **Verificación** sobre `next build` + `next start`: menú sin Blog ni Especialistas, botón de
    registro en los tres flujos, 10 fichas con foto, y las cifras del hero y de Impacto coincidiendo
    (+2.500 / +200 / +20) tras una única llamada al backend. Contraste recalculado sobre el DOM en
    las tres pestañas de Cómo Funciona: **0 nodos por debajo del mínimo** (sin contar la franja del
    hero, que va sobre un degradado encima de la foto). `tsc`, `eslint` y `prettier` limpios.
  - **Archivos:** `components/home/{copy.ts,cifras.ts,Especialistas.tsx,ComoFunciona.tsx,Blog.tsx,`
    `Hero.tsx,Metricas.tsx}`, `lib/api.ts`, `scripts/optimize-specialist-photos.mjs`,
    `public/img/especialistas/*`, `tasks/todo.md`. En el backend:
    `src/{routers,services,schemas}/stats.py` y `tests/test_stats.py`.

- **Google Analytics 4, solo en el sitio de producción** — propiedad `G-09M01TF5F3`.
  - **La condición se comprueba contra el DOMINIO en el navegador, no contra la rama en el build.**
    La rama no existe en tiempo de ejecución: depender de `AWS_BRANCH`/`VERCEL_GIT_COMMIT_REF`
    significa que el día que esa variable no esté —un build local, otro runner, otro proveedor— el
    sitio publica analítica sin que nadie se entere, o deja de publicarla sin que nadie se entere.
    El dominio sí es exactamente lo que se pidió: ni local ni la previsualización de `dev_aws`
    sirven desde `medicosporvenezuela.org`, así que ninguna carga nada. El efecto es el mismo que
    "solo en main" porque ese dominio sirve main, pero si mañana se publicara otra rama en
    producción la analítica seguiría funcionando, en vez de apagarse en silencio.
  - **Fuera de producción NO se pide nada a Google.** El guard va antes de crear el `<script>`, no
    después de cargarlo: con el `<script async src>` del snippet original, el navegador haría la
    petición siempre y el guard llegaría tarde. Comprobado en local: 0 peticiones a
    googletagmanager/google-analytics y `gtag` sin definir.
  - **Vistas de página en las navegaciones internas** (`pages/_app.tsx`). El snippet manda una sola
    vista, la de la carga inicial; este sitio navega del lado del cliente, así que sin esto
    Analytics vería a todo el mundo entrando por el home y no saliendo de ahí jamás.
  - **El snippet va encapsulado.** El de Google, tal cual, deja `dataLayer` y la variable del
    `<script>` como globales sueltas; en una página que ya carga Supabase y Realtime no hacía falta
    añadir dos nombres más al espacio global. `gtag.js` lee `window.dataLayer` por su nombre, así
    que no le afecta.
  - **CSP actualizada** (`next.config.js`): `googletagmanager.com` en `script-src`,
    `google-analytics.com` y sus subdominios en `connect-src`, y ambos en `img-src` para el píxel
    de respaldo. La CSP está en Report-Only, así que sin esto no se rompería nada hoy — pero cada
    evento de analítica generaría una violación en producción, y esos falsos positivos taparían los
    reportes de verdad. Y el día que pase a enforced, la analítica dejaría de funcionar.
  - **Verificación:** el snippet TAL CUAL sale en el HTML servido, ejecutado con un `location`
    simulado y `appendChild` interceptado (para no mandar visitas falsas a la propiedad real): con
    `https://medicosporvenezuela.org` y con `www.` crea el `<script>` de `gtag.js` con el ID
    correcto y encola `js` + `config`; con la URL de una rama, con `localhost` y con `http://` del
    propio dominio, no crea nada. Ocho URLs comprobadas, incluida `medicosporvenezuela.org.evil.com`
    (no carga: la comparación es exacta, no un `endsWith`).
  - **Archivos:** `lib/analytics.ts`, `pages/{_document.tsx,_app.tsx}`, `next.config.js`,
    `CLAUDE.md`, `AGENTS.md`.

- **Nota de la fusión con `dev_aws` (2026-08-28).** La rama se puso al día con `dev_aws`, que había
  avanzado cuatro PR. Tres conflictos eran de documentación y uno no:
  - `pages/index.tsx`: `dev_aws` editaba el home VIEJO, que esta rama sustituyó entero. Se conserva
    la composición nueva — pero **el cambio que hacía allí sí importaba**: el login se unificó en
    `/login`, que resuelve el destino por rol. `RUTAS.ingresar` pasa de `/login-medico` (que ahora
    solo redirige) a `/login`, para no hacer pasar a todo el mundo por un salto de más.
  - `tasks/{plan,todo}.md`: son artefactos SDD que cada rama sobrescribe con SU cambio. Los de
    `dev_aws` son del login unificado y los de esta rama del refrescamiento del home; no hay un lado
    que descartar. `dev_aws` ya había introducido `tasks/users-verified/` como subcarpeta por cambio,
    así que se sigue esa convención: los de esta rama pasan a `tasks/home-refresh/`.
  - `changeslog.md` y `AGENTS.md`: se conservan las dos partes.

- **SEO: plan estratégico y datos estructurados** — `.knowledge/seo/` (cinco documentos) y
  `lib/schema.ts`.
  - **Auditoría del estado real, medida sobre el build de producción**, no estimada. El sitio NO
    tenía: `robots.txt` (404), `sitemap.xml` (404), Open Graph en ninguna de las 8 páginas públicas,
    `canonical` en ninguna, `meta description` en 6 de 8, ni `<title>`/`<h1>` en `/mi-caso` y
    `/elegir-rol`. Y las superficies de aplicación (`/sala-espera`, `/mi-caso`, `/elegir-rol`,
    `/auth/callback`) son indexables.
  - **Lo de Open Graph es lo más grave, y no por posicionamiento:** el canal por el que este público
    comparte es WhatsApp, y hoy cada enlace compartido llega sin imagen, sin título y sin
    descripción. Es la corrección con mejor relación esfuerzo/impacto de todo el plan.
  - **Estrategia.** El sitio son tres embudos que casi no se solapan (paciente, médico en Venezuela,
    médico voluntario) compartiendo una sola página, y por eso no compite en ninguno. El panorama
    competitivo se comprobó con búsqueda: "telemedicina gratis Venezuela" lleva ocupado desde 2017
    (MVO, Asistensi) y hay una universidad en el nicho (SOS Telemedicina, UCV, dominio `.ucv.ve`).
    **Pero nadie ocupa interconsulta ni voluntariado.** Ahí va la apuesta.
  - **Sin cifras inventadas.** No hay Search Console ni herramienta de datos conectada, así que no
    hay volúmenes de búsqueda, ni dificultad de palabra clave, ni autoridad de dominio. Un plan con
    números inventados es peor que uno sin ellos: se toman decisiones creyéndolos. Instrumentar es
    la tarea 1 de la fase 1, y las casillas de línea base están marcadas "sin medir".
  - **JSON-LD implementado** en el home y en `/quienes-somos`: `MedicalOrganization` + `NGO` (las dos
    ciertas; ninguna sola dice lo que es esto), `WebSite`, `AboutPage`, y `Person` para los 10
    especialistas y las 6 personas del equipo. La organización se define UNA vez y las demás páginas
    la referencian por `@id`, para que los buscadores vean una entidad con varias páginas y no varias
    organizaciones parecidas. Va en el HTML del servidor, no inyectado por JS.
  - **Lo que NO se declaró, y por qué:** sin `foundingDate` (nadie ha dado una fecha), sin
    `nonprofitStatus` (el enumerado es por jurisdicción y el copy retiró la mención a EE. UU.), sin
    `address` (no hay sede), sin `aggregateRating` (**no hay reseñas reales**; fabricar una
    valoración en un sitio médico es justo lo que se penaliza) y sin `SearchAction` (no hay buscador).
    En salud, un dato falso en JSON-LD no es un adorno de más: es una declaración formal.
  - **Logotipo en mapa de bits** (`scripts/build-logo-raster.mjs`): el sitio solo tenía SVG y el
    `logo` de la organización necesita un formato que el rastreador pueda usar. Sirve también para
    la imagen de Open Graph cuando se implemente — WhatsApp, Facebook y X no renderizan SVG.
  - **Validación:** validador propio sobre el HTML servido de las dos páginas. JSON válido, `@type`
    en todos los nodos, URLs absolutas, sin texto de relleno, sin tipos obsoletos, un solo bloque por
    página. Pendiente el Rich Results Test, que necesita una URL pública.
  - **Archivos:** `.knowledge/seo/{SEO-STRATEGY,COMPETITOR-ANALYSIS,SITE-STRUCTURE,CONTENT-CALENDAR,`
    `IMPLEMENTATION-ROADMAP,SCHEMA-REPORT}.md`, `generated-schema.json`, `lib/schema.ts`,
    `pages/{index,quienes-somos}.tsx`, `scripts/build-logo-raster.mjs`,
    `public/img/logo-medicos-por-venezuela.png`.

- **El admin no tenía forma de aprobar a un médico, y el médico bloqueado no sabía por qué** — el
  backend ya gatea el acceso por credencial (ficha en `doctors` verificada, activa y con cédula +
  licencia), pero eso dejaba a 2909 de 2979 médicos fuera **sin ninguna pantalla** que lo explicara
  ni ningún botón que lo resolviera. La única aprobación posible era un `PATCH` a mano.
  - **Panel admin — "Credenciales para atender"** (`components/admin/DoctorCredentials.tsx`, en
    `/admin/doctores`): tabla paginada con filtros _aprobado / no aprobado_ y _habilitado /
    bloqueado_, búsqueda por nombre/cédula/email, y el **motivo de bloqueo** de cada uno. Consume
    `GET /doctors` (ahora `{items, total}` con `can_practice`/`blocked_reason`) y los endpoints
    nuevos `POST /doctors/{id}/approve` · `/revoke-approval`.
  - **Aprobado != habilitado.** Una ficha puede estar `verified` y aun así no atender por faltarle
    la cédula — es el caso de 2847 médicos. Por eso el botón de aprobar solo aparece cuando aprobar
    de verdad desbloquea (`blocked_reason === 'no_verificado'`); en el resto la fila dice qué hay
    que pedirle al médico. Si aun así se intenta, el 422 del backend se muestra tal cual.
  - **Pantalla de "verificación pendiente"** en `/panel-medico`: el médico bloqueado llega con
    `permissions: []`, así que antes veía un panel vacío y un error genérico. Ahora se comprueba
    `credential_verified` (de `GET /auth/me/permissions`) antes de pedir la cola y se le explica qué
    falta, con salida a `/panel-medico/perfil` — la única ruta que el gate deja abierta a propósito.
  - E2E: `e2e/credencial-medica.spec.ts` cubre las dos puntas (el médico bloqueado y el admin que
    aprueba/revoca). `global-setup` siembra ahora **licencia** en los médicos de prueba —sin ella
    ninguno pasa el gate— y un tercer médico (`E2E Doctor Tres`) sin validar, que absorbe el caso
    "sin verificar" para que doc1/doc2 puedan seguir atendiendo en los specs de cola.
    `admin-cedula-verificada` pasa a anclar su selector a `.users-table`: la página tiene dos tablas.
  - Archivos: `lib/doctors.ts`, `lib/users.ts`, `components/admin/DoctorCredentials.tsx`,
    `pages/admin/doctores.tsx`, `pages/panel-medico.tsx`, `e2e/`.
- **La cola de aprobación era invisible: parecía que el botón no existía.** Con los datos reales
  (2979 médicos) solo **26** son aprobables de un clic, frente a **2847** a los que les falta la
  cédula. Ordenando por fecha, la primera página de 25 filas no traía ni un aprobable —el primero
  cae en la fila 29—, así que el admin veía un montón de filas sin botón y concluía, con razón,
  que aprobar no estaba implementado.
  - Filtro **por motivo de bloqueo** (`GET /doctors?blocked_reason=…`, enum cerrado) y selector en
    el panel: "Listos para aprobar", "Les falta la cédula", etc. Es el filtro que convierte la
    tabla en una cola de trabajo; los de aprobación y habilitación por sí solos no acotan nada
    (las ~820 "no aprobadas" son casi todas irresolubles desde el panel).
  - **Fila de contadores** por estado (`GET /doctors/credential-summary`, una sola consulta),
    clicable: cada número aplica su filtro. Sin ella el filtro nuevo tampoco se descubre.
  - **Nota del rebase:** este PR también llevaba el cambio de `!== null` a `!= null` en los badges
    de cédula (contra un backend que aún no expone el campo, el estricto pintaba "Cédula sin
    verificar" a todos, admins incluidos). Al rebasar sobre `dev_aws` resultó que la base ya lo
    traía, del PR #90 y con la misma justificación, así que el diff ya **no** lo contiene y no
    debe atribuírsele. Lo que sí queda es haberlo detectado corriendo los E2E contra un backend
    sin ese campo.
  - `credencial-medica.spec.ts` fija el texto exacto: `getByText` busca subcadena e ignora
    mayúsculas, así que el badge "Sin aprobar" colisionaba con el motivo "Credencial sin aprobar"
    de su propia fila (strict mode violation). El motivo pasa a tener su propio `<span>`.

## 2026-08-27

- **El badge "Verificado" del admin decía la verdad a nadie** — la lista de médicos leía
  `users.verified`, que nace `true` en `handle_new_auth_user` y **ninguna ruta del backend baja**.
  Resultado: badge verde para todo el mundo. El dato real de credencial (contrastar la cédula con
  SACS o FPV) vive en `doctors.verified`, repartido **795 sin validar / 2160 validadas**: el 27% de
  los médicos aparecía como verificado sin estarlo, y **no había ninguna otra pantalla** donde el
  admin pudiera comprobarlo (`/doctors/pool` no devuelve el campo).
  - Backend: `GET /profiles` expone `doctor_verified` con un LEFT JOIN a `doctors` en la misma
    consulta paginada. `null` = esa persona no tiene ficha, así que no hay cédula que validar;
    colapsarlo a `false` acusaría a un paciente de no estar verificado.
  - `deleted_at IS NULL` va en el `ON` del join, no en el `WHERE`: el índice único de
    `doctors.user_id` es **parcial**, y sin ese filtro una ficha borrada duplicaría la fila del
    usuario y descuadraría la página contra el total. En el `WHERE` habría convertido el LEFT JOIN
    en INNER, haciendo desaparecer de la lista a todo el que no sea médico.
  - Anti-N+1 con test que cuenta las consultas: con ~3500 usuarios, un SELECT por fila hundiría la
    pantalla que más usa el admin.
  - Frontend: los dos badges (`admin/doctores`, `UsersManager`) leen el campo nuevo y dicen
    **"Cédula verificada" / "Cédula sin verificar"** — nombrar _qué_ se verificó es lo que evita
    repetir la ambigüedad. Quien no es médico ya no lleva badge.
  - Se quitan los `!me.verified` de los guards de `panel-medico` y `consulta/[id]`: comprobaban una
    constante. `active` se queda, que es el gate real (botón "Revocar acceso").
  - **`users.verified` NO se borra.** `current_user_role()` sigue filtrando por ella, así que el
    gancho de aprobación previa que documenta `CLAUDE.md` funcionaría poniéndola en `false` sin
    tocar ninguna de las 5 políticas RLS que protegen la PII de pacientes. Cambio **aditivo**: cero
    migraciones, cero RLS.
  - Tests: 4 en el backend (los tres estados, ficha borrada, anti-N+1) y
    `e2e/admin-cedula-verificada.spec.ts`. Los dos juegos verificados poniéndose **rojos** al volver
    a leer `users.verified`; `global-setup` siembra ahora un médico sin validar.
  - Docs: `CLAUDE.md` y `AGENTS.md` estrenan "Las dos columnas `verified`". Artefactos en
    `tasks/users-verified/`.

## 2026-08-23

- **Login unificado en `/login`** — paciente, médico y admin entran por una sola puerta, que decide
  el destino tras autenticar: admin efectivo → `/admin/dashboard`, `doctor`/`specialist` →
  `/panel-medico`, resto → `/mi-caso`; `role_chosen=false` → `/elegir-rol`, y una cuenta con
  `active=false` se desloguea y ve el aviso **en `/login`** en vez de rebotar sin explicación.
  El fan-out estaba **triplicado** (`login-medico`, `mi-caso`, `auth/callback`) y ahora vive una
  sola vez en `lib/postLogin.ts`, que consumen los tres.
  - `/mi-caso` deja de ser mitad formulario y mitad portal: **solo portal**; sin sesión va a `/login`.
  - `/login-medico`, `/admin` y `/admin/login` quedan como redirects a `/login` (no se borran: hay
    enlaces externos). `/admin` conserva su `noindex`. `useAdminGuard` apunta a `/login` directo,
    ahorrando el salto intermedio.
  - La home no cambia visualmente: sus tres botones de acceso solo cambian de destino.
  - **Nota de diagnóstico:** se creía que `/login-medico` enrutaba mal a un médico con `admin` en
    `user_roles` (usa `isAdminRole`, rol legado). Es **falso** — `GET /auth/me` ya devuelve el rol
    EFECTIVO del RBAC (`effective_role`, con `super_admin`/`admin` primero en `_ROLE_PRIORITY`), así
    que ese caso siempre funcionó. Lo destapó el sanity check del spec E2E. Por eso el helper usa
    `isAdminRole(profile.role)` y **no** `effectiveAdminRole()`: este último costaría un
    `GET /auth/me/permissions` extra en cada login de paciente y médico para recalcular lo que
    `profile.role` ya trae. El valor del cambio es la consolidación, no un arreglo de enrutado.
  - **A11y:** `components/auth/AuthField.tsx` pintaba `<label>` e `<input>` sin asociar — ningún
    lector de pantalla anunciaba los campos. Ahora usa `useId()` + `htmlFor`/`id`. Lo destapó el
    spec E2E al no encontrar los campos por su etiqueta.
  - **Hallazgos del code review, ya aplicados:** (a) `/login` no reenviaba a un usuario que ya
    tenía sesión — regresión real, porque `/mi-caso` sí lo hacía cuando era login Y portal; un
    paciente logueado que pulsaba "Iniciar sesión" veía un formulario en vez de su portal. Añadido
    el redirect y su test (verificado: el test se pone rojo si se quita el fix). (b)
    `resolvePostLoginRoute` quedó `async` sin ningún `await` al dejar de usar `effectiveAdminRole`;
    ahora es síncrona.
  - **E2E:** nuevo `e2e/login-fanout.spec.ts` (7 tests) — el único spec que pasa por el formulario
    de verdad; el resto entra con `storageState`. `e2e/global-setup.ts` ahora siembra `role_chosen`
    (faltaba: sin él las cuentas de prueba acababan en `/elegir-rol`) y una cuenta de paciente.
  - Archivos: `lib/postLogin.ts` (nuevo), `pages/login.tsx` (nuevo), `e2e/login-fanout.spec.ts`
    (nuevo), `pages/mi-caso.tsx`, `pages/login-medico.tsx`, `pages/admin/index.tsx`,
    `pages/auth/callback.tsx`, `pages/index.tsx`, `pages/panel-medico*`, `pages/registro-medico.tsx`,
    `lib/admin.ts`, `components/auth/AuthField.tsx`, `e2e/global-setup.ts`, docs.
  - Artefactos SDD del cambio en `tasks/` (`spec.md`, `plan.md`, `todo.md`).
- **Docs:** `CLAUDE.md`/`AGENTS.md` afirmaban que no había harness E2E — falso desde que existe
  `playwright.config.ts` + 11 specs. Corregido, y documentado que `pnpm build` con un `next dev`
  vivo sobre el mismo `.next` corrompe el dev server.

## 2026-08-13

- **Refrescamiento del home — completo (T1 a T11)** — primera mitad del
  rediseño del home según `.knowledge/spec-home-refresh.md` y `tasks/todo.md`. **Solo el home**: el resto del
  sitio no cambia.
  - **T1 assets:** `nueva/oriana.jpg` (5,0 MB, 3117 × 4675) → `public/img/hero-interconsulta.webp`
    de **32 KB** a 960 × 1120 con recorte `north`, reproducible con
    `scripts/optimize-hero-image.mjs`. Se midieron 6 variantes antes de elegir WebP q70 (AVIF q45
    pesaba menos pero WebP lo soporta todo navegador vigente). Los 5 logos SVG y la fuente a
    `public/brand/`. El original NO se versiona en `public/`.
  - **T2 tokens:** 8 tokens `--h-*` y la `@font-face` bajo `.home-theme`, siguiendo el patrón
    `.patient-theme` que ya existía. El cambio en `styles/globals.css` es **puramente aditivo**
    (0 líneas eliminadas) y `:root` queda intacto: comprobado que `--h-navy` sale vacío en `:root`
    en `/`, `/login-medico`, `/panel-medico` y `/admin`.
  - **T3 movimiento:** `usePrefersReducedMotion()` en `lib/hooks.ts` y `useReveal`/`useCountUp` en
    `components/home/motion.ts`, sin dependencias nuevas. Doble capa a propósito: el CSS apaga el
    movimiento desde el primer frame y el hook solo puede saberlo tras hidratar.
  - **T4 navbar y footer:** `components/home/{Navbar,Footer,copy}.tsx`. `pages/index.tsx` pasa de
    1313 líneas a composición (el home viejo sigue en `git show origin/dev_aws:pages/index.tsx`).
    **Ningún `href="#"`**: lo que aún no existe (Especialistas, Blog) se pinta como
    `<span aria-disabled>`, no como enlace muerto.
  - **Fallo encontrado en verificación y corregido:** styled-jsx añade su clase de scope a los
    elementos nativos del JSX pero **no a los componentes** (`Link`, `Image`). `.marca`, `Únete`,
    `Ingresar` y los tres enlaces de "Plataforma" del footer quedaban sin estilo — navy sobre navy,
    invisibles en pantalla. Resuelto con `:global()` acotado siempre por un ancestro sí scopeado.
    El home anterior no lo sufría porque navegaba con `<button onClick={router.push}>` en lugar de
    enlaces reales.
  - **T5 hero:** `components/home/Hero.tsx`. Split a dos columnas con el gesto mayor acordado —
    seis bloques de texto entrando a 0/60/120/180/240/300 ms y la foto con `scale(1.06) → 1` de
    0,9 s. Con `prefers-reduced-motion: reduce` no se mueve nada (medido: 1e-05s y `transform`
    identidad). La foto va por `next/image` con `priority` y `sizes`: en móvil descarga **10 KB**
    (w=384) y en escritorio 22 KB (w=750), una sola variante por viewport. El `alt` del prototipo
    ("Dos médicos venezolanos") se reescribió porque la foto es de **una** médica sola.
  - **Defecto corregido en T5:** los separadores de las métricas eran `<span>` y al envolverse la
    fila dejaban una rayita colgando — a 360, 480 **y 1100 px**, este último con pantalla ancha y
    columna estrecha. Ahora son `border-left` bajo una **container query** sobre el ancho de la
    columna: un breakpoint de viewport no podía cubrir ese caso. Comprobado en 13 anchos de 320 a
    1920 px sin scroll horizontal.
  - **Tipografía, bloqueo resuelto:** el equipo aportó Nunito Sans como **fuente variable**
    (`wght 200..1000`). Antes solo existía la estática Bold y, al ser la única cara de la familia,
    el emparejador CSS la usaba para todos los pesos: medido, 300 a 900 renderizaban el mismo
    ancho exacto (606,44 px) y el home no tenía jerarquía tipográfica. Ahora miden 450,13 / 457,92
    / 465,83 / 475,11 / 485,55 / 496,23. `scripts/build-fonts.mjs` fija los ejes que no usamos
    (wdth, opsz, YTLC) y recorta a latin + flechas: **28 KB** la redonda y 30 KB la itálica real,
    frente a los ~160 KB que habrían costado cuatro estáticas. `OFL.txt` viaja con los ficheros,
    como exige la licencia. La declaración usa `font-weight: 200 1000`: con un peso suelto el
    navegador vuelve a tratar la familia como de una sola cara.
  - **T6 puertas de entrada y cierre:** `components/home/Puertas.tsx` y `CtaFinal.tsx`. Las 6
    tarjetas se visitaron una a una en la verificación: las 6 devuelven HTTP 200 y ninguna cae en
    la 404. El hover pinta el filete azul en 0,15 s, y también con `:focus-visible`. La de "Soy
    médico en Venezuela" apunta al registro porque hoy **no existe** flujo público de
    interconsulta; anotado en el código y pendiente con las owners. El cierre va sobre navy: el
    prototipo lo monta sobre una foto que no está entre los assets entregados.
  - **Tres defectos corregidos en T6:**
    1. Sin JavaScript, las secciones con `useReveal` se quedaban en `opacity: 0` **para siempre**
       — el texto estaba en el HTML pero era invisible para una persona. Un `<noscript>` neutraliza
       `.reveal`; es el único caso que no puede resolverse desde JS.
    2. Con la navbar fija de 76 px, saltar a un ancla dejaba la cabecera de la sección tapada. Se
       añadió `scroll-margin-top: var(--h-navbar)` a todo `[id]` del home. El 76 estaba duplicado
       en JS dentro de `Navbar.tsx`: ahora es un token con una sola fuente.
    3. El cierre usaba `auto-fit` y a 768 px seguían entrando 3 columnas mientras la media query
       aplicaba los bordes del apilado. Mismo error que con las métricas del hero: mezclar layout
       intrínseco con breakpoint de viewport. Ahora el número de columnas es explícito.
  - **T7 Quiénes Somos + Valores:** `components/home/QuienesSomos.tsx` y `Valores.tsx`. El ancla
    del navbar deja la sección justo bajo la barra, ambas revelan al entrar en pantalla, y "Conoce
    nuestra historia →" va como `<span aria-disabled>` porque esa página está fuera de alcance.
    Faltan dos assets del prototipo (la foto de 460 px de Quiénes Somos y las cuatro fotos
    circulares de los valores): la sección va a una columna con el ancho de lectura limitado y los
    valores solo en texto.
  - **T8 Cómo Funciona:** `components/home/ComoFunciona.tsx`, la única sección con estado. Tres
    pestañas con cuatro pasos cada una, arrancando en paciente. Es un `tablist` de verdad, no tres
    botones que cambian un div: roles y `aria-*` enlazados por id, **roving tabindex** (se llega en
    un salto de tabulador y desde la pestaña activa otro Tab lleva al panel), flechas con vuelta
    circular, Home/End y Enter/Espacio. Fundido de entrada de 200 ms, a ~0 con `reduce` y con el
    panel visible. No es un cross-fade literal: superponer paneles de distinta altura daría saltos
    de maquetación.
  - **Auditoría de accesibilidad con axe-core (WCAG 2.1 AA).** Se auditaron 7 estados: el home a
    1440/768/360, con el menú móvil abierto, con la tercera pestaña de Cómo Funciona activa, y las
    dos pantallas de registro. Partía de **18 violaciones**; el home quedó en **0** en los cinco
    estados (43 reglas pasadas cada uno). Lo corregido:
    - **Contraste: 45 nodos por debajo del 4,5:1.** El prototipo pone texto de 10-11 px en blanco
      al 25-45 % sobre fondos oscuros; el peor daba **2,28:1**. Se calcularon los mínimos reales
      (blanco al 46 % sobre `--h-navy`, al 55 % sobre `--h-blue-deep`) y se crearon dos tokens,
      `--h-sobre-oscuro-medio` (80 %) y `--h-sobre-oscuro-tenue` (62 %), para no aplanar la
      jerarquía. El azul de marca como texto pequeño da 3,38:1 sobre navy: se añadió
      `--h-blue-claro` (#3d8bff, 4,95:1) para ese caso, y sobre fondo claro se usa `--h-blue-dark`
      (6,20:1 frente al 4,41:1 del azul base). **Es una desviación visible del prototipo** — las
      secciones oscuras quedan más claras — pero 2,28:1 en una web para pacientes no es defendible.
    - **`<html lang="es">`**: no existía `pages/_document.tsx`, así que el sitio **entero** servía
      `<html>` sin idioma. Un lector de pantalla leía el español con fonética inglesa. Es un fallo
      de nivel A (WCAG 3.1.1) y afectaba a las siete páginas auditadas, no solo al home.
    - **Menú móvil fuera de landmark**: pasó de `<div>` a `<nav aria-label>`.
    - **`.hint` a 3,54:1**: corregido con el gris de marca, acotado a las dos pantallas de registro
      para no tocar el panel ni el admin.
  - **Hallazgo crítico NO corregido (fuera de alcance):** en `/registro-paciente` y
    `/registro-medico`, **21 de 25 campos no tienen nombre accesible**. Las etiquetas visibles
    existen pero no están asociadas (sin `id`/`htmlFor` ni `<label>` envolvente), así que un lector
    de pantalla anuncia "cuadro de edición" sin decir qué se pide — en el formulario por el que un
    paciente pide atención médica. Arreglarlo exige tocar el marcado de esas páginas, y el encargo
    era "solo colores y tipografía". **Merece su propia rama.**
  - **T10 re-tematizado de las pantallas de registro:** `/registro-paciente` y `/registro-medico`
    adoptan la paleta y la tipografía nuevas **sin que cambie una sola línea de esas dos páginas**
    — `git diff` de ambas está vacío. Se hizo redefiniendo tokens dentro de sus clases de tema, que
    es el patrón que ya usaba `.patient-theme`. Incluso el enlace con
    `style={{ color: 'var(--home-blue)' }}` de `registro-medico` se resolvió redefiniendo ese token.
    Se quitaron las cuatro reglas propias que usaban el azul y el dorado del home **antiguo**: con
    `--green` apuntando al azul de marca, el `.btn-primary` por defecto ya da el botón correcto.
    Comprobado que `/panel-medico`, `/admin`, `/mi-caso` y `/login-medico` siguen exactamente igual
    (fuente de sistema, `--green: #0f6e56`) y que `:root` es byte a byte el de HEAD.
  - **T11 verificación final — los 10 criterios del spec, medidos:** (1) las 12 secciones en el
    orden del prototipo; (2) las tres puertas a `/registro-paciente`, `/registro-medico`,
    `/registro-medico`; (3) 23 enlaces, **0 muertos y 0 anclas rotas**; (4) foto del hero de
    **32 KB** a 960 × 1120 (2× del hueco de 480 × 560); (5) métricas del hero en **+2.000**;
    (6) `:root` sin cambios; (7) panel y admin idénticos; (8) con `prefers-reduced-motion: reduce`,
    **0 elementos con animación viva y 0 ocultos**; (9) `tsc`, `lint`, `format:check` y `build` en
    verde sin warnings nuevos; (10) **E2E 11/11**.
  - **E2E: 8 specs estaban en rojo y no por este trabajo.** `POST /consultations` empezó a exigir
    `specialty_id` (cambio de backend de esta misma sesión) y los specs creaban las consultas solo
    con `patient_id`: 422 → el `id` llegaba `undefined` → fallo en cascada en todo lo que dependía
    de esa consulta. Se añadió `e2e/helpers.ts` con `idEspecialidadGeneral()`, que lee una
    especialidad real del catálogo (el UUID cambia por entorno, no se puede fijar en el código), y
    los 8 puntos de creación la pasan. Suite completa en verde.
  - **T9 Especialistas + Testimonios + Impacto + Blog:** las cuatro rejillas que cierran el cuerpo
    del home. Con esto **las doce secciones del prototipo están montadas**. Verificado sobre el
    home completo: **23 enlaces, ninguno muerto** (0 con `href` vacío o `#`), las 7 anclas
    resuelven, y los 5 CTA sin destino son texto con `aria-disabled`, no enlaces.
  - **Placeholders sin inventar datos.** Los 6 perfiles de Especialistas y las 3 tarjetas de Blog
    son placeholder declarados como tales en el copy. No llevan nombres de médicos ni titulares de
    artículos inventados: una tarjeta con un nombre y una especialidad plausibles junto a un
    "✓ Verificado" es una credencial falsa aunque sea de mentira para maquetar, y esta organización
    se define por verificar a sus médicos. Dicen "Perfil por publicar / Especialidad / País".
    **⚠️ No pueden publicarse así.** Los testimonios, en cambio, son las 6 citas reales del copy, y
    van sin la foto circular del prototipo porque son pacientes anónimos.
  - **Fallo corregido en la primitiva de movimiento (T3):** `useCountUp` arrancaba en 0, así que el
    servidor pintaba "+0" y sin JavaScript las cifras de impacto se quedaban en cero — números
    falsos en la sección que argumenta el impacto. Ahora arranca en el valor final y la animación
    baja a 0 solo cuando el observer dispara. Es el mismo tipo de fallo que el `.reveal` invisible
    sin JS: una animación que decide el contenido en vez de solo su entrada.
  - **Auditoría de copy (respuesta a "¿todo lo escrito está en el copy?"):** de las 78 cadenas
    visibles del home, **67 salen del `.docx` y 11 no**. Del prototipo y no del copy:
    "Interconsulta en curso", "24/7", "Disponible · Confidencial", la numeración "01/02/03" de las
    puertas, y "Plataforma", "Organización", "Contacto", "Ser voluntario", "Interconsulta médica"
    del pie — "Contacto" e "Interconsulta médica" no aparecen en el `.docx` en absoluto. Aparte:
    "+2.000" (decisión del equipo, el copy dice +3.000) y el `alt` de la foto más los `aria-label`,
    que un documento de copy no cubre pero un lector de pantalla sí lee. Todas viven en `copy.ts`,
    con la lista anotada en su cabecera.
  - **Copy: el prototipo va por detrás del `.docx`.** Los valores del prototipo son Calidad /
    Credibilidad / Autonomía / Gratuidad; los del copy aprobado son Verificados / Autónomos /
    Gratuitos / **Confidenciales** — no es solo un cambio de nombre, uno de los cuatro conceptos es
    distinto. Lo mismo pasa con las descripciones de las tres puertas. Queda escrita la regla en
    `copy.ts`: **el texto sale del `.docx`, la maqueta sale del prototipo**. El copy quedó
    confirmado como aprobado el 2026-08-13.
  - **Colisión de nombres de clase (encontrada al revisar el hero):** `globals.css` ya tenía
    `.hero` y `.badge` del sitio anterior. Una regla scopeada de styled-jsx solo gana en las
    propiedades que declara, así que el hero heredaba en silencio `padding: 40px 24px`,
    `border-radius: 24px` y `color: white` de una, y `border-radius: 999px` de la otra. Renombradas
    a `.portada` y `.rotulo`: las demás clases del home no chocaron por estar en español. Regla
    anotada en `Hero.tsx` para las secciones que faltan.
  - **`nueva/` al `.gitignore`:** es material de referencia (prototipo de 10 MB, copy, foto de
    5 MB, fuentes TTF) y no se versiona. Lo que el sitio necesita ya está derivado en `public/`.
  - **Nota ajena a este trabajo:** `pnpm build` **ya venía rojo desde la base** por
    `e2e/global-setup.ts(53,46) TS2339` (`list.data.users` se infiere `never[]`, tipos de
    `@supabase/supabase-js`). Excluyendo `e2e` del typecheck el build compila y genera las 23 rutas.
    No se toca aquí: merece su propia rama.
  - Archivos: `components/home/` (nuevo), `pages/index.tsx`, `styles/globals.css`, `lib/hooks.ts`,
    `scripts/optimize-hero-image.mjs`, `public/brand/`, `public/img/`, `tasks/`,
    `.knowledge/spec-home-refresh.md`.

## 2026-07-21

- **Front deja de depender de la vista `profiles` (migración profiles → users)** — se eliminaron
  TODOS los `supabase.from('profiles')` y las RPC `set_my_role` del front, para poder dropear la
  vista de compatibilidad `public.profiles`. Migrado al **backend API** donde hay endpoint:
  `pages/admin/index.tsx` (login) y `pages/panel-medico/consulta/[id].tsx` (perfil propio) →
  `GET /auth/me`; la ficha del médico asignado en esa consulta → `GET /profiles/{id}`;
  `pages/elegir-rol.tsx` (`set_my_role` ×2) → `POST /profiles/me/finalize-role`;
  "Revocar acceso" en `pages/admin/doctores.tsx` → `PATCH /profiles/{id}/active`. Nuevos clientes en
  `lib/users.ts` (`fetchProfile`, `setProfileActive`, `finalizeMyRole`). Donde el API aún **no**
  tiene endpoint equivalente, se pasó a leer la **tabla core `public.users`** directo (misma RLS/
  grants, deja de nombrar la vista) con un `TODO`: lecturas propias que necesitan `role_chosen`
  (`login-medico`, `mi-caso`, `auth/callback`, chequeo inicial de `elegir-rol`), autores del
  historial por lista de ids (`consulta/[id]`), y la lista staff paginada + buscadores + carga masiva
  del admin (`doctores.tsx`, `pacientes.tsx`) que dependen de filtros (estado, fechas, conteo exacto,
  doctor+specialist) que `GET /profiles` todavía no expone. En `supabase_schema.sql` se sincronizaron
  las 5 funciones (`handle_new_auth_user`, `set_my_role`, `current_user_role`, `mark_myself_online`,
  `admin_delete_patient`) para nombrar `public.users`. El `drop view public.profiles` queda listo pero
  aparte en `migrations/drop_profiles_view.sql` — se ejecuta **solo tras desplegar este front** y en
  coordinación con el repo del API. `mark_myself_online` ya no la llama nadie en el front (confirmado).

- **Admin: guard sin acceso directo a Supabase + pool "online" por Presence** — `useAdminGuard`
  (`lib/admin.ts`) dejó de leer la tabla `profiles` directo de Supabase y ahora pide el perfil al
  backend (`GET /api/v1/auth/me`), manteniendo el rol efectivo RBAC (`effectiveAdminRole`). Y el
  pool de médicos se migró a **Realtime Presence**: el KPI "Médicos online" del dashboard
  (`pages/admin/dashboard.tsx`) ahora es clickeable y abre el `DoctorPoolModal` en la pestaña "En
  línea", que resuelve el estado online por Presence (`online_ids` que ya mandaba el cliente), no
  por el `last_seen_at` del backend (que quedó vestigial al migrar la presencia a WebSocket). Así
  el conteo del KPI y la lista del pool coinciden, y de paso se arregla el "En línea" del pool en la
  página de consulta. Requiere el cambio par en el backend (`GET /doctors/pool` acepta `online_ids`).

## 2026-07-20

- **Admin: dashboard sobre el backend + monitor de consultas en progreso** — el dashboard
  (`pages/admin/dashboard.tsx`) migró sus KPIs a `GET /api/v1/stats/dashboard` del backend
  (`lib/stats.ts`), reemplazando las 7 consultas directas a Supabase; se refresca con polling cada
  30s vía `usePolling` (`lib/hooks.ts`, sin `useEffect` crudo). **Excepción: "Médicos online" sigue
  en vivo por Realtime Presence** (`useOnlineDoctors` de `lib/presence.tsx`), no por el
  `doctors_online` (last_seen_at) del backend, para no perder la presencia real por WebSocket. Se
  agregó `components/admin/ConsultationsMonitorModal.tsx`, un modal de solo lectura para el KPI
  "Consultas en progreso" con el detalle de cada caso (médico, paciente, tiempo transcurrido,
  motivo), y un botón "Ver médicos conectados" que abre el modal ya existente `DoctorPoolModal`.
  Files: `pages/admin/dashboard.tsx`, `components/admin/ConsultationsMonitorModal.tsx`,
  `components/admin/AdminLayout.tsx`, `lib/consultations.ts`, `lib/hooks.ts`.

## 2026-07-15

- **Fix login colgado en "Entrando…" (deadlock de auth)** — `lib/presence.tsx`: el callback de
  `supabase.auth.onAuthStateChange` era `async` y `await`-eaba `getSession()`/`fetchMyProfile()`
  DENTRO del callback. auth-js despacha ese callback mientras retiene su lock interno de auth, así
  que al re-entrar el lock deadlockeaba la propia llamada que disparó el evento: en un login,
  `signInWithPassword` nunca resolvía y el botón se quedaba en "Entrando…" para siempre (reportado
  en `/login-medico`; afectaba a cualquier flujo de auth porque `PresenceProvider` envuelve toda la
  app en `_app.tsx`). Ahora el callback difiere el trabajo con `setTimeout(resolve, 0)` para correr
  FUERA del lock (guía oficial de Supabase), con un guard `disposed` extra al desmontar.

## 2026-07-14

- **E2E del registro completo de paciente** — `e2e/registro-paciente.spec.ts`: formulario adulto
  por la UI (zod, cédula/teléfono con prefijos, catálogo de zonas, signup de Supabase) →
  `/sala-espera` con el botón de videoconsulta y el aviso de WhatsApp. Es la capa que estuvo
  rota en producción sin detección; con este spec la cadena entera queda con red automática.
- **"Atender por videoconsulta" crea la sala si falta** — un caso sin `video_room_url` (tomado
  por WhatsApp y liberado, sembrado por API, o creado en prod mientras el hosting rompía la
  creación) dejaba al médico sin link y sin el botón "Unirse" en el detalle. Ahora
  `openConsultation` llama a `ensureVideoRoom` (backend, idempotente) ANTES del claim (el
  backend solo crea la sala mientras el caso está en espera) — sana también las consultas de
  prod que quedaron sin sala. E2E nuevo `e2e/panel-atender-video.spec.ts` (caso sin sala →
  popup con la sala Jitsi + "Unirse a videoconsulta" visible en el detalle). Files:
  `pages/panel-medico.tsx`.
- **Fix multi-rol en el acceso admin + videoconsulta del paciente vía backend** — dos regresiones
  de producción:
  - **Multi-rol RBAC**: el guard de `/admin/*`, el login `/admin` y el callback de Google solo
    miraban `profiles.role` (UN rol legacy) — un usuario "doctor primero + super_admin después"
    (RBAC en `user_roles`) rebotaba al login. Nuevo `effectiveAdminRole()` en `lib/admin.ts`: si
    el legacy no alcanza, consulta `GET /auth/me/permissions` y usa el rol RBAC más alto; el
    perfil del guard expone ese rol efectivo (así `isSuperAdmin` y toda la UI admin funcionan
    para duales). Un dual que entra por Google aterriza en el dashboard, como un admin puro.
  - **Videoconsulta del paciente**: `/api/videoconsulta` (API route de Next) moría con 500 en
    Amplify (falta del service_role en el hosting) → el catch lo tragaba → sala-espera sin sala →
    el paciente caía SIEMPRE al fallback de WhatsApp y la consulta quedaba sin `video_room_url`
    (por eso "desapareció" el botón Unirse a videoconsulta del detalle). Ahora la sala la crea el
    BACKEND: `ensureVideoRoom()` en `lib/patients.ts` → `POST /consultations/{id}/video-room`
    (público e idempotente, ya existía) — se elimina la dependencia del service_role en el
    frontend. La ruta de Next queda muerta (conserva el Twilio parked para el futuro).
  - **Sala de espera**: aviso nuevo bajo el botón de video — también pueden contactarlo por
    WhatsApp al número registrado.
  - E2E nuevos: `admin-multirol.spec.ts` (usuario dual sembrado en global-setup: legacy doctor +
    super_admin en user_roles → dashboard y usuarios cargan sin rebotar) y `sala-espera.spec.ts`
    (el backend genera la sala por el mismo endpoint del registro; botón de video + aviso de
    WhatsApp visibles). Files: `lib/{admin,patients}.ts`, `pages/admin/index.tsx`,
    `pages/auth/callback.tsx`, `pages/registro-paciente.tsx`, `pages/sala-espera.tsx`,
    `e2e/{global-setup,admin-multirol.spec,sala-espera.spec}.ts`.
- **Buscador en `/admin/usuarios`** — con ~3000 usuarios, paginar sin buscar era inservible:
  input de búsqueda por **nombre o email** (server-side, `GET /profiles?search=` con ILIKE que el
  backend ya soportaba) con debounce de 300ms y reset a la primera página; el término se conserva
  al cambiar el filtro de rol y al paginar. E2E nuevo `e2e/admin-usuarios-buscador.spec.ts`
  (filtra por email, por nombre, y limpiar restaura el listado). Files: `lib/users.ts`,
  `components/admin/UsersManager.tsx`.
- **Port selectivo de main (PRs #27/#29) + Páginas aliadas** — main y dev_aws habían divergido;
  decisión: dev_aws manda, y de main se trae solo lo que faltaba:
  - KPIs del panel médico partidos (PR #27) recreados con la presencia real: "En videollamada
    ahora" (heartbeat vivo, misma ventana que el badge "● En sala") y "Sin atender (+20 min)".
  - `eligibleSpecialties()` en `lib/utils.ts` (matchesSpecialty ∩ canAttend, respeta la reserva
    de psicología) + línea "La pueden atender" por caso en la tabla admin de pacientes.
  - **El admin re-rutea un caso editando su Especialidad** (`consultations.specialty_id`, la
    columna con la que la consulta matchea con el médico — el registro del paciente ya la setea;
    sin el override `required_specialties` de main, que se descartó): select con el catálogo real
    del backend en Gestionar caso, y el cambio queda en el evento `admin_update`. La línea "La
    pueden atender" de la tabla muestra la especialidad asignada, con fallback a las derivadas
    del tipo/necesidades (`eligibleSpecialties`) para casos viejos sin `specialty_id`.
  - **El matching médico↔consulta ahora es por `specialty_id`** (regla exacta, en ambos repos):
    el backend resuelve el nombre (join a `specialties`) y lo expone en `GET /consultations/panel`
    (`specialty`); `attend-next` (backend) y el KPI "Esperando para tu especialidad" +
    "Atender al siguiente" (frontend, `matchesConsultation`/`canAttendConsultation` en
    `lib/utils.ts`, espejo de `src/services/specialties.py`) prefieren la igualdad exacta de
    especialidad. La reserva de psicología se mantiene (un caso Psicología/Psiquiatría solo va a
    esas dos; Psicología solo salud mental); un caso físico explícito lo puede tomar cualquier
    no-psicólogo (la coincidencia es preferencia, no bloqueo). `category`/needs quedan de
    **fallback** para consultas viejas sin especialidad. Tests backend nuevos
    (`test_attend_next_prefiere_specialty_id_sobre_fifo`,
    `test_attend_next_reserva_psicologia_por_specialty_id`, panel con `specialty` resuelta).
  - **Sección "Páginas aliadas"** en la landing (nav + `#aliadas` + estilos), portada del MVP:
    8 grupos de organizaciones externas (donaciones, niños, salud, comida, veterinaria, registro,
    ingenieros, desaparecidos).
  - Lo demás de main quedó descartado a propósito: cierre por dropdown (dev_aws usa botón con
    guardas), gate/split por `entered_call_at` (dev_aws es realtime + presencia) y el flujo
    `contact_preference` (PR #30, requerimiento cambiado).
  - E2E nuevo `e2e/admin-especialidad.spec.ts` (select con catálogo + persistencia + fila);
    `panel-race` ahora scopea los botones a la card de su paciente (blindado contra otros casos
    en espera). Files: `lib/{utils,admin}.ts`, `pages/panel-medico.tsx`,
    `pages/admin/pacientes.tsx`, `pages/index.tsx`, `e2e/{admin-especialidad,panel-race}.spec.ts`.
- **Fixes del segundo code review (PR #40, tras rebase sobre dev_aws)** — hallazgos de la
  re-revisión multi-agente sobre la rama rebasada, todos aplicados:
  - `updateStatus` usa functional update (`setConsultation(prev => …)`): antes pisaba con el
    objeto capturado los campos que Realtime aplicó durante el `await` (p.ej. un cierre de admin).
  - `closeConsultation` hace **escritura condicional** (`.not('status','in',FINAL_STATUSES)` +
    `.select()`): si otra persona finalizó el caso mientras `window.confirm` bloqueaba, afecta 0
    filas, avisa y no pisa `closed_at` ni registra evento.
  - El botón "Unirse a videoconsulta" de arriba se oculta en casos finalizados (`!isCaseClosed`).
  - `ConfirmDialog` compartido (catálogos/usuarios) ahora cierra con Escape y enfoca "Cancelar"
    al abrir — paridad con el `window.confirm` al que reemplazó y con el resto de modales.
  - El aviso de catálogos del pool vive en su propio estado (`catalogError`): el `setError('')`
    de cada recarga de la lista ya no lo borra.
  - `useEscapeToClose` ignora Escape dentro de un `input type="search"` con texto (la acción
    nativa de Chrome/Edge es limpiar el campo; limpiar no debe cerrar el modal).
  - E2E nuevo `e2e/consulta-cerrada.spec.ts`: caso finalizado muestra el aviso y oculta cierre y
    video; la confirmación de no-show existe. Files: `pages/panel-medico/consulta/[id].tsx`,
    `components/DoctorPoolModal.tsx`, `components/admin/ConfirmDialog.tsx`, `lib/hooks.ts`.
  - (En el backend, mismo review: anti-IDOR también en `POST /consultations/{id}/events`, PATCH
    ya no asigna consultas para no-admins — tomar es solo vía claim atómico —, `doctor_id`
    server-only, trigger `BEFORE TRUNCATE` en `audit_log`, test de paginación determinista y
    `dev.ps1` resuelve el contenedor por nombre exacto.)
- **Docs sincronizadas con la realidad** — la presencia del médico es Realtime Presence (no
  heartbeat/`mark_myself_online`), la cola del panel es Realtime (no polling), y el video corre en
  el Jitsi self-hosted `meet.medicosporvenezuela.org` (el público `meet.jit.si` exige moderador;
  ya no es fallback). Se corrigieron `CLAUDE.md` (RPCs, servicios, security notes, lecciones de
  review), `README.md` (RPCs, stopgap de Jitsi, panel, env), `.env.example`, y en el backend
  `.knowledge/business-logic.md` (§1 cola realtime + claim, §4 presencia dual, §7 Jitsi, estado
  de portado) y `.claude/rules/{security,fastapi_skills}.md`.
- **Videoconsulta: fix "no moderators have yet arrived"** — las salas se generaban en el público
  `meet.jit.si`, que hoy obliga al primero en entrar a loguearse como moderador (de ahí el error
  para paciente y médico). El default de dominio ahora apunta a nuestra instancia self-hosted
  **abierta** `meet.medicosporvenezuela.org` (override con `NEXT_PUBLIC_JITSI_DOMAIN` /
  `JITSI_DOMAIN`). Además `browserRoomUrl` **sana** salas legacy ya guardadas en `meet.jit.si` al
  abrirlas — es el único punto por donde paciente (`sala-espera`) y médico (`consulta/[id]`) abren
  la sala, así que no hace falta migrar datos. Archivos: `lib/jitsi.ts`; backend
  `src/core/config.py`. Nota: la videollamada real requiere HTTPS + cámara/mic, no corre en
  `http://localhost`.

## 2026-07-10

- **Admin: pantalla Usuarios (multi-rol RBAC)** — nueva página `/admin/usuarios` para el nuevo
  sistema RBAC de `api-medicos-por-venezuela` (crear usuarios y otorgar/revocar roles),
  independiente del mecanismo Supabase de un solo rol (`profiles.role`) que sigue usando
  `doctores.tsx` ("Revocar acceso") — no se tocó ese archivo. La UI se gatea por
  `GET /auth/me/permissions` (crear usuario solo si `users.create`, gestión de roles solo si
  `roles.assign`; `super_admin` solo aparece asignable/revocable si el propio usuario ya lo tiene);
  `initial_role` en el formulario de creación siempre excluye `super_admin` (el backend lo rechaza
  siempre). El listado de `/profiles` no trae total, así que la paginación es anterior/siguiente
  por `skip`/`limit`. De paso se corrigió un bug en `lib/apiClient.ts`: los errores 422 de pydantic
  (`detail` como arreglo de `{msg}`) se renderizaban como `(422)` genérico en vez del mensaje real
  por campo — ahora un helper `detailMessage` compartido por `getJson`/`sendJson`/`deleteJson` los
  une en un string legible. Files: `lib/apiClient.ts`, `lib/users.ts` (nuevo),
  `components/admin/UsersManager.tsx` (nuevo), `pages/admin/usuarios.tsx` (nuevo),
  `components/admin/AdminLayout.tsx` (nav). Verificado con `tsc --noEmit`, `pnpm lint` y
  `pnpm build` (sin errores/warnings nuevos).
- **Fixes post-review (mismo cambio)** — `review-risk` detectó que "Revocar" no gateaba
  `super_admin` igual que el select de asignar (ahora exige `canGrantSuperAdmin` en ambos lados);
  `review-readability` detectó un cast inseguro que dejaba que `initial_role` mostrara roles fuera
  de `patient|doctor|admin` si el catálogo del backend cambiaba (ahora se intersecta siempre contra
  la unión fija), un `useEffect` inicial que duplicaba el fetch de `loadUsersPage`, y magic numbers
  de validación sin nombre. También se sanitiza el `detail` de un 422 antes de adjuntarlo al
  `ApiError` (pydantic devuelve el valor enviado, incluida la contraseña, en `input`).
- **Fixes de QA manual (mismo cambio)** — probado en vivo contra el stack local de
  `api-medicos-por-venezuela`: se extrajo `components/admin/ConfirmDialog.tsx` (modal centrado,
  mismo estilo que el diálogo de borrado ya existente en `pages/admin/pacientes.tsx`) y se usa en
  vez del `window.confirm()` nativo tanto en `CatalogManager.tsx` (eliminar catálogo) como en
  `UsersManager.tsx` (revocar rol); se aflojó el spacing del panel "Gestionar roles" (cramped por
  padding/gaps chicos) usando badges para los roles asignados. Verificado visualmente con
  Playwright contra el stack local. También se agregó la clase `users-table` (ya usada en
  `doctores.tsx`, da `min-width: 720px` en `globals.css`) a la tabla de `UsersManager.tsx` — sin
  ella, en viewports chicos las columnas se apretaban en vez de habilitar scroll horizontal. Files:
  `components/admin/ConfirmDialog.tsx` (nuevo), `components/admin/CatalogManager.tsx`,
  `components/admin/UsersManager.tsx`.
- **Mi Perfil: médicos de Google completan su cédula + verificación en vivo SACS/FPV** — cierra
  los comentarios #2 y #3 de la revisión, alineado al contrato nuevo del backend `/doctors/me`.
  (1) `pages/panel-medico.tsx`: un médico (no-admin) sin cédula — cuenta de Google que eligió rol
  médico, `source:"user"` — es **redirigido automáticamente a `/panel-medico/perfil`** al entrar al
  panel, para completar su registro. (2) `pages/panel-medico/perfil.tsx`: se **desbloquea** la
  cédula para `source:"user"`, se agrega un `select` **Tipo de profesional** (habilita la cédula y
  decide SACS vs FPV) y **verificación en vivo** al teclear la cédula (autocompleta nombre/licencia,
  como en el registro); el `PATCH` manda `professional_type_id` junto con la cédula para que el
  backend cree la ficha. Maneja el caso de cédula no verificada (`verified:false`, no bloquea) y
  el `422`/`409`. (3) `lib/doctors.ts`: `DoctorMeResponse` gana `professional_type_id`/
  `professional_type`; `DoctorSelfUpdate` gana `professional_type_id`. Docs: `CLAUDE.md` (auth model
  - ruta). Verificado con `tsc`, `lint` y `build`.
- **Mi Perfil (médico): campo de cédula reordenado y con selector V/E** — en
  `pages/panel-medico/perfil.tsx` la **cédula pasa a ir primero** (antes del nombre completo) y el
  prefijo **V/E ahora es un `select` + input numérico**, replicando el patrón de
  `registro-medico.tsx`. La baseline `profile.cedula` (`"V-12345678"`) se descompone al hidratar
  (`parseCedula`) y se recompone al guardar. Verificado con `tsc --noEmit`. Files:
  `pages/panel-medico/perfil.tsx`.
- **Rebase de la rama sobre `dev_aws`** — los 2 commits del perfil self-service del médico
  (`/panel-medico/perfil` vía FastAPI `/doctors/me`) se rebasaron de `dev` a `dev_aws`, resolviendo
  conflictos en `lib/apiClient.ts`, `lib/doctors.ts`, `CLAUDE.md`, `AGENTS.md` y
  `pages/panel-medico.tsx` conservando la superficie amplia de `dev_aws`. PR #42 → `dev_aws`.

## 2026-07-09

- **Fixes del code review (PRs #38/#39)** — hallazgos de la revisión multi-agente, todos aplicados:
  - `waNumber` (DoctorPoolModal) normaliza formatos reales: `"+58 0414…"` ya no genera
    `wa.me/58041…` (roto); quita `00` internacional y el `0` nacional pegado al 58.
  - **"Paciente no estaba en la sala" ahora pide confirmación** (finalizaba el caso con un tap)
    y ya **no persiste la nota sin guardar** del textarea al cerrar por ausencia.
  - **Casos finalizados** (`closed`/`patient_no_show`/`closed_by_admin`/`cancelled`): se ocultan
    el select de estado (que "mentía" mostrando Abierta) y los botones de cierre — solo queda la
    nota editable, con un aviso. Evita re-cerrar pisando `closed_at`.
  - **Modales accesibles**: Escape cierra (hook `useEscapeToClose` en `lib/hooks.ts`) y el foco
    entra al modal al abrir (pool + confirmación de borrado en admin/pacientes).
  - Plurales: "especialidades" y "zonas afectadas" (antes "especialidads"/"zona afectadas").
  - Tipos de Profesionales (admin) usa el nuevo `GET /professional-types/admin` del backend; el
    público ahora solo trae activos → **desactivar un tipo por fin lo oculta del registro**.
  - Menores: rama muerta `'closed'` en `updateStatus`, estados muertos en `pacientes.tsx`,
    doble fetch del pool al cambiar tab, error visible si fallan los catálogos del pool,
    botones deshabilitados durante escrituras (consulta), y sin flash de "No hay médicos" al
    abrir el pool.
  - Files: `components/DoctorPoolModal.tsx`, `components/admin/CatalogManager.tsx`,
    `lib/hooks.ts`, `pages/panel-medico/consulta/[id].tsx`,
    `pages/admin/{pacientes,especialidades,zonas-afectadas,tipos-profesionales}.tsx`.
  - _Nota del rebase (2026-07-14)_: los fixes de `lib/apiClient.ts` (ApiError en GET + 422
    legibles + redacción de passwords) ya habían llegado a `dev_aws` por la rama de
    admin/usuarios, así que este PR ya no toca ese archivo. En `CatalogManager.tsx` dev_aws ya
    traía el modal de borrado (`ConfirmDialog`), que se conservó; este PR aún aporta ahí los
    fixes complementarios: guard de reentrada en `submit`, éxito/error que no conviven,
    botones de fila `disabled` durante escrituras y paginación navegando desde `safePage`.

## 2026-07-08

- **Consulta médico-paciente: 3 botones nuevos (pool de médicos, cerrar con guardas, agendar)** —
  en `pages/panel-medico/consulta/[id].tsx`: (1) **Ver Pool de médicos** abre un modal
  (`components/DoctorPoolModal.tsx`) con tabs Activos/Inactivos/Todos (online = logeado < 3 min),
  filtros por especialidad y tipo de profesional, y paginación server-side (20/pág) sobre los
  ~2879 médicos — datos de un endpoint backend nuevo `GET /doctors/pool` (`api-medicos-por-venezuela`)
  que cruza `doctors`↔`users` para derivar el estado online (el frontend/Supabase solo no podía:
  el tipo de profesional vive en `doctors`, el online en `users.last_seen_at`). (2) **Cerrar
  consulta** se movió al final y ahora exige nota **no vacía y ya guardada** + `confirm()` antes de
  cerrar; de paso se quitaron "Cerrado" y "Referenciado a otro médico" del dropdown "Estado del
  caso" (cerrar es solo vía el botón). (3) **Agendar con Especialista** es placeholder
  (`ponytail:`, lógica pendiente). Verificado en navegador: pool (tabs/filtros/paginación),
  las 3 guardas de cierre, el placeholder y el dropdown ya sin las 2 opciones. Backend: endpoint
  con permiso `doctors.read` (el médico ya lo tiene) + 5 tests nuevos (136 passed, 95% cobertura).
  Files: `pages/panel-medico/consulta/[id].tsx`, `components/DoctorPoolModal.tsx`, `lib/doctors.ts`;
  backend `src/{schemas,services,routers}/doctor*.py`, `tests/test_doctors.py`.
  - **Ajustes:** los botones "Ver Pool" y "Agendar con Especialista" se movieron a una fila
    debajo del encabezado (ya no en la sección de gestión). El pool ahora **excluye al propio
    médico** que consulta (`exclude_user_id=principal.id` en el backend) y devuelve el **teléfono**
    (`coalesce(doctors.phone, users.whatsapp_number)`): en las tabs Activos/Inactivos la 4ª columna
    muestra el WhatsApp como enlace `https://wa.me/<número>` (sin el `+`, y anteponiendo 58 si no
    trae prefijo); en "Todos" sigue mostrando el estado online. +2 tests backend (exclude-self, phone).

- **Catálogos admin: buscador + paginación** — las 3 páginas de catálogo (zonas afectadas,
  especialidades, tipos de profesionales) heredan de `CatalogManager.tsx` un buscador (filtra en
  cliente sobre todos los campos de texto, resetea a la página 1) y paginación de 10 por página.
  Se hace en cliente sobre la lista ya cargada porque son catálogos chicos (≤ decenas de filas, el
  endpoint trae hasta 100) — no amerita paginación server-side. La paginación solo aparece si hay
  más de una página; con búsqueda sin resultados muestra "Ningún resultado coincide con «…»".
  Verificado en navegador con Especialidades (19 filas): 10+9 en dos páginas con botones
  Anterior/Siguiente deshabilitándose en los extremos, y "ped" → solo Pediatría. File:
  `components/admin/CatalogManager.tsx`.

- **Registro de paciente: zonas afectadas ahora vienen del backend real (bug encontrado)** —
  `lib/api.ts::fetchAffectedZoneCatalog`/`fetchSpecialtyCatalog` chequeaban una variable de
  entorno (`NEXT_PUBLIC_API_BASE_URL`) que nunca se seteó en `.env`, así que **nunca** llegaban
  a llamar al backend: el select de zonas de `registro-paciente.tsx` mostraba siempre la lista
  estática hardcodeada, en silencio. Ahora reusan `lib/apiClient.ts` (mismo `API_URL` que
  `lib/doctors.ts`/`lib/patients.ts`, con fallback a `localhost:8000`), y de paso queda claro que
  la "doble llamada a specialties" que se notaba no era un bug propio sino `reactStrictMode: true`
  (`next.config.js`) invocando los efectos de montaje 2 veces en dev — ambos catálogos se duplican
  igual ahora que zonas también pega red; en producción no ocurre. Se sembraron las 16 zonas reales
  (La Guaira ×9, Caracas ×4, Miranda/Aragua/Carabobo) vía `POST /affected-zones` (BD local); los
  3 estados sin desglose de sector se guardaron con `name === state` y el formateador ahora omite
  el guión redundante ("Miranda", no "Miranda - Miranda"). Verificado en navegador: el select trae
  las 16 zonas reales del backend con tildes correctas. Files: `lib/api.ts`.

- **Dashboard admin: menú lateral + páginas separadas por sección** — el dashboard monolítico
  (`pages/admin/dashboard.tsx`, 1645 líneas con tabs "Pacientes/Casos" y "Médicos y administradores")
  se partió en 6 rutas bajo un layout compartido (`components/admin/AdminLayout.tsx`, sidebar +
  topbar, off-canvas en mobile): `/admin/dashboard` (solo las 6 KPI + alerta de urgentes),
  `/admin/pacientes` (gestión de casos), `/admin/doctores` (staff + revocar acceso), y 3 páginas
  nuevas de catálogos — `/admin/zonas-afectadas`, `/admin/especialidades`,
  `/admin/tipos-profesionales` — con CRUD completo (`components/admin/CatalogManager.tsx`, genérico
  por schema de campos) contra `api-medicos-por-venezuela` (antes solo se leían, nunca se
  gestionaban desde el frontend). Sesión/rol compartidos vía `lib/admin.ts::useAdminGuard()`.
  `lib/apiClient.ts` gana soporte de `Authorization: Bearer` + `patchJson`/`deleteJson` para poder
  llamar los endpoints `catalogs.manage` del backend con el JWT de Supabase del admin logueado.
  Backend: se agregó `GET /specialties/admin` (api-medicos-por-venezuela) porque el listado público
  fuerza `status=active` y el panel necesita ver también las inactivas — mismo patrón que
  `affected-zones/admin`. Verificado en navegador (login real como `fioreamm@gmail.com`, ya
  promovida a `super_admin`): las 6 páginas cargan con datos reales, CRUD de zonas afectadas
  probado end-to-end (crear/editar/eliminar), y un bug real de layout mobile (`.admin-shell`
  quedaba en `flex-direction: row` con el sidebar `position:fixed` fuera de flujo, apretando el
  contenido a una franja de 20px) encontrado y corregido antes de cerrar. Files:
  `components/admin/{AdminLayout,CatalogManager}.tsx`, `lib/{admin,apiClient}.ts`,
  `pages/admin/{dashboard,pacientes,doctores,zonas-afectadas,especialidades,tipos-profesionales}.tsx`,
  `styles/globals.css`.

## 2026-07-05

- **Registro médico: la cédula exige elegir el tipo de profesional primero** — la
  verificación de cédula (`verificarCedula`, en el `onBlur`) ya ramificaba SACS/FPV
  según `tipoProfesional`, pero el campo quedaba habilitado sin haberlo seleccionado:
  el usuario podía escribir la cédula y, al perder el foco, no pasaba nada visible (el
  guard existente cortaba en silencio), sin explicar por qué. Se deshabilita el campo
  de cédula (prefijo V/E + número) hasta elegir el tipo de profesional, con un hint
  ("Selecciona primero el tipo de profesional.") que lo explica. Verificado en
  navegador: deshabilitado + hint antes de elegir tipo, habilitado y sin errores de
  consola después. File: `pages/registro-medico.tsx`.

## 2026-07-04

- **Registro médico: submit real contra `POST /api/v1/doctors` + cuenta Supabase + especialidad real** —
  se conecta el formulario al backend FastAPI real (`api-medicos-por-venezuela`), reemplazando el
  submit mockeado. Nuevo `lib/apiClient.ts` (compartido con `lib/patients.ts`): `API_URL` (acepta
  `NEXT_PUBLIC_API_URL` o `NEXT_PUBLIC_API_BASE_URL`, evitando el mismatch silencioso con
  `lib/api.ts`), la clase `ApiError`, y los helpers `getJson`/`postJson` (única implementación de
  fetch+parseo de error, en vez de duplicarla por archivo). Nuevo `lib/doctors.ts` con
  `fetchProfessionalTypes`/`fetchSpecialties`/`createDoctor` sobre ese cliente.

  - El `TIPOS_PROFESIONAL` hardcodeado se reemplaza por el catálogo real (`GET
/api/v1/professional-types`, `status === 'active'`); la rama SACS/FPV sigue comparando contra el
    `name` del tipo seleccionado, sin cambios en esa lógica. Honeypot (`website`, input real oculto,
    no `type="hidden"`) agregado por el anti-bot del endpoint.
  - **`specialty_id` ya no viaja `null`**: `fetchSpecialties()` (`GET /api/v1/specialties`, público)
    reemplaza el `<select>` estático de `SPECIALTIES` (`lib/utils.ts`) por el catálogo real (filtrado
    a `active`, sin "Psicología"); el `id` elegido se trackea en `especialidadId` (el `refine` de zod
    se actualizó para ese campo). Para `tipoProfesional === 'Psicólogo'` se resuelve automático el
    `id` cuyo `name === 'Psicología'`, sin UI, con fallback a `null` si no está en el catálogo.
  - **Cuenta Supabase real**: la contraseña del formulario se recolectaba pero nunca se usaba — no
    creaba cuenta, así que un médico "registrado" no podía entrar a `/login-medico`. Se agrega
    `supabase.auth.signUp({ email, password, options: { data: { full_name, role: 'doctor' } } })`
    antes de `createDoctor()`; sin `session` (confirmación pendiente) se informa y se corta sin
    llamar al backend. Si `createDoctor()` falla **después** de que el signUp ya creó sesión, se hace
    `supabase.auth.signOut()` y se avisa explícitamente que la cuenta quedó creada pero el registro
    no — **mitigación parcial**, no revierte la cuenta/fila `profiles` (requeriría un endpoint admin
    con service-role, fuera de alcance; sigue como follow-up).
  - `CLAUDE.md`/`AGENTS.md` actualizados: ya no dicen "no separate backend server" ni que los médicos
    pueden registrarse con Google (se sacó de esta pantalla) — reflejan el backend FastAPI nuevo.
  - **Redirect al board tras el 201**: el diagrama de secuencia del ticket especifica que, tras el
    registro exitoso, se redirige directo a la cola/board (no a un mensaje de "ya podés loguearte").
    Se saca el estado `ok`/mensaje de éxito (ahora dead code) y se agrega
    `router.push('/panel-medico')` justo después de `createDoctor()` — la sesión ya está activa desde
    el `signUp()` previo, así que no hace falta un login manual aparte.

  `pnpm exec tsc --noEmit` y `pnpm lint` limpios. Files: `lib/apiClient.ts`, `lib/doctors.ts`,
  `lib/hooks.ts`, `pages/registro-medico.tsx`, `CLAUDE.md`, `AGENTS.md`.

- **Registro paciente: submit real contra `POST /api/v1/patients` y `POST /api/v1/consultations`** —
  se conecta `/registro-paciente` (ramas adulto y menor/representante) al mismo backend FastAPI,
  sobre el `lib/apiClient.ts` compartido, en vez de los
  `supabase.from('patients'|'consultations').insert(...)` anteriores. Nuevo `lib/patients.ts` con
  `createPatient`/`createConsultation` + tipos `PatientCreate`, `PatientResponse`,
  `ConsultationCreate`, `ConsultationResponse`. Se deja de enviar `code` al crear la consulta (el
  schema del backend lo rechaza como campo desconocido; el código ahora sale de
  `ConsultationResponse.code` para el redirect a `/sala-espera`). `supabase.auth.signUp()`/
  `getSession()` y la creación de la videoconsulta (`pages/api/videoconsulta.ts`) quedan intactos.
  Mismo mitigación de cuenta huérfana que en médico (`signOut()` + aviso explícito si el backend
  falla después del `signUp()`), y el único `useEffect(fn, [])` crudo del archivo se reemplazó por
  `useMountEffect` para consistencia con `registro-medico.tsx`.

  Fuera de alcance deliberado (documentado para el equipo, no tocado en ninguno de los dos flujos):
  `needsTags` hardcodeado (rompe el ruteo de casos reservados/prioridad), los `refine` de cuenta
  obligatoria en este archivo (contradice "registro anónimo" del auth model), `lib/api.ts`, y el
  cuerpo de `verificarCedula()`/`lib/verificacion.ts`.

  `pnpm exec tsc --noEmit` y `pnpm lint` limpios. Files: `lib/patients.ts`,
  `pages/registro-paciente.tsx`.

## 2026-07-03

- **Registro médico: se quita Google, se agrega zod y validaciones por campo** — se elimina el
  botón "Continuar con Google" y su wiring (`signInWithGoogle`/`localStorage`) de
  `registro-medico.tsx` — la cuenta se crea solo con correo+contraseña. Se instala `zod`
  (`^4.4.3`) y se reemplaza el bloque de validación manual (un único `if` con un mensaje genérico)
  por un schema `registroMedicoSchema` con mensajes específicos por campo: cédula y WhatsApp
  exigen solo dígitos y un rango de longitud (6–9 y 7–11 respectivamente — los inputs ya filtran
  no-dígitos con `soloDigitos`, el schema es la segunda capa de defensa), correo con `.email()`, y
  un `.refine()` que exige especialidad únicamente cuando el tipo de profesional es "Médico"
  (`mostrarEspecialidad`). Probado en el navegador: cada regla dispara su mensaje en cascada (tipo
  de profesional → cédula → WhatsApp → correo). File: `pages/registro-medico.tsx`.
- **Registro de paciente: validación de formulario con zod** — mismo tratamiento que ya se aplicó
  en `/registro-medico`: se instala `zod` (`^4.4.3`) y se reemplaza el bloque de `if`s manual en
  `submit()` por dos schemas (`adultSchema`/`minorSchema`, uno por rama), cada uno con mensaje
  específico por campo. Cédula/WhatsApp validan contra el formato exacto que ya emiten
  `CedulaField`/`PhoneField` (`CEDULA_REGEX = /^[VE]-\d{6,9}$/`, `PHONE_REGEX = /^\d{8,15}$/`) como
  segunda capa de defensa (los inputs ya filtran no-dígitos). Edad usa un `.refine()` con un
  helper `edadEnRango(min, max)` en vez de `z.coerce.number()` — `Number('')` da `0` en JS, así que
  coercionar directo dejaría pasar el campo vacío como "edad 0" en la rama menor (rango 0–17); el
  refine exige explícitamente que el string no esté vacío. El resto de reglas condicionales
  (correo/contraseña solo si `!authedPatient`, especialidad solo si `wantsSpecialty`, detalle de
  alergia solo si `hasAllergy`/`mHasAllergy`, cédula del menor opcional pero validada si se llena)
  quedan como `.refine()` encadenados. Probado en el navegador: ambas ramas completas llegan hasta
  el error de consentimiento (última validación) sin falsos positivos. File:
  `pages/registro-paciente.tsx`.
- **Registro de paciente: paleta azul en vez de verde, para coincidir con el home** — el home
  (`pages/index.tsx`) ya usa azul (`#1a3a6b`) para la tarjeta "Soy paciente" (el médico pasó a
  amarillo/dorado ahí), así que `/registro-paciente` debía dejar de usar el verde genérico del
  sitio. Se agregó `.patient-theme` en `styles/globals.css`, que sobreescribe localmente las
  custom properties `--green`/`--green-light` (a `#1a3a6b`/`#e8effb`, los mismos valores exactos
  del home) — como `.btn-primary`, `.link-button` y el `border-color` de foco en inputs ya leen
  esas variables, todo el acento de la página cambia a azul sin tocar ninguna otra página (verificado
  que `/registro-medico` sigue en verde). Se aplicó la clase al `<main>` de
  `pages/registro-paciente.tsx` y se cambió el único hex verde hardcodeado (link "Seguir mi caso")
  a `var(--green)` para que también herede el override.
- **Registro de paciente: la alergia pasa de texto libre a checkbox + input** — ajuste sobre el
  cambio anterior: "¿Tienes alguna alergia?" / "¿El menor tiene alguna alergia?" ya no va dentro
  de "Descripción breve", ahora es un checkbox propio (mismo patrón que "Conozco la
  especialidad") que al marcarse muestra un input obligatorio para escribir a qué es alérgico.
  Los medicamentos actuales, por decisión del usuario, se quedan como texto libre dentro de la
  descripción. Como `patients` no tiene columna de alergias (sin migración de esquema, ver nota de
  más abajo), el dato se antepone como `Alergias: {detalle}.` a la descripción/`chief_complaint`
  antes de aplicar el resto de los "puentes" ya existentes (representante, especialidad
  solicitada). File: `pages/registro-paciente.tsx`.
- **Registro de paciente: se quita "Tipo de ayuda", Google y se pide alergias/medicamentos en la
  descripción** — ajustes de feedback sobre el rediseño anterior de `/registro-paciente`. Se
  elimina por completo el selector de tags "Tipo de ayuda" (rama adulto) y el registro con Google
  (ambas ramas, incluida la lógica `signInWithGoogle`/`localStorage` y el componente
  `GoogleButton`) — la cuenta ahora solo se crea con email+contraseña. Sin el tag picker, los
  adultos ya no aportan una señal de `needs_tags`: se asigna por defecto `['Medicina general']`
  (cubre cualquier especialidad vía el `'*'` de `SPECIALTY_NEEDS`, sin tocar `lib/utils.ts`); la
  especialidad indicada en "Conozco la especialidad" sigue siendo solo informativa en
  `chief_complaint`. Efecto secundario esperado: la prioridad automática "review" que antes
  disparaban tags como "Lesión física"/"Embarazo" ya no aplica a adultos (solo sigue aplicando a
  menores, vía `needs_tags = ['Niño / pediatría']`) — a validar con el usuario si hace falta un
  mecanismo de prioridad distinto más adelante. La "Descripción breve" (obligatoria en ambas
  ramas) ahora pide explícitamente alergias y medicamentos actuales en el placeholder. File:
  `pages/registro-paciente.tsx`.
- **Registro de paciente: flujo menor de edad + representante, cuenta obligatoria y
  catálogos del backend** — rediseño de `/registro-paciente` a partir del boceto del usuario,
  manteniendo el layout visual de `registro-medico.tsx`. Checkbox "Voy a registrar un menor de
  edad (<18)" bifurca el formulario: rama adulto (cédula, nombre, WhatsApp, correo, contraseña,
  zona, edad, checkbox "Conozco la especialidad" + selector, tipo de ayuda, descripción) vs. rama
  menor (datos del adulto/representante + datos del menor + selector de parentesco al final). La
  creación de cuenta (email+contraseña o Google) pasa a ser obligatoria — se elimina el flujo
  anónimo y el checkbox "crear cuenta" que existían antes. Los menores se auto-etiquetan con
  `needs_tags = ['Niño / pediatría']` (sin selector, ya enruta a Pediatría vía `SPECIALTY_NEEDS`
  existente, sin tocar `lib/utils.ts`). Nuevos componentes reutilizables `CedulaField` (prefijo
  V/E + número) y `PhoneField` (código de país + número), ambos con filtrado de solo-dígitos y
  validación de edad numérica por rango (18–120 adulto, 0–17 menor). Los selects de Zona afectada
  y Especialidad ahora se pueblan desde el backend FastAPI (`GET /specialties`,
  `GET /affected-zones/list`, ya sincronizado a `dev`), con fallback silencioso a los catálogos
  hardcodeados si `NEXT_PUBLIC_API_BASE_URL` no está seteada o el backend no responde (nuevo
  `lib/api.ts`). **Puente explícito sin migración de esquema** (decisión del usuario: no tocar
  `supabase_schema.sql` ni el repo backend todavía): el nombre/cédula/parentesco del representante
  no tienen columna dedicada en `patients`, así que se embeben como texto estructurado al inicio de
  `description`; igual criterio para la especialidad elegida por un adulto, que se antepone al
  `chief_complaint` de la consulta en vez de crear una columna `requested_specialty`. El matching
  real de la cola sigue basado en `needs_tags` sin cambios. Files: `pages/registro-paciente.tsx`,
  `components/CedulaField.tsx` (nuevo), `components/PhoneField.tsx` (nuevo), `lib/api.ts` (nuevo),
  `styles/globals.css` (`.input-group`). Pendiente (requiere `.env.example`, sin acceso de
  archivo en esta sesión): documentar `NEXT_PUBLIC_API_BASE_URL`.

## 2026-07-02

- **Registro médico: verificación de cédula conectada al backend real** — `verificarSacs` /
  `verificarPsicologo` (nuevo `lib/verificacion.ts`) reemplazan los mocks de
  `registro-medico.tsx`, pegando contra `GET /api/v1/verificacion-sacs/{cedula}` y
  `GET /api/v1/verificacion-psicologo/{cedula}` de `api-medicos-por-venezuela` (ya mergeados a
  `dev`, confirmados en Swagger). Base URL configurable vía `NEXT_PUBLIC_API_URL` (default
  `http://localhost:8000`). Probado en vivo: cédula sin registro real muestra correctamente "No
  encontramos esta cédula...". Files: `lib/verificacion.ts`, `pages/registro-medico.tsx`,
  `.env.example`.
- **Especialidad excluye "Psicología" cuando el tipo de profesional es Médico** — esa
  especialidad queda reservada al flujo de `Psicólogo` (se asigna sola, sin selector). File:
  `pages/registro-medico.tsx`.
- **Botón y foco de `/registro-medico` alineados al dorado del home** — el botón "Registrarse"
  (`.registro-medico-page .btn-primary`) pasa de fondo azul sólido a fondo blanco + borde dorado
  de 2px (mismo criterio que `btn-gold-outline` del home para la tarjeta "Soy Médico"); el foco de
  inputs/selects de esa pantalla también pasa de azul a dorado. Nueva variable `--home-gold`.
  Files: `styles/globals.css`.

## 2026-07-01

- **Case detail: clearer patient header** — Zona, Edad (años) and Cédula now render as three clearly
  labeled columns side by side, and the case **Categoría** (e.g. "Crisis de ansiedad") shows as a badge
  next to the patient's name. File: `pages/panel-medico/consulta/[id].tsx`.

- **Admin: inline-edit a patient's phone** — the cases table phone now has a pencil that opens an input
  with a green check (Enter) to save / red ✕ (Esc) to cancel; verified with `.select()` and updates
  every case of that patient locally. File: `pages/admin/dashboard.tsx`.

- **Trazabilidad: log patient entry / WhatsApp choice** — the anon RPCs now record one-time timeline
  events: `patient_entered_call` ("Paciente ingresó a la videollamada") on first video entry and
  `patient_wants_whatsapp` ("Paciente prefirió ser contactado por WhatsApp") when they choose WhatsApp.
  Files: `supabase_schema.sql` (**needs prod migration**), `eventLabel` in `pages/admin/dashboard.tsx`
  and `pages/panel-medico/consulta/[id].tsx`.

- **Patient chooses video vs. WhatsApp on /sala-espera** — after registering, the patient now picks
  between "Ingresar a videollamada para ayuda inmediata" (existing Jitsi flow) and "Prefiero ser
  contactado/a por WhatsApp". The WhatsApp choice flags the case (`consultations.contact_preference`)
  via a new anon RPC `mark_patient_wants_whatsapp()` and it enters the doctors' contact pool
  **immediately** (no 20-min wait); the panel's "no atendidos" queue condition is now
  `contact_preference = 'whatsapp' OR waited ≥20 min`. Files: `supabase_schema.sql` (new column + RPC,
  **needs prod migration**), `pages/sala-espera.tsx`, `pages/panel-medico.tsx`.

- **Admin: reliable "Guardar cambios" in "Gestionar caso"** — the save now verifies both writes
  (consultation + patient `needs_tags`) with `.select()` so a silent 0-row update (RLS/no match, which
  returns no error) is caught and surfaced with the real DB message instead of appearing to succeed.
  This fixes tipo de ayuda / especialidades edits that occasionally didn't stick. On success the panel
  still closes (`setSelected(null)`); on a real failure it stays open with the error. File:
  `pages/admin/dashboard.tsx`.

- **Case detail: WhatsApp guidance reworded as bullets** — the red contact note in
  `/panel-medico/consulta/[id]` is now a 3-item list (contact via WhatsApp to schedule a call; wait up
  to 24h; log missing/wrong contact in the notes). File: `pages/panel-medico/consulta/[id].tsx`.

- **Patient phone: forced +58 prefix, digits-only input** — the registration phone field
  (`/registro-paciente`) now shows a fixed `+58` prefix and accepts only numbers (strips non-digits
  and a leading 0); saved as `+58` + the local number. File: `pages/registro-paciente.tsx`.

- **Case detail: patient phone is a big WhatsApp link** — in `/panel-medico/consulta/[id]` the patient
  number is now a larger, tappable `wa.me` link so doctors can open WhatsApp directly from their phones.
  File: `pages/panel-medico/consulta/[id].tsx`.

- **Case detail: "Tengo un problema" button + modal** — replaced the always-on red top-right notice
  with a "Tengo un problema" button that opens a popup showing the team WhatsApp contact
  (+4915203003171). File: `pages/panel-medico/consulta/[id].tsx`.

- **QR image hosted for social media** — added `public/qr-medicosporvenezuela.jpg`, served inline at
  `/qr-medicosporvenezuela.jpg` so the link can be shared on social media.

- **Instruction image URL forces download** — opening `/instruccion-jitsi.png` directly now downloads
  the file (as `instruccion-videollamada.png`) via a `Content-Disposition: attachment` header, while
  still rendering normally in the `<img>` on `/sala-espera`. File: `next.config.js` (`headers()`).

- **Admin: "Referencia y trazabilidad" in "Gestionar caso"** — selecting a case now loads its
  `consultation_events` audit trail and shows the history (event label, note, author + role, and the
  timestamp in Venezuela time) at the bottom of the manage panel, so admins can see what has happened.
  Refreshes after an inline status change on the selected case. File: `pages/admin/dashboard.tsx`.

- **Case detail: WhatsApp contact guidance next to patient phone** — added a red note under the
  patient's phone in `/panel-medico/consulta/[id]` explaining to prefer WhatsApp chat (better
  connectivity), to agree a call time there, to wait up to 24h for a reply, and to log missing/wrong
  contacts in the medical notes. File: `pages/panel-medico/consulta/[id].tsx`.

- **Admin: editable "Especialidades que pueden ver este caso" (override)** — "Gestionar caso" now has
  an editable specialties selector: editing the Tipo de ayuda re-derives it, but the admin can also
  toggle specialties directly to override the routing. Saved as `consultations.required_specialties`
  (null when it matches the derived set, so it keeps deriving). The doctor panel honors it
  (`specialtyCanSee`), and the cases table "Especialidades" line shows the effective set
  (`effectiveSpecialties`). New helpers in `lib/utils.ts`; needs one additive prod migration
  (`required_specialties text[]`). Files: `supabase_schema.sql`, `lib/utils.ts`,
  `pages/panel-medico.tsx`, `pages/admin/dashboard.tsx`.
- **Case detail: reworked "Gestión de la consulta"** — removed the "Unirse a videoconsulta" / "Cerrar
  consulta" / "Paciente no estaba en la sala de espera" buttons (and the now-unused `closeConsultation`
  / `browserRoomUrl`); added an **Estado** dropdown for **all** cases (Abierta / Ya contactado vía
  WhatsApp / Referenciado / Necesita ir a centro / Paciente no se presentó / Cerrado — sets `closed_at`
  on terminal statuses) plus "Guardar nota". Added a **red** top-right notice ("Si tienes problemas
  con este caso, contáctanos vía +4915203003171 en WhatsApp") and moved "Referencia y trazabilidad"
  to the bottom of the page. File: `pages/panel-medico/consulta/[id].tsx`.
- **Admin: "Doctor contactará vía WhatsApp" indicator** — in the cases table, under Estado and below
  Especialidades, a green "Doctor contactará vía WhatsApp" line now shows when a case was claimed via
  the WhatsApp button (`attended_via_whatsapp`), so admins can tell it apart from a video-attended
  "Abierta" case. File: `pages/admin/dashboard.tsx`.
- **Admin: removed "Derivaciones por especialidad" section** — dropped the referrals-by-specialty
  card (and its dead `bySpecialty`/`referred` helpers); "Gestionar caso" is now full-width. File:
  `pages/admin/dashboard.tsx`.
- **Admin: clicking a case scrolls to "Gestionar caso"** — selecting a case from the cases table now
  smooth-scrolls up to the manage panel (via a ref + `scrollIntoView`), so the admin doesn't have to
  scroll manually. File: `pages/admin/dashboard.tsx`.
- **Panel queues respect the doctor's specialty** — the `/panel-medico` "Pacientes que no han podido
  ser atendidos" and live video queues now only show cases the logged-in user's specialty can attend
  (`canAttend`), applied to admins by their specialty too (removed the `isCurrentUserAdmin` bypass on
  the panel). So a Medicina general account no longer sees reserved psychology cases. File:
  `pages/panel-medico.tsx`.
- **Admin: edit a case's "tipo de ayuda" to re-route it** — the "Gestionar caso" panel now has an
  editable Tipo de ayuda (categorías/necesidades) selector with a live preview of the specialties
  that will be able to attend it; saving updates `patients.needs_tags` + `consultations.category` so
  the routing re-derives (fixes a patient's wrong selection). Centralized the needs list as
  `NEEDS` in `lib/utils.ts` (shared with the registration form). Files: `lib/utils.ts`,
  `pages/admin/dashboard.tsx`, `pages/registro-paciente.tsx`.
- **Admin cases: show eligible specialties (replaces "Prioridad")** — under the Estado column, the
  cases table now lists which specialties can pick up each case (`eligibleSpecialties` = specialties
  whose scope fits the case AND are allowed by the psychology reservation), replacing the "Prioridad"
  line. Files: `lib/utils.ts` (helper), `pages/admin/dashboard.tsx`.
- **Split live video queue vs. unattended queue** — "Atender al siguiente paciente" now only counts
  and attends patients **actively waiting in the video call** (entered the call within the last
  `LIVE_CALL_WINDOW_MIN` = 60 min, unassigned), and the button is disabled unless one exists. The
  "Pacientes que no han podido ser atendidos hasta ahora" section keeps its own rule (unassigned,
  registered > 20 min). Added a third DB query for the live queue and merged the sources deduped by
  id; KPIs are now "En videollamada ahora" / "Sin atender (+20 min)" / "Consultas cerradas por mí".
  File: `pages/panel-medico.tsx`.
- **Home page: extendido "médico o psicólogo" → "profesional de la salud" en toda la página** —
  ticket `refactor(Home-page)`, barrido completo de las 8 menciones restantes que solo nombraban
  médico/psicólogo: los 3 steps de "¿Cómo funciona?", la meta description, el pill del hero, el H1
  del hero, la trust card de confidencialidad y el footer. Título del H1 acordado con el usuario:
  "¿Necesitas atención médica, psicológica o en otra área de la salud, gratuita?". Sigue pendiente
  (no es código, requiere respuesta externa) preguntar a las Drs del grupo la lista exacta de
  profesiones a enumerar en otras pantallas (ver ticket `refactor(registro-medicos)`). File:
  `pages/index.tsx`.
- **Home page: tarjeta de paciente inclusiva + paso redundante eliminado** — ticket
  `refactor(Home-page)`, seguimiento del cambio anterior. La tarjeta "Soy Paciente" ahora dice
  "Necesito hablar con un médico, psicólogo u otro profesional de la salud." (antes solo
  mencionaba médico/psicólogo). Se eliminó el paso 1 de "¿Cómo funciona?" ("Entra a la
  plataforma / Ingresa a www.medicosporvenezuela.org") por redundante — quien lee la página ya
  está en el sitio; los pasos se renumeraron solos (ahora son 4). Se eliminó el ícono
  `IconGlobe`, que quedó sin uso. File: `pages/index.tsx`.
- **Home page: "Soy profesional de la salud" + sala de espera en el paso 4** — ticket
  `refactor(Home-page)`, rama base `dev_aws`. Renombrado "Soy Médico" → "Soy profesional de la
  salud" en el nav y en la hero card (más inclusivo, no solo médicos). El paso 4 de "¿Cómo
  funciona?" ahora dice "Entra a la sala de espera" y explica que el paciente espera ahí hasta que
  un médico o psicólogo lo atienda, antes de unirse a la teleconsulta. Pendiente (no implementado,
  requiere info externa): expandir la lista de profesiones más allá de médico/psicólogo una vez
  que las Drs del grupo confirmen cuáles agregar — dejado como TODO en el código (`STEPS` en
  `pages/index.tsx`). File: `pages/index.tsx`.
- **Registro médico: maqueta de formulario consolidado en un solo paso (sin endpoints)** — ticket
  `refactor(registro-medicos)`, rama base `dev_aws`. `registro-medico.tsx` ahora junta en una sola
  pantalla lo que hoy está dividido entre esa página (cuenta) y `/elegir-rol` (especialidad/país/
  whatsapp): tipo de profesional, cédula con selector V/E y verificación en vivo (mock de
  `verificacion-sacs`/`verificacion-psicologo`, que autocompleta y bloquea Nombre/Licencia),
  WhatsApp con prefijo de país, y Especialidad oculta cuando no es médico. Colores/foco de esta
  pantalla alineados al azul del home (`--home-blue`), scopeados vía `.registro-medico-page` para no
  afectar el resto de la app (sigue en verde). Sin wiring real a la API todavía — pendiente de que
  se mergeen los endpoints de backend y de un catálogo público de `professional-types`. No
  mergeado a `dev_aws` todavía. Files: `pages/registro-medico.tsx`, `styles/globals.css`.
- **Trazabilidad as compact rows** — the case-detail "Referencia y trazabilidad" event history now
  renders each event as a single divider-separated row (label — note · author, with the date on the
  right) instead of stacked cards, so the section is much shorter. File:
  `pages/panel-medico/consulta/[id].tsx`.
- **Claim on "unassigned", not `status='waiting'`** — the atomic claim in both `attendViaWhatsapp`
  and `openConsultation` now matches `assigned_doctor_id IS NULL` instead of `status = 'waiting'`, so
  claiming a `patient_no_show` case from the queue works (it previously failed with "Ya fue asignado a
  otro doctor"). After the WhatsApp claim the case becomes `in_progress` assigned to the doctor, opens
  the case detail, and shows under **"Mis consultas abiertas"**. File: `pages/panel-medico.tsx`.
- **Unattended queue includes "no-show" cases** — "Pacientes que no han podido ser atendidos hasta
  ahora" now treats a case as "still open" if it's anything except `closed` / `closed_by_admin` /
  `cancelled` — importantly including **`patient_no_show`** (the patient registered but never
  connected to the video call, so they still need WhatsApp follow-up). Renamed `ACTIVE_STATUSES` →
  `OPEN_STATUSES`. Verified against prod: the queue was empty because every unassigned case was a
  no-show; it now correctly surfaces those unassigned no-shows > 20 min old. File:
  `pages/panel-medico.tsx`.
- **Unattended cards: WhatsApp-only action** — removed the per-card "Atender" (video) button so each
  patient card in the queue offers only "Puedo atender a este paciente vía WhatsApp con mi número
  personal". File: `pages/panel-medico.tsx`.
- **"Pacientes que no han podido ser atendidos hasta ahora" queue (3 filters, DB-side)** — renamed
  "Consultas disponibles" and redefined it by three filters applied **in the query** so a large
  backlog can't hide recent patients past the 1000-row cap: (1) still a registered case
  (`ACTIVE_STATUSES`), (2) **not assigned to any doctor** (`assigned_doctor_id is null`), (3) waiting
  **> 20 min** (`created_at ≤ now − WAITING_FALLBACK_MIN`). No longer keys off `status = 'waiting'`,
  so an unassigned case whose status was changed still shows. Split `loadConsultations` into two
  targeted queries (unattended list + the doctor's own open cases) so neither can be dropped by the
  cap. Replaced the 30-min heartbeat presence entirely (removed `isPatientPresent` /
  `PRESENCE_WINDOW_MS` and the present-patient preference in "Atender al siguiente") and relabeled the
  KPIs ("Pacientes esperando", "Esperando para tu especialidad"). File: `pages/panel-medico.tsx`.
- **"Disponible" badge on available cases** — each card in "Consultas disponibles" now shows a green
  "● Disponible" badge so doctors can see the case is still open/unclaimed. Cases claimed by another
  doctor are unassigned `waiting` rows only, so they drop off the list on the next refresh (~20s), and
  the atomic claim still guards the race ("ya fue tomado por otro médico"). File: `pages/panel-medico.tsx`.
- **`/panel-medico` is a pure-doctor view for everyone** — removed the admin-only "Casos activos del
  sistema" section (and its "Ver / gestionar caso" cards, KPI, and empty-message branches) so
  admins/super_admins see the panel exactly like a doctor: waiting queue + their own open cases. The
  "Panel admin" nav button and `/admin/dashboard` (panel administrativo) are unchanged. Cleaned up the
  now-dead helpers (`activeSystemConsultations`, `assignmentLabel`, `AdminActiveCaseCard`,
  `assignedDoctorsById`). File: `pages/panel-medico.tsx`.
- **Attend a patient via WhatsApp (doctor's personal number)** — waiting patient cards on
  `/panel-medico` now have a "Puedo atender a este paciente vía WhatsApp con mi número personal"
  button. It opens a commitment modal ("…te comprometes a contactar al paciente vía WhatsApp… al
  +4915203003171"); only on **Aceptar** does it atomically claim the case (assign + `in_progress` +
  `attended_via_whatsapp = true`), so it leaves every other doctor's queue — if someone grabbed it
  first it shows "Ya fue asignado a otro doctor". WhatsApp-attended cases open the detail page with a
  **status dropdown** (Abierta / Referenciado a otro médico / Ya contactado vía WhatsApp / Necesita ir
  a centro de atención / Cerrado), keep "Guardar nota", and hide the Videoconsulta / no-show / Cerrar
  consulta buttons; the note label is now "Notas del médico". New `contacted_whatsapp` status +
  `attended_via_whatsapp` flag. WhatsApp cases marked "Ya contactado vía WhatsApp" stay visible under
  **the attending doctor's** "Mis consultas abiertas" (only they can reopen them; still fully managed
  in the admin dashboard). Files: `supabase_schema.sql`, `lib/utils.ts`, `pages/panel-medico.tsx`,
  `pages/panel-medico/consulta/[id].tsx`, `pages/admin/dashboard.tsx`. Needs an additive prod
  migration (new status in the check constraint + the flag column).
- **Inline searchable "Médico" reassignment + assigned-name resolution** — the cases-table Médico
  cell is now a search-as-you-type combobox (queries the DB, reaches all doctors) so admins can
  reassign the attending doctor straight from the row, no need to open "Gestionar caso". Also fixed a
  display bug: assigned doctors living beyond the loaded 1000 profiles showed as a generic "Médico";
  `loadAll` now resolves assigned-doctor names from the DB into a name cache, so the real name shows.
  (Note: a doctor who takes a case via "Atender" is already auto-assigned — `opened_at` and
  `assigned_doctor_id` are set together in `openConsultation`; the bug was only in how the name
  displayed.) File: `pages/admin/dashboard.tsx`.
- **Restored missing `admin_seguimiento` / `nota_admin` columns in the schema** — the two admin
  follow-up columns had been dropped from `supabase_schema.sql` during the branch/stash mess, even
  though the dashboard reads and writes them. Re-added the idempotent `add column if not exists`
  alters so a fresh setup (or a re-run) has them. File: `supabase_schema.sql`.
- **Instruction screenshot in the pre-join modal** — added `public/instruccion-jitsi.png` and showed
  it inside the `/sala-espera` "Antes de entrar" warning modal, captioned "Si te aparece esta
  pantalla, toca «Unirse en el navegador»", so patients who still hit Jitsi's app/browser screen know
  which option to tap. Files: `public/instruccion-jitsi.png` (new), `pages/sala-espera.tsx`.
- **Skip Jitsi "descarga la app" screen — open straight in the browser** — added a `browserRoomUrl`
  helper that appends `config.disableDeepLinking=true` (+ nested `deeplinking.disabled`) to the room
  URL, so mobile users skip the "open in app / continue in browser" interstitial and land directly in
  the call. Applied at every open point (patient waiting room, doctor "Atender", doctor case-detail
  link), so it also fixes rooms already stored in the DB. Files: `lib/jitsi.ts`, `pages/sala-espera.tsx`,
  `pages/panel-medico.tsx`, `pages/panel-medico/consulta/[id].tsx`.
- **Cases table "Fechas": A/B/C/D milestones + legend** — the Fechas column now shows four
  timestamps with a color legend above the table: **A** El paciente registró su caso (`created_at`),
  **B** El paciente ingresó en la videollamada (`entered_call_at`, new), **C** Un médico de la
  especialidad ingresó en la videollamada (`opened_at`), **D** El médico asignado cerró el caso
  (`closed_at`). Added `entered_call_at` to the dashboard `Consultation` type. File:
  `pages/admin/dashboard.tsx`.
- **Admin-panel contacted label** — the cases-table toggle now reads **"Ya fue contactado" /
  "No ha sido contactado"** instead of "Sí/No". File: `pages/admin/dashboard.tsx`.
- **KPI semantics: "esperando" = entered the call; "en progreso" broadened** — "Consultas esperando"
  now counts a case **only after the patient clicks "Entrar a la videoconsulta"** (not the moment
  they submit the form). Added `consultations.entered_call_at` + a `mark_patient_entered_call` RPC
  called from `/sala-espera` on that click (fire-and-forget, sets the timestamp once via `coalesce`);
  the KPI query gates on `status='waiting' AND entered_call_at IS NOT NULL`. Renamed "Consultas
  abiertas" → **"Consultas en progreso"**, now counting `in_progress + referred_to_specialist +
urgent_in_person + patient_no_show + cancelled` (everything past the queue that isn't a formal
  close). Files: `supabase_schema.sql` (column + RPC), `pages/sala-espera.tsx`,
  `pages/admin/dashboard.tsx`. Needs one additive prod migration (the column + RPC).
- **Resolved stray `git stash` conflicts** — `dashboard.tsx` and `changeslog.md` had unresolved
  `Updated upstream`/`Stashed changes` markers that broke the build; kept our current work and
  restored two definitions the stash had dropped (`Consultation.admin_seguimiento` / `nota_admin`
  fields and the `superAdmins` list). Files: `pages/admin/dashboard.tsx`, `changeslog.md`.
- **Admin dashboard mobile polish + searchable doctor picker** — made `/admin/dashboard` denser on
  phones (scoped `.dash-page` styles): KPIs show **2 per row** on mobile (not a tall 1-col stack),
  tighter page/card padding, and the cases/médicos tables now **scroll horizontally with readable
  columns** (`min-width`) instead of crushing. Replaced the "Médico asignado" `<select>` with a
  **searchable combobox that queries the DB** (debounced `ilike` on name/specialty/email, 20 results)
  so it reaches all ~2386 doctors, not just the loaded 1000. File: `pages/admin/dashboard.tsx`.
- **Cases table: open/closed row colors + wider search + trash icon** — rows are tinted **red while
  open, green when closed** (closed = only `closed`/`closed_by_admin`; everything else, incl.
  cancelled/no-show, counts as open). The cases search now also matches **teléfono, cédula, email**
  (not just name/código/zona). The delete action is a consistent inline **SVG trash icon** and the
  "Acciones" header is now a minimal **×**. File: `pages/admin/dashboard.tsx`.
- **Cases table: fully inline editing + column consolidation** — consolidated related fields into
  fewer, wider columns and made them editable straight from the row (no "Gestionar" needed): an
  **"Admin panel"** column (Sí/No contactado + super_admin follow-up dropdown + admin-note box), the
  **"Nota médico"** editor moved under the **Médico** column, and a **"Contacto"** column stacking
  phone/cédula/email **color-coded** (no labels; hover shows which is which). Removed the "Gestionar"
  button (the patient name is now the click target to open the manage panel) and replaced the 🗑 with
  a clear red **"Eliminar"** button. Timestamps now render in **Venezuela time (America/Caracas)**
  regardless of the viewer's browser. Files: `pages/admin/dashboard.tsx`,
  `pages/panel-medico/consulta/[id].tsx`.
- **Cases table: inline "Estado" dropdown + date-times** — the Estado column is now a `<select>` that
  changes the case status **inline** (optimistic save + audit event, sets `closed_at` on close
  statuses) without opening "Gestionar caso". The Fechas column now shows **date + time** for Creada
  / Abierta / Cerrada (new `fmtDateTime` helper). File: `pages/admin/dashboard.tsx`.
- **Contactado column simplified** — the cell now shows a compact clickable **"Sí"/"No"** (green/grey)
  instead of a checkbox + badge, and the header was renamed to **"Paciente contactado por admins"**.
  File: `pages/admin/dashboard.tsx`.
- **Cases table layout tweaks** — gave the phone its own **"Teléfono"** column (out of the Paciente
  cell), dropped the redundant **"Necesidades"** line (Categoría already shows it) and renamed that
  column **"Categoría / motivo"**, and re-balanced the fixed column widths. File:
  `pages/admin/dashboard.tsx`.
- **Admin case follow-up fields + "Nota médico" rename** — added two admin-only fields on
  `consultations`: `admin_seguimiento` (uuid FK to `profiles` — which super_admin is following up the
  case, chosen from a dropdown of super_admins) and `nota_admin` (free-text admin note). Both are
  edited in the "Gestionar caso" panel and shown in a new "Seguimiento" column of the cases table.
  Renamed the doctor's note label "Nota interna" / "Nota operativa interna" (`internal_note`) →
  **"Nota médico"** across the dashboard and the doctor case-detail page. Files:
  `supabase_schema.sql`, `pages/admin/dashboard.tsx`, `pages/panel-medico/consulta/[id].tsx`. Needs
  one additive prod migration (the two columns). Also parked a per-specialty fixed-Jitsi-room idea in
  `.knowledge/TODOs.md`.

## 2026-06-30

- **Médicos table: server-side pagination + staff-only** — replaced the client-side filter over the
  capped 1000-row profiles array with a server-side query (`count: 'exact'` + `.range()`, 50/page,
  debounced search, role/state/date filters applied in the DB), so all ~2386 doctors are reachable.
  The table is now **staff-only** (`role in doctor/specialist/admin/super_admin`) — patients never
  appear — and `patient` was removed from the role filter. File: `pages/admin/dashboard.tsx`.
- **"Especialidades conectadas ahora" on the admin panel** — added a small list in the Médicos tab
  showing the specialties of the currently-online doctors (specialty → count, green badges), so
  admins can see at a glance which specialties have doctors connected right now. Also fixed a
  Prettier line-length violation in `loadAll` that was failing CI. File: `pages/admin/dashboard.tsx`.
- **Admin dashboard KPIs now use exact counts** — the doctor/consultation KPIs were derived from
  fetched arrays capped at PostgREST's 1000/200-row limits, so with ~2667 profiles "Médicos
  registrados" showed 863 instead of the real ~2386. Replaced them with `count: 'exact'` queries
  (doctors, online doctors, total/ waiting/open/closed/referred/urgent consultations). Tables are
  still capped (pagination is the planned follow-up). File: `pages/admin/dashboard.tsx`.
- **Optional patient email + "Cerrada por admin" status** — added an optional contact email on the
  patient form (`patients.email`), shown in the admin cases table and the doctor's case-detail page
  as a fallback when the phone fails. Added a new admin-only `closed_by_admin` status ("Cerrada por
  admin") selectable from the dashboard (sets `closed_at`); doctors' active views are unaffected
  since closed cases already drop out. Files: `pages/registro-paciente.tsx`,
  `pages/admin/dashboard.tsx`, `pages/panel-medico/consulta/[id].tsx`, `lib/utils.ts`,
  `supabase_schema.sql`. Needs two additive prod migrations (email column + status constraint).
- **Cases table: even space distribution + sortable columns** — switched the Pacientes/Casos table
  to `table-layout: fixed` with per-column widths (colgroup) so it distributes horizontal space
  evenly and wraps instead of overflowing; made every column header click-to-sort (asc/desc with a
  ▲/▼ indicator, defaults to newest-first). Also tightened the inline note field (smaller text +
  padding) and shrank the row action buttons. File: `pages/admin/dashboard.tsx`.
- **Cases table: "Contactado" flag, inline note editing, less duplication** — added an admin
  follow-up toggle (`consultations.contacted` column) with a checkbox/badge in the Pacientes/Casos
  table; made "Nota interna" editable inline (save per row); removed the redundant "Descripción"
  line (it duplicated "Motivo"). Files: `pages/admin/dashboard.tsx`, `supabase_schema.sql`. Needs a
  one-line prod migration to add the `contacted` column.
- **Moved the change log to a root `changeslog.md`** (previously `.knowledge/lastchanges.md`).
  Files: `changeslog.md`, `CLAUDE.md`, `AGENTS.md`.
- **Admin dashboard reorganized into two tabs + full info + patient deletion** — split
  `/admin/dashboard` into **Pacientes / Casos** and **Médicos y administradores** tabs. Both tables
  now show the relevant detail (patient: cédula, teléfono, zona, edad, necesidades, motivo,
  descripción, fechas, nota; doctor: especialidad, país, WhatsApp, licencia, verificado). Added a
  super-admin-only delete (red button in the manage panel + a 🗑 row action) that calls the new
  `admin_delete_patient` RPC behind a confirmation modal. Files: `pages/admin/dashboard.tsx`,
  `supabase_schema.sql` (RPC).
- **FK cascade fix for patient deletes** — live DB FKs were `NO ACTION`, so deleting a patient
  errored. Schema now re-applies `consultations`/`consultation_events` FKs with `ON DELETE CASCADE`
  idempotently; documented the re-run requirement. Files: `supabase_schema.sql`, `README.md`.
- **Patient presence window widened 5 → 30 min** — patients entering the Jitsi call backgrounded the
  `/sala-espera` heartbeat and greyed out too soon. Files: `pages/panel-medico.tsx`,
  `pages/panel-medico/consulta/[id].tsx`, `README.md`.
- **Warning modal before joining the video call** — tapping "Entrar a la videoconsulta" on
  `/sala-espera` now opens a must-acknowledge modal (write your name / don't leave the call in red)
  before opening the room. File: `pages/sala-espera.tsx`.
- **Self-hosted Jitsi "no operational bridges" runbook** — documented the diagnosis (videobridge
  flapping out of the brewery / boot-order race) and the ordered-restart + systemd-hardening fix.
  File: `README.md` (Operations).
