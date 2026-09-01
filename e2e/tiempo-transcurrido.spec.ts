// Las tarjetas del panel imprimían los minutos crudos: un caso de la noche anterior decía
// "hace 1024 min", un número que hay que dividir mentalmente para saber si es de hace un rato o
// de ayer. Ahora la unidad cambia con la magnitud (min → horas → días).
//
// Este spec envejece una consulta en la base, que es la única forma de ver el formato de días
// sin esperar un día. La aserción negativa es la que importa: si alguien vuelve a imprimir
// `minutesSince(...) + ' min'`, esto se pone rojo.
import { test, expect, request } from '@playwright/test'
import { execSync } from 'node:child_process'
import { idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'
const DB_CONTAINER = 'supabase_db_api-medicos-por-venezuela'
// Prefijo 'E2E Paciente': es el que limpia `cleanupTestData` del global-setup.
const PACIENTE = 'E2E Paciente Tiempo'

test('la tarjeta del panel muestra días y horas, no minutos crudos', async ({ browser }) => {
  const ctx = await request.newContext()
  const paciente = await ctx.post(`${API}/patients`, {
    data: {
      full_name: PACIENTE,
      phone_whatsapp: '+584120000077',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await paciente.json()).id
  const consulta = await ctx.post(`${API}/consultations`, {
    // La cola oculta el nombre; el card muestra chief_complaint → se usa como marcador.
    data: {
      patient_id: patientId,
      chief_complaint: PACIENTE,
      specialty_id: await idEspecialidadGeneral()
    }
  })
  const consultationId = (await consulta.json()).id
  await ctx.dispose()

  // 32 horas = 1 día y 8 horas, el caso que cubre las dos unidades a la vez.
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -c ` +
      `"update public.consultations set created_at = now() - interval '32 hours' ` +
      `where id='${consultationId}';"`,
    { stdio: 'pipe' }
  )

  const contexto = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
  const page = await contexto.newPage()
  await page.goto('/panel-medico')

  const card = page.locator('.card-flat').filter({ hasText: PACIENTE }).first()
  await expect(card).toContainText('hace 1 día 8 horas')
  // La regresión que se está evitando: volver a imprimir los minutos crudos.
  await expect(card).not.toContainText('1920 min')
  await contexto.close()
})
