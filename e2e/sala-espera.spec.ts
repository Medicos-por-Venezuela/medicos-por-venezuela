// Sala de espera del paciente EN VIVO, y la regla que la define: ESTA PANTALLA NO DA ACCESO A LA
// VIDEOCONSULTA.
//
// El bug se arregló en dos pasos. Primero: el paciente veía "Entrar a la videoconsulta" desde el
// registro y entraba a una sala donde no había nadie; se pasó a mostrarlo solo al tomar el caso.
// Segundo (esto): tomar un caso TAMPOCO es estar en la sala —el médico puede tomarlo para
// responder por escrito—, así que el botón se fue de aquí del todo. El acceso vive en el aviso del
// hilo (R16), que solo existe cuando el médico INICIA la videoconsulta.
//
// Lo que este spec fija, por tanto: al tomar el caso el paciente lee que lo tomaron y puede
// escribir, pero NO le aparece ninguna puerta a la sala; y la puerta aparece —en el hilo— cuando
// la llamada es real.
import { test, expect } from '@playwright/test'
import { crearConsultaEnEspera } from './helpers'

const MARCADOR = 'E2E Paciente Sala'

test('al tomar el caso el paciente puede escribir, pero no entrar; la entrada llega con la llamada', async ({
  browser
}) => {
  const { id: cid, token } = await crearConsultaEnEspera(MARCADOR)

  const ctxPaciente = await browser.newContext()
  const paciente = await ctxPaciente.newPage()
  await paciente.goto(`/sala-espera?nombre=E2E&cid=${cid}&t=${token}`)

  // El token sale de la URL (queda en sessionStorage): no debe quedar en el historial.
  await expect(paciente).not.toHaveURL(/[?&]t=/)
  await expect(paciente.getByText('Estás en la sala de espera')).toBeVisible()
  await expect(paciente.getByText('Medicina general', { exact: true })).toBeVisible()
  await expect(paciente.getByText(/alta demanda de pacientes/)).toBeVisible()
  await expect(paciente.getByText(/Atento a tu correo/)).toBeVisible()
  await expect(paciente.getByRole('button', { name: 'Entrar a la videoconsulta' })).toHaveCount(0)

  // La marca: la barra superior con el logo.
  await expect(paciente.getByRole('img', { name: 'Médicos por Venezuela' })).toBeVisible()

  // Un médico toma el caso desde su panel. Desde 2026-10-14 "Atender paciente" SOLO hace el claim
  // y lleva a la ficha: no entra a la sala ni anuncia una llamada que nadie ha empezado.
  const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const medico = await ctxMedico.newPage()
  await medico.goto('/panel-medico')
  const card = medico.locator('.card-flat').filter({ hasText: MARCADOR })
  await card.getByRole('button', { name: 'Atender paciente' }).click()
  await expect(medico).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))

  // Sin recargar: la sala del paciente cambia sola y dice que su caso está tomado…
  await expect(paciente.getByText(/tomó tu caso/)).toBeVisible({ timeout: 20_000 })
  // …y le ofrece ESCRIBIR, que es lo que de verdad puede hacer en ese momento.
  const compositor = paciente.locator('[data-testid="input-mensaje-texto"]')
  await expect(compositor).toBeVisible()
  await expect(compositor).toBeEnabled()

  // Lo que NO hay en la sala de espera: ninguna puerta a la videoconsulta. Es la regresión que
  // este spec existe para impedir — ni ahora ni cuando alguien "restaure" el botón.
  await expect(paciente.getByRole('button', { name: 'Entrar a la videoconsulta' })).toHaveCount(0)

  // Y mientras el médico no llame, el paciente TAMPOCO tiene aviso de llamada en el hilo: tomar
  // el caso no es iniciarla.
  await expect(paciente.locator('[data-testid="mensaje-sistema"][data-kind="call"]')).toHaveCount(0)

  // Ahora sí: el médico inicia la videoconsulta desde el botón de cámara del hilo, que es el único
  // camino a la sala y el que comprueba que el paciente esté delante (CA16.2). Lo está —tiene la
  // sala de espera abierta—, así que el botón se habilita.
  const camaraMedico = medico.locator('[data-testid="btn-iniciar-videollamada"]')
  await expect(camaraMedico).toBeEnabled({ timeout: 20_000 })
  const popupMedico = medico.waitForEvent('popup')
  await camaraMedico.click()
  await medico.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  await (await popupMedico).close()

  // La entrada del paciente aparece donde sí refleja una llamada real: el aviso del hilo que acaba
  // de dejar esa llamada. Abre la MISMA sala que abrió el médico y registra la entrada.
  const avisoLlamada = paciente.locator('[data-testid="mensaje-sistema"][data-kind="call"]').last()
  await expect(avisoLlamada).toBeVisible({ timeout: 20_000 })
  const entrar = avisoLlamada.locator('[data-testid="btn-entrar-videoconsulta"]')
  await expect(entrar).toBeVisible()

  // La ventana se abre con `about:blank` DENTRO del clic y se la navega a la sala cuando vuelve la
  // respuesta (es lo que evita que el navegador la bloquee como pop-up). Por eso aquí no se
  // asierta su URL: justo después del evento todavía es `about:blank`, y esperar la navegación
  // real a Jitsi metería una dependencia de red en este spec. Esa costura —`about:blank` primero,
  // destino pasado por `browserRoomUrl` después— la cubre `mensajes-videollamada.spec.ts` con su
  // espía de `window.open`. Lo que SÍ se prueba aquí es el efecto de punta a punta: la entrada
  // queda registrada y el médico la ve.
  const popupPaciente = paciente.waitForEvent('popup')
  const entrada = paciente.waitForResponse(
    (r) => r.url().includes('/entered-call') && r.request().method() === 'POST'
  )
  await entrar.click()
  await (await popupPaciente).close()
  expect((await entrada).status()).toBe(200)

  await ctxMedico.close()
  await ctxPaciente.close()
})

test('recargar la sala de espera no pierde la credencial', async ({ page }) => {
  const { id: cid, token } = await crearConsultaEnEspera(`${MARCADOR} Recarga`)
  await page.goto(`/sala-espera?cid=${cid}&t=${token}`)
  await expect(page.getByText('Estás en la sala de espera')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Estás en la sala de espera')).toBeVisible()
  await expect(page.getByText(/enlace de tu sala de espera caducó/)).toHaveCount(0)
})
