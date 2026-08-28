# Spec: el badge "Verificado" del admin debe decir la verdad

> Decisión tomada con el usuario el 2026-08-27. Plan: [`plan.md`](./plan.md) · Tareas: [`todo.md`](./todo.md)
>
> Este cambio salió de investigar `users.verified` como "campo sobrante que limpiar". La
> investigación encontró algo distinto: el campo está muerto, pero **dos pantallas de admin lo
> pintan como si significara algo**.

## Objective

Que un administrador pueda ver, en la lista de médicos, **si la cédula de ese médico validó de
verdad contra SACS/FPV**. Hoy no puede: la UI le muestra un badge verde "Verificado" para
absolutamente todo el mundo.

## El problema

Hay dos columnas llamadas `verified` y significan cosas distintas:

| Columna            | Qué es                                                                             | Quién la escribe                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `users.verified`   | Nada, en la práctica                                                               | El trigger `handle_new_auth_user` la inserta `true`; `finalize_role` la vuelve a poner `true` |
| `doctors.verified` | Resultado real de validar la cédula contra **SACS** (médico) o **FPV** (psicólogo) | `_verify_credential()` al registrar y al cambiar la cédula                                    |

`users.verified` **nunca se pone en `false`**. Verificado de tres formas independientes:

1. Grep sobre todo el backend: el único escritor es `profiles.py:119`, y escribe `True`.
2. Ningún schema permite escribirla desde el cliente (`DoctorUpdate` toca `doctors.verified`, que
   es otra columna).
3. **Los datos:** 3498 filas en la BD, **todas** `verified = true`. Ninguna en `false`.

Y sin embargo:

- [`pages/admin/doctores.tsx:215`](../../pages/admin/doctores.tsx) pinta `{p.verified ? 'Verificado' : ...}`
- [`components/admin/UsersManager.tsx:387`](../../components/admin/UsersManager.tsx) pinta `{u.verified ? 'Verificado' : ...}`

Ambas leen `users.verified` vía `fetchProfiles` → `GET /profiles`. Como la columna es una
constante, **el badge sale verde siempre**.

### Por qué importa: son 795 médicos

No es teórico. En la base de datos:

```
doctors.verified = false  ->   795
doctors.verified = true   ->  2160
```

**El 27% de los médicos tiene la cédula sin validar contra SACS/FPV, y el admin los ve a todos con
el badge verde de "Verificado".** La pantalla existe para supervisar y no supervisa nada.

Y esto se cruza con el trade-off que `CLAUDE.md:310` ya admite: cualquiera que se auto-registre como
médico lee de inmediato la PII de todos los pacientes vía la lectura `is_staff` de RLS. La única
mitigación es que un admin revoque — pero para revocar hay que poder ver a quién, y esa es justo la
pantalla que miente.

Peor: **no hay ninguna otra pantalla donde el admin pueda ver el dato real.** Se comprobó —
`/doctors/pool` no devuelve `verified` (`DoctorPoolItem` en `schemas/doctor.py:130` no lo incluye),
y `/profiles` solo devuelve la constante. El único sitio donde `doctors.verified` es visible es
`/panel-medico/perfil`, y ahí solo lo ve **el propio médico** sobre sí mismo.

Es decir: hoy el equipo no tiene forma de saber qué médicos tienen credencial validada.

## Qué se hace

1. **`GET /profiles` expone `doctor_verified`** — el `doctors.verified` real, vía `LEFT JOIN`
   filtrando `deleted_at IS NULL`. `null` cuando la persona no tiene ficha de médico (pacientes,
   admins puros).
2. **Los dos badges leen ese campo**, con tres estados en vez de dos: verificado / no verificado /
   no aplica.
3. **Se quitan los `!me.verified` del frontend**, que son condiciones muertas.
4. **Se documenta** que `users.verified` es un gancho reservado, no un dato vivo.

## Qué NO se hace, y por qué

**No se borra `users.verified`.** Es tentador —está muerto— pero:

- `CLAUDE.md:310-313` lo documenta como el cableado reservado para pasar a **aprobación previa** de
  médicos: _"To switch to an approval gate later, have signup/`set_my_role` set doctors
  `verified = false` and gate `current_user_role()` on it."_ No es un olvido; alguien lo dejó a
  propósito.
- La función SQL `current_user_role()` filtra por `verified = true`, y **5 políticas RLS** dependen
  de ella: `consultations_select_staff`, `consultations_update_staff`, `events_select_staff`,
  `events_insert_staff`, `patients_select_staff`. Esas políticas son las que protegen la PII de los
  pacientes. Tocarlas para borrar una columna que hoy no molesta es riesgo sin premio.

**No se cablea la aprobación previa.** Sería una feature que cambia el modelo de acceso del
producto, no una limpieza. Decisión aparte.

## Tech Stack

Dos repos:

- **`api-medicos-por-venezuela`** (FastAPI + SQLAlchemy async + Pydantic) — el endpoint.
- **`medicos-por-venezuela`** (Next.js Pages Router + TypeScript) — los badges.

## Commands

```
Backend:   pytest                        (en api-medicos-por-venezuela)
Frontend:  pnpm exec tsc --noEmit
           pnpm lint
           pnpm build
           pnpm test:e2e
```

> No lanzar `pnpm build` con un `next dev` vivo sobre el mismo directorio: se pisan el `.next` y el
> dev server empieza a servir chunks rotos. Usar `NEXT_DIST_DIR` o parar el dev.

## Code Style

El join, en una sola consulta (nada de N+1 sobre una tabla de ~3500 filas):

```python
# src/services/profiles.py
# doctors.verified es el resultado real de SACS/FPV; users.verified NO lo es (nace true y nadie la
# baja). El admin necesita el primero, asi que se trae en el mismo SELECT paginado: un LEFT JOIN,
# no una consulta por fila.
# El indice unico de doctors.user_id es PARCIAL (uq_doctors_user_id_not_deleted, WHERE
# deleted_at IS NULL): sin ese filtro en el ON, una ficha borrada duplicaria la fila del usuario
# y descuadraria la paginacion y el total.
stmt = (
    select(Profile, Doctor.verified.label("doctor_verified"))
    .outerjoin(
        Doctor,
        (Doctor.user_id == Profile.id) & (Doctor.deleted_at.is_(None)),
    )
    .where(*conditions)
    .order_by(Profile.created_at.desc())
    .offset(skip)
    .limit(limit)
)
```

Y el badge, con el tercer estado explícito:

```tsx
// null = esta persona no es medico (paciente, admin puro): no hay credencial que verificar.
{
  p.doctor_verified === null ? null : p.doctor_verified ? (
    <span className="badge badge-green">Cédula verificada</span>
  ) : (
    <span className="badge badge-red">Cédula sin verificar</span>
  )
}
```

El texto cambia de "Verificado" a "Cédula verificada" a propósito: nombra **qué** se verificó, que
es justo la ambigüedad que causó el problema.

## Testing Strategy

| Nivel            | Qué cubre                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend (pytest) | `GET /profiles` devuelve `doctor_verified` correcto: `true`, `false` y `null` según haya ficha y su estado. Y que sigue siendo **una sola query** |
| Tipos            | `tsc --noEmit` — el campo nuevo en `ApiUser` obliga a actualizar los dos consumidores                                                             |
| E2E              | Un spec que verifique los tres estados del badge en `/admin/doctores`                                                                             |
| Manual           | La lista de médicos con un médico verificado y otro sin verificar                                                                                 |

## Boundaries

**Always**

- El dato de credencial sale de `doctors.verified`, nunca de `users.verified`.
- Una sola query para la lista paginada.
- `GET /profiles` sigue exigiendo el permiso `profiles.read` (solo admin).

**Ask first**

- Cambiar `current_user_role()` o cualquier política RLS.
- Cualquier migración de esquema.

**Never**

- Borrar `users.verified` en este cambio.
- Exponer `doctor_verified` en un endpoint público (`/doctors/pool` es semi-público: no va ahí).
- Dejar un badge que afirme algo que el backend no sabe.

## Success Criteria

1. `GET /profiles` devuelve `doctor_verified: true` para un médico con cédula validada.
2. Devuelve `false` para un médico con ficha cuya cédula no validó.
3. Devuelve `null` para un paciente y para un admin sin ficha de médico.
4. La consulta sigue siendo **una sola** (verificado por test o por log de SQL), con 3500 filas, y
   el total de la paginación no cambia respecto a antes del join (un médico con ficha borrada no
   duplica su fila).
5. `/admin/doctores` muestra los tres estados y **ya no muestra verde a todo el mundo**.
6. `UsersManager` idem.
7. `grep -rn "me.verified\|\.verified" pages lib components` no devuelve ningún uso de
   `users.verified` para decidir nada.
8. `CLAUDE.md` explica la diferencia entre las dos columnas y que `users.verified` es un gancho
   reservado.
9. Backend: `pytest` verde. Frontend: `tsc`, `lint`, `build` limpios; E2E sin regresión.

## Open Questions

Ninguna bloqueante.

Una observación para más adelante, fuera de alcance: los guards `!me.active || !me.verified` de
`panel-medico.tsx:199` y `consulta/[id].tsx:266` hacen `signOut()` y mandan a la pantalla de login
**sin mensaje**. Hoy solo son alcanzables por `active: false`, así que un médico al que un admin
revoca ve algo indistinguible de "contraseña incorrecta". Si algún día se cablea la aprobación
previa, ese rebote mudo hay que arreglarlo antes.
