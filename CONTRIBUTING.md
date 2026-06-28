# Contributing

Guía de contribución para Médicos por Venezuela. Para entender la arquitectura del proyecto, leé
primero [CLAUDE.md](CLAUDE.md) y [AGENTS.md](AGENTS.md) (este último orientado a agentes de IA, pero
útil para cualquier persona que quiera entender el setup de testing/SDD).

## Entorno local

```bash
cp .env.example .env        # completar las variables (ver CLAUDE.md)
pnpm install                 # instala dependencias y los git hooks (husky)
pnpm dev                     # http://localhost:3000
```

Otros scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm format`, `pnpm format:check`.

## Convención de commits

Este repo usa **[Conventional Commits](https://www.conventionalcommits.org/)**. El formato es:

```
<tipo>(<scope opcional>): <descripción>
```

Tipos más usados: `feat`, `fix`, `docs`, `chore`, `refactor`, `style`, `test`, `perf`, `ci`.

Ejemplos:

```
feat(panel-medico): agregar filtro por especialidad
fix(auth): corregir redirect tras login con Google
docs: actualizar CLAUDE.md con nueva convención de commits
```

**Esto está enforced, no es solo una sugerencia.** Un hook de `commit-msg` (commitlint + husky)
rechaza cualquier commit que no siga el formato. Tanto desarrolladores humanos como agentes de IA
que generen commits en este repo deben usar este formato desde el primer commit — no hay
"período de gracia".

## Estándares de código

ESLint (`eslint-config-next`) y Prettier están configurados para TypeScript/React/Next.js.

- `pnpm lint` — corre ESLint
- `pnpm format` — aplica Prettier sobre todo el repo
- `pnpm format:check` — verifica formato sin modificar archivos (usado en CI)

Un hook de `pre-commit` (husky + lint-staged) corre ESLint `--fix` y Prettier automáticamente sobre
los archivos en stage antes de cada commit — en general no necesitás correr `pnpm lint`/`pnpm format`
manualmente, pero podés hacerlo para revisar todo el repo de una vez.

No hay framework de testing automatizado todavía (ver AGENTS.md) — la verificación de un cambio se
hace con `pnpm build`, `pnpm exec tsc --noEmit`, `pnpm lint` y QA manual en el navegador.

## Pull Requests

Cada PR debe usar la plantilla (`.github/PULL_REQUEST_TEMPLATE.md`), que pide:

- **Título** del PR siguiendo Conventional Commits.
- **Link al ticket de Trello** correspondiente.
- **Descripción** de qué se hizo y por qué.

El CI (`.github/workflows/ci.yml`) corre lint, format check, typecheck y build en cada PR contra
`main`. Un PR no debería mergearse si el CI falla.

## Nota para agentes de IA

Si estás generando commits o PRs en este repositorio: leé este archivo, [CLAUDE.md](CLAUDE.md) y
[AGENTS.md](AGENTS.md) antes de hacerlo. Los commits deben cumplir Conventional Commits (será
rechazado si no), y el código debe pasar `pnpm lint` y `pnpm format:check` (se aplica
automáticamente vía pre-commit, pero confirmá el resultado).
