// Elegir a qué especialidad derivar un paciente. Lo usan la cola del panel médico (derivar un caso
// sin tomarlo) y el detalle de la consulta (derivar con especialista: después vienen el motivo y la
// firma). Solo lista especialidades con médicos atendiendo su cola (`GET
// /consultations/derivation-targets`): derivar a una cola que nadie mira dejaría al paciente
// esperando para siempre.
//
// Mismo marco que ConfirmDialog (Escape cierra, el foco entra al abrir); no es ConfirmDialog porque
// además de confirmar hay que elegir de una lista.
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { getAccessToken } from '../lib/admin'
import { fetchDerivationTargets, type DerivationTarget } from '../lib/consultations'
import { useEscapeToClose } from '../lib/hooks'

function normalizar(texto: string): string {
  // Sin tildes: NFD separa cada letra de su acento, y los acentos son el bloque U+0300 a U+036F.
  return Array.from(texto.normalize('NFD'))
    .filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f)
    .join('')
    .toLowerCase()
}

export default function DerivarEspecialidadModal({
  open,
  currentSpecialty,
  title = 'Derivar a especialista',
  hint,
  confirmLabel = 'Derivar',
  onClose,
  onPick
}: {
  open: boolean
  // Nombre de la especialidad actual del caso: no se ofrece como destino.
  currentSpecialty?: string | null
  title?: string
  hint?: string
  confirmLabel?: string
  onClose: () => void
  onPick: (target: DerivationTarget) => void
}) {
  const titleId = useId()
  const [targets, setTargets] = useState<DerivationTarget[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string>('')
  // El modal sigue montado cerrado: la búsqueda y la selección se limpian al salir, no al abrir.
  const close = useCallback(() => {
    setSearch('')
    setSelected('')
    onClose()
  }, [onClose])
  useEscapeToClose(open, close)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchDerivationTargets(await getAccessToken())
        if (!cancelled) {
          setTargets(list)
          setLoadError('')
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'No se pudieron cargar las especialidades.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const visibles = useMemo(() => {
    const q = normalizar(search.trim())
    return (targets || []).filter(
      (t) =>
        normalizar(t.name) !== normalizar(currentSpecialty || '') &&
        (!q || normalizar(t.name).includes(q))
    )
  }, [targets, search, currentSpecialty])

  if (!open) return null

  const elegida = (targets || []).find((t) => t.id === selected) || null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={close}
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
        style={{
          maxWidth: 480,
          width: '100%',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <h2 id={titleId} style={{ marginTop: 0 }}>
          {title}
        </h2>
        {hint && <p style={{ color: '#64748b', fontSize: 14, marginTop: -6 }}>{hint}</p>}
        <label className="label" htmlFor={`${titleId}-buscar`}>
          Especialidad
        </label>
        <input
          id={`${titleId}-buscar`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar especialidad…"
          autoFocus
          style={{ width: '100%', marginBottom: 10 }}
        />

        <div
          role="radiogroup"
          aria-label="Especialidades disponibles"
          style={{ overflowY: 'auto', flex: 1, minHeight: 120, maxHeight: 320 }}
        >
          {loadError ? (
            <p className="notice notice-danger">{loadError}</p>
          ) : targets === null ? (
            <p style={{ color: '#64748b' }}>Cargando especialidades…</p>
          ) : visibles.length === 0 ? (
            <p style={{ color: '#64748b' }}>No hay especialidades que coincidan.</p>
          ) : (
            visibles.map((t) => (
              <label
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: `1px solid ${selected === t.id ? 'var(--brand)' : 'var(--border)'}`,
                  background: selected === t.id ? 'var(--brand-light)' : 'white',
                  marginBottom: 6
                }}
              >
                <input
                  type="radio"
                  name={`${titleId}-especialidad`}
                  value={t.id}
                  checked={selected === t.id}
                  onChange={() => setSelected(t.id)}
                  style={{ width: 'auto', margin: 0 }}
                />
                {t.name}
              </label>
            ))
          )}
        </div>

        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <button
            className="btn btn-primary btn-full"
            disabled={!elegida}
            onClick={() => {
              if (!elegida) return
              setSearch('')
              setSelected('')
              onPick(elegida)
            }}
          >
            {confirmLabel}
          </button>
          <button className="btn btn-muted" onClick={close}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
