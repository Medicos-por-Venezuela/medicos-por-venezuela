# Cómo subir esto a GitHub sin saber programar

La forma más fácil es con GitHub Desktop.

## Antes de empezar

Necesitas tener permiso de escritura en el repositorio `adavalor/medicos-por-venezuela`. Si solo puedes ver el código pero no cambiarlo, pídele al dueño que te dé acceso como colaborador con permiso de escritura.

## Paso 1 — Instalar GitHub Desktop

Descarga GitHub Desktop desde `desktop.github.com` e inicia sesión con tu cuenta de GitHub.

## Paso 2 — Clonar el repositorio

1. Abre GitHub Desktop.
2. Ve a `File > Clone repository`.
3. Selecciona el repositorio `adavalor/medicos-por-venezuela`.
4. Elige una carpeta en tu computadora.
5. Haz clic en `Clone`.

## Paso 3 — Reemplazar la carpeta

1. Descomprime el ZIP que te dio ChatGPT.
2. Dentro verás una carpeta llamada `medicosve2`.
3. Abre en tu computadora la carpeta del repositorio clonado.
4. Borra o renombra la carpeta vieja `medicosve2`.
5. Copia la nueva carpeta `medicosve2` dentro del repositorio.
6. Copia también `supabase_schema.sql`, `README-PARA-JESUS.md` y `GUIA-SUBIR-A-GITHUB.md` en la raíz del repositorio.

## Paso 4 — Subir los cambios

1. Vuelve a GitHub Desktop.
2. Verás una lista de archivos cambiados.
3. Abajo a la izquierda, en `Summary`, escribe:

   `Add doctor login and admin dashboard`

4. Haz clic en `Commit to main`.
5. Haz clic en `Push origin`.

## Paso 5 — Configurar Supabase

1. Entra a Supabase.
2. Abre tu proyecto.
3. Ve a `SQL Editor`.
4. Copia todo el contenido de `supabase_schema.sql`.
5. Pégalo y ejecútalo.
6. Crea el primer administrador siguiendo `README-PARA-JESUS.md`.

## Paso 6 — Configurar Vercel

1. Entra a Vercel.
2. Abre el proyecto.
3. Asegúrate de que `Root Directory` sea `medicosve2`.
4. Ve a Settings > Environment Variables.
5. Agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Haz redeploy.
