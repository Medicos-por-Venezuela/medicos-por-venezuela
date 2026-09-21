// Cifrado E2E de la dirección del paciente (contrato v1; spec en el repo de la API:
// tasks/datos-emergencia-y-direccion-cifrada/spec.md).
//
// - La dirección se cifra en el NAVEGADOR con la clave PÚBLICA clínica (sealed box X25519,
//   libsodium): la API solo almacena y entrega el texto cifrado ("v1:<base64>"), nunca puede
//   leerlo.
// - La clave PRIVADA llega envuelta con una passphrase (PBKDF2-SHA256 + AES-256-GCM, WebCrypto
//   nativo) y solo se abre en el navegador. La passphrase jamás se envía al servidor.
// - Las dos envs son NEXT_PUBLIC_ a propósito: la pública es pública y la envuelta sin la
//   passphrase no sirve. La passphrase NO vive en el repo ni en el bundle.
//
// PBKDF2 y no Argon2id: `libsodium-wrappers@0.8.4` no expone `crypto_pwhash` (el build real no
// lo trae, aunque sus tipos lo declaren), y la passphrase es aleatoria de 144 bits, así que el
// costo del KDF no es la barrera principal. WebCrypto es nativo y no agrega dependencias.
import type * as SodiumNS from 'libsodium-wrappers'

const PUBLIC_KEY_B64 = process.env.NEXT_PUBLIC_CLINICAL_PUBLIC_KEY || ''
const WRAPPED_KEY = process.env.NEXT_PUBLIC_WRAPPED_CLINICAL_KEY || ''

// 600.000 iteraciones: recomendación OWASP 2023 para PBKDF2-SHA256.
const PBKDF2_ITERATIONS = 600_000

// sessionStorage: sobrevive a un refresh dentro de la misma pestaña y muere al cerrarla.
const SESSION_STORAGE_KEY = 'mpv_clinical_private_key_v1'

let cachedPrivateKey: Uint8Array | null = null

async function getSodium(): Promise<typeof SodiumNS> {
  const mod = await import('libsodium-wrappers')
  // Interop CJS/ESM: el objeto real puede venir en `default` (bundlers) o como namespace.
  const sodium = ((mod as unknown as { default?: typeof SodiumNS }).default ??
    mod) as typeof SodiumNS
  await sodium.ready
  return sodium
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function currentPrivateKey(): Uint8Array | null {
  if (cachedPrivateKey) return cachedPrivateKey
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      cachedPrivateKey = base64ToBytes(stored)
      return cachedPrivateKey
    }
  } catch {
    // sessionStorage bloqueado (modo privado estricto): se sigue sin caché.
  }
  return null
}

async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
}

/** ¿El entorno tiene configuradas las claves? Sin esto el registro no puede cifrar. */
export function clinicalKeyConfigured(): boolean {
  return PUBLIC_KEY_B64.length > 0 && WRAPPED_KEY.startsWith('v1:')
}

/** ¿La clave privada está desbloqueada en esta pestaña? */
export function isClinicalKeyUnlocked(): boolean {
  return currentPrivateKey() !== null
}

/** Cierra la clave en memoria y en la pestaña. */
export function lockClinicalKey(): void {
  cachedPrivateKey = null
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // sin caché no hay nada que limpiar
  }
}

/**
 * Abre la clave privada con la passphrase y la deja disponible en esta pestaña.
 * Lanza un Error con mensaje legible si la passphrase es incorrecta o el entorno no está
 * configurado; nunca envía nada por la red.
 */
export async function unlockClinicalKey(passphrase: string): Promise<void> {
  if (!clinicalKeyConfigured()) {
    throw new Error('La clave clínica no está configurada en este entorno.')
  }
  const [version, saltB64, ivB64, ciphertextB64] = WRAPPED_KEY.split(':')
  if (version !== 'v1' || !saltB64 || !ivB64 || !ciphertextB64) {
    throw new Error('La clave clínica está mal formada.')
  }

  const wrappingKey = await deriveWrappingKey(passphrase, base64ToBytes(saltB64))
  let privateKey: Uint8Array
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(ivB64) },
      wrappingKey,
      base64ToBytes(ciphertextB64)
    )
    privateKey = new Uint8Array(plain)
  } catch {
    throw new Error('Passphrase incorrecta.')
  }

  // Verificación fuerte: la pública derivada de la privada debe ser la configurada. Si no,
  // la clave es de otro entorno (p. ej. la de desarrollo) y descifraría basura.
  const sodium = await getSodium()
  const expected = base64ToBytes(PUBLIC_KEY_B64)
  const derivedPublic = sodium.crypto_scalarmult_base(privateKey)
  if (
    derivedPublic.length !== expected.length ||
    !derivedPublic.every((byte, index) => byte === expected[index])
  ) {
    throw new Error('La passphrase no corresponde a la clave de este entorno.')
  }

  cachedPrivateKey = privateKey
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, bytesToBase64(privateKey))
  } catch {
    // sin caché, la clave vive solo en memoria hasta el próximo refresh
  }
}

/**
 * Cifra la dirección para guardarla en la base. Devuelve `v1:<base64>`.
 * Se puede cifrar sin desbloquear la clave (solo usa la pública).
 */
export async function encryptAddress(address: string): Promise<string> {
  if (!clinicalKeyConfigured()) {
    throw new Error(
      'La dirección no se puede cifrar: falta configurar la clave clínica del entorno.'
    )
  }
  const sodium = await getSodium()
  const sealed = sodium.crypto_box_seal(
    new TextEncoder().encode(address),
    base64ToBytes(PUBLIC_KEY_B64)
  )
  return `v1:${bytesToBase64(sealed)}`
}

/**
 * Descifra una dirección. Devuelve `null` si la clave está bloqueada (la UI debe pedir la
 * passphrase) y lanza si la ciphertext no es del formato v1 o no fue cifrada para esta clave.
 */
export async function decryptAddress(ciphertext: string): Promise<string | null> {
  const privateKey = currentPrivateKey()
  if (!privateKey) return null
  const [version, sealedB64] = ciphertext.split(':')
  if (version !== 'v1' || !sealedB64) {
    throw new Error('La dirección guardada tiene un formato desconocido.')
  }
  const sodium = await getSodium()
  try {
    const plain = sodium.crypto_box_seal_open(
      base64ToBytes(sealedB64),
      base64ToBytes(PUBLIC_KEY_B64),
      privateKey
    )
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('No se pudo descifrar la dirección con la clave de este entorno.')
  }
}
