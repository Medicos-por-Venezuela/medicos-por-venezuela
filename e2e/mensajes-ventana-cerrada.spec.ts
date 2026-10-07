// El 409 de la ventana de mensajería (CA1.8), que nació sin prueba.
//
// La API lo lanza para todo estado fuera de la lista blanca de `services/messaging.py` y para una
// consulta cerrada hace más de `MESSAGING_AFTER_CLOSE_HOURS`. Ninguno de los dos se puede sembrar
// por los endpoints públicos: `urgent_in_person` no lo escribe ningún endpoint y el reloj del
// cierre no se puede mover desde fuera. Así que el 409 se simula con `route.fulfill` sobre el POST
// del mensaje, y lo que se prueba es exactamente lo que es del cliente: que el aviso aparezca con
// el motivo que dio la API, que el compositor quede inutilizable y que NO se reintente a ciegas.
import { test, expect, request } from '@playwright/test'
import { accessToken, idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

// El detalle que devuelve `check_can_write_in_consultation` para un estado no escribible.
const DETALLE_409 = 'Esta consulta ya no admite mensajes.'

async function sembrarConsultaTomada(docToken: string, marcador: string): Promise<string> {
  const ctx = await request.newContext()
  const auth = { Authorization: `Bearer ${docToken}` }
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: marcador,
      phone_whatsapp: '+584120000066',
      emergency_phone: '+584140000066',
      address_encrypted: 'v1:dGVzdCBjaXBoZXJ0ZXh0',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  const cons = await ctx.post(`${API}/consultations`, {
    data: {
      patient_id: patientId,
      chief_complaint: marcador,
      specialty_id: await idEspecialidadGeneral()
    }
  })
  const cid = (await cons.json()).id
  const claim = await ctx.post(`${API}/consultations/${cid}/claim`, { data: {}, headers: auth })
  if (!claim.ok()) throw new Error(`claim devolvió ${claim.status()}`)
  await ctx.dispose()
  return cid
}

test.describe('Mensajería: ventana cerrada (CA1.8)', () => {
  test('un 409 al enviar cierra el compositor, lo explica y no reintenta', async ({ browser }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cid = await sembrarConsultaTomada(token, 'E2E Paciente Ventana Cerrada')
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    let envios = 0
    await page.route(
      // Solo el POST del hilo. `/messages/read` y el GET de la lista tienen que seguir pasando:
      // tras el 409 la UI refresca el hilo, y ese refresco es parte del comportamiento correcto.
      (url) => /^\/api\/v1\/consultations\/[^/]+\/messages$/.test(url.pathname),
      async (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        envios += 1
        await route.fulfill({
          status: 409,
          headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
          body: JSON.stringify({ detail: DETALLE_409 })
        })
      }
    )

    await page.goto(`/panel-medico/consulta/${cid}`)
    await expect(page.locator('[data-testid="hilo-mensajes"]')).toBeVisible()

    const input = page.locator('[data-testid="input-mensaje-texto"]')
    await input.fill('¿Cómo sigues del dolor?')
    await page.locator('[data-testid="btn-enviar-mensaje"]').click()

    // El aviso dice el motivo que dio la API, no un error genérico.
    const aviso = page.locator('[data-testid="aviso-ventana-cerrada"]')
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText(DETALLE_409)

    // Compositor inutilizable: ni texto, ni adjuntos, ni envío.
    await expect(input).toBeDisabled()
    await expect(input).toHaveAttribute('placeholder', 'Mensajería cerrada')
    await expect(page.locator('[data-testid="btn-adjuntar"]')).toBeDisabled()
    await expect(page.locator('[data-testid="btn-enviar-mensaje"]')).toBeDisabled()

    // Y no hay botón de reintentar: volver a intentarlo solo daría otro 409.
    await expect(page.getByRole('button', { name: /reintentar/i })).toHaveCount(0)

    // Un 409 no se reintenta a ciegas: el hilo sondea cada 8 s, así que esta espera cubre varias
    // vueltas del sondeo y seguiría habiendo UN solo envío.
    await page.waitForTimeout(10_000)
    expect(envios, 'un 409 no se reintenta a ciegas').toBe(1)

    await ctx.close()
  })
})
