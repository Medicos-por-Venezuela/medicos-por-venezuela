// Sala de espera del paciente: con sala creada, la videoconsulta es la acción principal y se
// avisa que también pueden contactarlo por WhatsApp; sin sala, cae al fallback. (La sala la crea
// el BACKEND — POST /consultations/{id}/video-room — desde el registro; el viejo /api/videoconsulta
// de Next moría en Amplify y dejaba a TODOS los pacientes sin videollamada.)
import { test, expect, request } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

test('paciente con sala: botón de videoconsulta + aviso de WhatsApp', async ({ browser }) => {
  // Sembrar consulta y crear su sala por el MISMO endpoint público que usa el registro.
  const api = await request.newContext()
  const patient = await api.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Sala',
      phone_whatsapp: '+584120000012',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  const cons = await api.post(`${API}/consultations`, { data: { patient_id: patientId } })
  const cid = (await cons.json()).id
  const withRoom = await api.post(`${API}/consultations/${cid}/video-room`)
  const room = (await withRoom.json()).video_room_url
  expect(room, 'el backend debe generar la sala').toContain('/vamed-')
  await api.dispose()

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(
    `/sala-espera?nombre=E2E%20Paciente%20Sala&cid=${cid}&room=${encodeURIComponent(room)}`
  )

  await expect(page.getByRole('button', { name: 'Entrar a la videoconsulta' })).toBeVisible()
  await expect(page.getByText(/contactarte por WhatsApp/)).toBeVisible()

  await ctx.close()
})
