// Alta de un paciente de CONSULTORIO, en modal.
//
// Vivía embebido en /panel-medico/mis-pacientes, encima de la lista: el formulario ocupaba toda
// la primera pantalla y los pacientes —que es a lo que se entra— quedaban debajo del pliegue.
// Ahora la página muestra la lista y el alta se pide con un botón.
//
// Replica /registro-paciente en campos, orden y comportamiento: mismo `CedulaField`, edad como
// NÚMERO (que es lo que guarda `age_range` allí, no un rango), alergia como interruptor con
// detalle, y el consentimiento como aviso destacado. Un médico que ya usó el registro público no
// debería tener que aprender otro formulario.
//
// Lo que NO se replica, a propósito: WhatsApp, zona y especialidad. Este paciente no entra a la
// cola y nadie de la plataforma lo contacta; la especialidad se elige después, al pedir la
// interconsulta.
import { useState } from 'react'
import CedulaField from './CedulaField'
import { useEscapeToClose } from '../lib/hooks'
import { createDoctorPatient, type DoctorPatient } from '../lib/doctorPatients'

const VACIO = { full_name: '', edad: '', cedula: '', allergies: '', description: '' }

interface Props {
  token: string
  onClose: () => void
  onCreated: (paciente: DoctorPatient) => void
}

export default function RegistrarPacienteModal({ token, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ ...VACIO })
  // El consentimiento es una atestación del médico: arranca apagado a propósito.
  const [consent, setConsent] = useState(false)
  // Interruptor de alergia, igual que /registro-paciente: evita el 'ninguna'/'no' escrito a mano.
  const [hasAllergy, setHasAllergy] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // No se cierra con Escape mientras guarda: perder lo escrito a mitad del envío sería peor que
  // esperar el segundo que tarda.
  useEscapeToClose(!guardando, onClose)

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const creado = await createDoctorPatient(
        {
          full_name: form.full_name.trim(),
          // `age_range` guarda la edad tal cual, igual que /registro-paciente (`age_range: edad`).
          age_range: form.edad.trim() || null,
          cedula: form.cedula.trim() || null,
          // Sin el interruptor activo no se manda nada, aunque haya quedado texto escrito.
          allergies: (hasAllergy && form.allergies.trim()) || null,
          description: form.description.trim() || null,
          consent
        },
        token
      )
      onCreated(creado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el paciente.')
      setGuardando(false) // se queda abierto con lo escrito para poder corregir y reenviar
    }
  }

  const listo =
    form.full_name.trim().length >= 2 &&
    form.edad.trim() !== '' &&
    form.description.trim() !== '' &&
    consent &&
    (!hasAllergy || form.allergies.trim() !== '')

  return (
    // Mismo patrón inline que DoctorPoolModal y SolicitarInterconsulta (no hay clases .modal).
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="registrar-title"
      onClick={() => !guardando && onClose()}
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
        <h2 id="registrar-title" style={{ marginTop: 0 }}>
          Registrar un paciente
        </h2>
        <p style={{ color: '#64748b', marginTop: -8 }}>
          Un paciente que atiendes por fuera de la plataforma. No entra a la cola pública ni recibe
          notificaciones.
        </p>

        {error && (
          <div className="notice notice-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={registrar}>
          <CedulaField
            label="Cédula / DNI"
            value={form.cedula}
            onChange={(v) => setForm((f) => ({ ...f, cedula: v }))}
          />

          <div>
            <label className="label" htmlFor="full_name">
              Nombre completo *
            </label>
            <input
              id="full_name"
              required
              minLength={2}
              autoFocus
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Ej. María González"
            />
          </div>

          <div>
            <label className="label" htmlFor="edad">
              Edad *
            </label>
            <input
              id="edad"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              required
              value={form.edad}
              onChange={(e) => setForm({ ...form, edad: e.target.value })}
              placeholder="Ej. 34"
            />
          </div>

          <div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasAllergy}
                onChange={(e) => setHasAllergy(e.target.checked)}
                style={{ width: 'auto' }}
              />
              ¿Tiene alguna alergia?
            </label>
            {hasAllergy && (
              <div style={{ marginTop: 10 }}>
                <label className="label" htmlFor="allergies">
                  ¿A qué es alérgico? *
                </label>
                <input
                  id="allergies"
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  placeholder="Ej. Penicilina"
                />
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="description">
              Descripción breve *
            </label>
            <textarea
              id="description"
              rows={4}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe en pocas palabras qué le ocurre y si ya está tomando algún medicamento."
            />
          </div>

          <label
            className="notice notice-warning"
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ width: 'auto', marginTop: 5 }}
            />
            <span>
              Declaro que mi paciente autorizó compartir esta información con un especialista de
              Médicos por Venezuela para obtener una segunda opinión. Entiendo que el especialista
              no verá su identidad ni sus datos de contacto.
            </span>
          </label>

          <p style={{ color: '#64748b', fontSize: 13 }}>
            No pedimos teléfono ni ubicación: el especialista nunca contacta a tu paciente, se
            comunica contigo.
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={guardando || !listo}>
              {guardando ? 'Registrando...' : 'Registrar paciente'}
            </button>
            <button className="btn btn-muted" type="button" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
