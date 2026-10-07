import Seo from '../components/Seo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyConsultations, fetchMyProfile, MyConsultation } from '../lib/consultations'
import { fetchMyPatients } from '../lib/patients'
import { resolvePostLoginRoute } from '../lib/postLogin'
import { STATUS_LABELS } from '../lib/utils'
import { requestNotifyPermission, scheduleLocalReminders } from '../lib/nativeNotifications'
import CalendarSync from '../components/CalendarSync'
import SalaEsperaEnVivo from '../components/SalaEsperaEnVivo'
import { downloadIcs } from '../lib/calendar'
import { trackPatientInRoom } from '../lib/patientPresence'
import { useWaitingRoom } from '../lib/waitingRoom'
import HiloMensajes from '../components/mensajes/HiloMensajes'

// Casos en los que el paciente sigue la sala en vivo: en cola, en atención o CITA AGENDADA (el
// médico la inicia al entrar a la videollamada y la sala pasa a `ready` sin recargar).
//
// Esta pantalla NO da acceso a la videoconsulta. Tuvo un botón de entrada que aparecía con
// `phase === 'ready'`, o sea en cuanto un médico TOMABA el caso, y tomar un caso no es estar en la
// sala: el médico puede tomarlo para responder por escrito. El acceso vive en el aviso del hilo
// (R16), que solo existe cuando el médico inicia la videoconsulta de verdad. Ver
// `components/SalaEsperaEnVivo.tsx`.
const CASO_ABIERTO = new Set(['waiting', 'in_progress', 'contacted_whatsapp', 'scheduled'])

export default function MiCaso() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [consultations, setConsultations] = useState<MyConsultation[]>([])
  const [conSesion, setConSesion] = useState(false)
  const [token, setToken] = useState('')
  // El hilo de mensajes que el paciente tiene abierto (ver `hiloVisible` más abajo).
  const [hiloAbierto, setHiloAbierto] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El caso abierto que esta página sigue en vivo (normalmente hay uno solo).
  const casoAbiertoVigente = consultations.find((c) => CASO_ABIERTO.has(c.status))?.id || ''

  // Presencia en vivo por Realtime (sin BD ni polling): es lo que habilita el botón de cámara del
  // médico, que está gateado por "el paciente no está conectado" para no llamar a una sala vacía.
  //
  // Antes la disparaba el botón de entrada de esta página: solo se anunciaba el paciente que YA
  // había abierto la sala. Al retirar ese botón, nadie la disparaba, y un paciente que sigue su
  // caso desde aquí le aparecía al médico como "Aún no ha entrado" para siempre — es decir, el
  // médico no podía llamarlo desde el chat, que es justo la vía que ahora sustituye al botón. Se
  // anuncia mientras ESTA página está abierta, el mismo criterio que `/sala-espera`.
  useEffect(() => {
    if (!casoAbiertoVigente) return
    return trackPatientInRoom(casoAbiertoVigente)
  }, [casoAbiertoVigente])

  // Recordatorio nativo ~30 min antes de las citas agendadas del paciente (solo con la pestaña
  // abierta; el email del backend es el canal confiable). Re-programa al cambiar sus consultas.
  useEffect(() => {
    requestNotifyPermission()
    return scheduleLocalReminders(
      consultations
        .filter((c) => c.status === 'scheduled' && c.scheduled_at)
        .map((c) => ({
          when: new Date(c.scheduled_at as string),
          title: 'Tu cita médica es pronto',
          body: `${c.category || 'Consulta'} · ${new Date(c.scheduled_at as string).toLocaleString(
            'es-VE'
          )}`
        }))
    )
  }, [consultations])

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    // Todo por el backend (no lecturas directas a Supabase): rol/estado por /auth/me, y los datos
    // del paciente + sus consultas por sus endpoints (el backend los scopea a la propia cuenta).
    const token = session.access_token
    setConSesion(true)
    setToken(token)
    try {
      const profile = await fetchMyProfile(token)
      // Mismo resolvedor que /login y /auth/callback: si a este usuario le toca otro sitio, se va
      // allí. Antes esta página tenía su propia copia con isAdminRole() (rol legacy, uno solo), que
      // mandaba al panel a un médico que además es admin en user_roles.
      const route = resolvePostLoginRoute(profile)
      if (route.kind === 'blocked') {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }
      if (route.href !== '/mi-caso') {
        router.replace(route.href)
        return
      }
      setAuthed(true)
      const [patients, cons] = await Promise.all([
        fetchMyPatients(token),
        fetchMyConsultations(token)
      ])
      if (patients.length) setPatientName(patients[0].full_name)
      setConsultations(cons)
    } catch (e) {
      console.error(e)
      setAuthed(true) // sesión válida; si el backend falla, mostramos el portal sin datos
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // El `noindex` se declara ANTES del return temprano de carga, y no solo dentro del arbol final.
  // En el servidor el estado inicial es siempre "cargando", asi que el HTML que recibe un crawler
  // es SIEMPRE esa pantalla. Con el <Seo> unicamente en la rama de abajo, esa respuesta salia con
  // el <head> vacio: sin `noindex`, sin `<title>` y con un 200. El `Disallow` de robots.txt pide
  // que no se rastree, pero una URL enlazada desde fuera puede acabar indexada igualmente --el
  // propio comentario de robots.txt explica por que hacen falta las dos senales-- y estas rutas
  // no tienen gate en servidor: responden 200 y el control de acceso llega tras la hidratacion.
  const seo = (
    <Seo
      titulo="Seguir mi caso — Médicos por Venezuela"
      descripcion={'Consulta el estado de tu solicitud y el enlace de tu videoconsulta.'}
      ruta="/mi-caso"
      noindex
    />
  )

  if (loading)
    return (
      <>
        {seo}
        <main className="page">
          <div className="narrow">
            <div className="card">Cargando...</div>
          </div>
        </main>
      </>
    )

  // Sin sesión, load() ya disparó el redirect a /login (la puerta única del sitio).
  // Esta página es solo el portal del paciente; ya no aloja un formulario propio.
  // Devuelve el <Seo> y no `null`: no pinta nada visible, pero deja el `noindex` en el <head>
  // durante el instante en que el redirect está en vuelo.
  if (!authed) return seo

  // Qué hilo de mensajes está montado. `null` = el paciente no ha tocado nada todavía, así que se
  // abre el de su consulta vigente (la primera abierta, o la primera de la lista); `''` = lo cerró
  // a mano. Es un valor derivado a propósito: nada de `setState` en un effect.
  const consultaVigente = casoAbiertoVigente || consultations[0]?.id || ''
  const hiloVisible = hiloAbierto === null ? consultaVigente : hiloAbierto

  return (
    <>
      {seo}
      <main className="page">
        <div className="narrow">
          <div className="topbar">
            <div>
              <h1 style={{ margin: 0 }}>Mi caso</h1>
              {patientName && <p style={{ margin: 0, color: '#64748b' }}>{patientName}</p>}
            </div>
            <button className="btn btn-muted" onClick={logout}>
              Salir
            </button>
          </div>

          {consultations.some((c) => c.status === 'scheduled') && (
            <div className="card" style={{ marginBottom: 14 }}>
              <CalendarSync hint="Agrega tus citas a Google Calendar, iPhone/Apple u otra app y se sincronizan solas. No compartas la URL: da acceso a tus citas." />
            </div>
          )}

          {consultations.length === 0 ? (
            <div className="card">
              <p style={{ color: '#64748b' }}>
                Todavía no tienes solicitudes registradas con esta cuenta.
              </p>
              <Link className="btn btn-primary" href="/registro-paciente">
                Solicitar consulta
              </Link>
            </div>
          ) : (
            <div className="grid">
              {consultations.map((c) => (
                <div key={c.id} className="card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      alignItems: 'start'
                    }}
                  >
                    <div>
                      <strong>{c.specialty || c.category || 'Consulta'}</strong>
                      <div style={{ color: '#64748b', fontSize: 13 }}>Código {c.code}</div>
                    </div>
                    <span className="badge badge-green">{STATUS_LABELS[c.status] || c.status}</span>
                  </div>
                  {c.status === 'scheduled' && c.scheduled_at && (
                    <p style={{ margin: '6px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge badge-blue">
                        🗓 Cita agendada: {new Date(c.scheduled_at).toLocaleString('es-VE')}
                      </span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '2px 10px', fontSize: 13 }}
                        onClick={() =>
                          downloadIcs({
                            uid: `${c.id}@medicosporvenezuela.org`,
                            start: new Date(c.scheduled_at as string),
                            title: `Cita médica${c.category ? ` · ${c.category}` : ''}`,
                            description: `Motivo: ${c.chief_complaint || 'N/D'}\nCódigo: ${c.code}`
                          })
                        }
                      >
                        Agregar a calendario
                      </button>
                    </p>
                  )}
                  {c.chief_complaint && <p style={{ color: '#475569' }}>{c.chief_complaint}</p>}
                  {c.derived_from_specialty && (
                    <p>
                      <span className="badge badge-blue">
                        Derivado desde {c.derived_from_specialty}
                      </span>
                    </p>
                  )}
                  {c.status === 'referred_to_specialist' && (
                    <p style={{ color: '#64748b', fontSize: 13 }}>
                      Tu médico te derivó a un especialista. Sigue el estado en tu solicitud nueva,
                      no hace falta que vuelvas a registrarte.
                    </p>
                  )}
                  {/* La sala EN VIVO: dice si ya hay médico y solo entonces ofrece entrar. Es el
                      enlace permanente a la sala: el de `/sala-espera` vive en aquella pestaña.
                      En una cita agendada no repite el aviso (la tarjeta ya trae la fecha y el
                      botón de calendario); sí mantiene el stream, que es lo que hace aparecer el
                      botón apenas el médico inicia la cita. */}
                  {CASO_ABIERTO.has(c.status) && conSesion && (
                    <SalaDeLaConsulta
                      consultationId={c.id}
                      ocultarAgendada={c.status === 'scheduled'}
                    />
                  )}

                  {/* Hilo de mensajes con el médico (U3 - Paciente con cuenta).
                      Se monta SOLO el hilo abierto: cada `HiloMensajes` sondea la API cada 8 s,
                      así que montarlos todos a la vez ponía N bucles en marcha en una pantalla
                      donde el paciente lee uno. El de la consulta vigente viene abierto. */}
                  <div style={{ marginTop: 16 }}>
                    {hiloVisible === c.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-muted"
                          style={{ marginBottom: 10, padding: '8px 14px', fontSize: 14 }}
                          onClick={() => setHiloAbierto('')}
                          aria-expanded={true}
                          aria-controls={`hilo-${c.id}`}
                        >
                          Ocultar mensajes
                        </button>
                        <div id={`hilo-${c.id}`}>
                          <HiloMensajes
                            consultationId={c.id}
                            currentUserRole="patient"
                            auth={{ token }}
                            isCaseClosed={!CASO_ABIERTO.has(c.status)}
                          />
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-full"
                        onClick={() => setHiloAbierto(c.id)}
                        aria-expanded={false}
                      >
                        Ver mensajes con mi médico
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="notice notice-warning" style={{ marginTop: 14 }}>
            Si tu situación empeora o hay señales de alarma, busca atención presencial urgente.
          </div>
        </div>
      </main>
    </>
  )
}

// Una suscripción por caso abierto (normalmente uno). Componente aparte porque el hook va por caso.
const CON_SESION = { useSession: true }

function SalaDeLaConsulta({
  consultationId,
  ocultarAgendada
}: {
  consultationId: string
  ocultarAgendada?: boolean
}) {
  const { state, error } = useWaitingRoom(consultationId, CON_SESION)
  return (
    <div style={{ marginTop: 8 }}>
      <SalaEsperaEnVivo state={state} error={error} ocultarAgendada={ocultarAgendada} />
    </div>
  )
}
