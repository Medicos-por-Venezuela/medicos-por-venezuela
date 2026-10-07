// El puente entre los nombres de clase de la plantilla y los que genera el CSS Module.
//
// `estilos.module.css` conserva los nombres del original (`btn-top`, `card-eq`, `z-qr`…), así que
// el CSS de aquí se puede comparar línea a línea con el `<style>` de `mxv-donativos/index.html`.
// A cambio, en TypeScript hay que escribir `estilos['btn-top']` en vez de `estilos.btnTop`, y
// encadenar varias clases obliga a un `.join(' ')` cada vez. `cls()` hace las dos cosas:
//
//     <a className={cls('btn', 'btn-top')}>   →   class="estilos_btn__a1b2 estilos_btn-top__c3d4"
//
// Un nombre que no esté en el módulo es una errata, y el síntoma —un elemento sin estilo— es
// difícil de ver entre 90 reglas. En desarrollo avisa por consola; en producción no molesta.

import estilos from './estilos.module.css'

export function cls(...nombres: string[]): string {
  const clases: string[] = []
  for (const nombre of nombres) {
    const clase = estilos[nombre]
    if (clase) {
      clases.push(clase)
      continue
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[donaciones] "${nombre}" no existe en estilos.module.css`)
    }
  }
  return clases.join(' ')
}
