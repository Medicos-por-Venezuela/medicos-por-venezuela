import Seo from '../../components/Seo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AuthField from '../../components/auth/AuthField'
import AuthPanel from '../../components/auth/AuthPanel'
import { fetchMyProfile } from '../../lib/consultations'
import { resolvePostLoginRoute } from '../../lib/postLogin'
import { supabase } from '../../lib/supabase'

// Recuperación de contraseña. Las DOS mitades del flujo viven en esta misma página, y no en dos
// rutas, porque son la misma conversación partida por un correo: «no me acuerdo» y «esta es la
// nueva». Cuál de las dos se enseña lo decide si la URL trae un token de recuperación o no.
//
// POR QUÉ NO EXISTÍA. El sitio nunca tuvo recuperación: no había enlace en `/login` ni página que
// recibiera el enlace del correo. Un correo enviado desde el panel de Supabase aterrizaba en la
// raíz del sitio (el `Site URL`), y ahí no ocurría nada: el cliente se crea con
// `detectSessionInUrl: false` (ver `lib/supabase.ts`), así que la portada ni siquiera mira el
// `#access_token` que trae el enlace. El usuario veía la home y seguía igual de fuera.
//
// EL TOKEN VIENE EN EL FRAGMENTO, no en la query: `#access_token=…&refresh_token=…&type=recovery`.
// Se parsea a mano, igual que en `pages/auth/callback.tsx`, precisamente porque el cliente lleva
// desactivado el automatismo.

type Modo = 'comprobando' | 'pedir' | 'enviado' | 'nueva' | 'enlace-invalido'

export default function RecuperarClave() {
  const router = useRouter()

  // 'comprobando' dura lo que tarda en leerse el fragmento. Es el estado inicial a propósito: si
  // arrancara en 'pedir', quien llega desde el correo vería parpadear el formulario del email
  // antes de que apareciera el de la contraseña nueva.
  const [modo, setModo] = useState<Modo>('comprobando')

  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [claveRepetida, setClaveRepetida] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // El modo se decide UNA vez, al montar, y se escribe UNA vez. El fragmento no llega al
  // servidor, así que el render del servidor y el primer render del cliente coinciden siempre en
  // 'comprobando' y no hay desajuste de hidratación.
  useEffect(() => {
    let cancelado = false

    const resolver = async (): Promise<Modo> => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

      // Supabase avisa por aquí de un enlace caducado o ya usado. Merece su propia pantalla: el
      // fallo más común de este flujo es tardar más de una hora en abrir el correo, y «caducó,
      // pide otro» es accionable, mientras que un formulario que falla al guardar no lo es.
      if (hash.get('error') || hash.get('error_description')) return 'enlace-invalido'

      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      if (!accessToken || !refreshToken) return 'pedir'

      const { error: e } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })
      if (e) return 'enlace-invalido'

      // Se borra el fragmento de la barra de direcciones EN CUANTO la sesión está creada. Los
      // tokens ya no hacen falta ahí, y mientras sigan en la URL viajan a cualquier sitio donde
      // se copie el enlace y quedan en el historial del navegador. El `refresh_token` no caduca
      // en una hora como el de acceso.
      window.history.replaceState(null, '', window.location.pathname)
      return 'nueva'
    }

    resolver().then((m) => {
      if (!cancelado) setModo(m)
    })

    return () => {
      cancelado = true
    }
  }, [])

  const pedirEnlace = async () => {
    setError('')
    const correo = email.trim().toLowerCase()
    if (!correo) {
      setError('Ingresa tu correo.')
      return
    }
    setCargando(true)
    try {
      await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo: `${window.location.origin}/auth/recuperar`
      })
      // Se pasa a 'enviado' PASE LO QUE PASE, también si Supabase devolvió error. Es deliberado:
      // un mensaje distinto según si el correo existe o no convierte esta pantalla en un detector
      // de qué personas tienen cuenta aquí, que en un sitio de salud es justo lo que no puede
      // filtrarse. Supabase tampoco lo distingue en su respuesta, por el mismo motivo.
      setModo('enviado')
    } finally {
      setCargando(false)
    }
  }

  const guardarClave = async () => {
    setError('')
    if (clave.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (clave !== claveRepetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    setCargando(true)
    try {
      const { error: e } = await supabase.auth.updateUser({ password: clave })
      if (e) throw e

      // Ya hay sesión válida (la creó el token del correo), así que se entra directo en vez de
      // devolver a `/login` a escribir la contraseña recién elegida. El destino lo decide el mismo
      // helper que usan `/login` y `/auth/callback`.
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sin sesión tras actualizar la contraseña.')

      const perfil = await fetchMyProfile(session.access_token)
      const ruta = resolvePostLoginRoute(perfil)
      if (ruta.kind === 'blocked') {
        // La contraseña SÍ se cambió; lo que pasa es que la cuenta está desactivada. Se cierra la
        // sesión y se explica, en vez de rebotar a una página que no lo dice.
        await supabase.auth.signOut()
        setError(ruta.message)
        return
      }
      router.push(ruta.href)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar la contraseña. Pide un enlace nuevo e inténtalo otra vez.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <Seo
        titulo="Recuperar contraseña — Médicos por Venezuela"
        descripcion={'Restablece la contraseña de tu cuenta de Médicos por Venezuela.'}
        ruta="/auth/recuperar"
        noindex
      />
      <main className="page">
        {modo === 'comprobando' && (
          <div className="narrow">
            <div className="card">Cargando...</div>
          </div>
        )}

        {modo === 'pedir' && (
          <AuthPanel
            title="Recuperar contraseña"
            description="Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva."
            backHref="/login"
            backLabel="Volver al inicio de sesión"
          >
            <div className="grid">
              <AuthField
                label="Email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={setEmail}
                onEnter={pedirEnlace}
              />
              {error && <div className="notice notice-danger">{error}</div>}
              <button
                className="btn btn-primary btn-full"
                onClick={pedirEnlace}
                disabled={cargando}
              >
                {cargando ? 'Enviando...' : 'Enviarme el enlace'}
              </button>
              {/* Las cuentas creadas con Google no tienen contraseña en este sitio, así que no hay
                  nada que recuperar y el correo no llegaría nunca. Se avisa aquí, antes de que
                  alguien se quede esperando. No se detecta automáticamente a propósito:
                  comprobarlo exigiría responder distinto según el correo escrito, que es
                  exactamente la fuga que evita el mensaje único de la pantalla siguiente. */}
              <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
                ¿Entras con Google? Esas cuentas no tienen contraseña aquí: vuelve a{' '}
                <Link href="/login" className="link-button">
                  iniciar sesión
                </Link>{' '}
                y usa el botón de Google.
              </p>
            </div>
          </AuthPanel>
        )}

        {modo === 'enviado' && (
          <AuthPanel
            title="Revisa tu correo"
            description="Si ese correo tiene una cuenta con contraseña, acabamos de enviarle un enlace para restablecerla."
            backHref="/login"
            backLabel="Volver al inicio de sesión"
          >
            <div className="grid">
              <div className="notice">
                El enlace caduca en una hora. Si no lo ves, revisa la carpeta de spam.
              </div>
            </div>
          </AuthPanel>
        )}

        {modo === 'nueva' && (
          <AuthPanel
            title="Elige tu contraseña nueva"
            description="Escríbela dos veces para confirmar que no hay una errata."
          >
            <div className="grid">
              <AuthField
                label="Contraseña nueva"
                type="password"
                value={clave}
                autoComplete="new-password"
                onChange={setClave}
              />
              <AuthField
                label="Repite la contraseña"
                type="password"
                value={claveRepetida}
                autoComplete="new-password"
                onChange={setClaveRepetida}
                onEnter={guardarClave}
              />
              {error && <div className="notice notice-danger">{error}</div>}
              <button
                className="btn btn-primary btn-full"
                onClick={guardarClave}
                disabled={cargando}
              >
                {cargando ? 'Guardando...' : 'Guardar y entrar'}
              </button>
            </div>
          </AuthPanel>
        )}

        {modo === 'enlace-invalido' && (
          <AuthPanel
            title="Ese enlace ya no sirve"
            description="Los enlaces de recuperación caducan en una hora y solo se pueden usar una vez."
            backHref="/login"
            backLabel="Volver al inicio de sesión"
          >
            <div className="grid">
              <button
                className="btn btn-primary btn-full"
                onClick={() => {
                  setError('')
                  setModo('pedir')
                }}
              >
                Pedir un enlace nuevo
              </button>
            </div>
          </AuthPanel>
        )}
      </main>
    </>
  )
}
