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

// FastAPI's `detail` comes in two shapes: a plain string for domain/business errors (403, 404,
// 409, 502, some 422s), or an array of pydantic validation issues (`{type, loc, msg, input}`) for
// payload-validation 422s. Building the display message here — instead of duplicating the
// `typeof detail === 'string'` check per caller — makes sure the array case renders its per-field
// `msg`s instead of falling back to a useless `${defaultErrorMessage} (${status})`.
function detailMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const joined = detail
      .map((d) =>
        d && typeof d === 'object' && 'msg' in d ? String((d as { msg?: unknown }).msg) : ''
      )
      .filter(Boolean)
      .join('; ')
    if (joined) return joined
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

export async function getJson<T>(path: string, errorMessage: string, token?: string): Promise<T> {
  const res = await authedFetch(path, {}, token)
  if (!res.ok) {
    const detail = redactSensitiveInput(await errorDetail(res))
    const message = detailMessage(detail, `${errorMessage} (${res.status})`)
    throw new ApiError(res.status, message, detail)
  }
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
  if (!res.ok) {
    const detail = redactSensitiveInput(await errorDetail(res))
    const message = detailMessage(detail, `${defaultErrorMessage} (${res.status})`)
    throw new ApiError(res.status, message, detail)
  }
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
  if (!res.ok) {
    const detail = redactSensitiveInput(await errorDetail(res))
    const message = detailMessage(detail, `${defaultErrorMessage} (${res.status})`)
    throw new ApiError(res.status, message, detail)
  }
}
