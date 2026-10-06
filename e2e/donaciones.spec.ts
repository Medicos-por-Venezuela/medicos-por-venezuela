// /donaciones — la página de la campaña de donativos, portada de la plantilla `mxv-donativos`.
//
// Esta página es un caso raro en el repo: trae su propia cabecera, su propio pie y SU PROPIO CSS,
// con selectores globales (`:root`, `*`, `html`, `body`, `section`, `h2`, `footer`) que se han
// acotado a un contenedor con un CSS Module. Lo que estos tests fijan es precisamente lo que se
// rompería en silencio si alguien tocara ese aislamiento o el guion portado:
//
//   · que la página carga sin errores de consola NI DE HIDRATACIÓN — el riesgo principal, porque
//     el guion original leía `localStorage` y animaba números al arrancar;
//   · que están las cinco secciones;
//   · que el alternador ES/EN cambia de verdad el texto y anuncia su estado;
//   · que a 360 px no hay desborde horizontal, ni siquiera con los paneles desplegados.
//
// No se prueba el pago: ni Zelle ni PayPal reciben nada desde aquí (son un QR y un enlace), y
// pulsar el botón abriría paypal.com.
import { test, expect, type Page } from '@playwright/test'

/**
 * Ruido conocido del servidor de desarrollo de Next 16, no de esta página: pide
 * `_clientMiddlewareManifest.js` y lo sirve como `application/json`. Sale igual en `/` y en
 * cualquier otra ruta, así que filtrarlo aquí no tapa nada nuestro.
 */
const RUIDO_DEL_DEV_SERVER = /_clientMiddlewareManifest/

function registrarErrores(page: Page): string[] {
  const errores: string[] = []
  page.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return
    if (RUIDO_DEL_DEV_SERVER.test(mensaje.text())) return
    errores.push(mensaje.text())
  })
  page.on('pageerror', (error) => errores.push(`pageerror: ${error.message}`))
  return errores
}

test('/donaciones carga sin errores de consola ni de hidratación, con sus cinco secciones', async ({
  page
}) => {
  const errores = registrarErrores(page)

  await page.goto('/donaciones')

  // La cita de Luis es el <h1>: si falta, no ha montado nada.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Eso fue una luz', {
    useInnerText: true
  })

  // Las cuatro secciones que siguen, cada una por su titular.
  await expect(page.getByRole('heading', { name: /El conocimiento existe/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Luis no es/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Detrás de cada consulta/ })).toBeVisible()
  await expect(page.getByText('No alcanzo el tiempo para agradecer.')).toBeVisible()

  // La caja de donación y el aviso de transparencia del pie, que es el que exige una página que
  // pide dinero.
  await expect(page.locator('#donar')).toBeVisible()
  await expect(page.locator('#transparencia')).toContainText('no son deducibles de impuestos')

  // Los assets propios de la página viven en el repositorio, no en Google Drive: si alguien
  // volviera a enlazarlos fuera, la CSP (`img-src 'self'`) los bloquearía en producción.
  await expect(page.locator('audio')).toHaveAttribute('src', '/donaciones/luis-nota-de-voz.mp3')
  for (const foto of await page.locator('figure img').all()) {
    expect(await foto.getAttribute('src')).toMatch(/^\/donaciones\/equipo\//)
  }

  // Un desajuste de hidratación llega como error de consola. Esta aserción es el motivo real del
  // test: el idioma inicial, los contadores y la barra fija nacen todos del lado del servidor.
  await page.waitForTimeout(1000)
  expect(errores).toEqual([])
})

test('el alternador de idioma cambia el texto y anuncia su estado', async ({ page }) => {
  const errores = registrarErrores(page)
  await page.goto('/donaciones')

  const botonEs = page.getByRole('button', { name: 'ES', exact: true })
  const botonEn = page.getByRole('button', { name: 'EN', exact: true })

  // Arranca SIEMPRE en castellano: es lo que pinta el servidor, y lo que evita el desajuste.
  await expect(botonEs).toHaveAttribute('aria-pressed', 'true')
  await expect(botonEn).toHaveAttribute('aria-pressed', 'false')
  // `useInnerText` es imprescindible aquí: la página lleva SIEMPRE los dos idiomas en el DOM y
  // esconde uno con CSS (ver `components/donaciones/Bilingue.tsx`), así que `textContent` —lo que
  // mira `toContainText` por omisión— devolvería las dos versiones pegadas y la comprobación
  // pasaría en verde con el alternador roto. `innerText` solo ve lo que se pinta.
  const titular = page.getByRole('heading', { level: 1 })
  await expect(titular).toContainText('Me apareció un ángel', { useInnerText: true })
  await expect(titular).not.toContainText('An angel appeared to me', { useInnerText: true })

  await botonEn.click()
  await expect(botonEn).toHaveAttribute('aria-pressed', 'true')
  await expect(botonEs).toHaveAttribute('aria-pressed', 'false')
  await expect(titular).toContainText('An angel appeared to me', { useInnerText: true })
  await expect(titular).not.toContainText('Me apareció un ángel', { useInnerText: true })
  // El idioma del documento acompaña al texto: es lo que decide cómo lo pronuncia un lector de
  // pantalla y qué ofrece traducir el navegador.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page).toHaveTitle('Give to Médicos por Venezuela')

  // Y se recuerda. Al recargar, el servidor sigue mandando castellano (no puede saber otra cosa)
  // y el cliente corrige después de hidratar, sin romper nada.
  await page.reload()
  await expect(botonEn).toHaveAttribute('aria-pressed', 'true')
  await expect(titular).toContainText('An angel appeared to me', { useInnerText: true })

  await page.waitForTimeout(500)
  expect(errores).toEqual([])
})

test('a 360 px no hay desborde horizontal, ni con los paneles de pago abiertos', async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/donaciones')

  const sinDesborde = async () =>
    page.evaluate(() => {
      const raiz = document.documentElement
      return raiz.scrollWidth <= raiz.clientWidth
    })

  expect(await sinDesborde()).toBe(true)

  // Lo que más crece en ancho: el QR de Zelle y el desplegable de Venezuela, los dos dentro de
  // una caja que a 360 px solo tiene 16 px de margen a cada lado.
  await page.getByRole('button', { name: /Zelle/ }).first().click()
  await page.locator('details summary').click()
  await expect(page.locator('details')).toHaveAttribute('open', '')
  expect(await sinDesborde()).toBe(true)

  // Y en inglés, que es donde los textos son más largos en varios botones.
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('An angel appeared to me', {
    useInnerText: true
  })
  expect(await sinDesborde()).toBe(true)
})

test('la nota de voz es operable con el teclado', async ({ page }) => {
  await page.goto('/donaciones')

  // La onda es un `slider` enfocable con flechas: sin esto, quien no usa ratón no puede moverse
  // por el audio.
  const onda = page.getByRole('slider', { name: 'Progreso' })
  await expect(onda).toHaveAttribute('aria-valuenow', '0')
  await onda.focus()
  await expect(onda).toBeFocused()

  // El botón cambia de etiqueta, que es lo único que oye un lector de pantalla (el icono es
  // decorativo).
  const reproducir = page.getByRole('button', { name: 'Reproducir nota de voz' })
  await expect(reproducir).toBeVisible()
  await reproducir.click()
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  // Los subtítulos sustituyen al aviso inicial en cuanto empieza a sonar.
  await expect(page.locator('[aria-live="polite"]')).not.toContainText('Escucha a Luis', {
    useInnerText: true
  })
})
