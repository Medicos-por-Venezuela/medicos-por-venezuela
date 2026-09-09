// ¿Dónde está el paciente? Lo que el médico mira antes de decidir si sigue esperando.
//
// Había una sola señal, la presencia por Realtime, y decía "● En sala" — que se lee como "está
// en la videollamada" cuando en realidad significa "tiene abierta una pestaña NUESTRA". Justo al
// entrar a Jitsi esa pestaña pasa a segundo plano (en móvil el navegador la suspende y se cae el
// WebSocket), así que el médico veía "○ Sin conexión" en el momento exacto en que el paciente
// acababa de entrar a la sala con él. Lo peor que puede hacer un indicador: apagarse cuando
// ocurre lo que anuncia.
//
// Ahora son dos señales distintas, y la etiqueta de cada una dice lo que de verdad sabe:
//
//   1. `entered_call_at` — el paciente PULSÓ para entrar a la videollamada. Se persiste una vez
//      en la base, así que sobrevive a que se muera la pestaña. Es la señal fuerte y la que
//      manda cuando existe.
//   2. Presencia Realtime — tiene abierta la página de espera. Útil ANTES de que entre.
//
// Lo que ninguna de las dos sabe es si el paciente sigue DENTRO de la sala ahora mismo: eso solo
// lo sabe el propio Jitsi. Los `title` lo dicen en vez de dejar que el médico lo suponga.
import { minutesSince, tiempoTranscurrido } from '../lib/utils'

// "hace 0 min" es justo el caso que más importa —el paciente acaba de entrar y el médico está
// mirando— y es el que peor se lee. Por debajo del minuto se dice en palabras.
function desdeQue(valor: string): string {
  return minutesSince(valor) < 1 ? 'ahora mismo' : `hace ${tiempoTranscurrido(valor)}`
}

export default function EstadoPacienteBadge({
  enteredCallAt,
  inRoom
}: {
  enteredCallAt?: string | null
  inRoom: boolean
}) {
  if (enteredCallAt) {
    return (
      <span
        className="badge badge-green"
        title={
          'El paciente pulsó para entrar a la videollamada. La plataforma no puede confirmar ' +
          'si sigue dentro de la sala.'
        }
      >
        🎥 Entró a la videollamada · {desdeQue(enteredCallAt)}
      </span>
    )
  }
  if (inRoom) {
    return (
      <span
        className="badge badge-blue"
        title={
          'Tiene abierta la página de Médicos por Venezuela. Todavía no ha pulsado para entrar ' +
          'a la videollamada.'
        }
      >
        ● En la página de espera
      </span>
    )
  }
  return (
    <span
      className="badge"
      style={{ background: '#e2e8f0', color: '#64748b' }}
      title="No tiene la página abierta y no ha entrado a la videollamada."
    >
      ○ Sin conexión
    </span>
  )
}
