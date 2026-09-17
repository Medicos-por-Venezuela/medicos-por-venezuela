// Aviso del dashboard admin: médicos que escribieron una especialidad que no está en el catálogo
// ("Mi especialidad no está en la lista", en su perfil). Mientras nadie la revise NO ven la cola,
// porque la cola es por especialidad. Aquí el admin la resuelve: le asigna una existente, o crea
// la que escribió y se la asigna.
//
// Sin la bandeja, esos médicos se quedarían bloqueados sin que nadie se enterara.
import { useState } from 'react'
import { getAccessToken } from '../../lib/admin'
import { ApiError, postJson } from '../../lib/apiClient'
import {
  fetchSpecialties,
  fetchSpecialtyRequests,
  resolveSpecialtyRequest,
  type SpecialtyRequestItem,
  type SpecialtyResponse
} from '../../lib/doctors'
import { useMountEffect } from '../../lib/hooks'

export default function EspecialidadesPendientes() {
  const [items, setItems] = useState<SpecialtyRequestItem[]>([])
  const [total, setTotal] = useState(0)
  const [catalog, setCatalog] = useState<SpecialtyResponse[]>([])
  const [loadError, setLoadError] = useState('')
  const [elegida, setElegida] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({})
  const [done, setDone] = useState('')

  async function load() {
    try {
      const token = await getAccessToken()
      const [page, specs] = await Promise.all([fetchSpecialtyRequests(token), fetchSpecialties()])
      setItems(page.items)
      setTotal(page.total)
      setCatalog(specs.filter((s) => !s.is_placeholder && s.status === 'active'))
      setLoadError('')
    } catch (e) {
      // 403: este admin no tiene `doctors.verify`; la bandeja simplemente no aparece.
      if (e instanceof ApiError && e.status === 403) return
      setLoadError(e instanceof Error ? e.message : 'No se pudieron cargar las especialidades.')
    }
  }

  useMountEffect(() => {
    load()
  })

  async function asignar(item: SpecialtyRequestItem, specialtyId: string, nombre: string) {
    setBusyId(item.doctor_id)
    setRowMessage((prev) => ({ ...prev, [item.doctor_id]: '' }))
    try {
      await resolveSpecialtyRequest(item.doctor_id, specialtyId, await getAccessToken())
      setDone(`${item.full_name} ahora atiende la cola de ${nombre}.`)
      await load()
    } catch (e) {
      setRowMessage((prev) => ({
        ...prev,
        [item.doctor_id]: e instanceof Error ? e.message : 'No se pudo asignar la especialidad.'
      }))
    } finally {
      setBusyId('')
    }
  }

  async function crearYAsignar(item: SpecialtyRequestItem) {
    setBusyId(item.doctor_id)
    setRowMessage((prev) => ({ ...prev, [item.doctor_id]: '' }))
    try {
      const token = await getAccessToken()
      // Si ya existe con ese nombre (otro médico pidió la misma), se usa esa en vez de duplicarla.
      const existente = catalog.find(
        (s) => s.name.trim().toLowerCase() === item.requested_specialty.trim().toLowerCase()
      )
      const especialidad =
        existente ||
        (await postJson<SpecialtyResponse>(
          '/api/v1/specialties',
          { name: item.requested_specialty.trim() },
          'No se pudo crear la especialidad',
          token
        ))
      await resolveSpecialtyRequest(item.doctor_id, especialidad.id, token)
      setDone(`Agregaste “${especialidad.name}” y ${item.full_name} ya atiende esa cola.`)
      await load()
    } catch (e) {
      setRowMessage((prev) => ({
        ...prev,
        [item.doctor_id]: e instanceof Error ? e.message : 'No se pudo crear la especialidad.'
      }))
    } finally {
      setBusyId('')
    }
  }

  if (loadError) {
    return (
      <div className="notice notice-danger" style={{ marginBottom: 16 }}>
        {loadError}
      </div>
    )
  }
  if (total === 0) {
    return done ? (
      <div className="notice notice-success" style={{ marginBottom: 16 }}>
        {done}
      </div>
    ) : null
  }

  return (
    <section className="card" style={{ marginBottom: 16 }} aria-labelledby="esp-pendientes">
      <h2 id="esp-pendientes" style={{ marginTop: 0 }}>
        Especialidades por revisar ({total})
      </h2>
      <div className="notice notice-warning" style={{ marginBottom: 12 }}>
        Estos médicos escribieron una especialidad que no está en el catálogo.{' '}
        <strong>No ven la cola de pacientes</strong> hasta que les asignes una.
      </div>
      {done && (
        <div className="notice notice-success" style={{ marginBottom: 12 }}>
          {done}
        </div>
      )}
      <div className="grid">
        {items.map((item) => {
          const seleccion = elegida[item.doctor_id] || ''
          const nombreSeleccion = catalog.find((s) => s.id === seleccion)?.name || ''
          const ocupado = busyId === item.doctor_id
          return (
            <div key={item.doctor_id} className="card-flat">
              <strong>{item.full_name}</strong>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                {item.email || 'Sin correo'} · hoy: {item.specialty || 'sin especialidad'}
              </div>
              <p style={{ margin: '8px 0' }}>
                Escribió: <strong>“{item.requested_specialty}”</strong>
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  disabled={ocupado}
                  onClick={() => crearYAsignar(item)}
                >
                  Agregar “{item.requested_specialty}” y asignar
                </button>
                <span style={{ color: '#64748b', fontSize: 13 }}>o asignar una existente:</span>
                <select
                  aria-label={`Especialidad existente para ${item.full_name}`}
                  value={seleccion}
                  onChange={(e) =>
                    setElegida((prev) => ({ ...prev, [item.doctor_id]: e.target.value }))
                  }
                  style={{ flex: '1 1 180px', width: 'auto' }}
                >
                  <option value="">Elegir…</option>
                  {catalog.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-outline"
                  disabled={!seleccion || ocupado}
                  onClick={() => asignar(item, seleccion, nombreSeleccion)}
                >
                  Asignar
                </button>
              </div>
              {rowMessage[item.doctor_id] && (
                <p className="notice notice-danger" style={{ marginTop: 8 }}>
                  {rowMessage[item.doctor_id]}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
