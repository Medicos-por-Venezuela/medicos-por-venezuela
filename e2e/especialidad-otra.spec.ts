// Un médico con especialidad "Otra" no ve la cola: la cola es por especialidad y "Otra" no
// identifica a ningún especialista. El panel se lo dice y lo manda a su perfil, donde escribe su
// especialidad si no está en la lista; el admin la ve en su dashboard para agregarla.
//
// La cuenta la siembra global-setup (e2e-doc-otra) y reafirma "Otra" sin solicitud en cada
// corrida, porque este spec la cambia.
import { test, expect } from '@playwright/test'
import { crearConsultaEnEspera } from './helpers'

test.describe('Médico con especialidad "Otra"', () => {
  test.describe.configure({ mode: 'serial' })
  const escrita = `Medicina del deporte E2E ${Date.now()}`

  test('no ve la cola, escribe su especialidad y queda pendiente', async ({ browser }) => {
    const marcador = `E2E Paciente Otra ${Date.now()}`
    await crearConsultaEnEspera(marcador)

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc-otra.json' })
    const page = await ctx.newPage()
    await page.goto('/panel-medico')

    const aviso = page.locator('.notice[role="alert"]')
    await expect(aviso).toContainText('Tu especialidad figura como “Otra”')
    await expect(page.locator('.card-flat').filter({ hasText: marcador })).toHaveCount(0)

    await page.getByRole('button', { name: 'Actualizar mi especialidad' }).click()
    await expect(page).toHaveURL(/\/panel-medico\/perfil/)
    // Las especialidades son casillas (puede ejercer varias) y "Otra" ya no se ofrece como una:
    // se marca "no está en la lista" y se escribe.
    await expect(page.getByRole('checkbox', { name: 'Otra', exact: true })).toHaveCount(0)
    await page.getByRole('checkbox', { name: /Otra: mi especialidad no está/ }).check()
    await page.getByLabel('Escribe tu especialidad *').fill(escrita)
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText(/Guardamos tu especialidad/)).toBeVisible()

    // Sigue sin cola hasta que un admin la resuelva.
    await page.goto('/panel-medico')
    await expect(page.locator('.notice[role="alert"]')).toBeVisible()
    await ctx.close()
  })

  test('el admin la ve en su dashboard, la agrega y el médico ya tiene cola', async ({
    browser
  }) => {
    const ctxAdmin = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
    const admin = await ctxAdmin.newPage()
    await admin.goto('/admin/dashboard')
    const bandeja = admin.getByRole('region', { name: /Especialidades por revisar/ })
    await expect(bandeja).toBeVisible()
    const fila = bandeja.locator('.card-flat').filter({ hasText: 'E2E Doctor Otra' })
    await expect(fila).toContainText(escrita)
    await fila.getByRole('button', { name: `Agregar “${escrita}” y asignar` }).click()
    await expect(admin.getByText(/ya atiende esa cola/)).toBeVisible()
    await ctxAdmin.close()

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc-otra.json' })
    const page = await ctx.newPage()
    await page.goto('/panel-medico')
    await expect(page.getByText('En espera por atender')).toBeVisible()
    await expect(page.locator('.notice[role="alert"]')).toHaveCount(0)
    await ctx.close()
  })

  test('puede ejercer varias especialidades y ve una cola por cada una', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc-otra.json' })
    const page = await ctx.newPage()
    await page.goto('/panel-medico/perfil')

    await page.getByRole('checkbox', { name: 'Cardiología', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Traumatología y ortopedia', exact: true }).check()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Perfil actualizado.')).toBeVisible()

    // Una card por especialidad suya, más la cola de entrada (Medicina general).
    await page.goto('/panel-medico')
    await expect(page.getByRole('button', { name: /mi especialidad: Cardiología/ })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /mi especialidad: Traumatología y ortopedia/ })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Ver consultas pendientes de Medicina general' })
    ).toBeVisible()
    await ctx.close()
  })
})
