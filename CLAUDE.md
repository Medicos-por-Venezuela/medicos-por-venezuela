# Médicos por Venezuela

MVP web app connecting volunteer doctors with patients in Venezuela. Self-service email+password
**and Google** registration for doctors and patients, an optional patient account to follow a case,
a doctor panel (video consultations, closes/refers cases), and a private `/admin` section with metrics and
case oversight.

## Auth model (current)

- **Patients:** can submit a request **anonymously** (default). An account is **optional** — only for
  patients who want to follow their case at `/mi-caso`. When created, the `patients` row links to the
  auth user via `user_id`.
- **Doctors:** self-register (email+password or Google) with **instant access** (`verified` + `active`
  set on signup). Admins can **revoke** a doctor anytime by setting `active = false` (instant cutoff
  via `current_user_role()`).
- **Admins:** promoted manually via SQL. Private login at `/admin` (not linked from the landing page);
  manage cases (reassign doctor, change status, edit note) from `/admin/dashboard`.
- **Google sign-in:** OAuth can't carry a role, so a first-time Google user gets a placeholder profile
  (`role_chosen = false`) and is routed to `/elegir-rol` to pick patient vs doctor. The choice is
  finalized by the `set_my_role` RPC, which can never grant admin/specialist.
- **`handle_new_auth_user()`** reads `role` (+ doctor fields) from signup metadata; email signups are
  finalized immediately, OAuth signups stay `role_chosen = false`.
- **Prereq:** Supabase → Auth → Email "Confirm email" must be **OFF** (instant access + same-session
  patient insert), the Google provider enabled, and `/auth/callback` in the redirect allow-list.
- The legacy `doctor_applications` table has been **retired/dropped**.

## Architecture (important)

There is **no separate backend server**. This is a **Next.js frontend + Supabase BaaS**:

- The Next.js app (at the repo root) runs entirely client-side against Supabase.
- "The backend" = a **Supabase project** providing Postgres, Auth, and Row Level Security.
- Most data access goes directly from the browser through the Supabase JS client using the
  **anon key** + RLS; logic lives in RLS policies + Postgres functions/triggers in
  [supabase_schema.sql](supabase_schema.sql).
- One server-side **API route** exists: `pages/api/videoconsulta.ts` (Vercel serverless function).
  It uses the Twilio + Supabase **service-role** secrets, which must stay server-only — see
  [lib/supabaseAdmin.ts](lib/supabaseAdmin.ts) (imported only by API routes).

## Tech stack

- **Next.js 14.2** (Pages Router) + **React 18** + **TypeScript 5**
- **Supabase** (`@supabase/supabase-js` v2) — Postgres DB, Auth (email/password), RLS
- **No WhatsApp contact in-app** — patients are attended by video; the patient phone is stored only
  for optional follow-up, the doctor's phone only for admin use (never shared)
- **Vercel** — hosting/deploy target (env vars configured there)
- No CSS framework — plain global CSS class names (`card`, `btn`, `kpi`, `table`, etc.)

## Services used

| Service   | Role                                                              |
|-----------|------------------------------------------------------------------|
| Supabase  | Database (Postgres), authentication, RLS authorization           |
| Vercel    | Hosting, environment variables, serverless API routes            |
| Twilio    | (PARKED — compliance pending) would send video links via WhatsApp/SMS |
| Jitsi Meet| Free in-browser video rooms (`meet.jit.si`, no server/keys)      |

## Project layout

The Next.js app lives at the **repo root** (so Vercel builds with default settings — Root Directory = root).

- `pages/` — routes (see below)
- `lib/supabase.ts` — Supabase client (reads `NEXT_PUBLIC_*` env vars)
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
- `mark_myself_online()` — RPC doctors call to update `last_seen_at` (granted to `authenticated`)
- `mark_patient_waiting(uuid)` — RPC called by `/sala-espera` to update `patient_last_seen_at`

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
npm install
npm run dev                 # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`.

### Environment variables

Set in `.env` for local dev, and in Vercel for production:

Browser-exposed (`NEXT_PUBLIC_*`, fine — RLS enforces access):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only (used by `pages/api/videoconsulta.ts`; **never** prefix with `NEXT_PUBLIC`):
- `SUPABASE_SERVICE_ROLE_KEY`
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
`/panel-medico/consulta/[id]` for details/actions. Reserved needs (psychology: *Apoyo emocional* / *Crisis de
ansiedad*) only go to Psicología/Psiquiatría and never fall back to general doctors (`canAttend` in
[lib/utils.ts](lib/utils.ts)). The API route is idempotent (one room per consultation).

Admins/super_admins can also use `/panel-medico`: they keep a link back to `/admin/dashboard`, see admin
counters plus an admin-only **Casos activos del sistema** section for `in_progress`, `urgent_in_person`, and
`referred_to_specialist` cases (patient, status, motive, presence, assignment), and open those cases in the
same `/panel-medico/consulta/[id]` detail page. Closing/no-show actions return to
`/panel-medico?actualizado=1`; the panel refreshes counters on that flag, focus, and polling.

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
- Doctors update only `last_seen_at` via the `mark_myself_online()` RPC.
- Avoid storing full consultation conversations — only minimal operational data is kept.
- `/admin` is unlinked from the public UI and marked `noindex`; it is not a real access control —
  RLS + the admin-role check on the page are.
