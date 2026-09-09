// El paciente vuelve a su sala desde /mi-caso, y el médico se entera de que entró.
//
// Reproduce dos reportes reales encadenados:
//  1. El enlace de la videoconsulta vivía SOLO en la pestaña de `/sala-espera` a la que se cae al
//     registrarse. Quien la cerró se quedaba sin forma de volver.
//  2. El médico no sabía si el paciente había entrado. El badge de presencia decía "En sala"
//     mientras el paciente tuviera abierta una página NUESTRA, y al abrir Jitsi esa pestaña pasa a
//     segundo plano — así que decía "Sin conexión" justo cuando el paciente acababa de entrar.
//
// Se registra por la UI COMPLETA a propósito, en vez de sembrar por API como `sala-espera.spec`:
// el botón solo aparece si la consulta está atada a la CUENTA del paciente (el backend scopea
// `GET /consultations` por `patients.user_id`), y esa atadura solo la crea el formulario real.
//
// El email es único por corrida (los auth users de Supabase no se limpian entre corridas) y el
// nombre empieza por "E2E Paciente" para que el cleanup del global-setup borre su rastro.
import { test, expect } from '@playwright/test'

const MOTIVO = 'E2E Paciente Mi Caso: dolor en el cuello y hormigueo en las manos.'

test('el paciente vuelve por /mi-caso, entra a la sala y el médico ve que entró', async ({
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

  const zona = page.locator('select', {
    has: page.locator('option', { hasText: 'Selecciona...' })
  })
  await zona.selectOption({ index: 1 })
  await page.getByPlaceholder('Ej. 34').fill('41')
  await page.locator('textarea').fill(MOTIVO)
  await page.getByRole('checkbox', { name: /Acepto compartir/ }).check()
  await page.getByRole('button', { name: 'Registrarse' }).click()

  // Aterriza en la sala de espera con la sala ya creada por el backend.
  await page.waitForURL(/\/sala-espera\?/)
  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toBeVisible()

  // Aquí es donde se perdía el enlace: se abandona esa pestaña (la sesión sigue viva, como en la
  // vida real) y se vuelve por el portal.
  await page.goto('/mi-caso')
  await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()

  const unirse = page.getByRole('button', { name: 'Unirse a la videoconsulta' })
  await expect(unirse).toBeVisible()
  // El caso sigue en cola (ningún médico lo ha tomado): el texto tiene que decir eso y no
  // prometer un médico que todavía no existe.
  await expect(page.getByText(/Todavía estás en cola/)).toBeVisible()

  // El modal de instrucciones es el MISMO que el de la sala de espera (componente compartido):
  // si se hubiera copiado, esta aserción seguiría verde con dos textos divergiendo en paralelo.
  await unirse.click()
  await expect(
    page.getByRole('heading', { name: 'Antes de entrar a la videoconsulta' })
  ).toBeVisible()

  // Confirmar abre la sala en una pestaña nueva Y registra la entrada. Las dos cosas: sin el
  // `window.open` el paciente no entra, y sin el POST el médico no se entera.
  const popupPromise = page.waitForEvent('popup')
  const entradaPromise = page.waitForResponse(
    (r) => r.url().includes('/entered-call') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Entendido, entrar a la videoconsulta' }).click()

  const popup = await popupPromise
  expect(popup.url()).toContain('/vamed-')
  // Con la config que salta el interstitial móvil de "descarga la app".
  expect(popup.url()).toContain('disableDeepLinking=true')
  await popup.close()

  const entrada = await entradaPromise
  // La sesión del paciente vale como credencial para SU consulta: aquí no hay token de sala (se
  // entregó una sola vez, en la URL de la sala de espera, y esa pestaña ya se abandonó).
  expect(entrada.status(), 'la entrada debe quedar registrada').toBe(200)

  // Y el médico lo ve en su panel. Es el punto entero del cambio: antes, en este mismo instante,
  // la tarjeta decía "Sin conexión".
  const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const panel = await ctxMedico.newPage()
  await panel.goto('/panel-medico')
  const card = panel.locator('.card-flat').filter({ hasText: MOTIVO })
  await expect(card).toBeVisible()
  await expect(card.getByText(/Entró a la videollamada/)).toBeVisible()

  await ctxMedico.close()
  await ctxPaciente.close()
})

test('sin consultas abiertas con sala, /mi-caso no ofrece entrar', async ({ page }) => {
  // El botón está gateado por estado (`SALA_ABIERTA`) además de por tener sala: una consulta
  // cerrada conserva su `video_room_url` en la base, y sin el filtro el portal mandaría al
  // paciente a una sala a la que ya no va a entrar ningún médico. Esta cuenta de prueba no tiene
  // ninguna consulta, que es el caso más simple del mismo gating.
  await page.goto('/login')
  await page.getByLabel('Email').fill('e2e-patient@example.com')
  await page.getByLabel('Contraseña').fill('e2e-Test-123456')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/mi-caso/)
  await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unirse a la videoconsulta' })).toHaveCount(0)
})
