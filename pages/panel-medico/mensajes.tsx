import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { fetchMyProfile } from '../../lib/consultations'
import {
  etiquetaUltimaDireccion,
  getInboxSummary,
  InboxThread,
  useInboxSignal
} from '../../lib/messages'
import { supabase } from '../../lib/supabase'
import { isPanelRole, tiempoTranscurrido } from '../../lib/utils'
import IndicadorPresenciaPaciente from '../../components/mensajes/IndicadorPresenciaPaciente'
import Seo from '../../components/Seo'
import { notify } from '../../lib/nativeNotifications'

export default function BuzonMensajes() {
  const router = useRouter()
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string>('')
  const prevUnreadRef = React.useRef<number>(-1)

  // Sesión y guard de rol: UNA sola vez. Antes esto vivía en el mismo effect que el buzón, con
  // `token` entre sus dependencias y un `setToken()` dentro: al llegar el token el effect se
  // reejecutaba entero (sesión + perfil + buzón). Ahora el token es la SALIDA de este effect y la
  // ENTRADA del de abajo.
  useEffect(() => {
    let mounted = true

    async function autenticar() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          router.push('/login')
          return
        }

        const accessToken = sessionData.session.access_token
        const me = await fetchMyProfile(accessToken)
        if (!me.active || !isPanelRole(me.role)) {
          router.push('/')
          return
        }

        if (mounted) setToken(accessToken)
      } catch {
        if (mounted) {
          setError('No se pudo verificar tu sesión')
          setLoading(false)
        }
      }
    }

    autenticar()

    return () => {
      mounted = false
    }
  }, [router])

  // Traer el buzón. Separado de aplicarlo para que el `setState` viva en el callback de la
  // promesa y no en el cuerpo de un effect (react-hooks/set-state-in-effect).
  const fetchBuzon = useCallback(
    () => getInboxSummary({ onlyUnread }, { token }),
    [onlyUnread, token]
  )

  const aplicarBuzon = useCallback((data: InboxThread[], avisarNuevos: boolean) => {
    const newUnread = data.reduce((acc, t) => acc + (t.unread_count || 0), 0)
    if (avisarNuevos && prevUnreadRef.current !== -1 && newUnread > prevUnreadRef.current) {
      // El sonido es opt-in en `notify` (no suena salvo que se pida): aquí sí se pide.
      notify('Nuevo mensaje en consulta', 'Tienes nuevos mensajes de pacientes en tu buzón.', {
        sound: true,
        soundKind: 'message'
      })
    }
    prevUnreadRef.current = newUnread
    setThreads(data)
    setError(null)
    setLoading(false)
  }, [])

  const aplicarErrorBuzon = useCallback(() => {
    setError('No se pudo cargar el buzón de mensajes')
    setLoading(false)
  }, [])

  const refrescarBuzon = useCallback(
    (avisarNuevos = false) => {
      fetchBuzon()
        .then((data) => aplicarBuzon(data, avisarNuevos))
        .catch(aplicarErrorBuzon)
    },
    [fetchBuzon, aplicarBuzon, aplicarErrorBuzon]
  )

  // Primera carga y recarga al cambiar el filtro. Ya no hay sondeo: lo que avisa de que algo
  // cambió es el stream de abajo.
  useEffect(() => {
    if (!token) return
    refrescarBuzon(false)
  }, [token, refrescarBuzon])

  // CA2.3: el buzón se suscribe a `GET /inbox/stream` y REFRESCA POR REST al recibir el evento
  // (CA8.3: la señal no trae cuerpos). Si el stream no está disponible, `useInboxSignal` emite
  // un tic cada 12 s y esto sigue funcionando como el sondeo anterior.
  useInboxSignal(Boolean(token), () => refrescarBuzon(true))

  const totalUnread = threads.reduce((acc, t) => acc + (t.unread_count || 0), 0)

  return (
    <>
      <Seo
        titulo="Buzón de Mensajes · Médicos por Venezuela"
        descripcion="Buzón de mensajería del médico para comunicarse con sus pacientes."
        ruta="/panel-medico/mensajes"
        noindex
      />

      <div
        className="container"
        style={{ maxWidth: '900px', margin: '24px auto', padding: '0 16px' }}
      >
        {/* Cabecera de navegación */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <Link
              href="/panel-medico"
              style={{
                color: 'var(--brand)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '6px'
              }}
            >
              ← Volver al Panel Médico
            </Link>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--navy)' }}>
              Buzón de Mensajes
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
              Conversaciones activas con los pacientes que tienes asignados.
            </p>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              className={`btn ${!onlyUnread ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setOnlyUnread(false)}
              aria-pressed={!onlyUnread}
              style={{ fontSize: '13px', padding: '6px 12px' }}
              data-testid="filtro-todos"
            >
              Todos ({threads.length})
            </button>
            <button
              type="button"
              className={`btn ${onlyUnread ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setOnlyUnread(true)}
              aria-pressed={onlyUnread}
              style={{ fontSize: '13px', padding: '6px 12px' }}
              data-testid="filtro-no-leidos"
            >
              Solo no leídos {totalUnread > 0 && `(${totalUnread})`}
            </button>
          </div>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="notice notice-warning" style={{ marginBottom: '16px' }} role="alert">
            {error}
          </div>
        )}

        {/* Estado de carga */}
        {loading && (
          <div
            className="card"
            style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}
          >
            Cargando conversaciones...
          </div>
        )}

        {/* Lista vacía */}
        {!loading && threads.length === 0 && (
          <div
            className="card"
            style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)' }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }} aria-hidden="true">
              💬
            </div>
            <h3 style={{ margin: '0 0 4px', color: 'var(--text)' }}>
              {onlyUnread
                ? 'No tienes mensajes pendientes por leer'
                : 'No tienes conversaciones activas'}
            </h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {onlyUnread
                ? 'Todas tus conversaciones están al día.'
                : 'Cuando tomes una consulta médica podrás comunicarte con el paciente desde aquí.'}
            </p>
          </div>
        )}

        {/* Lista de hilos */}
        {!loading && threads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {threads.map((thread) => {
              const hasUnread = thread.unread_count > 0
              return (
                <div
                  key={thread.consultation_id}
                  className="card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    // Un hilo con mensajes sin leer se destaca con el azul de marca, no con un
                    // teal suelto: es el mismo acento que el resto del panel.
                    border: hasUnread ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                    backgroundColor: hasUnread ? 'var(--brand-light)' : 'var(--white)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                  data-testid="thread-item"
                  data-consultation-id={thread.consultation_id}
                >
                  <div style={{ flex: 1, minWidth: 'min(240px, 100%)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        marginBottom: '4px'
                      }}
                    >
                      <strong style={{ fontSize: '16px', color: 'var(--navy)' }}>
                        {thread.patient_display_name || thread.patient_name}
                      </strong>
                      <span className="badge badge-blue" style={{ fontSize: '11px' }}>
                        {thread.code}
                      </span>
                      {thread.specialty_name && (
                        <span className="tag" style={{ fontSize: '11px', cursor: 'default' }}>
                          {thread.specialty_name}
                        </span>
                      )}
                    </div>

                    {/* Presencia asimétrica del paciente visible para el médico */}
                    <div style={{ marginBottom: '6px' }}>
                      <IndicadorPresenciaPaciente
                        online={thread.patient_online}
                        lastSeenAt={thread.patient_last_seen_at}
                      />
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {/* Sin fecha no se inventa una: `tiempoTranscurrido(null)` devuelve
                          «0 min», y «hace 0 min» en un hilo sin actividad es mentira. */}
                      {thread.last_message_at
                        ? `Última actividad: hace ${tiempoTranscurrido(thread.last_message_at)}`
                        : 'Sin actividad registrada'}
                    </div>

                    {/* Quién escribió lo último. Son TRES casos desde R16: el aviso de
                        videollamada es un mensaje de sistema y puede ser el último del hilo
                        (y no cuenta como no leído para nadie). */}
                    {thread.last_message_at && (
                      <div
                        style={{ fontSize: '12px', color: 'var(--muted)' }}
                        data-testid="ultima-direccion"
                        data-direction={thread.last_direction}
                      >
                        {etiquetaUltimaDireccion(thread.last_direction)}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    {hasUnread && (
                      <span
                        className="badge badge-red"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        {thread.unread_count} nuevo{thread.unread_count === 1 ? '' : 's'}
                      </span>
                    )}

                    <Link
                      href={`/panel-medico/consulta/${thread.consultation_id}`}
                      className="btn btn-primary"
                      style={{ fontSize: '13px', padding: '8px 14px' }}
                    >
                      Abrir chat
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
