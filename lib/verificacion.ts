const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type VerificacionResponse = {
  encontrado: boolean
  nombre?: string | null
  apellido?: string | null
  licencia?: string | null
}

async function verificar(path: string): Promise<VerificacionResponse> {
  const res = await fetch(`${API_URL}/api/v1/${path}`)
  if (!res.ok) throw new Error(`Verificación falló (${res.status})`)
  return res.json()
}

// GET /api/v1/verificacion-sacs/{cedula} — registro nacional de salud (sacs.gob.ve)
export function verificarSacs(cedula: string): Promise<VerificacionResponse> {
  return verificar(`verificacion-sacs/${cedula}`)
}

// GET /api/v1/verificacion-psicologo/{cedula} — Federación de Psicólogos de Venezuela
export function verificarPsicologo(cedula: string): Promise<VerificacionResponse> {
  return verificar(`verificacion-psicologo/${cedula}`)
}
