// Buzón del médico (`/panel-medico/mensajes`) y contador de la cabecera.
//
// La pantalla nació sin spec, y es justo donde cayó la mitad del segundo lote del módulo: el SSE
// del buzón, el filtro partido en dos efectos, `last_message_at` nulo y el badge de la cabecera.
//
// Dos estilos de prueba, a propósito:
//
//  - Datos REALES sembrados por la API, como el resto de los specs de mensajería, para la lista y
//    el filtro: es lo que de verdad responde el backend.
//  - `page.route` para lo que el backend local no puede producir: un hilo sin `last_message_at`
//    (`GET /inbox` se arma con un JOIN sobre `messages`, así que la API nunca lo devuelve nulo),
//    un total de no leídos fijo para el badge (doc1 acumula hilos a lo largo de la corrida, que es
//    serial y comparte base) y el stream SSE del buzón.
import { test, expect, request, type Page, type Route } from '@playwright/test'
import { accessToken, crearConsultaEnEspera, idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

// El contexto de test corre con `--disable-web-security` (ver playwright.config.ts), pero el
// header va explícito para que una respuesta simulada no dependa de ese flag.
const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
}

/**
 * Paciente + consulta tomada por el médico + un mensaje, que es lo que hace aparecer el hilo en el
 * buzón: `GET /inbox` lo arma con un JOIN sobre `messages`, así que una consulta sin mensajes no
 * sale en la lista.
 *
 * `quienEscribe` decide si el hilo queda con no leídos para el médico: solo cuentan los mensajes
 * `patient_to_doctor` sin `read_at`, así que uno escrito por el propio médico NO pasa el filtro
 * «Solo no leídos».
 */
async function sembrarHilo(
  docToken: string,
  marcador: string,
  quienEscribe: 'paciente' | 'medico'
): Promise<string> {
  const ctx = await request.newContext()
  const auth = { Authorization: `Bearer ${docToken}` }
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: marcador,
      phone_whatsapp: '+584120000077',
      emergency_phone: '+584140000077',
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
  const consulta = await cons.json()
  const cid: string = consulta.id
  const claim = await ctx.post(`${API}/consultations/${cid}/claim`, { data: {}, headers: auth })
  if (!claim.ok()) throw new Error(`claim devolvió ${claim.status()}`)

  const msg = await ctx.post(`${API}/consultations/${cid}/messages`, {
    data: { body: `Mensaje sembrado por el ${quienEscribe} (${marcador})` },
    // El paciente escribe con el token de su consulta; el médico, con su sesión.
    headers: quienEscribe === 'paciente' ? { 'X-Consultation-Token': consulta.access_token } : auth
  })
  if (!msg.ok()) throw new Error(`enviar mensaje devolvió ${msg.status()}`)

  await ctx.dispose()
  return cid
}

/** Un hilo con la forma exacta que devuelve `GET /inbox` (`list[InboxThreadResponse]`). */
function hiloFalso(sobre: Record<string, unknown>): Record<string, unknown> {
  return {
    consultation_id: '11111111-1111-4111-8111-111111111111',
    code: 'VZ-TEST',
    specialty: 'Medicina general',
    patient_name: 'Paciente de prueba',
    status: 'in_progress',
    last_message_at: new Date().toISOString(),
    last_direction: 'patient_to_doctor',
    unread_count: 0,
    patient_online: false,
    patient_last_seen_at: null,
    active_call: null,
    ...sobre
  }
}

/**
 * Responde `GET /inbox` con lo que devuelva `hilos()`.
 *
 * Sin `onStream`, el stream del buzón se queda sin pasar (503), que es como se porta un proxy que
 * no admite SSE: `useInboxSignal` cae a su tic de respaldo. La cabecera pide la lista por su
 * cuenta con `?only_unread=true`, así que `hilos()` recibe ese dato y no depende del orden de las
 * peticiones.
 */
async function responderBuzon(
  page: Page,
  hilos: (soloNoLeidos: boolean) => Record<string, unknown>[],
  onStream?: (route: Route) => Promise<void>
): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/v1/inbox' || url.pathname === '/api/v1/inbox/stream',
    async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/stream')) {
        if (onStream) return onStream(route)
        return route.fulfill({
          status: 503,
          headers: JSON_HEADERS,
          body: '{"detail":"stream no disponible"}'
        })
      }
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify(hilos(url.searchParams.get('only_unread') === 'true'))
      })
    }
  )
}

const hilo = (page: Page, cid: string) =>
  page.locator(`[data-testid="thread-item"][data-consultation-id="${cid}"]`)

test.describe('Buzón del médico (CA2.x)', () => {
  test('el buzón lista los hilos del médico, con no leídos y última actividad', async ({
    browser
  }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cidPaciente = await sembrarHilo(token, 'E2E Buzon Escribe Paciente', 'paciente')
    const cidMedico = await sembrarHilo(token, 'E2E Buzon Escribe Medico', 'medico')

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()
    await page.goto('/panel-medico/mensajes')

    const conPaciente = hilo(page, cidPaciente)
    const conMedico = hilo(page, cidMedico)

    await expect(conPaciente).toBeVisible()
    await expect(conMedico).toBeVisible()

    // El nombre del paciente y el enlace al hilo completo de SU consulta.
    await expect(conPaciente).toContainText('E2E Buzon Escribe Paciente')
    await expect(conPaciente.getByRole('link', { name: 'Abrir chat' })).toHaveAttribute(
      'href',
      `/panel-medico/consulta/${cidPaciente}`
    )

    // Solo cuenta como no leído lo que escribió el paciente: el mensaje del propio médico no.
    await expect(conPaciente).toContainText('nuevo')
    await expect(conMedico).not.toContainText('nuevo')

    // Hay actividad real, así que se dice cuándo.
    await expect(conPaciente).toContainText('Última actividad: hace')
    await expect(conPaciente).not.toContainText('Sin actividad registrada')

    await ctx.close()
  })

  test('el filtro «Solo no leídos» filtra y no vuelve a pedir el perfil', async ({ browser }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cidNoLeido = await sembrarHilo(token, 'E2E Buzon Filtro No Leido', 'paciente')
    const cidLeido = await sembrarHilo(token, 'E2E Buzon Filtro Leido', 'medico')

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    // Las recargas en cascada se veían justo aquí: el guard de sesión vivía en el MISMO efecto que
    // el buzón, con el token entre sus dependencias, así que tocar el filtro reejecutaba todo
    // —incluido `GET /auth/me`—. Contar esa petición es la forma de que no vuelva.
    let perfiles = 0
    page.on('request', (req) => {
      // `/auth/me/permissions` también contiene «/auth/me»: la comparación es del path exacto.
      if (req.method() === 'GET' && new URL(req.url()).pathname === '/api/v1/auth/me') {
        perfiles += 1
      }
    })

    await page.goto('/panel-medico/mensajes')

    const noLeido = hilo(page, cidNoLeido)
    const leido = hilo(page, cidLeido)
    await expect(noLeido).toBeVisible()
    await expect(leido).toBeVisible()

    // `fetchMyProfile` coalesce las peticiones iguales durante 5 s (lib/consultations.ts): dentro
    // de esa ventana una recarga en cascada no saldría a la red y este test pasaría sin probar
    // nada. Se espera a que la ventana cierre antes de tocar el filtro.
    await page.waitForTimeout(5_500)
    const antes = perfiles
    expect(antes, 'el contador de /auth/me debe estar viendo las peticiones').toBeGreaterThan(0)

    await page.locator('[data-testid="filtro-no-leidos"]').click()

    await expect(noLeido).toBeVisible()
    await expect(leido).toHaveCount(0)

    // Y al volver a «Todos» reaparece.
    await page.locator('[data-testid="filtro-todos"]').click()
    await expect(leido).toBeVisible()

    await page.waitForTimeout(1_000)
    expect(perfiles, 'cambiar de filtro no debe volver a pedir GET /auth/me').toBe(antes)

    await ctx.close()
  })

  test('un hilo sin última actividad dice «Sin actividad registrada», no «hace 0 min»', async ({
    browser
  }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    const cid = '22222222-2222-4222-8222-222222222222'
    await responderBuzon(page, () => [
      hiloFalso({
        consultation_id: cid,
        code: 'VZ-SINACT',
        patient_name: 'E2E Buzon Sin Actividad',
        last_message_at: null
      })
    ])

    await page.goto('/panel-medico/mensajes')

    const sinActividad = hilo(page, cid)
    await expect(sinActividad).toBeVisible()
    await expect(sinActividad).toContainText('Sin actividad registrada')
    // `tiempoTranscurrido(null)` devuelve «0 min»: decirle al médico «hace 0 min» en un hilo sin
    // mensajes es inventarse una hora que no existe.
    await expect(sinActividad).not.toContainText('hace 0 min')

    await ctx.close()
  })

  test('el badge de la cabecera suma los no leídos y lo anuncia con su nombre accesible', async ({
    browser
  }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    // La cabecera pide solo los hilos con no leídos y suma sus contadores: 2 + 1 = 3.
    await responderBuzon(page, () => [
      hiloFalso({
        consultation_id: '55555555-5555-4555-8555-555555555555',
        code: 'VZ-BADGE1',
        unread_count: 2
      }),
      hiloFalso({
        consultation_id: '66666666-6666-4666-8666-666666666666',
        code: 'VZ-BADGE2',
        unread_count: 1
      })
    ])

    await page.goto('/panel-medico/mensajes')

    const badge = page.locator('[data-testid="header-unread-badge"]')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('3')

    // El número solo no dice qué cuenta: lo explica el nombre accesible del enlace. Y el badge va
    // `aria-hidden`, así que el 3 no se anuncia dos veces — por eso la comparación es EXACTA.
    const enlace = page.locator('[data-testid="header-buzon-link"]')
    await expect(enlace).toHaveAccessibleName('Mensajes, 3 sin leer')
    await expect(badge).toHaveAttribute('aria-hidden', 'true')

    await ctx.close()
  })

  test('un evento `inbox` del stream refresca el buzón por REST', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    const cidViejo = '33333333-3333-4333-8333-333333333333'
    const cidNuevo = '44444444-4444-4444-8444-444444444444'
    let hayHiloNuevo = false
    let aperturasDelStream = 0

    await responderBuzon(
      page,
      () =>
        hayHiloNuevo
          ? [
              hiloFalso({ consultation_id: cidViejo, code: 'VZ-SSE1' }),
              hiloFalso({ consultation_id: cidNuevo, code: 'VZ-SSE2', unread_count: 1 })
            ]
          : [hiloFalso({ consultation_id: cidViejo, code: 'VZ-SSE1' })],
      async (route) => {
        aperturasDelStream += 1
        // Un bloque SSE completo. La señal NO trae cuerpos clínicos (CA8.3): solo el total de no
        // leídos y los ids que cambiaron; la lista la vuelve a pedir el cliente por REST.
        const senal = JSON.stringify({ unread_total: 1, updated: [cidNuevo] })
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            'access-control-allow-origin': '*'
          },
          body: `retry: 1500\n\nevent: inbox\ndata: ${senal}\n\n`
        })
      }
    )

    await page.goto('/panel-medico/mensajes')

    const viejo = hilo(page, cidViejo)
    const nuevo = hilo(page, cidNuevo)
    await expect(viejo).toBeVisible()
    await expect(nuevo).toHaveCount(0)

    // Desde aquí la API ya tiene el hilo nuevo, pero la página no lo sabe: nadie navega ni recarga.
    hayHiloNuevo = true

    // El stream responde siempre, así que `useInboxSignal` no emite ni un tic de respaldo (solo los
    // emite al fallar): lo ÚNICO que puede traer el hilo nuevo aquí es el evento `inbox`.
    await expect(nuevo).toBeVisible({ timeout: 25_000 })
    expect(aperturasDelStream, 'el buzón debe abrir el stream del inbox').toBeGreaterThan(0)

    await ctx.close()
  })

  test('en modo respaldo, con el stream bloqueado, el buzón sigue refrescando por REST', async ({
    browser
  }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    const cidViejo = '77777777-7777-4777-8777-777777777777'
    const cidNuevo = '88888888-8888-4888-8888-888888888888'
    let hayHiloNuevo = false

    // Sin `onStream` el stream devuelve 503: el proxy que no deja pasar SSE, que es el caso que el
    // modo respaldo existe para cubrir.
    await responderBuzon(page, () =>
      hayHiloNuevo
        ? [
            hiloFalso({ consultation_id: cidViejo, code: 'VZ-RESP1' }),
            hiloFalso({ consultation_id: cidNuevo, code: 'VZ-RESP2', unread_count: 1 })
          ]
        : [hiloFalso({ consultation_id: cidViejo, code: 'VZ-RESP1' })]
    )

    await page.goto('/panel-medico/mensajes')

    const viejo = hilo(page, cidViejo)
    const nuevo = hilo(page, cidNuevo)
    await expect(viejo).toBeVisible()
    await expect(nuevo).toHaveCount(0)

    hayHiloNuevo = true

    // Un médico sin avisos es peor que uno con retraso: sin stream, `useInboxSignal` emite un tic
    // sin payload cada 12 s y cada suscriptor refresca por REST. Nadie navega ni recarga.
    await expect(nuevo).toBeVisible({ timeout: 30_000 })

    await ctx.close()
  })

  test('el stream del buzón no se abre en las rutas del paciente', async ({ browser }) => {
    // `GET /inbox` y su stream exigen permiso `messages.read`: son del médico. Si una pantalla de
    // paciente los abriera sería una regla de permisos rota (y un 403 reintentado en bucle), así
    // que este test falla si alguien los pide desde `/sala-espera` o `/mi-caso`.
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    const pedidos: string[] = []
    await page.route(
      (url) => url.pathname === '/api/v1/inbox' || url.pathname === '/api/v1/inbox/stream',
      async (route) => {
        pedidos.push(route.request().url())
        await route.abort()
      }
    )

    // Paciente sin cuenta: la sala de espera con el token de su consulta.
    const { id: cid, token } = await crearConsultaEnEspera('E2E Buzon Sala Sin Stream')
    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)
    await expect(page.locator('[data-testid="hilo-mensajes"]')).toBeVisible()

    // Paciente con cuenta: `/mi-caso` con la cuenta de prueba del paciente.
    await page.goto('/login')
    await page.getByLabel('Email').fill('e2e-patient@example.com')
    await page.getByLabel('Contraseña').fill('e2e-Test-123456')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/mi-caso/)
    await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()

    // Margen para que a cualquier efecto montado le hubiera dado tiempo de abrirlo.
    await page.waitForTimeout(2_000)
    expect(pedidos, 'ninguna pantalla de paciente debe tocar el buzón del médico').toEqual([])

    await ctx.close()
  })
})
