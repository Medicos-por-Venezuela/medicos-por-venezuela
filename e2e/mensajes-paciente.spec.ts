import { test, expect } from '@playwright/test'
import { crearConsultaEnEspera } from './helpers'

test.describe('Mensajería Paciente (U3 / U4)', () => {
  test('paciente anónimo en sala de espera: chatea, tiene regla de asimetría estricta y bloqueo de GIF', async ({
    page
  }) => {
    const { id: cid, token } = await crearConsultaEnEspera('E2E Paciente Sala Espera')

    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)

    // El bloque de mensajes está presente
    const hilo = page.locator('[data-testid="hilo-mensajes"]')
    await expect(hilo).toBeVisible()

    // REGLA DE ASIMETRÍA ESTRICTA: El paciente NUNCA ve el indicador de presencia médica en el DOM
    await expect(page.locator('[data-testid="indicador-presencia-paciente"]')).toHaveCount(0)

    // Intento de subir GIF es bloqueado de inmediato en cliente
    let uploadTriggered = false
    page.on('request', (req) => {
      if (req.url().includes('/attachments')) uploadTriggered = true
    })

    const fileInput = page.locator('[data-testid="file-input-adjunto"]')
    await fileInput.setInputFiles({
      name: 'prueba.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('GIF89a')
    })

    const errorCompositor = page.locator('[data-testid="error-compositor"]')
    await expect(errorCompositor).toBeVisible()
    await expect(errorCompositor).toContainText('Formato GIF no permitido')
    expect(uploadTriggered).toBe(false)

    // El paciente puede enviar un mensaje de texto con su token
    const inputTexto = page.locator('[data-testid="input-mensaje-texto"]')
    await inputTexto.fill('Hola doctor, ya estoy esperando en la sala.')

    const btnEnviar = page.locator('[data-testid="btn-enviar-mensaje"]')
    await btnEnviar.click()

    await expect(page.locator('[data-testid="mensaje-item"]').first()).toContainText(
      'ya estoy esperando en la sala'
    )

    // Sigue sin haber ningún indicador de presencia médica tras interactuar
    await expect(page.locator('[data-testid="indicador-presencia-paciente"]')).toHaveCount(0)
  })

  test('paciente puede adjuntar una imagen PNG válida', async ({ page }) => {
    const { id: cid, token } = await crearConsultaEnEspera('E2E Paciente Adjunto PNG')

    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)

    const fileInput = page.locator('[data-testid="file-input-adjunto"]')
    await fileInput.setInputFiles({
      name: 'analisis_sangre.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) // PNG magic bytes
    })

    // Chip de preview visible
    const chipPreview = page.locator('[data-testid="chip-adjunto-preview"]')
    await expect(chipPreview).toBeVisible()
    await expect(chipPreview).toContainText('analisis_sangre.png')

    // Enviar adjunto
    await page.locator('[data-testid="btn-enviar-mensaje"]').click()

    // Mensaje enviado
    await expect(page.locator('[data-testid="mensaje-item"]').first()).toBeVisible()
  })
})
