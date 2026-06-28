# AGENTS.md

Guidance for AI coding agents working in this repository. This file is **not** a replacement for
[CLAUDE.md](CLAUDE.md) — CLAUDE.md remains the authoritative source for architecture, the auth model,
routes, database schema, and security trade-offs. This file adds the operational details an agent
needs before touching code: confirmed tech stack, testing capabilities, SDD (Spec-Driven Development)
setup, and persistence conventions.

> **Sync rule:** CLAUDE.md and AGENTS.md must stay consistent. Any update to the stack, testing
> capabilities, or SDD setup documented here must be reflected in [CLAUDE.md](CLAUDE.md) (and
> vice versa) in the same change.

## Source of truth

Read [CLAUDE.md](CLAUDE.md) first. It documents:

- Auth model (anonymous patients, instant-access doctors, admin revoke, Google OAuth role picker)
- Architecture (Next.js frontend + Supabase BaaS, no separate backend server)
- Routes, database schema, RLS policies, RPCs
- Security trade-offs and mitigations

Do not duplicate that content here or let it drift out of sync — this file only adds what CLAUDE.md
doesn't cover.

## Confirmed tech stack

Verified directly against `package.json` and the repo tree (not assumed):

- **Next.js 14.2** (Pages Router) + **React 18** + **TypeScript 5**
- **Supabase** (`@supabase/supabase-js` v2) — Postgres, Auth, RLS; no separate backend server
- One Vercel serverless API route: `pages/api/videoconsulta.ts` (Twilio v6 + Supabase service-role,
  server-only)
- No CSS framework — plain global CSS classes
- No state-management library, no ORM — raw Supabase JS client + RLS
- `tsconfig.json` present; strictness not yet audited in depth

## Testing capabilities (strict_tdd: false)

**There is still no automated test harness (unit/integration/E2E) in this repo.** Lint and format
ARE now enforced (ESLint + Prettier) — only `test` tooling is missing:

- `package.json` scripts: `dev`, `build`, `start`, `lint`, `format`, `format:check` — no `test` script
- Zero matches for `**/*.test.*` or `**/*.spec.*`
- CI runs lint + build on PRs (`.github/workflows/ci.yml`) but has no test step

| Layer        | Available | Tool / Command                                 |
| ------------ | --------- | ---------------------------------------------- |
| Unit         | ❌        | —                                              |
| Integration  | ❌        | —                                              |
| E2E          | ❌        | —                                              |
| Linter       | ✅        | `pnpm lint` (ESLint, `eslint-config-next`)     |
| Type checker | ✅ manual | `pnpm exec tsc --noEmit` (no dedicated script) |
| Formatter    | ✅        | `pnpm format` / `pnpm format:check` (Prettier) |
| Coverage     | ❌        | —                                              |

**Implication for agents:** verification after a change means `pnpm build`, `pnpm exec tsc --noEmit`,
`pnpm lint`, and manual QA in the browser — there is no automated test suite to run or extend. Most
business logic lives in Postgres RLS/triggers (`supabase_schema.sql`), not application code, so
verification often means reading SQL alongside TypeScript.

**Recommendation (not yet actioned):** add Vitest + React Testing Library and a `test` script before
enabling Strict TDD mode for this project.

## Contribution standards

Conventional Commits are **enforced** (not just documented) via commitlint + husky (`commit-msg`
hook); a `pre-commit` hook runs `lint-staged` (ESLint --fix + Prettier) on staged files. Hooks
install automatically on `pnpm install` via the `prepare` script. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, and
[.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) for the PR format.

## SDD (Spec-Driven Development) setup

This project has been initialized for SDD-based work:

- **Persistence backend:** `engram` (no `openspec/` directory — artifacts live in persistent memory,
  not files)
- **Skill registry:** `.atl/skill-registry.md` (+ cache) — already present and current
- **Strict TDD mode:** disabled (see testing capabilities above)

### Engram topic keys for this project

| Artifact                    | Topic key                                        |
| --------------------------- | ------------------------------------------------ |
| Project/SDD init context    | `sdd-init/medicos-por-venezuela`                 |
| Testing capabilities        | `sdd/medicos-por-venezuela/testing-capabilities` |
| Exploration (per change)    | `sdd/{change-name}/explore`                      |
| Proposal (per change)       | `sdd/{change-name}/proposal`                     |
| Spec (per change)           | `sdd/{change-name}/spec`                         |
| Design (per change)         | `sdd/{change-name}/design`                       |
| Tasks (per change)          | `sdd/{change-name}/tasks`                        |
| Apply progress (per change) | `sdd/{change-name}/apply-progress`               |
| Verify report (per change)  | `sdd/{change-name}/verify-report`                |
| Archive report (per change) | `sdd/{change-name}/archive-report`               |

To recover any artifact: `mem_search(query: "{topic_key}", project: "medicos-por-venezuela")` →
`mem_get_observation(id)` for full content (search results are truncated).

## Operational notes for agents

- This is a thin frontend over Supabase — most "backend" behavior is in
  [supabase_schema.sql](supabase_schema.sql), not TypeScript. Check both when investigating behavior.
- Package manager is **pnpm** — never use `npm` or `yarn` commands in this repo.
- `lint`, `format`, `format:check` scripts exist (ESLint + Prettier) but there is still no `test`
  script — don't assume one and don't invent one without discussing it with the user first.
- Commits are enforced as Conventional Commits via commitlint (husky `commit-msg` hook); a
  pre-commit hook runs `lint-staged` (ESLint --fix + Prettier) on staged files. See
  [CONTRIBUTING.md](CONTRIBUTING.md) for details.
- Build/typecheck/lint are the only automated correctness signals available:
  ```bash
  pnpm build
  pnpm exec tsc --noEmit
  pnpm lint
  ```
