import Seo from '../components/Seo'
import AntesDeEntrarModal from '../components/AntesDeEntrarModal'
import SalaEsperaEnVivo from '../components/SalaEsperaEnVivo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { browserRoomUrl } from '../lib/jitsi'
import { markEnteredCall } from '../lib/patients'
import { trackPatientInRoom } from '../lib/patientPresence'
import { supabase } from '../lib/supabase'
import { useWaitingRoom, type WaitingRoomAccess } from '../lib/waitingRoom'

// El token de sala se guarda en sessionStorage (por pestaña) y se BORRA de la URL: una credencial
// en la barra de direcciones acaba en el historial, en el `Referer` y en cualquier captura que el
// paciente comparta. Sin guardarlo, recargar la página dejaba la sala sin credencial.
const TOKEN_KEY = (cid: string) => `mpv-sala:${cid}`

function leerToken(cid: string): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY(cid)) || ''
  } catch {
    return ''
  }
}

function guardarToken(cid: string, token: string) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY(cid), token)
  } catch {
    // Sin sessionStorage (modo privado estricto): la sala funciona igual hasta recargar.
  }
}

export default function SalaEspera() {
  const router = useRouter()
  const nombreUrl = typeof router.query.nombre === 'string' ? router.query.nombre : ''
  const cid = typeof router.query.cid === 'string' ? router.query.cid : ''
  const [showWarning, setShowWarning] = useState(false)
  const [access, setAccess] = useState<WaitingRoomAccess | null>(null)

  // Credencial: el token del enlace (registro o correo) o, si no hay, la sesión del paciente con
  // cuenta. Se resuelve una vez que el router tiene la query.
  useEffect(() => {
    if (!router.isReady || !cid) return
    const t = typeof router.query.t === 'string' ? router.query.t : ''
    if (t) {
      guardarToken(cid, t)
      const url = new URL(window.location.href)
      url.searchParams.delete('t')
      window.history.replaceState(null, '', url.toString())
    }
    const roomToken = t || leerToken(cid)
    setAccess(roomToken ? { roomToken } : { useSession: true })
  }, [router.isReady, cid, router.query.t])

  const { state, error } = useWaitingRoom(cid || null, access)
  // Si lo derivaron, el caso vigente es otro: su token es el que sirve para marcar la entrada.
  const vigenteId = state?.consultation_id || cid
  const vigenteToken = state?.access_token || access?.roomToken

  useEffect(() => {
    if (state?.access_token && state.consultation_id !== cid) {
      guardarToken(state.consultation_id, state.access_token)
    }
  }, [state?.access_token, state?.consultation_id, cid])

  // Abre la sala desde el "Entendido" del aviso: `window.open` necesita el gesto del usuario.
  const openRoom = () => {
    setShowWarning(false)
    if (!state?.video_room_url) return
    // La ventana PRIMERO: tras un `await` el navegador ya no lo considera un gesto del usuario.
    window.open(browserRoomUrl(state.video_room_url), '_blank', 'noopener,noreferrer')
    // Después se registra que entró (el médico lo ve en su panel), sin bloquear nada.
    marcarEntrada()
  }

  async function marcarEntrada() {
    try {
      const sessionToken = vigenteToken
        ? undefined
        : (await supabase.auth.getSession()).data.session?.access_token
      await markEnteredCall(vigenteId, vigenteToken, sessionToken)
    } catch (e) {
      console.error('Error marcando entrada a la videollamada:', e)
    }
  }

  // Mientras esta página está abierta, el paciente se anuncia "en sala" por Realtime Presence: el
  // médico lo ve en vivo. Con el caso VIGENTE, para que al especialista también le aparezca.
  useEffect(() => {
    if (!vigenteId) return
    return trackPatientInRoom(vigenteId)
  }, [vigenteId])

  const nombre = state?.patient_first_name || nombreUrl || 'paciente'

  return (
    <>
      <Seo
        titulo="Sala de espera — Médicos por Venezuela"
        descripcion={
          'Tu solicitud está registrada. Aquí verás cuándo un médico toma tu caso para entrar a ' +
          'la videoconsulta.'
        }
        ruta="/sala-espera"
        noindex
      />
      <main className="page">
        <div className="narrow">
          <div className="card">
            <span className="badge badge-green">Solicitud recibida</span>
            <h1>Gracias, {nombre}</h1>

            {cid ? (
              <SalaEsperaEnVivo state={state} error={error} onEnter={() => setShowWarning(true)} />
            ) : (
              <div className="notice notice-warning">
                No encontramos los datos de tu sala. <Link href="/login">Inicia sesión</Link> y
                entra a <strong>Mi caso</strong> para ver el estado de tu solicitud.
              </div>
            )}

            {state?.code && (
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 12 }}>
                Tu código de caso es <strong>{state.code}</strong>. Con tu cuenta puedes volver a
                ver este estado desde <Link href="/mi-caso">Mi caso</Link>.
              </p>
            )}

            <div className="notice notice-info" style={{ marginTop: 12 }}>
              <strong>Para que la videoconsulta funcione bien:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>
                  Al abrir el enlace, elige <strong>“Continuar en el navegador”</strong> (no
                  necesitas descargar la app).
                </li>
                <li>
                  Pulsa <strong>“Permitir”</strong> cuando te pida cámara y micrófono.
                </li>
                <li>
                  Busca un lugar con <strong>mejor señal móvil</strong> y lo más{' '}
                  <strong>silencioso</strong> posible.
                </li>
                <li>
                  Procura estar <strong>a solas</strong> para proteger tu privacidad (salvo consulta
                  de un niño/a, donde debe acompañarte un adulto responsable).
                </li>
              </ul>
            </div>

            <div className="notice notice-warning" style={{ margin: '16px 0' }}>
              Si tu situación empeora o hay señales de alarma, busca atención presencial urgente. No
              esperes a que un médico tome tu caso.
            </div>
            <Link className="btn btn-muted" href="/">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>

      <AntesDeEntrarModal
        open={showWarning}
        onCancel={() => setShowWarning(false)}
        onConfirm={openRoom}
      />
    </>
  )
}
