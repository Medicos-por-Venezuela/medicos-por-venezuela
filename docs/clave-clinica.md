# Clave clínica (cifrado E2E de la dirección del paciente)

La dirección de residencia se cifra **en el navegador** con una clave pública (X25519 sealed
box). El servidor guarda y entrega solo el texto cifrado `v1:<base64>`; **ni la API ni la base
de datos pueden leerla**. La clave privada vive envuelta (PBKDF2-SHA256 600k + AES-256-GCM,
WebCrypto nativo) y se desbloquea con la passphrase, que nunca sale del navegador.

Contrato técnico completo: `api-medicos-por-venezuela/tasks/datos-emergencia-y-direccion-cifrada/spec.md`.

## Generar el par de claves

```bash
node scripts/generate-clinical-keypair.mjs
```

Imprime:

- `NEXT_PUBLIC_CLINICAL_PUBLIC_KEY` — clave pública (puede ser pública).
- `NEXT_PUBLIC_WRAPPED_CLINICAL_KEY` — clave privada envuelta (puede ser pública: sin la
  passphrase no sirve).
- `PASSPHRASE` — secreto real. **No se guarda en el repo, ni en el bundle, ni en la base.**

## Custodia (obligatorio antes de usar en producción)

- La passphrase se guarda en el gestor de contraseñas de la organización y en una copia
  sellada física, en manos de la responsable de protección de datos (Oriana) + 2 responsables.
- **Si se pierde, las direcciones cifradas son irrecuperables.** No hay escrow, recuperación
  ni soporte posible. Es el precio del cifrado E2E.
- Se comparte con los médicos por un canal privado cuando se les da acceso; se teclea una vez
  por pestaña (se cachea en `sessionStorage` y muere al cerrar la pestaña).
- Un médico que sale de la organización obliga a **rotar**: nueva clave (`v2:`), re-cifrado de
  las filas existentes por una persona autorizada y actualización de las dos envs.

## Configurar los entornos

- Local / e2e: pon las dos variables en `.env` (gitignored). Sin ellas el registro bloquea el
  envío con un aviso claro (nunca guarda la dirección en claro).
- Producción (Amplify): las dos variables en el entorno de build. Son `NEXT_PUBLIC_` porque el
  navegador las necesita; la envuelta sin passphrase no sirve, por eso pueden vivir ahí.
- Backend: `ADDRESS_VIEWER_EMAILS` (coma-separado, default `orianaramirez@gmail.com`) decide a
  quién se le entrega la ciphertext además del médico tratante. La clave real es la passphrase.

## Rotación (resumen)

1. Generar par nuevo con el script.
2. Con la clave vieja aún desbloqueada, descifrar y volver a cifrar las filas con prefijo `v1:`
   (herramienta cliente; no existe todavía: es trabajo pendiente).
3. Cambiar las envs y la passphrase en custodia. Las filas quedan en `v2:` y las viejas pueden
   quedar ilegibles si no se migraron.

## Qué NO hace el servidor (por diseño)

- No descifra, no valida el contenido, no busca por dirección y no la incluye en reportes,
  correos ni logs. Solo `GET /patients/{id}/address` entrega la ciphertext, gateado al médico
  tratante y a la allowlist, y auditado en `audit_log` (`patient.address_revealed`).
