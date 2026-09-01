// Modal para pedir una interconsulta ASÍNCRONA sobre un paciente de consultorio.
//
// Dos modos: por ESPECIALIDAD (el principal — se difunde a todos los médicos de esa
// especialidad) o a un MÉDICO concreto (secundario). Ver .knowledge/interconsultas.md.
import { useEffect, useState } from 'react'
import { fetchDoctorPool, fetchSpecialties, type DoctorPoolItem } from '../lib/doctors'
import { useEscapeToClose } from '../lib/hooks'
import type { SpecialtyResponse } from '../lib/doctors'
import { createInterconsultationRequest, type RequestMode } from '../lib/interconsultationRequests'
import type { DoctorPatient } from '../lib/doctorPatients'

interface Props {
  paciente: DoctorPatient
  token: string
  onClose: () => void
  onCreated: (mensaje: string) => void
}

export default function SolicitarInterconsulta({ paciente, token, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<RequestMode>('specialty')
  const [especialidades, setEspecialidades] = useState<SpecialtyResponse[]>([])
  const [specialtyId, setSpecialtyId] = useState('')
  const [medicos, setMedicos] = useState<DoctorPoolItem[]>([])
  const [targetDoctorId, setTargetDoctorId] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEscapeToClose(true, onClose)

  useEffect(() => {
    // `true` = solo las que se pueden pedir en una interconsulta. El filtro lo aplica el
    // backend desde el catálogo, así que Medicina general no llega hasta acá.
    fetchSpecialties(true)
      .then(setEspecialidades)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se cargaron las especialidades.'))
  }, [])

  // El listado de médicos solo hace falta en el modo secundario, y depende de la especialidad
  // elegida: sin ese filtro serían cientos de nombres sin orden.
  //
  // El efecto NO limpia el estado de forma síncrona (dispararía renders en cascada): la lista
  // vacía se DERIVA abajo. El flag `cancelado` descarta una respuesta que llegue tarde después de
  // cambiar de especialidad, que si no pisaría a la nueva.
  useEffect(() => {
    if (mode !== 'doctor' || !specialtyId) return
    let cancelado = false
    fetchDoctorPool({ specialty_id: specialtyId, limit: 100 }, token)
      .then((page) => {
        if (!cancelado) setMedicos(page.items)
      })
      .catch((e) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se cargó el listado de médicos.')
        }
      })
    return () => {
      cancelado = true
    }
  }, [mode, specialtyId, token])

  // Derivada, no estado: en modo especialidad o sin especialidad elegida no hay médicos que ofrecer.
  const medicosVisibles = mode === 'doctor' && specialtyId ? medicos : []

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const creada = await createInterconsultationRequest(
        {
          patient_id: paciente.id,
          mode,
          // En modo 'doctor' la especialidad la deriva el backend de la ficha del elegido:
          // mandar las dos cosas es 422.
          specialty_id: mode === 'specialty' ? specialtyId : null,
          target_doctor_id: mode === 'doctor' ? targetDoctorId : null,
          chief_complaint: chiefComplaint.trim(),
          clinical_notes: clinicalNotes.trim() || null
        },
        token
      )
      const contacto = creada.target_doctor?.whatsapp_number
      onCreated(
        mode === 'doctor'
          ? `Solicitud enviada a ${creada.target_doctor?.full_name || 'el especialista'}.` +
              (contacto ? ` Su WhatsApp: ${contacto}` : '')
          : `Se notificó a ${creada.notified_count} ${
              creada.notified_count === 1 ? 'especialista' : 'especialistas'
            } de ${creada.specialty_name}.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la solicitud.')
    } finally {
      setEnviando(false)
    }
  }

  const listo =
    chiefComplaint.trim().length >= 10 &&
    (mode === 'specialty' ? Boolean(specialtyId) : Boolean(targetDoctorId))

  return (
    // Mismo patrón inline que DoctorPoolModal (no hay clases .modal en styles/).
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitar-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2 id="solicitar-title" style={{ marginTop: 0 }}>
          Pedir interconsulta
        </h2>
        <p style={{ color: '#64748b', marginTop: -8 }}>
          Caso de <strong>{paciente.full_name}</strong>
          {paciente.age_range ? ` · ${paciente.age_range} años` : ''}
        </p>

        {error && (
          <div className="notice notice-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={enviar}>
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>¿A quién?</legend>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="mode"
                value="specialty"
                checked={mode === 'specialty'}
                onChange={() => setMode('specialty')}
                style={{ width: 'auto' }}
              />
              <span>
                <strong>A toda una especialidad</strong> — le llega a todos y responde el primero
                disponible.
              </span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <input
                type="radio"
                name="mode"
                value="doctor"
                checked={mode === 'doctor'}
                onChange={() => setMode('doctor')}
                style={{ width: 'auto' }}
              />
              <span>A un médico en particular</span>
            </label>
          </fieldset>

          <label className="label" htmlFor="specialty">
            Especialidad *
          </label>
          <select
            id="specialty"
            required
            value={specialtyId}
            onChange={(e) => {
              setSpecialtyId(e.target.value)
              setTargetDoctorId('')
            }}
          >
            <option value="">Elige una especialidad</option>
            {especialidades.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {mode === 'doctor' && (
            <>
              <label className="label" htmlFor="doctor">
                Médico *
              </label>
              {/* Un desplegable deshabilitado con un texto gris dentro no explica nada: parece
                  roto. Mientras falte la especialidad se dice qué hacer, con el mismo aviso que
                  usa el resto del sitio; el desplegable solo aparece cuando ya sirve. */}
              {!specialtyId ? (
                <div className="notice notice-info" id="doctor" role="status">
                  Elige primero una <strong>especialidad</strong> para ver sus médicos.
                </div>
              ) : medicosVisibles.length === 0 ? (
                <div className="notice notice-warning" role="status">
                  No hay médicos registrados en esa especialidad. Puedes pedirla{' '}
                  <strong>a toda la especialidad</strong> y quedará esperando, o elegir otra.
                </div>
              ) : (
                <select
                  id="doctor"
                  required
                  value={targetDoctorId}
                  onChange={(e) => setTargetDoctorId(e.target.value)}
                >
                  <option value="">Elige un médico</option>
                  {medicosVisibles
                    .filter((m) => m.user_id)
                    .map((m) => (
                      <option key={m.id} value={m.user_id as string}>
                        {m.full_name}
                      </option>
                    ))}
                </select>
              )}
            </>
          )}

          <label className="label" htmlFor="chief_complaint">
            Motivo de la consulta *
          </label>
          <textarea
            id="chief_complaint"
            required
            rows={3}
            minLength={10}
            maxLength={2000}
            placeholder="Describe el caso: síntomas, tiempo de evolución, hallazgos."
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />

          <label className="label" htmlFor="clinical_notes">
            Notas y estudios (opcional)
          </label>
          <textarea
            id="clinical_notes"
            rows={3}
            maxLength={5000}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
          />

          <p style={{ color: '#64748b', fontSize: 13 }}>
            El especialista verá el motivo, las notas y la edad. <strong>Nunca</strong> el nombre,
            la cédula ni el contacto de tu paciente.
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={enviando || !listo}>
              {enviando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
            <button className="btn btn-muted" type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
