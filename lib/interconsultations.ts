// Cliente de Interconsultas (segunda opinión en tiempo real). Ver .knowledge/interconsultas.md del
// backend. NO confundir con "Agendar con Especialista" (que cierra la consulta y agenda otro día).
import { useEffect, useRef } from 'react'
import { getJson, postJson } from './apiClient'
import { supabase } from './supabase'

// Lo que ve el médico que ATIENDE (a quién invitó).
export interface Interconsultation {
  id: string
  consultation_id: string
  invited_doctor_id: string
  invited_doctor_name: string | null
  created_by_id: string
  status: string
  note: string | null
  created_at: string
}

// Vista LIMITADA del médico INVITADO: solo motivo, notas y edad — sin identidad del paciente.
export interface InterconsultationForInvitee {
  id: string
  consultation_id: string
  status: string
  note: string | null
  chief_complaint: string | null
  internal_note: string | null
  clinical_notes: string | null
  patient_age_range: string | null
  video_room_url: string | null
  created_at: string
}

// POST /interconsultations — el médico que atiende invita a un médico del pool.
export async function createInterconsultation(
  params: { consultation_id: string; invited_doctor_id: string; note?: string },
  token: string
): Promise<Interconsultation> {
  return postJson<Interconsultation>(
    '/api/v1/interconsultations',
    params,
    'No se pudo asignar la interconsulta',
    token
  )
}

// --- Aviso en vivo al médico invitado ---
//
// El panel se refresca por Realtime `postgres_changes` sobre `consultations`, pero crear una
// interconsulta solo inserta en `interconsultations` — no emite ningún evento, así que al
// invitado no le aparecía hasta recargar.
//
// Se resuelve con BROADCAST, no suscribiéndose a la tabla: `interconsultations` está deny-all a
// propósito (RLS activada sin políticas y sin GRANTs; solo la API entra). Escucharla por
// postgres_changes exigiría darle SELECT a `authenticated` y escribir una política — abrir una
// tabla cerrada por una notificación, justo al revés de lo que hizo M2. El broadcast no toca la
// base: es el mismo canal WebSocket que ya usa la presencia del paciente.
//
// Degrada bien: si el invitado no está conectado en ese instante, se pierde el aviso y la ve al
// recargar o al volver el foco a la pestaña, exactamente como antes.
const SIGNAL_CHANNEL = 'interconsultations-signal'
const SIGNAL_EVENT = 'assigned'

/** Avisa al médico invitado de que acaba de recibir una interconsulta. Best-effort. */
export function notifyInterconsultationAssigned(invitedDoctorId: string): void {
  const channel = supabase.channel(SIGNAL_CHANNEL)
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    channel
      .send({
        type: 'broadcast',
        event: SIGNAL_EVENT,
        payload: { invited_doctor_id: invitedDoctorId }
      })
      .finally(() => supabase.removeChannel(channel))
  })
}

/** Ejecuta `onAssigned` cuando a ESTE médico le asignan una interconsulta. */
export function useInterconsultationAssigned(myUserId: string | undefined, onAssigned: () => void) {
  // El callback va en un ref para que su identidad no re-suscriba el canal en cada render.
  // Se asigna dentro de un efecto, no en el cuerpo: escribir un ref durante el render es lo que
  // React desaconseja (y eslint marca).
  const handler = useRef(onAssigned)
  useEffect(() => {
    handler.current = onAssigned
  }, [onAssigned])

  useEffect(() => {
    if (!myUserId) return
    const channel = supabase.channel(SIGNAL_CHANNEL)
    channel.on('broadcast', { event: SIGNAL_EVENT }, ({ payload }) => {
      if (payload?.invited_doctor_id === myUserId) handler.current()
    })
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [myUserId])
}

// GET /interconsultations/for-consultation/{id} — la interconsulta activa de una consulta (o null).
export async function fetchInterconsultationForConsultation(
  consultationId: string,
  token: string
): Promise<Interconsultation | null> {
  return getJson<Interconsultation | null>(
    `/api/v1/interconsultations/for-consultation/${consultationId}`,
    'No se pudo cargar la interconsulta',
    token
  )
}

// GET /interconsultations/me — mis interconsultas asignadas (médico invitado, datos limitados).
export async function fetchMyInterconsultations(
  token: string
): Promise<InterconsultationForInvitee[]> {
  return getJson<InterconsultationForInvitee[]>(
    '/api/v1/interconsultations/me',
    'No se pudieron cargar tus interconsultas',
    token
  )
}
