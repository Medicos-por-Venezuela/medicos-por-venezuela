// Buscador rápido de correos en /registro-medico: al salir del campo se pregunta al backend si el
// correo ya está registrado. Si es de un médico, un aviso con dos ENLACES —iniciar sesión y
// recordar la clave— en vez de dejar que el alta cree una cuenta que luego no podrá guardar la
// ficha (así nacían las cuentas huérfanas).
//
// Ningún test envía el formulario: el alta manda correos reales desde el backend local.
import { test, expect, type Page } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

async function buscarCorreo(page: Page, email: string): Promise<void> {
  await page.goto('/registro-medico')
  const campo = page.getByLabel(/^Correo/)
  await campo.fill(email)
  const respuesta = page.waitForResponse((r) => r.url().includes('/doctors/registration-check'))
  await campo.blur()
  expect((await respuesta).ok()).toBe(true)
}

test('correo de un médico ya registrado: aviso con enlaces a entrar y a recordar la clave', async ({
  page
}) => {
  await buscarCorreo(page, 'e2e-doc1@example.com')

  const aviso = page.getByRole('dialog', { name: 'Ya estás registrado' })
  await expect(aviso).toBeVisible()
  await expect(aviso).toContainText('Usted ya está registrado como Médico')
  await expect(aviso.getByRole('link', { name: 'inicie sesión' })).toHaveAttribute('href', '/login')
  await expect(aviso.getByRole('link', { name: 'pida recordar su clave' })).toHaveAttribute(
    'href',
    '/auth/recuperar'
  )

  // Escape lo cierra, como el resto de modales del sitio.
  await page.keyboard.press('Escape')
  await expect(aviso).toBeHidden()
})

test('el enlace "inicie sesión" del aviso lleva a /login', async ({ page }) => {
  await buscarCorreo(page, 'E2E-DOC1@example.com') // sin distinguir mayúsculas
  await page
    .getByRole('dialog', { name: 'Ya estás registrado' })
    .getByRole('link', { name: 'inicie sesión' })
    .click()
  await expect(page).toHaveURL(/\/login$/)
})

test('correo libre: ningún aviso', async ({ page }) => {
  await buscarCorreo(page, `e2e-libre-${Date.now()}@example.com`)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('registro a medias: sin aviso, con la pista de terminarlo con la misma contraseña', async ({
  page
}) => {
  await buscarCorreo(page, 'e2e-sin-ficha@example.com')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Ya empezaste un registro con este correo')).toBeVisible()
})
