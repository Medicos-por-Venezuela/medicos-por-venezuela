// "Atender paciente" con un caso SIN sala: el claim del backend crea la sala, pero el panel YA NO
// entra en ella — lleva a la ficha del caso. La llamada se inicia después, desde el botón de
// cámara del hilo, que es el único que comprueba si el paciente está delante.
//
// La segunda mitad cambió en CA16.2b: el detalle ya no tiene el CTA "Unirse a videoconsulta" de la
// cabecera, así que volver a entrar se hace desde el botón de cámara del hilo. Se prueba ese
// camino —el que sustituye al que se fue—: el CTA no está; el botón del chat empieza DESHABILITADO
// porque el paciente no se ha conectado (CA16.2) y se habilita en vivo cuando abre su sala de
// espera; pasa por su propio modal (variante `medico-llamada`, que no promete correo); y
// confirmarlo llama de verdad y deja el aviso en el hilo.
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

test('atender paciente crea la sala en el claim y se reentra desde el botón del hilo', async ({
  browser
}) => {
  // Consulta SIN sala (la API pública no la crea sola).
  const api = await request.newContext()
  const patient = await api.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Video',
      phone_whatsapp: '+584120000013',
      emergency_phone: '+584140000013',
      address_encrypted: 'v1:dGVzdCBjaXBoZXJ0ZXh0',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  // La cola oculta el nombre; el card muestra chief_complaint → lo usamos como marcador.
  const cons = await api.post(`${API}/consultations`, {
    data: {
      patient_id: patientId,
      chief_complaint: 'E2E Paciente Video',
      specialty_id: await idEspecialidadGeneral()
    }
  })
  const cid = (await cons.json()).id
  await api.dispose()

  const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const page = await ctx.newPage()
  await page.goto('/panel-medico')

  const card = page.locator('.card-flat').filter({ hasText: 'E2E Paciente Video' })
  await expect(card).toBeVisible()
  // La tarjeta muestra la especialidad de la cola en vez de "Paciente", y ya no ofrece WhatsApp.
  await expect(card.getByText('Medicina general', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: /WhatsApp/i })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Derivar a especialista' })).toBeVisible()

  // "Atender paciente" TOMA el caso y abre su ficha. No hay aviso previo, no se abre ninguna
  // ventana y no se pide la videollamada: desde 2026-10-14 tomar un caso ya no es entrar a la
  // sala. Es la otra mitad del arreglo de la sala de espera — allí se quitó el botón que mandaba
  // al paciente a una sala vacía; aquí, el que mandaba al médico a esperar a quien no está.
  let avisosEnHilo = 0
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/video-call')) avisosEnHilo += 1
  })
  let ventanasAbiertas = 0
  page.on('popup', () => {
    ventanasAbiertas += 1
  })

  const atender = card.getByRole('button', { name: 'Atender paciente' })
  await atender.click()

  // Va directo a la ficha, sin pasar por ningún diálogo.
  await expect(page).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Y no anunció una llamada que nadie ha iniciado. Se comprueba DESPUÉS de que la ficha cargó:
  // asertar un contador a cero nada más pulsar pasaría aunque la petición saliera un instante
  // después.
  expect(avisosEnHilo).toBe(0)
  expect(ventanasAbiertas).toBe(0)

  // El detalle ya NO tiene el CTA de la cabecera: salió en CA16.2b por duplicar el camino.
  await expect(page).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))
  await expect(page.getByRole('button', { name: 'Unirse a videoconsulta' })).toHaveCount(0)

  // Volver a entrar se hace desde el botón de cámara del hilo. Con el paciente sin conectar está
  // DESHABILITADO (CA16.2, tercera redacción: llamar a quien no está delante abre una sala vacía)
  // y lo dice con palabras.
  const camara = page.locator('[data-testid="btn-iniciar-videollamada"]')
  await expect(camara).toBeVisible()
  await expect(camara).toBeDisabled()
  await expect(camara).toHaveAccessibleName(/El paciente no está conectado/)

  // El paciente abre su sala de espera y se anuncia por Realtime Presence: el botón se habilita en
  // vivo, sin recargar.
  const ctxPaciente = await browser.newContext()
  const paciente = await ctxPaciente.newPage()
  await paciente.goto(`/sala-espera?cid=${cid}&nombre=Test&room=r&code=ABC`)
  await expect(paciente.getByRole('heading', { name: /Gracias/ })).toBeVisible()
  await expect(camara).toBeEnabled({ timeout: 20_000 })

  let llamadas = 0
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/video-call')) llamadas += 1
  })

  await camara.click()
  const avisoChat = page.getByRole('dialog')
  // Variante `medico-llamada`: aquí al paciente le llega el aviso del chat, no un correo, así que
  // el modal no puede decir ni que lo recibió ni que no lo recibió.
  await expect(avisoChat.getByText(/en el chat de la consulta/)).toBeVisible()
  await expect(avisoChat.getByText(/no recibió el aviso por correo/)).toHaveCount(0)
  await expect(avisoChat.getByText(/recibe un correo/)).toHaveCount(0)

  const popupChat = page.waitForEvent('popup')
  await avisoChat.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()

  // La llamada sale de verdad (una sola vez) y deja su aviso en el hilo. El destino de la ventana
  // no se asierta aquí: lo cubre `mensajes-videollamada.spec.ts`, que espía `window.open` y
  // comprueba que pasa por `browserRoomUrl` sin depender de que Jitsi responda.
  await expect.poll(() => llamadas, { timeout: 15_000 }).toBe(1)
  await expect(
    page.locator('[data-testid="mensaje-sistema"][data-kind="call"]').first()
  ).toBeVisible({ timeout: 15_000 })
  await (await popupChat).close()
  await ctxPaciente.close()

  await ctx.close()
})
