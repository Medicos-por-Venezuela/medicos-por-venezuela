# Todo: el badge "Verificado" del admin debe decir la verdad

> Spec: [`spec.md`](./spec.md) · Plan: [`plan.md`](./plan.md)
>
> Backend: `pytest` (en `api-medicos-por-venezuela`)
> Frontend: `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `pnpm test:e2e`

---

## Fase 1 — Backend

### T1: `doctor_verified` en `GET /profiles`

**Descripción:** Traer el `doctors.verified` real en la misma consulta paginada de perfiles, para
que la lista del admin pueda distinguir a los 795 médicos con cédula sin validar de los 2160 que sí.

**Acceptance criteria:**

- [x] `list_profiles` hace `outerjoin(Doctor, (Doctor.user_id == Profile.id) & (Doctor.deleted_at.is_(None)))` y selecciona `Doctor.verified` etiquetado — **una sola consulta**, no un fetch por fila
- [x] El schema de respuesta expone `doctor_verified: bool | None`; `None` cuando no hay ficha
- [x] El campo se llama `doctor_verified`, **no** `verified`: la respuesta ya tiene un `verified` (el de `users`) y reutilizar el nombre es cómo se llegó a este bug
- [x] El `total` de la paginación no cambia respecto a antes del join

**Verification:**

- [x] `pytest` — tres casos: médico verificado (`true`), médico con ficha no verificada (`false`), paciente sin ficha (`null`)
- [x] Un test que un médico con ficha **soft-deleted** no duplica su fila ni pierde el `null`
- [x] Contar las queries de una página de resultados: debe ser el mismo número que antes
- [x] Manual: `curl` a `/api/v1/profiles` con token de admin, comprobando que salen los tres valores

**Dependencies:** Ninguna
**Files:** `src/services/profiles.py`, `src/schemas/profile.py` (o `user.py`, donde viva la fila de la lista), `src/routers/profiles.py`, `tests/`
**Scope:** S (3-4 archivos)

---

### ✅ Checkpoint A — el dato existe y es correcto

- [x] `pytest` verde con los tres casos + el de la ficha borrada
- [x] Confirmado que sigue siendo una sola query
- [x] **El frontend actual, sin tocar, sigue funcionando** contra el backend nuevo (el campo es aditivo). Esto es lo que permite mergear el backend por separado
- [x] Revisar con el usuario antes de seguir

---

## Fase 2 — Frontend

### T2: Los dos badges leen el dato real

**Descripción:** `admin/doctores.tsx` y `UsersManager.tsx` dejan de pintar `users.verified`
(constante `true`) y pasan a pintar `doctor_verified`, con el tercer estado para quien no es médico.

**Acceptance criteria:**

- [x] `ApiUser` en `lib/users.ts` incorpora `doctor_verified: boolean | null`
- [x] `admin/doctores.tsx:215` y `UsersManager.tsx:387` leen ese campo
- [x] Tres estados: `true` → "Cédula verificada" (verde); `false` → "Cédula sin verificar" (rojo); `null` → **no se pinta badge** (no es médico, no hay nada que verificar)
- [x] El texto dice "Cédula", no "Verificado" a secas: nombra qué se verificó, que es la ambigüedad que causó todo esto
- [x] Ningún componente lee ya `users.verified` para decidir o mostrar algo

**Verification:**

- [x] `pnpm exec tsc --noEmit` — el campo nuevo obliga a tocar los dos consumidores; si compila sin tocarlos, el tipo está mal
- [x] `pnpm lint` · `pnpm build`
- [x] Manual: la lista muestra ambos estados. **Si sale todo verde otra vez, el fix no funcionó**

**Dependencies:** T1
**Files:** `lib/users.ts`, `pages/admin/doctores.tsx`, `components/admin/UsersManager.tsx`
**Scope:** S (3 archivos)

---

### T3: Quitar los `!me.verified` muertos

**Descripción:** Los guards `if (!me.active || !me.verified)` comprueban una constante. Se quita la
mitad muerta y se conserva `active`, que sí es un gate real (el botón "Revocar acceso" del admin).

**Acceptance criteria:**

- [x] `panel-medico.tsx:199` y `panel-medico/consulta/[id].tsx:266` comprueban solo `!me.active`
- [x] `MyProfile.verified` y `Profile.verified` se conservan en los tipos (el backend los sigue devolviendo), pero ya no deciden nada
- [x] Se deja un comentario diciendo por qué: `users.verified` nace `true` y nadie la baja

**Verification:**

- [x] `pnpm exec tsc --noEmit` · `pnpm lint`
- [x] `pnpm test:e2e` — sin regresión respecto a la baseline de la rama
- [x] Manual: revocar un médico desde el admin sigue expulsándolo del panel

**Dependencies:** Ninguna — paralelizable con T1/T2
**Files:** `pages/panel-medico.tsx`, `pages/panel-medico/consulta/[id].tsx`
**Scope:** S (2 archivos)

---

### ✅ Checkpoint B — el admin ve la verdad

- [x] `/admin/doctores` distingue verificados de no verificados. Con los datos actuales deben salir **ambos** estados: 795 y 2160
- [x] `tsc --noEmit`, `lint`, `build` limpios
- [x] Un médico revocado sigue sin poder entrar al panel

---

## Fase 3 — Red de seguridad y documentación

### T4: Spec E2E de los tres estados

**Descripción:** Fijar el gating nuevo. `CLAUDE.md` lo exige: "todo gating de UI nuevo nace con su
spec E2E".

**Acceptance criteria:**

- [x] `global-setup.ts` siembra un médico con `doctors.verified = false` además del verificado que ya hay
- [x] El spec entra a `/admin/doctores` como admin y comprueba que el médico verificado y el no verificado muestran badges **distintos**
- [x] Comprueba que un paciente no muestra badge de cédula
- [x] **Sanity check:** el spec debe ponerse rojo si el badge vuelve a leer `users.verified`. Si no falla, no está probando nada

**Verification:**

- [x] `pnpm test:e2e` con el spec nuevo en verde
- [x] Sanity check ejecutado de verdad, no asumido

**Dependencies:** T2
**Files:** `e2e/admin-cedula-verificada.spec.ts` _(nuevo)_, `e2e/global-setup.ts`
**Scope:** S (2 archivos)

---

### T5: Documentación y changelog

**Descripción:** Dejar escrita la distinción entre las dos columnas `verified`, que es lo que
faltaba y lo que permitió el bug.

**Acceptance criteria:**

- [x] `CLAUDE.md` explica: `users.verified` = gancho reservado, nace `true`, **nadie la baja**; `doctors.verified` = resultado SACS/FPV, es el dato real
- [x] La nota de seguridad de `CLAUDE.md:310-313` se mantiene (el gancho sigue disponible) pero aclara que hoy la columna no gatea nada
- [x] `AGENTS.md` consistente (regla de sync del repo)
- [x] Entrada en `changeslog.md` con el número: 795 médicos se mostraban como verificados sin estarlo
- [x] Los artefactos de `tasks/users-verified/` reflejan lo que se hizo de verdad, no solo lo planeado

**Verification:**

- [x] `pnpm format:check` sobre los archivos tocados
- [x] Releer `CLAUDE.md`: alguien que llegue nuevo debe poder distinguir las dos columnas sin leer código

**Dependencies:** T4
**Files:** `CLAUDE.md`, `AGENTS.md`, `changeslog.md`, `tasks/users-verified/*`
**Scope:** S (4 archivos)

---

### ✅ Checkpoint C — listo para revisión

- [x] Los 9 criterios de éxito del spec, verificados uno a uno
- [x] Backend `pytest` verde; frontend `tsc`/`lint`/`build`/`test:e2e` sin regresión
- [x] **Cero cambios** en migraciones, políticas RLS o `current_user_role()`
- [x] `users.verified` sigue existiendo, intacta y ahora documentada

---

## Resultado (2026-08-27)

Las 5 tareas hechas. Desviaciones respecto al plan:

1. **`lib/admin.ts` también necesitaba el campo.** `admin/doctores.tsx` no usa `ApiUser` sino el
   `Profile` de `lib/admin.ts`, con un `as unknown as Profile[]` de por medio. Lo destapó `tsc`. El
   cast es un olor previo a este cambio y se deja como está (fuera de alcance).
2. **Se borró `verified` del tipo `Profile` local de `consulta/[id].tsx`.** Al quitar el guard quedó
   como campo que nadie lee.
3. **`global-setup` fija ahora `doctors.verified` por médico** (doc2 va sin validar) para que el
   spec E2E tenga los dos estados. Es seguro: `doctors.verified` no gatea nada.

### Verificación

| Comando                      | Resultado                                               |
| ---------------------------- | ------------------------------------------------------- |
| `pytest` (backend)           | ✅ **273 pasan, 0 fallan** (269 de baseline + 4 nuevos) |
| `ruff format` / `ruff check` | ✅ limpio                                               |
| `pnpm exec tsc --noEmit`     | ✅ limpio                                               |
| `pnpm lint`                  | ✅ 0 errores (21 warnings preexistentes)                |
| `pnpm build`                 | ✅ compila                                              |
| `pnpm test:e2e admin-cedula` | ✅ 2/2                                                  |
| `pnpm test:e2e` (completo)   | ⚠️ **5 pasan, 8 fallan**                                |

Los 8 fallos son los **mismos preexistentes** de esta rama base (`admin-especialidad`,
`consulta-cerrada`, `paciente-en-linea`, `panel-atender-video`, `panel-race`, `pool-modal`,
`presence`, `sala-espera`). Baseline de `dev_aws` 3 verdes / 8 rojos → ahora 5 verdes / 8 rojos.

**Sanity checks ejecutados, no asumidos:** los 3 tests de backend se ponen rojos si el router vuelve
a inyectar `users.verified`; los 2 specs E2E se ponen rojos si el badge vuelve a leer `p.verified`.

### Comprobado contra datos reales

`GET /profiles?limit=100` devuelve los tres estados (84 `null`, 10 `true`, 6 `false`) y **ninguna
fila tiene `users.verified` distinto de `true`** — la prueba de que el campo nuevo no puede salir de
la columna vieja. Ejemplo real: _Paula Andrea Beltran Guevara_, `verified: true`,
`doctor_verified: false`.
