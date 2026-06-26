-- Médicos por Venezuela MVP schema
-- Run this in Supabase > SQL Editor before deploying the website.
-- Best used in a new Supabase project or after backing up existing data.

create extension if not exists pgcrypto;

-- 1) Staff profiles linked to Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null,
  role text not null default 'doctor', -- doctor | specialist | admin | super_admin
  specialty text,
  medical_license text,
  country text,
  whatsapp_number text,
  verified boolean not null default false,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('doctor', 'specialist', 'admin', 'super_admin'))
);

alter table public.profiles add column if not exists email text unique;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text default 'doctor';
alter table public.profiles add column if not exists specialty text;
alter table public.profiles add column if not exists medical_license text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists whatsapp_number text;
alter table public.profiles add column if not exists verified boolean default false;
alter table public.profiles add column if not exists active boolean default true;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();

-- 2) Doctor volunteer applications. These are NOT login accounts yet.
create table if not exists public.doctor_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  specialty text not null,
  country text not null,
  medical_license text,
  whatsapp_number text not null,
  availability text,
  status text not null default 'pending', -- pending | approved | rejected
  created_at timestamptz not null default now(),
  constraint doctor_applications_status_check check (status in ('pending', 'approved', 'rejected'))
);

-- 3) Patients. Keep this minimal; avoid storing more health data than needed.
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_whatsapp text not null,
  affected_zone text not null,
  age_range text,
  needs_tags text[] not null default '{}',
  description text,
  consent boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.patients add column if not exists age_range text;
alter table public.patients add column if not exists needs_tags text[] default '{}';
alter table public.patients add column if not exists description text;
alter table public.patients add column if not exists consent boolean default false;
alter table public.patients add column if not exists consent_at timestamptz;
alter table public.patients add column if not exists created_at timestamptz default now();

-- 4) Consultations/cases. WhatsApp messages are not stored here.
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  code text unique not null,
  status text not null default 'waiting', -- waiting | in_progress | referred_to_specialist | urgent_in_person | closed | cancelled
  priority text not null default 'normal',
  category text,
  chief_complaint text,
  assigned_doctor_id uuid references public.profiles(id),
  referred_specialty text,
  internal_note text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consultations_status_check check (status in ('waiting', 'in_progress', 'referred_to_specialist', 'urgent_in_person', 'closed', 'cancelled'))
);

alter table public.consultations add column if not exists category text;
alter table public.consultations add column if not exists chief_complaint text;
alter table public.consultations add column if not exists assigned_doctor_id uuid references public.profiles(id);
alter table public.consultations add column if not exists referred_specialty text;
alter table public.consultations add column if not exists internal_note text;
alter table public.consultations add column if not exists opened_at timestamptz;
alter table public.consultations add column if not exists closed_at timestamptz;
alter table public.consultations add column if not exists created_at timestamptz default now();

-- 5) Events/audit trail for status changes.
create table if not exists public.consultation_events (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  event_type text not null,
  created_by uuid references public.profiles(id) default auth.uid(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_last_seen on public.profiles(last_seen_at);
create index if not exists idx_consultations_status on public.consultations(status);
create index if not exists idx_consultations_assigned on public.consultations(assigned_doctor_id);
create index if not exists idx_consultations_patient on public.consultations(patient_id);
create index if not exists idx_consultation_events_consultation on public.consultation_events(consultation_id);

-- Create a profile automatically when a Supabase Auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, verified, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'doctor',
    false,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Helper functions for RLS
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true and verified = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'super_admin'), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('doctor', 'specialist', 'admin', 'super_admin'), false);
$$;

-- Doctors call this RPC from the browser; they cannot update their profile role/permissions directly.
create or replace function public.mark_myself_online()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set last_seen_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.mark_myself_online() to authenticated;

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.doctor_applications enable row level security;
alter table public.patients enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_events enable row level security;

-- Drop old policies safely
-- profiles
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
-- applications
drop policy if exists applications_insert_public on public.doctor_applications;
drop policy if exists applications_select_admin on public.doctor_applications;
drop policy if exists applications_update_admin on public.doctor_applications;
-- patients
drop policy if exists patients_insert_public on public.patients;
drop policy if exists patients_select_staff on public.patients;
drop policy if exists patients_update_admin on public.patients;
-- consultations
drop policy if exists consultations_insert_public on public.consultations;
drop policy if exists consultations_select_staff on public.consultations;
drop policy if exists consultations_update_staff on public.consultations;
drop policy if exists consultations_update_admin on public.consultations;
-- events
drop policy if exists events_select_staff on public.consultation_events;
drop policy if exists events_insert_staff on public.consultation_events;

-- profiles policies
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (auth.uid() = id or public.is_admin());

create policy profiles_insert_admin
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- doctor applications policies
create policy applications_insert_public
on public.doctor_applications
for insert
to anon, authenticated
with check (true);

create policy applications_select_admin
on public.doctor_applications
for select
to authenticated
using (public.is_admin());

create policy applications_update_admin
on public.doctor_applications
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- patients policies
create policy patients_insert_public
on public.patients
for insert
to anon, authenticated
with check (consent = true);

create policy patients_select_staff
on public.patients
for select
to authenticated
using (public.is_staff());

create policy patients_update_admin
on public.patients
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- consultations policies
create policy consultations_insert_public
on public.consultations
for insert
to anon, authenticated
with check (status = 'waiting' and assigned_doctor_id is null);

create policy consultations_select_staff
on public.consultations
for select
to authenticated
using (public.is_staff());

create policy consultations_update_staff
on public.consultations
for update
to authenticated
using (
  public.current_user_role() in ('doctor', 'specialist')
  and (assigned_doctor_id is null or assigned_doctor_id = auth.uid())
)
with check (
  public.current_user_role() in ('doctor', 'specialist')
  and (assigned_doctor_id = auth.uid() or assigned_doctor_id is null)
);

create policy consultations_update_admin
on public.consultations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- consultation events policies
create policy events_select_staff
on public.consultation_events
for select
to authenticated
using (public.is_staff());

create policy events_insert_staff
on public.consultation_events
for insert
to authenticated
with check (public.is_staff());
