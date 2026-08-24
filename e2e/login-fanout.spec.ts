// Fan-out por rol de la puerta ÚNICA /login. A diferencia del resto de specs (que entran con
// storageState ya autenticado), estos pasan por el formulario de verdad: es lo único que ejercita
// resolvePostLoginRoute, que es donde vivía el bug.
import { test, expect, type Page } from '@playwright/test'

const PASSWORD = 'e2e-Test-123456'

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

// Contexto limpio por test: sin storageState, para que /login arranque sin sesión previa.
test.use({ storageState: { cookies: [], origins: [] } })

test('paciente entra por /login y aterriza en su portal', async ({ page }) => {
  await loginAs(page, 'e2e-patient@example.com')
  await expect(page).toHaveURL(/\/mi-caso/)
  // Y el portal ya NO trae formulario propio: el login vive solo en /login.
  await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()
})

test('médico sin permisos de admin aterriza en el panel médico', async ({ page }) => {
  await loginAs(page, 'e2e-doc1@example.com')
  await expect(page).toHaveURL(/\/panel-medico/)
  await expect(page).not.toHaveURL(/\/admin/)
})

test('admin puro aterriza en el dashboard admin', async ({ page }) => {
  await loginAs(page, 'e2e-admin@example.com')
  await expect(page).toHaveURL(/\/admin\/dashboard/)
})

// Caso multi-rol: rol legado 'doctor' en users.role + super_admin en user_roles. Funciona porque
// GET /auth/me NO devuelve la columna legada, sino el rol EFECTIVO del RBAC — para este usuario,
// 'super_admin'. Es una dependencia silenciosa entre backend y frontend: si /auth/me dejara de
// colapsar el multi-rol, /login mandaría a este usuario al panel médico sin que nada más chille.
// Este test es lo que hace ruido si eso pasa.
test('médico CON permisos de admin (RBAC multi-rol) aterriza en el dashboard admin', async ({
  page
}) => {
  await loginAs(page, 'e2e-dual@example.com')
  await expect(page).toHaveURL(/\/admin\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Dashboard administrativo' })).toBeVisible()
})

test('las puertas viejas redirigen a /login', async ({ page }) => {
  for (const old of ['/login-medico', '/admin', '/admin/login']) {
    await page.goto(old)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  }
})

test('con sesión abierta, /login no pide credenciales otra vez', async ({ page }) => {
  await loginAs(page, 'e2e-patient@example.com')
  await expect(page).toHaveURL(/\/mi-caso/)
  // Volver a /login con la sesión viva debe reenviar al portal, no enseñar el formulario. Es lo
  // que hacía /mi-caso cuando era login Y portal a la vez.
  await page.goto('/login')
  await expect(page).toHaveURL(/\/mi-caso/)
})

test('sin sesión, /mi-caso manda a /login y no rebota', async ({ page }) => {
  await page.goto('/mi-caso')
  await expect(page).toHaveURL(/\/login$/)
  // Un segundo de gracia: si hubiera bucle /login ↔ /mi-caso, la URL cambiaría.
  await page.waitForTimeout(1000)
  await expect(page).toHaveURL(/\/login$/)
})
