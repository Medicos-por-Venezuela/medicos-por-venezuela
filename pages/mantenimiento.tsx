// Página de mantenimiento. No se enlaza desde ningún sitio: llega aquí quien entra al sitio
// público mientras `MAINTENANCE_MODE=true` (ver middleware.ts), con la URL original intacta.
//
// Devuelve **503 Service Unavailable** con `Retry-After`, no 200. Es la diferencia entre decirle a
// Google "esto es temporal, vuelve luego" y dejar que indexe esta página como si fuera el
// contenido del sitio. Con 200, un mantenimiento de unos días puede tirar el posicionamiento de
// una organización que depende de que la encuentren.

import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.statusCode = 503
  // Una hora. Es una pista para los rastreadores, no un compromiso.
  res.setHeader('Retry-After', '3600')
  return { props: {} }
}

export default function Mantenimiento() {
  return (
    <>
      <Head>
        <title>Estamos trabajando — Médicos por Venezuela</title>
        {/* `noindex` mientras dure: ni siquiera queremos que esta página compita en resultados. */}
        <meta name="robots" content="noindex" />
        <meta name="description" content="Estamos trabajando en dar un mejor servicio." />
      </Head>

      <main className="pantalla">
        <div className="tarjeta">
          <h1 className="titulo">Estamos trabajando en dar un mejor servicio</h1>
          <p className="texto">
            Nuestro sitio está en mantenimiento durante unas horas. Vuelve pronto: seguimos aquí.
          </p>

          {/* Aviso de urgencias. Si alguien llega buscando ayuda médica y se encuentra el sitio
              caído, lo mínimo es no dejarlo sin indicación. */}
          <p className="urgencia">
            Si tienes una emergencia médica, acude a tu servicio de salud más cercano. Esta
            plataforma no reemplaza la atención presencial de urgencia.
          </p>

          {/* Los médicos voluntarios siguen atendiendo durante el mantenimiento: se les deja la
              entrada a mano. El acceso de administración NO se enlaza, igual que en el resto del
              sitio. */}
          <p className="personal">
            ¿Eres profesional de la salud voluntario?{' '}
            <Link href="/login-medico" className="enlace">
              Entra al panel médico
            </Link>
          </p>
        </div>
      </main>

      <style jsx>{`
        .pantalla {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--bg);
        }
        .tarjeta {
          max-width: 560px;
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px 32px;
          text-align: center;
        }
        .titulo {
          font-size: clamp(22px, 4vw, 30px);
          line-height: 1.25;
          margin: 0 0 16px;
          color: var(--home-blue);
        }
        .texto {
          font-size: 16px;
          color: var(--text);
          line-height: 1.7;
          margin: 0 0 24px;
        }
        .urgencia {
          font-size: 14px;
          line-height: 1.6;
          color: #78350f;
          background: var(--orange-light);
          border: 1px solid #f59e0b;
          border-radius: 10px;
          padding: 12px 14px;
          margin: 0 0 24px;
          text-align: left;
        }
        .personal {
          font-size: 14px;
          color: var(--muted);
          margin: 0;
        }
        .enlace {
          color: var(--home-blue);
          font-weight: 800;
          text-decoration: underline;
        }
      `}</style>
    </>
  )
}
