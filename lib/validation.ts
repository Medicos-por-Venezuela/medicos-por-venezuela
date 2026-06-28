import { z } from 'zod'

export const email = z.string().trim().toLowerCase().email('Email inválido')
export const password = z.string().min(6, 'Mínimo 6 caracteres')
export const fullName = z.string().trim().min(1, 'Ingresa tu nombre completo')
export const whatsapp = z
  .string()
  .trim()
  .regex(/^\+?\d{7,15}$/, 'Teléfono inválido (7 a 15 dígitos, opcional +)')

export const registroMedicoSchema = z.object({ fullName, email, password })

export const elegirRolDoctorSchema = z
  .object({
    specialty: z.string().min(1, 'Elige una especialidad'),
    country: z.string().min(1, 'Elige un país'),
    whatsapp,
    medicalLicense: z
      .string()
      .regex(/^MPPS-\d{4,10}$/, 'Ingresa tu matrícula MPPS (ej: MPPS-123456).'),
    didArt8: z.boolean()
  })
  .superRefine((val, ctx) => {
    if (!val.didArt8) {
      ctx.addIssue({
        code: 'custom',
        path: ['didArt8'],
        message: 'Debes declarar que realizaste el Artículo 8 para ejercer.'
      })
    }
  })

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Revisa los datos del formulario.'
}
