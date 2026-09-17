// Lo que hay que decir ANTES de abrir la sala de Jitsi, al paciente y al médico.
//
// Del lado del paciente lo abren DOS páginas: la sala de espera a la que cae al registrarse, y
// `/mi-caso`, por donde vuelve el que cerró aquella pestaña. Del lado del médico, el panel (al
// tomar un caso por video) y el detalle de la consulta (al volver a entrar). Es contenido
// clínico-operativo —"espera a tu médico", "si no llega, escríbele por WhatsApp"— y con una copia
// por página la siguiente corrección se aplicaría en una sola. Es además la regla del proyecto:
// nada de diálogos inline copiados (ver CLAUDE.md).
//
// Los dos avisos grandes y el marco (bandera, cabecera con el logo) son el diseño de
// "Información importante". Debajo, solo para el paciente, siguen las instrucciones de Jitsi que
// ya traía este modal: salieron de reportes reales (pacientes que no escribían su nombre o se
// quedaban en la pantalla de "descarga la app") y el diseño nuevo no las sustituye.
//
// El `onConfirm` tiene que abrir la sala DENTRO de este clic: `window.open` fuera de un gesto del
// usuario lo bloquea el navegador como pop-up. Por eso el modal no abre nada por su cuenta; solo
// avisa a quien lo montó.
//
// Estilos con styled-jsx, como la encuesta de marketing que comparte esta cabecera: la paleta
// oscura del diseño queda acotada al modal. Todo el JSX va en un solo árbol a propósito: styled-jsx
// solo le pone su clase de scope a los elementos del componente que declara el <style jsx>.
import Image from 'next/image'
import { useId } from 'react'
import { useEscapeToClose } from '../lib/hooks'

const ACENTO = '#5B93FF'

export default function AntesDeEntrarModal({
  open,
  onCancel,
  onConfirm,
  para = 'paciente',
  pacienteSinCorreo = false
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  para?: 'paciente' | 'medico'
  // Solo para el médico: el correo "tu médico te está esperando" sale al tomar el caso por video
  // y solo si el paciente dejó correo. Quien lo sabe (el detalle de la consulta) lo dice, para no
  // prometerle al médico un aviso que nunca salió.
  pacienteSinCorreo?: boolean
}) {
  const tituloId = useId()
  useEscapeToClose(open, onCancel)

  if (!open) return null

  const esMedico = para === 'medico'

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      onClick={onCancel}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flagbar" aria-hidden="true">
          <span className="y" />
          <span className="b" />
          <span className="r" />
        </div>
        <div className="masthead">
          {/* `unoptimized`: SVG vectorial de 4 KB; ver la nota del isotipo en Navbar. */}
          <Image
            className="logo"
            src="/brand/logo-white.svg"
            alt="Médicos por Venezuela"
            width={78}
            height={30}
            unoptimized
          />
          <div className="divider" aria-hidden="true" />
          <div className="tagline">
            Conocimiento médico
            <br />
            al servicio de Venezuela
          </div>
          <button type="button" className="cerrar" aria-label="Cerrar" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="body">
          <div className="icon-badge" aria-hidden="true">
            <Reloj size={26} />
          </div>
          <h2 id={tituloId}>Información importante</h2>
          <p className="subtitle">
            {esMedico
              ? 'Antes de entrar a la videoconsulta, lee esto:'
              : 'Antes de entrar a tu teleconsulta, lee esto:'}
          </p>

          {esMedico ? (
            <>
              <div className="aviso">
                <div className="ic" aria-hidden="true">
                  <Reloj />
                </div>
                <p>
                  Entra a la videollamada y espera de <mark>15 a 20 minutos</mark> a que el paciente
                  se conecte.
                </p>
              </div>
              <div className="aviso">
                <div className="ic" aria-hidden="true">
                  <Sobre />
                </div>
                {pacienteSinCorreo ? (
                  <p>
                    Este paciente <mark>no recibió el aviso por correo</mark>, así que quizá no sepa
                    que ya estás en la sala.
                  </p>
                ) : (
                  <p>
                    El paciente recibe un correo avisándole que ya estás en la sala, esperando para
                    atenderlo.
                  </p>
                )}
              </div>
              <div className="aviso">
                <div className="ic" aria-hidden="true">
                  <Mensaje />
                </div>
                <p>
                  Si el paciente no se conecta, intenta contactarlo por <mark>WhatsApp</mark> al
                  número de su ficha.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="aviso">
                <div className="ic" aria-hidden="true">
                  <Reloj />
                </div>
                <p>
                  Tu médico ya tomó tu caso. Si no lo ves al entrar, espera unos minutos: puede
                  estar <mark>terminando de conectarse</mark>.
                </p>
              </div>
              <div className="aviso">
                <div className="ic" aria-hidden="true">
                  <Sobre />
                </div>
                <p>
                  Si se corta, vuelve a entrar desde esta página o desde el{' '}
                  <mark>correo que te enviamos</mark> con el enlace de la videoconsulta.
                </p>
              </div>

              <div className="consejos">
                <h3>Para que la videollamada funcione bien</h3>
                <ul>
                  <li>
                    <strong>Escribe tu nombre completo</strong> cuando la videollamada te lo pida.
                  </li>
                  <li>
                    <strong>No cierres la videollamada</strong> mientras esperas.
                  </li>
                  <li>
                    Al abrir el enlace, elige <strong>“Continuar en el navegador”</strong> (no
                    necesitas descargar la app).
                  </li>
                  <li>
                    Pulsa <strong>“Permitir”</strong> cuando te pida cámara y micrófono.
                  </li>
                  <li>Mantén también esta página abierta en otra pestaña.</li>
                </ul>
                <p className="captura-texto">
                  Si te aparece esta pantalla, toca <strong>«Unirse en el navegador»</strong>:
                </p>
                <Image
                  className="captura"
                  src="/instruccion-jitsi.png"
                  alt="Pantalla de Jitsi: toca «Unirse en el navegador» para continuar sin descargar la app"
                  width={1080}
                  height={1408}
                  sizes="200px"
                />
              </div>
            </>
          )}
        </div>

        <div className="foot">
          {/* autoFocus: el foco entra al modal al abrirlo, como hacía el diálogo nativo que este
              patrón reemplazó en el resto del sitio (ver components/admin/ConfirmDialog.tsx). */}
          <button type="button" className="continuar" onClick={onConfirm} autoFocus>
            Entendido, continuar a la videollamada
          </button>
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(4, 8, 16, 0.72);
          --flag-yellow: #ffcc00;
          --flag-blue: #0033a0;
          --flag-red: #cf142b;
        }
        /* Columna flexible: cabecera y botón fijos, y lo que no quepa se desplaza en el cuerpo.
           Con las instrucciones del paciente el modal no cabe en un móvil, y el botón para entrar
           no puede quedar escondido debajo del pliegue. */
        .modal {
          position: relative;
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 480px;
          max-height: calc(100vh - 32px);
          max-height: calc(100dvh - 32px);
          overflow: hidden;
          background: #121b2e;
          border: 1px solid #233252;
          border-radius: 16px;
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.35),
            0 24px 56px rgba(0, 0, 0, 0.4);
          color: #e7ecf5;
          font-family:
            'Nunito Sans',
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            Roboto,
            sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .flagbar {
          height: 5px;
          display: flex;
          flex: none;
        }
        .flagbar span {
          flex: 1;
        }
        .flagbar .y {
          background: var(--flag-yellow);
        }
        .flagbar .b {
          background: var(--flag-blue);
        }
        .flagbar .r {
          background: var(--flag-red);
        }
        .masthead {
          position: relative;
          display: flex;
          flex: none;
          align-items: center;
          gap: 14px;
          padding: 20px 56px 16px 28px;
          background-color: #14213d;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='54'%3E%3Cpath d='M27 6l4.9 10.4L43 18l-8 7.8 1.9 11.3L27 31.6l-9.9 5.5L19 25.8 11 18l11.1-1.6z' fill='%23FFFFFF' fill-opacity='0.05'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 54px 54px;
        }
        .masthead::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 55%, rgba(10, 16, 32, 0.28) 100%);
        }
        /* ':global()': next/image no recibe la clase de scope de styled-jsx (ver Navbar.tsx). */
        .masthead :global(.logo),
        .divider,
        .tagline {
          position: relative;
          z-index: 1;
        }
        .masthead :global(.logo) {
          display: block;
          height: 30px;
          width: auto;
        }
        .divider {
          width: 1px;
          height: 26px;
          background: rgba(255, 255, 255, 0.22);
          flex: none;
        }
        .tagline {
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #afc2e8;
          line-height: 1.4;
        }
        .cerrar {
          position: absolute;
          z-index: 1;
          top: 50%;
          right: 14px;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #afc2e8;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }
        .cerrar:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }
        .cerrar:focus-visible,
        .continuar:focus-visible {
          outline: 2px solid #e7ecf5;
          outline-offset: 3px;
        }
        .body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding: 30px 30px 20px;
        }
        .icon-badge {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #1b2a47;
          border: 1px solid #233252;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px;
        }
        h2 {
          font-weight: 900;
          font-size: 24px;
          line-height: 1.2;
          letter-spacing: -0.01em;
          margin: 0 0 10px;
          text-align: center;
          color: #e7ecf5;
        }
        .subtitle {
          font-size: 14.5px;
          color: #9fb0cb;
          text-align: center;
          max-width: 38ch;
          margin: 0 auto 26px;
          line-height: 1.55;
        }
        .aviso {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          background: #101a2c;
          border: 1px solid #233252;
          border-radius: 12px;
          padding: 18px;
        }
        .aviso + .aviso {
          margin-top: 14px;
        }
        .ic {
          flex: none;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #1b2a47;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .aviso p {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.45;
          color: #e7ecf5;
        }
        mark {
          background: none;
          color: #e7ecf5;
          font-weight: 900;
          padding: 0 1px;
          text-decoration: underline;
          text-decoration-color: ${ACENTO};
          text-decoration-thickness: 2px;
          text-underline-offset: 4px;
        }
        .consejos {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid #233252;
          font-size: 14.5px;
          line-height: 1.55;
          color: #9fb0cb;
        }
        .consejos h3 {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #afc2e8;
        }
        .consejos ul {
          margin: 0 0 16px;
          padding-left: 20px;
        }
        .consejos li + li {
          margin-top: 6px;
        }
        .consejos strong {
          color: #e7ecf5;
          font-weight: 800;
        }
        .captura-texto {
          margin: 0 0 10px;
          text-align: center;
        }
        .consejos :global(.captura) {
          display: block;
          width: 100%;
          max-width: 200px;
          height: auto;
          margin: 0 auto;
          border-radius: 8px;
          border: 1px solid #233252;
        }
        /* La línea de arriba solo se nota cuando el cuerpo se desplaza por debajo del botón. */
        .foot {
          flex: none;
          padding: 16px 30px 26px;
          box-shadow: 0 -1px 0 #233252;
        }
        .continuar {
          display: block;
          width: 100%;
          padding: 15px 20px;
          border: 0;
          border-radius: 8px;
          background: ${ACENTO};
          color: #ffffff;
          font-family: inherit;
          font-size: 15.5px;
          font-weight: 800;
          letter-spacing: 0.01em;
          text-align: center;
          cursor: pointer;
        }
        .continuar:hover {
          background: #4a80e8;
        }
        @media (max-width: 480px) {
          .masthead {
            padding: 18px 52px 14px 22px;
          }
          .body {
            padding: 26px 22px 18px;
          }
          .foot {
            padding: 14px 22px 22px;
          }
          h2 {
            font-size: 21px;
          }
          .aviso {
            padding: 16px 14px;
          }
          .aviso p {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  )
}

function Reloj({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ACENTO}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function Sobre() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ACENTO}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

// Globo de mensaje: el aviso de WhatsApp, sin traer el logotipo de una marca ajena.
function Mensaje() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ACENTO}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
