import dynamic from 'next/dynamic'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// Estado "online" de los médicos vía Supabase Realtime Presence (WebSocket, sin polling ni BD).
// Un ÚNICO canal para toda la app, montado en el provider de `_app`: así el médico logueado queda
// "online" en CUALQUIER ruta (panel, consulta, perfil…) y no se cae al navegar. El provider ancla
// el track a la sesión, no a una página; los consumidores solo LEEN la lista desde el contexto.
//
// Este fichero es SOLO el contexto y los hooks. Todo lo que toca Supabase vive en
// `presenceCanal.tsx` y se carga aparte: montado en las trece rutas, su `import` metía 229 KB del
// SDK en el paquete inicial del home, que un visitante anónimo no llega a usar nunca. Ver la
// cabecera de ese fichero para el detalle.

export interface OnlineDoctor {
  id: string // user_id (profiles.id) — con esto se cruza contra el pool/admin
  full_name: string
  specialty: string | null
}

const PresenceContext = createContext<OnlineDoctor[]>([])

// `ssr: false` porque el canal solo existe en el navegador: son dos efectos y `return null`, así
// que no hay marcado que perder — los hijos del provider siguen renderizándose en el servidor.
const PresenceCanal = dynamic(() => import('./presenceCanal'), { ssr: false })

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<OnlineDoctor[]>([])

  return (
    <PresenceContext.Provider value={online}>
      <PresenceCanal onCambio={setOnline} />
      {children}
    </PresenceContext.Provider>
  )
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
