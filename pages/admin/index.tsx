import Seo from '../../components/Seo'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

// Entrada histórica del área admin (con su alias /admin/login). Ya no hay un formulario aparte:
// el login del sitio es único (/login) y resuelve el destino por rol efectivo — un admin, puro o
// dual con user_roles, aterriza en /admin/dashboard. El control de acceso real sigue siendo el
// RBAC del backend + useAdminGuard, no la oscuridad de esta URL; se conserva el noindex.
export default function AdminRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <>
      <Seo
        titulo="Administración — Médicos por Venezuela"
        descripcion={'Sección privada de administración.'}
        ruta="/admin"
        noindex
      />
      <main className="page">
        <div className="narrow">
          <div className="card">Llevándote al inicio de sesión...</div>
        </div>
      </main>
    </>
  )
}
