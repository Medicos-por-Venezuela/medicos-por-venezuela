import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getAccessToken } from '../../lib/admin'
import { fetchMyProfile } from '../../lib/consultations'
import { getInboxSummary, InboxThread } from '../../lib/messages'
import { supabase } from '../../lib/supabase'
import { isPanelRole, tiempoTranscurrido } from '../../lib/utils'
import IndicadorPresenciaPaciente from '../../components/mensajes/IndicadorPresenciaPaciente'
import Seo from '../../components/Seo'
import { playNotificationSound } from '../../lib/sound'
import { notify } from '../../lib/nativeNotifications'

export default function BuzonMensajes() {
  const router = useRouter()
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string>('')
  const prevUnreadRef = React.useRef<number>(-1)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          router.push('/login')
          return
        }

        const accessToken = sessionData.session.access_token
        setToken(accessToken)

        const me = await fetchMyProfile(accessToken)
        if (!me.active || !isPanelRole(me.role)) {
          router.push('/')
          return
        }

        const data = await getInboxSummary({ onlyUnread }, { token: accessToken })
        if (mounted) {
          setThreads(data)
          prevUnreadRef.current = data.reduce((acc, t) => acc + (t.unread_count || 0), 0)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError('No se pudo cargar el buzón de mensajes')
          setLoading(false)
        }
      }
    }

    init()

    const interval = setInterval(() => {
      if (token) {
        getInboxSummary({ onlyUnread }, { token })
          .then((data) => {
            if (!mounted) return
            const newUnread = data.reduce((acc, t) => acc + (t.unread_count || 0), 0)
            if (prevUnreadRef.current !== -1 && newUnread > prevUnreadRef.current) {
              playNotificationSound('message')
              notify(
                'Nuevo mensaje en consulta',
                'Tienes nuevos mensajes de pacientes en tu buzón.'
              )
            }
            prevUnreadRef.current = newUnread
            setThreads(data)
          })
          .catch(() => {})
      }
    }, 12000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [onlyUnread, router, token])

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
                color: '#0d9488',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '6px'
              }}
            >
              ← Volver al Panel Médico
            </Link>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
              Buzón de Mensajes
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
              Conversaciones activas con los pacientes que tienes asignados.
            </p>
          </div>

          {/* Filtros y sonido */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => playNotificationSound('message')}
              title="Probar sonido de notificación"
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              🔔 Probar sonido
            </button>
            <button
              type="button"
              className={`btn ${!onlyUnread ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setOnlyUnread(false)}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Todos ({threads.length})
            </button>
            <button
              type="button"
              className={`btn ${onlyUnread ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setOnlyUnread(true)}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Solo no leídos {totalUnread > 0 && `(${totalUnread})`}
            </button>
          </div>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="notice notice-warning" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Estado de carga */}
        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Cargando conversaciones...
          </div>
        )}

        {/* Lista vacía */}
        {!loading && threads.length === 0 && (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '48px 16px',
              color: '#64748b',
              backgroundColor: '#ffffff'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <h3 style={{ margin: '0 0 4px', color: '#1e293b' }}>
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
                    padding: '16px',
                    borderRadius: '10px',
                    border: hasUnread ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                    backgroundColor: hasUnread ? '#f0fdfa' : '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                  data-testid="thread-item"
                  data-consultation-id={thread.consultation_id}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '4px'
                      }}
                    >
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>
                        {thread.patient_display_name || thread.patient_name}
                      </strong>
                      <span className="badge badge-blue" style={{ fontSize: '11px' }}>
                        {thread.code}
                      </span>
                      {thread.specialty_name && (
                        <span className="tag" style={{ fontSize: '11px' }}>
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

                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Última actividad: hace {tiempoTranscurrido(thread.last_message_at)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {hasUnread && (
                      <span
                        className="badge badge-red"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        title={`${thread.unread_count} mensajes no leídos`}
                      >
                        {thread.unread_count} nuevo{thread.unread_count === 1 ? '' : 's'}
                      </span>
                    )}

                    <Link
                      href={`/panel-medico/consulta/${thread.consultation_id}`}
                      className="btn btn-primary"
                      style={{ fontSize: '13px', padding: '8px 14px', textDecoration: 'none' }}
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
