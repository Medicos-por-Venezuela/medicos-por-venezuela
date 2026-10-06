import React from 'react'

interface EstadoEntregaProps {
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed' | string
  channel?: 'web' | 'whatsapp' | 'system'
  deliveredAt?: string | null
  readAt?: string | null
}

export default function EstadoEntrega({
  deliveryStatus = 'sent',
  channel = 'web',
  readAt
}: EstadoEntregaProps) {
  if (channel === 'system') return null

  const isRead = Boolean(readAt) || deliveryStatus === 'read'
  const isFailed = deliveryStatus === 'failed'
  const isDelivered = deliveryStatus === 'delivered'

  if (isFailed) {
    return (
      <span
        style={{
          color: 'var(--red)',
          fontSize: '11px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px'
        }}
        title="Error de entrega"
        data-testid="status-failed"
      >
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>No entregado</span>
      </span>
    )
  }

  // Ticks para web y whatsapp
  return (
    <span
      style={{
        color: isRead ? 'var(--brand)' : 'var(--muted)',
        fontSize: '11px',
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '4px'
      }}
      role="img"
      aria-label={isRead ? 'Leído' : isDelivered ? 'Entregado' : 'Enviado'}
      title={isRead ? 'Leído' : isDelivered ? 'Entregado' : 'Enviado'}
      data-testid={isRead ? 'status-read' : 'status-sent'}
    >
      {isRead || isDelivered ? (
        // Doble check
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6L7 17l-5-5" />
          <path d="M22 10l-7.5 7.5-2-2" />
        </svg>
      ) : (
        // Check simple
        <svg
          aria-hidden="true"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  )
}
