---
name: analyze-project-structure
description: Analyze a complete GitHub project's engineering structure using GitHub MCP tools — full directory tree, tech stack, key technical docs and manifest files, and an engineering-completeness assessment. Use when the user asks to analyze, review, or understand the structure, architecture, documentation, or completeness of a specific repository/project.
---

# Analyze Project Structure

Produce an engineering-structure report for a GitHub repository using the bundled `mcp__github__*` tools. Work entirely from public GitHub data — do not clone locally.

## Identify the target

1. Confirm the `owner/repo`. If the user gave a URL or short name, resolve it first with `search_repositories` and state the exact `owner/repo` you will analyze.
2. Call `get_repository` for baseline facts: description, primary language, topics, stars, forks, default branch, license, last push. Use these to frame the report.

## Map the directory structure

`get_file_contents` returns one directory or file per call — there is no recursive tree tool. Expand the tree layer by layer, and be selective on large projects:

1. Read the root directory (path `""` or `/`) on the default branch.
2. Drill into the directories that matter for engineering structure: `src`, `app`, `packages`, `cmd`, `internal`, `server`, `client`, `web`, `docs`, `.github`, `scripts`, `test(s)`, `examples`.
3. Skip noise and generated content: `node_modules`, `dist`, `build`, `out`, `target`, `vendor`, `.git`, coverage, lock-file-only dirs, large test fixtures.
4. Stop at a reasonable depth (2–3 levels) once the architecture is clear; do not enumerate every file. Note explicitly what was collapsed.

## Read the manifest and documentation files

Fetch the files that define the project's tech and completeness. Prioritize:

- **Manifests / build**: `package.json`, `pnpm-workspace.yaml`/`turbo.json`, `pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`, `requirements.txt`/`pyproject.toml`, `Dockerfile*`, `docker-compose*.yml`, `.github/workflows/*`.
- **Docs**: `README*`, `CONTRIBUTING*`, `CHANGELOG*`, `ARCHITECTURE*`, `docs/`, `LICENSE`.
- **Config / quality**: `tsconfig*.json`, `.eslintrc*`/`eslint.config.*`, `.editorconfig`, CI config, `.env.example`.

Extract the tech stack (language, framework, runtime, package manager, key dependencies, build/test tooling) from these files, not from guesses.

## Assess engineering completeness

Score or rate each dimension and back it with the files you actually found:

- **Documentation** — README quality, architecture/dev docs, contribution and license files.
- **Build & tooling** — build scripts, package manager, lint/format/typecheck config.
- **Testing** — presence of test dirs/config, CI that runs tests.
- **CI/CD** — workflows, release/automation pipelines.
- **Structure** — clear layering, modularity, monorepo vs single-package organization.
- **Ops** — Dockerfile/compose, env example, deployment config.

Call out what is **missing or weak** (e.g. no tests, no CI, no license, no env example) with concrete suggestions.

## Produce the report (Markdown, in the conversation)

1. **概览** — owner/repo, description, primary language, stars/forks, default branch, license.
2. **目录结构** — the mapped tree (collapsed where noted).
3. **技术栈** — language, framework, runtime, package manager, key deps, build/test tools.
4. **文档与描述文件** — which docs/manifests exist and what they declare.
5. **工程完整性评估** — per-dimension rating with evidence, gaps, and follow-up suggestions.

Separate observed facts from interpretation. Never fabricate files you did not fetch — if a directory or doc could not be read, say so instead of inventing its contents.
