// Modal de solo lectura para el KPI "Consultas en progreso" del dashboard admin: lista las
// consultas del set amplio "en progreso" (lib/admin.ts::IN_PROGRESS_STATUSES) con su médico
// asignado, paciente y tiempo transcurrido. Datos vía backend (lib/consultations.ts), NO
// Supabase directo. Sin acciones (no cambia estado, no reasigna) — ver spec `admin-consultations-
// monitor`. Reusa el patrón de overlay inline role="dialog" de components/DoctorPoolModal.tsx /
// components/admin/ConfirmDialog.tsx.
//
// El listener de Escape usa `useMountEffect` (no un useEffect crudo — ver el skill
// no-use-effect) para suscribirse al DOM: es "true mount-time external system sync" (Regla 4).
// Para que solo esté activo mientras el modal está realmente abierto (y no perseguir el `open`
// prop con un ref-guard, lo que violaría la Regla 6), el listener vive en un sub-componente
// (`Dialog`) que el padre monta/desmonta condicionalmente según `open` — así el mount real
// coincide con la apertura del modal.
import { useMountEffect } from '../../lib/hooks'
import { ConsultationMonitorItem } from '../../lib/consultations'
import { STATUS_LABELS, minutesSince } from '../../lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  items: ConsultationMonitorItem[]
  loading: boolean
  error: string
}

export default function ConsultationsMonitorModal({ open, onClose, items, loading, error }: Props) {
  if (!open) return null
  return <Dialog onClose={onClose} items={items} loading={loading} error={error} />
}

function Dialog({
  onClose,
  items,
  loading,
  error
}: {
  onClose: () => void
  items: ConsultationMonitorItem[]
  loading: boolean
  error: string
}) {
  useMountEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="monitor-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 900, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div>
            <h2 id="monitor-title" style={{ margin: 0 }}>
              Consultas en progreso
            </h2>
            <small style={{ color: '#64748b' }}>
              Incluye derivadas, urgentes presenciales, no-show, canceladas y contactadas por
              WhatsApp.
            </small>
          </div>
          <button
            className="btn btn-muted"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ padding: '4px 12px' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="notice notice-danger" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Médico asignado</th>
                <th>Paciente</th>
                <th>Tiempo en progreso</th>
                <th>Motivo de consulta</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ color: '#64748b' }}>
                    Cargando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: '#64748b' }}>
                    No hay consultas en progreso.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id}>
                    <td>{STATUS_LABELS[c.status] || c.status}</td>
                    <td>{c.assigned_doctor_name || '— sin asignar —'}</td>
                    <td>{c.patient_name || '—'}</td>
                    <td>{minutesSince(c.opened_at || c.started_at || c.queued_at)} min</td>
                    <td>{c.chief_complaint || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
