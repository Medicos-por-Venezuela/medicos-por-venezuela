# Changelog

Reverse-chronological log of completed tasks (newest first). Update this **every time a task is
finished** — see the protocol in [CLAUDE.md](CLAUDE.md) ("Change log protocol").

Each entry: date, a short summary of what changed and why, and the key files/areas touched.

## 2026-06-30

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
