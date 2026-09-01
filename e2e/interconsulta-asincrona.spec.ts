// Interconsulta ASÍNCRONA de punta a punta: el tratante registra a su paciente de consultorio,
// pide una segunda opinión por especialidad, y el especialista la ve ANONIMIZADA y la toma.
//
// Lo que este spec protege por encima de todo es la frontera de datos: que el nombre del paciente
// no aparezca en la bandeja del especialista. Es la promesa sobre la que se apoya el feature
// entero y no se puede verificar mirando la UI de vez en cuando.
import { test, expect } from '@playwright/test'
import { ESPECIALIDAD_E2E } from './global-setup'

const TRATANTE = 'e2e/.auth/doc1.json' // sin especialidad: solo pide
const ESPECIALISTA = 'e2e/.auth/doc2.json' // con ESPECIALIDAD_E2E: recibe y toma

// Nombre único por corrida: si dos corridas dejan el mismo, el localizador strict de Playwright
// encuentra dos cards y falla. El prefijo 'E2E Paciente' es el que limpia el global-setup.
const PACIENTE = `E2E Paciente Interconsulta ${Date.now()}`
const MOTIVO = `Dolor toracico atipico de dos semanas, ECG sin cambios agudos. ${Date.now()}`

test.describe('Interconsulta asíncrona', () => {
  test.describe.configure({ mode: 'serial' })

  test('el tratante registra su paciente y pide interconsulta', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: TRATANTE })
    const page = await ctx.newPage()

    await page.goto('/panel-medico/mis-pacientes')

    // El alta vive en un modal: la página es la LISTA. Que el formulario NO esté a la vista es
    // parte del cambio — si volviera a estar embebido, este `toHaveCount(0)` lo caza.
    await expect(page.getByLabel('Nombre completo *')).toHaveCount(0)
    await page.getByRole('button', { name: '+ Registrar paciente' }).click()

    const alta = page.getByRole('dialog', { name: 'Registrar un paciente' })
    await expect(alta).toBeVisible()

    // Replica /registro-paciente, MENOS WhatsApp y zona: este paciente no entra a la cola y nadie
    // de la plataforma lo contacta. Que esos campos NO estén es el feature.
    await expect(alta.getByLabel('WhatsApp')).toHaveCount(0)
    await expect(alta.getByLabel('Zona')).toHaveCount(0)

    // Todo acotado al diálogo: el encabezado de la página tiene su propio botón
    // "+ Registrar paciente", y sin acotar el localizador encuentra dos y falla por ambigüedad.
    await alta.getByLabel('Nombre completo *').fill(PACIENTE)
    await alta.getByLabel('Edad *').fill('64')
    await alta.getByLabel('Descripción breve *').fill('Refiere dolor toracico desde hace dias.')
    await alta.getByLabel(/Declaro que mi paciente autorizó/).check()
    await alta.getByRole('button', { name: 'Registrar paciente' }).click()

    await expect(page.getByText(`${PACIENTE} quedó registrado`)).toBeVisible()

    // Pedir interconsulta sobre ese paciente.
    const card = page.locator('.card-flat').filter({ hasText: PACIENTE })
    await card.getByRole('button', { name: 'Pedir interconsulta' }).click()

    const modal = page.getByRole('dialog', { name: 'Pedir interconsulta' })
    await expect(modal).toBeVisible()

    // El selector NO ofrece Medicina general: el backend la excluye por el flag del catálogo.
    await expect(modal.getByLabel('Especialidad *').getByRole('option')).not.toHaveText([
      'Medicina general'
    ])

    await modal.getByLabel('Especialidad *').selectOption({ label: ESPECIALIDAD_E2E })
    await modal.getByLabel('Motivo de la consulta *').fill(MOTIVO)
    await modal.getByRole('button', { name: 'Enviar solicitud' }).click()

    await expect(page.getByText(/Se notificó a \d+ especialistas? de/)).toBeVisible()
    await ctx.close()
  })

  test('el especialista la ve anonimizada, la toma y recibe el contacto', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ESPECIALISTA })
    const page = await ctx.newPage()

    await page.goto('/panel-medico/interconsultas')

    const caso = page.locator('.card-flat').filter({ hasText: MOTIVO })
    await expect(caso).toBeVisible()

    // *** La aserción que justifica este spec ***
    // El nombre del paciente NO puede estar en ninguna parte de la página.
    await expect(page.locator('body')).not.toContainText(PACIENTE)
    // Sí ve lo que necesita para decidir.
    await expect(caso).toContainText('64 años')
    await expect(caso).toContainText(ESPECIALIDAD_E2E)

    await caso.getByRole('button', { name: 'Tomar este caso' }).click()

    // Al tomar recibe el contacto del médico TRATANTE (no del paciente).
    await expect(page.getByText(/Tomaste el caso\. Contacta a E2E Doctor Uno/)).toBeVisible()

    // Queda en "Casos que tomé", y el paciente sigue sin aparecer.
    await expect(page.getByRole('button', { name: /Casos que tomé \(1\)/ })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(PACIENTE)
    await ctx.close()
  })

  test('el especialista NO puede cerrar el caso; el tratante sí', async ({ browser }) => {
    // La regla que un refactor futuro rompería sin darse cuenta: cerrar es del médico tratante.
    const especialista = await browser.newContext({ storageState: ESPECIALISTA })
    const pageEsp = await especialista.newPage()
    await pageEsp.goto('/panel-medico/interconsultas')
    await pageEsp.getByRole('button', { name: /Casos que tomé/ }).click()

    const suyo = pageEsp.locator('.card-flat').filter({ hasText: MOTIVO })
    await expect(suyo).toBeVisible()
    await expect(suyo.getByRole('button', { name: 'Cerrar caso' })).toHaveCount(0)
    await especialista.close()

    // El tratante sí ve el botón, y ve quién tomó su caso.
    const tratante = await browser.newContext({ storageState: TRATANTE })
    const pageTrat = await tratante.newPage()
    await pageTrat.goto('/panel-medico/interconsultas')
    await pageTrat.getByRole('button', { name: /Mis solicitudes/ }).click()

    const mia = pageTrat.locator('.card-flat').filter({ hasText: MOTIVO })
    await expect(mia).toContainText(PACIENTE) // su propio paciente sí lo ve
    await expect(mia).toContainText('E2E Doctor Dos')

    await mia.getByRole('button', { name: 'Cerrar caso' }).click()
    const dialogo = pageTrat.getByRole('dialog', { name: 'Cerrar caso' })
    await dialogo.getByLabel('¿Cómo se resolvió? (opcional)').fill('Resuelto por teléfono.')
    await dialogo.getByRole('button', { name: 'Cerrar caso' }).click()

    await expect(pageTrat.getByText('Caso cerrado.')).toBeVisible()
    await tratante.close()
  })
})
