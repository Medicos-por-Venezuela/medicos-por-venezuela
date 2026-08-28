import Seo from '../../components/Seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAgenda, type AgendaConsultation } from '../../lib/consultations'
import CalendarSync from '../../components/CalendarSync'
import { downloadIcs } from '../../lib/calendar'
import { requestNotifyPermission, scheduleLocalReminders } from '../../lib/nativeNotifications'
import {
  fetchNotificationPrefs,
  isPushEnabled,
  type NotificationPrefs
} from '../../lib/notificationPrefs'

export default function MiAgenda() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agenda, setAgenda] = useState<AgendaConsultation[]>([])
  // Preferencias de notificación (para gatear el recordatorio por push). null = opt-out (activado).
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    try {
      const token = session.access_token
      const [ag, prefsRes] = await Promise.all([
        fetchAgenda(token),
        fetchNotificationPrefs(token).catch(() => null)
      ])
      setAgenda(ag)
      if (prefsRes) setNotifPrefs(prefsRes.prefs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar tu agenda.')
    } finally {
      setLoading(false)
    }
  }

  // Recordatorio nativo ~30 min antes de cada cita (solo con la pestaña abierta; ver
  // lib/nativeNotifications). Respeta la preferencia del médico y se re-programa al cambiar la lista.
  useEffect(() => {
    if (!isPushEnabled(notifPrefs, 'appointment_reminder')) return
    requestNotifyPermission()
    return scheduleLocalReminders(
      agenda
        .filter((a) => a.scheduled_at)
        .map((a) => ({
          when: new Date(a.scheduled_at as string),
          title: 'Cita próxima',
          body: `${a.patient_name || 'Paciente'} · ${new Date(
            a.scheduled_at as string
          ).toLocaleString('es-VE')}`
        }))
    )
  }, [agenda, notifPrefs])

  return (
    <>
      <Seo
        titulo="Mi agenda — Médicos por Venezuela"
        descripcion={'Tus consultas asignadas y su estado.'}
        ruta="/panel-medico/agenda"
        noindex
      />
      <main className="page">
        <div className="container">
          <button className="link-button" onClick={() => router.push('/panel-medico')}>
            ← Volver al panel médico
          </button>

          <section className="card" style={{ marginTop: 14 }}>
            <h1 style={{ marginTop: 0 }}>Mi agenda</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
              Consultas de seguimiento y referencias agendadas contigo (por fecha).
            </p>
            <CalendarSync />

            {loading ? (
              <p style={{ color: '#64748b', margin: 0 }}>Cargando...</p>
            ) : error ? (
              <div className="notice notice-danger">{error}</div>
            ) : agenda.length === 0 ? (
              <p style={{ color: '#64748b', margin: 0 }}>
                Aún no tienes citas agendadas. Cuando agendes un seguimiento o refieras a un
                especialista, aparecerán aquí y podrás sincronizarlas con tu calendario.
              </p>
            ) : (
              <div className="grid">
                {agenda.map((a) => (
                  <div key={a.id} className="card-flat">
                    <strong>{a.patient_name || 'Paciente'}</strong>
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      {a.scheduled_at
                        ? new Date(a.scheduled_at).toLocaleString('es-VE')
                        : 'Sin fecha'}
                    </div>
                    <p>{a.chief_complaint || 'Sin motivo'}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: '1 1 140px' }}
                        onClick={() => router.push(`/panel-medico/consulta/${a.id}`)}
                      >
                        Abrir consulta
                      </button>
                      {a.scheduled_at && (
                        <button
                          className="btn btn-outline"
                          style={{ flex: '1 1 140px' }}
                          onClick={() =>
                            downloadIcs({
                              uid: `${a.id}@medicosporvenezuela.org`,
                              start: new Date(a.scheduled_at as string),
                              title: `Cita: ${a.patient_name || 'Paciente'}`,
                              description: `Paciente: ${a.patient_name || 'N/D'}\nMotivo: ${
                                a.chief_complaint || 'N/D'
                              }\nCódigo: ${a.code}`
                            })
                          }
                        >
                          Agregar a calendario
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
