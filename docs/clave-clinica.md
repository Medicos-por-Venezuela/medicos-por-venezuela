# Clave de descifrado (cifrado E2E de la dirección del paciente)

La dirección de residencia se cifra **en el navegador** con una clave pública (X25519 sealed
box). El servidor guarda y entrega solo el texto cifrado `v1:<base64>`; **ni la API ni la base
de datos pueden leerla**. La clave privada vive envuelta (PBKDF2-SHA256 600k + AES-256-GCM,
WebCrypto nativo) y se desbloquea con la **clave de descifrado**, que nunca sale del navegador.

Contrato técnico completo: `api-medicos-por-venezuela/tasks/datos-emergencia-y-direccion-cifrada/spec.md`.

## Generar el par de claves

```bash
node scripts/generate-clinical-keypair.mjs
```

Imprime:

- `NEXT_PUBLIC_CLINICAL_PUBLIC_KEY` — clave pública (puede ser pública).
- `NEXT_PUBLIC_WRAPPED_CLINICAL_KEY` — clave privada envuelta (puede ser pública: sin la clave
  de descifrado no sirve).
- `E2E_CLINICAL_KEY` — la clave de descifrado. **No se guarda en el repo, ni en el bundle, ni en
  la base.** El script la genera sin acentos; el navegador la compara ignorando acentos y
  espacios sobrantes (normaliza a NFD), así que teclearla con un acento distinto no bloquea.

## Custodia (obligatorio antes de usar en producción)

- La clave de descifrado se guarda en el gestor de contraseñas de la organización y en una copia
  sellada física, en manos de la responsable de protección de datos (Oriana) + 2 responsables.
- **Si se pierde, las direcciones cifradas son irrecuperables.** No hay escrow, recuperación ni
  soporte posible. Es el precio del cifrado E2E.
- Se comparte con los médicos por un canal privado cuando se les da acceso; se teclea una vez
  por pestaña (se cachea en `sessionStorage` y muere al cerrar la pestaña).

## Configurar los entornos

- Local / e2e: `.env` (gitignored) trae una clave **de desarrollo** para probar; no se usa en
  producción y **no se escribe en este documento ni en el repo**. Pídesela a quien la custodie o
  genérala con el script. Sin las variables, el registro bloquea el envío con un aviso claro
  (nunca guarda la dirección en claro).
- Producción (Amplify): las dos variables en el entorno de build. Son `NEXT_PUBLIC_` porque el
  navegador las necesita; la envuelta sin la clave no sirve, por eso pueden vivir ahí.
- Backend: `ADDRESS_VIEWER_EMAILS` (coma-separado, default `orianaramirez@gmail.com`) decide a
  quién se le entrega la ciphertext además del médico tratante. La clave real es la de descifrado.

## Rotación (resumen)

1. Generar par nuevo con el script.
2. Con la clave vieja aún desbloqueada, descifrar y volver a cifrar las filas con prefijo `v1:`
   (herramienta cliente; no existe todavía: es trabajo pendiente).
3. Cambiar las envs y la clave en custodia. Las filas quedan en `v2:` y las viejas pueden quedar
   ilegibles si no se migraron.
4. Un médico que sale de la organización obliga a rotar (él conoce la clave actual).

## Qué NO hace el servidor (por diseño)

- No descifra, no valida el contenido, no busca por dirección y no la incluye en reportes,
  correos ni logs. Solo `GET /patients/{id}/address` entrega la ciphertext, gateado al médico
  tratante y a la allowlist, y auditado en `audit_log` (`patient.address_revealed`).
