// Self-check de la coalescencia de GET /auth/me en lib/consultations.ts.
// Sin framework: compila el módulo con tsc, stubea `fetch` y afirma con `assert`.
//   node scripts/check-profile-coalescing.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// El grafo de imports arrastra lib/supabase, que construye el cliente al cargarse. Valores
// dummy: este check no toca la red — `fetch` va stubeado más abajo.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'check-anon-key'

// Dentro del proyecto a propósito: en /tmp, los `require` transitivos (next/router, vía
// lib/admin) no resuelven contra node_modules.
const out = mkdtempSync(join('node_modules', '.cache', 'coalesce-'))
try {
  // El binario de tsc directo con node: spawnear npx.cmd falla con EINVAL en Windows.
  execFileSync(
    process.execPath,
    [join('node_modules', 'typescript', 'bin', 'tsc'),
     // CommonJS: la salida ESM deja imports sin extensión (`./apiClient`) que Node no resuelve.
     'lib/consultations.ts', '--outDir', out, '--module', 'commonjs',
     '--moduleResolution', 'node', '--target', 'es2020',
     '--esModuleInterop', '--skipLibCheck'],
    { stdio: 'inherit' }
  )

  let calls = 0
  let respond = () => ({ ok: true, json: async () => ({ id: 'u1', full_name: 'Doc' }) })
  globalThis.fetch = async () => {
    calls++
    return respond()
  }

  const { fetchMyProfile } = await import(pathToFileURL(join(out, 'consultations.js')).href)

  // 1) La ráfaga del montaje (page + PresenceProvider ×2) se colapsa en UNA sola request.
  calls = 0
  const burst = await Promise.all([
    fetchMyProfile('tok-A'),
    fetchMyProfile('tok-A'),
    fetchMyProfile('tok-A')
  ])
  assert.equal(calls, 1, `3 llamadas concurrentes debían ser 1 request, fueron ${calls}`)
  assert.equal(burst[0].id, 'u1')
  assert.equal(burst[2].id, 'u1', 'todos los callers reciben el mismo perfil')

  // 2) Otro token (otra sesión/usuario) NUNCA reusa el resultado anterior.
  calls = 0
  await fetchMyProfile('tok-B')
  assert.equal(calls, 1, 'un token distinto debe salir a la red')

  // 3) Un fallo no se cachea: el siguiente caller reintenta de verdad.
  respond = () => ({ ok: false, status: 500, json: async () => ({ detail: 'boom' }) })
  await assert.rejects(() => fetchMyProfile('tok-C'))
  respond = () => ({ ok: true, json: async () => ({ id: 'u3', full_name: 'Doc3' }) })
  calls = 0
  const retried = await fetchMyProfile('tok-C')
  assert.equal(calls, 1, 'tras un error, el reintento debe salir a la red')
  assert.equal(retried.id, 'u3')

  console.log('OK — coalescencia de /auth/me: ráfaga colapsada, token aislado, error no cacheado.')
} finally {
  rmSync(out, { recursive: true, force: true })
}
