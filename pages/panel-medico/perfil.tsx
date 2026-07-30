import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ApiError,
  DoctorMeResponse,
  DoctorSelfUpdate,
  ProfessionalTypeResponse,
  SpecialtyResponse,
  fetchMyDoctorProfile,
  fetchProfessionalTypes,
  fetchSpecialties,
  updateMyDoctorProfile
} from '../../lib/doctors'
import { verificarSacs, verificarPsicologo } from '../../lib/verificacion'
import {
  CHANNEL_LABELS,
  EVENT_LABELS,
  fetchNotificationPrefs,
  saveNotificationPrefs,
  type NotificationCatalog,
  type NotificationPrefs
} from '../../lib/notificationPrefs'

type Notice = { kind: 'info' | 'success' | 'danger'; text: string }
type Tab = 'perfil' | 'disponibilidad' | 'ajustes'

const soloDigitos = (value: string) => value.replace(/\D/g, '')

// Descompone "V-12345678" en { prefijo: 'V', numero: '12345678' }. Tolera formatos sin guion o
// con datos inesperados: en el peor caso, deja el prefijo en 'V' y conserva solo los dígitos.
function parseCedula(raw: string | null | undefined): { prefijo: 'V' | 'E'; numero: string } {
  if (!raw) return { prefijo: 'V', numero: '' }
  const match = raw.trim().match(/^([VE])-?(\d+)$/i)
  if (match) return { prefijo: match[1].toUpperCase() as 'V' | 'E', numero: match[2] }
  return { prefijo: 'V', numero: soloDigitos(raw) }
}

function initials(name?: string | null): string {
  if (!name || !name.trim()) return '·'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

export default function PerfilMedico() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<DoctorMeResponse | null>(null)
  const [specialties, setSpecialties] = useState<SpecialtyResponse[]>([])
  const [professionalTypes, setProfessionalTypes] = useState<ProfessionalTypeResponse[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [tab, setTab] = useState<Tab>('perfil')

  // Editable fields (baseline lives in `profile`, so the diff is computed on save).
  const [fullName, setFullName] = useState('')
  // La cédula se edita como prefijo (V/E) + número, igual que en el registro de médico. La
  // baseline `profile.cedula` viene como "V-12345678"; se descompone al hidratar y se recompone
  // al guardar.
  const [cedulaPrefijo, setCedulaPrefijo] = useState<'V' | 'E'>('V')
  const [cedulaNumero, setCedulaNumero] = useState('')
  const [license, setLicense] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  // Tipo de profesional: para source:'doctor' viene de la ficha (fijo); para source:'user' el
  // usuario lo elige, y con él decidimos SACS (Médico) vs FPV (Psicólogo) y lo mandamos en el PATCH.
  const [professionalTypeId, setProfessionalTypeId] = useState('')
  // Estado de la verificación en vivo al teclear la cédula (autocompleta nombre/licencia).
  const [verifState, setVerifState] = useState<'idle' | 'verifying' | 'found' | 'notfound'>('idle')

  // --- Ajustes: preferencias de notificación (se cargan la 1ª vez que se abre la pestaña) ---
  const [catalog, setCatalog] = useState<NotificationCatalog>({})
  const [prefs, setPrefs] = useState<NotificationPrefs>({})
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsNotice, setPrefsNotice] = useState<Notice | null>(null)

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function hydrateForm(p: DoctorMeResponse) {
    setProfile(p)
    setFullName(p.full_name || '')
    const { prefijo, numero } = parseCedula(p.cedula)
    setCedulaPrefijo(prefijo)
    setCedulaNumero(numero)
    setLicense(p.license || '')
    setSpecialtyId(p.specialty_id || '')
    setProfessionalTypeId(p.professional_type_id || '')
    setVerifState('idle')
  }

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login-medico')
      return
    }
    const accessToken = sessionData.session.access_token

    try {
      // Los catálogos son públicos; el perfil necesita el Bearer. Se cargan en paralelo.
      const [me, specs, types] = await Promise.all([
        fetchMyDoctorProfile(accessToken),
        fetchSpecialties(),
        fetchProfessionalTypes()
      ])
      hydrateForm(me)
      setSpecialties(specs)
      setProfessionalTypes(types)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await supabase.auth.signOut()
        router.push('/login-medico')
        return
      }
      if (e instanceof ApiError && e.status === 404) {
        setNotice({
          kind: 'info',
          text: 'Tu cuenta no es de médico, así que no tienes un perfil profesional para editar.'
        })
      } else {
        setNotice({
          kind: 'danger',
          text: e instanceof Error ? e.message : 'No se pudo cargar tu perfil.'
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Carga perezosa de las preferencias al abrir Ajustes. Inicializa el estado local con TODOS los
  // eventos/canales del catálogo (opt-out: ausente = activado).
  async function loadPrefs() {
    if (prefsLoaded) return
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    try {
      const { prefs: saved, catalog: cat } = await fetchNotificationPrefs(sess.session.access_token)
      const init: NotificationPrefs = {}
      for (const [event, channels] of Object.entries(cat)) {
        init[event] = {}
        for (const ch of channels) {
          const val = saved[event]?.[ch as 'push' | 'email']
          init[event][ch as 'push' | 'email'] = val !== false // default activado
        }
      }
      setCatalog(cat)
      setPrefs(init)
      setPrefsLoaded(true)
    } catch (e) {
      setPrefsNotice({
        kind: 'danger',
        text: e instanceof Error ? e.message : 'No se pudieron cargar tus preferencias.'
      })
    }
  }

  function openTab(next: Tab) {
    setTab(next)
    if (next === 'ajustes') loadPrefs()
  }

  function togglePref(event: string, channel: string) {
    setPrefs((p) => ({
      ...p,
      [event]: { ...p[event], [channel]: !p[event]?.[channel as 'push' | 'email'] }
    }))
  }

  async function savePrefs() {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return
    setPrefsSaving(true)
    setPrefsNotice(null)
    try {
      await saveNotificationPrefs(prefs, sess.session.access_token)
      setPrefsNotice({ kind: 'success', text: 'Preferencias guardadas.' })
    } catch (e) {
      setPrefsNotice({
        kind: 'danger',
        text: e instanceof Error ? e.message : 'No se pudieron guardar tus preferencias.'
      })
    } finally {
      setPrefsSaving(false)
    }
  }

  // source:'user' (cuenta de Google que eligió rol médico) todavía no tiene ficha ni cédula: elige
  // su tipo de profesional aquí y con eso completa el registro. source:'doctor' ya tiene el tipo
  // fijo en la ficha (el backend ignora professional_type_id en el PATCH).
  const isUserSource = profile?.source === 'user'
  const perfilIncompleto = !profile?.cedula?.trim()
  const tipoProfesionalNombre = isUserSource
    ? professionalTypes.find((t) => t.id === professionalTypeId)?.name || ''
    : profile?.professional_type || ''
  const requiereVerificacion =
    tipoProfesionalNombre === 'Médico' || tipoProfesionalNombre === 'Psicólogo'
  const cedulaDisabled = isUserSource && !professionalTypeId
  const datosBloqueados = verifState === 'found'

  // Busca la cédula en SACS/FPV al salir del campo y autocompleta nombre/licencia, igual que el
  // registro. Solo aplica a Médico (SACS) y Psicólogo (FPV); otros tipos no se verifican en línea.
  async function verificarCedulaEnVivo() {
    if (!requiereVerificacion || cedulaNumero.trim().length < 6) return
    setVerifState('verifying')
    try {
      const resp =
        tipoProfesionalNombre === 'Médico'
          ? await verificarSacs(`${cedulaPrefijo}-${cedulaNumero.trim()}`)
          : await verificarPsicologo(cedulaNumero.trim())
      if (resp.encontrado) {
        const nombre = [resp.nombre, resp.apellido].filter(Boolean).join(' ').trim()
        if (nombre) setFullName(nombre)
        if (resp.licencia) setLicense(resp.licencia)
        setVerifState('found')
      } else {
        setVerifState('notfound')
      }
    } catch (e) {
      console.error(e)
      setVerifState('notfound')
    }
  }

  // Only send the fields that actually changed: partial PATCH, and — critically — this avoids a
  // needless SACS/FPV re-verification when the cédula wasn't touched.
  function buildPayload(): DoctorSelfUpdate | null {
    if (!profile) return null
    const payload: DoctorSelfUpdate = {}
    if (fullName.trim() !== (profile.full_name || '')) payload.full_name = fullName.trim()
    if (license.trim() !== (profile.license || '')) payload.license = license.trim() || null
    if (specialtyId && specialtyId !== (profile.specialty_id || ''))
      payload.specialty_id = specialtyId
    const cedulaCompuesta = cedulaNumero.trim() ? `${cedulaPrefijo}-${cedulaNumero.trim()}` : ''
    if (cedulaCompuesta && cedulaCompuesta !== (profile.cedula || '')) {
      payload.cedula = cedulaCompuesta
      // El backend exige el tipo junto con la cédula para poder crear la ficha (source:'user').
      if (isUserSource) payload.professional_type_id = professionalTypeId
    }
    return payload
  }

  async function save() {
    if (!profile) return
    setNotice(null)

    if (!fullName.trim() || fullName.trim().length < 2) {
      setNotice({ kind: 'danger', text: 'El nombre completo debe tener al menos 2 caracteres.' })
      return
    }

    const payload = buildPayload()
    if (!payload || Object.keys(payload).length === 0) {
      setNotice({ kind: 'info', text: 'No hay cambios que guardar.' })
      return
    }

    if (payload.cedula && isUserSource && !professionalTypeId) {
      setNotice({
        kind: 'danger',
        text: 'Indica el tipo de profesional para verificar tu cédula.'
      })
      return
    }

    // Fetch a fresh token: on a long-open form the one from page load may have been rotated
    // by Supabase auto-refresh (or expired), which would 401 the PATCH for no real reason.
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login-medico')
      return
    }

    setSaving(true)
    try {
      const updated = await updateMyDoctorProfile(payload, sessionData.session.access_token)
      hydrateForm(updated)
      if (payload.cedula && updated.verified) {
        setNotice({
          kind: 'success',
          text: 'Perfil actualizado. Tu cédula se verificó contra SACS/FPV.'
        })
      } else if (payload.cedula && !updated.verified) {
        setNotice({
          kind: 'info',
          text: 'Guardamos tus datos, pero tu cédula no pudo verificarse automáticamente en SACS/FPV. Un administrador la revisará.'
        })
      } else {
        setNotice({ kind: 'success', text: 'Perfil actualizado.' })
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setNotice({ kind: 'danger', text: 'Esa cédula ya pertenece a otro médico.' })
      } else {
        setNotice({
          kind: 'danger',
          text: e instanceof Error ? e.message : 'No se pudo actualizar tu perfil.'
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page">
        <div className="container">
          <div className="card">Cargando...</div>
        </div>
      </main>
    )
  }

  const displayName = profile?.full_name || fullName || 'Mi cuenta'

  return (
    <>
      <Head>
        <title>Mi perfil — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="container">
          <div className="perfil-layout">
            <aside className="perfil-sidebar card">
              <div className="perfil-id">
                <div className="perfil-avatar" aria-hidden="true">
                  {initials(displayName)}
                </div>
                <div className="perfil-name">{displayName}</div>
              </div>
              <nav className="perfil-nav">
                <button
                  className={tab === 'perfil' ? 'is-active' : ''}
                  onClick={() => openTab('perfil')}
                >
                  Mi perfil
                </button>
                <button disabled title="Próximamente">
                  Disponibilidad
                </button>
                <button
                  className={tab === 'ajustes' ? 'is-active' : ''}
                  onClick={() => openTab('ajustes')}
                >
                  Ajustes
                </button>
                <button onClick={() => router.push('/panel-medico')}>Ir al panel</button>
              </nav>
            </aside>

            <section className="perfil-content card">
              {tab === 'perfil' && (
                <>
                  <h1 style={{ marginTop: 0 }}>Mi perfil</h1>
                  {profile && (
                    <p style={{ color: '#64748b', marginTop: 0 }}>
                      {profile.verified ? (
                        <span className="badge badge-green">Verificado</span>
                      ) : (
                        <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                          Sin verificar
                        </span>
                      )}
                    </p>
                  )}

                  {notice && (
                    <div className={`notice notice-${notice.kind}`} style={{ marginBottom: 14 }}>
                      {notice.text}
                    </div>
                  )}

                  {profile && (
                    <div className="grid">
                      {perfilIncompleto && (
                        <div className="notice notice-info">
                          Debes completar tu perfil profesional para usar el panel:
                          {isUserSource ? ' elige tu tipo,' : ''} ingresa tu cédula y la verificamos
                          contra SACS/FPV.
                        </div>
                      )}

                      {isUserSource && (
                        <div>
                          <label className="label">Tipo de profesional *</label>
                          <select
                            value={professionalTypeId}
                            onChange={(e) => {
                              setProfessionalTypeId(e.target.value)
                              setVerifState('idle')
                            }}
                          >
                            <option value="">Selecciona...</option>
                            {professionalTypes
                              .filter((t) => t.status === 'active')
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="label">Cédula / DNI {isUserSource ? '*' : ''}</label>
                        <div className="input-group">
                          <select
                            value={cedulaPrefijo}
                            onChange={(e) => {
                              setCedulaPrefijo(e.target.value as 'V' | 'E')
                              setVerifState('idle')
                            }}
                            disabled={cedulaDisabled}
                          >
                            <option value="V">V</option>
                            <option value="E">E</option>
                          </select>
                          <input
                            value={cedulaNumero}
                            onChange={(e) => {
                              setCedulaNumero(soloDigitos(e.target.value))
                              setVerifState('idle')
                            }}
                            onBlur={verificarCedulaEnVivo}
                            placeholder="Solo números"
                            inputMode="numeric"
                            maxLength={9}
                            disabled={cedulaDisabled}
                          />
                        </div>
                        {isUserSource && !professionalTypeId && (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                            Elige primero el tipo de profesional.
                          </p>
                        )}
                        {!isUserSource && profile.professional_type && (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                            Tipo de profesional: {profile.professional_type}
                          </p>
                        )}
                        {verifState === 'verifying' && (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                            Verificando cédula...
                          </p>
                        )}
                        {verifState === 'found' && (
                          <div className="notice notice-success" style={{ marginTop: 8 }}>
                            Cédula verificada ✓ Datos cargados automáticamente.
                          </div>
                        )}
                        {verifState === 'notfound' && (
                          <div className="notice notice-warning" style={{ marginTop: 8 }}>
                            No encontramos esta cédula en el registro. Puedes completar tus datos
                            manualmente.
                          </div>
                        )}
                        {!isUserSource && verifState === 'idle' && (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                            Cambiarla re-verifica tu registro contra SACS/FPV.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="label">Nombre completo *</label>
                        <input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          maxLength={200}
                          readOnly={datosBloqueados}
                        />
                        {datosBloqueados && (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                            Cargado desde SACS/FPV — no editable.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="label">Matrícula / colegiatura</label>
                        <input
                          value={license}
                          onChange={(e) => setLicense(e.target.value)}
                          maxLength={100}
                          readOnly={datosBloqueados}
                        />
                      </div>

                      <div>
                        <label className="label">Especialidad</label>
                        <select
                          value={specialtyId}
                          onChange={(e) => setSpecialtyId(e.target.value)}
                        >
                          <option value="">Selecciona una especialidad</option>
                          {specialties.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {profile.source === 'user' && profile.specialty && !specialtyId && (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                            Actual: {profile.specialty}
                          </p>
                        )}
                      </div>

                      <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {tab === 'disponibilidad' && (
                <>
                  <h1 style={{ marginTop: 0 }}>Disponibilidad</h1>
                  <div className="notice notice-info">Próximamente.</div>
                </>
              )}

              {tab === 'ajustes' && (
                <>
                  <h1 style={{ marginTop: 0 }}>Ajustes de notificaciones</h1>
                  <p style={{ color: '#64748b', marginTop: -6 }}>
                    Elige qué avisos recibir y por qué canal, para que el sistema no sea invasivo.
                    Las notificaciones al teléfono/navegador requieren permiso del navegador y
                    llegan con la app abierta; el correo es el canal más confiable.
                  </p>

                  {prefsNotice && (
                    <div
                      className={`notice notice-${prefsNotice.kind}`}
                      style={{ marginBottom: 14 }}
                    >
                      {prefsNotice.text}
                    </div>
                  )}

                  {!prefsLoaded ? (
                    <p style={{ color: '#64748b' }}>Cargando preferencias...</p>
                  ) : (
                    <>
                      {Object.entries(catalog).map(([event, channels]) => (
                        <div key={event} className="pref-row">
                          <div style={{ minWidth: 0 }}>
                            <strong>{EVENT_LABELS[event]?.label || event}</strong>
                            <div style={{ color: '#64748b', fontSize: 13 }}>
                              {EVENT_LABELS[event]?.desc || ''}
                            </div>
                          </div>
                          <div className="pref-toggles">
                            {channels.map((ch) => (
                              <label key={ch} className="pref-toggle">
                                <input
                                  type="checkbox"
                                  checked={!!prefs[event]?.[ch as 'push' | 'email']}
                                  onChange={() => togglePref(event, ch)}
                                />
                                {CHANNEL_LABELS[ch] || ch}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        className="btn btn-primary"
                        onClick={savePrefs}
                        disabled={prefsSaving}
                        style={{ marginTop: 14 }}
                      >
                        {prefsSaving ? 'Guardando...' : 'Guardar preferencias'}
                      </button>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .perfil-layout {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .perfil-sidebar {
          width: 240px;
          flex-shrink: 0;
          padding: 16px;
        }
        .perfil-content {
          flex: 1;
          min-width: 0;
        }
        .perfil-id {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .perfil-avatar {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          background: #0f6e56;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
        }
        .perfil-name {
          font-weight: 700;
          text-align: center;
          word-break: break-word;
        }
        .perfil-nav {
          display: flex;
          flex-direction: column;
          margin-top: 12px;
        }
        .perfil-nav button {
          text-align: left;
          padding: 12px 10px;
          background: none;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          cursor: pointer;
          color: #0f172a;
        }
        .perfil-nav button:hover:not(:disabled) {
          background: #f1f5f9;
        }
        .perfil-nav button.is-active {
          background: #ecfdf5;
          color: #0f6e56;
          font-weight: 700;
        }
        .perfil-nav button:disabled {
          color: #cbd5e1;
          cursor: not-allowed;
        }
        .pref-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 14px 0;
          border-top: 1px solid var(--border, #e2e8f0);
          flex-wrap: wrap;
        }
        .pref-toggles {
          display: flex;
          gap: 16px;
          flex-shrink: 0;
        }
        .pref-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: #334155;
          cursor: pointer;
        }
        @media (max-width: 720px) {
          .perfil-layout {
            flex-direction: column;
          }
          .perfil-sidebar {
            width: 100%;
          }
        }
      `}</style>
    </>
  )
}
