import { test, expect, request } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

// Crea un paciente + consulta en espera por el backend (endpoints públicos), y devuelve el id.
async function createWaitingConsultation(): Promise<string> {
  const ctx = await request.newContext()
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Carrera',
      phone_whatsapp: '+584120000001',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  const consultation = await ctx.post(`${API}/consultations`, { data: { patient_id: patientId } })
  const cid = (await consultation.json()).id
  await ctx.dispose()
  return cid
}

test('consulta nueva visible en tiempo real y solo un médico la toma (carrera)', async ({
  browser
}) => {
  const cid = await createWaitingConsultation()

  const ctx1 = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const ctx2 = await browser.newContext({ storageState: 'e2e/.auth/doc2.json' })
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()

  await page1.goto('/panel-medico')
  await page2.goto('/panel-medico')

  // El panel carga por el backend (no se queda en "Cargando") y muestra los KPIs de la cola
  // (partidos en "En videollamada ahora" / "Sin atender (+20 min)").
  await expect(page1.getByText('En videollamada ahora')).toBeVisible()

  // Ambos ven el caso recién creado de inmediato (sin el gate de 20 min).
  await expect(page1.getByText('E2E Paciente Carrera')).toBeVisible()
  await expect(page2.getByText('E2E Paciente Carrera')).toBeVisible()

  // Ambos abren el modal ANTES de que ninguno confirme: así la carrera es determinista (si doc1
  // confirmara primero, Realtime le quitaría la card a doc2 y no podría intentar tomarla).
  // El botón se busca DENTRO de la card de este paciente: la cola puede traer otros casos en
  // espera (de otros specs o datos manuales) y sin scoping el localizador strict fallaría.
  const waBtn = /Puedo atender a este paciente vía WhatsApp/i
  const cardIn = (page: typeof page1) =>
    page.locator('.card-flat').filter({ hasText: 'E2E Paciente Carrera' })
  await cardIn(page1).getByRole('button', { name: waBtn }).click()
  await cardIn(page2).getByRole('button', { name: waBtn }).click()
  await expect(page1.getByRole('button', { name: /^Aceptar$/ })).toBeVisible()
  await expect(page2.getByRole('button', { name: /^Aceptar$/ })).toBeVisible()

  // doc1 confirma → gana el claim atómico → navega a la consulta.
  await page1.getByRole('button', { name: /^Aceptar$/ }).click()
  await expect(page1).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))

  // doc2 confirma el MISMO caso → claim atómico responde 409 → mensaje y sigue en el panel.
  await page2.getByRole('button', { name: /^Aceptar$/ }).click()
  await expect(page2.getByText(/Ya fue asignado a otro doctor/i)).toBeVisible()
  await expect(page2).toHaveURL(/\/panel-medico$/)

  await ctx1.close()
  await ctx2.close()
})
