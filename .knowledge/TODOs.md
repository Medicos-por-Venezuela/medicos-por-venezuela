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
