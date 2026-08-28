// Las tres cifras de la portada, en vivo desde el backend.
//
// Hasta el 2026-08-28 eran números curados a mano en `copy.ts` — y envejecían: el copy original
// decía "+3.000 médicos" cuando la base tenía ~2.960, y hubo que bajarlo a "+2.000" para no
// mentir. Ahora salen de `GET /stats/public`, que los devuelve YA REDONDEADOS a la baja desde el
// servidor. Aquí no se redondea nada: el conteo exacto nunca llega al navegador.
//
// Las cifras de `METRICAS` siguen sirviendo de RESPALDO, y siguen siendo ciertas (son menores que
// las reales). Es lo que se pinta en el servidor, lo que ve quien no tenga JavaScript y lo que
// queda si el backend no responde: en una página cuyo argumento es la credibilidad, un hueco o un
// cero por un fallo de red es peor que una cifra conservadora.

import { useState } from 'react'
import { fetchPublicStats, type PublicStats } from '../../lib/api'
import { useMountEffect } from '../../lib/hooks'
import { METRICAS } from './copy'

const RESPALDO: PublicStats = {
  doctors: METRICAS.medicos,
  consultations: METRICAS.consultas,
  specialties: METRICAS.especialidades
}

// Una sola petición aunque la usen dos secciones (el hero y la banda de impacto): se guarda la
// promesa, no el resultado, para que dos montajes simultáneos compartan el mismo vuelo.
let enVuelo: Promise<PublicStats> | null = null

function cargar(): Promise<PublicStats> {
  if (!enVuelo) enVuelo = fetchPublicStats().then((cifras) => cifras ?? RESPALDO)
  return enVuelo
}

export function useCifras(): PublicStats {
  const [cifras, setCifras] = useState<PublicStats>(RESPALDO)
  useMountEffect(() => {
    let vivo = true
    cargar().then((nuevas) => {
      if (vivo) setCifras(nuevas)
    })
    return () => {
      vivo = false
    }
  })
  return cifras
}
