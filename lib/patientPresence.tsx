import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Presencia del PACIENTE "en sala" vía Supabase Realtime Presence (WebSocket, sin BD ni polling).
// Reemplaza el heartbeat `mark_patient_waiting` (RPC cada 15s → patient_last_seen_at) y la
// suscripción postgres_changes que lo leía. Un ÚNICO canal para todos: cada paciente que espera se
// anuncia con su consultation_id; el médico (panel + detalle) solo LEE qué consultas tienen paciente.
const CHANNEL = 'patients-in-room'

// El PACIENTE anuncia que está en la sala de una consulta. Llamar dentro de un useEffect de la sala
// de espera; devuelve el cleanup para dejar de anunciar al salir (o al cerrar la pestaña).
export function trackPatientInRoom(consultationId: string): () => void {
  const channel = supabase.channel(CHANNEL, {
    config: { presence: { key: consultationId } }
  })
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') channel.track({ consultation_id: consultationId })
  })
  return () => {
    supabase.removeChannel(channel)
  }
}

// El MÉDICO lee el conjunto de consultation_ids que tienen al paciente en sala, en vivo. Un solo
// canal para todo el panel y el detalle; no anuncia presencia (solo lee).
export function usePatientsInRoom(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const channel = supabase.channel(CHANNEL)
    const refresh = () => {
      const state = channel.presenceState<{ consultation_id: string }>()
      const set = new Set<string>()
      for (const entries of Object.values(state)) {
        for (const p of entries) if (p.consultation_id) set.add(p.consultation_id)
      }
      setIds(set)
    }
    channel.on('presence', { event: 'sync' }, refresh)
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  return ids
}
