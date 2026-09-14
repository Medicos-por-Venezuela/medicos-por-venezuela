// Términos de uso y privacidad: la página pública, el aviso de urgencias del pie y la casilla que
// gatea las tres puertas de alta (/registro-paciente, /registro-medico y /elegir-rol).
//
// Los tests de gating comprueban que sin la casilla NO sale ninguna petición de alta, no solo que
// aparece el mensaje: un aviso pintado encima de un signUp ya enviado seguiría en verde.
//
// El camino feliz (casilla marcada → alta completa) lo cubren registro-paciente.spec.ts y
// mi-caso-videoconsulta.spec.ts, que ya marcan la casilla.
import { test, expect, type Page } from '@playwright/test'

const MENSAJE = 'Debes aceptar los Términos de uso y privacidad para continuar.'
const CASILLA = /acepto los Términos de uso y privacidad/

// Cualquier petición que cree algo: el signUp de Supabase, las altas del backend y la
// finalización del rol de /elegir-rol.
function registrarAltas(page: Page): string[] {
  const altas: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'POST') return
    if (
      /\/auth\/v1\/signup|\/api\/v1\/(patients|consultations|doctors)|finalize-role/.test(r.url())
    )
      altas.push(r.url())
  })
  return altas
}

test('la página de términos es pública, sin 2FA, y el pie la enlaza junto al aviso de urgencias', async ({
  page
}) => {
  await page.goto('/')
  const pie = page.locator('footer')
  await expect(
    pie.getByText(/no reemplaza la atención médica presencial de urgencia/)
  ).toBeVisible()
  await expect(pie.getByRole('link', { name: 'Términos y privacidad' })).toHaveAttribute(
    'href',
    '/legal/privacidad'
  )

  await page.goto('/legal/privacidad')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Términos de uso y privacidad' })
  ).toBeVisible()
  await expect(
    page.getByText('La telemedicina no reemplaza la atención de un médico en persona.')
  ).toBeVisible()
  await expect(page.getByText(/Servicio Autónomo de Contraloría Sanitaria \(SACS\)/)).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'legal@medicosporvenezuela.org' }).first()
  ).toHaveAttribute('href', 'mailto:legal@medicosporvenezuela.org')
  // La plataforma no tiene autenticación de dos factores: prometerla sería falso.
  await expect(page.getByText(/dos factores|2FA/i)).toHaveCount(0)
  // Lo que ve cada quien tiene que coincidir con lo que manda el backend: la cola de espera no
  // trae el nombre (ver el tipo `Patient` de pages/panel-medico.tsx) y la bandeja de
  // interconsultas no trae datos personales (`InterconsultationRequestInbox` en la API).
  await expect(page.getByText(/alergias y el motivo de la consulta, sin su nombre/)).toBeVisible()
  await expect(page.getByText(/sin sus datos personales: ni nombre, ni cédula/)).toBeVisible()
  // Pública e indexable, a diferencia de login/panel.
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
})

test('registro de paciente: sin aceptar los términos no se envía nada, y el enlace abre en otra pestaña', async ({
  page
}) => {
  const altas = registrarAltas(page)
  await page.goto('/registro-paciente')

  await page.getByPlaceholder('Ej. 12345678').fill('99990036')
  await page.getByPlaceholder('Ej. María González').fill('E2E Paciente Terminos')
  await page.getByPlaceholder('Ej. 4121234567').fill('4120000036')
  await page.locator('input[type="email"]').fill(`e2e-terminos-${Date.now()}@example.com`)
  await page.locator('input[type="password"]').fill('e2e-Test-123456')
  await page
    .locator('select', { has: page.locator('option', { hasText: 'Selecciona...' }) })
    .selectOption({ index: 1 })
  await page.getByPlaceholder('Ej. 34').fill('34')
  const motivo = 'Consulta de prueba de la casilla de términos.'
  await page.locator('textarea').fill(motivo)
  await page.getByRole('checkbox', { name: /Acepto compartir/ }).check()

  const casilla = page.getByRole('checkbox', { name: CASILLA })
  await expect(casilla).not.toBeChecked()

  await page.getByRole('button', { name: 'Registrarse' }).click()
  await expect(page.getByText(MENSAJE)).toBeVisible()
  await expect(page).toHaveURL(/\/registro-paciente/)
  expect(altas, `no debe salir ningún alta sin aceptar: ${altas.join(', ')}`).toHaveLength(0)

  // El enlace abre en OTRA pestaña: el formulario sigue ahí, con lo escrito, y pulsar el enlace
  // no marca la casilla aunque viva dentro del <label>.
  const enlace = page.getByRole('link', { name: 'Términos de uso y privacidad' })
  await expect(enlace).toHaveAttribute('target', '_blank')
  await expect(enlace).toHaveAttribute('rel', /noopener/)
  const popupPromise = page.waitForEvent('popup')
  await enlace.click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/legal\/privacidad$/)
  await expect(
    popup.getByRole('heading', { level: 1, name: 'Términos de uso y privacidad' })
  ).toBeVisible()
  await popup.close()

  await expect(page).toHaveURL(/\/registro-paciente/)
  await expect(page.locator('textarea')).toHaveValue(motivo)
  await expect(casilla).not.toBeChecked()
})

test('registro de médico: sin aceptar los términos no se crea la cuenta', async ({ page }) => {
  const altas = registrarAltas(page)
  await page.goto('/registro-medico')

  // Un tipo que no pasa por SACS/FPV: así el blur de la cédula no consulta ningún registro.
  await page
    .locator('label.label:has-text("Tipo de profesional") + select')
    .selectOption({ label: 'Nutricionista' })
  await page.getByPlaceholder('Solo números').first().fill('99990037')
  await page.locator('label.label:has-text("Nombre completo") + input').fill('E2E Medico Terminos')
  await page.getByPlaceholder('Solo números').nth(1).fill('4120000037')
  await page.locator('input[type="email"]').fill(`e2e-medico-terminos-${Date.now()}@example.com`)
  await page
    .locator('label.label:has-text("País donde reside") + select')
    .selectOption({ label: 'Venezuela' })
  await page.locator('input[type="password"]').fill('e2e-Test-123456')

  await expect(page.getByRole('checkbox', { name: CASILLA })).not.toBeChecked()
  await page.getByRole('button', { name: 'Registrarse' }).click()

  await expect(page.getByText(MENSAJE)).toBeVisible()
  await expect(page).toHaveURL(/\/registro-medico/)
  expect(altas, `no debe salir ningún alta sin aceptar: ${altas.join(', ')}`).toHaveLength(0)
})

test.describe('elegir rol (alta con Google)', () => {
  test.use({ storageState: 'e2e/.auth/sin-rol.json' })

  test('ni como paciente ni como médico se finaliza el rol sin aceptar los términos', async ({
    page
  }) => {
    const altas = registrarAltas(page)

    await page.goto('/elegir-rol?rol=paciente')
    await expect(page.getByRole('checkbox', { name: CASILLA })).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar como paciente' }).click()
    await expect(page.getByText(MENSAJE)).toBeVisible()
    await expect(page).toHaveURL(/\/elegir-rol/)

    await page.goto('/elegir-rol?rol=medico')
    await page.locator('label.label:has-text("Especialidad") + select').selectOption({ index: 1 })
    await page
      .locator('label.label:has-text("País donde ejerces") + select')
      .selectOption({ label: 'Venezuela' })
    await page.getByPlaceholder('Ej. 584121234567').fill('584120000038')
    await page.getByRole('button', { name: 'Confirmar como médico' }).click()
    await expect(page.getByText(MENSAJE)).toBeVisible()
    await expect(page).toHaveURL(/\/elegir-rol/)

    expect(altas, `no debe finalizarse el rol sin aceptar: ${altas.join(', ')}`).toHaveLength(0)
  })
})
