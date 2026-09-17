// La lista de cuentas del admin (/admin/doctores, pestaña "Todos los doctores") muestra la
// especialidad —no el rol— y se puede filtrar por ella. El filtro lo resuelve el backend contra
// TODAS las que ejerce el médico, no solo la principal.
import { test, expect } from '@playwright/test'

test('la lista de doctores muestra la especialidad y filtra por ella', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()
  await page.goto('/admin/doctores')

  const fila = (nombre: string) =>
    page.locator('table.users-table tbody tr').filter({ hasText: nombre })

  await page.getByPlaceholder('Buscar nombre o email').fill('E2E Doctor')
  await expect(fila('E2E Doctor Dos')).toContainText('Cardiología')
  await expect(fila('E2E Doctor Uno')).toContainText('Medicina general')

  // Filtrar por Cardiología deja fuera al médico general.
  await page.getByTitle('Especialidad').selectOption({ label: 'Cardiología' })
  await expect(fila('E2E Doctor Dos')).toHaveCount(1)
  await expect(fila('E2E Doctor Uno')).toHaveCount(0)

  await ctx.close()
})
