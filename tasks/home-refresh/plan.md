# Plan de implementación: refrescamiento del Home

> Spec: [`.knowledge/spec-home-refresh.md`](../../.knowledge/spec-home-refresh.md)
> Tareas: [`tasks/todo.md`](./todo.md)

## Resumen

Reconstruir `pages/index.tsx` según el prototipo de The Climb, con la marca de `nueva/material/`
y el copy del `.docx`. Doce secciones, tres destinos de enlace reales, una foto que baja de 5 MB a
~32 KB, y movimiento sobrio con un gesto mayor en el hero. Las páginas de registro solo cambian de
color y tipografía.

## Grafo de dependencias

```
Assets (fuente woff2 · logos SVG · foto optimizada)
   │
   └── Tokens de marca (--h-*) + @font-face
          │
          ├── Primitivas de movimiento (useReveal · useCountUp · guard reduced-motion)
          │      │
          │      └── Secciones del home ──→ index.tsx (composición)
          │
          └── Re-tematizado de /registro-* (redefinir tokens en un scope)
```

Los assets son la base de todo: sin la fuente y los tokens, cada sección se construiría dos veces.
El re-tematizado de registro cuelga solo de los tokens, así que puede ir en paralelo con las
secciones si hiciera falta.

## Decisiones de arquitectura

**1. Rebanado vertical por sección, no por capa.** Cada tarea entrega una sección completa
—markup, estilos y movimiento— y se puede mirar en el navegador. Construir "primero todo el HTML,
luego todo el CSS" dejaría el home roto durante días.

**2. `components/home/` en vez de un `index.tsx` gigante.** Hoy son 1313 líneas y el prototipo
trae 12 secciones. `index.tsx` queda como composición de ~60 líneas.

**3. Los tokens van scopeados, no en `:root`.** El repo ya usa este idioma: `.patient-theme`
redefine `--green` dentro de su ámbito y `registro-paciente` lo aplica en el `<main>`. Se sigue ese
patrón exacto, lo que hace el rediseño reversible y deja intactos el panel y el admin.

**4. Las primitivas de movimiento se definen antes que las secciones.** Si cada sección inventa su
animación, salen doce timings distintos. Un `useReveal` compartido —extraído del que ya existe en
`index.tsx`— y un guard único de `prefers-reduced-motion` garantizan consistencia y que desactivar
el movimiento sea un solo sitio.

**5. El markup se extrae del prototipo, no se estima a ojo.** El prototipo es un bundle de 10 MB
que no se puede abrir cómodamente, pero su HTML lleva los estilos en línea con valores exactos
(tamaños, pesos, paddings, colores). Cada tarea de sección empieza extrayendo su fragmento.

## Fases

### Fase 1 — Cimientos (T1–T3)

Assets, tokens y primitivas de movimiento. Nada visible todavía, pero sin esto todo lo demás se
hace dos veces. **La tarea de mayor riesgo va aquí** (la fuente).

### Checkpoint A

- [ ] `pnpm build` en verde con los assets nuevos en `public/`
- [ ] La foto pesa ≤ 40 KB y se ve nítida en 2×
- [ ] Los cuatro pesos de Nunito Sans cargan (comprobar en DevTools → Network → Font)
- [ ] `:root` de `globals.css` sin cambios (`git diff styles/globals.css`)

### Fase 2 — Estructura y hero (T4–T5)

El marco (navbar + footer) y el hero. El hero se hace **temprano a propósito**: concentra la foto,
la tipografía, los tokens y el gesto mayor. Si algo del enfoque no funciona, se descubre aquí y no
en la sección diez.

### Checkpoint B — revisión con el autor

- [ ] El hero se ve como el prototipo en 360 px, 768 px y 1440 px
- [ ] El gesto del hero aprobado (pregunta abierta 1 del spec)
- [ ] Con `prefers-reduced-motion: reduce` no se mueve nada
- [ ] **Parar y enseñarlo antes de seguir con las otras nueve secciones**

### Fase 3 — Resto de secciones (T6–T9)

Las nueve secciones restantes, agrupadas por parecido estructural para reaprovechar estilos.

### Checkpoint C

- [ ] Las 12 secciones en el orden del prototipo
- [ ] Ningún `href="#"` en todo el home
- [ ] Las tres puertas navegan a `/registro-paciente` y `/registro-medico`
- [ ] `tsc`, `lint` y `build` en verde, sin warnings nuevos

### Fase 4 — Registro y cierre (T10–T11)

Re-tematizado de las dos páginas de registro y verificación final.

### Checkpoint D — listo para revisión

- [ ] Los 10 criterios de aceptación del spec, uno por uno
- [ ] El panel médico y el admin se ven idénticos a antes
- [ ] `changeslog.md` actualizado
- [ ] E2E pasando

## Riesgos

| Riesgo                                                                                                | Impacto  | Mitigación                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`material/Fuentes/` solo trae el peso bold** y el diseño usa 600/700/800/900                        | **Alto** | Nunito Sans es libre (SIL OFL): descargar los pesos que faltan, convertirlos a woff2 y autoalojarlos. Va en T1 para que falle pronto. Si no se puede, usar la variable font. |
| El copy sigue "pendiente de aprobación por Oriana y Ada"                                              | Medio    | Todo el texto en un solo módulo (`components/home/copy.ts`), para que un cambio de copy no sea un cambio de componentes.                                                     |
| El prototipo es un bundle; el layout exacto de algunas secciones no se puede inspeccionar visualmente | Medio    | Extraer el fragmento HTML de cada sección antes de escribirla; los estilos en línea traen los valores exactos.                                                               |
| "Solicitar interconsulta" apunta a un flujo que no existe                                             | Medio    | Provisional a `/registro-medico`, marcado en el código con un comentario y en el spec como pregunta abierta.                                                                 |
| Reescribir `index.tsx` rompe algún E2E                                                                | Bajo     | Comprobado: ningún E2E navega por el home (entran directo a `/registro-paciente`, `/panel-medico`).                                                                          |
| El refrescamiento del home deja las páginas de registro con marca vieja                               | Bajo     | T10 las re-tematiza con el patrón `.patient-theme` que ya existe.                                                                                                            |

## Paralelización

- **En paralelo:** T10 (registro) es independiente de las secciones; solo necesita T2 (tokens).
- **Secuencial obligatorio:** T1 → T2 → T3, y T5 (hero) después de T3.
- **Coordinación:** todas las secciones consumen `copy.ts` y los tokens; si cambian, cambian todas.

## Preguntas abiertas

Las cuatro del spec siguen sin resolver y **ninguna bloquea el arranque**:

1. Gesto del hero — se necesita **antes del Checkpoint B**.
2. "Solicitar interconsulta" — provisional, no bloquea.
3. `#ffffff` vs `#fef9f8` — un token, se cambia en un minuto.
4. Tagline del navbar en móvil — se necesita en T4.
