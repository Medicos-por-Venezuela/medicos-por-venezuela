// Shared shell for every /admin/* page: left sidebar nav + topbar (title, profile, panel
// médico / salir) + content area. Mobile-first: the sidebar is an off-canvas drawer below 850px
// (see .admin-sidebar rules in styles/globals.css), a fixed column above it.
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode, useState } from 'react'
import { adminLogout, Profile } from '../../lib/admin'

// `superAdminOnly`: el backend ya lo exige (permiso `reports.export`, sembrado solo para
// super_admin), así que enseñarle el enlace a un admin sería ofrecerle una página que solo
// puede darle un aviso de "no tienes acceso".
const NAV_ITEMS: { href: string; label: string; superAdminOnly?: boolean }[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/pacientes', label: 'Pacientes' },
  { href: '/admin/doctores', label: 'Doctores' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/reportes', label: 'Reportes', superAdminOnly: true },
  { href: '/admin/zonas-afectadas', label: 'Zonas' },
  { href: '/admin/especialidades', label: 'Especialidades' },
  { href: '/admin/tipos-profesionales', label: 'Tipos de Profesionales' }
]

export default function AdminLayout({
  title,
  profile,
  children
}: {
  title: string
  profile: Profile | null
  children: ReactNode
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <Head>
        <title>{title} — Médicos por Venezuela</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="admin-shell">
        <button
          type="button"
          className="admin-menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menú de administración"
          aria-expanded={menuOpen}
        >
          ☰ Menú
        </button>

        {menuOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside className={`admin-sidebar${menuOpen ? ' admin-sidebar-open' : ''}`}>
          <div className="admin-sidebar-brand">Médicos por Venezuela</div>
          <nav className="admin-nav">
            {NAV_ITEMS.filter(
              // `profile.role` es el rol admin EFECTIVO (lo resuelve useAdminGuard vía RBAC),
              // así que esto también acierta con un dual doctor+super_admin.
              (item) => !item.superAdminOnly || profile?.role === 'super_admin'
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-link${router.pathname === item.href ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="admin-main">
          <div className="container">
            <div className="topbar">
              <div>
                <h1 style={{ margin: 0 }}>{title}</h1>
                <p style={{ margin: 0, color: '#64748b' }}>
                  {profile?.full_name} ·{' '}
                  {profile?.role === 'super_admin' ? 'super administrador' : 'administrador'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-outline" onClick={() => router.push('/panel-medico')}>
                  Panel médico
                </button>
                <button className="btn btn-muted" onClick={() => adminLogout(router)}>
                  Salir
                </button>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </>
  )
}

// Shown by every /admin/* page while useAdminGuard() resolves the session.
export function AdminLoading() {
  return (
    <main className="page">
      <div className="container">
        <div className="card">Cargando...</div>
      </div>
    </main>
  )
}

export function Line({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ fontSize: 12, color: '#64748b' }}>
      <span style={{ color: '#94a3b8' }}>{label}:</span> {value}
    </div>
  )
}

// `onClick` is optional: pass it to make the card an actionable shortcut (e.g. open a detail
// modal) — it renders as a real <button> then, for accessibility (focusable, keyboard-operable,
// no need for a manual role="button"/onKeyDown handler).
export function Kpi({
  value,
  label,
  onClick
}: {
  value: number | string
  label: string
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className="kpi kpi-clickable" onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className="kpi">{content}</div>
}
