---
name: localize-star-repositories
description: Translate GitHub Star repository descriptions and README Markdown into Chinese and persist the results. Use when the user asks to translate, localize, fill missing Chinese fields, or batch-process selected, filtered, or categorized Star repositories.
---

# Localize Star Repositories

Use the bundled `mcp__plugin_githubstars-agent_githubstars__*` tools to select repositories, run localization, and report durable database results.

## Choose the scope

1. Use `stars-detail` for one known repository, `stars-ids` for filters, or `category-batch-ids` for a category.
2. If the request could affect many repositories and the selection is not explicit, summarize the scope and ask for confirmation.
3. Do not enable `force` unless the user explicitly asks to overwrite existing Chinese content.

## Run one repository

Call `localization-run` with the confirmed `repoId`, requested `fields`, and normally `force: false`. Report each field as translated, skipped, or unavailable.

## Run a batch

1. Call `localization-batch` once with the complete confirmed ID list. Prefer concurrency `2` and never exceed `5`.
2. If a task is created, poll `localization-task-detail` until `COMPLETED`, `PARTIAL`, or `FAILED`.
3. Do not create duplicate tasks while one is active.
4. Retry transient failures once with `localization-task-retry`, then inspect the task again.

Report repository and field counts, translated/skipped/failed totals, concise failure reasons, and the task ID. Never claim a translation was saved until the tool reports success.
