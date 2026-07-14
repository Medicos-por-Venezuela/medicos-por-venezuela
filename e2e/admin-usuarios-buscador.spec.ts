// Buscador server-side de /admin/usuarios: con ~3000 usuarios, paginar sin buscar es
// inservible. El input filtra por nombre o email (ILIKE en GET /profiles) con debounce.
import { test, expect } from '@playwright/test'

test('admin/usuarios: el buscador filtra por nombre o email (server-side)', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/usuarios')
  const buscador = page.getByPlaceholder('Buscar por nombre o email…')
  await expect(buscador).toBeVisible()

  // Sin filtro: la primera página trae PAGE_SIZE usuarios variados (hay ~3000).
  // Buscamos por el email exacto de un usuario sembrado por el setup E2E.
  await buscador.fill('e2e-doc1@example.com')

  // Tras el debounce + fetch, la tabla solo contiene el match.
  await expect(page.getByText('E2E Doctor Uno')).toBeVisible()
  await expect(page.getByText('e2e-admin@example.com')).toHaveCount(0)

  // Buscar por NOMBRE también funciona (ILIKE sobre full_name).
  await buscador.fill('E2E Doctor Dos')
  await expect(page.getByText('e2e-doc2@example.com')).toBeVisible()
  await expect(page.getByText('e2e-doc1@example.com')).toHaveCount(0)

  // Limpiar el buscador vuelve al listado paginado general.
  await buscador.fill('')
  await expect(page.locator('table tbody tr').first()).toBeVisible()

  await ctx.close()
})
