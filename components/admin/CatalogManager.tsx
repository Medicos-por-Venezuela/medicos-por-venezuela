// Generic list + create/edit/delete UI for the three simple admin-managed catalogs
// (affected_zones, specialties, professional_types) in api-medicos-por-venezuela. The three
// only differ in which fields they have, so one component + a field schema avoids tripling
// nearly identical CRUD boilerplate.
import { FormEvent, useMemo, useState } from 'react'
import { deleteJson, getJson, patchJson, postJson } from '../../lib/apiClient'
import { getAccessToken } from '../../lib/admin'
import { useMountEffect } from '../../lib/hooks'

const PAGE_SIZE = 10

export type CatalogField = {
  key: string
  label: string
  type?: 'text' | 'select'
  options?: string[]
  defaultValue?: string
}

type CatalogItem = Record<string, unknown> & { id: string; status: string }

function emptyForm(fields: CatalogField[]): Record<string, string> {
  const form: Record<string, string> = {}
  fields.forEach((f) => {
    form[f.key] = f.defaultValue ?? (f.options ? f.options[0] : '')
  })
  return form
}

export default function CatalogManager({
  resourceLabel,
  pluralLabel,
  gender = 'f',
  listPath,
  basePath,
  fields
}: {
  resourceLabel: string // e.g. "zona afectada" — used in messages/confirm dialogs
  pluralLabel?: string // for compound nouns where +"s" is wrong (e.g. "tipos de profesional")
  gender?: 'f' | 'm' // agreement for "Nuevo/a", "creado/a", "actualizado/a", "eliminado/a"
  listPath: string // admin-scoped list endpoint (sees active + inactive)
  basePath: string // e.g. '/api/v1/affected-zones' — create/update/delete base
  fields: CatalogField[]
}) {
  const o = gender === 'm' ? 'o' : 'a'
  const el = gender === 'm' ? 'el' : 'la'
  const plural = pluralLabel ?? `${resourceLabel}s`
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(fields))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  useMountEffect(() => {
    load()
  })

  // Catálogos chicos (decenas de filas, el endpoint trae hasta 100): buscar/paginar en cliente
  // sobre lo ya cargado — no vale la pena paginación server-side. Busca en todos los campos de texto.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      fields.some((f) =>
        String(item[f.key] ?? '')
          .toLowerCase()
          .includes(q)
      )
    )
  }, [items, search, fields])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const token = await getAccessToken()
      const data = await getJson<CatalogItem[]>(
        listPath,
        `No se pudo cargar el catálogo de ${plural}`,
        token
      )
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar.')
    }
    setLoading(false)
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id)
    const next: Record<string, string> = {}
    fields.forEach((f) => {
      next[f.key] = String(item[f.key] ?? '')
    })
    setForm(next)
    setMessage('')
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm(fields))
    setError('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (editingId) {
        await patchJson(
          `${basePath}/${editingId}`,
          form,
          `No se pudo actualizar ${el} ${resourceLabel}`,
          token
        )
        setMessage(`${resourceLabel} actualizad${o}.`)
      } else {
        await postJson(basePath, form, `No se pudo crear ${el} ${resourceLabel}`, token)
        setMessage(`${resourceLabel} cread${o}.`)
      }
      cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.')
    }
    setSaving(false)
  }

  async function remove(item: CatalogItem) {
    const name = String(item.name ?? '')
    if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return
    setError('')
    try {
      const token = await getAccessToken()
      await deleteJson(
        `${basePath}/${item.id}`,
        `No se pudo eliminar ${el} ${resourceLabel}`,
        token
      )
      setMessage(`${resourceLabel} eliminad${o}.`)
      if (editingId === item.id) cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar.')
    }
  }

  const nameMissing = !form.name?.trim()

  return (
    <>
      {message && (
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}
      {error && (
        <div className="notice notice-danger" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>
          {editingId ? `Editar ${resourceLabel}` : `Nuev${o} ${resourceLabel}`}
        </h2>
        <form onSubmit={submit}>
          <div className="grid grid-2">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  >
                    {(f.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={saving || nameMissing}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-muted"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>
          Listado{' '}
          <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
            ({filtered.length}
            {search.trim() ? ` de ${items.length}` : ''})
          </span>
        </h2>
        {!loading && items.length > 0 && (
          <input
            style={{ marginBottom: 12, maxWidth: 320 }}
            placeholder="Buscar…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
        )}
        {loading ? (
          <p style={{ color: '#64748b' }}>Cargando...</p>
        ) : items.length === 0 ? (
          <p style={{ color: '#64748b' }}>
            Todavía no hay {plural} cread{o}s.
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#64748b' }}>Ningún resultado coincide con «{search}».</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    {fields.map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr key={item.id}>
                      {fields.map((f) => (
                        <td key={f.key}>
                          {f.key === 'status' ? (
                            <span
                              className={item.status === 'active' ? 'badge badge-green' : 'badge'}
                            >
                              {String(item[f.key] ?? '')}
                            </span>
                          ) : (
                            String(item[f.key] ?? '—')
                          )}
                        </td>
                      ))}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-muted"
                          style={{ padding: '5px 10px', fontSize: 13, marginRight: 6 }}
                          onClick={() => startEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn"
                          style={{
                            padding: '5px 10px',
                            fontSize: 13,
                            background: '#dc2626',
                            color: '#fff'
                          }}
                          onClick={() => remove(item)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  Mostrando {safePage * PAGE_SIZE + 1}–
                  {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-muted"
                    disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    className="btn btn-muted"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
