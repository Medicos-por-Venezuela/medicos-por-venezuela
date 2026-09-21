// El paciente vuelve a su sala desde /mi-caso, y el médico se entera de que entró.
//
// Reproduce reportes reales encadenados:
//  1. El enlace de la videoconsulta vivía SOLO en la pestaña de `/sala-espera` a la que se cae al
//     registrarse. Quien la cerró se quedaba sin forma de volver.
//  2. El paciente entraba a la sala antes de que ningún médico hubiera tomado su caso: ahora
//     /mi-caso le muestra que sigue en cola y le ofrece entrar solo cuando hay médico.
//  3. El médico no sabía si el paciente había entrado.
//
// Se registra por la UI COMPLETA a propósito, en vez de sembrar por API como `sala-espera.spec`:
// la sala en vivo de /mi-caso solo existe si la consulta está atada a la CUENTA del paciente, y esa
// atadura solo la crea el formulario real.
//
// El email es único por corrida (los auth users de Supabase no se limpian entre corridas) y el
// nombre empieza por "E2E Paciente" para que el cleanup del global-setup borre su rastro.
import { test, expect } from '@playwright/test'

const MOTIVO = 'E2E Paciente Mi Caso: dolor en el cuello y hormigueo en las manos.'

test('desde /mi-caso: en cola no entra; cuando un médico lo toma entra y el médico lo ve', async ({
  browser
}) => {
  const ctxPaciente = await browser.newContext()
  const page = await ctxPaciente.newPage()

  await page.goto('/registro-paciente')
  await page.getByPlaceholder('Ej. 12345678').fill('99990035') // CedulaField emite "V-99990035"
  await page.getByPlaceholder('Ej. María González').fill('E2E Paciente Mi Caso')
  await page.getByPlaceholder('Ej. 4121234567').fill('4120000035') // PhoneField emite "584120000035"
  await page.locator('input[type="email"]').fill(`e2e-micaso-${Date.now()}@example.com`)
  await page.locator('input[type="password"]').fill('e2e-Test-123456')

  // Teléfono de emergencia (distinto al WhatsApp).
  await page.getByPlaceholder('Ej. 4241234567').fill('4240000035')

  // Dirección de residencia (obligatoria).
  await page
    .getByPlaceholder('Ej. Calle 123, Urbanización Los Próceres')
    .fill('Calle 123, Urbanización Los Próceres, Caracas')

  const zona = page.locator('select', {
    has: page.locator('option', { hasText: 'Selecciona...' })
  })
  await zona.selectOption({ index: 1 })
  await page.getByPlaceholder('Ej. 34').fill('41')
  await page.locator('textarea').fill(MOTIVO)
  await page.getByRole('checkbox', { name: /Acepto compartir/ }).check()
  await page.getByRole('checkbox', { name: /acepto los Términos de uso y privacidad/ }).check()
  await page.getByRole('button', { name: 'Registrarse' }).click()
  await page.waitForURL(/\/sala-espera\?/)

  // Se abandona esa pestaña (la sesión sigue viva) y se vuelve por el portal.
  await page.goto('/mi-caso')
  await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()
  await expect(page.getByText('Estás en la sala de espera')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toHaveCount(0)

  // Un médico toma el caso.
  const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const panel = await ctxMedico.newPage()
  await panel.goto('/panel-medico')
  const card = panel.locator('.card-flat').filter({ hasText: MOTIVO })
  await card.getByRole('button', { name: 'Atender paciente' }).click()
  const popupMedico = panel.waitForEvent('popup')
  await panel.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  await (await popupMedico).close()

  // /mi-caso se entera sola y ofrece entrar.
  const entrar = page.getByRole('button', { name: 'Entrar a la videoconsulta' })
  await expect(entrar).toBeVisible({ timeout: 20_000 })

  // El modal de instrucciones es el MISMO que el de la sala de espera (componente compartido).
  await entrar.click()
  const aviso = page.getByRole('dialog')
  await expect(aviso.getByRole('heading', { name: 'Información importante' })).toBeVisible()
  await expect(aviso.getByText(/Tu médico ya tomó tu caso/)).toBeVisible()
  await expect(aviso.getByText(/Escribe tu nombre completo/)).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  const entradaPromise = page.waitForResponse(
    (r) => r.url().includes('/entered-call') && r.request().method() === 'POST'
  )
  await aviso.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()

  const popup = await popupPromise
  expect(popup.url()).toContain('/vamed-')
  // Con la config que salta el interstitial móvil de "descarga la app".
  expect(popup.url()).toContain('disableDeepLinking=true')
  await popup.close()

  const entrada = await entradaPromise
  // La sesión del paciente vale como credencial para SU consulta.
  expect(entrada.status(), 'la entrada debe quedar registrada').toBe(200)

  // Y el médico lo ve en el detalle del caso que tomó (la entrada queda en la base).
  await panel.reload()
  await expect(panel.getByText(/Entró a la videollamada/)).toBeVisible()

  await ctxMedico.close()
  await ctxPaciente.close()
})

test('sin consultas abiertas, /mi-caso no ofrece entrar', async ({ page }) => {
  // Esta cuenta de prueba no tiene ninguna consulta: no hay sala que seguir ni a la que entrar.
  await page.goto('/login')
  await page.getByLabel('Email').fill('e2e-patient@example.com')
  await page.getByLabel('Contraseña').fill('e2e-Test-123456')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/mi-caso/)
  await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toHaveCount(0)
})
