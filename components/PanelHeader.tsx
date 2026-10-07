// Barra de marca de las páginas internas: panel médico (y sus subpáginas), sala de espera y Mi caso.
// Es el navy y el logo de la web pública, con la franja tricolor del aviso "Antes de entrar". La
// monta `_app.tsx` según la ruta, para no repetirla en cada página. El admin tiene la suya en el
// lateral (`AdminLayout`).
import React, { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getInboxSummary, useInboxSignal } from '../lib/messages'
import { supabase } from '../lib/supabase'

// Rutas con la barra: prefijos, incluidas sus subrutas (`/panel-medico/consulta/[id]`, etc.).
const RUTAS_CON_MARCA = ['/panel-medico', '/sala-espera', '/mi-caso', '/entrar-videoconsulta']

export function llevaBarraDeMarca(pathname: string): boolean {
  return RUTAS_CON_MARCA.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
}

export default function PanelHeader() {
  const router = useRouter()
  const isPanelMedico = router.pathname.startsWith('/panel-medico')
  const [unreadCount, setUnreadCount] = useState<number>(0)

  // Total de no leídos por REST. Sirve para el primer pintado y como respaldo si el stream del
  // buzón no está disponible. No toca estado: eso pasa en el callback de la promesa.
  const fetchTotalNoLeidos = useCallback(async (): Promise<number | null> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return null
    const threads = await getInboxSummary({ onlyUnread: true }, { token })
    return threads.reduce((acc, t) => acc + (t.unread_count || 0), 0)
  }, [])

  const refrescarNoLeidos = useCallback(() => {
    fetchTotalNoLeidos()
      .then((total) => {
        if (total !== null) setUnreadCount(total)
      })
      .catch(() => {
        // Silencioso en caso de error de red o permisos: el contador no es crítico.
      })
  }, [fetchTotalNoLeidos])

  useEffect(() => {
    if (!isPanelMedico) return
    refrescarNoLeidos()
  }, [isPanelMedico, router.pathname, refrescarNoLeidos])

  // CA2.4: el contador se mantiene al día con el stream del buzón en vez de sondear cada 30 s.
  // El evento ya trae `unread_total`, que es exactamente el dato del badge, así que con payload
  // no hace falta pedir nada; sin payload (tic de respaldo, el stream no pasa) se pide por REST.
  // Solo en `/panel-medico/*`: el endpoint exige `messages.read` y la barra también la montan
  // `/mi-caso` y `/sala-espera`, que son pantallas de paciente.
  useInboxSignal(isPanelMedico, (signal) => {
    if (signal) setUnreadCount(signal.unread_total)
    else refrescarNoLeidos()
  })

  return (
    <>
      <header className="panel-header">
        {/* `unoptimized`: SVG vectorial; ver la nota del isotipo en components/home/Navbar.tsx. */}
        <Link href="/" className="panel-header-marca">
          <Image
            src="/brand/logo-white.svg"
            alt="Médicos por Venezuela"
            width={94}
            height={36}
            unoptimized
            priority
          />
        </Link>

        {isPanelMedico && (
          <Link
            href="/panel-medico/mensajes"
            style={{
              color: 'var(--white)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              cursor: 'pointer'
            }}
            // El número solo no dice qué cuenta: el nombre accesible del enlace lo explica
            // («Mensajes, 3 sin leer») y el badge queda `aria-hidden` para no oírlo dos veces.
            aria-label={
              unreadCount > 0 ? `Mensajes, ${unreadCount} sin leer` : 'Mensajes, ninguno sin leer'
            }
            title="Ir al buzón de mensajes"
            data-testid="header-buzon-link"
          >
            <span>💬 Mensajes</span>
            {unreadCount > 0 && (
              <span
                // `--red` con texto blanco da 6,47:1; el `#ef4444` que había aquí se quedaba en
                // 3,76:1, y a 11 px en negrita no entra en la excepción de texto grande (pide
                // ≥18,66 px), así que el umbral era 4,5:1 y no lo cumplía.
                //
                // El filete blanco es para VERLA, no por cumplimiento: el fondo del enlace es
                // `rgba(255,255,255,0.12)` sobre el navy (compuesto, #343b44), y `--red` contra
                // eso da 1,75:1 — la píldora casi no se distingue como forma, y un badge vale por
                // verse de reojo. El número sí cumple 1.4.3 (6,47:1 sobre su propio fondo) y
                // 1.4.11 exime al texto, así que esto no corrige un incumplimiento.
                style={{
                  backgroundColor: 'var(--red)',
                  color: 'var(--white)',
                  border: '1px solid var(--white)',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
                aria-hidden="true"
                data-testid="header-unread-badge"
              >
                {unreadCount}
              </span>
            )}
          </Link>
        )}
      </header>
      <div className="panel-header-flag" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </>
  )
}
