// Shared client for the FastAPI backend (api-medicos-por-venezuela). Both env var names are
// accepted because lib/api.ts (the older Supabase-catalog-fallback module) already established
// NEXT_PUBLIC_API_BASE_URL for the same backend before lib/doctors.ts/lib/patients.ts introduced
// NEXT_PUBLIC_API_URL — accepting either here avoids a silent misconfiguration if only one is set.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

// Lets callers branch on the backend's HTTP status (422 validation, 429 rate limit, etc.)
// instead of parsing the error message.
export class ApiError extends Error {
  status: number
  detail?: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// `token` (Supabase access_token) is optional: public endpoints (doctor/patient registration)
// don't need it, admin-only endpoints (catalogs.manage) do — the backend validates the same
// Supabase JWT it accepts for auth, no separate credential.
function authedFetch(
  path: string,
  init: RequestInit,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  // Para credenciales que NO son el JWT de Supabase — hoy solo X-Consultation-Token, el acceso
  // a la sala del paciente anónimo, que no tiene sesión con la que autenticarse.
  for (const [k, v] of Object.entries(extraHeaders || {})) headers.set(k, v)
  return fetch(`${API_URL}${path}`, { ...init, headers })
}

async function errorDetail(res: Response): Promise<unknown> {
  try {
    return (await res.json())?.detail
  } catch {
    return undefined // sin cuerpo JSON en la respuesta de error
  }
}

// Mensaje legible desde el `detail` del backend: string tal cual; lista de errores de
// validación de Pydantic (422) -> "campo: mensaje"; otro caso -> fallback genérico.
function detailMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const parts = detail
      .filter((d): d is { loc?: unknown[]; msg: string } => typeof d?.msg === 'string')
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
        return field ? `${field}: ${d.msg}` : d.msg
      })
    if (parts.length > 0) return parts.join(' · ')
  }
  return fallback
}

// Pydantic's 422 validation array echoes the submitted value back in each issue's `input` — for a
// password field that means the plaintext password would otherwise ride along on `ApiError.detail`
// past this point (logging, error reporting, etc). Redact it in place before it goes any further.
function redactSensitiveInput(detail: unknown): unknown {
  if (!Array.isArray(detail)) return detail
  return detail.map((d) => {
    if (!d || typeof d !== 'object' || !('loc' in d)) return d
    const loc = (d as { loc?: unknown }).loc
    if (Array.isArray(loc) && loc.some((part) => String(part).toLowerCase().includes('password'))) {
      return { ...d, input: '[redacted]' }
    }
    return d
  })
}

// Centraliza el throw de ApiError para todos los callers. El `detail` pasa por
// redactSensitiveInput para que un password en texto plano nunca sobreviva en ApiError.detail.
async function raiseApiError(res: Response, defaultErrorMessage: string): Promise<never> {
  const detail = redactSensitiveInput(await errorDetail(res))
  throw new ApiError(
    res.status,
    detailMessage(detail, `${defaultErrorMessage} (${res.status})`),
    detail
  )
}

export async function getJson<T>(path: string, errorMessage: string, token?: string): Promise<T> {
  const res = await authedFetch(path, {}, token)
  // ApiError (no Error plano) también en GET: los callers pueden distinguir 401/403/etc.
  if (!res.ok) await raiseApiError(res, errorMessage)
  return res.json()
}

async function sendJson<T>(
  method: 'POST' | 'PATCH',
  path: string,
  payload: unknown,
  defaultErrorMessage: string,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const res = await authedFetch(
    path,
    { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    token,
    extraHeaders
  )
  if (!res.ok) await raiseApiError(res, defaultErrorMessage)
  return res.json()
}

export const postJson = <T>(
  path: string,
  payload: unknown,
  defaultErrorMessage: string,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<T> => sendJson<T>('POST', path, payload, defaultErrorMessage, token, extraHeaders)

export const patchJson = <T>(
  path: string,
  payload: unknown,
  defaultErrorMessage: string,
  token?: string
): Promise<T> => sendJson<T>('PATCH', path, payload, defaultErrorMessage, token)

// Nombre de archivo que el backend fija en `Content-Disposition`. Devuelve null si la cabecera
// no llega: en una respuesta cross-origin el navegador solo la deja leer si el backend la pone en
// `Access-Control-Expose-Headers` (el nuestro lo hace), así que el caller necesita un fallback.
function filenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  return match ? decodeURIComponent(match[1]) : null
}

// Descarga binaria autenticada (hoy: los reportes en Excel). No se puede hacer con un <a href>
// normal porque el endpoint exige el JWT de Supabase en la cabecera `Authorization`, y un enlace
// no manda cabeceras; de ahí el fetch + Blob.
export async function getFile(
  path: string,
  defaultErrorMessage: string,
  token?: string
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await authedFetch(path, {}, token)
  // El error de un endpoint de descarga sigue llegando como JSON (`detail`), así que se procesa
  // con el mismo camino que el resto: el usuario ve "Acota el reporte...", no "error 422".
  if (!res.ok) await raiseApiError(res, defaultErrorMessage)
  return {
    blob: await res.blob(),
    filename: filenameFromDisposition(res.headers.get('Content-Disposition'))
  }
}

export async function deleteJson(
  path: string,
  defaultErrorMessage: string,
  token?: string
): Promise<void> {
  const res = await authedFetch(path, { method: 'DELETE' }, token)
  if (!res.ok) await raiseApiError(res, defaultErrorMessage)
}
