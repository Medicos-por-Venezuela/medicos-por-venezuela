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

async function seedClaimedConsultation(token: string, marker: string): Promise<string> {
  const ctx = await request.newContext()
  const auth = { Authorization: `Bearer ${token}` }
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: marker,
      phone_whatsapp: '+584120000088',
      emergency_phone: '+584140000088',
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
  await ctx.dispose()
  return cid
}

test.describe('Mensajería Médico (U1)', () => {
  test('el médico ve el hilo, presencia del paciente y envía mensaje de texto', async ({
    browser
  }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cid = await seedClaimedConsultation(token, 'E2E Paciente Chat Medico')
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    await page.goto(`/panel-medico/consulta/${cid}`)

    // El bloque de mensajería está presente
    const hilo = page.locator('[data-testid="hilo-mensajes"]')
    await expect(hilo).toBeVisible()

    // El médico ve el indicador de presencia del paciente
    const presencia = page.locator('[data-testid="indicador-presencia-paciente"]')
    await expect(presencia).toBeVisible()

    // El médico escribe y envía un mensaje
    const inputTexto = page.locator('[data-testid="input-mensaje-texto"]')
    await inputTexto.fill('Hola, soy tu médico tratante. ¿Cómo te sientes?')

    const btnEnviar = page.locator('[data-testid="btn-enviar-mensaje"]')
    await btnEnviar.click()

    // El mensaje aparece en la lista de mensajes
    await expect(page.locator('[data-testid="mensaje-item"]').first()).toContainText(
      'Hola, soy tu médico tratante'
    )

    await ctx.close()
  })

  test('el médico puede adjuntar un documento PDF válido', async ({ browser }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cid = await seedClaimedConsultation(token, 'E2E Paciente Adjunto PDF')
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    await page.goto(`/panel-medico/consulta/${cid}`)

    const fileInput = page.locator('[data-testid="file-input-adjunto"]')
    await fileInput.setInputFiles({
      name: 'receta_medica.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test pdf content')
    })

    // Chip de preview visible
    const chipPreview = page.locator('[data-testid="chip-adjunto-preview"]')
    await expect(chipPreview).toBeVisible()
    await expect(chipPreview).toContainText('receta_medica.pdf')

    // Enviar adjunto
    await page.locator('[data-testid="btn-enviar-mensaje"]').click()

    // Adjunto PDF visible en la burbuja del mensaje
    await expect(page.locator('[data-testid="adjunto-pdf"]')).toBeVisible()

    await ctx.close()
  })

  test('intento de adjuntar GIF es bloqueado en cliente con alerta inmediata sin enviar petición', async ({
    browser
  }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cid = await seedClaimedConsultation(token, 'E2E Paciente Bloqueo GIF')
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    await page.goto(`/panel-medico/consulta/${cid}`)

    // Escuchar si hay alguna petición de subida a /attachments
    let uploadTriggered = false
    page.on('request', (req) => {
      if (req.url().includes('/attachments')) uploadTriggered = true
    })

    const fileInput = page.locator('[data-testid="file-input-adjunto"]')
    await fileInput.setInputFiles({
      name: 'animacion.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('GIF89a')
    })

    // La UI muestra alerta descriptiva inmediata
    const errorCompositor = page.locator('[data-testid="error-compositor"]')
    await expect(errorCompositor).toBeVisible()
    await expect(errorCompositor).toContainText('Formato GIF no permitido')

    // El chip de previsualización NO debe mostrarse
    await expect(page.locator('[data-testid="chip-adjunto-preview"]')).toHaveCount(0)

    // No se disparó ninguna petición de red
    expect(uploadTriggered).toBe(false)

    await ctx.close()
  })
})
