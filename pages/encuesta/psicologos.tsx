// /encuesta/psicologos — encuesta de marketing para los psicólogos de la red. Se llega desde un
// correo masivo con el correo del destinatario en el enlace (`?email=`). El formulario es común a
// las tres encuestas: ver components/marketing/EncuestaForm.tsx.
import Seo from '../../components/Seo'
import EncuestaForm from '../../components/marketing/EncuestaForm'
import { SURVEYS } from '../../components/marketing/encuestas'

export default function EncuestaPsicologos() {
  return (
    <>
      <Seo
        titulo="Cómo quieres participar · Médicos por Venezuela"
        descripcion="Encuesta para los psicólogos de Médicos por Venezuela: cuéntanos cómo quieres participar y con cuánto tiempo puedes comprometerte con la plataforma."
        ruta="/encuesta/psicologos"
        noindex
      />
      <EncuestaForm survey={SURVEYS.psicologos} />
    </>
  )
}
