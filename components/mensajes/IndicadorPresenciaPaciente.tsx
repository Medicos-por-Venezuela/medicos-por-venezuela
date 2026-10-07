import React from 'react'
import { tiempoTranscurrido } from '../../lib/utils'

interface IndicadorPresenciaPacienteProps {
  online?: boolean
  lastSeenAt?: string | null
  showText?: boolean
  className?: string
}

/**
 * Indicador visual de presencia del paciente.
 * REGLA DE ORO DE ASIMETRÍA: Solo se renderiza en interfaces de uso médico.
 * NUNCA debe montarse en las pantallas vistas por pacientes.
 */
export default function IndicadorPresenciaPaciente({
  online,
  lastSeenAt,
  showText = true,
  className = ''
}: IndicadorPresenciaPacienteProps) {
  const isOnline = Boolean(online)

  let label = 'Aún no ha entrado'
  if (isOnline) {
    label = 'En línea'
  } else if (lastSeenAt) {
    label = `Desconectado · hace ${tiempoTranscurrido(lastSeenAt)}`
  }

  // Verde de marca = estado de éxito ("En línea"); gris de marca para el resto. Los dos cumplen
  // AA sobre los fondos del hilo y del buzón (5,9:1 y 4,5:1 sobre `--bg`).
  const dotColor = isOnline ? 'var(--green)' : 'var(--muted)'

  return (
    <div
      className={`indicador-presencia-paciente ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 500,
        color: isOnline ? 'var(--green)' : 'var(--muted)'
      }}
      title={`Paciente: ${label}`}
      data-testid="indicador-presencia-paciente"
      data-online={isOnline ? 'true' : 'false'}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          flex: '0 0 auto',
          backgroundColor: dotColor,
          display: 'inline-block',
          boxShadow: isOnline ? '0 0 0 2px var(--green-light)' : 'none'
        }}
        aria-hidden="true"
      />
      {showText && <span>{label}</span>}
    </div>
  )
}
