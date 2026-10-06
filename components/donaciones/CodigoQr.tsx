// Pinta uno de los códigos QR de la caja de donación. Los datos están en `codigosQr.ts`.
//
// `shapeRendering="crispEdges"` es lo que mantiene los cuadritos con el borde recto al escalar:
// sin él el navegador los suaviza y hay cámaras que dejan de leer el código. Viene de la
// plantilla y no se toca.

import type { CodigoQr as DatosQr } from './codigosQr'

type Props = {
  codigo: DatosQr
  /** Lo que lee en voz alta un lector de pantalla. */
  etiqueta: string
}

export default function CodigoQr({ codigo, etiqueta }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={codigo.viewBox}
      shapeRendering="crispEdges"
      role="img"
      aria-label={etiqueta}
    >
      <rect x="-2" y="-2" width={codigo.lado} height={codigo.lado} fill="#fff" />
      <path d={codigo.trazo} fill="#000" />
    </svg>
  )
}
