#!/usr/bin/env node
// Genera el par de claves clínico y la passphrase del cifrado E2E de direcciones.
//
// Uso:  node scripts/generate-clinical-keypair.mjs
//
// Imprime las dos variables NEXT_PUBLIC_ (van al entorno; la pública es pública y la envuelta
// sin la passphrase no sirve) y la passphrase, que NO se guarda en ningún lado y hay que
// custodiar. Si la passphrase se pierde, las direcciones cifradas son irrecuperables: ver
// docs/clave-clinica.md.
import sodium from 'libsodium-wrappers'

await sodium.ready

const PBKDF2_ITERATIONS = 600_000
const b64 = (bytes) => Buffer.from(bytes).toString('base64')

const keypair = sodium.crypto_box_keypair()
const passphrase = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString('base64url')
const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))

const material = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(passphrase),
  'PBKDF2',
  false,
  ['deriveKey']
)
const wrappingKey = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
)
const wrapped = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  wrappingKey,
  keypair.privateKey
)

console.log(`NEXT_PUBLIC_CLINICAL_PUBLIC_KEY=${b64(keypair.publicKey)}`)
console.log(`NEXT_PUBLIC_WRAPPED_CLINICAL_KEY=v1:${b64(salt)}:${b64(iv)}:${b64(wrapped)}`)
console.log('')
console.log(`PASSPHRASE=${passphrase}`)
console.log('')
console.log('Guarda la passphrase en custodia (gestor de contraseñas + copia sellada).')
console.log('NO la commitees. Si se pierde, las direcciones son irrecuperables.')
