// Videollamada iniciada desde el hilo de mensajería (R16): el botón de cámara del médico y el
// aviso de sistema que le queda al paciente en el hilo.
//
// Cuatro cosas que no pueden romperse nunca:
//
//  1. ASIMETRÍA (CA16.1). El botón de llamar es del médico y **no existe en el DOM** de las
//     pantallas del paciente (`/sala-espera` por token y `/mi-caso` con cuenta). No basta con
//     ocultarlo: el componente no lo pinta, igual que el indicador de presencia.
//  2. LA PRESENCIA BLOQUEA, SALVO EN UNA CITA AGENDADA (CA16.2, tercera redacción del
//     2026-10-06). Llamar a quien no está delante abre una sala vacía, así que el botón exige
//     presencia — excepto con la consulta en `scheduled`, donde el paciente todavía no puede
//     estar conectado porque es el inicio de la cita lo que dispara el correo que le avisa. Esa
//     excepción es la que protege a las citas agendadas, y tiene su propio escenario. También
//     deshabilitan el caso finalizado y el 409 (CA16.2c). Y es el ÚNICO botón de videoconsulta
//     del detalle (CA16.2b): el antiguo «Unirse a videoconsulta» de la cabecera ya no existe. Su
//     modal no le promete al médico un correo que `start_video_call` no manda, ni inicia nada por
//     su cuenta; confirmarlo sí llama, una sola vez, y abre la sala: eso es la ruta feliz, con
//     `window.open` espiado.
//  3. EL AVISO ES ACCIONABLE. El mensaje de sistema sale centrado y neutral (sin burbuja de
//     emisor ni marcas de entrega) y lleva un BOTÓN de entrada: si se queda en texto, el paciente
//     no puede entrar y la funcionalidad no sirve de nada.
//  4. LA INTERFAZ NO IMPRIME EL CUERPO DE UN AVISO DE LLAMADA (CA16.6). Antes traía el enlace de
//     entrada con un token de consulta de 24 h de vida, y los avisos creados antes del arreglo del
//     backend SIGUEN guardados así: limpiar la base no arregla la clase de problema. La defensa es
//     que la interfaz enuncie ella misma el aviso —su contenido lo genera el servidor y es
//     predecible— y construya el destino con el contexto del hilo (`consultationId` + la
//     credencial del lector). El test del aviso viejo prueba la defensa, no la ausencia del
//     ataque; el del aviso genérico comprueba que los demás `system` siguen mostrando su cuerpo.
//
// Los dos últimos van con `page.route` sobre `GET /messages`: el cuerpo real viaja cifrado y el
// aviso solo lo crea el médico tratante al llamar, así que simular el hilo es la forma de fijar
// exactamente lo que se pinta. El botón de la cabecera y su estado sí van contra datos reales
// sembrados por la API.
import { test, expect, request, type Page } from '@playwright/test'
import { accessToken, crearConsultaEnEspera, idEspecialidadGeneral } from './helpers'

const API = 'http://localhost:8000/api/v1'

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
}

const BOTON = '[data-testid="btn-iniciar-videollamada"]'

// El cuerpo EXACTO que emite `start_video_call` (CA16.6): solo el aviso, sin URL ni token. Es
// también el texto que la interfaz enuncia por su cuenta, para que historial y pantalla no se
// contradigan.
const CUERPO_AVISO = 'El médico inició la videoconsulta.'

// Un aviso de los VIEJOS, con la forma literal de los que quedaron guardados (y cifrados) antes de
// que el backend quitara el enlace: lleva la URL de producción y un token de consulta. El token es
// de pega pero con la pinta del real (`eyJ…`), que es lo que se busca no ver en pantalla.
const CUERPO_VIEJO_CON_TOKEN =
  'Tu médico inició la videoconsulta. Entra aquí para unirte: ' +
  'https://medicosporvenezuela.org/entrar-videoconsulta' +
  '?c=f4ca34f5-5d35-4c3c-8374-f33b199cd9d9' +
  '&t=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUiLCJ0eXAiOiJjb25zdWx0YXRpb25fYWNjZXNzIn0' +
  '.firma-de-pega-para-el-test'

/**
 * Sustituye `window.open` por un espía antes de que corra ningún script de la página.
 *
 * Dos motivos: una ventana real a Jitsi en medio de la suite es ruido (y pide cámara), y es la
 * única forma de comprobar la costura completa de CA16.8 — que la ventana se abre con
 * `about:blank` DENTRO del clic y que después se la navega a la sala ya pasada por
 * `browserRoomUrl`. El doble se porta como la ventana real en lo que el código usa: `closed`,
 * `opener`, `location.replace` y `close`.
 */
async function espiarWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const abiertas: { url: string; navegadaA: string | null; cerrada: boolean }[] = []
    ;(window as unknown as { __ventanas: typeof abiertas }).__ventanas = abiertas
    window.open = ((url?: string | URL) => {
      const registro = { url: String(url ?? ''), navegadaA: null as string | null, cerrada: false }
      abiertas.push(registro)
      return {
        closed: false,
        opener: null,
        close: () => {
          registro.cerrada = true
        },
        location: {
          replace: (u: string) => {
            registro.navegadaA = u
          },
          set href(u: string) {
            registro.navegadaA = u
          }
        }
      } as unknown as Window
    }) as typeof window.open
  })
}

/** Lo que el espía de `window.open` lleva registrado en la página. */
function ventanasAbiertas(
  page: Page
): Promise<{ url: string; navegadaA: string | null; cerrada: boolean }[]> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __ventanas: { url: string; navegadaA: string | null; cerrada: boolean }[]
        }
      ).__ventanas
  )
}

/** Paciente + consulta TOMADA por el médico: es el único caso en que el hilo del médico existe. */
async function sembrarConsultaTomada(docToken: string, marcador: string): Promise<string> {
  const ctx = await request.newContext()
  const auth = { Authorization: `Bearer ${docToken}` }
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: marcador,
      phone_whatsapp: '+584120000078',
      emergency_phone: '+584140000078',
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
  const cid: string = (await cons.json()).id
  const claim = await ctx.post(`${API}/consultations/${cid}/claim`, { data: {}, headers: auth })
  if (!claim.ok()) throw new Error(`claim devolvió ${claim.status()}`)
  await ctx.dispose()
  return cid
}

/**
 * Responde `GET /consultations/{id}/messages` con UN mensaje de sistema cuyo cuerpo lleva `cuerpo`.
 * El resto de verbos sobre el hilo (el POST de envío, el de lectura) se dejan pasar.
 */
async function responderHiloConAviso(
  page: Page,
  cid: string,
  cuerpo: string,
  kind: 'call' | 'system_notice' = 'call'
): Promise<void> {
  await page.route(
    (url) => url.pathname === `/api/v1/consultations/${cid}/messages`,
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          consultation_id: cid,
          unread_count: 0,
          clinical_access: 'full',
          items: [
            {
              id: '99999999-9999-4999-8999-999999999999',
              consultation_id: cid,
              sender_role: 'system',
              sender_user_id: null,
              direction: 'system',
              channel: 'web',
              kind,
              body: cuerpo,
              client_msg_id: null,
              sent_at: new Date().toISOString(),
              delivered_at: null,
              read_at: null,
              delivery_status: 'sent',
              attachments: []
            }
          ]
        })
      })
    }
  )
}

/**
 * Fija la fase de la sala de espera del paciente. Es lo que `/sala-espera` traduce a
 * `isCaseClosed` del hilo (`phase === 'finished'`).
 *
 * Se simula porque llevar una consulta a `finished` de verdad pide claim, nota, firma y cierre del
 * médico: cuatro pasos de otro módulo para comprobar un `disabled`. El stream se deja caer (503),
 * como un proxy que no admite SSE, y la sala tira del GET.
 */
async function responderSalaDeEspera(page: Page, cid: string, fase: string): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith(`/api/v1/consultations/${cid}/waiting-room`),
    async (route) => {
      if (route.request().url().includes('/stream')) {
        return route.fulfill({
          status: 503,
          headers: JSON_HEADERS,
          body: '{"detail":"stream no disponible"}'
        })
      }
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          consultation_id: cid,
          code: 'VZ-FIN',
          status: 'closed',
          phase: fase,
          specialty: 'Medicina general',
          derived_from_specialty: null,
          doctor_name: 'Doctora E2E',
          video_room_url: 'https://meet.medicosporvenezuela.org/vamed-e2e-cerrado',
          scheduled_at: null,
          patient_first_name: 'Test',
          access_token: null
        })
      })
    }
  )
}

test.describe('Videollamada desde el hilo (CA16.x)', () => {
  test('el botón de videollamada NO existe en las pantallas del paciente', async ({ page }) => {
    // Paciente SIN cuenta: sala de espera con el token de su consulta.
    const { id: cid, token } = await crearConsultaEnEspera('E2E Videollamada Sala Paciente')
    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)
    await expect(page.locator('[data-testid="hilo-mensajes"]')).toBeVisible()

    // El hilo está montado y, aun así, el botón no está en el DOM (no es CSS: no se pinta).
    await expect(page.locator(BOTON)).toHaveCount(0)
    // Y sigue sin estar el indicador de presencia, que comparte el criterio de asimetría.
    await expect(page.locator('[data-testid="indicador-presencia-paciente"]')).toHaveCount(0)

    // Paciente CON cuenta: `/mi-caso` con la cuenta de prueba del paciente.
    await page.goto('/login')
    await page.getByLabel('Email').fill('e2e-patient@example.com')
    await page.getByLabel('Contraseña').fill('e2e-Test-123456')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/mi-caso/)
    await expect(page.getByRole('heading', { name: 'Mi caso' })).toBeVisible()

    // El hilo de la consulta vigente viene abierto; si estuviera plegado, se abre.
    const abrirHilo = page.getByRole('button', { name: 'Ver mensajes con mi médico' }).first()
    if (await abrirHilo.count()) await abrirHilo.click()

    // ANCLA, igual que en la mitad de arriba: sin exigir que el hilo esté montado, el
    // `toHaveCount(0)` pasaría en vacío el día que `/mi-caso` dejara de montarlo, y este test
    // seguiría verde sin probar nada. El `if` de arriba es condicional y no lo garantiza.
    await expect(page.locator('[data-testid="hilo-mensajes"]')).toBeVisible()

    await expect(page.locator(BOTON)).toHaveCount(0)
    await expect(page.locator('[data-testid="indicador-presencia-paciente"]')).toHaveCount(0)
  })

  test('con el paciente desconectado el botón está deshabilitado, y es el único del detalle', async ({
    browser
  }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cid = await sembrarConsultaTomada(token, 'E2E Videollamada Paciente Offline')

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()

    // Si el botón llegara a disparar la petición con el paciente desconectado, se vería aquí.
    let llamadas = 0
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/video-call')) llamadas += 1
    })

    await page.goto(`/panel-medico/consulta/${cid}`)
    await expect(page.getByRole('heading', { name: 'Detalle de consulta' })).toBeVisible()

    // Nadie ha abierto la sala de espera de este paciente: está desconectado.
    await expect(page.getByText('○ Sin conexión')).toBeVisible()

    const boton = page.locator(BOTON)
    await expect(boton).toBeVisible()
    await expect(boton).toBeDisabled()
    // El motivo va en el nombre accesible y en el `title`, no solo en el color.
    await expect(boton).toHaveAccessibleName(/El paciente no está conectado/)
    await expect(boton).toHaveAttribute('title', /El paciente no está conectado/)

    // CA16.2b: es el único botón de videoconsulta del detalle.
    await expect(page.getByRole('button', { name: 'Unirse a videoconsulta' })).toHaveCount(0)

    await page.waitForTimeout(1_000)
    expect(llamadas, 'un botón deshabilitado no puede iniciar la llamada').toBe(0)

    await ctx.close()
  })

  test('una CITA AGENDADA habilita el botón aunque el paciente no esté conectado', async ({
    browser
  }) => {
    // La excepción de CA16.2, y el escenario que de verdad protege a las citas: en una consulta
    // `scheduled` el paciente todavía NO puede estar conectado —es el inicio de la cita lo que
    // dispara el correo «tu médico ya está en la sala»—, así que exigir presencia dejaría las
    // citas agendadas sin forma de empezar. Fue el agujero que hizo quitar el candado en la
    // segunda redacción; ahora se cubre con esta excepción en vez de abriendo el candado entero.
    const token = accessToken('e2e/.auth/doc1.json')
    const padre = await sembrarConsultaTomada(token, 'E2E Videollamada Cita Agendada')

    // «Agendar seguimiento» cierra el padre (firmado) y crea la HIJA en `scheduled`, con el mismo
    // médico asignado. Es la vía real por la que nace una cita agendada.
    const ctxApi = await request.newContext()
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const res = await ctxApi.post(`${API}/consultations/${padre}/schedule-follow-up`, {
      data: {
        scheduled_at: manana,
        closing_note: 'Nota E2E de cierre para agendar el seguimiento.',
        signature: 'data:image/png;base64,iVBORw0KGgo='
      },
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok()) throw new Error(`schedule-follow-up devolvió ${res.status()}`)
    const hija: string = (await res.json()).id
    await ctxApi.dispose()

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const page = await ctx.newPage()
    await page.goto(`/panel-medico/consulta/${hija}`)
    await expect(page.getByRole('heading', { name: 'Detalle de consulta' })).toBeVisible()

    // El paciente no está conectado y, aun así, se puede llamar: es una cita agendada.
    await expect(page.getByText('○ Sin conexión')).toBeVisible()
    const boton = page.locator(BOTON)
    await expect(boton).toBeVisible()
    await expect(boton).toBeEnabled()
    await expect(page.getByText('El paciente no está conectado')).toHaveCount(0)

    await ctx.close()
  })

  test('con el paciente en línea el botón se habilita, y abrir el modal no inicia nada', async ({
    browser
  }) => {
    const token = accessToken('e2e/.auth/doc1.json')
    const cid = await sembrarConsultaTomada(token, 'E2E Videollamada Paciente Online')

    const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const panel = await ctxMedico.newPage()

    let llamadas = 0
    panel.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/video-call')) llamadas += 1
    })

    await panel.goto(`/panel-medico/consulta/${cid}`)
    await expect(panel.getByRole('heading', { name: 'Detalle de consulta' })).toBeVisible()

    // El PACIENTE abre su sala de espera y se anuncia por Realtime Presence. Ya no condiciona al
    // botón, pero CA16.2 pide que siga ahí como INFORMACIÓN para que el médico decida.
    const ctxPaciente = await browser.newContext()
    const paciente = await ctxPaciente.newPage()
    await paciente.goto(`/sala-espera?cid=${cid}&nombre=Test&room=r&code=ABC`)
    await expect(paciente.getByRole('heading', { name: /Gracias/ })).toBeVisible()

    // El indicador se entera en vivo, al lado del botón.
    const presencia = panel.locator('[data-testid="indicador-presencia-paciente"]')
    await expect(presencia).toContainText('En línea', { timeout: 20_000 })
    await expect(presencia).toHaveAttribute('data-online', 'true')

    const boton = panel.locator(BOTON)
    await expect(boton).toBeEnabled()
    await expect(boton).toHaveAccessibleName(/Videollamada/)

    await boton.click()

    // Variante `medico-llamada` del modal: dice lo que de verdad ocurre. Aquí el backend NO manda
    // `video_ready_email`, así que prometer un correo era mentirle al médico.
    const aviso = panel.getByRole('dialog')
    await expect(aviso.getByRole('heading', { name: 'Información importante' })).toBeVisible()
    await expect(aviso.getByText(/en el chat de la consulta/)).toBeVisible()
    await expect(aviso.getByText(/No se le envía ningún correo/)).toBeVisible()
    await expect(aviso.getByText(/recibe un correo/)).toHaveCount(0)
    await expect(aviso.getByText(/no recibió el aviso por correo/)).toHaveCount(0)
    // Y la copia clínico-operativa del médico sigue intacta.
    await expect(aviso.getByText(/espera de 15 a 20 minutos/)).toBeVisible()

    // El modal no abre nada por su cuenta: hasta que no se confirma, no hay petición.
    expect(llamadas, 'el modal no puede iniciar la llamada por su cuenta').toBe(0)
    await aviso.getByRole('button', { name: 'Cerrar' }).click()
    await expect(panel.getByRole('dialog')).toHaveCount(0)

    await ctxPaciente.close()
    await ctxMedico.close()
  })

  test('ruta feliz: confirmar el modal llama una vez, abre la sala y deja el aviso en el hilo', async ({
    browser
  }) => {
    // La costura COMPLETA de CA16.10 contra el backend real: botón → modal →
    // «Entendido» → un solo `POST /video-call` → la ventana que se abrió vacía en el clic se navega
    // a la sala pasada por `browserRoomUrl` → el aviso de sistema queda en el hilo. Lo único
    // simulado es `window.open`: una ventana real a Jitsi en medio de la suite es ruido y pediría
    // cámara.
    const token = accessToken('e2e/.auth/doc1.json')
    const cid = await sembrarConsultaTomada(token, 'E2E Videollamada Ruta Feliz')

    const ctxMedico = await browser.newContext({ storageState: 'e2e/.auth/doc1.json' })
    const panel = await ctxMedico.newPage()
    await espiarWindowOpen(panel)

    const llamadas: string[] = []
    panel.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/video-call')) llamadas.push(req.url())
    })

    await panel.goto(`/panel-medico/consulta/${cid}`)
    await expect(panel.getByRole('heading', { name: 'Detalle de consulta' })).toBeVisible()

    // El PACIENTE abre su sala de espera: con el candado de CA16.2 de vuelta, el botón lo necesita
    // (esta consulta está en atención, no es una cita agendada).
    const ctxPaciente = await browser.newContext()
    const paciente = await ctxPaciente.newPage()
    await paciente.goto(`/sala-espera?cid=${cid}&nombre=Test&room=r&code=ABC`)
    await expect(paciente.getByRole('heading', { name: /Gracias/ })).toBeVisible()

    const boton = panel.locator(BOTON)
    await expect(boton).toBeEnabled({ timeout: 20_000 })
    await boton.click()

    const aviso = panel.getByRole('dialog')
    await expect(aviso.getByRole('heading', { name: 'Información importante' })).toBeVisible()
    // La sala se abre DENTRO de este clic; fuera de un gesto del usuario el navegador lo bloquea.
    await aviso.getByRole('button', { name: 'Entendido, continuar a la videollamada' }).click()

    // Un solo POST: el `disabled` del botón más el candado por `ref` existen para esto.
    await expect
      .poll(() => llamadas.length, { message: 'un solo POST /video-call', timeout: 15_000 })
      .toBe(1)

    // La ventana se abrió VACÍA en el clic y se navegó después, al volver la respuesta.
    const ventanas = await ventanasAbiertas(panel)
    expect(ventanas).toHaveLength(1)
    expect(ventanas[0].url, 'la ventana se abre con about:blank dentro del clic').toBe(
      'about:blank'
    )
    expect(ventanas[0].cerrada).toBe(false)
    // Y el destino pasó por `browserRoomUrl`: lleva el hash-config que salta el interstitial móvil
    // y no apunta al meet.jit.si público (que hoy exige moderador).
    expect(ventanas[0].navegadaA).toContain('config.disableDeepLinking=true')
    expect(ventanas[0].navegadaA).not.toContain('meet.jit.si')

    // Y el aviso de sistema quedó en el hilo. El médico lo ve como separador, SIN botón de entrada:
    // el suyo es el de la cabecera, con su modal.
    const enHilo = panel.locator('[data-testid="mensaje-sistema"][data-kind="call"]')
    await expect(enHilo.first()).toBeVisible({ timeout: 15_000 })
    await expect(enHilo.first().locator('[data-testid="btn-entrar-videoconsulta"]')).toHaveCount(0)

    await ctxPaciente.close()
    await ctxMedico.close()
  })

  test('el aviso de sistema sale centrado, sin burbuja ni estado, y con su BOTÓN de entrada', async ({
    page
  }) => {
    const { id: cid, token } = await crearConsultaEnEspera('E2E Videollamada Aviso Sistema')
    await responderHiloConAviso(page, cid, CUERPO_AVISO)

    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)

    const aviso = page.locator('[data-testid="mensaje-sistema"]')
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText(CUERPO_AVISO)

    // Centrado y neutral: ni a la izquierda ni a la derecha, sin burbuja de emisor y sin marcas
    // de entrega. Es un separador informativo, no un mensaje de nadie.
    await expect(aviso).toHaveCSS('align-self', 'center')
    await expect(aviso).toHaveCSS('text-align', 'center')
    await expect(aviso).toHaveAttribute('data-direction', 'system')
    await expect(aviso).toHaveAttribute('data-kind', 'call')
    await expect(page.locator('[data-testid="mensaje-item"]')).toHaveCount(0)
    await expect(aviso.locator('[data-testid="status-sent"]')).toHaveCount(0)
    await expect(aviso.locator('[data-testid="status-read"]')).toHaveCount(0)

    // La entrada es un BOTÓN, y su destino lo construye la interfaz con el contexto del hilo
    // (`consultationId` + la credencial del lector), no con nada que venga en el cuerpo.
    const entrar = aviso.locator('[data-testid="btn-entrar-videoconsulta"]')
    await expect(entrar).toBeVisible()
    await expect(entrar).toBeEnabled()
    await expect(entrar).toHaveAccessibleName('Entrar a la videoconsulta')
    await expect(entrar).toHaveClass(/btn/)
    // Y el aviso lleva su hora, para que uno viejo se lea como viejo.
    await expect(aviso.locator('time')).toBeVisible()
  })

  test('un aviso VIEJO con la URL y el token dentro del cuerpo no imprime nada de eso', async ({
    page
  }) => {
    // Este es el test que de verdad cierra la fuga: prueba la DEFENSA, no la ausencia del ataque.
    //
    // El backend quitó el enlace del cuerpo, pero los avisos creados antes siguen guardados con la
    // URL y un token de consulta de 24 h dentro, y limpiar la base no arregla la clase de problema.
    // La defensa es que la interfaz NUNCA imprima el cuerpo de un aviso de llamada: lo enuncia ella
    // misma. Así queda cubierto el aviso viejo, un cambio futuro de redacción y cualquier cosa que
    // acabe en ese campo más adelante.
    const { id: cid, token } = await crearConsultaEnEspera('E2E Videollamada Aviso Viejo')
    await responderHiloConAviso(page, cid, CUERPO_VIEJO_CON_TOKEN)

    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)

    const aviso = page.locator('[data-testid="mensaje-sistema"]')
    await expect(aviso).toBeVisible()

    // Lo que se lee es el texto de la interfaz, no el cuerpo guardado.
    await expect(aviso).toContainText(CUERPO_AVISO)

    // Y en pantalla no aparece NADA del cuerpo: ni URL, ni token, ni la ruta de entrada.
    const visible = (await aviso.innerText()).toLowerCase()
    for (const prohibido of [
      'http',
      '://',
      'eyj',
      't=',
      'entrar-videoconsulta',
      'medicosporvenezuela.org',
      'jit.si'
    ]) {
      expect(visible, `el aviso no puede mostrar «${prohibido}»`).not.toContain(prohibido)
    }

    // Tampoco se linkifica nada: el único elemento pulsable es el botón que pinta la UI, y sigue
    // estando —el aviso tiene que seguir siendo accionable—.
    await expect(aviso.locator('a')).toHaveCount(0)
    await expect(aviso.locator('[data-testid="btn-entrar-videoconsulta"]')).toBeVisible()
  })

  test('con el caso finalizado, el paciente NO puede entrar desde el aviso y lee por qué', async ({
    page
  }) => {
    // CA16.2c, y el hallazgo del cliente: este botón solo se deshabilitaba mientras la petición
    // volaba, así que con el caso cerrado un aviso viejo seguía siendo una puerta a la sala. Es
    // incoherente con el lado del médico, que no puede llamar en un caso finalizado.
    const { id: cid, token } = await crearConsultaEnEspera('E2E Videollamada Entrada Cerrada')
    await responderHiloConAviso(page, cid, CUERPO_AVISO)
    await responderSalaDeEspera(page, cid, 'finished')

    // Si el botón llegara a disparar la petición de sala, se vería aquí.
    let salas = 0
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/video-room')) salas += 1
    })

    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)

    const aviso = page.locator('[data-testid="mensaje-sistema"]')
    await expect(aviso).toBeVisible()

    // El botón sigue ahí —el aviso es constancia de que hubo llamada— pero no se puede pulsar.
    const entrar = aviso.locator('[data-testid="btn-entrar-videoconsulta"]')
    await expect(entrar).toBeVisible()
    await expect(entrar).toBeDisabled()
    await expect(entrar).toHaveAccessibleName(/El caso está finalizado/)

    // Y al paciente no se le deja un botón gris sin explicación: el motivo se LEE.
    const motivo = aviso.locator('[data-testid="motivo-sin-entrada"]')
    await expect(motivo).toBeVisible()
    await expect(motivo).toContainText('El caso está finalizado')
    await expect(motivo).toContainText('ya no puedes entrar a la videoconsulta')

    await page.waitForTimeout(1_000)
    expect(salas, 'un caso finalizado no puede pedir la sala').toBe(0)
  })

  test('un aviso de sistema que NO es de llamada sí muestra su cuerpo, como texto', async ({
    page
  }) => {
    // El texto propio es solo para `kind: "call"`, que es el único aviso cuyo contenido la interfaz
    // conoce. De cualquier otro no sabe qué dice, así que lo muestra —sin interpretarlo— en vez de
    // tragárselo.
    const { id: cid, token } = await crearConsultaEnEspera('E2E Videollamada Aviso Generico')
    await responderHiloConAviso(page, cid, 'Aviso de prueba del sistema.', 'system_notice')

    await page.goto(`/sala-espera?cid=${cid}&t=${token}`)

    const aviso = page.locator('[data-testid="mensaje-sistema"]')
    await expect(aviso).toBeVisible()
    await expect(aviso).toHaveAttribute('data-kind', 'system_notice')
    await expect(aviso).toContainText('Aviso de prueba del sistema.')
    // No es una llamada: ni botón de entrada ni el texto del aviso de llamada.
    await expect(aviso.locator('[data-testid="btn-entrar-videoconsulta"]')).toHaveCount(0)
    await expect(aviso).not.toContainText(CUERPO_AVISO)
  })
})
