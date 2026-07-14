import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { fetchMyProfile } from './consultations'

// Estado "online" de los médicos vía Supabase Realtime Presence (WebSocket, sin polling ni BD).
// Un ÚNICO canal para toda la app, montado en el provider de `_app`: así el médico logueado queda
// "online" en CUALQUIER ruta (panel, consulta, perfil…) y no se cae al navegar. El provider ancla
// el track a la sesión, no a una página; los consumidores solo LEEN la lista desde el contexto.
const CHANNEL = 'online-doctors'

export interface OnlineDoctor {
  id: string // user_id (profiles.id) — con esto se cruza contra el pool/admin
  full_name: string
  specialty: string | null
}

const PresenceContext = createContext<OnlineDoctor[]>([])

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<OnlineDoctor[]>([])
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
    const resolve = async () => {
      const call = ++latest
      const { data } = await supabase.auth.getSession()
      if (call !== latest) return
      if (!data.session) {
        setSelf(null)
        setStaff(false)
        return
      }
      try {
        const me = await fetchMyProfile(data.session.access_token)
        if (call !== latest) return
        // Médico que cuenta como online = con ficha Y activo (un médico revocado deja de anunciarse).
        const isDoctor = me.has_doctor_profile && me.active
        setStaff(isDoctor || me.role === 'admin' || me.role === 'super_admin')
        setSelf(isDoctor ? { id: me.id, full_name: me.full_name, specialty: me.specialty } : null)
      } catch {
        if (call === latest) setSelf(null)
      }
    }
    resolve()
    const { data: sub } = supabase.auth.onAuthStateChange(() => resolve())
    return () => {
      latest = -1 // invalida cualquier resolve en vuelo al desmontar
      sub.subscription.unsubscribe()
    }
  }, [])

  // Un solo canal, SOLO para staff (no para anónimos/pacientes): escucha la presencia de todos y,
  // si `self` es un médico activo, se anuncia (track).
  useEffect(() => {
    if (!staff) {
      setOnline([])
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
      setOnline(list)
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && self) channel.track(self)
    })

    return () => {
      supabase.removeChannel(channel)
    }
    // Re-suscribe si cambia si es staff o la identidad anunciada (login/logout/refresh/revocación).
  }, [staff, self?.id, self?.full_name, self?.specialty])

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>
}

// Lista de médicos online (incluye al propio médico si está logueado; el pool ya lo excluye en el
// backend, y los conteos de admin quedan correctos).
export function useOnlineDoctors(): OnlineDoctor[] {
  return useContext(PresenceContext)
}

// Set de user_ids online, cómodo para cruzar con listas (pool/admin).
export function useOnlineDoctorIds(): Set<string> {
  const online = useOnlineDoctors()
  return useMemo(() => new Set(online.map((d) => d.id)), [online])
}
