# Calendario de contenido

**Fecha:** 2026-08-28.

## La cadencia, y por qué es baja

**Dos artículos al mes, no ocho.** No es falta de ambición: es un vertical YMYL y cada texto clínico
tiene que ir firmado por un médico de la red, con su credencial y su fecha. Ese médico es voluntario
y su tiempo va a atender pacientes. Un calendario de ocho al mes se incumple en el segundo mes y
deja un blog abandonado, que posiciona peor que no tener blog.

**Regla dura: ningún artículo clínico se publica sin autor médico identificable.** Si no hay quien lo
firme, no se publica. Antes un hueco que un texto médico anónimo.

## Fase 1 — páginas fijas (semanas 1–8)

No son artículos: son las páginas que sostienen los embudos. Van primero.

| Prioridad | Página                  | Público   | Palabras     | Quién puede escribirlo                               |
| --------- | ----------------------- | --------- | ------------ | ---------------------------------------------------- |
| 1         | `/interconsulta-medica` | Médico VE | 800–1.200    | Equipo + revisión de una cofundadora                 |
| 2         | `/voluntariado-medico`  | Diáspora  | 800–1.200    | Equipo                                               |
| 3         | `/especialistas`        | Todos     | 400 + fichas | Ya escrito, hay que moverlo                          |
| 4         | `/psicologia`           | Paciente  | 600–800      | Luis Enrique (lidera psicología)                     |
| 5         | `/consulta-gratuita`    | Paciente  | 600–800      | Equipo                                               |
| 6         | `/preguntas-frecuentes` | Todos     | 800+         | Equipo, con las dudas reales de la recepción clínica |

**Fuente para las FAQ:** las preguntas que ya llegan a la recepción clínica y por Instagram. No hay
que inventarlas — son las que la gente pregunta de verdad, que es exactamente lo que se posiciona y
lo que un buscador generativo cita.

## Fase 2 — blog (a partir de la semana 9)

Dos al mes. Cada uno enlaza a su pilar y lo firma un médico.

| Mes | Artículo                                                             | Pilar         | Firma          |
| --- | -------------------------------------------------------------------- | ------------- | -------------- |
| 1   | Qué es una interconsulta y cuándo pedirla                            | Interconsulta | Médico interno |
| 1   | Cómo verificamos a cada médico de la red (el SACS, explicado)        | Confianza     | Equipo         |
| 2   | Ejercer en Venezuela hoy: lo que un especialista fuera puede aportar | Voluntariado  | Cofundadora    |
| 2   | Salud mental y migración: el duelo del que se queda                  | Psicología    | Luis Enrique   |
| 3   | Cuándo una consulta en línea NO basta: señales de urgencia           | Paciente      | Médico interno |
| 3   | Ser voluntario sin turnos fijos: cómo funciona de verdad             | Voluntariado  | Equipo         |

Los dos primeros no son casuales. "Qué es una interconsulta" ataca el hueco de mercado con la
consulta más obvia del pilar, y "cómo verificamos" convierte el diferencial (SACS) en contenido, que
es lo único que ningún competidor puede copiar sin construir la misma integración.

**"Cuándo una consulta en línea NO basta"** cumple además una función que no es de marketing: la
advertencia de urgencias se retiró del pie el 2026-08-28 por decisión del copy aprobado (anotado en
`tasks/todo.md`). Un artículo dedicado la recupera donde sirve de verdad, con espacio para
explicarla.

## Formato — pensado para que la IA lo cite

Cada artículo, siempre:

- **Respuesta directa en el primer párrafo.** Es el fragmento que un buscador generativo extrae.
- **H2 en forma de pregunta**, tal como la escribe la gente.
- **Un dato propio y concreto** que no esté en ningún otro sitio: cuántas especialidades cubre la
  red, cómo funciona la recepción clínica, cuánto tarda la verificación SACS.
- **Autor con credencial y fecha visibles.** Requisito YMYL, no adorno.
- **Un enlace al pilar** y otro a `/quienes-somos` o `/especialistas`.
- **Sin promesas clínicas.** Orientación, nunca diagnóstico.

## Qué NO publicar

- Contenido clínico genérico ("10 consejos para la hipertensión"). Compite contra Mayo Clinic y se
  pierde, y no aporta nada a ninguno de los tres embudos.
- Nada firmado por "el equipo" si es clínico.
- Casos de pacientes, ni anonimizados, sin consentimiento explícito por escrito.
- Cifras que no salgan del backend. Las de la portada ya vienen del endpoint público y redondeadas
  a la baja; cualquier otra que se escriba a mano envejece y acaba siendo falsa (ya pasó: el copy
  original decía "+3.000 médicos" cuando había ~2.960).
