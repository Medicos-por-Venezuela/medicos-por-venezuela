// Campos clínicos que el backend oculta: llegan en `null` y la respuesta trae `clinical_access`
// ('summary' | 'none') para decir por qué (contrato en docs/cifrado-datos-clinicos.md del backend).
// Un `null` con acceso restringido NO es "vacío": se pinta el marcador, no un hueco. Sin
// `clinical_access` (backend viejo) o con 'full', el `null` es un vacío de verdad y todo se ve igual
// que antes.
import type { ReactNode } from 'react'
import type { ClinicalAccess } from '../lib/admin'

export const CONFIDENTIAL_LABEL = '[Información médica confidencial]'

export function isClinicalRedacted(
  value: string | null | undefined,
  access: ClinicalAccess | undefined
): boolean {
  return value == null && access != null && access !== 'full'
}

export function ConfidentialText() {
  return <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{CONFIDENTIAL_LABEL}</span>
}

// El valor tal cual, o el marcador si el backend lo ocultó. Devuelve `null` para un vacío real, así
// que `clinicalValue(...) || '—'` y `<Line value={clinicalValue(...)} />` conservan su fallback.
export function clinicalValue(
  value: string | null | undefined,
  access: ClinicalAccess | undefined
): ReactNode {
  if (isClinicalRedacted(value, access)) return <ConfidentialText />
  return value ?? null
}
