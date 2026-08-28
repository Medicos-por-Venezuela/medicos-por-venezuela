import { useEffect, useMemo, useState } from 'react'
import AdminLayout, { AdminLoading, Line } from '../../components/admin/AdminLayout'
import DoctorCredentials from '../../components/admin/DoctorCredentials'
import {
  fmtDate,
  getAccessToken,
  Profile,
  ROLE_OPTIONS,
  STAFF_ROLES,
  useAdminGuard,
  USERS_PAGE_SIZE
} from '../../lib/admin'
import { useOnlineDoctors } from '../../lib/presence'
import { isAdminRole } from '../../lib/utils'
import { fetchProfiles, setProfileActive } from '../../lib/users'

export default function AdminDoctores() {
  const { profile, loading } = useAdminGuard()
  const [message, setMessage] = useState('')

  // Médicos online en vivo por Realtime Presence (el admin solo observa, no se anuncia).
  const onlineDoctors = useOnlineDoctors()
  const onlineIds = useMemo(() => new Set(onlineDoctors.map((d) => d.id)), [onlineDoctors])
  // Especialidades de los médicos online, como [especialidad, conteo] desc.
  const onlineBySpecialty = useMemo(() => {
    const bySpec: Record<string, number> = {}
    for (const d of onlineDoctors) {
      const key = d.specialty || 'Sin especialidad'
      bySpec[key] = (bySpec[key] || 0) + 1
    }
    return Object.entries(bySpec).sort((a, b) => b[1] - a[1])
  }, [onlineDoctors])

  // Users (doctors/admins) table filters
  const [userSearch, setUserSearch] = useState('')
  const [userRole, setUserRole] = useState('all')
  const [userState, setUserState] = useState('all') // all | active | revoked
  const [userFrom, setUserFrom] = useState('')
  const [userTo, setUserTo] = useState('')
  // Server-side paginated staff list for the Médicos y administradores table (no 1000-row cap).
  const [usersRows, setUsersRows] = useState<Profile[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(0)
  const [usersLoading, setUsersLoading] = useState(false)
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('')

  // Debounce the user search box so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearch), 300)
    return () => clearTimeout(t)
  }, [userSearch])

  // Any filter change resets to the first page.
  useEffect(() => {
    setUsersPage(0)
  }, [debouncedUserSearch, userRole, userState, userFrom, userTo])

  // (Re)load the current page of staff users when the profile is ready or filters/page change.
  useEffect(() => {
    if (profile) loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, debouncedUserSearch, userRole, userState, userFrom, userTo, usersPage])

  // Staff-only, server-side filtered + paginated list for the Médicos y administradores table.
  async function loadUsers() {
    setUsersLoading(true)
    // Lista staff paginada + total, por el backend (GET /profiles enriquecido): filtra por rol(es),
    // estado activo/revocado, rango de fechas y búsqueda (nombre/email/especialidad).
    try {
      const { items, total } = await fetchProfiles(await getAccessToken(), {
        roles: userRole === 'all' ? STAFF_ROLES : [userRole],
        search: debouncedUserSearch || undefined,
        active: userState === 'active' ? true : userState === 'revoked' ? false : undefined,
        createdFrom: userFrom || undefined,
        createdTo: userTo || undefined,
        skip: usersPage * USERS_PAGE_SIZE,
        limit: USERS_PAGE_SIZE
      })
      setUsersRows(items as unknown as Profile[])
      setUsersTotal(total)
    } catch (e) {
      console.error(e)
      setMessage('No se pudieron cargar los usuarios.')
    }
    setUsersLoading(false)
  }

  async function toggleDoctor(id: string, active: boolean) {
    // Revocar/reactivar vía PATCH /profiles/{id}/active (backend), ya no un UPDATE directo a la vista.
    try {
      const token = await getAccessToken()
      await setProfileActive(id, !active, token)
      await loadUsers()
    } catch {
      setMessage('No se pudo actualizar el usuario.')
    }
  }

  const onlineCount = onlineBySpecialty.reduce((sum, [, n]) => sum + n, 0)

  if (loading) return <AdminLoading />

  return (
    <AdminLayout title="Médicos y administradores" profile={profile}>
      {message && (
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>
          Especialidades conectadas ahora{' '}
          <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>
            ({onlineCount} médicos online)
          </span>
        </h2>
        {onlineBySpecialty.length === 0 ? (
          <p style={{ color: '#64748b' }}>No hay médicos conectados en este momento.</p>
        ) : (
          <div className="tag-row">
            {onlineBySpecialty.map(([spec, n]) => (
              <span key={spec} className="badge badge-green">
                {spec}: {n}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Aprobación de credenciales (backend: GET /doctors + POST /doctors/{id}/approve). Va antes
          de la tabla de cuentas porque es la acción pendiente: un médico bloqueado por credencial
          aparece "Activo" en la tabla de abajo y aun así no puede atender. */}
      <DoctorCredentials />

      <section className="card">
        <h2 style={{ marginTop: 0 }}>
          Médicos y administradores{' '}
          <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 14 }}>({usersTotal})</span>
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <input
            style={{ flex: '1 1 160px' }}
            placeholder="Buscar nombre o email"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <select
            style={{ flex: '0 1 130px' }}
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'Todos los roles' : r}
              </option>
            ))}
          </select>
          <select
            style={{ flex: '0 1 130px' }}
            value={userState}
            onChange={(e) => setUserState(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="revoked">Revocados</option>
          </select>
          <input
            type="date"
            style={{ flex: '0 1 140px' }}
            value={userFrom}
            onChange={(e) => setUserFrom(e.target.value)}
            title="Registrado desde"
          />
          <input
            type="date"
            style={{ flex: '0 1 140px' }}
            value={userTo}
            onChange={(e) => setUserTo(e.target.value)}
            title="Registrado hasta"
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Registrado</th>
                <th>Online</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usersRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: '#64748b' }}>
                    {usersLoading ? 'Cargando...' : 'No hay usuarios que coincidan con el filtro.'}
                  </td>
                </tr>
              ) : (
                usersRows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.full_name}</strong>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{p.email}</div>
                      <Line label="Especialidad" value={p.specialty} />
                      <Line label="País" value={p.country} />
                      <Line label="WhatsApp" value={p.whatsapp_number} />
                      <Line label="Licencia" value={p.medical_license} />
                    </td>
                    <td>{p.role}</td>
                    <td>
                      {p.active ? (
                        <span className="badge badge-green">Activo</span>
                      ) : (
                        <span className="badge badge-red">Revocado</span>
                      )}
                      {/* `== null` (laxo) y no `!== null`: atrapa tambien `undefined`, que es lo que
                          llega si el backend aun no expone doctor_verified (despliegue del front
                          por delante del back, o un rollback del back). Con el estricto, undefined
                          pasaba el guard y caia en la rama falsy: "Cedula sin verificar" para
                          TODO el mundo, peor que el bug que esto arregla. */}
                      {/* Credencial real (SACS/FPV), no `users.verified`: esa columna es
                          constante true y hacía que TODO el mundo saliera "Verificado", incluidos
                          los 795 médicos cuya cédula no validó. null = no es médico. */}
                      {p.doctor_verified != null && (
                        <div style={{ marginTop: 4 }}>
                          {p.doctor_verified ? (
                            <span className="badge badge-green">Cédula verificada</span>
                          ) : (
                            <span className="badge badge-red">Cédula sin verificar</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{fmtDate(p.created_at)}</td>
                    <td>{onlineIds.has(p.id) ? 'Sí' : 'No'}</td>
                    <td>
                      {isAdminRole(p.role) ? (
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                      ) : (
                        <button
                          className="btn btn-muted"
                          onClick={() => toggleDoctor(p.id, p.active)}
                        >
                          {p.active ? 'Revocar acceso' : 'Reactivar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
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
            {usersTotal === 0
              ? 'Sin resultados'
              : `Mostrando ${usersPage * USERS_PAGE_SIZE + 1}–${Math.min(
                  (usersPage + 1) * USERS_PAGE_SIZE,
                  usersTotal
                )} de ${usersTotal}`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-muted"
              disabled={usersPage === 0 || usersLoading}
              onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </button>
            <button
              className="btn btn-muted"
              disabled={(usersPage + 1) * USERS_PAGE_SIZE >= usersTotal || usersLoading}
              onClick={() => setUsersPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </AdminLayout>
  )
}
