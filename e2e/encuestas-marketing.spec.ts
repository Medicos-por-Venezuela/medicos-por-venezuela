// Encuestas de marketing de punta a punta: el formulario público al que llega el médico desde el
// correo masivo, y el módulo Marketing del panel, donde el super_admin ve y exporta las respuestas.
//
// Requiere en la base local las migraciones del backend
// `20260912_191152_create_marketing_survey_responses.sql` y
// `20260912_191154_seed_marketing_read_permission.sql` (`python artisan migrate`); sin la segunda,
// el super_admin recibe 403 y la tabla del panel no carga.
//
// Correos `e2e-encuesta…@example.com`, únicos por corrida: global-setup borra los de corridas
// anteriores. Dominio @example.com porque el EmailStr del backend rechaza .local.
import { test, expect } from '@playwright/test'

const ENVIAR = { name: 'Enviar mi respuesta' }

test('médico general: la disponibilidad solo se pide si va a atender, y la respuesta llega al panel', async ({
  page,
  browser
}) => {
  // El `+` va SIN codificar, como lo deja una herramienta de envío que no codifica la variable:
  // `URLSearchParams` lo leería como un espacio y el formulario tiene que devolverlo a `+`.
  const email = `e2e-encuesta+mg-${Date.now()}@example.com`
  await page.goto(`/encuesta/medicos-generales?email=${email}`)

  const correo = page.getByLabel('Tu correo')
  await expect(correo).toHaveValue(email)
  await expect(correo).toHaveJSProperty('readOnly', true)

  // Vacío: se marca el grupo de roles, y la disponibilidad ni aparece — todavía no dijo que
  // quiere atender.
  await page.getByRole('button', ENVIAR).click()
  await expect(
    page.getByText('Por favor completa los campos marcados con * antes de enviar.')
  ).toBeVisible()
  await expect(page.getByText('Tu disponibilidad', { exact: true })).toHaveCount(0)

  // Quien solo va a pedir interconsultas no se compromete a un horario...
  await page.getByLabel('Pedir interconsultas cuando tenga un caso que lo necesite').check()
  await expect(page.getByText('Tu disponibilidad', { exact: true })).toHaveCount(0)

  // ...pero querer atender abre la disponibilidad, y entonces es obligatoria.
  await page.getByLabel('Seguir atendiendo pacientes a través de la plataforma').check()
  await expect(page.getByText('Tu disponibilidad', { exact: true })).toBeVisible()
  await page.getByRole('button', ENVIAR).click()
  await expect(page.getByText('Selecciona una opción.')).toBeVisible()

  await page.getByLabel('Noche', { exact: true }).check()
  await page.getByLabel('Martes', { exact: true }).check()
  await page.getByLabel('Entre 1 y 3 horas a la semana').check()
  // Al completar lo que faltaba, el aviso general desaparece sin volver a enviar.
  await expect(
    page.getByText('Por favor completa los campos marcados con * antes de enviar.')
  ).toHaveCount(0)
  await page.getByRole('button', ENVIAR).click()

  await expect(page.getByText('Ya tenemos tu respuesta', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', ENVIAR)).toHaveCount(0)

  // El super_admin la ve en la pestaña que le corresponde, con el texto que vio el médico.
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const admin = await ctx.newPage()
  await admin.goto('/admin/marketing')
  await admin.getByRole('tab', { name: 'Médico General' }).click()
  await expect(admin.getByRole('tab', { name: 'Médico General' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await admin.getByPlaceholder('Buscar por correo').fill(email)
  await expect(admin.getByRole('cell', { name: email })).toBeVisible()
  await expect(
    admin.getByRole('cell', {
      name: 'Pedir interconsultas cuando tenga un caso que lo necesite; Seguir atendiendo pacientes a través de la plataforma'
    })
  ).toBeVisible()
  await expect(admin.getByRole('cell', { name: 'Entre 1 y 3 horas a la semana' })).toBeVisible()
  // Médicos generales no pregunta la ubicación: esa columna no existe en su pestaña.
  await expect(admin.getByRole('columnheader', { name: 'Dónde está' })).toHaveCount(0)

  // Y se exporta a Excel con el nombre que fija el backend.
  const [download] = await Promise.all([
    admin.waitForEvent('download'),
    admin.getByRole('button', { name: /Exportar a Excel \(1\)/ }).click()
  ])
  expect(download.suggestedFilename()).toMatch(
    /^encuesta-medicos-generales-\d{4}-\d{2}-\d{2}\.xlsx$/
  )
  await expect(admin.getByText(/Respuestas descargadas como/)).toBeVisible()

  await ctx.close()
})

test('psicólogo: sin correo en el enlace, el campo es editable y la ubicación es obligatoria', async ({
  page,
  browser
}) => {
  const email = `e2e-encuesta-psi-${Date.now()}@example.com`
  // Enlace abierto a mano (o una herramienta que no sustituyó la variable): no hay correo que
  // mostrar, así que el formulario no puede quedarse con un campo de solo lectura vacío.
  await page.goto('/encuesta/psicologos')

  const correo = page.getByLabel('Tu correo')
  await expect(correo).toHaveJSProperty('readOnly', false)

  await page.getByRole('button', ENVIAR).click()
  await expect(page.getByText('Escribe un correo válido.')).toBeVisible()
  await expect(page.getByText('Elige tu país o zona horaria.')).toBeVisible()

  await correo.fill(email)
  await page.getByLabel('Atender pacientes a través de la plataforma').check()
  // "Otra forma" abre su propio campo de texto solo al marcarla.
  await expect(page.getByLabel('Otra forma: cuéntanos qué tienes en mente')).toHaveCount(0)
  await page.getByLabel('Otra forma que quiero proponerles').check()
  await page.getByLabel('Otra forma: cuéntanos qué tienes en mente').fill('Grupos de apoyo')
  await page.getByLabel('Tarde', { exact: true }).check()
  await page.getByLabel('Sábado', { exact: true }).check()
  await page.getByLabel('Más de 6 horas a la semana').check()
  await page.getByLabel('¿Dónde estás?').selectOption({ label: 'Otra (se la indico abajo)' })
  await page.getByLabel('Tu país o zona horaria').fill('Japón (GMT+9)')
  await page.getByRole('button', ENVIAR).click()

  await expect(page.getByText('salud mental de Venezuela', { exact: false })).toBeVisible()

  const ctx = await browser.newContext({ storageState: 'e2e/.auth/dual.json' })
  const admin = await ctx.newPage()
  await admin.goto('/admin/marketing')
  // Psicólogos es la pestaña con la que abre el módulo.
  await expect(admin.getByRole('tab', { name: 'Psicólogos' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await admin.getByPlaceholder('Buscar por correo').fill(email)
  await expect(admin.getByRole('cell', { name: email })).toBeVisible()
  await expect(admin.getByRole('cell', { name: 'Grupos de apoyo' })).toBeVisible()
  await expect(admin.getByRole('cell', { name: 'Japón (GMT+9)' })).toBeVisible()
  await expect(admin.getByRole('columnheader', { name: 'Dónde está' })).toBeVisible()

  // El enlace para Kit de esta pestaña lleva la variable del correo.
  await expect(admin.getByLabel('Enlace de la encuesta')).toHaveValue(
    /\/encuesta\/psicologos\?email=\{\{ subscriber\.email_address \}\}$/
  )

  // La misma persona no aparece en otra encuesta que no respondió.
  await admin.getByRole('tab', { name: 'Especialistas' }).click()
  await expect(admin.getByText('Ninguna respuesta coincide con estos filtros.')).toBeVisible()
  await expect(admin.getByRole('button', { name: /Exportar a Excel/ })).toBeDisabled()

  await ctx.close()
})

test('un admin (no super) no ve Marketing ni puede usar la página', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
  const page = await ctx.newPage()

  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard administrativo' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Marketing' })).toHaveCount(0)

  await page.goto('/admin/marketing')
  await expect(page.getByText('reservadas a los')).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Exportar a Excel/ })).toHaveCount(0)

  await ctx.close()
})
