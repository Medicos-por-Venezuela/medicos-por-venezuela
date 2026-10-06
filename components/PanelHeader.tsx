// Barra de marca de las páginas internas: panel médico (y sus subpáginas), sala de espera y Mi caso.
// Es el navy y el logo de la web pública, con la franja tricolor del aviso "Antes de entrar". La
// monta `_app.tsx` según la ruta, para no repetirla en cada página. El admin tiene la suya en el
// lateral (`AdminLayout`).
import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getInboxSummary } from '../lib/messages'
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

  useEffect(() => {
    if (!isPanelMedico) return

    let active = true

    async function checkUnread() {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return

        const threads = await getInboxSummary({ onlyUnread: true }, { token })
        if (active) {
          const total = threads.reduce((acc, t) => acc + (t.unread_count || 0), 0)
          setUnreadCount(total)
        }
      } catch {
        // Silencioso en caso de error de red o permisos
      }
    }

    checkUnread()
    const timer = setInterval(checkUnread, 30000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [isPanelMedico, router.pathname])

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
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              cursor: 'pointer'
            }}
            title="Ir al buzón de mensajes"
            data-testid="header-buzon-link"
          >
            <span>💬 Mensajes</span>
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
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
