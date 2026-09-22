// Modal de solo lectura con la ficha del profesional. Se abre al clickear el nombre en la tabla
// de respuestas de marketing. Patrón de overlay de ConsultationsMonitorModal.tsx.
import { useState, useEffect } from 'react'
import { useMountEffect } from '../../../lib/hooks'
import { getAccessToken } from '../../../lib/admin'
import { fetchDoctor, type DoctorResponse } from '../../../lib/doctors'

export type ProfessionalRow = {
  doctor_id?: string | number | null
  doctor_name?: string | number | null
  specialty?: string | number | null
  professional_type?: string | number | null
  email?: string | number | null
}

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function statusLabel(status: number | null | undefined): string {
  const map: Record<number, string> = { 0: 'De baja', 1: 'Activo', 2: 'Expulsado' }
  if (status === null || status === undefined) return '—'
  return map[status] ?? String(status)
}

function formatDateVE(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('es-VE')
  } catch {
    return dateStr
  }
}

function Dialog({ row, onClose }: { row: ProfessionalRow; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ficha, setFicha] = useState<DoctorResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const token = await getAccessToken()
        const doctorId = String(row.doctor_id ?? '')
        if (!doctorId) {
          setError('No hay ID de médico para cargar la ficha')
          return
        }
        const data = await fetchDoctor(doctorId, token)
        if (!cancelled) setFicha(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudo cargar la ficha del profesional')
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [row.doctor_id])

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
      aria-labelledby="profile-title"
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
        style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16
          }}
        >
          <div>
            <h2 id="profile-title" style={{ margin: 0 }}>
              Ficha del profesional
            </h2>
            <small style={{ color: '#64748b' }}>{dash(row.doctor_name)}</small>
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
          <div className="notice notice-danger" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>
            Cargando ficha...
          </div>
        ) : ficha ? (
          <div style={{ marginTop: 12 }}>
            <table className="table" style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <th style={{ width: '30%', whiteSpace: 'nowrap' }}>Profesional</th>
                  <td>{dash(ficha.full_name)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Cédula</th>
                  <td>{dash(ficha.cedula)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Licencia</th>
                  <td>{dash(ficha.license)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Tipo profesional</th>
                  <td>{dash(row.professional_type)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Especialidad</th>
                  <td>{dash(row.specialty)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Correo</th>
                  <td>{dash(ficha.email ?? row.email)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Teléfono</th>
                  <td>{dash(ficha.phone)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>País de residencia</th>
                  <td>{dash(ficha.country_of_residence)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Estado de la ficha</th>
                  <td>{statusLabel(ficha.status)}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Credencial verificada</th>
                  <td>{ficha.verified ? 'Sí' : 'No'}</td>
                </tr>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Registrado</th>
                  <td>{formatDateVE(ficha.created_at)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>
            No hay datos de ficha para mostrar.
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-muted" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfessionalProfileModal({
  row,
  onClose
}: {
  row: ProfessionalRow | null
  onClose: () => void
}) {
  if (!row) return null
  return <Dialog row={row} onClose={onClose} />
}
