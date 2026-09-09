import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

// El mismo access_token de la sesión guardada sirve como Bearer contra el backend.
function accessToken(file: string): string {
  const state = JSON.parse(readFileSync(path.join(__dirname, '..', file), 'utf8'))
  const entry = state.origins[0].localStorage.find((e: { name: string }) =>
    e.name.includes('auth-token')
  )
  return JSON.parse(entry.value).access_token
}

// Verifica la presencia del paciente por Realtime Presence (reemplaza el heartbeat): un paciente en
// su sala de espera se anuncia, y el médico que atiende su consulta lo ve EN VIVO, desde otra
// sesión, sin recargar ni heartbeat.
//
// La etiqueta dice "En la página de espera" y ya no "En sala": es lo único que esta señal sabe
// —que tiene abierta una pestaña NUESTRA— y leerla como "está en la videollamada" era el
// malentendido que hacía que el médico viera "Sin conexión" justo cuando el paciente acababa de
// entrar a Jitsi (esa pestaña pasa a segundo plano y se cae el WebSocket). Que el paciente entró
// de verdad lo dice `entered_call_at`, otra señal y otro badge — ver EstadoPacienteBadge.
test('paciente conectado en sala → el médico lo ve en línea (Realtime Presence)', async ({
  browser
}) => {
  const token = accessToken('e2e/.auth/doc1.json')
  const ctx = await request.newContext()
  const auth = { Authorization: `Bearer ${token}` }

  // Paciente + consulta, tomada por el médico (claim) para que la pueda abrir en el detalle.
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente EnLinea',
      phone_whatsapp: '+584120000021',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  const cons = await ctx.post(`${API}/consultations`, {
    data: { patient_id: patientId, specialty_id: await idEspecialidadGeneral() }
  })
  const cid = (await cons.json()).id
  const claim = await ctx.post(`${API}/consultations/${cid}/claim`, { data: {}, headers: auth })
  expect(claim.ok(), await claim.text()).toBeTruthy()
  await ctx.dispose()

  // El MÉDICO abre la consulta. Antes de que el paciente llegue, aparece "Sin conexión".
  const doctorCtx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const doctorPage = await doctorCtx.newPage()
  await doctorPage.goto(`/panel-medico/consulta/${cid}`)
  await expect(doctorPage.getByRole('heading', { name: 'Detalle de consulta' })).toBeVisible()
  await expect(doctorPage.getByText('○ Sin conexión')).toBeVisible()

  // El PACIENTE (anónimo) abre su sala de espera → se anuncia por Presence con su consultation_id.
  const patientCtx = await browser.newContext()
  const patientPage = await patientCtx.newPage()
  await patientPage.goto(`/sala-espera?cid=${cid}&nombre=Test&room=r&code=ABC`)
  await expect(patientPage.getByRole('heading', { name: /Gracias/ })).toBeVisible()

  // El médico lo ve EN VIVO (Realtime Presence), sin recargar.
  await expect(doctorPage.getByText('● En la página de espera')).toBeVisible({ timeout: 15000 })

  // Y al cerrar la pestaña del paciente, Presence lo da de baja → vuelve a "Sin conexión".
  await patientCtx.close()
  await expect(doctorPage.getByText('○ Sin conexión')).toBeVisible({ timeout: 15000 })

  await doctorCtx.close()
})
