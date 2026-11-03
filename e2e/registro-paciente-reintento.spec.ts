// Registro de paciente que se repite o falla a mitad: la cuenta de Auth puede existir ya (un alta
// anterior cayó después del signUp) y el backend puede exigir el pase de verificación de correo.
//
// Ningún test envía el formulario de verdad: el alta manda correos reales desde el backend local.
// Toda la red (catálogos, código, Supabase Auth, alta y consulta) está interceptada con page.route,
// así que no necesitan Supabase ni backend.
import { test, expect, type Page } from '@playwright/test'
import { json, sesionDe } from './red-interceptada'

test.use({ storageState: { cookies: [], origins: [] } })

const EMAIL = 'e2e-paciente-reintento@example.com'
const PASSWORD = 'e2e-Test-123456'
const TOKEN = 'pase-paciente-e2e'

interface Espia {
  altas: Array<Record<string, unknown>>
  envios: Array<Record<string, unknown>>
  logouts: number
  signUps: number
  signIns: number
}

type Signup = 'ok' | 'ya-existe'
type Signin = 'ok' | 'clave-mala'

async function interceptar(
  page: Page,
  opciones: {
    signup?: Signup
    signin?: Signin
    alta?: (intento: number) => { status: number; body: unknown }
  } = {}
): Promise<Espia> {
  const { signup = 'ok', signin = 'ok', alta = () => ({ status: 201, body: PACIENTE }) } = opciones
  const espia: Espia = { altas: [], envios: [], logouts: 0, signUps: 0, signIns: 0 }
  const ahora = new Date().toISOString()

  await page.route(/\/api\/v1\/specialties/, (r) =>
    json(r, [
      {
        id: 'sp-general',
        name: 'Medicina general',
        status: 'active',
        is_mental_health: false,
        mental_health_only: false,
        is_placeholder: false,
        available_for_interconsultation: false,
        created_at: ahora,
        updated_at: ahora,
        deleted_at: null
      }
    ])
  )
  await page.route(/\/api\/v1\/affected-zones\/list/, (r) =>
    json(r, [{ name: 'Miranda', state: 'Miranda' }])
  )
  await page.route(/\/api\/v1\/email-verification\/send/, (r) => {
    espia.envios.push(r.request().postDataJSON())
    return json(r, { sent: true, expires_minutes: 10, resend_seconds: 60 })
  })
  await page.route(/\/api\/v1\/email-verification\/verify/, (r) =>
    json(r, { verification_token: TOKEN, expires_minutes: 15 })
  )
  await page.route(/\/api\/v1\/patients$/, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204 })
    espia.altas.push(r.request().postDataJSON())
    const { status, body } = alta(espia.altas.length)
    return json(r, body, status)
  })
  await page.route(/\/api\/v1\/consultations$/, (r) =>
    json(r, { id: 'c-e2e', access_token: 'tok-sala', status: 'waiting' }, 201)
  )

  // Supabase Auth.
  await page.route(/\/auth\/v1\/signup/, (r) => {
    espia.signUps += 1
    if (signup === 'ya-existe') {
      return json(
        r,
        { code: 422, error_code: 'user_already_exists', msg: 'User already registered' },
        422
      )
    }
    return json(r, sesionDe(EMAIL))
  })
  await page.route(/\/auth\/v1\/token/, (r) => {
    espia.signIns += 1
    if (signin === 'clave-mala') {
      return json(
        r,
        {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials'
        },
        400
      )
    }
    return json(r, sesionDe(EMAIL))
  })
  await page.route(/\/auth\/v1\/logout/, (r) => {
    espia.logouts += 1
    return r.fulfill({ status: 204 })
  })
  // La sala a la que va un alta correcta: no hace falta cargarla.
  await page.route(/\/sala-espera(\?|$)/, (r) => r.fulfill({ status: 200, body: 'sala' }))
  return espia
}

const PACIENTE = { id: 'p-e2e', full_name: 'Ana Paciente' }

// Formulario de adulto. Con `conCuenta` se rellenan también correo y contraseña.
async function rellenarFormulario(page: Page, conCuenta = true, password = PASSWORD) {
  await page.goto('/registro-paciente')
  await page.getByPlaceholder('Ej. 12345678').fill('99990077')
  await page.getByPlaceholder('Ej. María González').fill('Ana Paciente')
  await page.getByPlaceholder('Ej. 4121234567').fill('4120000077')
  if (conCuenta) {
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(password)
  }
  await page.getByPlaceholder('Ej. 4241234567').fill('4240000077')
  await page.locator('label:has-text("Zona") + select').selectOption({ index: 1 })
  await page.getByPlaceholder('Ej. 34').fill('34')
  await page.locator('textarea').fill('Dolor de cabeza persistente desde hace tres días.')
  await page.getByRole('checkbox', { name: /Acepto compartir/ }).check()
  await page.getByRole('checkbox', { name: /acepto los Términos de uso y privacidad/ }).check()
}

async function escribirCodigo(page: Page) {
  const modal = page.getByRole('dialog', { name: 'Verifica tu correo' })
  await expect(modal).toBeVisible()
  const casillas = modal.locator('input[inputmode="numeric"]')
  for (let i = 0; i < 6; i++) await casillas.nth(i).fill(String((i + 1) % 10))
}

// Envía, confirma el correo y escribe el código.
async function pasarPorElCodigo(page: Page) {
  await page.getByRole('button', { name: 'Registrarse' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await escribirCodigo(page)
}

test('cuenta ya existente y misma contraseña: entra con signIn y completa el alta', async ({
  page
}) => {
  const espia = await interceptar(page, { signup: 'ya-existe' })
  await rellenarFormulario(page)
  await pasarPorElCodigo(page)

  await page.waitForURL(/\/sala-espera\?/)
  expect(espia.signUps).toBe(1)
  expect(espia.signIns).toBe(1)
  expect(espia.altas).toHaveLength(1)
  expect(espia.altas[0].email_verification_token).toBe(TOKEN)
})

test('cuenta ya existente y contraseña distinta: mensaje claro, sin sesión ni alta', async ({
  page
}) => {
  const espia = await interceptar(page, { signup: 'ya-existe', signin: 'clave-mala' })
  await rellenarFormulario(page, true, 'otra-Clave-999')
  await pasarPorElCodigo(page)

  await expect(page.getByText('la contraseña no coincide')).toBeVisible()
  expect(espia.signIns).toBe(1)
  expect(espia.altas).toHaveLength(0)
  await expect(page).toHaveURL(/\/registro-paciente/)
  const claves = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.includes('auth-token'))
  )
  expect(claves).toHaveLength(0)
})

test.describe('fallo del alta con la cuenta recién creada: cierra la sesión y explica', () => {
  test('403: reabre el modal de código para el mismo correo', async ({ page }) => {
    const espia = await interceptar(page, {
      alta: () => ({ status: 403, body: { detail: 'Verifica tu correo antes de continuar' } })
    })
    await rellenarFormulario(page)
    await pasarPorElCodigo(page)

    await expect(page.getByText('caducó o no es válida')).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Verifica tu correo' })).toBeVisible()
    expect(espia.logouts).toBeGreaterThan(0)
    await expect.poll(() => espia.envios.length).toBe(2)
    expect(espia.envios[1].email).toBe(EMAIL)
  })

  test('422: muestra el detalle del backend', async ({ page }) => {
    const espia = await interceptar(page, {
      alta: () => ({ status: 422, body: { detail: 'Cédula con formato inválido' } })
    })
    await rellenarFormulario(page)
    await pasarPorElCodigo(page)

    await expect(page.getByText('Cédula con formato inválido')).toBeVisible()
    expect(espia.logouts).toBeGreaterThan(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('429: pide esperar', async ({ page }) => {
    const espia = await interceptar(page, {
      alta: () => ({ status: 429, body: { detail: 'Too many requests' } })
    })
    await rellenarFormulario(page)
    await pasarPorElCodigo(page)

    await expect(page.getByText('Demasiados intentos')).toBeVisible()
    expect(espia.logouts).toBeGreaterThan(0)
  })

  test('otro error: el texto sirve tanto si la cuenta era nueva como si ya existía', async ({
    page
  }) => {
    const espia = await interceptar(page, { alta: () => ({ status: 500, body: { detail: 'x' } }) })
    await rellenarFormulario(page)
    await pasarPorElCodigo(page)

    await expect(page.getByText('Tu cuenta está lista')).toBeVisible()
    await expect(page.getByText('quedó creada')).toHaveCount(0)
    expect(espia.logouts).toBeGreaterThan(0)
  })
})

test('paciente con sesión y 403: el modal verifica el correo de la sesión, no uno vacío', async ({
  page
}) => {
  // Sesión de Supabase ya guardada: la clave es sb-<primer tramo del host>-auth-token.
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321').hostname
  const clave = `sb-${host.split('.')[0]}-auth-token`
  await page.addInitScript(
    ([k, v]) => localStorage.setItem(k, v),
    [clave, JSON.stringify(sesionDe(EMAIL))]
  )
  const espia = await interceptar(page, {
    alta: (intento) =>
      intento === 1
        ? { status: 403, body: { detail: 'Verifica tu correo antes de continuar' } }
        : { status: 201, body: PACIENTE }
  })
  await rellenarFormulario(page, false)
  await expect(page.locator('input[type="email"]')).toHaveCount(0) // sin bloque de cuenta

  await page.getByRole('button', { name: 'Registrarse' }).click()

  // Primer intento sin pase (token null) y 403 -> modal con el correo de la sesión.
  await expect.poll(() => espia.altas.length).toBe(1)
  expect(espia.altas[0].email_verification_token).toBeNull()
  const modal = page.getByRole('dialog', { name: 'Verifica tu correo' })
  await expect(modal).toBeVisible()
  await expect(modal.getByText(EMAIL)).toBeVisible()
  await expect.poll(() => espia.envios.length).toBe(1)
  expect(espia.envios[0]).toEqual({ email: EMAIL, purpose: 'patient' })
  // La sesión del paciente no se cierra: ya existía antes de este envío.
  expect(espia.logouts).toBe(0)

  // Con el código, se reintenta con el pase.
  await escribirCodigo(page)
  await expect.poll(() => espia.altas.length).toBe(2)
  expect(espia.altas[1].email_verification_token).toBe(TOKEN)
  await page.waitForURL(/\/sala-espera\?/)
})

test('envío del código en cooldown (429): mensaje claro y "Reenviar" bloqueado con cuenta atrás', async ({
  page
}) => {
  await interceptar(page)
  // Registrada después, esta ruta gana a la de interceptar().
  await page.route(/\/api\/v1\/email-verification\/send/, (r) =>
    json(r, { detail: 'Espera antes de pedir otro código' }, 429)
  )
  await rellenarFormulario(page)
  await page.getByRole('button', { name: 'Registrarse' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  const modal = page.getByRole('dialog', { name: 'Verifica tu correo' })
  await expect(modal.getByText('Espera unos segundos antes de pedir otro código')).toBeVisible()
  const reenviar = modal.getByRole('button', { name: /Reenviar código \(\d+s\)/ })
  await expect(reenviar).toBeDisabled()
})
