#!/usr/bin/env node
// Genera el par de claves clínico y la clave de descifrado del cifrado E2E de direcciones.
//
// Uso:  node scripts/generate-clinical-keypair.mjs
//
// Imprime las dos variables NEXT_PUBLIC_ (van al entorno; la pública es pública y la envuelta
// sin la clave de descifrado no sirve) y la clave de descifrado, que NO se guarda en ningún
// lado y hay que custodiar. Si la clave se pierde, las direcciones cifradas son irrecuperables:
// ver docs/clave-clinica.md.
import sodium from 'libsodium-wrappers'

await sodium.ready

const PBKDF2_ITERATIONS = 600_000
const b64 = (bytes) => Buffer.from(bytes).toString('base64')

// La clave se compara sin acentos en el navegador (normalizeClave): se envuelve con la misma
// normalización para que una clave tecleada con acentos distintos siga abriendo.
const normalizeClave = (value) =>
  value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const keypair = sodium.crypto_box_keypair()
const passphrase = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString('base64url')
const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))

const material = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(normalizeClave(passphrase)),
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
console.log(`E2E_CLINICAL_KEY=${passphrase}`)
console.log('')
console.log('Guarda la clave de descifrado en custodia (gestor de contraseñas + copia sellada).')
console.log('NO la commitees. Si se pierde, las direcciones son irrecuperables.')
