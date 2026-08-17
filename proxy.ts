// Modo mantenimiento del sitio público, detrás de un feature flag por entorno.
//
// Va en `proxy.ts` y no en `middleware.ts`: desde Next 16 el middleware se llama Proxy y el
// nombre antiguo está deprecado (el build lo avisa). Misma funcionalidad, nombre nuevo.
//
// El objetivo es poder dejar PRODUCCIÓN en mantenimiento mientras desarrollo sigue funcionando
// normal. Como cada rama de Amplify tiene su propio entorno, basta con poner la variable en la
// rama de producción y no en la de desarrollo.
//
// Se resuelve en el servidor y no en el cliente por dos razones:
//   1. No hay parpadeo: el visitante nunca llega a ver la página real antes de que un `useEffect`
//      la tape. En una web de salud, enseñar por medio segundo un formulario que no funciona es
//      peor que no enseñarlo.
//   2. La variable NO lleva `NEXT_PUBLIC_`, así que no viaja al navegador.
//
// NO es un control de seguridad. Es un aviso: quien conozca una URL abierta entra igual, que es
// justo lo que queremos para médicos y administradores. La autenticación real sigue siendo la de
// siempre (Supabase + RLS + los guards de cada página).

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// El flag. Se lee en build (Next incorpora el valor al bundle del proxy), que es justo lo que
// queremos: encender o apagar el mantenimiento es un despliegue, no un cambio en caliente.
const MANTENIMIENTO = process.env.MAINTENANCE_MODE === 'true'

// Rutas que SIGUEN abiertas con el mantenimiento activo.
//
// Los dos primeros grupos son evidentes (personal). El tercero es el importante y el que se decidió
// a conciencia: `/sala-espera` y `/mi-caso` pertenecen a pacientes que YA enviaron su solicitud.
// Cerrarlas dejaría a alguien tirado en mitad de una videoconsulta, sin el enlace a su sala. El
// mantenimiento corta la ENTRADA de casos nuevos, no la atención de los que ya están en cola.
const ABIERTAS = [
  // Personal: entrada de médicos y administradores.
  '/login-medico',
  '/admin',
  '/panel-medico',
  // Flujo de autenticación (OAuth vuelve aquí; sin esto, un login a medias se rompe).
  '/auth',
  '/elegir-rol',
  // Pacientes con un caso ya abierto.
  '/sala-espera',
  '/mi-caso'
]

export function proxy(request: NextRequest) {
  if (!MANTENIMIENTO) return NextResponse.next()

  const { pathname } = request.nextUrl

  // `startsWith` con el prefijo + '/' cubre las subrutas (`/admin/dashboard`,
  // `/panel-medico/consulta/…`) sin dejar pasar por accidente algo como `/admin-secreto`.
  const abierta = ABIERTAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
  if (abierta) return NextResponse.next()

  // La propia página de mantenimiento, para no reescribirla sobre sí misma en bucle.
  if (pathname === '/mantenimiento') return NextResponse.next()

  // `rewrite` y no `redirect`: la URL que el visitante escribió se queda en la barra. Si alguien
  // llega a medicosporvenezuela.org desde un enlace compartido, al terminar el mantenimiento
  // recarga y ya está en el sitio, en vez de haber quedado en /mantenimiento.
  return NextResponse.rewrite(new URL('/mantenimiento', request.url))
}

export const config = {
  // Se excluyen los estáticos: sin esto, el propio CSS y las imágenes de la página de
  // mantenimiento acabarían reescritos a la página de mantenimiento.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2)).*)'
  ]
}
