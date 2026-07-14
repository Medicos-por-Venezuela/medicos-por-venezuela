import { defineConfig } from '@playwright/test'

// E2E del panel médico contra el stack local (frontend + backend + Supabase local). Levanta el
// dev server en 3100 (o reusa uno ya corriendo). globalSetup siembra los médicos de prueba.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  // Serial: los specs comparten la misma BD local y los mismos médicos de prueba; en paralelo se
  // pisarían los datos (cola de consultas, claims). Un solo worker evita la colisión.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    // Chromium bloquea las peticiones autenticadas loopback→loopback (localhost:3100 → :8000) por
    // Private Network Access, exigiendo un header que el backend no envía. Solo pasa en el navegador
    // de test (el Chrome real del dev no fuerza PNA); no afecta al backend ni a producción.
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights'
      ]
    }
  },
  webServer: {
    command: 'pnpm dev --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
    // Build aislado: los E2E NO comparten el `.next` con el dev server principal (evita que dos
    // `next dev` sobre el mismo directorio se corrompan el build entre sí → 500 en todo).
    env: { NEXT_DIST_DIR: '.next-e2e' }
  }
})
