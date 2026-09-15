// Términos de uso y privacidad. Destino del enlace del pie y de la casilla de aceptación de los
// registros (`components/AceptaTerminos.tsx`), que abre esta página en otra pestaña.
//
// El texto parte del documento legal que entregó el equipo (2026-09-13), corregido contra lo que la
// plataforma hace DE VERDAD: sin la autenticación de dos factores, que no existe; con los datos
// que piden de verdad los formularios de paciente y de profesional; con la verificación ante el
// SACS y la FPV, y con los proveedores reales. Cada afirmación de aquí es un compromiso legal: si
// cambia el producto (un proveedor nuevo, un dato más en un formulario), este texto cambia con él
// y se actualiza `ACTUALIZADO`.
//
// Va de "usted", como el documento del equipo, aunque el resto del sitio tutea.
//
// Composición igual que `/quienes-somos`: `.home-theme` acota los tokens de marca a esta página, y
// Navbar y Footer son los del home.

import Head from 'next/head'
import Seo from '../../components/Seo'
import Footer from '../../components/home/Footer'
import Navbar from '../../components/home/Navbar'
import { MARCA } from '../../components/home/copy'

const ACTUALIZADO = '14 de septiembre de 2026'
const CORREO_LEGAL = 'legal@medicosporvenezuela.org'

export default function TerminosPrivacidadPage() {
  return (
    <div className="home-theme">
      <Seo
        titulo="Términos de uso y privacidad — Médicos por Venezuela"
        descripcion={
          'Condiciones de uso de la plataforma, límites de la telemedicina y cómo recopilamos, ' +
          'usamos y protegemos los datos de pacientes y profesionales de la salud.'
        }
        ruta="/legal/privacidad"
      />

      <Head>
        {/* Mismo preload que el home: el titular se pinta con la fuente de marca en el primer
            render, y sin preload el texto salta al cambiar de fuente. */}
        <link
          rel="preload"
          href="/brand/nunito-sans-variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>

      <Navbar />

      <main>
        <section className="masthead" aria-label="Términos de uso y privacidad">
          <div className="contenido">
            <p className="eyebrow">Legal</p>
            <div className="filete" aria-hidden="true" />
            <h1 className="titulo">Términos de uso y privacidad</h1>
            <p className="actualizado">Última actualización: {ACTUALIZADO}</p>
            <p className="intro">
              Antes de usar la plataforma, lea atentamente estos términos. Al acceder o utilizar
              nuestro sitio web o nuestros servicios, usted reconoce haber leído, entendido y
              aceptado estos Términos de uso y privacidad. Si no está de acuerdo con ellos, por
              favor no utilice la Plataforma.
            </p>
          </div>
        </section>

        <div className="cuerpo">
          {/* Lo más importante del documento va antes de todo lo demás, no en la sección 2: quien
              llega aquí con una urgencia tiene que leerlo sin desplazarse. */}
          <aside className="destacado" aria-label="Aviso importante">
            <p>
              <strong>La telemedicina no reemplaza la atención de un médico en persona.</strong> Si
              tiene síntomas graves o una emergencia médica, acuda de inmediato a su servicio de
              salud más cercano.
            </p>
          </aside>

          <section id="quienes-somos">
            <h2>1. Quiénes somos</h2>
            <p>
              {MARCA.nombre} es una organización sin fines de lucro y la responsable de la
              plataforma {MARCA.web} (la «Plataforma») y del tratamiento de los datos personales que
              se recogen en ella. Nos comprometemos a proteger su privacidad y la seguridad de su
              información. Este documento explica las condiciones de uso de la Plataforma y cómo
              recopilamos, utilizamos, compartimos y protegemos sus datos.
            </p>
          </section>

          <section id="telemedicina">
            <h2>2. Qué ofrece la Plataforma y qué no</h2>
            <p>
              La Plataforma conecta a pacientes que están en Venezuela con profesionales de la salud
              voluntarios, que les ofrecen orientación médica gratuita por videoconsulta, y a
              médicos que ejercen en el país con especialistas de la red para interconsultas.
            </p>
            <ul>
              <li>
                <strong>La telemedicina no reemplaza la consulta presencial.</strong> Quien le
                atiende a distancia no puede examinarle físicamente, y su orientación no sustituye
                el diagnóstico, los exámenes ni el tratamiento que requieren la presencia de un
                médico.
              </li>
              <li>
                <strong>No es un servicio de emergencias.</strong> Ante síntomas graves o una
                emergencia, acuda de inmediato al centro de salud más cercano; no espere a ser
                atendido por la Plataforma.
              </li>
              <li>
                Si el profesional considera que su caso requiere atención presencial, le recomendará
                acudir a un centro de salud.
              </li>
              <li>La atención es gratuita para el paciente.</li>
            </ul>
          </section>

          <section id="informacion">
            <h2>3. Información que recopilamos</h2>
            <ul>
              <li>
                <strong>De los pacientes:</strong> nombre completo, cédula, número de WhatsApp,
                correo electrónico, zona, edad, alergias y la descripción del motivo de la consulta.
                Durante la atención, también el estado del caso y las notas del profesional que le
                atiende.
              </li>
              <li>
                <strong>De los menores de edad:</strong> la consulta la solicita un adulto
                responsable, que proporciona sus propios datos, los del menor y su parentesco con
                él, y acepta estos términos en su nombre.
              </li>
              <li>
                <strong>De los profesionales de la salud:</strong> tipo de profesional, cédula,
                nombre completo, licencia o colegiatura, especialidad, número de WhatsApp, correo
                electrónico y país de residencia.
              </li>
              <li>
                <strong>Datos de acceso:</strong> su correo y su contraseña o, si entra con Google,
                el nombre y el correo de esa cuenta.
              </li>
              <li>
                <strong>Información técnica:</strong> dirección IP, tipo de navegador y dispositivo,
                cookies y datos de uso.
              </li>
              <li>
                <strong>Datos de salud:</strong> la descripción de su consulta y sus alergias son
                datos sensibles. Solo los recogemos con su consentimiento explícito, que usted da al
                enviar su solicitud.
              </li>
            </ul>
          </section>

          <section id="verificacion">
            <h2>4. Verificación de los profesionales</h2>
            <p>
              Validamos la cédula de cada médico contra el registro del Servicio Autónomo de
              Contraloría Sanitaria (SACS), y la de cada psicólogo contra el de la Federación de
              Psicólogos de Venezuela (FPV). Para hacerlo, consultamos esos registros con la cédula
              que el profesional nos proporciona al registrarse.
            </p>
          </section>

          <section id="uso">
            <h2>5. Cómo usamos su información</h2>
            <p>Utilizamos sus datos para:</p>
            <ul>
              <li>Proporcionar y mejorar nuestros servicios.</li>
              <li>Asignar su consulta a un profesional de la especialidad adecuada.</li>
              <li>Verificar las credenciales profesionales ante el SACS y la FPV.</li>
              <li>Facilitar la conexión entre médicos venezolanos.</li>
              <li>Enviar comunicaciones.</li>
              <li>Cumplir con obligaciones legales.</li>
            </ul>
          </section>

          <section id="quien-ve-sus-datos">
            <h2>6. Quién ve sus datos</h2>
            <ul>
              <li>
                En la lista de espera, los profesionales ven solo lo necesario para decidir quién le
                atiende: zona, edad, alergias y el motivo de la consulta, sin su nombre.
              </li>
              <li>
                Su nombre, su cédula y su número de teléfono solo los ven el profesional que toma su
                consulta y el equipo de administración de la Plataforma.
              </li>
              <li>
                Si su médico pide una interconsulta, el especialista que la atiende solo ve el
                motivo de la consulta, las notas clínicas de su médico y su edad, sin sus datos
                personales: ni nombre, ni cédula, ni teléfono, ni correo, ni zona.
              </li>
              <li>
                El teléfono de los profesionales nunca se muestra a los pacientes. Solo se facilita
                a otro profesional de la red para coordinar una interconsulta, y queda registrado.
              </li>
            </ul>
          </section>

          <section id="compartir">
            <h2>7. Compartir información</h2>
            <p>No vendemos sus datos personales. Solo los compartimos:</p>
            <ul>
              <li>Con su consentimiento.</li>
              <li>
                Con los proveedores de servicios que listamos a continuación, bajo estricta
                confidencialidad.
              </li>
              <li>Cuando la ley lo requiera.</li>
            </ul>
          </section>

          <section id="proveedores">
            <h2>8. Proveedores que usamos</h2>
            <p>Para operar la Plataforma nos apoyamos en estos proveedores:</p>
            <ul>
              <li>
                <strong>Supabase:</strong> base de datos e inicio de sesión.
              </li>
              <li>
                <strong>Amazon Web Services (AWS):</strong> alojamiento del sitio web y de nuestros
                servidores.
              </li>
              <li>
                <strong>Jitsi Meet:</strong> videoconsultas, en una instalación propia de{' '}
                {MARCA.nombre}.
              </li>
              <li>
                <strong>Google:</strong> inicio de sesión con Google y Google Analytics, que usamos
                para medir el uso del sitio.
              </li>
              <li>
                <strong>Mailtrap:</strong> envío de los correos de la Plataforma, como los avisos de
                registro y de consultas.
              </li>
              <li>
                <strong>Kit:</strong> envío de comunicaciones por correo electrónico.
              </li>
            </ul>
            <p>
              Algunos de estos proveedores guardan o procesan los datos fuera de Venezuela,
              principalmente en Estados Unidos.
            </p>
          </section>

          <section id="seguridad">
            <h2>9. Medidas de seguridad</h2>
            <p>Aplicamos las siguientes protecciones:</p>
            <ul>
              <li>Encriptación SSL/TLS en todas las conexiones.</li>
              <li>Contraseñas guardadas cifradas: nadie de nuestro equipo puede verlas.</li>
              <li>Acceso por roles: paciente, profesional y administración.</li>
              <li>
                Registro de auditoría de las acciones sensibles, como la consulta de datos de
                contacto o la exportación de reportes.
              </li>
              <li>Almacenamiento seguro y revisiones periódicas.</li>
              <li>Políticas internas de confidencialidad.</li>
            </ul>
            <p>
              Ningún sistema es 100 % seguro. Le recomendamos usar contraseñas fuertes y no
              compartir sus credenciales.
            </p>
          </section>

          <section id="cookies">
            <h2>10. Cookies</h2>
            <p>
              Utilizamos cookies y almacenamiento del navegador necesarios para el funcionamiento
              del sitio, como mantener su sesión iniciada, y cookies analíticas de Google Analytics
              para mejorar la experiencia. Puede gestionarlas desde la configuración de su
              navegador.
            </p>
          </section>

          <section id="derechos">
            <h2>11. Sus derechos</h2>
            <p>Usted puede:</p>
            <ul>
              <li>Acceder, rectificar o eliminar sus datos.</li>
              <li>Oponerse al tratamiento de sus datos.</li>
              <li>Retirar su consentimiento.</li>
            </ul>
            <p>
              Para ejercer cualquiera de estos derechos, escríbanos a{' '}
              <a href={`mailto:${CORREO_LEGAL}`}>{CORREO_LEGAL}</a>.
            </p>
          </section>

          <section id="cambios">
            <h2>12. Cambios en estos términos</h2>
            <p>
              Podemos actualizar estos términos. Le notificaremos los cambios significativos
              publicando la versión actualizada en esta página, con su fecha de actualización.
            </p>
          </section>

          <section id="contacto">
            <h2>13. Responsable y contacto</h2>
            <p>
              Responsable del tratamiento de los datos: {MARCA.nombre}.
              <br />
              Correo: <a href={`mailto:${CORREO_LEGAL}`}>{CORREO_LEGAL}</a>
            </p>
          </section>
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .masthead {
          background: var(--h-navy);
          padding: 88px 48px 72px;
        }
        .contenido {
          max-width: 760px;
          margin: 0 auto;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-blue-claro);
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin: 0 0 10px;
        }
        .filete {
          width: 36px;
          height: 2px;
          background: var(--h-blue);
          margin-bottom: 26px;
        }
        .titulo {
          font-size: clamp(30px, 4vw, 44px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.12;
          letter-spacing: -0.025em;
          margin: 0 0 14px;
        }
        .actualizado {
          font-size: 13px;
          color: var(--h-sobre-oscuro-tenue);
          margin: 0 0 22px;
        }
        .intro {
          font-size: 16px;
          color: var(--h-sobre-oscuro-medio);
          line-height: 1.8;
          margin: 0;
        }

        .cuerpo {
          max-width: 760px;
          margin: 0 auto;
          padding: 56px 48px 88px;
        }
        .destacado {
          border-left: 4px solid var(--h-blue);
          background: var(--h-grey-bg);
          border-radius: 0 10px 10px 0;
          padding: 18px 22px;
          margin-bottom: 44px;
        }
        .destacado p {
          font-size: 16px;
          line-height: 1.65;
          margin: 0;
        }
        section + section {
          margin-top: 36px;
          padding-top: 36px;
          border-top: 1px solid #e5e7eb;
        }
        h2 {
          font-size: 19px;
          font-weight: 800;
          line-height: 1.3;
          margin: 0 0 14px;
        }
        p,
        li {
          font-size: 15.5px;
          line-height: 1.75;
          color: var(--h-grey);
        }
        p {
          margin: 0 0 12px;
        }
        p:last-child {
          margin-bottom: 0;
        }
        strong {
          color: var(--h-navy);
        }
        ul {
          list-style: none;
          margin: 0 0 12px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        ul:last-child {
          margin-bottom: 0;
        }
        li {
          position: relative;
          padding-left: 20px;
        }
        li::before {
          content: '';
          position: absolute;
          left: 2px;
          top: 11px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--h-blue);
        }
        /* Sobre blanco, el azul que cumple el 4,5:1 a este tamaño es el oscuro (ver globals.css). */
        a {
          color: var(--h-blue-dark);
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 900px) {
          .masthead {
            padding: 56px 24px 52px;
          }
          .cuerpo {
            padding: 40px 24px 64px;
          }
          .intro {
            font-size: 15.5px;
          }
        }
      `}</style>
    </div>
  )
}
