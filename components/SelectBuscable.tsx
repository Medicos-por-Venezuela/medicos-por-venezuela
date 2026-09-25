import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type OpcionBuscable = {
  value: string
  label: string
  // Lo que muestra el botón cerrado cuando es más corto que `label` (p. ej. solo "+58").
  etiquetaCerrada?: string
  // Texto extra por el que también se encuentra la opción (p. ej. el código de marcación).
  busqueda?: string
}

type SelectBuscableProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  opciones: OpcionBuscable[]
  placeholder?: string
  placeholderBusqueda?: string
  className?: string
  disabled?: boolean
}

// Minúsculas, sin tildes y sin "+", para que "peru", "Perú", "58" y "+58" encuentren lo mismo.
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\+/g, '').toLowerCase().trim()

// Un <select> nativo no deja escribir para filtrar más allá de la primera letra; con ~240
// países hace falta buscar. Botón con aspecto de select + panel con buscador y listbox.
export default function SelectBuscable({
  id,
  value,
  onChange,
  opciones,
  placeholder = 'Selecciona...',
  placeholderBusqueda = 'Buscar...',
  className,
  disabled
}: SelectBuscableProps) {
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [activo, setActivo] = useState(0)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  const seleccionada = opciones.find((o) => o.value === value)

  // Primero las que tienen una palabra que EMPIEZA por lo escrito ("58" → Venezuela antes que
  // Finlandia +358), luego el resto de coincidencias, conservando el orden alfabético.
  const filtradas = useMemo(() => {
    const q = normalizar(consulta)
    if (!q) return opciones
    const prefijo: OpcionBuscable[] = []
    const resto: OpcionBuscable[] = []
    for (const o of opciones) {
      const texto = normalizar(`${o.label} ${o.busqueda ?? ''}`)
      if (!texto.includes(q)) continue
      if (texto.split(/[\s()]+/).some((palabra) => palabra.startsWith(q))) prefijo.push(o)
      else resto.push(o)
    }
    return [...prefijo, ...resto]
  }, [consulta, opciones])

  useEffect(() => {
    if (!abierto) return
    const cerrarSiFuera = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrarSiFuera)
    return () => document.removeEventListener('mousedown', cerrarSiFuera)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activo, abierto])

  const abrir = () => {
    setConsulta('')
    setActivo(
      Math.max(
        0,
        opciones.findIndex((o) => o.value === value)
      )
    )
    setAbierto(true)
  }

  const elegir = (opcion: OpcionBuscable) => {
    onChange(opcion.value)
    setAbierto(false)
    botonRef.current?.focus()
  }

  const onKeyDownBusqueda = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => Math.min(i + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtradas[activo]) elegir(filtradas[activo])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setAbierto(false)
      botonRef.current?.focus()
    } else if (e.key === 'Tab') {
      setAbierto(false)
    }
  }

  return (
    <div ref={contenedorRef} className={`select-buscable ${className ?? ''}`}>
      <button
        ref={botonRef}
        id={id}
        type="button"
        className="select-buscable-boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            abrir()
          }
        }}
      >
        <span className={seleccionada ? undefined : 'select-buscable-placeholder'}>
          {seleccionada ? (seleccionada.etiquetaCerrada ?? seleccionada.label) : placeholder}
        </span>
      </button>
      {abierto && (
        <div className="select-buscable-panel">
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={filtradas[activo] ? `${listboxId}-${activo}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value)
              setActivo(0)
            }}
            onKeyDown={onKeyDownBusqueda}
            placeholder={placeholderBusqueda}
          />
          <ul ref={listaRef} id={listboxId} role="listbox" className="select-buscable-lista">
            {filtradas.map((o, i) => (
              <li
                key={o.value}
                id={`${listboxId}-${i}`}
                data-indice={i}
                role="option"
                aria-selected={o.value === value}
                className={i === activo ? 'activo' : undefined}
                onMouseEnter={() => setActivo(i)}
                // mousedown en vez de click: así el input no pierde el foco antes de elegir.
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(o)
                }}
              >
                {o.label}
              </li>
            ))}
            {filtradas.length === 0 && <li className="select-buscable-vacio">Sin resultados</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
