# Implementation Plan: el badge "Verificado" del admin debe decir la verdad

> Spec: [`spec.md`](./spec.md) · Tareas: [`todo.md`](./todo.md)

## Overview

Exponer `doctors.verified` (el resultado real de SACS/FPV) en `GET /profiles` y hacer que los dos
badges del admin lo lean, en vez de `users.verified`, que es una constante `true`.

Cambio **aditivo**: ninguna migración, ninguna política RLS, ninguna columna borrada.

## Architecture Decisions

**1. El campo se llama `doctor_verified`, no `verified`.**
La respuesta ya tiene un `verified` (el de `users`). Reutilizar el nombre es exactamente cómo se
llegó a este bug. Dos nombres distintos para dos hechos distintos.

**2. Es `bool | None`, no `bool`.**
`None` significa "esta persona no tiene ficha de médico" — un paciente o un admin puro. Colapsarlo
a `false` diría "cédula sin verificar" de alguien que no tiene cédula que verificar. El tercer
estado es información, no un caso borde a aplastar.

**3. `LEFT JOIN` en la misma consulta paginada.**
La lista tiene ~3500 filas. Una consulta por fila para leer un booleano sería un N+1 sobre la
pantalla que más usa el admin. `list_profiles` ya construye un `select` con filtros y paginación;
el join entra ahí.

**4. `users.verified` se queda y no se toca.**
No es un olvido: `CLAUDE.md:310-313` lo documenta como el cableado reservado para la aprobación
previa, y `current_user_role()` —del que dependen 5 políticas RLS sobre PII de pacientes— filtra por
él. Este cambio solo deja de **mentir** sobre él; borrarlo es otra decisión.

**5. Backend primero, y mergeable solo.**
El campo nuevo es aditivo: el frontend actual lo ignora y sigue funcionando. Eso permite mergear el
backend sin coordinar despliegues. Al revés no funciona.

## Dependency Graph

```
T1  backend: doctor_verified en GET /profiles (+ tests)
     │        ← mergeable por si solo; el frontend viejo lo ignora
     │
     ├── T2  frontend: ApiUser + los dos badges
     │        │
     │        └── T4  spec E2E de los tres estados
     │
     └── T3  quitar los !me.verified muertos   ← independiente de T1
                                                  │
                                                  └── T5  docs + changelog
```

`T3` no depende de nada: es borrar condiciones que ya son constantes. Puede ir en paralelo.

## Task List

### Fase 1: Backend

- [ ] **T1** — `doctor_verified` en `GET /profiles`, con tests

### Checkpoint A — el dato existe y es correcto

- [ ] `pytest` verde, incluidos los tres casos (`true` / `false` / `null`)
- [ ] Verificado que sigue siendo **una sola query**
- [ ] El frontend actual, sin tocar, sigue funcionando contra el backend nuevo

### Fase 2: Frontend

- [ ] **T2** — `ApiUser.doctor_verified` y los dos badges
- [ ] **T3** — Quitar `!me.verified` de los dos guards

### Checkpoint B — el admin ve la verdad

- [ ] `/admin/doctores` muestra los tres estados, no verde universal
- [ ] `tsc --noEmit`, `lint`, `build` limpios
- [ ] Manual: un médico verificado y otro sin verificar se distinguen en pantalla

### Fase 3: Red de seguridad y docs

- [ ] **T4** — Spec E2E de los tres estados
- [ ] **T5** — `CLAUDE.md`, `AGENTS.md`, `changeslog.md`

### Checkpoint C — listo para revisión

- [ ] Los 9 criterios de éxito del spec, uno a uno
- [ ] `pnpm test:e2e` sin regresión respecto a la baseline de la rama
- [ ] Cero cambios en migraciones, RLS o `current_user_role()`

## Risks and Mitigations

| Riesgo                                                          | Impacto                                            | Mitigación                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N+1 en la lista de ~3500 usuarios**                           | **Alto** — degrada la pantalla más usada del admin | `LEFT JOIN` en el `select` existente, no un fetch por fila. T1 incluye un test que cuenta las queries; no vale "parece rápido en local con 20 filas"                                                                                                                                                          |
| Una ficha **borrada** duplicaría la fila del usuario en el join | Medio — descuadra paginación y total               | **Resuelto:** el índice `uq_doctors_user_id_not_deleted` es UNIQUE pero **parcial** (`WHERE deleted_at IS NULL AND user_id IS NOT NULL`). El `ON` del join debe incluir `Doctor.deleted_at.is_(None)`; con eso hay como mucho una fila por usuario. Hoy hay 0 duplicados, pero eso es el dato, no la garantía |
| El badge nuevo confunde a quien esperaba el viejo               | Bajo                                               | Cambia el texto a "Cédula verificada" / "Cédula sin verificar": nombra qué se verificó, que es la ambigüedad original                                                                                                                                                                                         |
| Quitar `!me.verified` deja pasar a alguien que antes no pasaba  | **Ninguno**                                        | La condición es constante `false` para las 3498 filas. Y `active` sigue en su sitio                                                                                                                                                                                                                           |
| Exponer un dato de credencial por una API                       | Bajo                                               | `GET /profiles` ya exige el permiso `profiles.read` (solo admin). No se toca `/doctors/pool`, que es semi-público                                                                                                                                                                                             |

## Parallelization

- **Secuencial:** T1 → T2 → T4
- **Paralelo:** T3 no depende de nada; T5 se redacta cuando quieras pero se cierra al final

## Out of Scope

Ver `spec.md` → "Qué NO se hace". En corto: no se borra `users.verified`, no se toca
`current_user_role()` ni las 5 políticas RLS, y no se cablea la aprobación previa.

## Open Questions

Ninguna. La única que había —si el join podía duplicar filas— se resolvió contra el esquema antes de
escribir el plan: el índice único es **parcial**, así que el `ON` lleva `deleted_at IS NULL`.

## Nota sobre la magnitud

`doctors.verified` está repartido **795 `false` / 2160 `true`**. El 27% de los médicos aparece hoy
como "Verificado" sin estarlo. No es un caso borde: es la mayoría de la utilidad de la pantalla.
