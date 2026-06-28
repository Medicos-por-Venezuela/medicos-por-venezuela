import Link from 'next/link'
import type { ReactNode } from 'react'

type AuthPanelProps = {
  title: string
  description: string
  backHref?: string
  backLabel?: string
  children: ReactNode
}

export default function AuthPanel({ title, description, backHref, backLabel = 'Volver', children }: AuthPanelProps) {
  return (
    <div className="narrow">
      {backHref && <Link href={backHref} className="link-button">← {backLabel}</Link>}
      <section className="card" style={{ marginTop: 14 }}>
        <h1 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h1>
        <p style={{ color: '#64748b', marginTop: 0 }}>{description}</p>
        {children}
      </section>
    </div>
  )
}
