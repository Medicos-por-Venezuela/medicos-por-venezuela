import Seo from '../components/Seo'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

// Ruta histórica del acceso médico. El login del sitio es único (/login) y decide el destino por
// rol, así que aquí ya no hay formulario. No se borra el archivo: hay enlaces externos y desde
// /registro-medico, y un 404 es peor que un salto.
export default function LoginMedicoRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <>
      <Seo
        titulo="Iniciar sesión — Médicos por Venezuela"
        descripcion={'Acceso para pacientes, médicos y administradores de Médicos por Venezuela.'}
        ruta="/login-medico"
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
