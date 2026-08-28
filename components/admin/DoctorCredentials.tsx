// Tabla de credenciales médicas del panel admin: quién puede atender, quién no y por qué.
//
// El backend gatea el acceso de los médicos por su credencial (ficha en `doctors` verificada,
// activa y con cédula + licencia). Hasta ahora el admin no tenía forma de verlo ni de aprobar a
// nadie desde la UI. Esta tabla consume GET /doctors (filtros + motivo de bloqueo) y
// POST /doctors/{id}/approve · /revoke-approval.
//
// La distinción que importa y que la tabla hace explícita: **aprobado != habilitado**. Una ficha
// puede estar aprobada (`verified`) y aun así no atender por faltarle la cédula. Por eso el botón
// de aprobar solo se ofrece cuando aprobar realmente desbloquea (`blocked_reason === 'no_verificado'`);
// en los demás casos el backend responde 422 y aquí se dice qué hay que pedirle al médico.
import { useEffect, useState } from 'react'
import { getAccessToken, fmtDate } from '../../lib/admin'
import {
  approveDoctor,
  fetchAdminDoctors,
  fetchDoctorCredentialSummary,
  revokeDoctorApproval,
  type DoctorAdminItem,
  type DoctorBlockedReason,
  type DoctorCredentialSummary
} from '../../lib/doctors'
import { ApiError } from '../../lib/apiClient'
import ConfirmDialog from './ConfirmDialog'

const PAGE_SIZE = 25

// Qué le falta a cada médico, en el lenguaje de la acción que el admin tiene que tomar.
const BLOCKED_LABELS: Record<DoctorBlockedReason, string> = {
  sin_ficha: 'Nunca registró su cédula',
  de_baja: 'Ficha de baja o expulsada',
  sin_cedula: 'Falta la cédula',
  sin_licencia: 'Falta la licencia',
  no_verificado: 'Credencial sin aprobar'
}

// Qué hacer con cada motivo. Solo 'no_verificado' se resuelve desde aquí.
const BLOCKED_HINTS: Record<DoctorBlockedReason, string> = {
  sin_ficha: 'Pídele que complete su registro (cédula y tipo de profesional).',
  de_baja: 'Reactiva la ficha antes de aprobarla.',
  sin_cedula: 'Pídele su cédula: aprobar sin ella no lo habilita.',
  sin_licencia: 'Pídele su número de licencia: aprobar sin ella no lo habilita.',
  no_verificado: 'El SACS/FPV no lo validó. Puedes aprobarlo tú.'
}

// Opciones del filtro por motivo, en el orden en que le sirven al admin: primero lo que puede
// resolver él, después lo que depende del médico.
const REASON_OPTIONS: { value: DoctorBlockedReason; label: string }[] = [
  { value: 'no_verificado', label: 'Listos para aprobar' },
  { value: 'sin_cedula', label: 'Les falta la cédula' },
  { value: 'sin_licencia', label: 'Les falta la licencia' },
  { value: 'sin_ficha', label: 'Nunca completaron su registro' },
  { value: 'de_baja', label: 'De baja o expulsados' }
]

type Pending = { doctor: DoctorAdminItem; action: 'approve' | 'revoke' }

export default function DoctorCredentials() {
  const [rows, setRows] = useState<DoctorAdminItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Los filtros resetean la página en su propio onChange (no en un efecto): si no, cambiar de
  // filtro dejaría el offset de la página anterior y la tabla saldría vacía.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [approval, setApproval] = useState('all') // all | approved | pending
  const [practice, setPractice] = useState('all') // all | enabled | blocked
  const [reason, setReason] = useState<DoctorBlockedReason | ''>('')
  const [summary, setSummary] = useState<DoctorCredentialSummary | null>(null)

  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)

  // Un fetch por tecleo sería una consulta por pulsación sobre ~3000 filas.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, approval, practice, reason, page])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const token = await getAccessToken()
      const [{ items, total: count }, counts] = await Promise.all([
        fetchAdminDoctors(
          {
            search: debouncedSearch || undefined,
            verified: approval === 'all' ? undefined : approval === 'approved',
            can_practice: practice === 'all' ? undefined : practice === 'enabled',
            blocked_reason: reason || undefined,
            skip: page * PAGE_SIZE,
            limit: PAGE_SIZE
          },
          token
        ),
        fetchDoctorCredentialSummary(token)
      ])
      setRows(items)
      setTotal(count)
      setSummary(counts)
    } catch (e) {
      console.error(e)
      setError('No se pudieron cargar los médicos.')
    }
    setLoading(false)
  }

  async function confirmPending() {
    if (!pending?.doctor.id) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const token = await getAccessToken()
      if (pending.action === 'approve') {
        await approveDoctor(pending.doctor.id, token)
        setMessage(`${pending.doctor.full_name} ya puede atender.`)
      } else {
        await revokeDoctorApproval(pending.doctor.id, token)
        setMessage(`Se revocó la aprobación de ${pending.doctor.full_name}.`)
      }
      setPending(null)
      await load()
    } catch (e) {
      // El 422 del backend explica exactamente qué le falta a la ficha: mostrarlo tal cual es
      // más útil que un "no se pudo" genérico.
      setError(e instanceof ApiError ? e.message : 'No se pudo completar la acción.')
      setPending(null)
    }
    setBusy(false)
  }

  // Los contadores son atajos al filtro: al pulsarlos se limpian los otros dos selectores para
  // que el número de la cabecera y el `total` de la tabla no puedan discrepar.
  function applyReason(value: DoctorBlockedReason | '') {
    setReason(value)
    setApproval('all')
    setPractice('all')
    setPage(0)
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2 style={{ marginTop: 0 }}>
        Credenciales para atender{' '}
        <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>({total})</span>
      </h2>
      <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>
        Un médico solo puede atender si su ficha está aprobada <strong>y</strong> tiene cédula y
        licencia. Aprobar no basta cuando falta alguno de esos datos: ahí hay que pedírselos.
      </p>

      {/* Contadores por estado: sin esto la cola de aprobación es invisible — los aprobables son
          una minoría diminuta y no aparecen en la primera página del listado sin filtrar. Cada
          contador aplica su filtro. */}
      {summary && (
        <div className="tag-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`tag${reason === '' ? ' selected' : ''}`}
            onClick={() => applyReason('')}
          >
            {summary.can_practice} pueden atender · {summary.total} en total
          </button>
          {REASON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`tag${reason === opt.value ? ' selected' : ''}`}
              onClick={() => applyReason(opt.value)}
              aria-pressed={reason === opt.value}
            >
              {summary[opt.value]} {opt.label.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {message && (
        <div className="notice notice-info" style={{ marginBottom: 12 }}>
          {message}
        </div>
      )}
      {error && (
        <div className="notice notice-warning" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <input
          style={{ flex: '1 1 180px' }}
          placeholder="Buscar nombre, cédula o email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        <select
          style={{ flex: '0 1 170px' }}
          value={approval}
          onChange={(e) => {
            setApproval(e.target.value)
            setPage(0)
          }}
          aria-label="Filtrar por aprobación"
        >
          <option value="all">Aprobados y no aprobados</option>
          <option value="approved">Solo aprobados</option>
          <option value="pending">Solo no aprobados</option>
        </select>
        <select
          style={{ flex: '0 1 190px' }}
          value={practice}
          onChange={(e) => {
            setPractice(e.target.value)
            setPage(0)
          }}
          aria-label="Filtrar por habilitación para atender"
        >
          <option value="all">Habilitados y bloqueados</option>
          <option value="enabled">Solo habilitados</option>
          <option value="blocked">Solo bloqueados</option>
        </select>
        <select
          style={{ flex: '0 1 220px' }}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value as DoctorBlockedReason | '')
            setPage(0)
          }}
          aria-label="Filtrar por motivo de bloqueo"
        >
          <option value="">Todos los motivos</option>
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {/* La clase extra ancla los specs E2E: la página tiene otra tabla (cuentas). */}
        <table className="table doctor-credentials-table">
          <thead>
            <tr>
              <th>Médico</th>
              <th>Credencial</th>
              <th>Puede atender</th>
              <th>Registrado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: '#64748b' }}>
                  {loading ? 'Cargando...' : 'No hay médicos que coincidan con el filtro.'}
                </td>
              </tr>
            ) : (
              rows.map((d) => {
                const canApprove = d.id != null && d.blocked_reason === 'no_verificado'
                return (
                  <tr key={d.user_id ?? d.id}>
                    <td>
                      <strong>{d.full_name}</strong>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{d.email || '—'}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        Cédula: {d.cedula || '—'} · Licencia: {d.license || '—'}
                      </div>
                    </td>
                    <td>
                      {d.verified ? (
                        <span className="badge badge-green">Aprobada</span>
                      ) : (
                        <span className="badge badge-orange">Sin aprobar</span>
                      )}
                    </td>
                    <td>
                      {d.can_practice ? (
                        <span className="badge badge-green">Sí</span>
                      ) : (
                        <>
                          <span className="badge badge-red">No</span>
                          {d.blocked_reason && (
                            <div style={{ fontSize: 12, marginTop: 4 }}>
                              {/* El motivo va en su propio elemento (no como nodo de texto suelto
                                  junto a la pista): así se puede localizar sin ambigüedad. */}
                              <span style={{ color: '#64748b' }}>
                                {BLOCKED_LABELS[d.blocked_reason]}
                              </span>
                              <div style={{ color: '#94a3b8' }}>
                                {BLOCKED_HINTS[d.blocked_reason]}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>{fmtDate(d.created_at)}</td>
                    <td>
                      {canApprove && (
                        <button
                          className="btn btn-primary"
                          onClick={() => setPending({ doctor: d, action: 'approve' })}
                        >
                          Aprobar
                        </button>
                      )}
                      {d.id != null && d.verified && (
                        <button
                          className="btn btn-muted"
                          onClick={() => setPending({ doctor: d, action: 'revoke' })}
                        >
                          Revocar aprobación
                        </button>
                      )}
                      {!canApprove && !d.verified && (
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginTop: 12,
          flexWrap: 'wrap'
        }}
      >
        <span style={{ color: '#64748b', fontSize: 13 }}>
          {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-muted"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <button
            className="btn btn-muted"
            disabled={(page + 1) * PAGE_SIZE >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === 'approve' ? 'Aprobar credencial' : 'Revocar aprobación'}
        message={
          pending?.action === 'approve' ? (
            <p>
              <strong>{pending?.doctor.full_name}</strong> podrá atender pacientes aunque el
              registro oficial (SACS/FPV) no haya validado su cédula. Queda registrado que fuiste tú
              quien lo aprobó.
            </p>
          ) : (
            <p>
              <strong>{pending?.doctor.full_name}</strong> dejará de poder atender pacientes de
              inmediato.
            </p>
          )
        }
        confirmLabel={pending?.action === 'approve' ? 'Aprobar' : 'Revocar'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
        busy={busy}
        danger={pending?.action === 'revoke'}
      />
    </section>
  )
}
