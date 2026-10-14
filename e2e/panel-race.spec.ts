// La cola del panel: un caso de Medicina general aparece en vivo al médico general y, en su cola
// de ENTRADA (aparte de la suya), al especialista; si dos lo intentan tomar a la vez solo uno gana
// (claim atómico).
import { test, expect, type Page } from '@playwright/test'
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

  // Por el id del caso, no por el motivo (que la cola del admin también muestra desde 2026-09-27).
  const cardIn = (page: typeof page1) => page.locator(`.card-flat[data-consultation-id="${cid}"]`)
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

  // Los dos pulsan a la vez. Antes el spec los dejaba parados en el aviso de "antes de entrar" y
  // los hacía confirmar en orden, para que el ganador fuese siempre doc1; desde que ese aviso ya
  // no existe (2026-10-14: tomar un caso lleva a la ficha, no a la sala) el clic ES el claim, así
  // que la carrera se corre de verdad: los dos salen a la vez y gana quien gane.
  //
  // Lo que se afirma no es QUIÉN gana —eso es cosa del azar y de la red—, sino la propiedad que
  // este spec existe para proteger: que gane EXACTAMENTE UNO. El claim es un UPDATE condicional en
  // la base, así que el perdedor recibe 409 sí o sí.
  await Promise.all([
    cardIn(page1).getByRole('button', { name: 'Atender paciente' }).click(),
    cardIn(page2).getByRole('button', { name: 'Atender paciente' }).click()
  ])

  const enDetalle = new RegExp(`/panel-medico/consulta/${cid}`)
  const yaTomado = /ya fue tomado por otro médico/i

  // Un intento está resuelto cuando la página navegó a la ficha (ganó) o muestra el aviso del 409
  // (perdió). Se espera a que los DOS lo estén antes de contar, o se contaría una carrera a medias.
  const resuelta = async (p: Page) =>
    enDetalle.test(p.url()) || (await p.getByText(yaTomado).count()) > 0

  await Promise.all([
    expect.poll(() => resuelta(page1), { timeout: 15_000 }).toBe(true),
    expect.poll(() => resuelta(page2), { timeout: 15_000 }).toBe(true)
  ])

  const ganadores = [page1, page2].filter((p) => enDetalle.test(p.url()))
  expect(ganadores).toHaveLength(1)

  // El perdedor se queda en el panel, con el mensaje y sin sala.
  const perdedor = [page1, page2].find((p) => !enDetalle.test(p.url()))
  expect(perdedor).toBeDefined()
  await expect(perdedor!.getByText(yaTomado)).toBeVisible()
  await expect(perdedor!).toHaveURL(/\/panel-medico$/)

  await ctx1.close()
  await ctx2.close()
  await ctxOtra.close()
})
