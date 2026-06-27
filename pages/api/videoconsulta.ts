import type { NextApiRequest, NextApiResponse } from 'next'
import twilio from 'twilio'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { newRoomUrl } from '../../lib/jitsi'

// Patient self-service: create/return a Jitsi room for a consultation and send the link
// to the patient via Twilio (WhatsApp, with SMS fallback). Runs server-side so the Twilio
// Auth Token and Supabase service-role key never reach the browser.
// NOTE: anonymous patients can create consultations, so this endpoint is abusable. Idempotency
// (one room per consultation) limits damage; add per-IP rate limiting before heavy promotion.

function toE164(raw: string): string {
  const digits = (raw || '').replace(/[^\d]/g, '')
  return `+${digits}`
}

const MESSAGE = (url: string) =>
  `Hola, somos el equipo de asistencia médica de Médicos por Venezuela. Haz clic en el siguiente enlace para conectarte con un médico voluntario: ${url}`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const consultationId = (req.body?.consultationId || '').toString()
  if (!consultationId) return res.status(400).json({ error: 'consultationId requerido' })

  // Fetch the consultation + patient phone with the service-role client.
  const { data: consultation, error } = await supabaseAdmin
    .from('consultations')
    .select('id, code, status, video_room_url, patients(phone_whatsapp)')
    .eq('id', consultationId)
    .single()

  if (error || !consultation) return res.status(404).json({ error: 'Consulta no encontrada' })

  // Idempotent: if a room already exists, return it without sending again.
  if (consultation.video_room_url) {
    return res.status(200).json({ url: consultation.video_room_url, code: consultation.code })
  }
  // Only create a room for cases still waiting.
  if (consultation.status !== 'waiting') {
    return res.status(409).json({ error: 'La consulta no está en espera.' })
  }

  const url = newRoomUrl()

  const { error: updateError } = await supabaseAdmin
    .from('consultations')
    .update({ video_room_url: url })
    .eq('id', consultationId)
  if (updateError) return res.status(500).json({ error: 'No se pudo guardar la sala.' })

  // Send the link via Twilio. Never fail the request if sending fails — the on-screen
  // link still works, which is the resilience the spec asks for.
  const patient = Array.isArray(consultation.patients) ? consultation.patients[0] : consultation.patients
  const phone = patient?.phone_whatsapp ? toE164(patient.phone_whatsapp) : ''
  let delivery: 'whatsapp' | 'sms' | 'none' = 'none'

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const waFrom = process.env.TWILIO_WHATSAPP_NUMBER // e.g. 'whatsapp:+14155238886'
  const smsFrom = process.env.TWILIO_SMS_NUMBER     // e.g. '+14155238886'

  if (sid && token && phone) {
    const client = twilio(sid, token)
    const body = MESSAGE(url)
    try {
      if (waFrom) {
        await client.messages.create({ from: waFrom, to: `whatsapp:${phone}`, body })
        delivery = 'whatsapp'
      } else {
        throw new Error('No WhatsApp sender configured')
      }
    } catch (waErr) {
      console.error('WhatsApp send failed, trying SMS:', waErr)
      try {
        if (smsFrom) {
          await client.messages.create({ from: smsFrom, to: phone, body })
          delivery = 'sms'
        }
      } catch (smsErr) {
        console.error('SMS send failed:', smsErr)
      }
    }
  }

  return res.status(200).json({ url, code: consultation.code, delivery })
}
