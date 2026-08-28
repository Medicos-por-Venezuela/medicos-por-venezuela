import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

async function createWaitingConsultation(): Promise<void> {
  const ctx = await request.newContext()
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Pool',
      phone_whatsapp: '+584120000009',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  // La cola oculta el nombre; el card muestra chief_complaint → lo usamos como marcador.
  await ctx.post(`${API}/consultations`, {
    data: {
      patient_id: patientId,
      chief_complaint: 'E2E Paciente Pool',
      specialty_id: await idEspecialidadGeneral()
    }
  })
  await ctx.dispose()
}

test('pool de médicos: tabs, buscador y ojo de WhatsApp (auditado)', async ({ browser }) => {
  await createWaitingConsultation()
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc2.json' })
  const page = await ctx.newPage()

  // Para llegar al modal del pool, el médico toma un caso (el modal vive en la consulta).
  await page.goto('/panel-medico')
  await expect(page.getByText('E2E Paciente Pool')).toBeVisible()
  await page
    .getByRole('button', { name: /Puedo atender a este paciente vía WhatsApp/i })
    .first()
    .click()
  await page.getByRole('button', { name: /^Aceptar$/ }).click()
  await expect(page).toHaveURL(/\/panel-medico\/consulta\//)

  // Abre el pool.
  await page.getByRole('button', { name: 'Ver Pool de médicos' }).click()
  await expect(page.getByRole('heading', { name: 'Pool de médicos' })).toBeVisible()

  // Tabs restaurados (En línea / Desconectados / Todos) + buscador por nombre.
  await expect(page.getByRole('button', { name: 'En línea' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Desconectados' })).toBeVisible()
  await expect(page.getByPlaceholder('Buscar médico por nombre…')).toBeVisible()

  // En "Todos" hay filas con el WhatsApp oculto tras un 👁. Al revelar uno, ese ojo desaparece
  // (se reemplaza por el número o "—"); la revelación pega al backend, que la registra en audit_log.
  await page.getByRole('button', { name: 'Todos' }).click()
  const eyes = page.getByRole('button', { name: /Ver WhatsApp de/i })
  // Página llena (PAGE_SIZE=20 sobre ~2800 médicos): esperamos a que rendericen TODAS antes de
  // contar (evita capturar un render parcial). Al revelar una, ese ojo se reemplaza por el número.
  await expect(eyes).toHaveCount(20)
  await eyes.first().click()
  await expect(eyes).toHaveCount(19)

  await ctx.close()
})
