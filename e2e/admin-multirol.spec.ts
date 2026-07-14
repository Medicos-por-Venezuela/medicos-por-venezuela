// Multi-rol RBAC en el acceso admin: un usuario con rol legacy 'doctor' y super_admin ADICIONAL
// en user_roles (backend) debe poder usar /admin/* — antes el guard solo miraba profiles.role
// (un único rol) y lo rebotaba al login aunque fuera super_admin real.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect, request } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

test('dual doctor+super_admin (RBAC) entra al dashboard admin y no rebota', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/dashboard')

  // El guard resolvió el rol efectivo por RBAC: dashboard visible, sin redirect al login.
  await expect(page.getByRole('heading', { name: 'Dashboard administrativo' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/dashboard/)

  // Y con permisos de super_admin efectivos: la pantalla de usuarios carga (profiles.read)
  // en vez de rebotar al login.
  await page.goto('/admin/usuarios')
  await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/usuarios/)

  await ctx.close()
})

// El mismo access_token del storageState sirve como Bearer contra el backend.
function accessToken(file: string): string {
  const state = JSON.parse(readFileSync(path.join(__dirname, '..', file), 'utf8'))
  const entry = state.origins[0].localStorage.find((e: { name: string }) =>
    e.name.includes('auth-token')
  )
  return JSON.parse(entry.value).access_token
}

test('dual ve el detalle de una consulta AJENA (rol efectivo de /auth/me)', async ({ browser }) => {
  // Consulta tomada por OTRO médico (doc1): el dual no es el asignado, así que solo puede
  // verla si su rol efectivo (super_admin, vía /auth/me multi-rol) lo trata como admin.
  const api = await request.newContext()
  const patient = await api.post(`${API}/patients`, {
    data: {
      full_name: 'E2E Paciente Ajeno',
      phone_whatsapp: '+584120000014',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  const cons = await api.post(`${API}/consultations`, { data: { patient_id: patientId } })
  const cid = (await cons.json()).id
  const claim = await api.post(`${API}/consultations/${cid}/claim`, {
    data: {},
    headers: { Authorization: `Bearer ${accessToken('e2e/.auth/doc1.json')}` }
  })
  if (!claim.ok()) throw new Error(`claim devolvió ${claim.status()}`)
  await api.dispose()

  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const page = await ctx.newPage()
  await page.goto(`/panel-medico/consulta/${cid}`)

  // Antes: la página leía el rol legado ('doctor') de la vista profiles y lo rebotaba
  // al panel. Ahora usa /auth/me (rol efectivo) y el detalle carga.
  await expect(page.getByRole('heading', { name: 'Detalle de consulta' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/panel-medico/consulta/${cid}`))

  await ctx.close()
})
