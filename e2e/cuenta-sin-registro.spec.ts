// Estar en Supabase Auth no basta para entrar: una cuenta sin ficha en `doctors` ni paciente en
// `patients` se rechaza en /login. En producción había cuentas así —registros de médico que crearon
// la cuenta y no llegaron a guardar la ficha— que entraban al sitio igual.
//
// Pasa por el formulario de verdad (sin storageState), como login-fanout.spec.ts: es lo único que
// ejercita resolvePostLoginRoute.
import { test, expect } from '@playwright/test'

const PASSWORD = 'e2e-Test-123456'

test.use({ storageState: { cookies: [], origins: [] } })

test('una cuenta de médico sin ficha no entra por /login y queda sin sesión', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('e2e-sin-ficha@example.com')
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()

  // El aviso se queda en /login, donde la persona está mirando, y le dice cómo terminar el alta.
  await expect(
    page.getByText('Tu cuenta no tiene un registro activo como médico ni como paciente')
  ).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)

  // Y la sesión se cerró: el panel no la reconoce y devuelve a /login.
  await page.goto('/panel-medico')
  await expect(page).toHaveURL(/\/login$/)
})
