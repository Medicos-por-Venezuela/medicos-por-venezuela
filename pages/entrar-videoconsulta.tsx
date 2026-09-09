// Puente entre el correo "tu médico te está esperando" y la sala de Jitsi.
//
// El correo NO enlaza a Jitsi directamente, y este salto es el motivo: el paciente entraba a la
// sala sin que la plataforma se enterara, así que el médico —que ya estaba dentro esperándolo—
// seguía viendo "sin conexión" y no sabía si venía o no. Esta página registra la entrada
// (`entered_call_at`) y redirige sola; para el paciente es invisible.
//
// El registro va por JavaScript a propósito, y no por un redirect del backend: los escáneres de
// correo corporativos SIGUEN los enlaces de un mensaje para analizarlos, así que un `GET` que
// marcara la entrada daría "el paciente entró" por culpa de un robot y el médico se quedaría
// esperando a alguien que no ha abierto el correo. Un escáner no ejecuta JavaScript; una persona
// sí. Que la señal sea de fiar es justo lo que la hace útil.
//
// La URL de la sala NO viaja en la query: se pide al backend con el token. Un parámetro con el
// destino convertiría esta página en un redirector abierto (y dejaría el enlace del correo
// ilegible).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Seo from '../components/Seo'
import { browserRoomUrl } from '../lib/jitsi'
import { ensureVideoRoom, markEnteredCall } from '../lib/patients'

export default function EntrarVideoconsulta() {
  const router = useRouter()
  // Si algo falla, el paciente no puede quedarse mirando "Abriendo...": se le da el enlace a
  // mano. Llega aquí con un médico esperándolo en vivo, así que un callejón sin salida es lo
  // peor que puede pasar.
  const [sala, setSala] = useState('')
  const [error, setError] = useState('')

  // `router.isReady` y no un efecto de montaje a secas: en el primer render de una página
  // estática de Next la query viene vacía, y sin esperarla esto fallaría siempre con "enlace
  // incompleto" (mismo motivo por el que `/sala-espera` lo comprueba).
  useEffect(() => {
    if (!router.isReady) return
    const cid = typeof router.query.c === 'string' ? router.query.c : ''
    const token = typeof router.query.t === 'string' ? router.query.t : ''
    if (!cid || !token) {
      setError('El enlace está incompleto. Entra desde “Seguir mi caso” con tu cuenta.')
      return
    }
    entrar(cid, token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  async function entrar(cid: string, token: string) {
    let url = ''
    try {
      // Idempotente: si la sala ya existe (que es el caso — el correo solo sale si la hay),
      // devuelve la misma.
      url = (await ensureVideoRoom(cid, token)).video_room_url || ''
    } catch {
      setError('Este enlace ya caducó. Entra desde “Seguir mi caso” con tu cuenta.')
      return
    }
    if (!url) {
      setError('Todavía no hay una sala para tu consulta. Entra desde “Seguir mi caso”.')
      return
    }
    // Se ESPERA a que quede registrada la entrada antes de redirigir: es el único momento en que
    // se puede: al cambiar de página el navegador aborta las peticiones en vuelo. Si falla, se
    // sigue igual — llevar al paciente a su médico importa más que la señal.
    await markEnteredCall(cid, token).catch(() => {})
    setSala(browserRoomUrl(url))
    window.location.replace(browserRoomUrl(url))
  }

  return (
    <>
      <Seo
        titulo="Entrando a tu videoconsulta — Médicos por Venezuela"
        descripcion="Te estamos llevando a la sala de tu videoconsulta."
        ruta="/entrar-videoconsulta"
        noindex
      />
      <main className="page">
        <div className="narrow">
          <div className="card">
            {error ? (
              <>
                <h1>No pudimos abrir tu videoconsulta</h1>
                <p>{error}</p>
                <Link className="btn btn-primary btn-full" href="/mi-caso">
                  Ir a “Seguir mi caso”
                </Link>
              </>
            ) : (
              <>
                <h1>Abriendo tu videoconsulta…</h1>
                <p>Tu médico te está esperando en la sala. Esto tarda un segundo.</p>
                {/* Si `location.replace` no llegó a ejecutarse (o el navegador lo bloqueó), este
                    enlace ya tiene la sala real y el paciente entra igual con un clic. */}
                {sala && (
                  <a className="btn btn-primary btn-full" href={sala}>
                    Entrar ahora
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
