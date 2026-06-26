# Médicos por Venezuela — versión con login médico y dashboard admin

Esta carpeta contiene una versión MVP de la web con:

- Página pública para pacientes.
- Registro de médicos voluntarios.
- Login con email y contraseña para médicos y administradores.
- Panel médico para abrir WhatsApp, cerrar consultas, marcar urgentes y derivar a especialista.
- Dashboard administrativo con conteos de médicos, pacientes, consultas abiertas/cerradas/derivadas y solicitudes de médicos.
- Base de datos Supabase con Row Level Security.

## IMPORTANTE

Esta versión evita almacenar conversaciones completas de WhatsApp. Guarda datos operativos mínimos: paciente, teléfono, zona, tipo de ayuda, estado de la consulta y notas internas breves.

No publiques esto con datos reales sin que alguien técnico/legal revise:

- Texto de privacidad y consentimiento.
- Políticas de Supabase RLS.
- Quién será administrador.
- Cómo verificar médicos.
- Procedimiento para emergencias.

## Estructura

- `medicosve2/` = carpeta que debe reemplazar la carpeta `medicosve2` del repositorio en GitHub.
- `supabase_schema.sql` = script que debes ejecutar en Supabase SQL Editor.

## Rutas principales

- `/` inicio
- `/registro-paciente` solicitud de paciente
- `/sala-espera` confirmación para paciente
- `/registro-medico` solicitud para ser médico voluntario
- `/login-medico` login médico/admin
- `/panel-medico` panel médico
- `/admin/dashboard` panel administrador

## Variables de Vercel

En Vercel debes agregar:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Las sacas de Supabase > Project Settings > API.

## Crear el primer administrador

1. En Supabase, ejecuta `supabase_schema.sql` desde SQL Editor.
2. Ve a Authentication > Users.
3. Crea un usuario con tu email y contraseña.
4. Vuelve a SQL Editor y ejecuta esto, cambiando el email:

```sql
update public.profiles
set role = 'super_admin', verified = true, active = true, full_name = 'Administrador principal'
where email = 'TU_EMAIL@example.com';
```

5. Entra a la web en `/login-medico` con ese email y contraseña.

## Aprobar médicos

En el dashboard admin verás solicitudes de médicos. Para dar acceso real:

1. Revisa/verifica al médico.
2. En Supabase > Authentication > Users, crea un usuario con el email del médico.
3. En SQL Editor, ejecuta:

```sql
update public.profiles
set
  role = 'doctor',
  verified = true,
  active = true,
  full_name = 'NOMBRE DEL MÉDICO',
  specialty = 'Medicina general',
  whatsapp_number = '584121234567'
where email = 'email-del-medico@example.com';
```

4. Dale al médico la contraseña o usa el flujo de invitación de Supabase.

## Seguridad mínima incluida

- Cada médico/admin tiene su propio usuario.
- No hay contraseña compartida.
- Los pacientes no tienen dashboard.
- Los administradores pueden ver métricas y solicitudes.
- Los médicos pueden tomar casos y gestionar estados.
- Row Level Security está activado.

## Limitaciones del MVP

- El dashboard no lee conversaciones de WhatsApp automáticamente.
- El botón abre WhatsApp con un mensaje preparado, pero el médico cierra/deriva manualmente.
- La creación de usuarios médicos se hace desde Supabase Dashboard, no desde la web, para evitar exponer una service role key en el navegador.
