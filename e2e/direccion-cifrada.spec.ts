// Flujo E2E de la dirección cifrada E2E: paciente se registra con dirección;
// un médico toma el caso; en el detalle aparece "Ver dirección"; al pulsar pide
// la passphrase; con process.env.E2E_CLINICAL_PASSPHRASE se desbloquea y se ve la dirección.
//
// Si E2E_CLINICAL_PASSPHRASE no está disponible en el proceso de Playwright,
// el test se salta (test.skip) con comentario explicando cómo configurarla.
import { test, expect } from '@playwright/test'

const PACIENTE = `E2E Paciente Direccion ${Date.now()}`
const MOTIVO = 'Dolor abdominal agudo desde hace 6 horas, fiebre 38.5.'
const DIRECCION = 'Av. Principal de Las Mercedes, Edificio Centro Médico, Piso 3, Caracas 1060'
const EMERGENCY_PHONE = '4240000099'
const WHATSAPP_PHONE = '4120000099'

// La passphrase clínica se inyecta vía variable de entorno en el runner de Playwright
// (p. ej. GitHub Actions secret, o .env.local en la máquina del dev).
// En local: `E2E_CLINICAL_PASSPHRASE=tu-passphrase pnpm test:e2e --project=chromium -- e2e/direccion-cifrada.spec.ts`
const CLINICAL_PASSPHRASE = process.env.E2E_CLINICAL_PASSPHRASE

test.describe('Dirección cifrada E2E', () => {
  test.describe.configure({ mode: 'serial' })

  if (!CLINICAL_PASSPHRASE) {
    test.skip(
      true,
      'E2E_CLINICAL_PASSPHRASE no está configurada. ' +
        'Para ejecutar este test, define la variable de entorno con la passphrase clínica ' +
        '(la misma que usan los médicos en producción). Ejemplo: ' +
        'E2E_CLINICAL_PASSPHRASE=tu-passphrase pnpm test:e2e -- e2e/direccion-cifrada.spec.ts'
    )
  }

  test('paciente se registra con dirección; médico asignado la ve tras desbloquear', async ({
    browser
  }) => {
    // 1) Paciente se registra con dirección y teléfono de emergencia
    const ctxPaciente = await browser.newContext()
    const page = await ctxPaciente.newPage()

    await page.goto('/registro-paciente')
    await page.getByPlaceholder('Ej. 12345678').fill('99990099')
    await page.getByPlaceholder('Ej. María González').fill(PACIENTE)
    await page.getByPlaceholder('Ej. 4121234567').fill(WHATSAPP_PHONE) // PhoneField emite "584120000099"
    await page.locator('input[type="email"]').fill(`e2e-direccion-${Date.now()}@example.com`)
    await page.locator('input[type="password"]').fill('e2e-Test-123456')

    // Teléfono de emergencia (distinto al WhatsApp).
    await page.getByPlaceholder('Ej. 4241234567').fill(EMERGENCY_PHONE)

    // Dirección de residencia (obligatoria).
    await page.getByPlaceholder('Ej. Calle 123, Urbanización Los Próceres').fill(DIRECCION)

    const zona = page.locator('select', {
      has: page.locator('option', { hasText: 'Selecciona...' })
    })
    await zona.selectOption({ index: 1 })
    await page.getByPlaceholder('Ej. 34').fill('45')
    await page.locator('textarea').fill(MOTIVO)
    await page.getByRole('checkbox', { name: /Acepto compartir/ }).check()
    await page.getByRole('checkbox', { name: /acepto los Términos de uso y privacidad/ }).check()
    await page.getByRole('button', { name: 'Registrarse' }).click()
    await page.waitForURL(/\/sala-espera\?/)

    await ctxPaciente.close()

    // 2) Médico toma el caso
    const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const panel = await ctxMedico.newPage()
    await panel.goto('/panel-medico')

    const card = panel.locator('.card-flat').filter({ hasText: MOTIVO })
    await expect(card).toBeVisible({ timeout: 30_000 })
    await card.getByRole('button', { name: 'Atender paciente' }).click()

    const popupMedico = panel.waitForEvent('popup')
    await panel.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
    await (await popupMedico).close()

    // 3) Abre el detalle de la consulta
    await panel.reload()
    const cardTomado = panel.locator('.card-flat').filter({ hasText: MOTIVO })
    await cardTomado.getByRole('button', { name: /Ver detalle|Detalle/ }).click()

    await expect(panel).toHaveURL(/\/panel-medico\/consulta\//)

    // 4) Verifica que aparece el teléfono de emergencia
    await expect(panel.getByText(new RegExp(`Tel\\. emergencia: ${EMERGENCY_PHONE}`))).toBeVisible()

    // 5) Verifica que aparece el bloque "Dirección" (solo si can_view_patient_address)
    await expect(panel.getByRole('heading', { name: 'Dirección' })).toBeVisible()

    // 6) Pulsa "Ver dirección" -> debería abrir el modal de passphrase
    await panel.getByRole('button', { name: 'Ver dirección' }).click()

    // El modal de passphrase debería aparecer
    const unlockModal = panel.getByRole('dialog', { name: /Desbloquear dirección/ })
    await expect(unlockModal).toBeVisible()

    // 7) Introduce la passphrase y desbloquea
    await unlockModal.getByLabel('Passphrase clínica').fill(CLINICAL_PASSPHRASE!)
    await unlockModal.getByRole('button', { name: 'Desbloquear' }).click()

    // 8) La dirección debería aparecer en texto plano (solo en memoria del componente)
    await expect(panel.getByText(DIRECCION)).toBeVisible({ timeout: 10_000 })

    // 9) "Ocultar" limpia la dirección de la vista
    await panel.getByRole('button', { name: 'Ocultar' }).click()
    await expect(panel.getByText(DIRECCION)).not.toBeVisible()

    await ctxMedico.close()
  })

  test('otro médico (no asignado) no ve el bloque Dirección', async ({ browser }) => {
    // Este test requiere un segundo médico autenticado. Usamos doc2 si está disponible,
    // o saltamos si no hay storageState.
    const doc2State = 'e2e/.auth/doc2.json'
    let hasDoc2 = false
    try {
      await browser.newContext({ storageState: doc2State })
      hasDoc2 = true
    } catch {
      test.skip(true, 'No hay storageState para doc2 (e2e/.auth/doc2.json). Se salta el test.')
      return
    }

    const ctxMedico2 = await browser.newContext({ storageState: doc2State })
    const panel2 = await ctxMedico2.newPage()
    await panel2.goto('/panel-medico')

    // El caso del paciente debería verse en la cola (si doc2 tiene la especialidad)
    // pero al entrar al detalle NO debería ver el bloque Dirección.
    // Nota: este test depende de la configuración de especialidades del seed.
    // Si doc2 no ve el caso en su cola, el test pasa silenciosamente.
    const card = panel2.locator('.card-flat').filter({ hasText: MOTIVO })
    const count = await card.count()
    if (count === 0) {
      await ctxMedico2.close()
      test.skip(true, 'doc2 no ve el caso en su cola (especialidad distinta). Se salta.')
      return
    }

    await card.getByRole('button', { name: /Ver detalle|Detalle/ }).click()
    await expect(panel2).toHaveURL(/\/panel-medico\/consulta\//)

    // Verifica que NO aparece el bloque Dirección
    await expect(panel2.getByRole('heading', { name: 'Dirección' })).toHaveCount(0)

    await ctxMedico2.close()
  })
})
