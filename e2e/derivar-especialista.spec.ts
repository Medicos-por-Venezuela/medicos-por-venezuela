// Derivar a otra especialidad, desde las dos puertas:
//  - la cola (el caso nadie lo tomó): elegir especialidad → confirmar → pasa a la cola de esa
//    especialidad, con el aviso "Derivado desde".
//  - el detalle (el médico ya atendió): "Derivar con especialista" → especialidad → motivo →
//    firma, sin fecha. El paciente entra a la cola del especialista y este ve quién y por qué.
//
// Destino: Cardiología, la especialidad de doc2 (la única del seed con un médico habilitado
// además de Medicina general). El modal solo ofrece colas con médicos atendiéndolas.
import { test, expect } from '@playwright/test'
import { ESPECIALIDAD_E2E } from './global-setup'
import { crearConsultaEnEspera } from './helpers'

test('desde la cola: confirmar y el caso pasa a la cola del especialista', async ({ browser }) => {
  const marcador = `E2E Paciente Derivar Cola ${Date.now()}`
  await crearConsultaEnEspera(marcador)

  const ctxGeneral = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const general = await ctxGeneral.newPage()
  await general.goto('/panel-medico')
  const card = general.locator('.card-flat').filter({ hasText: marcador })
  await card.getByRole('button', { name: 'Derivar a especialista' }).click()

  const modal = general.getByRole('dialog', { name: 'Derivar a especialista' })
  await expect(modal).toBeVisible()
  // "Otra" no es destino, ni la especialidad actual del caso.
  await expect(modal.getByRole('radio', { name: 'Otra' })).toHaveCount(0)
  await expect(modal.getByRole('radio', { name: 'Medicina general' })).toHaveCount(0)
  await modal.getByPlaceholder('Buscar especialidad…').fill('cardio')
  await modal.getByRole('radio', { name: ESPECIALIDAD_E2E }).check()
  await modal.getByRole('button', { name: 'Derivar' }).click()

  // Confirmación con el nombre de la especialidad; cancelar no deriva.
  const confirmar = general.getByRole('dialog', { name: 'Derivar paciente' })
  await expect(confirmar.getByText(`¿Seguro que quieres derivar este paciente a`)).toBeVisible()
  await expect(confirmar.getByText(ESPECIALIDAD_E2E)).toBeVisible()
  await confirmar.getByRole('button', { name: 'Sí, derivar' }).click()
  await expect(general.getByText(`Derivaste el caso a ${ESPECIALIDAD_E2E}`)).toBeVisible()
  await expect(card).toHaveCount(0)

  // El cardiólogo lo ve, titulado con su especialidad y con de dónde viene.
  const ctxCardio = await browser.newContext({ storageState: 'e2e/.auth/doc2.json' })
  const cardio = await ctxCardio.newPage()
  await cardio.goto('/panel-medico')
  const suya = cardio.locator('.card-flat').filter({ hasText: marcador })
  await expect(suya).toBeVisible()
  await expect(suya.getByText(ESPECIALIDAD_E2E, { exact: true })).toBeVisible()
  await expect(suya.getByText('Derivado desde Medicina general')).toBeVisible()

  await ctxGeneral.close()
  await ctxCardio.close()
})

test('desde el detalle: motivo y firma, sin fecha, y el especialista ve por qué', async ({
  browser
}) => {
  const marcador = `E2E Paciente Derivar Detalle ${Date.now()}`
  const motivo = 'Soplo sistólico nuevo, requiere valoración de cardiología.'
  await crearConsultaEnEspera(marcador)

  const ctxGeneral = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const general = await ctxGeneral.newPage()
  await general.goto('/panel-medico')
  await general
    .locator('.card-flat')
    .filter({ hasText: marcador })
    .getByRole('button', { name: 'Atender paciente' })
    .click()
  const popup = general.waitForEvent('popup')
  await general.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  await (await popup).close()
  await expect(general).toHaveURL(/\/panel-medico\/consulta\//)

  // "Agendar con especialista" pasó a llamarse "Derivar con especialista".
  await expect(general.getByRole('button', { name: 'Agendar con especialista' })).toHaveCount(0)
  await general.getByRole('button', { name: 'Derivar con especialista' }).click()
  const modal = general.getByRole('dialog', { name: 'Derivar con especialista' })
  await modal.getByRole('radio', { name: ESPECIALIDAD_E2E }).check()
  await modal.getByRole('button', { name: 'Continuar' }).click()

  // Motivo, SIN fecha y hora de cita.
  const paso = general.getByRole('dialog', { name: 'Derivar con especialista' })
  await expect(paso.getByText(ESPECIALIDAD_E2E, { exact: true })).toBeVisible()
  await expect(paso.locator('input[type="datetime-local"]')).toHaveCount(0)
  await paso.getByLabel('Motivo de la derivación').fill(motivo)
  await paso.getByRole('button', { name: 'Continuar a la firma' }).click()

  const canvas = general.locator('canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No se encontró el canvas de firma')
  await general.mouse.move(box.x + 20, box.y + 20)
  await general.mouse.down()
  await general.mouse.move(box.x + 90, box.y + 60)
  await general.mouse.move(box.x + 140, box.y + 30)
  await general.mouse.up()
  await general.getByRole('button', { name: 'Firmar y continuar' }).click()

  await expect(general).toHaveURL(/\/panel-medico(\?|$)/)
  await expect(general.getByText('Panel actualizado.')).toBeVisible()

  // El cardiólogo la tiene en su cola; al tomarla ve quién la derivó y por qué.
  const ctxCardio = await browser.newContext({ storageState: 'e2e/.auth/doc2.json' })
  const cardio = await ctxCardio.newPage()
  await cardio.goto('/panel-medico')
  const suya = cardio.locator('.card-flat').filter({ hasText: marcador })
  await expect(suya.getByText('Derivado desde Medicina general')).toBeVisible()
  await suya.getByRole('button', { name: 'Atender paciente' }).click()
  const popupCardio = cardio.waitForEvent('popup')
  await cardio.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  await (await popupCardio).close()
  await expect(cardio).toHaveURL(/\/panel-medico\/consulta\//)
  // El bloque de derivación de arriba: quién derivó y por qué. (El motivo sale también en el
  // historial de eventos, de ahí el `.first()`.)
  const derivacion = cardio.getByText(/Paciente derivado desde Medicina general/)
  await expect(derivacion).toBeVisible()
  await expect(derivacion).toContainText('E2E Doctor Uno')
  await expect(cardio.getByText(motivo).first()).toBeVisible()

  await ctxGeneral.close()
  await ctxCardio.close()
})
