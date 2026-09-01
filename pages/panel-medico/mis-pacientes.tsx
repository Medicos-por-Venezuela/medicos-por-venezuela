// Pacientes de CONSULTORIO del médico: los que registra él mismo para pedir una interconsulta.
// No entran a la cola pública ni tienen cuenta. Ver .knowledge/interconsultas.md del backend.
//
// La página es la LISTA. El alta vive en un modal (`RegistrarPacienteModal`) porque embebida
// ocupaba toda la primera pantalla y empujaba a los pacientes debajo del pliegue — se entra aquí
// a ver los pacientes, no a dar de alta uno, que es lo ocasional.
import Seo from '../../components/Seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import RegistrarPacienteModal from '../../components/RegistrarPacienteModal'
import SolicitarInterconsulta from '../../components/SolicitarInterconsulta'
import {
  archiveDoctorPatient,
  fetchMyDoctorPatients,
  type DoctorPatient
} from '../../lib/doctorPatients'

export default function MisPacientes() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [pacientes, setPacientes] = useState<DoctorPatient[]>([])
  // Un estado de error por fuente: el fallo de la lista se recupera recargando y el de archivar
  // reintentando esa acción. El del formulario vive dentro del modal, junto al formulario.
  const [errorCarga, setErrorCarga] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [aviso, setAviso] = useState('')
  // Modales abiertos (null / false = cerrado).
  const [registrando, setRegistrando] = useState(false)
  const [pidiendoPara, setPidiendoPara] = useState<DoctorPatient | null>(null)
  const [porArchivar, setPorArchivar] = useState<DoctorPatient | null>(null)
  const [archivando, setArchivando] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    setToken(session.access_token)
    try {
      setPacientes(await fetchMyDoctorPatients(session.access_token))
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar tus pacientes.')
    } finally {
      setLoading(false)
    }
  }

  async function archivar() {
    if (!porArchivar) return
    setErrorAccion('')
    setArchivando(true)
    try {
      await archiveDoctorPatient(porArchivar.id, token)
      setPacientes((prev) => prev.filter((p) => p.id !== porArchivar.id))
      setPorArchivar(null)
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo archivar el paciente.')
      setPorArchivar(null)
    } finally {
      setArchivando(false)
    }
  }

  return (
    <>
      <Seo
        titulo="Mis pacientes — Médicos por Venezuela"
        descripcion="Registra a tus pacientes de consultorio para pedir una interconsulta."
        ruta="/panel-medico/mis-pacientes"
        noindex
      />
      <main className="page">
        <div className="container">
          <button className="link-button" onClick={() => router.push('/panel-medico')}>
            ← Volver al panel médico
          </button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <h1 style={{ marginBottom: 0 }}>Mis pacientes de consultorio</h1>
            <button className="btn btn-primary" onClick={() => setRegistrando(true)}>
              + Registrar paciente
            </button>
          </div>
          <p style={{ color: '#64748b' }}>
            Los pacientes que atiendes por fuera de la plataforma, para pedir una segunda opinión
            sobre su caso. No entran a la cola pública ni reciben notificaciones.
          </p>

          {aviso && (
            <div className="notice notice-info" style={{ marginBottom: 16 }}>
              {aviso}
            </div>
          )}
          {errorAccion && (
            <div className="notice notice-error" style={{ marginBottom: 16 }}>
              {errorAccion}
            </div>
          )}

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Tus pacientes ({pacientes.length})</h2>
            {errorCarga && <div className="notice notice-error">{errorCarga}</div>}
            {loading ? (
              <p style={{ color: '#64748b' }}>Cargando...</p>
            ) : pacientes.length === 0 ? (
              <p style={{ color: '#64748b' }}>
                Todavía no registraste ningún paciente de consultorio.{' '}
                <button className="link-button" onClick={() => setRegistrando(true)}>
                  Registra el primero
                </button>
                .
              </p>
            ) : (
              <div className="grid">
                {pacientes.map((p) => (
                  <div key={p.id} className="card-flat">
                    <strong>{p.full_name}</strong>
                    <p style={{ color: '#64748b', margin: '4px 0' }}>
                      {p.age_range ? `${p.age_range} años` : 'Edad sin especificar'}
                      {p.allergies ? ` · Alergias: ${p.allergies}` : ''}
                    </p>
                    {p.description && <p style={{ margin: '4px 0' }}>{p.description}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" onClick={() => setPidiendoPara(p)}>
                        Pedir interconsulta
                      </button>
                      <button className="btn btn-muted" onClick={() => setPorArchivar(p)}>
                        Archivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {registrando && (
        <RegistrarPacienteModal
          token={token}
          onClose={() => setRegistrando(false)}
          onCreated={(creado) => {
            // Functional update: entre el await del modal y este setState pudo cambiar la lista.
            setPacientes((prev) => [creado, ...prev])
            setRegistrando(false)
            setAviso(`${creado.full_name} quedó registrado. Ya puedes pedir una interconsulta.`)
          }}
        />
      )}

      {pidiendoPara && (
        <SolicitarInterconsulta
          paciente={pidiendoPara}
          token={token}
          onClose={() => setPidiendoPara(null)}
          onCreated={(mensaje) => {
            setPidiendoPara(null)
            setAviso(mensaje)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(porArchivar)}
        title="Archivar paciente"
        message={
          <p>
            <strong>{porArchivar?.full_name}</strong> dejará de aparecer en tu lista. Sus
            interconsultas previas se conservan.
          </p>
        }
        confirmLabel="Archivar"
        onConfirm={archivar}
        onCancel={() => setPorArchivar(null)}
        busy={archivando}
        danger
      />
    </>
  )
}
