// Sala de espera del paciente EN VIVO. El bug que motivó esto: el paciente veía "Entrar a la
// videoconsulta" desde el registro y entraba a una sala donde todavía no había ningún médico.
// Ahora el botón aparece solo cuando un médico toma el caso, y aparece SIN recargar la página
// (stream SSE desde la API).
import { test, expect } from '@playwright/test'
import { crearConsultaEnEspera } from './helpers'

const MARCADOR = 'E2E Paciente Sala'

test('en cola no hay botón; cuando un médico toma el caso aparece solo', async ({ browser }) => {
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

  // Un médico toma el caso desde su panel.
  const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const medico = await ctxMedico.newPage()
  await medico.goto('/panel-medico')
  const card = medico.locator('.card-flat').filter({ hasText: MARCADOR })
  await card.getByRole('button', { name: 'Atender paciente' }).click()
  const popupMedico = medico.waitForEvent('popup')
  await medico.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  await (await popupMedico).close()
  await expect(medico).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))

  // Sin recargar: la sala del paciente cambia sola y ofrece entrar.
  const entrar = paciente.getByRole('button', { name: 'Entrar a la videoconsulta' })
  await expect(entrar).toBeVisible({ timeout: 20_000 })
  await expect(paciente.getByText(/tomó tu caso/)).toBeVisible()

  // Entrar abre la MISMA sala que abrió el médico y registra la entrada.
  await entrar.click()
  const popupPaciente = paciente.waitForEvent('popup')
  const entrada = paciente.waitForResponse(
    (r) => r.url().includes('/entered-call') && r.request().method() === 'POST'
  )
  await paciente.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()
  expect((await popupPaciente).url()).toContain('/vamed-')
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
