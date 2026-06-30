# Médicos por Venezuela

MVP web app connecting **volunteer doctors** with **patients** affected by the emergency in Venezuela.
Patients request orientation (anonymously by default) and are attended by **video consultation**; volunteer
doctors pick up cases from a queue. A private `/admin` area gives operators metrics and case oversight.

- **Live flow:** patient submits a request → a Jitsi video room is created and shown on screen → a doctor
  claims the case from the panel and joins the same room.
- **No separate backend server.** This is a **Next.js frontend + Supabase** (Postgres, Auth, Row Level
  Security). Most data access goes directly from the browser via the Supabase JS client (anon key) and is
  authorized by RLS. The only server code is one Next.js API route (`/api/videoconsulta`).

> For day-to-day AI-assistant context and conventions, see [CLAUDE.md](CLAUDE.md).
> Pending/parked work lives in [.knowledge/TODOs.md](.knowledge/TODOs.md).

---

## Table of contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Routes](#routes)
- [Auth model](#auth-model)
- [Database](#database)
- [Video consultations (Jitsi)](#video-consultations-jitsi)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deployment (Vercel)](#deployment-vercel)
- [Operations](#operations)
- [Security notes](#security-notes)
- [Pending / parked work](#pending--parked-work)

---

## Tech stack

| Layer     | Choice                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| Framework | **Next.js 14.2** (Pages Router) + **React 18** + **TypeScript 5**                  |
| Backend   | **Supabase** (`@supabase/supabase-js` v2) — Postgres, Auth, RLS                    |
| Video     | **Jitsi Meet** (self-hosted, see below)                                            |
| Messaging | **Twilio** WhatsApp/SMS — **PARKED** (compliance pending)                          |
| Hosting   | **Vercel** (serverless API routes + env vars)                                      |
| Styling   | Plain global CSS class names (`card`, `btn`, `kpi`, `table`, …) — no CSS framework |

---

## Architecture

There is **no custom backend server**. "The backend" is a **Supabase project**:

- The Next.js app (repo root) runs almost entirely **client-side** against Supabase using the **anon key**.
  Authorization is enforced by **Row Level Security** policies + Postgres functions/triggers defined in
  [supabase_schema.sql](supabase_schema.sql).
- The **one** server-side route is [pages/api/videoconsulta.ts](pages/api/videoconsulta.ts) (a Vercel
  serverless function). It uses **service-role** secrets that must stay server-only — see
  [lib/supabaseAdmin.ts](lib/supabaseAdmin.ts), which is imported **only** by API routes.

```
Browser ──(anon key + RLS)──────────────► Supabase (Postgres / Auth)
   │
   └──POST /api/videoconsulta──► Vercel serverless ──(service-role)──► Supabase
                                          └─ creates Jitsi room URL
```

### Services

| Service    | Role                                                     |
| ---------- | -------------------------------------------------------- |
| Supabase   | Database (Postgres), authentication, RLS authorization   |
| Vercel     | Hosting, environment variables, serverless API routes    |
| Jitsi Meet | In-browser video rooms (self-hosted instance)            |
| Twilio     | (PARKED — compliance pending) WhatsApp/SMS link delivery |

---

## Project layout

The Next.js app lives at the **repo root** so Vercel builds with default settings (Root Directory = root).

```
pages/                 routes (see below) + api/videoconsulta.ts
components/             shared UI (e.g. GoogleButton.tsx)
lib/
  supabase.ts          browser Supabase client (NEXT_PUBLIC_* env)
  supabaseAdmin.ts     service-role client (API routes only — never client)
  auth.ts              signInWithGoogle() OAuth helper
  jitsi.ts             newRoomUrl() — builds the video room URL
  utils.ts             status labels, specialty list, specialty↔needs matching
supabase_schema.sql    THE BACKEND: tables, triggers, RLS policies, RPCs
.knowledge/            TODOs.md, configuracion-twilio.md
CLAUDE.md              assistant/codebase conventions
```

---

## Routes

| Route                         | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `/`                           | Home — two cards: paciente / médico (no admin link)                         |
| `/registro-paciente`          | Patient request form (public; optional account + Google)                    |
| `/sala-espera`                | Patient confirmation; shows the video room link on screen                   |
| `/registro-medico`            | Doctor self-registration (email+password or Google)                         |
| `/elegir-rol`                 | First-time Google role picker (patient vs doctor)                           |
| `/mi-caso`                    | Patient login + read-only case status                                       |
| `/login-medico`               | Doctor login                                                                |
| `/panel-medico`               | Doctor/admin panel — queue, claim case, active case visibility, counters    |
| `/panel-medico/consulta/[id]` | Case detail page — patient details, video link, note, close/no-show actions |
| `/auth/callback`              | OAuth redirect handler (routes by role / `role_chosen`)                     |
| `/admin` (+ `/admin/login`)   | Private admin login (unlinked, `noindex`)                                   |
| `/admin/dashboard`            | Admin dashboard — metrics, doctor revoke, case oversight                    |
| `/api/videoconsulta`          | **Server** — creates/returns the Jitsi room for a consultation              |

---

## Auth model

- **Patients** can submit a request **anonymously** (default). An account is **optional** — only for those
  who want to follow their case at `/mi-caso`. When created, the `patients` row links to the auth user via
  `user_id`.
- **Doctors** self-register (email+password or Google) with **instant access** (`verified` + `active` set on
  signup). Admins can **revoke** a doctor anytime by setting `active = false` (instant cutoff via
  `current_user_role()`).
- **Admins** are promoted manually via SQL. Private login at `/admin`.
- **Google sign-in:** OAuth can't carry a role, so a first-time Google user gets a placeholder profile
  (`role_chosen = false`) and is routed to `/elegir-rol`. The choice is finalized by the `set_my_role` RPC,
  which can **never** grant admin/specialist.
- **Prereq (Supabase Auth):** "Confirm email" must be **OFF** (instant access + same-session patient insert);
  Google provider enabled; `/auth/callback` in the redirect allow-list.

---

## Database

Defined entirely in [supabase_schema.sql](supabase_schema.sql) (idempotent — safe to re-run). Tables in the
`public` schema:

- **`profiles`** — accounts linked to `auth.users`; roles `patient | doctor | specialist | admin |
super_admin`; `role_chosen` flags whether an OAuth account finalized its role.
- **`patients`** — minimal patient data; insert requires `consent = true`; optional `user_id`. Includes
  `cedula` (collected on the request form).
- **`consultations`** — cases; status `waiting | in_progress | referred_to_specialist | urgent_in_person |
closed | cancelled | patient_no_show`; carries `video_room_url` and `patient_last_seen_at` (presence
  heartbeat).
- **`consultation_events`** — audit trail of status changes.

Functions / RPCs:

- `handle_new_auth_user()` — trigger; creates a `profiles` row from signup metadata (role-aware).
- `set_my_role(...)` — RPC; lets a user finalize their own profile once (patient/doctor only).
- `current_user_role()`, `is_admin()`, `is_staff()` — RLS helpers.
- `mark_myself_online()` — RPC doctors call to update `last_seen_at`.
- `mark_patient_waiting(uuid)` — RPC called by `/sala-espera` to update `patient_last_seen_at`.

RLS is enabled on every table: anon can INSERT patients/consultations; account-holding patients read their
own rows; staff read all; admins manage.

**Cascading deletes:** the schema declares `consultations.patient_id` and
`consultation_events.consultation_id` as `ON DELETE CASCADE`, so deleting a `patients` row also removes its
consultations and audit events. **Note for existing databases:** `create table if not exists` does **not**
fix a foreign key that was first created without cascade, so older DBs may still have `NO ACTION` and reject
a patient delete with a `consultations_patient_id_fkey` violation. The schema now re-applies these
constraints idempotently — **re-run [supabase_schema.sql](supabase_schema.sql)** to bring an existing
database in line, after which patient deletes cascade automatically.

### Case claiming (concurrency)

When a doctor opens a case, the panel performs an **atomic claim**: the update only matches while the case is
still `waiting` (`.eq('status','waiting')`) and verifies a row came back. If another doctor claimed it first
the update affects 0 rows, the doctor sees _"Este paciente ya fue tomado por otro médico"_, and the video
room is **not** opened — preventing two doctors from landing in the same meeting. This complements the RLS
policy, which already blocks reassigning an already-claimed case. After a successful claim, the doctor is
sent to the dedicated case detail page (`/panel-medico/consulta/[id]`) to manage the call. See
[pages/panel-medico.tsx](pages/panel-medico.tsx) (`openConsultation`) and
[pages/panel-medico/consulta/[id].tsx](pages/panel-medico/consulta/[id].tsx).

### Patient presence (waiting-room heartbeat)

A submitted request is not the same as a patient actually waiting. While `/sala-espera` is open it calls the
`mark_patient_waiting` RPC every ~20s, updating `consultations.patient_last_seen_at`. The doctor/admin panel
polls the queue every ~20s and treats a patient as **present** only if seen within `PRESENCE_WINDOW_MS`
(currently 30 minutes — generous, because the heartbeat stops once the patient enters the Jitsi call and
the waiting-room tab is backgrounded). Consequences:

- The "En sala esperando" KPIs count only **present** patients. Each queue card shows **● En sala** or
  **○ Sin conexión**.
- The **"Atender al siguiente paciente"** action prefers present waiting patients, but falls back to the
  oldest eligible `waiting` case if the heartbeat failed, so nobody is blocked by a missed ping.
- At the end of a call the doctor/admin can close a case as **"Paciente no estaba en la sala de espera"** →
  status `patient_no_show` (logged in `consultation_events`), distinct from a normal close.

This is a presence _proxy_ (it tracks the waiting-room tab, not literal Jitsi attendance). For exact in-call
presence, the Jitsi IFrame API would be needed.

### Specialty routing

[lib/utils.ts](lib/utils.ts) maps doctor specialties to patient needs (`SPECIALTY_NEEDS`) and enforces a
**two-way separation** for mental health (`canAttend` / `RESERVED_NEEDS`):

- Psychology needs (_Apoyo emocional_, _Crisis de ansiedad_) only go to **Psicología / Psiquiatría** — never
  fall back to a general doctor.
- A **Psicología** doctor only ever attends psychology cases.

---

## Video consultations (Jitsi)

Patients are attended by video. The room is created server-side and shown on screen (the always-works
channel).

**Flow:** `registro-paciente` POSTs to `/api/videoconsulta` → it generates a Jitsi room
([lib/jitsi.ts](lib/jitsi.ts)) and stores it on `consultations.video_room_url` → the patient lands on
`/sala-espera` with the link shown on screen → a doctor claims the case in `/panel-medico` → the app opens the
same room and navigates to `/panel-medico/consulta/[id]` for the case workflow. The API route is
**idempotent** (one room per consultation).

**Self-hosted instance:** video runs on a self-hosted Jitsi server, not public `meet.jit.si`. Point the app
at it by setting `NEXT_PUBLIC_JITSI_DOMAIN` (bare host, no `https://` / trailing slash) — `lib/jitsi.ts`
builds `https://${domain}/vamed-<uuid>`, so switching servers needs **no code change**. Leave the var empty
to fall back to `meet.jit.si`. TLS on the self-hosted box is managed by **acme.sh** (not certbot), with certs
installed under `/etc/jitsi/meet/`.

---

## Getting started

The "backend" is provisioned entirely in Supabase — there is no local server to start.

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema:** Supabase → SQL Editor → paste & run [supabase_schema.sql](supabase_schema.sql).
3. **Auth settings:** Auth → Email → turn **OFF** "Confirm email"; enable the **Google** provider; add
   `http://localhost:3000/auth/callback` (+ your prod URL) to the redirect allow-list.
4. **Create the first admin** (after the person has signed in once so their `profiles` row exists):
   ```sql
   update public.profiles
   set role = 'super_admin', verified = true, active = true, role_chosen = true,
       full_name = 'Administrador principal'
   where email = 'YOUR_EMAIL@example.com';
   ```
   Then log in at `/admin`.
5. **Get API keys:** Supabase → Project Settings → API → copy the Project URL and anon key.

### Run the frontend locally

```bash
cp .env.example .env        # then fill in the values
npm install
npm run dev                 # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`.

---

## Environment variables

Set in `.env` for local dev and in Vercel for production. See [.env.example](.env.example).

**Browser-exposed (`NEXT_PUBLIC_*`) — safe; RLS enforces access:**

| Var                             | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                              |
| `NEXT_PUBLIC_JITSI_DOMAIN`      | Self-hosted Jitsi host (empty = `meet.jit.si`) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP`  | Optional WhatsApp number shown on `/mi-caso`   |

**Server-only — NEVER prefix with `NEXT_PUBLIC`** (used by `/api/videoconsulta`):

| Var                                            | Purpose                                                |
| ---------------------------------------------- | ------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`                    | Service-role key; lets the API route write video rooms |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`     | Twilio creds (PARKED)                                  |
| `TWILIO_WHATSAPP_NUMBER` / `TWILIO_SMS_NUMBER` | Twilio senders (PARKED)                                |

---

## Deployment (Vercel)

- Connect the GitHub repo; Root Directory = repo root (default); framework auto-detected as Next.js.
- Set all env vars above in **Project → Settings → Environment Variables** (Production, and Preview/Dev as
  needed). `NEXT_PUBLIC_*` values are **baked at build time** — after changing one you must **redeploy**.
- Push to the production branch (`main`) to trigger a deploy. Confirm the new deployment is promoted to
  **Production** and that your custom domain is aliased to it. To isolate a "changes not showing" issue, open
  the deployment-specific `*.vercel.app` URL directly before blaming the domain.

---

## Operations

- **Revoke a doctor:** `/admin/dashboard` → doctor list → **"Revocar acceso"** sets `active = false`, which
  immediately blocks them (`current_user_role()` requires `active = true`). The same button reactivates.
- **Manage cases:** reassign doctor, change status, edit internal note from `/admin/dashboard`.
- **Admin medical panel:** admin/super_admin users can also enter `/panel-medico`; they see normal queue
  cards plus an admin-only **Casos activos del sistema** section for `in_progress`, `urgent_in_person`, and
  `referred_to_specialist` cases, including patient, status, motive, presence, and assignment. Selecting a
  case opens `/panel-medico/consulta/[id]`.
- **Panel counters:** doctors see personal/specialty counters; admins see waiting/present/active-system
  counters. Returning from close/no-show actions refreshes the panel via `/panel-medico?actualizado=1`, and
  the panel also refreshes on focus and polling.

### Jitsi troubleshooting — "calls don't connect with 2+ people"

**Symptom:** patient and doctor can each open/join the room, but a 2-person call never connects (one person
alone looks fine). This is **not** an app bug — the app gives both sides the same `video_room_url`. It is the
self-hosted Jitsi server (DigitalOcean droplet) failing to allocate a media bridge.

**Diagnose (SSH into the droplet):**

```bash
# The decisive log: if you see "There are no operational bridges" / "Can not invite participant",
# jicofo has lost the videobridge.
sudo grep -iE "no operational|lost a bridge|added new videobridge" /var/log/jitsi/jicofo.log | tail -n 3
```

A healthy result ends with **`Added new videobridge`** (no `Lost a bridge` after it). Joining the room is
signaling (prosody/jicofo) and works even when broken; only **media allocation** needs the bridge, which is
why one person alone seems OK.

**Root cause we hit (2026-06):** a **boot-ordering race** — the videobridge connects to prosody before
prosody has finished loading, gets stuck, and never re-registers (`jvb.log` shows
`XMLStreamException: XML document structures must start and end within the same entity`, which is just the
XMPP stream being cut). _Ruled out_ along the way: resources (droplet is idle, no swap), media/NAT/TURN
(public IP is advertised and ICE-nominated correctly), and package version mismatch.

**Immediate fix — ordered restart on the droplet:**

```bash
sudo systemctl restart prosody;             sleep 4
sudo systemctl restart jicofo;              sleep 4
sudo systemctl restart jitsi-videobridge2
```

Then re-run the health check above (expect `Added`) and confirm with a real 2-person call.

**Permanent fix (applied):** a systemd drop-in makes the bridge wait for prosody on boot —
`/etc/systemd/system/jitsi-videobridge2.service.d/override.conf`:

```ini
[Unit]
After=prosody.service network-online.target
Wants=prosody.service network-online.target

[Service]
ExecStartPre=/bin/sleep 15
```

After `sudo systemctl daemon-reload`, this survives `sudo reboot` (the bridge re-registers automatically).

**Emergency stopgap:** set `NEXT_PUBLIC_JITSI_DOMAIN` empty in Vercel and redeploy to fall back to public
`meet.jit.si` — but only **new** patient requests get a jit.si room (existing cases keep their stored
self-hosted URL, since `/api/videoconsulta` is idempotent). jit.si is a third-party public server, so it's a
temporary measure only, not a home for patient PII.

---

## Security notes

- **Instant doctor access is a known trade-off:** anyone who self-registers as a doctor immediately reads all
  patient PII via the `is_staff` RLS read. Mitigation is **admin revocation**, not pre-approval. To switch to
  an approval gate, have signup/`set_my_role` set doctors `verified = false` and gate `current_user_role()`
  on it.
- No service-role key is used client-side. Role escalation is prevented: profile updates are admin-only via
  RLS, and `set_my_role` only finalizes the caller's own profile once (patient/doctor, never admin).
- Doctors update only `last_seen_at` via `mark_myself_online()`.
- Avoid storing full consultation conversations — keep only minimal operational data.
- `/admin` is unlinked from the public UI and `noindex` — that is **not** access control; RLS + the
  admin-role check on the page are.

---

## Pending / parked work

See [.knowledge/TODOs.md](.knowledge/TODOs.md) for the full list. Highlights:

- **Twilio WhatsApp/SMS link delivery — PARKED** (blocked on Twilio compliance review). The on-screen link on
  `/sala-espera` is the primary channel, so this is a backup only.
- **Per-IP rate limiting** on `/api/videoconsulta` before public promotion (anti-abuse/cost).
- **Apex DNS** — verify `medicosporvenezuela.org` 308-redirects to `www` once public DNS caches expire.
- **Exact in-call presence (optional):** the current presence signal is a waiting-room-tab heartbeat proxy;
  wiring the Jitsi IFrame API would give true "in the meeting" presence. The panel already polls every ~20s,
  so claimed patients and presence changes refresh automatically.
