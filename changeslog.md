# Changelog

Reverse-chronological log of completed tasks (newest first). Update this **every time a task is
finished** — see the protocol in [CLAUDE.md](CLAUDE.md) ("Change log protocol").

Each entry: date, a short summary of what changed and why, and the key files/areas touched.

## 2026-07-01

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
