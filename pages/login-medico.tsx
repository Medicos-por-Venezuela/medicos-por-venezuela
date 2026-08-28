import Head from 'next/head'
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
      <Head>
        <title>Iniciar sesión — Médicos por Venezuela</title>
      </Head>
      <main className="page">
        <div className="narrow">
          <div className="card">Llevándote al inicio de sesión...</div>
        </div>
      </main>
    </>
  )
}
