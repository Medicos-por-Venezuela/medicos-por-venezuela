// El paciente vuelve a su sala desde /mi-caso, y el médico se entera de que entró.
//
// Reproduce reportes reales encadenados:
//  1. El enlace de la videoconsulta vivía SOLO en la pestaña de `/sala-espera` a la que se cae al
//     registrarse. Quien la cerró se quedaba sin forma de volver.
//  2. El paciente entraba a la sala antes de que ningún médico hubiera tomado su caso.
//  3. Y después, antes de que ninguno hubiera ENTRADO a ella: tomar un caso no es estar en la
//     sala, así que /mi-caso ya no ofrece entrar en ningún momento. Su entrada vive en el aviso
//     del hilo (R16), que solo existe cuando el médico inicia la videoconsulta de verdad.
//  4. El médico no sabía si el paciente había entrado.
//
// Se registra por la UI COMPLETA a propósito, en vez de sembrar por API como `sala-espera.spec`:
// la sala en vivo de /mi-caso solo existe si la consulta está atada a la CUENTA del paciente, y esa
// atadura solo la crea el formulario real.
//
// El email es único por corrida (los auth users de Supabase no se limpian entre corridas) y el
// nombre empieza por "E2E Paciente" para que el cleanup del global-setup borre su rastro.
import { test, expect } from '@playwright/test'
import { completarVerificacionCorreo } from './helpers'

const MOTIVO = 'E2E Paciente Mi Caso: dolor en el cuello y hormigueo en las manos.'

test('desde /mi-caso: nunca ofrece entrar; la entrada llega por el hilo y el médico lo ve', async ({
  browser
}) => {
  const ctxPaciente = await browser.newContext()
  const page = await ctxPaciente.newPage()

  await page.goto('/registro-paciente')
  await page.getByPlaceholder('Ej. 12345678').fill('99990035') // CedulaField emite "V-99990035"
  await page.getByPlaceholder('Ej. María González').fill('E2E Paciente Mi Caso')
  await page.getByPlaceholder('Ej. 4121234567').fill('4120000035') // PhoneField emite "584120000035"
  const email = `e2e-micaso-${Date.now()}@example.com`
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('e2e-Test-123456')

  // Teléfono de emergencia (distinto al WhatsApp).
  await page.getByPlaceholder('Ej. 4241234567').fill('4240000035')

  const zona = page.locator('label:has-text("Zona") + select')
  await zona.selectOption({ index: 1 })
  await page.getByPlaceholder('Ej. 34').fill('41')
  await page.locator('textarea').fill(MOTIVO)
  await page.getByRole('checkbox', { name: /Acepto compartir/ }).check()
  await page.getByRole('checkbox', { name: /acepto los Términos de uso y privacidad/ }).check()
  await page.getByRole('button', { name: 'Registrarse' }).click()

  // Modal de confirmación de correo → modal de código 6 dígitos
  await completarVerificacionCorreo(page, email)

  await page.waitForURL(/\/sala-espera\?/)

  // Se abandona esa pestaña (la sesión sigue viva) y se vuelve por el portal.
  await page.goto('/mi-caso')
  await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()
  await expect(page.getByText('Estás en la sala de espera')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toHaveCount(0)

  // Un médico toma el caso. "Atender paciente" hace el claim Y deja el aviso en el hilo (ver
  // `openConsultation` del panel): es lo que le da al paciente su entrada.
  const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const panel = await ctxMedico.newPage()
  await panel.goto('/panel-medico')
  const card = panel.locator('.card-flat').filter({ hasText: MOTIVO })
  await card.getByRole('button', { name: 'Atender paciente' }).click()
  const popupMedico = panel.waitForEvent('popup')
  await panel.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  await (await popupMedico).close()

  // /mi-caso se entera sola de que el caso está tomado…
  await expect(page.getByText(/tomó tu caso/)).toBeVisible({ timeout: 20_000 })
  // …y NO ofrece entrar. Es la regresión que este spec existe para impedir: la tarjeta del caso no
  // es una puerta a la sala, porque tomar un caso no es estar dentro.
  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toHaveCount(0)

  // La entrada vive en el aviso del hilo. En /mi-caso el hilo de la consulta vigente viene abierto.
  const avisoLlamada = page.locator('[data-testid="mensaje-sistema"][data-kind="call"]').last()
  await expect(avisoLlamada).toBeVisible({ timeout: 20_000 })
  const entrar = avisoLlamada.locator('[data-testid="btn-entrar-videoconsulta"]')
  await expect(entrar).toBeVisible()
  await expect(entrar).toBeEnabled()

  // La ventana se abre con `about:blank` DENTRO del clic y se la navega a la sala cuando vuelve la
  // respuesta (es lo que evita que el navegador la bloquee como pop-up). Por eso aquí no se
  // asierta su URL: justo después del evento todavía es `about:blank`, y esperar la navegación
  // real a Jitsi metería una dependencia de red en este spec. Esa costura —`about:blank` primero,
  // destino pasado por `browserRoomUrl` después— la cubre `mensajes-videollamada.spec.ts` con su
  // espía de `window.open`. Lo que SÍ se prueba aquí es el efecto de punta a punta: la entrada
  // queda registrada y el médico la ve.
  const popupPromise = page.waitForEvent('popup')
  const entradaPromise = page.waitForResponse(
    (r) => r.url().includes('/entered-call') && r.request().method() === 'POST'
  )
  await entrar.click()
  await (await popupPromise).close()

  const entrada = await entradaPromise
  // La sesión del paciente vale como credencial para SU consulta.
  expect(entrada.status(), 'la entrada debe quedar registrada').toBe(200)

  // Y el médico lo ve en el detalle del caso que tomó (la entrada queda en la base). Esta
  // aserción es la que obliga a que el camino del hilo funcione de punta a punta: sin entrada del
  // paciente no hay `entered_call_at` que mostrar.
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
