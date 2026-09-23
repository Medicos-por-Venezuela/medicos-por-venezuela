// Campos clínicos que el backend oculta: llegan en `null` y la respuesta trae `clinical_access`
// ('summary' | 'none') para decir por qué (contrato en docs/cifrado-datos-clinicos.md del backend).
// Un `null` con acceso restringido NO es "vacío": se pinta el marcador, no un hueco. Sin
// `clinical_access` (backend viejo) o con 'full', el `null` es un vacío de verdad y todo se ve igual
// que antes.
import type { ReactNode } from 'react'
import type { ClinicalAccess } from '../lib/admin'

// El texto dice POR QUÉ no se ve y quién lo ve: un "[confidencial]" pelado, o peor un "Sin
// descripción", hacía pensar a médicos y admins que el caso estaba vacío (y a cerrarlo).
export const CONFIDENTIAL_LABEL = 'Confidencial: solo lo ve el médico que atiende el caso'
// En la cola del panel médico: quien mira PUEDE atender, así que se le dice dónde lo verá.
export const CONFIDENTIAL_QUEUE_LABEL =
  'Motivo confidencial: solo lo ve el médico que atiende al paciente. Si lo atiendes, lo verás al abrir la consulta.'

export function isClinicalRedacted(
  value: string | null | undefined,
  access: ClinicalAccess | undefined
): boolean {
  return value == null && access != null && access !== 'full'
}

export function ConfidentialText({ label = CONFIDENTIAL_LABEL }: { label?: string }) {
  return (
    <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
      <span aria-hidden="true">🔒 </span>
      {label}
    </span>
  )
}

// El valor tal cual, o el marcador si el backend lo ocultó. Devuelve `null` para un vacío real, así
// que `clinicalValue(...) || '—'` y `<Line value={clinicalValue(...)} />` conservan su fallback.
export function clinicalValue(
  value: string | null | undefined,
  access: ClinicalAccess | undefined,
  label?: string
): ReactNode {
  if (isClinicalRedacted(value, access)) return <ConfidentialText label={label} />
  return value ?? null
}
