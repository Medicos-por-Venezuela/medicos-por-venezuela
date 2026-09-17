// Barra de marca de las páginas internas: panel médico (y sus subpáginas), sala de espera y Mi caso.
// Es el navy y el logo de la web pública, con la franja tricolor del aviso "Antes de entrar". La
// monta `_app.tsx` según la ruta, para no repetirla en cada página. El admin tiene la suya en el
// lateral (`AdminLayout`).
import Image from 'next/image'
import Link from 'next/link'

// Rutas con la barra: prefijos, incluidas sus subrutas (`/panel-medico/consulta/[id]`, etc.).
const RUTAS_CON_MARCA = ['/panel-medico', '/sala-espera', '/mi-caso', '/entrar-videoconsulta']

export function llevaBarraDeMarca(pathname: string): boolean {
  return RUTAS_CON_MARCA.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
}

export default function PanelHeader() {
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
      </header>
      <div className="panel-header-flag" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </>
  )
}
