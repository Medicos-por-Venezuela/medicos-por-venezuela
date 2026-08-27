// Admin screen for the new multi-role RBAC system owned by api-medicos-por-venezuela: create
// users and grant/revoke roles. This is additive to (and independent from) the Supabase-direct
// single-role `profiles.role` mechanism used by pages/admin/doctores.tsx ("Revocar acceso") — do
// not merge the two, they're different backends for different account kinds.
import { Fragment, FormEvent, useEffect, useRef, useState } from 'react'
import { getAccessToken } from '../../lib/admin'
import { fmtDate } from '../../lib/admin'
import { useMountEffect } from '../../lib/hooks'
import ConfirmDialog from './ConfirmDialog'
import {
  ApiError,
  ApiUser,
  PermissionsResponse,
  RoleCatalogItem,
  UserCreate,
  UserRoleAssignment,
  assignRole,
  createUser,
  fetchMyPermissions,
  fetchProfiles,
  fetchRoles,
  fetchUserRoles,
  revokeRole
} from '../../lib/users'

const PAGE_SIZE = 20
const ROLE_FILTER_OPTIONS = ['all', 'patient', 'doctor', 'specialist', 'admin', 'super_admin']
// `initial_role` (UserCreate) only accepts these three — super_admin is always rejected by the
// backend even for a super_admin caller. This is the single source of truth for that union, both
// as the create-form's fallback (roles catalog not loaded) and as a filter against the catalog
// when it IS loaded, so an unrelated role added to the backend catalog (e.g. `specialist`) can't
// leak into this form just because it exists in `/api/v1/roles`.
const INITIAL_ROLE_OPTIONS: UserCreate['initial_role'][] = ['patient', 'doctor', 'admin']
// Mirrors the backend's Pydantic validators for UserCreate (lib/users.ts). PASSWORD_MAX_LENGTH is
// 72 specifically because bcrypt truncates input past that length.
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 72
const FULL_NAME_MIN_LENGTH = 2
const FULL_NAME_MAX_LENGTH = 200

const emptyCreateForm = { email: '', password: '', full_name: '', initial_role: 'patient' }

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return fallback
}

export default function UsersManager() {
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null)
  const [roles, setRoles] = useState<RoleCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [users, setUsers] = useState<ApiUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [creating, setCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState('')
  const [createError, setCreateError] = useState('')

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [rolesError, setRolesError] = useState('')
  const [assignRoleCode, setAssignRoleCode] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [revokingRoleId, setRevokingRoleId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{
    userId: string
    roleId: string
    roleLabel: string
  } | null>(null)

  const canCreateUsers = !!permissions?.permissions.includes('users.create')
  const canReadProfiles = !!permissions?.permissions.includes('profiles.read')
  const canAssignRoles = !!permissions?.permissions.includes('roles.assign')
  const canGrantSuperAdmin = !!permissions?.roles.includes('super_admin')

  async function loadUsersPage(nextSkip: number, role: string, searchTerm: string) {
    setUsersLoading(true)
    setUsersError('')
    try {
      const token = await getAccessToken()
      const data = await fetchProfiles(token, {
        skip: nextSkip,
        limit: PAGE_SIZE,
        role: role !== 'all' ? role : undefined,
        search: searchTerm || undefined
      })
      setUsers(data.items)
      setSkip(nextSkip)
      setHasMore(data.items.length === PAGE_SIZE)
    } catch (e) {
      setUsersError(errorMessage(e, 'No se pudieron cargar los usuarios.'))
    }
    setUsersLoading(false)
  }

  useMountEffect(() => {
    ;(async () => {
      setLoading(true)
      setLoadError('')
      let perms: PermissionsResponse
      try {
        const token = await getAccessToken()
        perms = await fetchMyPermissions(token)
        setPermissions(perms)
        if (perms.permissions.includes('roles.assign')) {
          setRoles(await fetchRoles(token))
        }
      } catch (e) {
        setLoadError(errorMessage(e, 'No se pudo cargar la información inicial.'))
        setLoading(false)
        return
      }
      setLoading(false)
      // Deliberately outside the try/catch above: reuses loadUsersPage's own error handling
      // (setUsersError, not setLoadError) instead of duplicating its fetch here.
      if (perms.permissions.includes('profiles.read')) await loadUsersPage(0, 'all', '')
    })()
  })

  function changeRoleFilter(role: string) {
    setRoleFilter(role)
    loadUsersPage(0, role, search)
  }

  // Debounce del buscador (300ms, como el resto de buscadores del admin): recarga desde la
  // primera página con el término nuevo. El ref salta el disparo del montaje (useMountEffect
  // ya hace la carga inicial; sin el guard, se duplicaría el primer fetch).
  const searchMounted = useRef(false)
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true
      return
    }
    const t = setTimeout(() => loadUsersPage(0, roleFilter, search), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    setCreateMessage('')
    try {
      const token = await getAccessToken()
      const created = await createUser(
        {
          email: createForm.email.trim(),
          password: createForm.password,
          full_name: createForm.full_name.trim(),
          initial_role: createForm.initial_role as 'patient' | 'doctor' | 'admin'
        },
        token
      )
      setCreateMessage(`Usuario ${created.email} creado con rol ${created.role}.`)
      setCreateForm(emptyCreateForm)
      if (canReadProfiles) await loadUsersPage(0, roleFilter, search)
    } catch (e) {
      if (e instanceof ApiError && e.status === 502) {
        setCreateError(
          `${e.message} La creación es idempotente por email: puedes volver a enviar el formulario sin riesgo de duplicar el usuario.`
        )
      } else {
        setCreateError(errorMessage(e, 'No se pudo crear el usuario.'))
      }
    }
    setCreating(false)
  }

  async function toggleManageRoles(user: ApiUser) {
    if (expandedUserId === user.id) {
      setExpandedUserId(null)
      return
    }
    setExpandedUserId(user.id)
    setAssignRoleCode('')
    setRolesError('')
    setUserRoles([])
    setRolesLoading(true)
    try {
      const token = await getAccessToken()
      setUserRoles(await fetchUserRoles(user.id, token))
    } catch (e) {
      setRolesError(errorMessage(e, 'No se pudieron cargar los roles del usuario.'))
    }
    setRolesLoading(false)
  }

  async function handleAssign(userId: string) {
    if (!assignRoleCode) return
    setAssigning(true)
    setRolesError('')
    try {
      const token = await getAccessToken()
      await assignRole(userId, assignRoleCode, token)
      setUserRoles(await fetchUserRoles(userId, token))
      setAssignRoleCode('')
    } catch (e) {
      setRolesError(errorMessage(e, 'No se pudo asignar el rol.'))
    }
    setAssigning(false)
  }

  function handleRevoke(userId: string, roleId: string, roleLabel: string) {
    setRevokeTarget({ userId, roleId, roleLabel })
  }

  async function confirmRevoke() {
    if (!revokeTarget) return
    const { userId, roleId } = revokeTarget
    setRevokingRoleId(roleId)
    setRolesError('')
    try {
      const token = await getAccessToken()
      await revokeRole(userId, roleId, token)
      setUserRoles((prev) => prev.filter((r) => r.role_id !== roleId))
      setRevokeTarget(null)
    } catch (e) {
      setRolesError(errorMessage(e, 'No se pudo revocar el rol.'))
    }
    setRevokingRoleId(null)
  }

  if (loading) return <p style={{ color: '#64748b' }}>Cargando...</p>

  // Always intersected with INITIAL_ROLE_OPTIONS (not just "minus super_admin") so a role the
  // backend catalog might add later (e.g. `specialist`) can never appear here as a selectable
  // `initial_role` just because it exists in `/api/v1/roles` — `createUser()` would 422 on it.
  const createRoleOptions =
    roles.length > 0
      ? INITIAL_ROLE_OPTIONS.filter((code) => roles.some((r) => r.code === code))
      : INITIAL_ROLE_OPTIONS

  const assignableRoles = roles.filter(
    (r) =>
      (r.code !== 'super_admin' || canGrantSuperAdmin) &&
      !userRoles.some((ur) => ur.role_code === r.code)
  )

  return (
    <>
      {loadError && (
        <div className="notice notice-danger" style={{ marginBottom: 16 }}>
          {loadError}
        </div>
      )}

      {canCreateUsers && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ marginTop: 0 }}>Crear usuario</h2>
          {createMessage && (
            <div className="notice notice-info" style={{ marginBottom: 12 }}>
              {createMessage}
            </div>
          )}
          {createError && (
            <div className="notice notice-danger" style={{ marginBottom: 12 }}>
              {createError}
            </div>
          )}
          <form onSubmit={submitCreate}>
            <div className="grid grid-2">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Nombre completo</label>
                <input
                  required
                  minLength={FULL_NAME_MIN_LENGTH}
                  maxLength={FULL_NAME_MAX_LENGTH}
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((s) => ({ ...s, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Rol inicial</label>
                <select
                  value={createForm.initial_role}
                  onChange={(e) => setCreateForm((s) => ({ ...s, initial_role: e.target.value }))}
                >
                  {createRoleOptions.map((code) => (
                    <option key={code} value={code}>
                      {roles.find((r) => r.code === code)?.name ?? code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={creating}>
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Usuarios</h2>
        {!canReadProfiles ? (
          <p style={{ color: '#64748b' }}>No tienes permiso para ver el listado de usuarios.</p>
        ) : (
          <>
            {usersError && (
              <div className="notice notice-danger" style={{ marginBottom: 12 }}>
                {usersError}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <input
                style={{ flex: '1 1 220px' }}
                placeholder="Buscar por nombre o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                style={{ flex: '0 1 160px' }}
                value={roleFilter}
                onChange={(e) => changeRoleFilter(e.target.value)}
              >
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === 'all' ? 'Todos los roles' : r}
                  </option>
                ))}
              </select>
            </div>

            {usersLoading ? (
              <p style={{ color: '#64748b' }}>Cargando...</p>
            ) : users.length === 0 ? (
              <p style={{ color: '#64748b' }}>No hay usuarios que coincidan con el filtro.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table users-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Registrado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <Fragment key={u.id}>
                        <tr>
                          <td>{u.email}</td>
                          <td>{u.full_name}</td>
                          <td>{u.role}</td>
                          <td>
                            {u.active ? (
                              <span className="badge badge-green">Activo</span>
                            ) : (
                              <span className="badge badge-red">Revocado</span>
                            )}
                            {/* Credencial real (SACS/FPV). Antes leía `users.verified`, que es
                                constante true: el badge salía verde para todos. Un usuario sin
                                ficha de médico (null) no lleva badge: no hay cédula que validar. */}
                            {u.doctor_verified !== null &&
                              (u.doctor_verified ? (
                                <span className="badge badge-green" style={{ marginLeft: 4 }}>
                                  Cédula verificada
                                </span>
                              ) : (
                                <span className="badge badge-red" style={{ marginLeft: 4 }}>
                                  Cédula sin verificar
                                </span>
                              ))}
                          </td>
                          <td>{fmtDate(u.created_at)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {canAssignRoles && (
                              <button
                                className="btn btn-muted"
                                style={{ padding: '5px 10px', fontSize: 13 }}
                                onClick={() => toggleManageRoles(u)}
                              >
                                {expandedUserId === u.id ? 'Cerrar' : 'Gestionar roles'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedUserId === u.id && (
                          <tr>
                            <td colSpan={6}>
                              <div className="card" style={{ background: '#f8fafc', padding: 24 }}>
                                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 15 }}>
                                  Roles asignados
                                </h3>
                                {rolesError && (
                                  <div
                                    className="notice notice-danger"
                                    style={{ marginBottom: 16 }}
                                  >
                                    {rolesError}
                                  </div>
                                )}
                                {rolesLoading ? (
                                  <p style={{ color: '#64748b' }}>Cargando roles...</p>
                                ) : (
                                  <>
                                    {userRoles.length === 0 ? (
                                      <p style={{ color: '#64748b', marginBottom: 16 }}>
                                        Este usuario no tiene roles asignados.
                                      </p>
                                    ) : (
                                      <ul
                                        style={{
                                          margin: '0 0 20px',
                                          padding: 0,
                                          listStyle: 'none',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 12
                                        }}
                                      >
                                        {userRoles.map((r) => (
                                          <li
                                            key={r.id}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              flexWrap: 'wrap',
                                              gap: 10
                                            }}
                                          >
                                            <span className="badge badge-blue">
                                              {r.role_name} ({r.role_code})
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: 12 }}>
                                              desde {fmtDate(r.assigned_at)}
                                            </span>
                                            {/* Mirrors the assign select's canGrantSuperAdmin
                                            gate: revoking super_admin needs it too, so this
                                            action shouldn't dangle in the UI as if it always
                                            works when the backend will 403 it. */}
                                            {r.role_code !== 'super_admin' || canGrantSuperAdmin ? (
                                              <button
                                                className="btn"
                                                style={{
                                                  padding: '6px 12px',
                                                  fontSize: 12,
                                                  background: '#dc2626',
                                                  color: '#fff'
                                                }}
                                                disabled={revokingRoleId === r.role_id}
                                                onClick={() =>
                                                  handleRevoke(u.id, r.role_id, r.role_name)
                                                }
                                              >
                                                {revokingRoleId === r.role_id
                                                  ? 'Revocando...'
                                                  : 'Revocar'}
                                              </button>
                                            ) : (
                                              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                                                (requiere super_admin para revocar)
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: 12,
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        marginTop: 16,
                                        paddingTop: 16,
                                        borderTop: '1px solid var(--border)'
                                      }}
                                    >
                                      <select
                                        style={{ flex: '0 1 200px' }}
                                        value={assignRoleCode}
                                        onChange={(e) => setAssignRoleCode(e.target.value)}
                                      >
                                        <option value="">Selecciona un rol para asignar…</option>
                                        {assignableRoles.map((r) => (
                                          <option key={r.id} value={r.code}>
                                            {r.name}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        className="btn btn-primary"
                                        disabled={!assignRoleCode || assigning}
                                        onClick={() => handleAssign(u.id)}
                                      >
                                        {assigning ? 'Asignando...' : 'Asignar rol'}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 12
              }}
            >
              <button
                className="btn btn-muted"
                disabled={skip === 0 || usersLoading}
                onClick={() => loadUsersPage(Math.max(0, skip - PAGE_SIZE), roleFilter, search)}
              >
                Anterior
              </button>
              <button
                className="btn btn-muted"
                disabled={!hasMore || usersLoading}
                onClick={() => loadUsersPage(skip + PAGE_SIZE, roleFilter, search)}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revocar rol"
        message={`¿Revocar el rol "${revokeTarget?.roleLabel ?? ''}"?`}
        confirmLabel={revokingRoleId === revokeTarget?.roleId ? 'Revocando...' : 'Revocar'}
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeTarget(null)}
        busy={revokingRoleId === revokeTarget?.roleId}
        danger
      />
    </>
  )
}
