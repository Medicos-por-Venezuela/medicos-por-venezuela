// La caja de donación: cuánto y cómo. Es el objetivo de la página y el destino de los seis
// botones "Quiero donar" repartidos por ella (`#donar`).
//
// Dos pasos, los de la plantilla: se elige el importe (o se escribe uno) y se despliega un método
// de pago (Zelle o PayPal). El importe elegido se repinta en los dos paneles, porque ni Zelle ni
// PayPal reciben la cantidad por el enlace: la persona la escribe en su banco, y verla ahí es lo
// que evita que se equivoque.

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Bilingue from './Bilingue'
import CodigoQr from './CodigoQr'
import { cls } from './clases'
import { QR_PAYPAL, QR_ZELLE } from './codigosQr'
import { CONFIG, MONTO_POR_OMISION, MONTOS, URL_INSTAGRAM, URL_PAYPAL } from './contenido'
import type { Idioma } from './idioma'
import { seguir } from './seguimiento'
import { comoDesplazar, enlaceCompartir } from './utilidades'

/** Cuál de los dos paneles de método está abierto. */
type Metodo = 'zelle' | 'paypal'

/** El ancho por debajo del cual el panel recién abierto se trae a la vista. */
const ANCHO_MOVIL = 920

type Props = {
  idioma: Idioma
  alPulsarAncla: (evento: MouseEvent<HTMLAnchorElement>) => void
  /**
   * Avisa de que la caja ha quedado POR ENCIMA de la pantalla. Lo escucha la página para sacar
   * la barra fija: la caja es la que sabe dónde está, así que es la que lo mide.
   */
  alQuedarArriba: (arriba: boolean) => void
}

export default function CajaDonacion({ idioma, alPulsarAncla, alQuedarArriba }: Props) {
  /** Lo que está marcado en la fila de importes: un número o el campo libre. */
  const [seleccion, setSeleccion] = useState<number | 'otro'>(MONTO_POR_OMISION)
  /** El importe que se muestra en los paneles de pago. El campo libre solo lo cambia si es > 0. */
  const [monto, setMonto] = useState<number>(MONTO_POR_OMISION)
  const [metodo, setMetodo] = useState<Metodo | null>(null)

  const caja = useRef<HTMLDivElement>(null)
  const campoOtro = useRef<HTMLInputElement>(null)
  const panelZelle = useRef<HTMLDivElement>(null)
  const panelPaypal = useRef<HTMLDivElement>(null)
  /** El evento "ha visto la caja" se manda una sola vez por visita. */
  const yaVista = useRef(false)

  // Un `IntersectionObserver` y no un oyente de `scroll`: avisa cuando la caja entra o sale de la
  // pantalla, no en cada fotograma, y la entrada trae ya el rectángulo con el que se distingue
  // "se quedó arriba" (hay que sacar la barra fija) de "todavía no ha llegado" (no hace falta:
  // el botón de la propia caja está a un dedo).
  //
  // El `setState` del padre pasa en el callback del observador, no en el cuerpo del efecto.
  useEffect(() => {
    const nodo = caja.current
    if (!nodo) return
    if (typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        alQuedarArriba(!entrada.isIntersecting && entrada.boundingClientRect.bottom < 0)
        if (entrada.isIntersecting && !yaVista.current) {
          yaVista.current = true
          seguir('ve_caja_donacion', idioma)
        }
      }
    })
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [alQuedarArriba, idioma])

  // El foco va al campo libre cuando aparece. En un efecto y no en el propio clic porque en ese
  // momento el campo sigue en `display:none` —React todavía no ha pintado— y `focus()` sobre un
  // elemento oculto no hace nada.
  useEffect(() => {
    if (seleccion === 'otro') campoOtro.current?.focus()
  }, [seleccion])

  // En móvil, el panel recién abierto se trae a la vista: se despliega por debajo del pliegue y
  // sin esto parece que el botón no ha hecho nada. Los 60 ms son los de la plantilla, el tiempo
  // que tarda en terminar la animación de apertura.
  useEffect(() => {
    if (!metodo) return
    if (window.innerWidth >= ANCHO_MOVIL) return
    const panel = metodo === 'zelle' ? panelZelle.current : panelPaypal.current
    const temporizador = window.setTimeout(() => {
      panel?.scrollIntoView({ behavior: comoDesplazar(), block: 'nearest' })
    }, 60)
    return () => window.clearTimeout(temporizador)
  }, [metodo])

  function elegirMonto(valor: number | 'otro') {
    setSeleccion(valor)
    if (valor !== 'otro') setMonto(valor)
    seguir('elige_monto', idioma, { monto: valor })
  }

  function alternarMetodo(cual: Metodo) {
    const abrir = metodo !== cual
    setMetodo(abrir ? cual : null)
    if (abrir) seguir('abre_metodo', idioma, { metodo: cual, monto })
  }

  /** El importe elegido, tal como lo pinta la plantilla en los dos paneles. */
  const importe = <b>${monto}</b>

  return (
    <div ref={caja} className={cls('caja')} id="donar">
      <div className={cls('bandera')} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p className={cls('caja-t')}>
        <Bilingue es="Apoya a Médicos por Venezuela" en="Support Médicos por Venezuela" />
      </p>
      <p className={cls('caja-s')}>
        <Bilingue
          es="Desde $1 ayuda. Elige cuánto y cómo."
          en="Even $1 helps. Choose how much and how."
        />
      </p>

      <p className={cls('paso-t')}>
        <Bilingue es="¿Cuánto quieres aportar?" en="How much would you like to give?" />
      </p>
      <div className={cls('montos')} role="group">
        {MONTOS.map((valor) => (
          <button
            key={valor}
            type="button"
            aria-pressed={seleccion === valor}
            onClick={() => elegirMonto(valor)}
          >
            ${valor}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={seleccion === 'otro'}
          onClick={() => elegirMonto('otro')}
        >
          <Bilingue es="Otro" en="Other" />
        </button>
      </div>
      {/* El campo va SIEMPRE en el DOM y se muestra con `display`, igual que en la plantilla: así
          `aria-pressed` y el campo no se desincronizan y el foco encuentra algo a lo que ir. */}
      <div className={cls('otro')} style={seleccion === 'otro' ? { display: 'block' } : undefined}>
        <label>
          ${' '}
          <input
            ref={campoOtro}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            aria-label={idioma === 'es' ? 'Monto' : 'Amount'}
            onChange={(evento) => {
              const valor = Number.parseInt(evento.target.value, 10)
              if (valor > 0) setMonto(valor)
            }}
          />
        </label>
      </div>

      <p className={cls('paso-t')}>
        <Bilingue es="¿Cómo quieres donar?" en="How would you like to give?" />
      </p>
      <div className={cls('elige-metodo')} role="group">
        <button
          type="button"
          className={cls('m-btn')}
          aria-expanded={metodo === 'zelle'}
          onClick={() => alternarMetodo('zelle')}
        >
          <span className={cls('m-logo', 'z')}>Zelle</span>
          <Bilingue es="Desde un banco de EE. UU." en="From a U.S. bank" />
        </button>
        <button
          type="button"
          className={cls('m-btn')}
          aria-expanded={metodo === 'paypal'}
          onClick={() => alternarMetodo('paypal')}
        >
          <span className={cls('m-logo', 'p')}>PayPal</span>
          <Bilingue es="Con tu cuenta PayPal" en="With your PayPal account" />
        </button>
      </div>

      <div ref={panelZelle} className={cls('panel-metodo')} hidden={metodo !== 'zelle'}>
        <div className={cls('metodo', 'zelle-card')}>
          <p className={cls('z-inst')}>
            <Bilingue
              es="Escanea el código con la app de tu banco:"
              en="Scan the code with your banking app:"
            />
          </p>
          <div className={cls('z-qr')}>
            <CodigoQr
              codigo={QR_ZELLE}
              etiqueta={idioma === 'es' ? 'Código QR de Zelle' : 'Zelle QR code'}
            />
          </div>
          <p className={cls('z-marca')}>Zelle</p>
          <p className={cls('z-alt')}>
            <Bilingue
              es={<>Envía {importe} o el monto que elijas.</>}
              en={<>Send {importe} or any amount you choose.</>}
            />
          </p>
        </div>
      </div>

      <div ref={panelPaypal} className={cls('panel-metodo')} hidden={metodo !== 'paypal'}>
        <div className={cls('metodo', 'zelle-card')}>
          <p className={cls('z-inst')}>
            <Bilingue es="Dona desde tu cuenta de PayPal:" en="Give from your PayPal account:" />
          </p>
          {/* El QR solo en pantalla grande (`.solo-pc`): en el móvil no tiene sentido escanear
              con la cámara del propio móvil la pantalla de ese móvil. Ahí va el botón. */}
          <div className={cls('z-qr', 'solo-pc')}>
            <CodigoQr
              codigo={QR_PAYPAL}
              etiqueta={idioma === 'es' ? 'Código QR de PayPal' : 'PayPal QR code'}
            />
          </div>
          <p className={cls('z-alt', 'solo-pc')}>
            <Bilingue
              es="Escanéalo con la cámara de tu teléfono, o usa el botón."
              en="Scan it with your phone camera, or use the button."
            />
          </p>
          <a
            className={cls('btn')}
            href={URL_PAYPAL}
            target="_blank"
            rel="noopener"
            onClick={() => seguir('elige_metodo', idioma, { metodo: 'paypal', monto })}
          >
            <Bilingue es="Donar con PayPal" en="Give with PayPal" />
          </a>
          <p className={cls('z-alt')}>
            <Bilingue
              es={<>Escribe el monto que elegiste: {importe}</>}
              en={<>Enter the amount you chose: {importe}</>}
            />
          </p>
        </div>
      </div>

      <details
        className={cls('vzla-nota')}
        onToggle={(evento) => {
          if (evento.currentTarget.open) seguir('abre_nota_vzla', idioma)
        }}
      >
        <summary>
          <Bilingue es="¿Estás en Venezuela?" en="Are you in Venezuela?" />
        </summary>
        <p>
          <Bilingue
            es="Por ahora no podemos recibir aportes en bolívares. Si tienes Zelle o PayPal, puedes donar igual que desde cualquier país. Y si hoy no puedes, compartir también ayuda."
            en="We can't receive donations in bolívares for now. If you have Zelle or PayPal, you can give just like from any other country. And if you can't today, sharing helps too."
          />
        </p>
        <div className={cls('vzla-btns')}>
          <a
            className={cls('b-wa')}
            href={enlaceCompartir(idioma)}
            target="_blank"
            rel="noopener"
            onClick={() => seguir('compartir_whatsapp_caja', idioma)}
          >
            <Bilingue es="Compartir por WhatsApp" en="Share on WhatsApp" />
          </a>
          <a
            className={cls('b-ig')}
            href={URL_INSTAGRAM}
            target="_blank"
            rel="noopener"
            onClick={() => seguir('seguir_instagram_caja', idioma)}
          >
            <Bilingue es="Seguir en Instagram" en="Follow on Instagram" />
          </a>
        </div>
      </details>

      {/* Mientras no haya un WhatsApp al que mandar el comprobante, este aviso no se pinta: es lo
          que hacía la plantilla con `if (CONFIG.whatsappComprobante)`. Poner el enlace en
          `contenido.ts` lo activa. */}
      <p className={cls('comprobante')} hidden={!CONFIG.whatsappComprobante}>
        <Bilingue es="¿Ya donaste?" en="Already gave?" />{' '}
        <a
          href={CONFIG.whatsappComprobante || undefined}
          target="_blank"
          rel="noopener"
          onClick={() => seguir('enviar_comprobante', idioma)}
        >
          <Bilingue
            es="Envíanos tu comprobante por WhatsApp"
            en="Send us your receipt on WhatsApp"
          />
        </a>{' '}
        <Bilingue
          es="para registrar tu aporte y darte las gracias."
          en="so we can record your gift and thank you."
        />
      </p>
      <p className={cls('nota-trans')}>
        <Bilingue
          es="Aportes voluntarios, no deducibles de impuestos."
          en="Voluntary, non-tax-deductible gifts."
        />{' '}
        <a href="#transparencia" onClick={alPulsarAncla}>
          <Bilingue es="Más detalles" en="Details" />
        </a>
      </p>
    </div>
  )
}
