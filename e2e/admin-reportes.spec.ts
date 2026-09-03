// Gating de /admin/reportes: los reportes exportan la ficha completa de médicos y pacientes
// (cédulas, teléfonos, alergias), así que son SOLO de super_admin. El backend lo impone con el
// permiso `reports.export`, sembrado para ese único rol; estos specs fijan que la UI diga lo
// mismo — un admin que ve el enlace y entra para encontrarse un 403 es peor que no verlo.
//
// Requiere que la migración `20260903_093414_seed_reports_export_permission.sql` esté aplicada
// en la base local (`python artisan migrate` en el repo del backend); sin ella el super_admin
// también recibiría 403 y el segundo spec fallaría al cargar la vista previa.
import { test, expect } from '@playwright/test'

test('un admin (no super) no ve el enlace de Reportes ni puede usar la página', async ({
  browser
}) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard administrativo' })).toBeVisible()
  // El enlace no está en la navegación: la página existe, pero no se le ofrece.
  await expect(page.getByRole('link', { name: 'Reportes' })).toHaveCount(0)

  // Y entrando por URL directa, la página explica por qué no y no pinta ningún filtro ni botón
  // de exportación (que solo produciría un 403).
  await page.goto('/admin/reportes')
  await expect(page.getByText('reservados a los')).toBeVisible()
  await expect(page.getByRole('button', { name: /Exportar a Excel/ })).toHaveCount(0)
  await expect(page).toHaveURL(/\/admin\/reportes/)

  await ctx.close()
})

test('un super_admin abre Reportes, filtra y tiene el botón de exportar', async ({ browser }) => {
  // `dual.json` = rol legacy 'doctor' + super_admin ADICIONAL en user_roles: el gating debe
  // resolverse por el rol EFECTIVO del RBAC, no por `users.role` (ver admin-multirol.spec.ts).
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/dashboard')
  await expect(page.getByRole('link', { name: 'Reportes' })).toBeVisible()

  await page.goto('/admin/reportes')
  await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible()

  // La vista previa carga desde el backend: aparece la cabecera de la primera columna del
  // reporte de médicos (las columnas las manda el backend, no están hardcodeadas en la página).
  await expect(page.getByRole('columnheader', { name: 'Nombre completo' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Exportar a Excel/ })).toBeVisible()

  // Cambiar de reporte repinta las columnas con las del otro listado.
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Zona afectada' })).toBeVisible()

  // Un filtro que no puede casar con nada deja la tabla vacía y desactiva la exportación: no
  // se ofrece generar un Excel de cero filas.
  await page.getByPlaceholder(/Buscar nombre, cédula, email o teléfono/).fill('zzz-inexistente')
  await expect(page.getByText('Ningún registro coincide con estos filtros.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Exportar a Excel/ })).toBeDisabled()

  await ctx.close()
})

test('el super_admin descarga el Excel del reporte', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/reportes')
  await expect(page.getByRole('button', { name: /Exportar a Excel/ })).toBeEnabled()

  // La descarga va por fetch + blob (el endpoint exige el JWT en una cabecera, que un <a href>
  // no puede mandar), así que lo que se comprueba es que ese camino produce una descarga real
  // con el nombre que fija el backend — no un enlace roto ni un JSON de error.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Exportar a Excel/ }).click()
  ])
  expect(download.suggestedFilename()).toMatch(/^medicos-\d{4}-\d{2}-\d{2}\.xlsx$/)
  await expect(page.getByText(/Reporte descargado como/)).toBeVisible()

  await ctx.close()
})
