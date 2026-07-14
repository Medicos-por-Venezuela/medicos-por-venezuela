// Multi-rol RBAC en el acceso admin: un usuario con rol legacy 'doctor' y super_admin ADICIONAL
// en user_roles (backend) debe poder usar /admin/* — antes el guard solo miraba profiles.role
// (un único rol) y lo rebotaba al login aunque fuera super_admin real.
import { test, expect } from '@playwright/test'

test('dual doctor+super_admin (RBAC) entra al dashboard admin y no rebota', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/dashboard')

  // El guard resolvió el rol efectivo por RBAC: dashboard visible, sin redirect al login.
  await expect(page.getByRole('heading', { name: 'Dashboard administrativo' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/dashboard/)

  // Y con permisos de super_admin efectivos: la pantalla de usuarios carga (profiles.read)
  // en vez de rebotar al login.
  await page.goto('/admin/usuarios')
  await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/usuarios/)

  await ctx.close()
})
