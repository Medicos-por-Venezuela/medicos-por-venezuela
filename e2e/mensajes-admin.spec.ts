import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

function accessToken(file: string): string {
  const state = JSON.parse(readFileSync(path.join(__dirname, '..', file), 'utf8'))
  const entry = state.origins[0].localStorage.find((e: { name: string }) =>
    e.name.includes('auth-token')
  )
  return JSON.parse(entry.value).access_token
}

async function seedDoctorMessage(docToken: string, marker: string): Promise<string> {
  const ctx = await request.newContext()
  const auth = { Authorization: `Bearer ${docToken}` }
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: marker,
      phone_whatsapp: '+584120000099',
      emergency_phone: '+584140000099',
      address_encrypted: 'v1:dGVzdCBjaXBoZXJ0ZXh0',
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
  if (!claim.ok()) throw new Error(`claim devolvió ${claim.status()}`)

  // El médico tratante envía un mensaje clínico confidencial
  const msg = await ctx.post(`${API}/consultations/${cid}/messages`, {
    data: { body: 'Diagnóstico clínico confidencial de prueba E2E' },
    headers: auth
  })
  if (!msg.ok()) throw new Error(`send message devolvió ${msg.status()}`)

  await ctx.dispose()
  return cid
}

test.describe('Mensajería Admin (Seguridad y Fail-Closed)', () => {
  test('administrador en consulta: compositor bloqueado y datos clínicos en fail-closed', async ({
    browser
  }) => {
    const docToken = accessToken('e2e/.auth/doc1.json')
    const cid = await seedDoctorMessage(docToken, 'E2E Paciente Privacidad Admin')

    // Entrar con la sesión de administrador
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
    const page = await ctx.newPage()

    await page.goto(`/panel-medico/consulta/${cid}`)

    // El bloque de mensajes carga
    const hilo = page.locator('[data-testid="hilo-mensajes"]')
    await expect(hilo).toBeVisible()

    // REGLA CLÍNICA DE SEGURIDAD: Un administrador no puede enviar mensajes clínicos (readOnly)
    await expect(page.locator('[data-testid="compositor-mensajes"]')).toHaveCount(0)

    // FAIL-CLOSED: El texto clínico real NO se muestra al administrador
    const msgItem = page.locator('[data-testid="mensaje-item"]').first()
    await expect(msgItem).toBeVisible()
    await expect(msgItem).not.toContainText('Diagnóstico clínico confidencial de prueba E2E')
    await expect(msgItem).toContainText('Contenido no disponible (confidencial)')

    await ctx.close()
  })
})
