// Estado de la sala de espera del paciente, según `lib/waitingRoom.ts`. Lo pintan `/sala-espera` y
// `/mi-caso`: una sola copia del texto, para que la próxima corrección se aplique en las dos.
//
// ESTA PANTALLA NO DA ACCESO A LA VIDEOCONSULTA, y es la regla que la define. Hubo aquí un botón
// "Entrar a la videoconsulta" que aparecía con `phase === 'ready'`, es decir, en cuanto un médico
// TOMABA el caso. Pero tomar un caso no es estar en la sala: el médico puede tomarlo para leerlo y
// responder por escrito, y el paciente entraba a una videollamada vacía a esperar a alguien que no
// iba a venir. La primera versión de esta sala arregló el mismo bug un paso antes (el botón se veía
// desde el registro); esto lo arregla del todo.
//
// El acceso vive donde sí refleja una llamada real: el aviso de sistema del hilo (R16), que crea
// `POST /consultations/{id}/video-call` cuando el médico INICIA la videoconsulta —desde el botón de
// cámara del chat o al tomar el caso desde la cola del panel—. `HiloMensajes` lo pinta con su botón
// de entrada. Aquí solo se informa del estado del caso.
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { WaitingRoomError, WaitingRoomState } from '../lib/waitingRoom'

function fmtCita(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' })
}

export default function SalaEsperaEnVivo({
  state,
  error,
  ocultarAgendada = false
}: {
  state: WaitingRoomState | null
  error: WaitingRoomError
  // En `/mi-caso` la tarjeta ya pinta la cita agendada (fecha + "Agregar a calendario"), así que
  // la nota de la fase `scheduled` sobra. El stream sigue vivo: al iniciar el médico la cita, la
  // fase pasa a `ready` y el aviso de que el caso está en marcha aparece sin recargar.
  ocultarAgendada?: boolean
}) {
  let fase = state?.phase ?? 'cargando'
  let content: ReactNode

  if (error === 'unauthorized') {
    fase = 'error'
    content = (
      <div className="notice notice-warning" role="status">
        El enlace de tu sala de espera caducó. <Link href="/login">Inicia sesión</Link> y entra a{' '}
        <strong>Mi caso</strong> para ver el estado de tu solicitud.
      </div>
    )
  } else if (error === 'gone') {
    fase = 'error'
    content = (
      <div className="notice notice-warning" role="status">
        No encontramos tu solicitud. Si crees que es un error, entra a <strong>Mi caso</strong> o
        vuelve a solicitar la consulta.
      </div>
    )
  } else if (!state) {
    content = (
      <p className="hint" role="status">
        Consultando el estado de tu caso…
      </p>
    )
  } else if (state.phase === 'ready') {
    // Lo que se dice aquí es solo lo que es verdad: el caso está tomado y el chat está abierto.
    // Ni una palabra sobre que el médico esté esperando en la sala, porque puede no estarlo.
    content = (
      <div className="notice notice-success" role="status">
        ✅ <strong>{state.doctor_name || 'Tu médico'} tomó tu caso</strong>. Puedes escribirle por
        el chat de aquí abajo; cuando inicie la videoconsulta te avisaremos en este mismo hilo.
      </div>
    )
  } else if (state.phase === 'scheduled') {
    if (ocultarAgendada) return null
    content = (
      <div className="notice notice-info" role="status">
        Tienes una cita agendada
        {state.scheduled_at ? (
          <>
            {' '}
            para el <strong>{fmtCita(state.scheduled_at)}</strong>
          </>
        ) : null}
        . Te enviaremos un recordatorio por correo.
      </div>
    )
  } else if (state.phase === 'finished') {
    content = (
      <div className="notice" role="status">
        Tu consulta ya terminó. Si necesitas atención de nuevo, solicita una nueva consulta desde{' '}
        <Link href="/mi-caso">Mi caso</Link>.
      </div>
    )
  } else {
    content = (
      <>
        <p className="sala-estado" role="status">
          <span className="sala-pulso" aria-hidden="true" />
          <span>
            Estás en la sala de espera
            {state.specialty ? (
              <>
                {' '}
                de <strong>{state.specialty}</strong>
              </>
            ) : null}
          </span>
        </p>
        {state.derived_from_specialty && (
          <div className="notice notice-info">
            Un médico derivó tu caso de <strong>{state.derived_from_specialty}</strong> a{' '}
            <strong>{state.specialty}</strong>. Conservas tu lugar en la fila: no hace falta que
            vuelvas a registrarte.
          </div>
        )}
        <div className="notice notice-warning">
          <strong>Tenemos una alta demanda de pacientes.</strong> Todavía ningún médico ha tomado tu
          caso; lo hará en cuanto se libere uno de tu especialidad. La espera puede tardar.
        </div>
        <div className="notice notice-info">
          📧 <strong>Atento a tu correo.</strong> Cuando un médico tome tu caso te enviaremos un
          correo con el enlace para entrar a la videoconsulta. Revisa también la carpeta de spam.
        </div>
        <p className="hint">
          Si dejas esta página abierta, el estado de tu caso se actualiza aquí solo, sin recargar:
          verás en cuanto un médico lo tome.
        </p>
      </>
    )
  }

  return (
    <div className="sala-en-vivo" data-fase={fase}>
      {content}
      <style jsx>{`
        .sala-en-vivo {
          display: grid;
          gap: 10px;
        }
        .sala-en-vivo :global(.notice),
        .sala-en-vivo :global(.hint) {
          margin: 0;
        }
        .sala-estado {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 17px;
        }
        .sala-pulso {
          width: 12px;
          height: 12px;
          flex: none;
          border-radius: 50%;
          background: var(--brand, #0066fe);
          animation: sala-pulso 1.8s ease-out infinite;
        }
        @keyframes sala-pulso {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 102, 254, 0.5);
          }
          70% {
            box-shadow: 0 0 0 12px rgba(0, 102, 254, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 102, 254, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sala-pulso {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
