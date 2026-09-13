// /encuesta/medicos-generales — encuesta de marketing para los médicos generales de la red. Se llega
// desde un correo masivo con el correo del destinatario en el enlace (`?email=`). El formulario es
// común a las tres encuestas: ver components/marketing/EncuestaForm.tsx.
import Seo from '../../components/Seo'
import EncuestaForm from '../../components/marketing/EncuestaForm'
import { SURVEYS } from '../../components/marketing/encuestas'

export default function EncuestaMedicosGenerales() {
  return (
    <>
      <Seo
        titulo="Cómo quieres participar · Médicos por Venezuela"
        descripcion="Encuesta para los médicos generales de Médicos por Venezuela: cuéntanos cómo quieres participar ahora que puedes pedir interconsultas y con cuánto tiempo cuentas."
        ruta="/encuesta/medicos-generales"
        noindex
      />
      <EncuestaForm survey={SURVEYS['medicos-generales']} />
    </>
  )
}
