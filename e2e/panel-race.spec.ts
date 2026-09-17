// La cola del panel: un caso de Medicina general aparece en vivo al médico general y, en su cola
// de ENTRADA (aparte de la suya), al especialista; si dos lo intentan tomar a la vez solo uno gana
// (claim atómico).
import { test, expect } from '@playwright/test'
import { crearConsultaEnEspera } from './helpers'

const MARCADOR = 'E2E Paciente Carrera'

test('el caso sale en la cola de entrada del especialista y solo un médico lo toma', async ({
  browser
}) => {
  const { id: cid } = await crearConsultaEnEspera(MARCADOR)

  // doc1 = Medicina general (la del caso). admin = los admins ven todas las colas.
  // doc2 = Cardiología: lo ve en su cola de ENTRADA, no en la de su especialidad.
  const ctx1 = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const ctx2 = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const ctxOtra = await browser.newContext({ storageState: 'e2e/.auth/doc2.json' })
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()
  const cardiologo = await ctxOtra.newPage()

  await page1.goto('/panel-medico')
  await page2.goto('/panel-medico')
  await cardiologo.goto('/panel-medico')

  // Los contadores del panel: solo "En espera por atender" y "Consultas cerradas por mí".
  await expect(page1.getByText('En espera por atender')).toBeVisible()
  await expect(page1.getByText('Consultas cerradas por mí')).toBeVisible()
  await expect(page1.getByText('En videollamada ahora')).toHaveCount(0)
  await expect(page1.getByText('Esperando para tu especialidad')).toHaveCount(0)
  // Y ya no hay botón de "atender al siguiente": se atiende desde la tarjeta del paciente.
  await expect(page1.getByRole('button', { name: /Atender al siguiente/ })).toHaveCount(0)

  const cardIn = (page: typeof page1) => page.locator('.card-flat').filter({ hasText: MARCADOR })
  await expect(cardIn(page1)).toBeVisible()
  await expect(cardIn(page2)).toBeVisible()

  // El cardiólogo ve DOS colas; el caso está en la de entrada, no en la de su especialidad.
  await expect(
    cardiologo.getByRole('button', { name: /Ver consultas pendientes de mi especialidad/ })
  ).toBeVisible()
  await cardiologo
    .getByRole('button', { name: /Ver consultas pendientes de Medicina general/ })
    .click()
  await expect(cardIn(cardiologo)).toBeVisible()
  await cardiologo.getByRole('button', { name: 'Ver todas las consultas' }).click()
  await cardiologo
    .getByRole('button', { name: /Ver consultas pendientes de mi especialidad/ })
    .click()
  await expect(cardIn(cardiologo)).toHaveCount(0)

  // Ambos abren el aviso ANTES de que ninguno confirme: así la carrera es determinista (si doc1
  // confirmara primero, Realtime le quitaría la card al otro y no podría intentar tomarla).
  const confirmar = { name: 'Entendido, continuar a la videollamada' }
  await cardIn(page1).getByRole('button', { name: 'Atender paciente' }).click()
  await cardIn(page2).getByRole('button', { name: 'Atender paciente' }).click()
  await expect(page1.getByRole('button', confirmar)).toBeVisible()
  await expect(page2.getByRole('button', confirmar)).toBeVisible()

  // doc1 confirma → gana el claim atómico → se abre la sala y navega a la consulta.
  const popup = page1.waitForEvent('popup')
  await page1.getByRole('button', confirmar).click()
  expect((await popup).url()).toContain('/vamed-')
  await expect(page1).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))

  // El otro confirma el MISMO caso → 409 → mensaje, sin sala, y sigue en el panel.
  await page2.getByRole('button', confirmar).click()
  await expect(page2.getByText(/ya fue tomado por otro médico/i)).toBeVisible()
  await expect(page2).toHaveURL(/\/panel-medico$/)

  await ctx1.close()
  await ctx2.close()
  await ctxOtra.close()
})
