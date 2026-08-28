// El admin re-rutea un caso cambiando su Especialidad (consultations.specialty_id, la columna
// con la que la consulta matchea con el médico — el registro del paciente la setea; el admin
// puede corregirla desde Gestionar caso). La tabla muestra la especialidad asignada, con
// fallback a las derivadas del tipo/necesidades para casos viejos sin specialty_id.
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

async function seedConsultation(): Promise<void> {
  const ctx = await request.newContext()
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Especialidad',
      phone_whatsapp: '+584120000011',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  await ctx.post(`${API}/consultations`, {
    data: { patient_id: patientId, specialty_id: await idEspecialidadGeneral() }
  })
  await ctx.dispose()
}

test('admin re-rutea un caso cambiando su especialidad (specialty_id)', async ({ browser }) => {
  await seedConsultation()
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/pacientes')
  await page.getByRole('button', { name: 'E2E Paciente Especialidad' }).first().click()

  const gestionar = page
    .locator('section.card')
    .filter({ has: page.getByRole('heading', { name: 'Gestionar caso' }) })
  const espSelect = gestionar.locator('select').filter({
    has: page.locator('option', { hasText: '— Sin especialidad —' })
  })
  await expect(espSelect).toBeVisible()

  // El catálogo del backend puebla el select; elegimos Psicología por nombre.
  await espSelect.selectOption({ label: 'Psicología' })
  await gestionar.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Caso actualizado.')).toBeVisible()

  // Persistió: la fila muestra la especialidad asignada tras el reload (esperarla evita clickear
  // la fila stale), y al reabrir el caso el select la trae seleccionada.
  const row = page.locator('tr').filter({ hasText: 'E2E Paciente Especialidad' }).first()
  await expect(row.getByText(/La pueden atender:\s*Psicología/)).toBeVisible()
  await row.getByRole('button', { name: 'E2E Paciente Especialidad' }).click()
  await expect(espSelect.locator('option:checked')).toHaveText('Psicología')

  await ctx.close()
})
