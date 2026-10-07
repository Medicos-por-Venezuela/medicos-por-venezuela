// "Atender paciente" con un caso SIN sala: el mismo claim del backend crea la sala, el panel la
// abre en una pestaña nueva. La atención es siempre por video: el botón de WhatsApp ya no existe.
// Reproduce el reporte "no me abre el link y desaparece el botón de unirse".
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

  // Antes de tomar el caso sale el aviso para el médico. Cerrarlo NO puede tomar el caso: el
  // claim es lo que saca al paciente de la cola, y un clic de más dejaría a alguien asignado a
  // un médico que decidió no atenderlo.
  const atender = card.getByRole('button', { name: 'Atender paciente' })
  await atender.click()
  const aviso = page.getByRole('dialog')
  await expect(aviso.getByRole('heading', { name: 'Información importante' })).toBeVisible()
  await expect(aviso.getByText(/espera de 15 a 20 minutos/)).toBeVisible()
  await expect(aviso.getByText(/contactarlo por WhatsApp/)).toBeVisible()
  await aviso.getByRole('button', { name: 'Cerrar' }).click()
  await expect(aviso).toHaveCount(0)
  await expect(page).toHaveURL(/\/panel-medico$/)
  await expect(card).toBeVisible()

  // Confirmar el aviso hace DOS cosas, y la segunda es nueva: el claim (crea la sala) y
  // `POST /video-call`, que deja el aviso en el hilo para que el PACIENTE tenga su botón de
  // entrada. Es la pieza que sustituye al botón que la sala de espera dejó de tener: esta es la
  // única forma de tomar un caso de la cola, así que sin ella el paciente se quedaba con el correo
  // como única vía y el médico esperando en una sala vacía.
  let avisosEnHilo = 0
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/video-call')) avisosEnHilo += 1
  })

  await atender.click()
  const popupPromise = page.waitForEvent('popup')
  await aviso.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  const popup = await popupPromise
  // La URL del popup no se asierta aquí: ahora se abre como `about:blank` dentro del clic y se la
  // navega a la sala al volver la respuesta (lo que evita que el navegador la bloquee), así que
  // justo después del evento todavía es `about:blank`. El destino —pasado por `browserRoomUrl`—
  // lo cubre `mensajes-videollamada.spec.ts` con su espía de `window.open`.
  await popup.close()
  await expect.poll(() => avisosEnHilo, { timeout: 15_000 }).toBe(1)

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
