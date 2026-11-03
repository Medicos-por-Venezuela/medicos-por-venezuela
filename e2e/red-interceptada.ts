// Piezas compartidas por los specs de registro que interceptan TODA la red con page.route (nunca
// envían el formulario de verdad: el alta manda correos reales desde el backend local).
import type { Route } from '@playwright/test'

export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }

export function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS,
    body: JSON.stringify(body)
  })
}

// JWT con forma válida (supabase-js lee `exp` y no comprueba la firma).
export function fakeJwt(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-e2e', exp, role: 'authenticated' })}.firma`
}

// Sesión de Supabase Auth para `email`.
export const sesionDe = (email: string) => ({
  access_token: fakeJwt(),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'refresh-e2e',
  user: {
    id: 'u-e2e',
    aud: 'authenticated',
    email,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString()
  }
})
