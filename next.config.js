// Cabeceras de seguridad del frontend. Un escaneo de OWASP ZAP (2026-08-03) las reportó
// ausentes: el backend ya las manda desde su SecurityHeadersMiddleware, pero el Next no mandaba
// ninguna. Eran 8 alertas Medium (CSP y anti-clickjacking) + 32 Low (nosniff).
//
// Los orígenes salen de las MISMAS env vars que usa el cliente, no hardcodeados: así la CSP vale
// igual en local (Supabase en localhost:54321, API en localhost:8000) que en producción, sin
// tener dos listas que se desincronizan.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
// MISMA cadena de fallback que lib/apiClient.ts, localhost:8000 incluido. Si se
// omitiera, en local la CSP reportaría como violación cada llamada al backend, y esos
// falsos positivos taparían los reportes de verdad.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
// Realtime (postgres_changes y presence) va por WebSocket al mismo host de Supabase.
const SUPABASE_WS = SUPABASE_URL.replace(/^http/, 'ws')

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Nadie debe poder embeber estas páginas: el registro pide cédula, teléfono y datos clínicos,
  // y el panel médico muestra casos. Es la versión moderna de X-Frame-Options: DENY.
  "frame-ancestors 'none'",
  // Jitsi se abre en pestaña nueva (window.open), NUNCA embebido — ver lib/jitsi.ts. Por eso
  // no hace falta frame-src para meet.*: si algún día se embebe, esto lo reportará.
  "frame-src 'none'",
  // 'unsafe-inline': Next inyecta el bootstrap y __NEXT_DATA__ como scripts inline. Quitarlo
  // exige nonces por request, que en export estático no hay dónde generar. 'unsafe-eval' solo
  // en dev, que es donde Turbopack/HMR lo necesitan.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  ['connect-src', "'self'", SUPABASE_URL, SUPABASE_WS, API_URL].filter(Boolean).join(' '),
  "form-action 'self'",
  "manifest-src 'self'"
].join('; ')

// Enforced: ninguna de estas rompe nada del funcionamiento actual (verificado contra el sitio).
// La CSP va aparte, en Report-Only, hasta confirmar que no bloquea nada real.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // La videollamada corre en el origen de Jitsi, no en este: negar cámara/micrófono aquí no
  // afecta a las consultas (confirmado: no hay un solo iframe en el repo).
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
  // 1 año y SIN preload a propósito: preload es prácticamente irreversible y se pide aparte,
  // cuando el apex y todos los subdominios estén listos para vivir solo en HTTPS.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Report-Only: NO bloquea, solo reporta en la consola del navegador. Se pasa a
  // Content-Security-Policy a secas cuando se confirme que no aparecen violaciones reales.
  { key: 'Content-Security-Policy-Report-Only', value: csp }
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactStrictMode: true,
  // Quita el `X-Powered-By: Next.js` (6 alertas Low de ZAP: divulga el stack sin dar nada a cambio).
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false
  },
  // Permite aislar el build en otra carpeta (p. ej. NEXT_DIST_DIR=.next-e2e para los tests E2E o
  // previews), y así NO compartir/corromper el `.next` del dev server principal del usuario.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        // Todas las rutas, incluidos los assets de /_next (ZAP marcó esos también).
        source: '/:path*',
        headers: securityHeaders
      },
      {
        // Opening this URL directly downloads the file instead of displaying it
        // (Content-Disposition: attachment). It is still rendered normally by <img>.
        source: '/instruccion-jitsi.png',
        headers: [
          {
            key: 'Content-Disposition',
            value: 'attachment; filename="instruccion-videollamada.png"'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
