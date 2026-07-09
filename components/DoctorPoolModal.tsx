// Modal "Ver Pool de médicos" para la consulta médico-paciente: lista paginada de médicos
// (activos=logeados / inactivos=offline / todos), filtrable por especialidad y tipo de profesional.
// Datos del backend (GET /doctors/pool), que cruza doctors↔users para el estado online. El overlay
// reusa el patrón inline role="dialog" del modal de borrado en pages/admin/pacientes.tsx (no hay
// componente Modal compartido en el repo).
import { useEffect, useMemo, useState } from 'react'
import { getAccessToken } from '../lib/admin'
import {
  DoctorPoolItem,
  fetchDoctorPool,
  fetchProfessionalTypes,
  fetchSpecialties
} from '../lib/doctors'

const PAGE_SIZE = 20

type Tab = 'activos' | 'inactivos' | 'todos'
const TAB_ONLINE: Record<Tab, boolean | undefined> = {
  activos: true,
  inactivos: false,
  todos: undefined
}
const TAB_LABEL: Record<Tab, string> = {
  activos: 'Activos',
  inactivos: 'Inactivos',
  todos: 'Todos'
}

type Catalog = { id: string; name: string }

// Número para el enlace de WhatsApp (https://wa.me/<número>): sin el "+" de adelante y,
// si no trae prefijo internacional, se le antepone 58 (Venezuela). Ej: "+584145200715" o
// "04145200715" -> "584145200715".
function waNumber(phone: string): string {
  const raw = phone.trim()
  let d = raw.replace(/[^\d]/g, '') // solo dígitos (quita "+", espacios, guiones)
  if (raw.startsWith('+')) return d // ya tiene prefijo internacional; el "+" ya se quitó
  if (d.startsWith('0')) d = d.slice(1) // 04145... -> 4145...
  if (!d.startsWith('58')) d = '58' + d // sin prefijo -> anteponer Venezuela
  return d
}

export default function DoctorPoolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('activos')
  const [specialtyId, setSpecialtyId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [page, setPage] = useState(0)
  const [items, setItems] = useState<DoctorPoolItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [specialties, setSpecialties] = useState<Catalog[]>([])
  const [types, setTypes] = useState<Catalog[]>([])

  // Catálogos para los dropdowns y para mapear id→nombre en la tabla. Se cargan una vez.
  useEffect(() => {
    if (!open || specialties.length || types.length) return
    ;(async () => {
      try {
        const [s, t] = await Promise.all([fetchSpecialties(), fetchProfessionalTypes()])
        setSpecialties(s.map((x) => ({ id: x.id, name: x.name })))
        setTypes(t.map((x) => ({ id: x.id, name: x.name })))
      } catch {
        // Sin catálogos los dropdowns quedan vacíos, pero la lista sigue funcionando.
      }
    })()
  }, [open, specialties.length, types.length])

  // Cualquier cambio de tab/filtro vuelve a la primera página.
  useEffect(() => {
    setPage(0)
  }, [tab, specialtyId, typeId])

  // (Re)carga la página actual cuando el modal está abierto y cambian filtros/página.
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
            online: TAB_ONLINE[tab]
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
  }, [open, tab, specialtyId, typeId, page])

  const specName = useMemo(
    () => Object.fromEntries(specialties.map((s) => [s.id, s.name])),
    [specialties]
  )
  const typeName = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t.name])), [types])

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
            style={{ padding: '4px 12px' }}
          >
            ✕
          </button>
        </div>

        {/* Tabs Activos / Inactivos / Todos */}
        <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <select
            style={{ flex: '1 1 200px' }}
            value={specialtyId}
            onChange={(e) => setSpecialtyId(e.target.value)}
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
            onChange={(e) => setTypeId(e.target.value)}
          >
            <option value="">Todos los tipos de profesional</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="notice notice-danger" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Médico</th>
                <th>Especialidad</th>
                <th>Tipo</th>
                {/* En "Todos" muestra el estado online; en Activos/Inactivos, el WhatsApp. */}
                <th>{tab === 'todos' ? 'Estado' : 'WhatsApp'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ color: '#64748b' }}>
                    Cargando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: '#64748b' }}>
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
                      {tab === 'todos' ? (
                        d.online ? (
                          <span className="badge badge-green">● En línea</span>
                        ) : (
                          <span
                            className="badge"
                            style={{ background: '#e2e8f0', color: '#64748b' }}
                          >
                            ○ Desconectado
                          </span>
                        )
                      ) : d.phone ? (
                        <a
                          href={`https://wa.me/${waNumber(d.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="badge badge-green"
                          style={{ textDecoration: 'none' }}
                        >
                          {d.phone}
                        </a>
                      ) : (
                        '—'
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
