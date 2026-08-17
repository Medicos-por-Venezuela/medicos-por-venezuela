# Changelog

Reverse-chronological log of completed tasks (newest first). Update this **every time a task is
finished** — see the protocol in [CLAUDE.md](CLAUDE.md) ("Change log protocol").

Each entry: date, a short summary of what changed and why, and the key files/areas touched.

## 2026-08-17

- **Modo mantenimiento del sitio público, tras un feature flag** — `proxy.ts` + `pages/mantenimiento.tsx`.
  Permite dejar **producción** en mantenimiento mientras desarrollo sigue funcionando, porque
  Amplify define las variables por rama: basta con poner `MAINTENANCE_MODE=true` en la de producción.
  - **Qué se cierra y qué no.** Se cierra la ENTRADA (`/`, `/registro-paciente`, `/registro-medico`).
    Siguen abiertas las rutas de personal (`/login-medico`, `/admin/*`, `/panel-medico/*`, `/auth/*`,
    `/elegir-rol`) y —decidido a conciencia— `/sala-espera` y `/mi-caso`: son de pacientes que YA
    enviaron su solicitud, y cerrarlas dejaría a alguien sin el enlace a su sala en mitad de una
    videoconsulta.
  - **En el servidor, no en el cliente.** Sin parpadeo (nadie ve medio segundo un formulario que no
    funciona) y la variable no lleva `NEXT_PUBLIC_`, así que no viaja al navegador.
  - **503, no 200.** La página devuelve `Service Unavailable` con `Retry-After` y `noindex`. Con un
    200, Google indexaría el aviso como si fuera el contenido del sitio; para una organización que
    depende de que la encuentren, unos días así cuestan posicionamiento.
  - **`rewrite`, no `redirect`**: la URL original se queda en la barra, así que al terminar el
    mantenimiento basta recargar.
  - Se usa **`proxy.ts`** y no `middleware.ts`: Next 16 renombró Middleware a Proxy y avisa de que
    el nombre viejo está deprecado.
  - La página incluye el aviso de urgencias (si alguien llega buscando ayuda y el sitio está caído,
    lo mínimo es no dejarlo sin indicación) y un enlace discreto al panel médico. El acceso de
    administración NO se enlaza, como en el resto del sitio.
  - **Verificado sobre un build de producción**, con el flag y sin él: las 9 rutas que deben seguir
    abiertas responden con su página real, las 3 públicas dan 503 con la página de mantenimiento, y
    sin el flag las 12 se comportan como siempre.
  - No es un control de acceso: quien conozca una URL abierta entra igual, que es justo lo que se
    busca para médicos y administradores. La autenticación sigue siendo Supabase + RLS.
  - Archivos: `proxy.ts`, `pages/mantenimiento.tsx`, `.env.example`, `CLAUDE.md`, `AGENTS.md`.

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
