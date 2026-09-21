// Registro de paciente adulto por la UI COMPLETA: /registro-paciente → validación zod → signUp
// de Supabase → createPatient/createConsultation en el backend → /sala-espera en cola.
// Complementa a sala-espera.spec.ts (que siembra la consulta por API): aquí se ejercita el
// formulario en sí, que es lo que estuvo roto en producción sin que nadie lo notara.
// El email es único por corrida (los auth users de Supabase no se limpian entre corridas);
// el nombre empieza con "E2E Paciente" para que el cleanup del global-setup borre su
// patient+consultation. Dominio @example.com: el EmailStr del backend rechaza .local.
import { test, expect } from '@playwright/test'

test('registro adulto por UI: formulario → signup → sala de espera en cola', async ({ page }) => {
  // Ninguna petición a Google debe salir de local: el guard de lib/analytics.ts comprueba el
  // DOMINIO, y localhost no lo cumple. Se registran para asertarlo al final.
  const aGoogle: string[] = []
  page.on('request', (r) => {
    if (/googletagmanager\.com|google-analytics\.com/.test(r.url())) aGoogle.push(r.url())
  })

  await page.goto('/registro-paciente')

  await page.getByPlaceholder('Ej. 12345678').fill('99990034') // CedulaField emite "V-99990034"
  await page.getByPlaceholder('Ej. María González').fill('E2E Paciente Registro UI')
  await page.getByPlaceholder('Ej. 4121234567').fill('4120000034') // PhoneField emite "584120000034"
  await page.locator('input[type="email"]').fill(`e2e-paciente-${Date.now()}@example.com`)
  await page.locator('input[type="password"]').fill('e2e-Test-123456')

  // Teléfono de emergencia (distinto al WhatsApp).
  await page.getByPlaceholder('Ej. 4241234567').fill('4240000034')

  // Dirección de residencia (obligatoria).
  await page
    .getByPlaceholder('Ej. Calle 123, Urbanización Los Próceres')
    .fill('Calle 123, Urbanización Los Próceres, Caracas')

  // Único select con "Selecciona..." en la rama adulto (cédula y teléfono tienen V/E y +58).
  // selectOption espera a que el catálogo de zonas cargue del backend antes de elegir.
  const zona = page.locator('select', {
    has: page.locator('option', { hasText: 'Selecciona...' })
  })
  await zona.selectOption({ index: 1 })

  await page.getByPlaceholder('Ej. 34').fill('34')
  await page
    .locator('textarea')
    .fill('Dolor de cabeza persistente desde hace tres días. Sin medicación actual.')
  await page.getByRole('checkbox', { name: /Acepto compartir/ }).check()
  await page.getByRole('checkbox', { name: /acepto los Términos de uso y privacidad/ }).check()

  await page.getByRole('button', { name: 'Registrarse' }).click()

  // Aterriza en la sala de espera EN COLA: todavía ningún médico tomó el caso, así que no hay
  // botón para entrar (antes lo había y el paciente entraba a una sala vacía). La sala le dice
  // que espere y que esté atento al correo.
  await page.waitForURL(/\/sala-espera\?/)
  await expect(page.getByText('Estás en la sala de espera')).toBeVisible()
  await expect(page.getByText(/Atento a tu correo/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toHaveCount(0)
  // Y "Otra" no se le ofreció: no es la cola de nadie.
  await page.goBack()
  await page.getByRole('checkbox', { name: 'Conozco la especialidad que necesito' }).check()
  await expect(page.locator('option', { hasText: /^Otra$/ })).toHaveCount(0)

  // La conversión `generate_lead` se dispara aquí en PRODUCCIÓN. Lo que se puede comprobar en
  // local es lo contrario, que es lo que protege este assert: que no se filtre analítica desde
  // local ni desde la URL de previsualización. Si alguien quita el guard por dominio, esto se
  // pone rojo — y esa fuga, sin test, no la nota nadie.
  expect(aGoogle, `no debe salir analítica desde local: ${aGoogle.join(', ')}`).toHaveLength(0)
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined')
})
