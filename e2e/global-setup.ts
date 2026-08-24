// Setup global de Playwright: siembra dos médicos de prueba (cuenta de Auth + fila en users/doctors
// con cédula, para que el panel cargue sin redirigir a completar perfil) y guarda su sesión de
// Supabase como storageState, de modo que los tests entren ya logueados sin pasar por el form de
// login. Solo usa el Supabase LOCAL (127.0.0.1) — nunca prod.
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { FullConfig } from '@playwright/test'

const ROOT = path.join(__dirname, '..')
const DB_CONTAINER = 'supabase_db_api-medicos-por-venezuela'

function envVar(key: string): string {
  const raw = readFileSync(path.join(ROOT, '.env'), 'utf8')
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))
  if (!line) throw new Error(`Falta ${key} en .env`)
  return line.slice(key.length + 1).trim()
}

const SUPABASE_URL = envVar('NEXT_PUBLIC_SUPABASE_URL')
const ANON_KEY = envVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE_KEY = envVar('SUPABASE_SERVICE_ROLE_KEY')

const DOCTORS = [
  {
    email: 'e2e-doc1@example.com',
    name: 'E2E Doctor Uno',
    cedula: 'V-88880001',
    file: 'e2e/.auth/doc1.json'
  },
  {
    email: 'e2e-doc2@example.com',
    name: 'E2E Doctor Dos',
    cedula: 'V-88880002',
    file: 'e2e/.auth/doc2.json'
  }
]
const PASSWORD = 'e2e-Test-123456'

async function ensureAuthUser(email: string): Promise<string> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true
  })
  if (created.data?.user) return created.data.user.id
  // Ya existía: lo buscamos y le fijamos la contraseña conocida.
  const list = await admin.auth.admin.listUsers()
  const user = list.data.users.find((u) => u.email === email)
  if (!user) throw new Error(`No pude crear ni encontrar ${email}: ${created.error?.message}`)
  await admin.auth.admin.updateUserById(user.id, { password: PASSWORD })
  return user.id
}

function seedDoctorRow(uid: string, name: string, cedula: string): void {
  const sql = [
    // Idempotencia entre corridas: libera esta cédula de cualquier otro doctor de prueba previo.
    `update public.doctors set cedula=null where cedula='${cedula}' and user_id<>'${uid}';`,
    `update public.users set role='doctor', verified=true, active=true, role_chosen=true, full_name='${name}' where id='${uid}';`,
    `insert into public.doctors (user_id, full_name, cedula) select '${uid}','${name}','${cedula}' where not exists (select 1 from public.doctors where user_id='${uid}');`,
    `update public.doctors set cedula='${cedula}' where user_id='${uid}';`
  ].join(' ')
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -c "${sql}"`, {
    stdio: 'pipe'
  })
}

async function saveSession(email: string, baseURL: string, file: string): Promise<void> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data.session) throw new Error(`Login falló para ${email}: ${error?.message}`)
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0] // '127' para 127.0.0.1
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [{ name: `sb-${ref}-auth-token`, value: JSON.stringify(data.session) }]
      }
    ]
  }
  writeFileSync(path.join(ROOT, file), JSON.stringify(storageState))
}

function cleanupTestData(): void {
  // Borra consultas/pacientes de corridas E2E previas para que cada corrida arranque limpia
  // (si no, se acumulan cards iguales y el localizador strict de Playwright falla).
  const sql = [
    `delete from public.consultations where patient_id in (select id from public.patients where full_name like 'E2E Paciente%');`,
    `delete from public.patients where full_name like 'E2E Paciente%';`
  ].join(' ')
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -c "${sql}"`, {
    stdio: 'pipe'
  })
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = (config.projects[0]?.use?.baseURL as string) || 'http://localhost:3100'
  mkdirSync(path.join(ROOT, 'e2e', '.auth'), { recursive: true })
  cleanupTestData()
  for (const doc of DOCTORS) {
    const uid = await ensureAuthUser(doc.email)
    seedDoctorRow(uid, doc.name, doc.cedula)
    await saveSession(doc.email, baseURL, doc.file)
  }

  // Admin de prueba (solo observa presencia, no es médico) para el test del dashboard.
  const adminUid = await ensureAuthUser('e2e-admin@example.com')
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -c ` +
      `"update public.users set role='admin', verified=true, active=true, role_chosen=true, full_name='E2E Admin' where id='${adminUid}';"`,
    { stdio: 'pipe' }
  )
  await saveSession('e2e-admin@example.com', baseURL, 'e2e/.auth/admin.json')

  // DUAL multi-rol: rol legacy 'doctor' + super_admin ADICIONAL en user_roles (RBAC). Reproduce
  // el caso real "primero doctor, luego se le agrega super_admin": el acceso admin debe salir
  // del multi-rol del backend, no del único profiles.role.
  const dualUid = await ensureAuthUser('e2e-dual@example.com')
  const dualSql = [
    `update public.users set role='doctor', verified=true, active=true, role_chosen=true, full_name='E2E Dual DoctorAdmin' where id='${dualUid}';`,
    // idempotente: agrega super_admin activo solo si no lo tiene ya
    `insert into public.user_roles (user_id, role_id) select '${dualUid}', r.id from public.roles r where r.code='super_admin' and not exists (select 1 from public.user_roles ur where ur.user_id='${dualUid}' and ur.role_id=r.id and ur.revoked_at is null);`
  ].join(' ')
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -c "${dualSql}"`, {
    stdio: 'pipe'
  })
  await saveSession('e2e-dual@example.com', baseURL, 'e2e/.auth/dual.json')

  // Paciente de prueba: el cuarto destino del fan-out de /login (login-fanout.spec.ts). No guarda
  // storageState — ese spec entra por el formulario de verdad, no con la sesión ya puesta.
  const patientUid = await ensureAuthUser('e2e-patient@example.com')
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -c ` +
      `"update public.users set role='patient', active=true, role_chosen=true, full_name='E2E Paciente Login' where id='${patientUid}';"`,
    { stdio: 'pipe' }
  )
}
