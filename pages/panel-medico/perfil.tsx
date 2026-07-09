import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ApiError,
  DoctorMeResponse,
  DoctorSelfUpdate,
  SpecialtyResponse,
  fetchMyDoctorProfile,
  fetchSpecialties,
  updateMyDoctorProfile
} from '../../lib/doctors'

type Notice = { kind: 'info' | 'success' | 'danger'; text: string }

export default function PerfilMedico() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<DoctorMeResponse | null>(null)
  const [specialties, setSpecialties] = useState<SpecialtyResponse[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)

  // Editable fields (baseline lives in `profile`, so the diff is computed on save).
  const [fullName, setFullName] = useState('')
  const [cedula, setCedula] = useState('')
  const [license, setLicense] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function hydrateForm(p: DoctorMeResponse) {
    setProfile(p)
    setFullName(p.full_name || '')
    setCedula(p.cedula || '')
    setLicense(p.license || '')
    setSpecialtyId(p.specialty_id || '')
  }

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login-medico')
      return
    }
    const accessToken = sessionData.session.access_token

    try {
      // Specialties are public; the profile needs the Bearer token. Load both in parallel.
      const [me, specs] = await Promise.all([fetchMyDoctorProfile(accessToken), fetchSpecialties()])
      hydrateForm(me)
      setSpecialties(specs)
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

  // The 'user' source (Google / finalize-role, no doctors row) has no cédula and the backend
  // rejects editing it (400), so we lock that field for those profiles.
  const cedulaLocked = profile?.source === 'user'

  // Only send the fields that actually changed: partial PATCH, and — critically — this avoids a
  // needless SACS/FPV re-verification when the cédula wasn't touched.
  function buildPayload(): DoctorSelfUpdate | null {
    if (!profile) return null
    const payload: DoctorSelfUpdate = {}
    if (fullName.trim() !== (profile.full_name || '')) payload.full_name = fullName.trim()
    if (license.trim() !== (profile.license || '')) payload.license = license.trim() || null
    if (specialtyId && specialtyId !== (profile.specialty_id || ''))
      payload.specialty_id = specialtyId
    if (!cedulaLocked && cedula.trim() && cedula.trim() !== (profile.cedula || ''))
      payload.cedula = cedula.trim()
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
      setNotice({
        kind: 'success',
        text: payload.cedula
          ? 'Perfil actualizado. Tu cédula se re-verificó contra SACS/FPV.'
          : 'Perfil actualizado.'
      })
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

  return (
    <>
      <Head>
        <title>Mi perfil — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="narrow">
          <Link href="/panel-medico" className="link-button">
            ← Volver al panel
          </Link>

          <div className="card" style={{ marginTop: 14 }}>
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
                <div>
                  <label className="label">Nombre completo *</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="label">Cédula profesional</label>
                  <input
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="V-12345678 o E-12345678"
                    maxLength={20}
                    disabled={cedulaLocked}
                  />
                  {cedulaLocked ? (
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                      Tu cuenta se creó con Google/selección de rol, por lo que la cédula no se
                      edita aquí.
                    </p>
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                      Cambiarla re-verifica tu registro contra SACS/FPV.
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Matrícula / colegiatura</label>
                  <input
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="label">Especialidad</label>
                  <select value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
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
          </div>
        </div>
      </main>
    </>
  )
}
