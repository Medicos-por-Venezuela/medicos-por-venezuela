# TODOs / Pending points

## Google authentication

### Dashboard configuration (not in code — must be done manually)

- [ ] **Google Cloud Console**: create an OAuth client (Web application).
  - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
  - Authorized JavaScript origins: `http://localhost:3000` and the Vercel URL.
- [ ] **Supabase → Authentication → Providers → Google**: enable and paste Client ID + Client Secret.
- [ ] **Supabase → Authentication → URL Configuration → Redirect URLs**: add
      `http://localhost:3000/**` and `https://<your-app>.vercel.app/**`.

### Admins signing in with Google

- [ ] New Google users are created by the `handle_new_auth_user` trigger with
      `role = 'doctor'` and `verified = false`. So an admin's **first** Google sign-in
      creates them as an unverified doctor.
- [ ] After that first sign-in, promote them manually in Supabase SQL Editor:
  ```sql
  update public.profiles
  set role = 'super_admin', verified = true, active = true
  where email = 'admin@example.com';
  ```
- [ ] Doctors signing in with Google also need admin approval (`verified = true`)
      before they can access `/panel-medico` — same gate as the email/password flow.

### Possible follow-ups (nice to have)

- [ ] Test the full Google flow locally once the dashboards are configured.
- [ ] Redirect already-logged-in users away from the login page.

## Video consultations — link delivery (Twilio PARKED)

The Jitsi video flow works; only the _messaging_ of the link is parked. The link is already
shown on-screen on `/sala-espera`, so a same-session patient can always join — messaging is a
backup (rejoin later / share with someone).

- **Blocker:** Twilio account needs a compliance review on their side before WhatsApp/SMS will send.
- [ ] **Template-ready WhatsApp send** (parked until Twilio cleared + Meta sender approved):
      add `TWILIO_WHATSAPP_CONTENT_SID`; if set, send with `contentSid` + `contentVariables`
      (`{{1}}` = room URL), else fall back to `body` (sandbox). SMS always uses `body`.
- [ ] Register a **Meta WhatsApp Sender** + approved utility template
      (text in `.knowledge/configuracion-twilio.md`).
- [ ] **Evaluate no-approval delivery alternatives:**
  - **Resend = EMAIL only** (not WhatsApp/SMS). Needs a patient email (anonymous patients
    currently only give a phone, so we'd add an email field). No carrier compliance, easy to
    ship; downside: email is slower/less reliable than WhatsApp in an emergency.
  - Keep on-screen link as the primary channel regardless; add a "copiar enlace" button / QR.
- [ ] Add **per-IP rate limiting** to `/api/videoconsulta` before public promotion (anti-abuse/cost).

## Domain / DNS — apex redirect (double-check pending propagation)

Fixed the iOS "unrelated website" issue: the apex `medicosporvenezuela.org` was pointing to a
Network Solutions parking page (`208.91.197.27`). Repointed it to Vercel.

State as of last check:

- Apex `A @` → `216.150.1.1` (Vercel) at the authoritative NS (ns51/ns52.worldnic.com) ✅
- Cloudflare resolver already returns the new IP ✅; Google (8.8.8.8) still cached the old parking IP ❌
- Vercel apex domain = **Redirect to Another Domain → 308 → www** (correct); `www` is primary/Production
- Vercel still shows **"Invalid Configuration"** only due to the stale public-DNS cache

- [ ] Once Google/other resolvers expire the old cache (up to a few hours), click **Refresh** in
      Vercel → expect it to turn valid and **auto-issue the TLS cert** for the apex.
- [ ] Verify `https://medicosporvenezuela.org` loads and 308-redirects to `www` (test on iOS Safari).
- [ ] Confirm no stale apex `A` record pointing to `208.91.197.27` remains at Network Solutions.
