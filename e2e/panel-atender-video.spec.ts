// "Atender por videoconsulta" con un caso SIN sala (creado por API/WhatsApp o durante el bug
// del hosting): el panel debe CREAR la sala (backend, idempotente, antes del claim), abrirla en
// una pestaña nueva y el detalle debe mostrar "Unirse a videoconsulta". Reproduce el reporte
// "no me abre el link y desaparece el botón de unirse".
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

test('atender por videoconsulta crea la sala si falta y el detalle muestra Unirse', async ({
  browser
}) => {
  // Consulta SIN sala (la API pública no la crea sola).
  const api = await request.newContext()
  const patient = await api.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Video',
      phone_whatsapp: '+584120000013',
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

  // El claim crea la sala y la abre en pestaña nueva (popup con la URL de Jitsi).
  const popupPromise = page.waitForEvent('popup')
  await card.getByRole('button', { name: 'Atender por videoconsulta' }).click()
  const popup = await popupPromise
  expect(popup.url()).toContain('/vamed-')
  await popup.close()

  // Y el detalle muestra el CTA "Unirse a videoconsulta" (la consulta ya tiene sala).
  await expect(page).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))
  await expect(page.getByRole('link', { name: 'Unirse a videoconsulta' })).toBeVisible()

  await ctx.close()
})
