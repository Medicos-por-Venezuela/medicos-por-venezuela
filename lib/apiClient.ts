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
function authedFetch(path: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
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

async function raiseApiError(res: Response, defaultErrorMessage: string): Promise<never> {
  const detail = await errorDetail(res)
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
  token?: string
): Promise<T> {
  const res = await authedFetch(
    path,
    { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    token
  )
  if (!res.ok) await raiseApiError(res, defaultErrorMessage)
  return res.json()
}

export const postJson = <T>(
  path: string,
  payload: unknown,
  defaultErrorMessage: string,
  token?: string
): Promise<T> => sendJson<T>('POST', path, payload, defaultErrorMessage, token)

export const patchJson = <T>(
  path: string,
  payload: unknown,
  defaultErrorMessage: string,
  token?: string
): Promise<T> => sendJson<T>('PATCH', path, payload, defaultErrorMessage, token)

export async function deleteJson(
  path: string,
  defaultErrorMessage: string,
  token?: string
): Promise<void> {
  const res = await authedFetch(path, { method: 'DELETE' }, token)
  if (!res.ok) await raiseApiError(res, defaultErrorMessage)
}
