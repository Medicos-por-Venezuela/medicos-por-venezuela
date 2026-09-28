// El admin opera el caso sin ver el dato clínico (docs/cifrado-datos-clinicos.md del backend): en
// el listado /admin/pacientes y en el detalle, el motivo llega en null con `clinical_access:
// "none"` y se pinta el marcador, no un hueco ni el texto del paciente. EXCEPCIÓN (2026-09-27): en
// la cola del panel el admin SÍ ve el motivo, porque la gestiona y lo necesita para triar.
// La nota del médico (`internal_note`) ya no tiene editor en /admin/pacientes
// (el backend respondería 403), pero la nota admin sigue editable.
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'
const PACIENTE = 'E2E Paciente Dato Clinico'
const MOTIVO = 'E2E motivo clinico que el admin no debe ver'

async function seedConsultation(): Promise<string> {
  const ctx = await request.newContext()
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: PACIENTE,
      phone_whatsapp: '+584120000012',
      emergency_phone: '+584140000012',
      address_encrypted: 'v1:dGVzdCBjaXBoZXJ0ZXh0',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  const consultation = await ctx.post(`${API}/consultations`, {
    data: {
      patient_id: patientId,
      chief_complaint: MOTIVO,
      specialty_id: await idEspecialidadGeneral()
    }
  })
  const consultationId = (await consultation.json()).id
  await ctx.dispose()
  return consultationId
}

test('admin ve el motivo como confidencial y no puede editar la nota del médico', async ({
  browser
}) => {
  await seedConsultation()
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/pacientes')
  const row = page.locator('tr').filter({ hasText: PACIENTE }).first()
  await expect(row).toBeVisible()

  // Motivo: marcador en vez del texto del paciente.
  await expect(
    row.getByText(/Confidencial: solo lo ve el médico que atiende el caso/)
  ).toBeVisible()
  await expect(row.getByText(MOTIVO)).toHaveCount(0)

  // Sin editor de la nota del médico; la nota admin sigue ahí.
  await expect(row.getByPlaceholder('Nota médico')).toHaveCount(0)
  await expect(row.getByPlaceholder('Nota admin')).toBeVisible()

  // Gestionar caso tampoco ofrece "Nota interna", y guardar no manda campos clínicos (sin 403).
  await row.getByRole('button', { name: PACIENTE }).click()
  const gestionar = page.getByRole('dialog', { name: 'Gestionar caso' })
  await expect(gestionar).toBeVisible()
  await expect(gestionar.getByText('Nota interna')).toHaveCount(0)
  await gestionar.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Caso actualizado.')).toBeVisible()

  await ctx.close()
})

test('admin en el detalle del caso no ve ni puede guardar la nota del médico', async ({
  browser
}) => {
  const consultationId = await seedConsultation()
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()

  await page.goto(`/panel-medico/consulta/${consultationId}`)
  // Esperar a que cargue el caso antes de afirmar ausencias (si no, pasan con la página vacía).
  await expect(page.getByText(PACIENTE).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar nota' })).toHaveCount(0)
  await expect(page.getByText('Notas del médico')).toHaveCount(0)
  await expect(page.getByText(MOTIVO)).toHaveCount(0)
  // El motivo se pinta como confidencial, no como "Sin descripción" (parecería un caso vacío).
  await expect(
    page.getByText('Confidencial: solo lo ve el médico que atiende el caso').first()
  ).toBeVisible()
  await expect(page.getByText('Sin descripción')).toHaveCount(0)

  await ctx.close()
})

test('en la cola del panel, el admin también ve el motivo del caso', async ({ browser }) => {
  // El admin ve todas las colas para gestionarlas: desde 2026-09-27 recibe el motivo (SUMMARY) en
  // el panel. En el listado /admin/pacientes y en el detalle sigue oculto (los otros tests).
  await seedConsultation()
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()

  await page.goto('/panel-medico')
  await expect(page.getByText(MOTIVO).first()).toBeVisible()
  await expect(
    page.getByText(/Motivo confidencial: solo lo ve el médico que atiende al paciente/)
  ).toHaveCount(0)

  await ctx.close()
})

test('derivar sigue atado a ver el motivo: el admin y el médico de la cola lo ven y pueden derivar', async ({
  browser
}) => {
  // "Derivar" se muestra a quien puede leer el motivo (decisión 2026-09-23). Desde 2026-09-27 el
  // admin también recibe el motivo en la cola (la gestiona), así que su tarjeta ofrece derivar
  // igual que la del médico de la cola; el gating del componente sigue siendo `clinical_access`.
  const consultationId = await seedConsultation()

  const ctxAdmin = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const admin = await ctxAdmin.newPage()
  await admin.goto('/panel-medico')
  const cardAdmin = admin.locator(`.card-flat[data-consultation-id="${consultationId}"]`)
  await expect(cardAdmin).toBeVisible()
  await expect(cardAdmin.getByRole('button', { name: 'Derivar a especialista' })).toBeVisible()
  // La otra acción de la tarjeta sigue ahí.
  await expect(cardAdmin.getByRole('button', { name: 'Atender paciente' })).toBeVisible()
  await ctxAdmin.close()

  const ctxDoc = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const doc = await ctxDoc.newPage()
  await doc.goto('/panel-medico')
  const cardDoc = doc.locator(`.card-flat[data-consultation-id="${consultationId}"]`)
  await expect(cardDoc).toBeVisible()
  await expect(cardDoc.getByRole('button', { name: 'Derivar a especialista' })).toBeVisible()
  await ctxDoc.close()
})
