import Seo from '../components/Seo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyConsultations, fetchMyProfile, MyConsultation } from '../lib/consultations'
import { fetchMyPatients, markEnteredCall } from '../lib/patients'
import { resolvePostLoginRoute } from '../lib/postLogin'
import { STATUS_LABELS } from '../lib/utils'
import { requestNotifyPermission, scheduleLocalReminders } from '../lib/nativeNotifications'
import CalendarSync from '../components/CalendarSync'
import AntesDeEntrarModal from '../components/AntesDeEntrarModal'
import { downloadIcs } from '../lib/calendar'
import { browserRoomUrl } from '../lib/jitsi'
import { trackPatientInRoom } from '../lib/patientPresence'

// Estados en los que entrar a la sala todavía significa algo. Son los MISMOS dos que usa el
// backend para decidir si cuenta la entrada del paciente (`_HEARTBEAT_OPEN_STATUSES` en
// services/consultations.py): un caso cerrado o derivado conserva su `video_room_url` en la base,
// y ofrecer ahí un botón mandaría al paciente a una sala a la que no va a entrar nadie.
const SALA_ABIERTA = new Set(['waiting', 'in_progress'])

function puedeEntrarASala(c: MyConsultation): boolean {
  return Boolean(c.video_room_url) && SALA_ABIERTA.has(c.status)
}

export default function MiCaso() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [consultations, setConsultations] = useState<MyConsultation[]>([])
  // La consulta cuya sala pidió abrir (mientras el modal de instrucciones está arriba).
  const [salaPendiente, setSalaPendiente] = useState<MyConsultation | null>(null)
  // La consulta cuya sala ya abrió. Mientras esta página siga abierta, se anuncia al médico que
  // el paciente está en sala (mismo criterio que `/sala-espera`, que anuncia mientras ELLA está
  // abierta y no mientras lo está la pestaña de Jitsi — que no hay forma de vigilar).
  const [enSala, setEnSala] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Presencia en vivo por Realtime (sin BD ni polling): es lo que pinta el badge "● En sala" en
  // el panel del médico. Sin esto, un paciente que entra desde aquí en vez de desde la sala de
  // espera le aparecería al médico como "○ Sin conexión" estando dentro de la sala.
  useEffect(() => {
    if (!enSala) return
    return trackPatientInRoom(enSala)
  }, [enSala])

  // Abre la sala. Va DENTRO del clic de "Entendido" del modal para que `window.open` siga siendo
  // parte de un gesto del usuario; fuera de él, el navegador lo bloquea como pop-up.
  function abrirSala() {
    const consulta = salaPendiente
    setSalaPendiente(null)
    if (!consulta?.video_room_url) return
    setEnSala(consulta.id)
    // La ventana se abre PRIMERO y sin esperar a nada: en cuanto haya un `await` de por medio,
    // el navegador deja de considerar esto un gesto del usuario y bloquea el pop-up.
    window.open(browserRoomUrl(consulta.video_room_url), '_blank', 'noopener,noreferrer')
    // Y después se registra que entró. Es lo que el médico ve en su panel ("entró a la
    // videollamada"): la presencia por Realtime se cae en cuanto esta pestaña pasa a segundo
    // plano, que es exactamente lo que ocurre al abrir la sala desde un móvil. Fire-and-forget:
    // que no se registre no puede impedir que el paciente entre a su consulta.
    marcarEntrada(consulta.id)
  }

  async function marcarEntrada(consultationId: string) {
    try {
      const { data } = await supabase.auth.getSession()
      // Sin token de sala: aquí el paciente llega con su sesión, y el backend la acepta como
      // credencial para SU propia consulta (require_consultation_token).
      await markEnteredCall(consultationId, undefined, data.session?.access_token)
    } catch (e) {
      console.error('No se pudo registrar la entrada a la videollamada:', e)
    }
  }

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
                      <strong>{c.category || 'Consulta'}</strong>
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
                  {c.referred_specialty && (
                    <p>
                      <span className="badge badge-blue">Derivado a {c.referred_specialty}</span>
                    </p>
                  )}
                  {/* El enlace PERMANENTE a la sala. El de `/sala-espera` vive en aquella pestaña
                      y se pierde al cerrarla; hasta ahora, quien la cerraba no tenía forma de
                      volver a entrar y el médico se encontraba una sala vacía. */}
                  {puedeEntrarASala(c) && (
                    <>
                      <button
                        className="btn btn-primary btn-full"
                        style={{ marginTop: 4 }}
                        onClick={() => setSalaPendiente(c)}
                      >
                        Unirse a la videoconsulta
                      </button>
                      <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0 0' }}>
                        {c.status === 'in_progress'
                          ? 'Un médico ya tomó tu caso y entra por esta misma sala.'
                          : 'Todavía estás en cola: puedes entrar y esperar dentro de la sala.'}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="notice notice-warning" style={{ marginTop: 14 }}>
            Si tu situación empeora o hay señales de alarma, busca atención presencial urgente.
          </div>
        </div>
      </main>

      <AntesDeEntrarModal
        open={salaPendiente !== null}
        onCancel={() => setSalaPendiente(null)}
        onConfirm={abrirSala}
      />
    </>
  )
}
