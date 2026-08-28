// El gate de credencial del backend, visto desde las dos puntas de la UI:
//
// 1. El médico bloqueado (doc3: cédula sin validar por el SACS) llega sin permisos, así que TODO
//    el panel responde 403. Sin la pantalla de "verificación pendiente" vería una cola vacía y
//    creería que la plataforma está rota.
// 2. El admin puede desbloquearlo desde /admin/doctores — el botón que hasta ahora no existía.
//
// El segundo test revoca al final: deja a doc3 como lo sembró global-setup, para no acoplar el
// resto de la suite al orden de ejecución.
import { test, expect } from '@playwright/test'

const DOC3 = 'E2E Doctor Tres'

test('el médico sin credencial verificada ve la pantalla de pendiente, no un panel vacío', async ({
  browser
}) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc3.json' })
  const page = await ctx.newPage()
  await page.goto('/panel-medico')

  await expect(
    page.getByRole('heading', { name: 'Tu credencial profesional aún no está verificada' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Completar mi perfil' })).toBeVisible()
  // Y nada de la cola: el backend no se la daría igualmente, pero el punto es que no se le
  // muestre un panel operativo que no puede usar.
  await expect(page.getByRole('button', { name: /Atender al siguiente paciente/ })).toHaveCount(0)

  await ctx.close()
})

test('el admin aprueba la credencial desde el panel y puede revocarla', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()
  await page.goto('/admin/doctores')

  // La tabla de credenciales tiene su propio buscador (con debounce de 300 ms + fetch server-side);
  // se espera a que quede reducida a la única coincidencia, no a que el texto aparezca.
  await page.getByPlaceholder('Buscar nombre, cédula o email').fill(DOC3)
  const fila = page.locator('table.doctor-credentials-table tbody tr').filter({ hasText: DOC3 })
  await expect(fila).toHaveCount(1)

  // Estado inicial: el SACS no lo validó, pero tiene cédula y licencia -> aprobarlo SÍ lo habilita.
  // `exact` obligatorio: getByText busca subcadena SIN distinguir mayúsculas, y el badge
  // 'Sin aprobar' es subcadena del motivo 'Credencial sin aprobar' de la misma fila.
  await expect(fila.getByText('Sin aprobar', { exact: true })).toBeVisible()
  await expect(fila.getByText('Credencial sin aprobar', { exact: true })).toBeVisible()

  await fila.getByRole('button', { name: 'Aprobar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click()

  await expect(fila.getByText('Aprobada', { exact: true })).toBeVisible()
  await expect(fila.getByText('Sin aprobar', { exact: true })).toHaveCount(0)

  // Reverso — y con él, doc3 vuelve al estado que sembró global-setup.
  await fila.getByRole('button', { name: 'Revocar aprobación' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Revocar' }).click()

  await expect(fila.getByText('Sin aprobar', { exact: true })).toBeVisible()

  await ctx.close()
})

test('el filtro por motivo saca a los aprobables del fondo del listado', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()
  await page.goto('/admin/doctores')

  // Sin filtro, los aprobables son una minoría diminuta y no salen en la primera página: el panel
  // aparenta no tener nada que aprobar. El contador es el atajo que aplica el filtro.
  const chip = page.getByRole('button', { name: /listos para aprobar/i })
  await expect(chip).toBeVisible()
  await chip.click()

  const filas = page.locator('table.doctor-credentials-table tbody tr')
  await expect(filas.first()).toBeVisible()
  // Toda fila de esta vista trae su botón de aprobar. Eso es exactamente lo que no ocurría
  // en el listado sin filtrar, donde la primera página no tenía ni uno.
  const total = await filas.count()
  await expect(filas.getByRole('button', { name: 'Aprobar' })).toHaveCount(total)

  await ctx.close()
})
