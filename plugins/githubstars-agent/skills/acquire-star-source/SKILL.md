---
name: acquire-star-source
description: Clone or download source code for repositories in the GitHub Stars library and track the resulting tasks. Use when the user asks to batch clone, download ZIP archives, estimate download size, extract archives, retry failed items, or inspect clone and download progress.
---

# Acquire Star Source

Resolve the repository set and destination before creating a task. Use `mcp__plugin_githubstars-agent_githubstars__*` tools.

## Resolve the scope

1. Use `stars-ids` for a filtered selection, `category-batch-ids` for a category, or `stars-detail` for one repository.
2. Report the repository count and sample names.
3. If the selection is ambiguous or large, ask for confirmation.
4. Use `clone-directories` or `download-directories` to present known destinations when no target directory was supplied.

## Choose clone or download

- Use `clone-create` when Git history or normal Git workflows are required.
- Use `download-create` when archives are sufficient or mirror fallback and automatic extraction are preferred.
- Use `download-estimate-sizes` before a large download when size matters.
- Default to conservative concurrency. Do not exceed the tool schema limits.

## Track and recover

1. Create exactly one task for the confirmed selection.
2. Poll `clone-tasks-detail` or `download-tasks-detail` until completion, partial completion, or failure.
3. Retry failed items once with the matching retry tool when the failure appears transient.
4. Use reset only when the user explicitly requests a full rerun.
5. Treat task deletion and archive deletion as destructive; ask for explicit confirmation immediately before the call.

Report the task ID, destination, completed and failed totals, and concise failure reasons. Do not claim files exist until the task detail reports success.
