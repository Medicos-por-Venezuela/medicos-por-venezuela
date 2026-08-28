// La lista del admin debe distinguir a los médicos con cédula validada contra SACS/FPV de los que
// no. Antes leía `users.verified` —constante true, nadie la baja— y pintaba a TODOS en verde,
// incluidos los 795 con la cédula sin validar. El dato real vive en `doctors.verified`.
//
// Si alguien vuelve a apuntar el badge a `users.verified`, este spec se pone rojo: doc1 y doc3
// tienen el MISMO users.verified (true) y distinto doctors.verified.
import { test, expect, type Locator, type Page } from '@playwright/test'

/** La fila de esa persona en la tabla de CUENTAS, tras filtrar. Devolver la fila (y no la página)
 *  es lo que evita que las aserciones caigan sobre los ~3500 usuarios sin filtrar mientras corre el
 *  debounce. El selector se ancla a `.users-table` porque la página tiene además la tabla de
 *  credenciales, con su propio buscador: sin anclar, la misma persona sale en las dos. */
async function filaDe(page: Page, nombre: string): Promise<Locator> {
  await page.getByPlaceholder('Buscar nombre o email').fill(nombre)
  // El buscador va con debounce de 300 ms + fetch server-side: se espera a que la tabla quede
  // reducida a la única coincidencia, no a que el texto aparezca (ya podía estar visible antes).
  const fila = page.locator('table.users-table tbody tr').filter({ hasText: nombre })
  await expect(fila).toHaveCount(1)
  return fila
}

test('la lista del admin distingue cédula validada de cédula sin validar', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()
  await page.goto('/admin/doctores')

  // doc1: cédula validada contra SACS.
  const uno = await filaDe(page, 'E2E Doctor Uno')
  await expect(uno.getByText('Cédula verificada')).toBeVisible()
  await expect(uno.getByText('Cédula sin verificar')).toHaveCount(0)

  // doc3: MISMO users.verified (true), pero doctors.verified = false. Que estas dos filas se vean
  // distintas es justo lo que no pasaba antes.
  const tres = await filaDe(page, 'E2E Doctor Tres')
  await expect(tres.getByText('Cédula sin verificar')).toBeVisible()
  await expect(tres.getByText('Cédula verificada')).toHaveCount(0)

  await ctx.close()
})

test('quien no es médico no lleva badge de cédula', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()
  await page.goto('/admin/doctores')

  // El admin de prueba no tiene ficha en `doctors`: no hay credencial que validar, así que no se
  // afirma nada. Un `false` aquí diría "cédula sin verificar" de alguien que no tiene cédula.
  const admin = await filaDe(page, 'E2E Admin')
  await expect(admin.getByText('Cédula verificada')).toHaveCount(0)
  await expect(admin.getByText('Cédula sin verificar')).toHaveCount(0)

  await ctx.close()
})
