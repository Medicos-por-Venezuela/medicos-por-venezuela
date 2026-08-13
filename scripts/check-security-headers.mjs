// Self-check de las cabeceras de seguridad de next.config.js.
// Sin framework: carga el config real y afirma sobre lo que devuelve headers().
//   node scripts/check-security-headers.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Mismos valores que en prod, para comprobar que los orígenes entran en connect-src.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co'
process.env.NEXT_PUBLIC_API_URL = 'https://api.medicosporvenezuela.org'

const require = createRequire(import.meta.url)
const cfg = require('../next.config.js')

assert.equal(cfg.poweredByHeader, false, 'poweredByHeader debe estar desactivado (X-Powered-By)')

const rules = await cfg.headers()
const global = rules.find((r) => r.source === '/:path*')
assert.ok(global, 'debe haber una regla que cubra todas las rutas')

const h = Object.fromEntries(global.headers.map((x) => [x.key, x.value]))

// Las enforced que cierran las alertas de ZAP.
assert.equal(h['X-Frame-Options'], 'DENY')
assert.equal(h['X-Content-Type-Options'], 'nosniff')
assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin')
assert.match(h['Strict-Transport-Security'], /max-age=\d+/)
// preload es casi irreversible: no debe colarse sin decisión explícita.
assert.ok(!/preload/.test(h['Strict-Transport-Security']), 'HSTS no debe llevar preload todavía')

// La CSP va SOLO en Report-Only: si alguna vez se activa de verdad, que sea a propósito.
assert.ok(h['Content-Security-Policy-Report-Only'], 'la CSP debe estar en Report-Only')
assert.ok(!h['Content-Security-Policy'], 'la CSP no debe estar en modo bloqueante todavía')

const csp = h['Content-Security-Policy-Report-Only']
// Los orígenes que la app usa de verdad tienen que estar permitidos, o al desbloquear
// la CSP se romperían los datos (backend) y el tiempo real (WebSocket de Supabase).
assert.match(
  csp,
  /connect-src[^;]*https:\/\/proyecto\.supabase\.co/,
  'falta Supabase en connect-src'
)
assert.match(
  csp,
  /connect-src[^;]*wss:\/\/proyecto\.supabase\.co/,
  'falta el WebSocket de Realtime'
)
assert.match(
  csp,
  /connect-src[^;]*https:\/\/api\.medicosporvenezuela\.org/,
  'falta la API en connect-src'
)
assert.match(csp, /frame-ancestors 'none'/, 'falta el anti-clickjacking moderno')
// Next inyecta scripts inline; sin esto la CSP bloquearía el arranque de la propia app.
assert.match(csp, /script-src[^;]*'unsafe-inline'/)
assert.ok(!csp.includes('undefined'), 'ningún origen debe quedar como "undefined"')
assert.ok(!/;\s*;/.test(csp), 'no debe haber directivas vacías')

// Con env vars ausentes (build mal configurado) la CSP debe seguir siendo válida, no rota.
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.NEXT_PUBLIC_API_URL
delete require.cache[require.resolve('../next.config.js')]
const bare = await require('../next.config.js').headers()
const bareCsp = Object.fromEntries(
  bare.find((r) => r.source === '/:path*').headers.map((x) => [x.key, x.value])
)['Content-Security-Policy-Report-Only']
assert.match(
  bareCsp,
  /connect-src 'self'/,
  "sin env vars, connect-src debe quedar en 'self' limpio"
)
assert.ok(!bareCsp.includes('undefined'))

console.log('OK — cabeceras: enforced correctas, CSP en Report-Only, orígenes reales permitidos.')
