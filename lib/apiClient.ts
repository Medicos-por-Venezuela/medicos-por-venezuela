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

export async function getJson<T>(path: string, errorMessage: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) {
    throw new Error(`${errorMessage} (${res.status})`)
  }
  return res.json()
}

export async function postJson<T>(
  path: string,
  payload: unknown,
  defaultErrorMessage: string
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    let detail: unknown
    try {
      const body = await res.json()
      detail = body?.detail
    } catch {
      // sin cuerpo JSON en la respuesta de error
    }
    const message = typeof detail === 'string' ? detail : `${defaultErrorMessage} (${res.status})`
    throw new ApiError(res.status, message, detail)
  }

  return res.json()
}
