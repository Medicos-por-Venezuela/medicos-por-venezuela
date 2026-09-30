import { postJson, ApiError } from './apiClient'

export type VerificationPurpose = 'patient' | 'doctor'

export interface SendVerificationResponse {
  sent: boolean
  expires_minutes: number
  resend_seconds: number
  debug_code?: string
}

export interface VerifyCodeResponse {
  verification_token: string
  expires_minutes: number
}

export async function sendEmailVerification(
  email: string,
  purpose: VerificationPurpose
): Promise<SendVerificationResponse> {
  return postJson<SendVerificationResponse>(
    '/api/v1/email-verification/send',
    { email, purpose },
    'No se pudo enviar el código de verificación'
  )
}

export async function verifyEmailCode(
  email: string,
  purpose: VerificationPurpose,
  code: string
): Promise<VerifyCodeResponse> {
  return postJson<VerifyCodeResponse>(
    '/api/v1/email-verification/verify',
    { email, purpose, code },
    'Código de verificación incorrecto o expirado'
  )
}
