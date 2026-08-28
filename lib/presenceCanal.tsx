// El canal de presencia: TODA la parte que habla con Supabase. Vive aparte de `presence.tsx` por
// una razón de peso —literalmente—: `_app.tsx` monta el provider en las trece rutas, así que el
// `import` de `./supabase` acababa en el paquete inicial del HOME. Un visitante anónimo leyendo la
// portada se descargaba **229 KB del SDK de Supabase** (auth + realtime) para no usarlos: un tercio
// de los 697 KB de JavaScript de la primera carga. Medido sobre el build, 2026-08-28.
//
// Aquí no se cambia NADA del comportamiento: los dos efectos son los que estaban en el provider,
// palabra por palabra. Lo único que cambia es CUÁNDO llega el código — `presence.tsx` carga este
// módulo con `next/dynamic({ ssr: false })`, o sea después de hidratar y fuera de la ruta crítica.
// La presencia arranca un viaje de red más tarde; a cambio, la portada deja de arrastrar el SDK.
//
// Este componente no pinta nada (`return null`): solo corre efectos y devuelve la lista por
// `onCambio`. Por eso `ssr: false` es inocuo — los hijos del provider siguen renderizándose en el
// servidor, que es lo que se indexa.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchMyProfile } from './consultations'
import type { OnlineDoctor } from './presence'

const CHANNEL = 'online-doctors'

export default function PresenceCanal({ onCambio }: { onCambio: (lista: OnlineDoctor[]) => void }) {
  // Identidad del médico a anunciar (null = no es médico activo → no se anuncia, solo lee si es staff).
  const [self, setSelf] = useState<OnlineDoctor | null>(null)
  // ¿El usuario participa del canal de presencia? Solo staff (médicos activos + admins). Los anónimos
  // y los pacientes NO abren el WebSocket ni reciben la lista de médicos online (privacidad + recursos).
  const [staff, setStaff] = useState(false)

  // Resuelve la identidad desde la sesión y la mantiene al cambiar el auth (login/logout/refresh).
  useEffect(() => {
    // "Gana el último": cada resolve() lleva un id de invocación; tras un await se descarta si ya
    // corrió uno más nuevo. Evita que un fetchMyProfile lento de una sesión vieja re-anuncie a un
    // médico ya deslogueado (fantasma online) o intercale resultados fuera de orden.
    let latest = 0
    let disposed = false
    const resolve = async () => {
      const call = ++latest
      const { data } = await supabase.auth.getSession()
      if (disposed || call !== latest) return
      if (!data.session) {
        setSelf(null)
        setStaff(false)
        return
      }
      try {
        const me = await fetchMyProfile(data.session.access_token)
        if (disposed || call !== latest) return
        // Médico que cuenta como online = con ficha Y activo (un médico revocado deja de anunciarse).
        const isDoctor = me.has_doctor_profile && me.active
        setStaff(isDoctor || me.role === 'admin' || me.role === 'super_admin')
        setSelf(isDoctor ? { id: me.id, full_name: me.full_name, specialty: me.specialty } : null)
      } catch {
        if (!disposed && call === latest) setSelf(null)
      }
    }
    resolve()
    // NUNCA await-ees métodos de Supabase DENTRO del callback de onAuthStateChange: auth-js despacha
    // este callback mientras retiene su lock interno de auth, así que un getSession()/query aquí
    // vuelve a entrar al mismo lock y lo deadlockea. En un login eso cuelga a la propia llamada que
    // disparó el evento (signInWithPassword nunca resuelve → el botón se queda en "Entrando…").
    // Por eso diferimos resolve() con setTimeout(…, 0): corre FUERA del lock. (Guía oficial Supabase.)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(resolve, 0)
    })
    return () => {
      disposed = true
      latest = -1 // invalida cualquier resolve en vuelo al desmontar
      sub.subscription.unsubscribe()
    }
  }, [])

  // Un solo canal, SOLO para staff (no para anónimos/pacientes): escucha la presencia de todos y,
  // si `self` es un médico activo, se anuncia (track).
  useEffect(() => {
    if (!staff) {
      onCambio([])
      return
    }
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: self?.id ?? '' } }
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<OnlineDoctor>()
      const seen = new Set<string>()
      const list: OnlineDoctor[] = []
      for (const entries of Object.values(state)) {
        for (const p of entries) {
          if (!p.id || seen.has(p.id)) continue
          seen.add(p.id)
          list.push({ id: p.id, full_name: p.full_name, specialty: p.specialty ?? null })
        }
      }
      onCambio(list)
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && self) channel.track(self)
    })

    return () => {
      supabase.removeChannel(channel)
    }
    // Re-suscribe si cambia si es staff o la identidad anunciada (login/logout/refresh/revocación).
    // `onCambio` es el `setOnline` de `useState` del provider: React garantiza que es estable, así
    // que no re-dispara la suscripción.
  }, [staff, self?.id, self?.full_name, self?.specialty, onCambio])

  return null
}
