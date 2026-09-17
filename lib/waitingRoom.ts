// Sala de espera EN VIVO del paciente (`/sala-espera` y `/mi-caso`).
//
// El paciente solo debe ver "Entrar a la videoconsulta" cuando un médico tomó su caso: antes la
// sala se le mostraba desde el registro y entraba a una videollamada vacía. La API responde en qué
// punto está el caso (`GET /consultations/{id}/waiting-room`) y empuja los cambios por SSE
// (`/waiting-room/stream`).
//
// Stream con `fetch` y no con `EventSource`: `EventSource` no puede mandar cabeceras, y el token
// de sala tendría que ir en la URL, que es justo lo que el proyecto evita (queda en logs de
// proxies y en el historial). Si el stream falla, se cae a pedir el JSON cada 15 s.
//
// Si al paciente lo derivaron, la API responde por el caso VIGENTE (`consultation_id` distinto del
// pedido) y trae un `access_token` para él: con eso se marca la entrada a la videollamada del
// especialista.
import { useEffect, useState } from 'react'
import { API_URL, ApiError, getJson } from './apiClient'
import { supabase } from './supabase'

export type WaitingRoomPhase = 'waiting' | 'ready' | 'scheduled' | 'finished'

export interface WaitingRoomState {
  consultation_id: string
  code: string
  status: string
  phase: WaitingRoomPhase
  specialty: string | null
  derived_from_specialty: string | null
  doctor_name: string | null
  video_room_url: string | null
  scheduled_at: string | null
  patient_first_name: string | null
  access_token: string | null
}

// Credencial: el token de sala (paciente anónimo) o la sesión del paciente con cuenta.
export interface WaitingRoomCredentials {
  roomToken?: string
  sessionToken?: string
}

// Lo que se le pasa al hook: el token de sala, o `useSession` para ir con la sesión del paciente.
// La sesión NO se pasa como token fijo: una espera dura más que un access_token de Supabase (1 h),
// y con uno caducado la API responde 401 aunque el paciente siga teniendo derecho a su sala. Por eso
// se pide fresca en cada conexión. Con token de sala no se manda la sesión: un JWT caducado haría
// fallar la petición entera.
export interface WaitingRoomAccess {
  roomToken?: string
  useSession?: boolean
}

async function resolveCredentials(access: WaitingRoomAccess): Promise<WaitingRoomCredentials> {
  if (access.roomToken) return { roomToken: access.roomToken }
  if (!access.useSession) return {}
  const { data } = await supabase.auth.getSession()
  return { sessionToken: data.session?.access_token }
}

// Por qué no se puede mostrar el estado: el enlace caducó (401) o el caso ya no existe (404).
export type WaitingRoomError = 'unauthorized' | 'gone' | null

const FALLBACK_POLL_MS = 15_000
const RECONNECT_MS = 1_500

function headersFor(creds: WaitingRoomCredentials): Record<string, string> {
  const headers: Record<string, string> = {}
  if (creds.roomToken) headers['X-Consultation-Token'] = creds.roomToken
  if (creds.sessionToken) headers.Authorization = `Bearer ${creds.sessionToken}`
  return headers
}

export async function fetchWaitingRoom(
  consultationId: string,
  creds: WaitingRoomCredentials
): Promise<WaitingRoomState> {
  const { sessionToken, roomToken } = creds
  return getJson<WaitingRoomState>(
    `/api/v1/consultations/${consultationId}/waiting-room`,
    'No se pudo consultar el estado de tu caso',
    sessionToken,
    roomToken ? { 'X-Consultation-Token': roomToken } : undefined
  )
}

type StreamEnd = 'ended' | 'gone' | 'unauthorized' | 'error' | 'aborted'

// Lee un stream SSE hasta que termina. Solo entiende lo que manda la API: `event: status` con el
// JSON del estado, `event: gone` y comentarios de latido (líneas que empiezan con `:`).
async function readStream(
  url: string,
  creds: WaitingRoomCredentials,
  signal: AbortSignal,
  onState: (state: WaitingRoomState) => void
): Promise<StreamEnd> {
  let res: Response
  try {
    res = await fetch(url, { headers: headersFor(creds), signal, cache: 'no-store' })
  } catch {
    return signal.aborted ? 'aborted' : 'error'
  }
  if (res.status === 401) return 'unauthorized'
  if (res.status === 404) return 'gone'
  if (!res.ok || !res.body) return 'error'

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return 'ended'
      buffer += decoder.decode(value, { stream: true })
      let cut = buffer.indexOf('\n\n')
      while (cut >= 0) {
        const block = buffer.slice(0, cut)
        buffer = buffer.slice(cut + 2)
        let event = 'message'
        const data: string[] = []
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data.push(line.slice(5).trim())
        }
        if (event === 'gone') return 'gone'
        if (event === 'status' && data.length) {
          try {
            onState(JSON.parse(data.join('\n')) as WaitingRoomState)
          } catch {
            // Un bloque ilegible no tumba la sala: el siguiente cambio llega completo.
          }
        }
        cut = buffer.indexOf('\n\n')
      }
    }
  } catch {
    return signal.aborted ? 'aborted' : 'error'
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      resolve()
    })
  })
}

// Estado en vivo de la sala. `consultationId` es el id que el paciente conoce (el del registro);
// la API sigue la cadena si lo derivaron. Sin id o sin credencial no hace nada.
export function useWaitingRoom(
  consultationId: string | null,
  access: WaitingRoomAccess | null
): { state: WaitingRoomState | null; error: WaitingRoomError } {
  const [state, setState] = useState<WaitingRoomState | null>(null)
  const [error, setError] = useState<WaitingRoomError>(null)
  const roomToken = access?.roomToken
  const useSession = access?.useSession

  useEffect(() => {
    if (!consultationId || (!roomToken && !useSession)) return
    const controller = new AbortController()
    const { signal } = controller
    const url = `${API_URL}/api/v1/consultations/${consultationId}/waiting-room/stream`

    ;(async () => {
      setError(null)
      let finished = false
      const apply = (next: WaitingRoomState) => {
        finished = next.phase === 'finished'
        setState(next)
      }
      while (!signal.aborted) {
        const credentials = await resolveCredentials({ roomToken, useSession })
        const end = await readStream(url, credentials, signal, apply)
        if (end === 'aborted') return
        if (end === 'unauthorized' || end === 'gone') {
          setError(end)
          return
        }
        if (finished) return
        if (end === 'ended') {
          // La API corta el stream a los pocos minutos a propósito: se reconecta.
          await wait(RECONNECT_MS, signal)
          continue
        }
        // Falló el stream (red, proxy que no lo deja pasar): el JSON como respaldo.
        try {
          apply(await fetchWaitingRoom(consultationId, credentials))
        } catch (e) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
            setError(e.status === 401 ? 'unauthorized' : 'gone')
            return
          }
        }
        if (finished) return
        await wait(FALLBACK_POLL_MS, signal)
      }
    })()

    return () => controller.abort()
  }, [consultationId, roomToken, useSession])

  return { state, error }
}
