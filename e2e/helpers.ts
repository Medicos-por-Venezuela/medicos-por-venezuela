// Ayudas compartidas por los specs E2E.
//
// `POST /consultations` empezó a exigir `specialty_id` (antes era opcional): el backend dejó de
// aceptar consultas sin especialidad para que ningún caso entre a la cola sin saber a quién se
// puede enrutar. Los specs creaban las suyas solo con `patient_id`, así que desde ese cambio
// recibían un 422 y todo lo que venía después fallaba en cascada — el `id` llegaba `undefined` y
// los siguientes endpoints se quejaban de un UUID inválido.
//
// El id no se puede fijar a mano en el código: es un UUID que cambia por entorno. Se lee del
// catálogo real, que es además lo que hace la aplicación.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { request } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

type Especialidad = {
  id: string
  name: string
  status: string
  mental_health_only?: boolean
}

// Se cachea por proceso. Playwright arranca un worker por fichero de spec, así que esto ahorra
// una petición por test dentro del mismo fichero, no entre ficheros.
let cache: string | null = null

/**
 * Devuelve el id de una especialidad general y activa, para las consultas de prueba.
 *
 * Se prefiere "Medicina general" por ser la que menos supuestos arrastra: no es de salud mental,
 * así que cualquier médico de prueba puede atenderla y no interfiere con las reglas de reserva.
 */
export async function idEspecialidadGeneral(): Promise<string> {
  if (cache) return cache

  const ctx = await request.newContext()
  const res = await ctx.get(`${API}/specialties`)
  if (!res.ok()) {
    await ctx.dispose()
    throw new Error(`no pude leer el catálogo de especialidades: HTTP ${res.status()}`)
  }
  const cuerpo = await res.json()
  await ctx.dispose()

  const lista: Especialidad[] = Array.isArray(cuerpo) ? cuerpo : (cuerpo?.items ?? [])
  const elegida =
    lista.find((e) => e.name === 'Medicina general' && e.status === 'active') ??
    lista.find((e) => e.status === 'active' && !e.mental_health_only)

  if (!elegida) {
    throw new Error(
      'el catálogo no trae ninguna especialidad general activa; ¿está sembrada la base local?'
    )
  }
  cache = elegida.id
  return cache
}

/**
 * access_token de la sesión guardada por global-setup (storageState). El mismo token que usa el
 * navegador sirve como Bearer contra el backend.
 */
export function accessToken(file: string): string {
  const state = JSON.parse(readFileSync(path.join(__dirname, '..', file), 'utf8'))
  const entry = state.origins[0].localStorage.find((e: { name: string }) =>
    e.name.includes('auth-token')
  )
  return JSON.parse(entry.value).access_token
}

/** El id de una especialidad activa por su nombre exacto (para sembrar casos de otra cola). */
export async function idEspecialidadPorNombre(nombre: string): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.get(`${API}/specialties`)
  const cuerpo = await res.json()
  await ctx.dispose()
  const lista: Especialidad[] = Array.isArray(cuerpo) ? cuerpo : (cuerpo?.items ?? [])
  const elegida = lista.find((e) => e.name === nombre && e.status === 'active')
  if (!elegida) throw new Error(`no hay especialidad activa llamada "${nombre}"`)
  return elegida.id
}

/**
 * Paciente + consulta en espera de Medicina general (o de la especialidad que se pida), sembrados
 * por los endpoints públicos. Sin correo a propósito: el backend local no manda correos, pero
 * así ningún flujo intentaría uno. Devuelve el id de la consulta y su token de sala.
 */
export async function crearConsultaEnEspera(
  marcador: string,
  especialidad?: string
): Promise<{ id: string; token: string }> {
  const ctx = await request.newContext()
  const patient = await ctx.post(`${API}/patients`, {
    data: {
      full_name: marcador,
      phone_whatsapp: '+584120000055',
      affected_zone: 'Caracas',
      consent: true
    }
  })
  const patientId = (await patient.json()).id
  // La cola oculta el nombre; el card muestra chief_complaint → se usa como marcador.
  const cons = await ctx.post(`${API}/consultations`, {
    data: {
      patient_id: patientId,
      chief_complaint: marcador,
      specialty_id: especialidad
        ? await idEspecialidadPorNombre(especialidad)
        : await idEspecialidadGeneral()
    }
  })
  const body = await cons.json()
  await ctx.dispose()
  return { id: body.id, token: body.access_token }
}
