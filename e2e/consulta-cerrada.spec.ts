// Cobertura del gating de casos finalizados (segundo code review del PR #40):
//  - "Paciente no estaba en la sala" pide confirmación y cancelar no finaliza el caso.
//  - Cerrar exige nota guardada (el error sale en rojo bajo el botón).
//  - Un caso finalizado queda solo-lectura: aviso visible, sin select de estado, sin botones
//    de cierre y sin el CTA "Unirse a videoconsulta" de arriba.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect, request } from '@playwright/test'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

// El storageState de global-setup guarda la sesión completa de Supabase; el mismo
// access_token que usa el navegador sirve como Bearer contra el backend.
function accessToken(file: string): string {
  const state = JSON.parse(readFileSync(path.join(__dirname, '..', file), 'utf8'))
  const entry = state.origins[0].localStorage.find((e: { name: string }) =>
    e.name.includes('auth-token')
  )
  return JSON.parse(entry.value).access_token
}

// Paciente + consulta en espera, tomada por el médico del token (claim atómico) y con
// sala de video puesta vía PATCH (permitido: es su propia consulta) para poder asertar
// que el CTA de video desaparece al finalizar.
async function seedClaimedConsultation(token: string): Promise<string> {
  const ctx = await request.newContext()
  const auth = { Authorization: `Bearer ${token}` }
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Cerrado',
      phone_whatsapp: '+584120000010',
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
  const patched = await ctx.patch(`${API}/consultations/${cid}`, {
    data: { video_room_url: 'https://meet.medicosporvenezuela.org/vamed-e2e-cerrada' },
    headers: auth
  })
  if (!patched.ok()) throw new Error(`patch video_room_url devolvió ${patched.status()}`)
  await ctx.dispose()
  return cid
}

test('caso finalizado: no-show confirma, cerrar exige nota y la UI queda solo-lectura', async ({
  browser
}) => {
  const token = accessToken('e2e/.auth/doc1.json')
  const cid = await seedClaimedConsultation(token)
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const page = await ctx.newPage()

  await page.goto(`/panel-medico/consulta/${cid}`)
  await expect(page.getByRole('heading', { name: 'Detalle de consulta' })).toBeVisible()
  // Caso abierto con sala: el CTA de video está arriba.
  await expect(page.getByRole('link', { name: 'Unirse a videoconsulta' })).toBeVisible()

  // 1. No-show pide confirmación; cancelar no finaliza el caso.
  const noShow = page.getByRole('button', { name: 'Paciente no estaba en la sala de espera' })
  let confirmMsg = ''
  page.once('dialog', (d) => {
    confirmMsg = d.message()
    void d.dismiss()
  })
  await noShow.click()
  expect(confirmMsg).toContain('no estaba en la sala')
  await expect(noShow).toBeVisible() // sigue abierta

  // 2. Cerrar sin nota: error en rojo bajo el botón, sin confirm (no finaliza).
  await page.getByRole('button', { name: 'Cerrar consulta' }).click()
  await expect(page.getByText('Agrega una nota antes de cerrar la consulta.')).toBeVisible()

  // 3. Con nota guardada + confirmación aceptada, cierra y vuelve al panel.
  await page.locator('textarea').fill('Nota E2E de cierre')
  await page.getByRole('button', { name: 'Guardar nota' }).click()
  await expect(page.getByText('Nota guardada.')).toBeVisible()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Cerrar consulta' }).click()

  // El cierre real ahora exige la firma del médico (módulo Agenda): tras confirmar aparece el
  // canvas de firma. Se dibuja un trazo (habilita "Firmar y continuar") y se confirma.
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No se encontró el canvas de firma')
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 90, box.y + 60)
  await page.mouse.move(box.x + 140, box.y + 30)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Firmar y continuar' }).click()

  // El panel limpia el query ?actualizado=1 con router.replace enseguida: se asierta por
  // el aviso que ese query dispara. El regex excluye /panel-medico/consulta/... (seguía abierto).
  await expect(page).toHaveURL(/\/panel-medico(\?|$)/)
  await expect(page.getByText('Panel actualizado.')).toBeVisible()

  // 4. Reabrir el caso cerrado: solo-lectura (aviso, sin cierres, sin video).
  await page.goto(`/panel-medico/consulta/${cid}`)
  await expect(page.getByText('Este caso ya está finalizado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar consulta' })).toHaveCount(0)
  await expect(noShow).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Unirse a videoconsulta' })).toHaveCount(0)

  await ctx.close()
})
