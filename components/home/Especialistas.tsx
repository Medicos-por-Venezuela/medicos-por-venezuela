// Especialistas: rejilla de diez perfiles sobre el azul eléctrico de marca (era navy y de seis
// tarjetas placeholder hasta la segunda ronda de copy, 2026-08-28).
//
// Son personas reales, con su retrato. La tarjeta es foto arriba a sangre y datos debajo, que es
// como se presenta hoy un directorio médico: la cara es lo que se reconoce y lo que sostiene la
// confianza que esta sección defiende, así que ocupa el espacio — no un avatar de 64 px en una
// esquina, como cuando eran plazas vacías.
//
// Los retratos van todos a 4:5 y con la cabeza al mismo tamaño y a la misma altura. Eso NO sale de
// las fotos originales —van de plano de busto a cuerpo entero— sino de un recorte calculado por
// foto en `scripts/optimize-specialist-photos.mjs`. Está explicado allí; si entra una foto nueva
// hay que medirla igual, o desentonará con las otras nueve.
//
// El `alt` va vacío a propósito: el nombre está escrito justo debajo, dentro de la misma tarjeta.
// Repetirlo en el `alt` haría que un lector de pantalla dijera cada nombre dos veces seguidas.
//
// CONTRASTE — sobre `--h-blue` el blanco PURO da 4,85:1, justo por encima del 4,5:1 de WCAG AA, y
// cualquier transparencia se cae del mínimo: `--h-sobre-oscuro-medio` (blanco al 80 %) da 3,63:1.
// Por eso aquí NO se usan los tokens de texto sobre oscuro, ni `opacity` sobre el texto: todo es
// `--h-white` y la jerarquía se hace con tamaño, peso y caja alta. Mismo criterio que Psicología,
// la otra sección sobre este fondo.
//
// El "Ver todos los especialistas →" se retiró el 2026-08-28 junto con la entrada del menú: no hay
// página de Especialistas a la que remitir, y un enlace inerte en la home de una organización
// médica erosiona justo la credibilidad que esta sección defiende.
//
// Los filetes de la rejilla se hacen con borde arriba+izquierda en el contenedor y derecha+abajo en
// cada celda: la técnica no depende de cuántas columnas haya. Lo que sí depende del número de
// columnas es que la ÚLTIMA FILA salga completa — con una fila a medias, los filetes dejan media
// banda abierta y parece un fallo de maquetación. Por eso los tres anchos usan 5, 2 y 1 columnas,
// que son los divisores de 10.

import Image from 'next/image'
import { ESPECIALISTAS } from './copy'
import { useReveal } from './motion'

export default function Especialistas() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="especialistas" aria-label="Nuestros especialistas">
      <div className="contenido">
        <div className="cabecera">
          <p className="eyebrow">{ESPECIALISTAS.eyebrow}</p>
          <div className="filete" aria-hidden="true" />
          <h2 className="titulo">{ESPECIALISTAS.titulo}</h2>
          <p className="subtitulo">{ESPECIALISTAS.subtitulo}</p>
        </div>

        <div ref={ref} className={`rejilla ${className}`}>
          {ESPECIALISTAS.perfiles.map((perfil) => (
            <article className="ficha" key={perfil.nombre}>
              <div className="retrato">
                {/* Cinco columnas dentro de 1180 px dan ~236 px por tarjeta; dos en tableta y una a
                    pantalla completa en móvil. Sin `sizes`, Next serviría la variante grande
                    también en el móvil. */}
                <Image
                  src={perfil.foto}
                  alt=""
                  fill
                  sizes="(max-width: 560px) 100vw, (max-width: 1000px) 50vw, 236px"
                />
              </div>
              <div className="datos">
                <h3 className="nombre">{perfil.nombre}</h3>
                <p className="especialidad">{perfil.especialidad}</p>
                <p className="verificado">
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{' '}
                  {ESPECIALISTAS.verificado}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style jsx>{`
        .especialistas {
          background: var(--h-blue);
          padding: 110px 48px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .cabecera {
          margin-bottom: 56px;
          max-width: 660px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-white);
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin: 0 0 10px;
        }
        .filete {
          width: 36px;
          height: 2px;
          /* Blanco, no azul: el filete azul de las demás secciones desaparecería sobre este fondo. */
          background: var(--h-white);
          margin-bottom: 26px;
        }
        .titulo {
          font-size: clamp(28px, 3.6vw, 42px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 18px;
        }
        .subtitulo {
          font-size: 15.5px;
          color: var(--h-white);
          line-height: 1.78;
          margin: 0;
        }
        .rejilla {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          /* Filetes al 28 % y no al 12 %: sobre el azul eléctrico, que es mucho más claro que el
             navy, un blanco al 12 % no se ve. */
          border-top: 1px solid rgba(255, 255, 255, 0.28);
          border-left: 1px solid rgba(255, 255, 255, 0.28);
        }
        /* Sin padding: la foto llega a sangre hasta los filetes y solo el bloque de datos respira. */
        .ficha {
          border-right: 1px solid rgba(255, 255, 255, 0.28);
          border-bottom: 1px solid rgba(255, 255, 255, 0.28);
          display: flex;
          flex-direction: column;
        }
        /* 4:5, la misma proporción con la que se generan los archivos. Se declara también aquí para
           que la tarjeta reserve el hueco antes de que cargue la imagen y la rejilla no dé el salto
           de maquetación al aparecer las diez. */
        .retrato {
          position: relative;
          aspect-ratio: 4 / 5;
          /* Color de espera un punto más oscuro que el fondo: un hueco del mismo azul no se
             distinguiría y la tarjeta parecería vacía mientras carga. */
          background: var(--h-blue-dark);
        }
        .retrato :global(img) {
          object-fit: cover;
        }
        .datos {
          padding: 16px 16px 20px;
          display: flex;
          flex-direction: column;
          /* Empuja el "Verificado" al pie: con especialidades de uno y de tres renglones, si no se
             alinea queda a alturas distintas dentro de la misma fila. */
          flex-grow: 1;
        }
        .nombre {
          font-size: 15px;
          font-weight: 800;
          color: var(--h-white);
          line-height: 1.3;
          margin: 0 0 5px;
        }
        .especialidad {
          font-size: 11px;
          color: var(--h-white);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          line-height: 1.5;
          margin: 0 0 14px;
          flex-grow: 1;
        }
        .verificado {
          font-size: 9.5px;
          font-weight: 700;
          color: var(--h-white);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0;
        }
        /* El verde de marca sobre este azul da 2,78:1. Es un glifo decorativo (va con aria-hidden y
           repite la palabra que tiene al lado), pero a 9,5 px no se distingue, así que va en blanco
           como el resto. */
        .check {
          color: var(--h-white);
        }

        /* 1000 px y no 900: por debajo de eso las cinco columnas bajan de ~180 px y el nombre
           empieza a partirse en tres líneas. */
        @media (max-width: 1000px) {
          .rejilla {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .especialistas {
            padding: 72px 24px;
          }
        }
        @media (max-width: 560px) {
          .rejilla {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
