# Médicos por Venezuela

MVP web app connecting volunteer doctors with patients in Venezuela. Self-service email+password
**and Google** registration for doctors and patients, an optional patient account to follow a case,
a doctor panel (video consultations, closes/refers cases), and a private `/admin` section with metrics and
case oversight.

> **Sync rule:** CLAUDE.md and [AGENTS.md](AGENTS.md) must stay consistent. Any update to the stack,
> testing capabilities, or SDD setup here must be reflected in AGENTS.md (and vice versa) in the
> same change.

## Testing capabilities (strict_tdd: false)

**There is still no automated test harness (unit/integration/E2E) in this repo.** Lint and format
ARE now enforced (ESLint + Prettier) — only `test` tooling is missing:

- `package.json` scripts: `dev`, `build`, `start`, `lint`, `format`, `format:check` — no `test` script
- Zero matches for `**/*.test.*` or `**/*.spec.*`
- CI runs lint + build on PRs (`.github/workflows/ci.yml`) but has no test step

| Layer        | Available | Tool / Command                                 |
| ------------ | --------- | ---------------------------------------------- |
| Unit         | ❌        | —                                              |
| Integration  | ❌        | —                                              |
| E2E          | ❌        | —                                              |
| Linter       | ✅        | `pnpm lint` (ESLint, `eslint-config-next`)     |
| Type checker | ✅ manual | `pnpm exec tsc --noEmit` (no dedicated script) |
| Formatter    | ✅        | `pnpm format` / `pnpm format:check` (Prettier) |
| Coverage     | ❌        | —                                              |

Verification after a change means `pnpm build`, `pnpm exec tsc --noEmit`, `pnpm lint`, and manual
QA in the browser — there is no automated test suite to run or extend. Recommendation (not yet
actioned): add Vitest + React Testing Library and a `test` script before enabling Strict TDD mode.

## Contribution standards

Conventional Commits are **enforced** (not just documented) via commitlint + husky (`commit-msg`
hook); a `pre-commit` hook runs `lint-staged` (ESLint --fix + Prettier) on staged files. Hooks
install automatically on `pnpm install` via the `prepare` script. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, and
[.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) for the PR format.

### Change log protocol

**Every time a task is finished, update [changeslog.md](changeslog.md)** as
the final step. Add a short entry at the top (newest first) — one or two lines on what changed and
why, plus the key files/areas touched — grouping same-day work under a single `## YYYY-MM-DD`
heading. This is the running history of the project; keep entries concise and factual.

**Tras un rebase, re-audita la entrada del changelog de esa rama**: si un fix del PR quedó
supersedido por la base (la base ya lo traía, o lo reemplazó por algo mejor), la entrada ya no
debe atribuírselo — deja una "nota del rebase" con qué se descartó y por qué. Un changelog que
promete cambios que el diff ya no contiene es un bug de documentación (lección del review
2026-07-14).

### Lecciones de code review (reglas de diseño, cumplimiento estricto)

- **Realtime + `setState`: SIEMPRE functional updates** (`setX(prev => …)`) en páginas con
  suscripción Realtime. Un `setX({ ...objetoCapturado, campo })` después de un `await` pisa lo
  que Realtime aplicó durante la espera (p.ej. un cierre hecho por un admin en paralelo).
- **Finalizar/tomar estados contra Supabase = escritura condicional.** Ocultar el botón
  (`isCaseClosed`) es solo render: la escritura debe filtrar por el estado esperado
  (`.not('status', 'in', '(…estados finales…)')` + `.select()`, tratando 0 filas como "otro
  ganó"). Ojo: `window.confirm` bloquea el event loop y ENCOLA los mensajes Realtime — al
  aceptar, tu estado local puede estar viejo aunque "acabes de mirarlo".
- **Modales: usa el `ConfirmDialog` compartido** (`components/admin/ConfirmDialog.tsx`), que ya
  trae Escape + foco inicial. No introduzcas `window.confirm` nuevos ni diálogos inline
  copiados; si reemplazas un `window.confirm`, el reemplazo debe conservar su accesibilidad
  nativa (Escape, foco), no perderla.
- **Un estado de error por fuente.** Si dos fetches comparten un `error` state, el
  `setError('')` de uno borra el aviso del otro. Cada fallo con recuperación distinta (lista vs
  catálogos del pool, p.ej.) lleva su propio estado.
- **Todo gating de UI nuevo (p.ej. "caso finalizado") nace con su spec E2E** en `e2e/`. Los
  specs existentes cubren flujos felices; un gating sin spec se rompe en silencio en el
  siguiente refactor.

## SDD (Spec-Driven Development) setup

This project is initialized for SDD-based work via the `sdd-init` skill:

- **Persistence backend:** `engram` (no `openspec/` directory — artifacts live in persistent memory)
- **Skill registry:** `.atl/skill-registry.md` (+ cache)
- **Strict TDD mode:** disabled (see Testing capabilities above)

Engram topic keys: `sdd-init/medicos-por-venezuela` (project context),
`sdd/medicos-por-venezuela/testing-capabilities`, and per-change keys
`sdd/{change-name}/{explore|proposal|spec|design|tasks|apply-progress|verify-report|archive-report}`.
Recover via `mem_search(query: "{topic_key}", project: "medicos-por-venezuela")` →
`mem_get_observation(id)`.

## Auth model (current)

- **Patients:** can submit a request **anonymously** (default). An account is **optional** — only for
  patients who want to follow their case at `/mi-caso`. When created, the `patients` row links to the
  auth user via `user_id`.
- **Doctors:** self-register (email+password only — Google sign-up was removed from `/registro-medico`)
  with **instant access** (`verified` + `active` set on signup). Admins can **revoke** a doctor anytime
  by setting `active = false` (instant cutoff via `current_user_role()`). Separately, the SACS/FPV
  credential check now lives in the dedicated backend (see Architecture below) as a `doctors` row —
  that row has no relationship to the `profiles`/auth account created here; they're linked only by
  matching email.
- **Admins:** promoted manually via SQL. Private login at `/admin` (not linked from the landing page);
  manage cases (reassign doctor, change status, edit note) from `/admin/dashboard`.
- **Google sign-in:** OAuth can't carry a role, so a first-time Google user gets a placeholder profile
  (`role_chosen = false`) and is routed to `/elegir-rol` to pick patient vs doctor. The choice is
  finalized by the `set_my_role` RPC, which can never grant admin/specialist. A Google user who picks
  **doctor** still has no cédula/`doctors` row (a `source:"user"` profile from `/doctors/me`): on
  entering `/panel-medico` they're **auto-redirected to `/panel-medico/perfil`** to complete it —
  they pick their professional type, enter their cédula (verified live against SACS/FPV, then again
  server-side on save via `PATCH /doctors/me`), and the backend creates their `doctors` row.
- **`handle_new_auth_user()`** reads `role` (+ doctor fields) from signup metadata; email signups are
  finalized immediately, OAuth signups stay `role_chosen = false`.
- **Prereq:** Supabase → Auth → Email "Confirm email" must be **OFF** (instant access + same-session
  patient insert), the Google provider enabled, and `/auth/callback` in the redirect allow-list.
- The legacy `doctor_applications` table has been **retired/dropped**.

## Architecture (important)

This used to be a **Next.js frontend + Supabase BaaS only** app. That's now **partially true** —
migration to a dedicated backend is in progress:

- **Auth stays on Supabase**: `supabase.auth.signUp()`/`getSession()` run directly from the browser
  against a Supabase project (anon key). Identity/session issuance has not moved.
- **A separate FastAPI backend now exists** (`api-medicos-por-venezuela`, sibling repo) and owns
  doctor registration, patient registration, and consultation creation: `pages/registro-medico.tsx`
  and `pages/registro-paciente.tsx` call it directly via `lib/doctors.ts`/`lib/patients.ts`
  (`POST /api/v1/doctors`, `POST /api/v1/patients`, `POST /api/v1/consultations`), base URL from
  `NEXT_PUBLIC_API_URL` (see `.env.example`). It also serves the **doctor self-service profile**
  (`/panel-medico/perfil` via `GET`/`PATCH /api/v1/doctors/me`, resolved from the Supabase JWT —
  no id sent, IDOR-safe) and the médico pool (`GET /api/v1/doctors/pool`). That backend connects to
  its own Postgres as owner (bypasses Supabase RLS) and does its own rate-limiting/anti-bot/RBAC —
  see its own CLAUDE.md. The shared REST client is [lib/apiClient.ts](lib/apiClient.ts) (Supabase
  JWT as `Authorization: Bearer`, `ApiError` carrying `.status`, Pydantic-`422` message flattening).
- **Everything else** (queue/panel-medico, admin dashboard, `/mi-caso`, specialty/zone catalog
  fallbacks in `lib/api.ts`) still goes directly from the browser through the Supabase JS client
  using the **anon key** + RLS; logic lives in RLS policies + Postgres functions/triggers in
  [supabase_schema.sql](supabase_schema.sql). Auditing RLS policies alone no longer tells the full
  story for doctor/patient/consultation writes — check the FastAPI repo's own security rules too.
- One server-side **API route** exists in this repo: `pages/api/videoconsulta.ts` (Vercel serverless
  function). It uses the Twilio + Supabase **service-role** secrets, which must stay server-only —
  see [lib/supabaseAdmin.ts](lib/supabaseAdmin.ts) (imported only by API routes).

## Tech stack

- **Next.js 14.2** (Pages Router) + **React 18** + **TypeScript 5**
- **Supabase** (`@supabase/supabase-js` v2) — Postgres DB, Auth (email/password), RLS
- **No WhatsApp contact in-app** — patients are attended by video; the patient phone is stored only
  for optional follow-up, the doctor's phone only for admin use (never shared)
- **Vercel** — hosting/deploy target (env vars configured there)
- No CSS framework — plain global CSS class names (`card`, `btn`, `kpi`, `table`, etc.)
- **Mobile-first, always responsive** — design and build every screen for small viewports first,
  then progressively enhance for larger ones. All UI must remain fully responsive across phones,
  tablets, and desktops (fluid layouts, responsive breakpoints, touch-friendly targets).

## Services used

| Service     | Role                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase    | Database (Postgres), authentication, RLS authorization                                                                                                        |
| FastAPI API | Separate backend (`api-medicos-por-venezuela`) — REST `/api/v1/*`; doctor self-profile + SACS/FPV verification                                                |
| Vercel      | Hosting, environment variables, serverless API routes                                                                                                         |
| Twilio      | (PARKED — compliance pending) would send video links via WhatsApp/SMS                                                                                         |
| Jitsi Meet  | In-browser video rooms on our **self-hosted** instance `meet.medicosporvenezuela.org` (open rooms, no moderator login; public `meet.jit.si` now requires one) |

## Project layout

The Next.js app lives at the **repo root** (so Vercel builds with default settings — Root Directory = root).

- `pages/` — routes (see below)
- `lib/supabase.ts` — Supabase client (reads `NEXT_PUBLIC_*` env vars)
- `lib/apiClient.ts` — FastAPI REST client (`NEXT_PUBLIC_API_URL`, Supabase JWT as Bearer, `ApiError`)
- `lib/doctors.ts` — doctor REST endpoints (`/doctors/me` self-profile, specialties catalog)
- `lib/auth.ts` — `signInWithGoogle()` OAuth helper (redirects to `/auth/callback`)
- `lib/utils.ts` — status labels, specialty list, specialty↔needs matching (`matchesSpecialty`, `canAttend`)
- `components/` — shared UI (e.g. `GoogleButton.tsx`)
- `supabase_schema.sql` — **the backend**: tables, triggers, RLS policies, RPCs (run in Supabase)

### Routes (`pages/`)

- `/` — home (two cards: paciente / médico; no admin link)
- `/registro-paciente` — patient request form (public; optional account + Google)
- `/sala-espera` — patient confirmation (anonymous submissions)
- `/registro-medico` — doctor self-registration (email+password or Google)
- `/elegir-rol` — first-time Google role picker (patient vs doctor)
- `/mi-caso` — patient login + read-only case status
- `/login-medico` — doctor login
- `/panel-medico` — doctor/admin panel (queue, active system cases for admin, counters)
- `/panel-medico/consulta/[id]` — case detail page (patient details, video, note, close/no-show)
- `/panel-medico/perfil` — doctor self-service profile (view/edit; FastAPI `GET`/`PATCH /doctors/me`);
  also where a `source:"user"` (Google) doctor completes their cédula + professional type to be verified
- `/auth/callback` — OAuth redirect handler (routes by role / role_chosen)
- `/admin` (+ `/admin/login` alias) — private admin login
- `/admin/dashboard` — admin dashboard (metrics, doctor revoke, case oversight)

## Database (Supabase Postgres)

Defined in [supabase_schema.sql](supabase_schema.sql). Tables (`public` schema):

- `profiles` — accounts (linked to `auth.users`); roles: `patient | doctor | specialist | admin | super_admin`;
  `role_chosen` flags whether an OAuth account has finalized its role
- `patients` — minimal patient data; insert requires `consent = true`; optional `user_id` links to an account
- `consultations` — cases; status `waiting|in_progress|referred_to_specialist|urgent_in_person|closed|cancelled|patient_no_show`
- `consultation_events` — audit trail of status changes

Postgres functions / RPCs:

- `handle_new_auth_user()` — trigger; creates a `profiles` row from signup metadata (role-aware)
- `set_my_role(...)` — RPC; lets a user finalize their own profile once (patient/doctor only)
- `current_user_role()`, `is_admin()`, `is_staff()` — RLS helpers
- `mark_myself_online()` — **legacy/vestigial**: doctor online status now uses Supabase Realtime
  **Presence** (`lib/presence.tsx`, channel `online-doctors`), no DB writes. Nobody calls this RPC
  anymore (cleanup pending); do not base new logic on `profiles.last_seen_at`.
- `mark_patient_waiting(uuid)` — RPC called by `/sala-espera` to update `patient_last_seen_at`
  (patient presence is still a DB heartbeat — only the doctor side moved to Presence)

RLS is enabled on all tables. Anon can INSERT patients/consultations; account-holding patients read
their own rows; staff read all; admins manage.

## Getting started (the backend = Supabase)

The "backend" is provisioned entirely in Supabase — there is no local server to start.

1. **Create a Supabase project** at supabase.com.
2. **Run the schema**: Supabase → SQL Editor → paste & run [supabase_schema.sql](supabase_schema.sql).
   (Idempotent — safe to re-run; it creates/updates tables, triggers, RLS policies, and RPCs.)
3. **Auth settings:** Auth → Email → turn **OFF** "Confirm email"; enable the **Google** provider
   (client id/secret); add `http://localhost:3000/auth/callback` (+ your prod URL) to Auth → URL
   Configuration redirect allow-list.
4. **Create the first admin** (after the person has signed in once so their `profiles` row exists,
   e.g. registered as a doctor or via Google):
   ```sql
   update public.profiles
   set role = 'super_admin', verified = true, active = true, role_chosen = true,
       full_name = 'Administrador principal'
   where email = 'YOUR_EMAIL@example.com';
   ```
   Then log in at `/admin`.
5. **Get API keys**: Supabase → Project Settings → API → copy the Project URL and anon key.

### Run the frontend locally

```bash
cp .env.example .env        # then fill in the values below
pnpm install
pnpm dev                    # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm format`.

> Pre-commit (husky + lint-staged) and commit-msg (commitlint) hooks install automatically via the
> `prepare` script on `pnpm install`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the commit
> convention and code-standards workflow.

### Environment variables

Set in `.env` for local dev, and in Vercel for production:

Browser-exposed (`NEXT_PUBLIC_*`, fine — RLS enforces access):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — base URL of the FastAPI backend (`/api/v1/*`); defaults to
  `http://localhost:8000` if unset

Server-only (**never** prefix with `NEXT_PUBLIC`, and **never** set them in Amplify — no runtime
code reads them since `pages/api/videoconsulta.ts` was removed):

- `SUPABASE_SERVICE_ROLE_KEY` — local `.env` only; `e2e/global-setup.ts` uses it to seed the test
  doctors against the LOCAL Supabase (never prod). Without it, `pnpm test:e2e` fails.
- `TWILIO_*` (PARKED — see TODOs; not needed while link delivery is on-screen only)

## Video consultations (Jitsi)

Patient self-service flow: a patient submits a request → [registro-paciente.tsx](pages/registro-paciente.tsx)
POSTs to [pages/api/videoconsulta.ts](pages/api/videoconsulta.ts), which generates a Jitsi room
([lib/jitsi.ts](lib/jitsi.ts)) and stores it on `consultations.video_room_url`. The patient lands on
`/sala-espera` with the room link shown **on-screen** (the primary, always-works channel) and waits for a
doctor. (The route also contains a **parked** Twilio WhatsApp/SMS send — disabled pending Twilio
compliance; see [.knowledge/TODOs.md](.knowledge/TODOs.md). No links are sent via WhatsApp today.)

Doctors use **"Atender al siguiente paciente"** in [panel-medico.tsx](pages/panel-medico.tsx),
which assigns the next eligible `waiting` case (preferring present patients; falling back to waiting cases if
heartbeat failed), opens the same Jitsi room, and navigates to
`/panel-medico/consulta/[id]` for details/actions. Reserved needs (psychology: _Apoyo emocional_ / _Crisis de
ansiedad_) only go to Psicología/Psiquiatría and never fall back to general doctors (`canAttend` in
[lib/utils.ts](lib/utils.ts)). The API route is idempotent (one room per consultation).

Admins/super_admins can also use `/panel-medico`: they keep a link back to `/admin/dashboard`, see admin
counters plus an admin-only **Casos activos del sistema** section for `in_progress`, `urgent_in_person`, and
`referred_to_specialist` cases (patient, status, motive, presence, assignment), and open those cases in the
same `/panel-medico/consulta/[id]` detail page. Closing/no-show actions return to
`/panel-medico?actualizado=1`; the panel refreshes counters on that flag and focus, and the queue
itself updates via Supabase Realtime (`postgres_changes` on `consultations`) — no polling.

### Revoking a doctor (operational)

In `/admin/dashboard`, the doctor list has a **"Revocar acceso"** button → sets `active = false`,
which immediately blocks the doctor (`current_user_role()` requires `active = true`). Reactivate with
the same button.

## Security notes

- **Instant doctor access is a known trade-off:** anyone who self-registers as a doctor immediately
  reads all patient PII via the `is_staff` RLS read. Mitigation is admin revocation, not pre-approval.
  To switch to an approval gate later, have signup/`set_my_role` set doctors `verified = false` and
  gate `current_user_role()` on it.
- No service-role key is used client-side. Role escalation is prevented: profile updates are
  admin-only via RLS, and `set_my_role` only finalizes the caller's own profile once (patient/doctor,
  never admin/specialist).
- Doctor online status is Supabase Realtime **Presence** (app-level, no DB writes): only active
  doctors `track` themselves, and only staff subscribe to the channel (see `lib/presence.tsx`).
- Avoid storing full consultation conversations — only minimal operational data is kept.
- `/admin` is unlinked from the public UI and marked `noindex`; it is not a real access control —
  RLS + the admin-role check on the page are.
