// Una admin que ADEMÁS ejerce (el caso real: super_admin + Medicina general y Cardiología). Ve
// todas las colas por ser admin, pero quiere las suyas separadas — y como las ve todas, la última
// card reúne el resto: si no, habría pacientes que no aparecen en ninguna card aunque el KPI los
// cuente.
import { test, expect } from '@playwright/test'
import { crearConsultaEnEspera } from './helpers'

const MARCADOR_GENERAL = 'E2E Paciente Dual General'
const MARCADOR_AJENO = 'E2E Paciente Dual Ajeno'

test('admin que ejerce: una card por su especialidad y otra con el resto', async ({ browser }) => {
  const general = await crearConsultaEnEspera(MARCADOR_GENERAL)
  const ajeno = await crearConsultaEnEspera(MARCADOR_AJENO, 'Traumatología y ortopedia')
  // Por el id del caso: el de Traumatología no es de su especialidad y llega sin motivo (dato
  // clínico), así que su texto no sirve para encontrar la tarjeta.
  const card = (id: string) => page.locator(`.card-flat[data-consultation-id="${id}"]`)

  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const page = await ctx.newPage()
  await page.goto('/panel-medico')

  const entrada = page.getByRole('button', {
    name: 'Ver consultas pendientes de Medicina general'
  })
  const suya = page.getByRole('button', { name: /mi especialidad: Cardiología/ })
  const resto = page.getByRole('button', { name: 'Ver consultas de otras especialidades' })
  await expect(entrada).toBeVisible()
  await expect(suya).toBeVisible()
  await expect(resto).toBeVisible()

  // Traumatología no es suya, pero la ve por ser admin: cae en la card del resto, no en las otras.
  await entrada.click()
  await expect(card(general.id)).toBeVisible()
  await expect(card(ajeno.id)).toHaveCount(0)

  await page.getByRole('button', { name: 'Ver todas las consultas' }).click()
  await resto.click()
  await expect(card(ajeno.id)).toBeVisible()
  await expect(card(general.id)).toHaveCount(0)

  await ctx.close()
})
