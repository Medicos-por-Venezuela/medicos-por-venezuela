// Registro de paciente adulto por la UI COMPLETA: /registro-paciente → validación zod → signUp
// de Supabase → createPatient/createConsultation en el backend → sala Jitsi → /sala-espera.
// Complementa a sala-espera.spec.ts (que siembra la consulta por API): aquí se ejercita el
// formulario en sí, que es lo que estuvo roto en producción sin que nadie lo notara.
// El email es único por corrida (los auth users de Supabase no se limpian entre corridas);
// el nombre empieza con "E2E Paciente" para que el cleanup del global-setup borre su
// patient+consultation. Dominio @example.com: el EmailStr del backend rechaza .local.
import { test, expect } from '@playwright/test'

test('registro adulto por UI: formulario → signup → sala de espera con videoconsulta', async ({
  page
}) => {
  await page.goto('/registro-paciente')

  await page.getByPlaceholder('Ej. 12345678').fill('99990034') // CedulaField emite "V-99990034"
  await page.getByPlaceholder('Ej. María González').fill('E2E Paciente Registro UI')
  await page.getByPlaceholder('Ej. 4121234567').fill('4120000034') // PhoneField emite "584120000034"
  await page.locator('input[type="email"]').fill(`e2e-paciente-${Date.now()}@example.com`)
  await page.locator('input[type="password"]').fill('e2e-Test-123456')

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

  await page.getByRole('button', { name: 'Registrarse' }).click()

  // Aterrizar en la sala de espera con la sala de video ya creada por el backend. El botón
  // solo aparece si ensureVideoRoom funcionó — si falla, la UI cae al fallback de WhatsApp
  // sin videollamada (el bug silencioso de Amplify que motivó este spec).
  await page.waitForURL(/\/sala-espera\?/)
  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toBeVisible()
  await expect(page.getByText(/contactarte por WhatsApp/)).toBeVisible()
})
