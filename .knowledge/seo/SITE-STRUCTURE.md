# Arquitectura de contenido — medicosporvenezuela.org

**Fecha:** 2026-08-28. Estado real del sitio a esta fecha, y a dónde debe ir.

## Lo que existe hoy

```
/                     Home — 11 secciones. ✅ publicada
/quienes-somos        Historia + cofundadoras + equipo. ✅ publicada (2026-08-28)
/registro-paciente    Formulario. Acepta ?especialidad=psicologia
/registro-medico      Formulario (voluntario y médico en Venezuela: MISMA ruta)
/login-medico         Acceso
/mi-caso  /sala-espera  /elegir-rol  /auth/callback   superficies de aplicación
/panel-medico/*  /admin/*                              privadas
```

**El problema, en una frase:** los tres públicos entran por la misma página y salen por el mismo
formulario. No hay ninguna URL que se pueda posicionar para "interconsulta" ni para "voluntariado
médico", porque no existen esas páginas — solo anclas dentro del home (`#como-funciona`) y una ruta
de registro compartida.

## Arquitectura objetivo

```
/                              Home — puerta de entrada, reparte a los tres embudos
│
├── /interconsulta-medica      ★ PILAR — médico en Venezuela
│                                Qué es, cuándo pedirla, cómo funciona la recepción clínica,
│                                qué especialidades hay. CTA → /registro-medico
│
├── /voluntariado-medico       ★ PILAR — médico venezolano en el exterior
│                                Cómo funciona sin turnos fijos, verificación SACS, constancia
│                                de voluntariado. CTA → /registro-medico
│
├── /consulta-gratuita         ★ PILAR — paciente
│                                Qué es, qué NO es (no es urgencias), qué hace falta, qué cuesta.
│                                CTA → /registro-paciente
│
├── /psicologia                ★ PILAR — salud mental
│                                CTA → /registro-paciente?especialidad=psicologia (ya funciona)
│
├── /quienes-somos             ✅ Historia, cofundadoras, equipo
│   └── /especialistas         La rejilla del home merece página propia (10 perfiles reales)
│
├── /preguntas-frecuentes      Respuestas directas. Formato clave para IA generativa
│
├── /blog                      Cadencia baja y sostenible (ver CONTENT-CALENDAR.md)
│   └── /blog/{slug}
│
├── /contacto                  Hoy solo hay correo e Instagram en el pie
└── /legal/privacidad          Obligatorio: se recogen cédula, teléfono y datos clínicos
```

### Por qué estas URLs

- **En español y con la palabra que se busca.** `/interconsulta-medica`, no `/servicios/2`. El
  español es el idioma del público y del contenido.
- **Sin `/servicios/` ni `/paginas/` de por medio.** Un nivel menos es un clic menos y una URL más
  corta; con 12 páginas no hace falta jerarquía.
- **`/especialistas` cuelga de `/quienes-somos`** conceptualmente, pero vive en la raíz: es la página
  con más potencial de enlaces entrantes de todo el sitio (diez profesionales con nombre) y no
  conviene enterrarla.
- **`/consulta-gratuita`, no `/telemedicina`.** La segunda es la palabra del sector; la primera es
  la que escribe un paciente.

## Enlazado interno

La regla: **cada pilar recibe enlace desde el home y desde `/quienes-somos`, y devuelve a su
registro.** Nada de enlaces sueltos.

| Desde                   | Hacia                               | Dónde                                      |
| ----------------------- | ----------------------------------- | ------------------------------------------ |
| Home                    | los 4 pilares                       | Puertas de entrada + tabs de Cómo Funciona |
| Home                    | `/quienes-somos`                    | "Conoce nuestra historia →" ✅ ya existe   |
| Cada pilar              | su registro                         | CTA principal                              |
| Cada pilar              | `/quienes-somos` y `/especialistas` | Prueba de confianza dentro del texto       |
| `/quienes-somos`        | `/especialistas`                    | Cierre de la página                        |
| Artículos de blog       | el pilar del que tratan             | Contextual, dentro del cuerpo              |
| `/preguntas-frecuentes` | el pilar que responde cada pregunta | Por respuesta                              |

**Lo que ya está bien y hay que conservar:** el menú no tiene ni un enlace inerte (Especialistas y
Blog se retiraron el 2026-08-28 justamente porque no llevaban a ninguna parte). Cuando esas páginas
existan, vuelven al menú — **no antes**. Un `href="#"` en la home de una organización médica erosiona
la credibilidad que el propio contenido defiende.

## Reglas de indexación

`robots.txt` y `sitemap.xml` no existen (404 comprobado hoy). Cuando se creen:

| Ruta                                                                                                                | Indexar | Motivo                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `/`, los 4 pilares, `/quienes-somos`, `/especialistas`, `/preguntas-frecuentes`, `/blog/*`, `/contacto`, `/legal/*` | Sí      | Contenido público                                                                           |
| `/registro-paciente`, `/registro-medico`                                                                            | Sí      | Son la conversión; deben poder encontrarse                                                  |
| `/login-medico`                                                                                                     | Sí      | Marca. Sin valor, pero tampoco daña                                                         |
| `/sala-espera`, `/mi-caso`, `/elegir-rol`, `/auth/callback`                                                         | **No**  | Estados de una sesión. Indexarlas ensucia el índice y expone la superficie de la aplicación |
| `/panel-medico/*`                                                                                                   | **No**  | Privada                                                                                     |
| `/admin/*`                                                                                                          | **No**  | Ya lleva `noindex` ✅                                                                       |

Solo las indexables entran en el sitemap. Una URL con `noindex` dentro del sitemap es una
contradicción que Google reporta en Search Console.

## Orden de construcción

1. `/interconsulta-medica` y `/voluntariado-medico` — los dos huecos de mercado.
2. `/especialistas` — el contenido ya existe; es mover y ampliar, no escribir de cero.
3. `/psicologia` y `/consulta-gratuita`.
4. `/preguntas-frecuentes` y `/contacto`.
5. `/blog` cuando haya un médico comprometido a firmar. **No antes**: un blog médico sin autor
   identificable perjudica en un vertical YMYL.
6. `/legal/privacidad` — realmente debería ir la primera, pero es tarea legal, no de contenido.
