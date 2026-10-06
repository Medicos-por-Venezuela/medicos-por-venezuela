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

  const dotColor = isOnline ? '#10b981' : '#94a3b8'

  return (
    <div
      className={`indicador-presencia-paciente ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 500,
        color: isOnline ? '#065f46' : '#64748b'
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
          backgroundColor: dotColor,
          display: 'inline-block',
          boxShadow: isOnline ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none'
        }}
        aria-hidden="true"
      />
      {showText && <span>{label}</span>}
    </div>
  )
}
