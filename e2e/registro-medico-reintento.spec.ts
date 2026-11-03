// Registro de médico que falla a mitad: la cuenta de Auth queda creada sin ficha y quien reintenta
// no debía quedar atrapado. Antes, la vía "incompleta" se saltaba el código de correo, el backend
// respondía 403 y el formulario mostraba un error genérico para siempre; además, tras el fallo no
// se cerraba la sesión (el catch leía un estado viejo).
//
// Ningún test envía el formulario de verdad: el alta manda correos reales desde el backend local.
// Toda la red que toca el flujo (catálogos, comprobación, código, Supabase Auth y el alta) está
// interceptada con page.route, así que tampoco necesitan Supabase ni backend. Sí necesitan el
// servidor de Next (lo levanta playwright.config.ts) y el globalSetup del proyecto.
import { test, expect, type Page } from '@playwright/test'
import { CORS, json, sesionDe } from './red-interceptada'

test.use({ storageState: { cookies: [], origins: [] } })

const EMAIL = 'e2e-reintento@example.com'
const PASSWORD = 'e2e-Test-123456'
const TOKEN = 'pase-de-verificacion-e2e'

const SESION = () => sesionDe(EMAIL)

interface Espia {
  altas: Array<Record<string, unknown>>
  envios: number
  logouts: number
  signUps: number
  signIns: number
}

// Intercepta todo lo que toca el flujo. `estadoCorreo` es lo que contesta registration-check y
// `alta` decide la respuesta de POST /doctors (se llama una vez por intento).
async function interceptar(
  page: Page,
  opciones: {
    estadoCorreo: 'available' | 'incomplete'
    alta: (intento: number) => { status: number; body: unknown }
  }
): Promise<Espia> {
  const espia: Espia = { altas: [], envios: 0, logouts: 0, signUps: 0, signIns: 0 }
  const ahora = new Date().toISOString()

  await page.route(/\/api\/v1\/professional-types/, (r) =>
    json(r, [
      {
        id: 'pt-medico',
        name: 'Médico',
        status: 'active',
        created_at: ahora,
        updated_at: ahora,
        deleted_at: null
      }
    ])
  )
  await page.route(/\/api\/v1\/specialties/, (r) =>
    json(r, [
      {
        id: 'sp-general',
        name: 'Medicina general',
        status: 'active',
        is_mental_health: false,
        mental_health_only: false,
        available_for_interconsultation: false,
        created_at: ahora,
        updated_at: ahora,
        deleted_at: null
      }
    ])
  )
  await page.route(/\/api\/v1\/verificacion-sacs\//, (r) => json(r, { encontrado: false }))
  await page.route(/\/api\/v1\/doctors\/registration-check/, (r) =>
    json(r, { email_status: opciones.estadoCorreo, cedula_taken: false })
  )
  await page.route(/\/api\/v1\/email-verification\/send/, (r) => {
    espia.envios += 1
    return json(r, { sent: true, expires_minutes: 10, resend_seconds: 60 })
  })
  await page.route(/\/api\/v1\/email-verification\/verify/, (r) =>
    json(r, { verification_token: TOKEN, expires_minutes: 15 })
  )
  await page.route(/\/api\/v1\/doctors$/, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS })
    espia.altas.push(r.request().postDataJSON())
    const { status, body } = opciones.alta(espia.altas.length)
    return json(r, body, status)
  })

  // Supabase Auth.
  await page.route(/\/auth\/v1\/signup/, (r) => {
    espia.signUps += 1
    return json(r, { ...SESION() })
  })
  await page.route(/\/auth\/v1\/token/, (r) => {
    espia.signIns += 1
    return json(r, SESION())
  })
  await page.route(/\/auth\/v1\/logout/, (r) => {
    espia.logouts += 1
    return r.fulfill({ status: 204, headers: CORS })
  })
  // El panel al que iría un alta correcta: no hace falta cargarlo.
  await page.route(/\/panel-medico(\?|$)/, (r) => r.fulfill({ status: 200, body: 'panel' }))
  return espia
}

// Varias etiquetas del formulario no van ligadas por htmlFor: se busca el control dentro del mismo
// bloque que la etiqueta.
const campo = (page: Page, etiqueta: string) =>
  page.locator(`div:has(> label.label:text-is("${etiqueta}"))`).locator('input, select').first()

async function rellenarFormulario(page: Page): Promise<void> {
  await page.goto('/registro-medico')
  await campo(page, 'Tipo de profesional *').selectOption({ label: 'Médico' })
  await page.getByPlaceholder('Solo números').first().fill('12345678')
  await campo(page, 'Nombre completo *').fill('Ana Prueba')
  await page.getByLabel(/^WhatsApp/).fill('4141234567')
  await page.getByLabel(/^Correo/).fill(EMAIL)
  await page.getByLabel(/^País donde reside/).click()
  await page
    .getByRole('option', { name: /Venezuela/ })
    .first()
    .click()
  await campo(page, 'Especialidad *').selectOption({ label: 'Medicina general' })
  await campo(page, 'Contraseña *').fill(PASSWORD)
  await page.getByRole('checkbox').check()
}

// Envía, confirma el correo y escribe el código de 6 dígitos.
async function pasarPorElCodigo(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Registrarse' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  const modal = page.getByRole('dialog', { name: 'Verifica tu correo' })
  await expect(modal).toBeVisible()
  const casillas = modal.locator('input[inputmode="numeric"]')
  for (let i = 0; i < 6; i++) await casillas.nth(i).fill(String((i + 1) % 10))
}

test('cuenta incompleta: pide el código y manda el pase en el alta', async ({ page }) => {
  const espia = await interceptar(page, {
    estadoCorreo: 'incomplete',
    alta: () => ({ status: 201, body: { id: 'd-1' } })
  })
  await rellenarFormulario(page)
  await pasarPorElCodigo(page)

  await expect.poll(() => espia.altas.length).toBe(1)
  expect(espia.altas[0].email_verification_token).toBe(TOKEN)
  expect(espia.envios).toBe(1)
  // Entró a la cuenta que ya existía: no creó otra.
  expect(espia.signIns).toBe(1)
  expect(espia.signUps).toBe(0)
})

test('403 en el alta: reabre el modal de código con lo escrito intacto', async ({ page }) => {
  const espia = await interceptar(page, {
    estadoCorreo: 'incomplete',
    alta: () => ({ status: 403, body: { detail: 'Verifica tu correo antes de continuar' } })
  })
  await rellenarFormulario(page)
  await pasarPorElCodigo(page)

  await expect(page.getByRole('dialog', { name: 'Verifica tu correo' })).toBeVisible()
  await expect(page.getByText('caducó o no es válida')).toBeVisible()
  expect(espia.logouts).toBeGreaterThan(0)
  // Lo escrito sigue ahí.
  await page.keyboard.press('Escape')
  await expect(campo(page, 'Nombre completo *')).toHaveValue('Ana Prueba')
  await expect(page.getByLabel(/^Correo/)).toHaveValue(EMAIL)
})

test('fallo del alta en una cuenta nueva: cierra la sesión y explica que puede reintentar', async ({
  page
}) => {
  const espia = await interceptar(page, {
    estadoCorreo: 'available',
    alta: () => ({ status: 500, body: { detail: 'boom' } })
  })
  await rellenarFormulario(page)
  await pasarPorElCodigo(page)

  await expect(page.getByText('Tu cuenta quedó creada')).toBeVisible()
  await expect(page.getByText('mismo correo y contraseña')).toBeVisible()
  expect(espia.signUps).toBe(1)
  expect(espia.altas[0].email_verification_token).toBe(TOKEN)
  expect(espia.logouts).toBeGreaterThan(0)
  // Sin modal de "ya registrado" ni de código: el reintento no queda atrapado.
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('422 en el alta: muestra el mensaje de formato y cierra la sesión', async ({ page }) => {
  const espia = await interceptar(page, {
    estadoCorreo: 'incomplete',
    alta: () => ({ status: 422, body: { detail: 'Teléfono con formato inválido' } })
  })
  await rellenarFormulario(page)
  await pasarPorElCodigo(page)

  await expect(page.getByText('Teléfono con formato inválido')).toBeVisible()
  expect(espia.logouts).toBeGreaterThan(0)
})

test('médico nuevo con 403 tras signUp: código nuevo y reintento por signIn con el pase', async ({
  page
}) => {
  // Primer intento: la cuenta se crea y la ficha da 403 (pase caducado). Segundo: 201.
  const espia = await interceptar(page, {
    estadoCorreo: 'available',
    alta: (intento) =>
      intento === 1
        ? { status: 403, body: { detail: 'Verifica tu correo antes de continuar' } }
        : { status: 201, body: { id: 'd-1' } }
  })
  await rellenarFormulario(page)
  await pasarPorElCodigo(page)

  // 403: sesión cerrada y modal de código otra vez (con su aviso detrás).
  await expect.poll(() => espia.altas.length).toBe(1)
  await expect(page.getByText('caducó o no es válida')).toBeVisible()
  expect(espia.signUps).toBe(1)
  await expect.poll(() => espia.envios).toBe(2) // reabrir el modal pide un código solo

  // Código nuevo: el reintento va por signIn (sin signUp) y vuelve a llamar al alta con el pase.
  const modal = page.getByRole('dialog', { name: 'Verifica tu correo' })
  const casillas = modal.locator('input[inputmode="numeric"]')
  for (let i = 0; i < 6; i++) await casillas.nth(i).fill(String((i + 1) % 10))

  await expect.poll(() => espia.altas.length).toBe(2)
  expect(espia.altas[0].email_verification_token).toBe(TOKEN)
  expect(espia.altas[1].email_verification_token).toBe(TOKEN)
  expect(espia.signUps).toBe(1)
  expect(espia.signIns).toBe(1)
  // Sin modal de "ya registrado" y con el aviso del 403 ya limpio.
  await expect(page.getByText('caducó o no es válida')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
