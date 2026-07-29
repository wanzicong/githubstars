---
name: localize-star-repositories
description: Translate GitHub Star repository descriptions and README Markdown into Chinese and persist the results in the GitHub Stars database. Use when the user asks to translate, localize, fill missing Chinese fields, or batch-process selected, filtered, or categorized Star repositories.
---

# Localize Star Repositories

Use the GitHub Stars system MCP tools to select repositories, run localization, and report durable database results. The localization tools fetch a README when needed, preserve its original Markdown, translate with the current Agent model configuration, and write `descriptionCn` and `readmeCn`.

## Choose the scope

1. Resolve the target repositories before translating.
   - For one known repository, use `mcp__system__stars_detail` to confirm its numeric ID.
   - For a filtered selection, use `mcp__system__stars_ids`.
   - For a category, use `mcp__system__category_batch_ids`.
2. If the request could affect many repositories and the user did not clearly define the selection, summarize the proposed scope and ask for confirmation.
3. Do not enable `force` unless the user explicitly asks to overwrite or retranslate existing Chinese content.

## Run one repository

Call `mcp__system__localization_run` with:

- `repoId`: the confirmed numeric repository ID.
- `fields`: `description`, `readme`, or `both`.
- `force`: normally `false`.

Report each field as translated, skipped because Chinese already exists, or missing because the source content does not exist.

## Run a batch

1. Call `mcp__system__localization_batch` once with the complete ID list. Prefer a concurrency of `2`; use at most `5`.
2. If no task is created, report that all selected fields were already localized or had no translatable description.
3. When a task is created, call `mcp__system__localization_task_detail` with its `taskId`.
4. For an interactive request, poll until the task reaches `COMPLETED`, `PARTIAL`, or `FAILED`. Do not create duplicate tasks while one is running.
5. If failures are transient, call `mcp__system__localization_task_retry` once, then inspect the task again. Do not loop retries indefinitely.

## Report results

Return:

- repository and field counts;
- translated, skipped, and failed totals;
- failed repository names and concise error reasons;
- the task ID for a batch so the user can inspect it later.

Never claim a translation was saved until the localization tool reports success.
