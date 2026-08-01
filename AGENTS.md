# Repository Guidelines

`githubstars` is a monorepo for managing GitHub Stars: classification, translation, stats, AI analysis, and batch clone. Built with Turborepo + npm workspaces.

## Project Structure & Module Organization

```
packages/
  backend/       @githubstars/backend       - NestJS 11 + Prisma + MySQL API (sync, category, translate, ai, clone, stats modules)
  frontend/      @githubstars/frontend      - React 19 + Vite 8 + Ant Design 6 + Tailwind CSS 4
  desktop/       @githubstars/desktop       - Electron shell
  cli/           @githubstars/cli           - command-line tool
  shared/        @githubstars/shared        - shared TypeScript types
```

Root config: `turbo.json` (task pipeline), `tsconfig.base.json` (shared TS), `.editorconfig`, `package.json` (workspace scripts).

## Build, Test, and Development Commands

Run from the repo root:

- `npm run dev` - start backend + frontend concurrently (frontend :10001, backend :10002)
- `npm run dev:all` - backend + frontend + agent (:10003)
- `npm run stop` - kill all dev servers on ports 10001/10002/10003
- `npm run build` - `turbo run build` across all packages (outputs `dist/**`, `.next/**`, `out/**`)
- `npm run lint` / `npm run typecheck` - lint and `tsc --noEmit` for all packages
- `npm run test` - run tests across all packages
- `npm run prisma:generate` - regenerate Prisma client (also runs on `postinstall`)

Target a single package with `npm run <script> -w @githubstars/<name>`.

## Coding Style & Naming Conventions

- Indentation: 4 spaces, LF line endings, UTF-8, trim trailing whitespace, final newline (`.editorconfig`). YAML uses 2 spaces; Makefiles use tabs.
- TypeScript: `strict` mode, ES2023 target, `NodeNext` module resolution (`tsconfig.base.json`).
- Each package has its own ESLint 9 flat config (`eslint.config.mjs`/`.js`) integrating Prettier, `sonarjs`, and (frontend) `react-hooks`/`react-refresh`. Run `npm run lint` (auto-fix) and `npm run format` before committing.
- Package scopes follow `@githubstars/<name>`; module folders are lowercase (`category`, `translate`, `ai`).

## Testing Guidelines

Backend uses Jest 30 + ts-jest; e2e uses `supertest`.

- `npm run test:unit` - unit tests matching `test/unit` or `src/**/*.spec.ts`
- `npm run test:e2e` - end-to-end tests via `test/jest-e2e.json`
- `npm run test:cov` - coverage (excludes `main.ts`, `prisma.service.ts`)
- `npm run db:test:setup` - spin up the test MySQL container and apply schema

Name unit tests `*.spec.ts` and place e2e suites under `test/`. New code must ship with accompanying tests.

## Commit & Pull Request Guidelines

Follow Conventional Commits, matching the existing history: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`. An optional scope is allowed, e.g. `fix(export): ...`, `fix(frontend): ...`. Messages may be in English or Chinese; keep the type prefix in English.

- Keep commits focused and atomic.
- PRs must pass `npm run lint`, `npm run typecheck`, and `npm run test`.
- Describe the change, link related issues, and attach screenshots for UI changes.
- Never commit secrets or `.env*` files; use environment variables or `docker-compose` for local config.