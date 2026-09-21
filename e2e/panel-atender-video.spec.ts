// "Atender paciente" con un caso SIN sala: el mismo claim del backend crea la sala, el panel la
// abre en una pestaña nueva y el detalle muestra "Unirse a videoconsulta". La atención es siempre
// por video: el botón de WhatsApp ya no existe. Reproduce el reporte "no me abre el link y
// desaparece el botón de unirse".
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

test('atender paciente crea la sala en el claim y el detalle muestra Unirse', async ({
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

  // Confirmar el aviso: el claim crea la sala y la abre en pestaña nueva (popup con Jitsi).
  await atender.click()
  const popupPromise = page.waitForEvent('popup')
  await aviso.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  const popup = await popupPromise
  expect(popup.url()).toContain('/vamed-')
  await popup.close()

  // Y el detalle muestra el CTA "Unirse a videoconsulta" (la consulta ya tiene sala).
  await expect(page).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))
  const unirse = page.getByRole('button', { name: 'Unirse a videoconsulta' })
  await expect(unirse).toBeVisible()

  // Volver a entrar desde el detalle también pasa por el aviso. Este paciente se creó sin
  // correo, así que el aviso no puede prometer que le llegó uno.
  await unirse.click()
  await expect(aviso.getByText(/no recibió el aviso por correo/)).toBeVisible()
  const popupDetalle = page.waitForEvent('popup')
  await aviso.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  expect((await popupDetalle).url()).toContain('/vamed-')

  await ctx.close()
})
