// Modal "Ver Pool de médicos" para la consulta médico-paciente: lista paginada de médicos, con
// buscador por nombre, filtros por especialidad/tipo y tabs En línea / Desconectados / Todos. El
// estado ONLINE lo resuelve Supabase Realtime Presence (cliente); para no romper la paginación, el
// cliente le pasa al backend los user_ids online y el backend filtra IN/NOT IN. El WhatsApp viene
// oculto tras un 👁: al revelarlo se llama a un endpoint que lo registra en audit_log (quién vio el
// número de quién). Reusa el patrón inline role="dialog" del modal de borrado en admin/pacientes.
import { useEffect, useMemo, useState } from 'react'
import { getAccessToken } from '../lib/admin'
import {
  DoctorPoolItem,
  fetchDoctorPool,
  fetchProfessionalTypes,
  fetchSpecialties,
  revealDoctorContact
} from '../lib/doctors'
import { useEscapeToClose } from '../lib/hooks'
import { useOnlineDoctorIds } from '../lib/presence'

const PAGE_SIZE = 20

type Catalog = { id: string; name: string }
type Tab = 'online' | 'offline' | 'todos'
const TAB_LABEL: Record<Tab, string> = {
  online: 'En línea',
  offline: 'Desconectados',
  todos: 'Todos'
}

// Número para el enlace de WhatsApp (https://wa.me/<número>): solo dígitos, sin "+" ni "00"
// de adelante, y con 58 (Venezuela) si no trae prefijo internacional. Además quita el 0
// nacional pegado al 58 ("+58 0414..." es un formato común y wa.me lo rechaza con ese 0).
// Ej: "+584145200715", "04145200715", "+58 04145200715" y "00584145200715" -> "584145200715".
function waNumber(phone: string): string {
  const raw = phone.trim()
  let d = raw.replace(/\D/g, '') // solo dígitos (quita "+", espacios, guiones)
  if (d.startsWith('00')) d = d.slice(2) // prefijo internacional "00" -> ya trae país
  if (d.startsWith('58')) {
    if (d[2] === '0') d = '58' + d.slice(3) // 58 + 0 nacional -> quitar el 0
    return d
  }
  if (raw.startsWith('+') || raw.startsWith('00')) return d // extranjero con su prefijo
  if (d.startsWith('0')) d = d.replace(/^0+/, '') // 0414... nacional -> 414...
  return '58' + d
}

export default function DoctorPoolModal({
  open,
  onClose,
  excludeSelf = true
}: {
  open: boolean
  onClose: () => void
  // true (default, referir): oculta al propio médico. false (dashboard admin): lo incluye, para
  // que el conteo del KPI "Médicos online" (Presence, cuenta al admin-médico) y la lista cuadren.
  excludeSelf?: boolean
}) {
  // Estado online en vivo por Realtime Presence (solo lectura: el modal no anuncia presencia).
  const onlineIds = useOnlineDoctorIds()
  const [tab, setTab] = useState<Tab>('online')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [page, setPage] = useState(0)
  const [items, setItems] = useState<DoctorPoolItem[]>([])
  const [total, setTotal] = useState(0)
  // true inicial: evita el flash de "No hay médicos..." antes del primer fetch.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Aparte del error del fetch de la lista: aquel hace setError('') en cada recarga
  // (tab/filtro/página) y borraría este aviso aunque los dropdowns sigan vacíos.
  const [catalogError, setCatalogError] = useState('')
  const [specialties, setSpecialties] = useState<Catalog[]>([])
  const [types, setTypes] = useState<Catalog[]>([])
  // Teléfonos revelados (bajo auditoría) por doctor id; `undefined` = aún oculto.
  const [revealed, setRevealed] = useState<Record<string, string | null>>({})
  const [revealing, setRevealing] = useState<string | null>(null)

  // Debounce del buscador (no dispara una query por tecla). El reset a página 1 va aquí,
  // junto al set del término: React los batchea y el fetch corre una sola vez.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEscapeToClose(open, onClose)

  // Catálogos para los dropdowns y para mapear id→nombre en la tabla. Se cargan una vez.
  useEffect(() => {
    if (!open || specialties.length || types.length) return
    ;(async () => {
      try {
        const [s, t] = await Promise.all([fetchSpecialties(), fetchProfessionalTypes()])
        setSpecialties(s.map((x) => ({ id: x.id, name: x.name })))
        setTypes(t.map((x) => ({ id: x.id, name: x.name })))
        setCatalogError('') // el reintento (cerrar/reabrir) funcionó: quitar el aviso pegajoso
      } catch {
        // La lista sigue funcionando sin catálogos, pero avisamos que los filtros no cargaron.
        setCatalogError(
          'No se pudieron cargar los catálogos de filtros. Cierra y reabre para reintentar.'
        )
      }
    })()
  }, [open, specialties.length, types.length])

  // El reset a página 1 va en los handlers de tab/filtro (no en un efecto): un efecto
  // dispararía un fetch extra con la página vieja antes de resetear. Para la búsqueda,
  // el reset vive en el efecto del debounce de arriba.

  // Para los tabs En línea/Desconectados, el cliente le pasa al backend los user_ids que Presence
  // sabe online (así el filtro respeta la paginación). Clave estable para las deps del fetch: en
  // "Todos" no depende de la presencia (no re-fetch al cambiar quién está online).
  const onlineParamKey =
    tab === 'todos' ? 'todos' : `${tab}:${Array.from(onlineIds).sort().join(',')}`

  // (Re)carga la página actual cuando el modal está abierto y cambian filtros/tab/búsqueda/página.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const token = await getAccessToken()
        const data = await fetchDoctorPool(
          {
            skip: page * PAGE_SIZE,
            limit: PAGE_SIZE,
            specialty_id: specialtyId || undefined,
            professional_type_id: typeId || undefined,
            search: debouncedSearch || undefined,
            online: tab === 'todos' ? undefined : tab === 'online',
            online_ids: tab === 'todos' ? undefined : Array.from(onlineIds),
            exclude_self: excludeSelf
          },
          token
        )
        if (!cancelled) {
          setItems(data.items)
          setTotal(data.total)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el pool.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, specialtyId, typeId, page, debouncedSearch, tab, onlineParamKey])

  const specName = useMemo(
    () => Object.fromEntries(specialties.map((s) => [s.id, s.name])),
    [specialties]
  )
  const typeName = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t.name])), [types])
  const isOnline = (d: DoctorPoolItem) => !!d.user_id && onlineIds.has(d.user_id)

  // Revela el WhatsApp de un médico: llama al backend (que lo registra en audit_log) y lo muestra.
  async function reveal(doctorId: string) {
    if (revealed[doctorId] !== undefined || revealing) return
    setRevealing(doctorId)
    try {
      const { phone } = await revealDoctorContact(doctorId, await getAccessToken())
      setRevealed((r) => ({ ...r, [doctorId]: phone }))
    } catch {
      // Si falla, el botón queda disponible para reintentar.
    } finally {
      setRevealing(null)
    }
  }

  if (!open) return null

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pool-title"
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
        style={{ maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}
        >
          <h2 id="pool-title" style={{ margin: 0 }}>
            Pool de médicos
          </h2>
          <button
            className="btn btn-muted"
            onClick={onClose}
            aria-label="Cerrar"
            autoFocus
            style={{ padding: '4px 12px' }}
          >
            ✕
          </button>
        </div>

        {/* Tabs En línea / Desconectados / Todos (cambiar de tab resetea a la página 1) */}
        <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setTab(t)
                setPage(0)
              }}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Buscador por nombre */}
        <input
          type="search"
          placeholder="Buscar médico por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />

        {/* Filtros (cambiar un filtro resetea a la página 1) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <select
            style={{ flex: '1 1 200px' }}
            value={specialtyId}
            onChange={(e) => {
              setSpecialtyId(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Todas las especialidades</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            style={{ flex: '1 1 200px' }}
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Todos los tipos de profesional</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {(catalogError || error) && (
          <div className="notice notice-danger" style={{ marginBottom: 12 }}>
            {[catalogError, error].filter(Boolean).join(' ')}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Médico</th>
                <th>Especialidad</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>WhatsApp</th>
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
                    No hay médicos que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                items.map((d) => (
                  <tr key={d.id}>
                    <td>{d.full_name}</td>
                    <td>{(d.specialty_id && specName[d.specialty_id]) || '—'}</td>
                    <td>{(d.professional_type_id && typeName[d.professional_type_id]) || '—'}</td>
                    <td>
                      {isOnline(d) ? (
                        <span className="badge badge-green">● En línea</span>
                      ) : (
                        <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>
                          ○ Desconectado
                        </span>
                      )}
                    </td>
                    <td>
                      {revealed[d.id] !== undefined ? (
                        revealed[d.id] ? (
                          <a
                            href={`https://wa.me/${waNumber(revealed[d.id] as string)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="badge badge-green"
                            style={{ textDecoration: 'none' }}
                          >
                            {revealed[d.id]}
                          </a>
                        ) : (
                          '—'
                        )
                      ) : (
                        <button
                          className="btn btn-muted"
                          style={{ padding: '4px 10px', fontSize: 13 }}
                          disabled={revealing === d.id}
                          onClick={() => reveal(d.id)}
                          aria-label={`Ver WhatsApp de ${d.full_name}`}
                        >
                          {revealing === d.id ? '…' : '👁 Ver'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
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
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
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
                disabled={page >= pageCount - 1 || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
