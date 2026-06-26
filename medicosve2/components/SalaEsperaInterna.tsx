import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function SalaEsperaInterna() {
  const router = useRouter()
  const nombre = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('nombre') : ''
  const [posicion, setPosicion] = useState<number | null>(null)
  const [medicos, setMedicos] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const { count: cola } = await supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('status', 'waiting')
    const { count: docs } = await supabase.from('doctors').select('*', { count: 'exact', head: true }).eq('status', 'active')
    setPosicion(cola ?? 0)
    setMedicos(docs ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('espera').on('postgres_changes', { event: '*', schema: 'public', table: 'consultations' }, fetchData).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const tiempo = posicion ? Math.max(posicion * 8, 5) : 0

  return (
    <main style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ background: '#0f6e56', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Sala de espera</div>
            <div style={{ fontSize: '13px', opacity: 0.8 }}>{nombre || 'Paciente'}</div>
          </div>
          <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}>● En línea</span>
        </div>

        <div style={{ margin: '1.5rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>Tu posición en la cola</p>
          <div style={{ fontSize: '64px', fontWeight: 800, color: '#0f6e56', lineHeight: 1 }}>{loading ? '...' : `${posicion}°`}</div>
          <p style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>Tiempo estimado: ~{tiempo} minutos</p>
        </div>

        <div style={{ margin: '0 1.5rem 1.25rem', background: '#e1f5ee', border: '1px solid #5dcaa5', borderRadius: '12px', padding: '1rem 1.25rem', fontSize: '13px', color: '#085041', lineHeight: 1.6 }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>¿Cómo funciona?</strong>
          Cuando sea tu turno, el médico te enviará un enlace directo a tu WhatsApp para la videollamada. No necesitas hacer nada más.
        </div>

        <div style={{ margin: '0 1.5rem 1.25rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>Estado del servicio</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#555' }}>
            <span>Médicos disponibles</span>
            <span style={{ fontWeight: 600, color: medicos > 0 ? '#0f6e56' : '#dc2626' }}>{medicos > 0 ? `${medicos} activos` : 'Ninguno'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', color: '#555' }}>
            <span>Pacientes en cola</span>
            <span style={{ fontWeight: 600 }}>{posicion ?? '—'}</span>
          </div>
        </div>

        <div style={{ margin: '0 1.5rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#92400e', textAlign: 'center', lineHeight: 1.5 }}>
          Si tienes una <strong>emergencia que pone en riesgo tu vida</strong>, llama al 911 o acude al centro de salud más cercano.
        </div>
      </div>
    </main>
  )
}
