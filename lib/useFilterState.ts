// Estado de un juego de filtros de texto (búsqueda, fechas, códigos) de los listados del panel.
//
// Dos reglas que antes se copiaban en cada página:
//   · `setFilter` devuelve el MISMO objeto si el valor no cambia. Los filtros suelen ser dependencia
//     del efecto que carga los datos, y un objeto nuevo con el mismo contenido dispararía otra
//     consulta (el debounce de un buscador llama con '' al montar).
//   · Un valor vacío QUITA la clave: así la query no lleva `?campo=`, que FastAPI intentaría parsear
//     (una fecha vacía da 422 en vez de "sin filtro").
import { useCallback, useState } from 'react'

type Values = Record<string, string | undefined>

export function useFilterState<T extends object>() {
  const [filters, setFilters] = useState<T>({} as T)

  const setFilter = useCallback((key: keyof T & string, value: string) => {
    setFilters((prev) => {
      if (((prev as Values)[key] ?? '') === value) return prev
      const next: Values = { ...(prev as Values) }
      if (value === '') delete next[key]
      else next[key] = value
      return next as T
    })
  }, [])

  const clearFilters = useCallback(() => setFilters({} as T), [])

  return { filters, setFilter, clearFilters }
}
