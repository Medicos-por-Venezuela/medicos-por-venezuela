import { test, expect, request } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

async function createWaitingConsultation(): Promise<void> {
  const ctx = await request.newContext()
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Presencia',
      phone_whatsapp: '+584120000008',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  await ctx.post(`${API}/consultations`, { data: { patient_id: patientId } })
  await ctx.dispose()
}

// Regresión del bug "el médico en la consulta aparece desconectado": la presencia se ancla a la
// SESIÓN (PresenceProvider en _app), no al panel, así que un médico sigue online al navegar del
// panel a la consulta. Lo verificamos desde OTRA sesión (el admin) que lo ve en vivo.
test('el médico sigue online tras pasar del panel a la consulta (Realtime Presence app-level)', async ({
  browser
}) => {
  await createWaitingConsultation()
  const doctorCtx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const adminCtx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const doctorPage = await doctorCtx.newPage()
  const adminPage = await adminCtx.newPage()

  // El médico abre el panel y toma un caso → queda en la CONSULTA (ya no en el panel).
  await doctorPage.goto('/panel-medico')
  await expect(doctorPage.getByText('E2E Paciente Presencia')).toBeVisible()
  await doctorPage
    .getByRole('button', { name: /Puedo atender a este paciente vía WhatsApp/i })
    .first()
    .click()
  await doctorPage.getByRole('button', { name: /^Aceptar$/ }).click()
  await expect(doctorPage).toHaveURL(/\/panel-medico\/consulta\//)

  // El admin lo ve ONLINE aunque el médico esté en la consulta, no en el panel (antes se caía).
  await adminPage.goto('/admin/dashboard')
  const onlineKpi = adminPage.locator('.kpi', { hasText: 'Médicos online' }).locator('.kpi-value')
  await expect(async () => {
    const value = Number((await onlineKpi.textContent())?.trim())
    expect(value).toBeGreaterThanOrEqual(1)
  }).toPass({ timeout: 15000 })

  await doctorCtx.close()
  await adminCtx.close()
})
