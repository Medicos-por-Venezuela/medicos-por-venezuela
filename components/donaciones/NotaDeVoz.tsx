// La nota de voz de Luis: el reproductor con onda, cronómetro y subtítulos.
//
// Es el corazón de la página —el testimonio en la voz del paciente— y la parte del guion de la
// plantilla con más estado. Traducción a React, punto por punto:
//
//   · Los `addEventListener` sobre el `<audio>` son props (`onPlay`, `onTimeUpdate`…). No es
//     cosmético: React los quita al desmontar sin que haya que acordarse, que es exactamente lo
//     que pide el encargo.
//   · El elemento `<audio>` no se busca con `getElementById`: se maneja con una `ref`, porque
//     `play()`, `pause()` y `currentTime` son cosas que solo sabe hacer el nodo real.
//   · Las 34 barras de la onda las pinta el render a partir de la constante `ONDA`, no un bucle
//     que las va metiendo en el DOM. Salen iguales en el servidor y en el cliente.
//
// HIDRATACIÓN. Nada de lo que se pinta en el primer render depende del navegador: el cronómetro
// muestra la duración por omisión (0:57, la del archivo, igual que el HTML de la plantilla), la
// onda va a cero y el subtítulo es el aviso bilingüe. La duración REAL llega con
// `loadedmetadata`, ya en el cliente.

import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import Bilingue from './Bilingue'
import { cls } from './clases'
import { ONDA, SUBTITULOS } from './contenido'
import type { Idioma } from './idioma'
import { seguir } from './seguimiento'

/**
 * La duración del archivo, en segundos. La plantilla la lleva escrita en dos sitios (el `0:57`
 * del HTML y el `57.1` del guion) y la usa mientras el navegador no ha leído los metadatos.
 */
const DURACION_POR_OMISION = 57.1

/** Cuánto salta el teclado en la onda, en segundos. */
const SALTO_TECLADO = 5

/** `m:ss`, con la misma aritmética que el `fmt()` de la plantilla. */
function formatearTiempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  return `${Math.floor(s / 60)}:${`0${s % 60}`.slice(-2)}`
}

type Props = {
  idioma: Idioma
}

export default function NotaDeVoz({ idioma }: Props) {
  const audio = useRef<HTMLAudioElement>(null)
  const onda = useRef<HTMLDivElement>(null)

  const [reproduciendo, setReproduciendo] = useState(false)
  const [segundo, setSegundo] = useState(0)
  const [duracion, setDuracion] = useState(DURACION_POR_OMISION)
  /**
   * Hasta que no se le da al play (o se pincha la onda), el recuadro muestra el aviso "Escucha a
   * Luis, con subtítulos" en vez de ir soltando frases sueltas. Es el `escuchado` del original.
   */
  const [escuchado, setEscuchado] = useState(false)
  /** Qué tramo de subtítulo toca. `null` = todavía el aviso. */
  const [tramo, setTramo] = useState<number | null>(null)

  const avance = duracion > 0 ? Math.min(1, segundo / duracion) : 0
  const barrasEncendidas = Math.floor(avance * ONDA.length)
  // Igual que la plantilla: parado al principio muestra cuánto dura; en marcha, por dónde va.
  const tiempoVisible = !reproduciendo && segundo === 0 ? duracion : segundo

  function alternar() {
    const elemento = audio.current
    if (!elemento) return
    if (elemento.paused) {
      setEscuchado(true)
      // `play()` devuelve una promesa que se rechaza si el navegador bloquea la reproducción
      // automática. Aquí viene de un clic, así que no debería pasar; si pasa, no se hace nada
      // (el botón sigue en "reproducir") en vez de dejar un error sin recoger en la consola.
      void elemento.play().catch(() => {})
      seguir('escucha_nota_luis', idioma)
    } else {
      elemento.pause()
    }
  }

  function saltarAlPunto(evento: MouseEvent<HTMLDivElement>) {
    const elemento = audio.current
    const pista = onda.current
    if (!elemento || !pista || !elemento.duration) return
    const caja = pista.getBoundingClientRect()
    elemento.currentTime = ((evento.clientX - caja.left) / caja.width) * elemento.duration
    setEscuchado(true)
    if (elemento.paused) void elemento.play().catch(() => {})
  }

  function saltarConTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    const elemento = audio.current
    if (!elemento || !elemento.duration) return
    if (evento.key === 'ArrowRight') {
      elemento.currentTime = Math.min(elemento.duration, elemento.currentTime + SALTO_TECLADO)
    }
    if (evento.key === 'ArrowLeft') {
      elemento.currentTime = Math.max(0, elemento.currentTime - SALTO_TECLADO)
    }
  }

  function alAvanzar() {
    const elemento = audio.current
    if (!elemento) return
    setSegundo(elemento.currentTime)
    if (!escuchado) return
    const indice = SUBTITULOS.findIndex(
      (s) => elemento.currentTime >= s.desde && elemento.currentTime < s.hasta
    )
    // Fuera de todo tramo (el silencio del final) se queda el último, como en la plantilla: un
    // recuadro que se vacía de golpe se lee como un fallo.
    if (indice !== -1) setTramo(indice)
  }

  return (
    <div className={cls('nota')}>
      <div className={cls('nota-cab')}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Ver el comentario de FotoEquipo:
            toda la página de donaciones usa <img> a propósito, para no alterar el marcado de la
            plantilla ni su maquetación. */}
        <img src="/donaciones/luis-hernandez.jpg" alt="Luis Hernández" width={44} height={44} />
        <div>
          <b>Luis Hernández</b>
          <Bilingue es="Nota de voz para el equipo" en="Voice note to the team" />
        </div>
      </div>

      <div className={cls('reproductor')}>
        <button
          className={cls('play')}
          type="button"
          // La plantilla deja esta etiqueta siempre en castellano; aquí sigue al idioma activo,
          // que es lo único que oye quien navega con lector de pantalla en inglés.
          aria-label={
            reproduciendo
              ? idioma === 'es'
                ? 'Pausar'
                : 'Pause'
              : idioma === 'es'
                ? 'Reproducir nota de voz'
                : 'Play voice note'
          }
          onClick={alternar}
        >
          {reproduciendo ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"
              />
            </svg>
          )}
        </button>

        {/* `role="slider"` + `tabindex` + las flechas: la onda es operable con el teclado, no
            solo con el ratón. Viene de la plantilla y se conserva tal cual. */}
        <div
          ref={onda}
          className={cls('onda')}
          role="slider"
          aria-label={idioma === 'es' ? 'Progreso' : 'Progress'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(avance * 100)}
          tabIndex={0}
          onClick={saltarAlPunto}
          onKeyDown={saltarConTeclado}
        >
          {ONDA.map((altura, indice) => (
            <i
              key={indice}
              className={indice < barrasEncendidas ? cls('on') : undefined}
              style={{ height: `${altura * 0.44}px` }}
            />
          ))}
        </div>

        <span className={cls('tiempo')}>{formatearTiempo(tiempoVisible)}</span>
      </div>

      {/* `aria-live="polite"` hace que el lector de pantalla vaya leyendo los subtítulos, que es
          para lo que están. `lang` acompaña al idioma del texto que hay dentro. */}
      <p
        className={tramo === null ? cls('subt', 'espera') : cls('subt')}
        aria-live="polite"
        lang={idioma}
      >
        {tramo === null ? (
          <Bilingue
            es="Escucha a Luis, con subtítulos."
            en="Hear Luis (in Spanish, with subtitles)."
          />
        ) : (
          SUBTITULOS[tramo][idioma]
        )}
      </p>

      <audio
        ref={audio}
        preload="metadata"
        src="/donaciones/luis-nota-de-voz.mp3"
        onLoadedMetadata={(evento) => {
          const real = evento.currentTarget.duration
          if (Number.isFinite(real) && real > 0) setDuracion(real)
        }}
        onTimeUpdate={alAvanzar}
        onPlay={() => setReproduciendo(true)}
        onPause={() => setReproduciendo(false)}
        onEnded={() => {
          setReproduciendo(false)
          seguir('nota_luis_completa', idioma)
        }}
      />
    </div>
  )
}
