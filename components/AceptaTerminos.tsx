// Casilla de aceptación de los Términos de uso y privacidad (`/legal/privacidad`). La usan los tres
// sitios donde nace una cuenta o una solicitud: `/registro-paciente`, `/registro-medico` y
// `/elegir-rol`, que es por donde termina el alta quien entra con Google sin pasar por ninguno de
// los dos formularios.
//
// El enlace abre en OTRA pestaña a propósito: quien está a mitad de un formulario no puede perder
// lo que lleva escrito por leer los términos. `noopener` para que la pestaña nueva no pueda tocar
// esta por `window.opener`.
//
// El enlace va dentro del <label>: así el texto entero es el nombre accesible de la casilla. Pulsar
// el enlace no la marca, porque el HTML excluye el contenido interactivo de la activación del label.
//
// Hoy la aceptación se exige en el formulario pero no se guarda en el backend (ni fecha ni
// versión de los términos aceptados).

import Link from 'next/link'
import { RUTAS } from './home/copy'

export const MENSAJE_TERMINOS = 'Debes aceptar los Términos de uso y privacidad para continuar.'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function AceptaTerminos({ checked, onChange }: Props) {
  return (
    <label
      className="notice notice-info"
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 'auto', marginTop: 5 }}
      />
      <span>
        He leído y acepto los{' '}
        <Link
          href={RUTAS.terminos}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 700, textDecoration: 'underline', color: 'inherit' }}
        >
          Términos de uso y privacidad
        </Link>
        .
      </span>
    </label>
  )
}
