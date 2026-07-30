---
name: manage-star-library
description: Manage the GitHub Stars library through the bundled MCP tools. Use when the user asks to find, inspect, filter, star or unstar repositories; create or update categories; or bind and unbind repositories from categories.
---

# Manage Star Library

Use the `mcp__plugin_githubstars-agent_githubstars__*` tools as the source of truth. Resolve repository and category IDs before mutations.

## Find repositories

1. Use `stars-list` for local Star data and `stars-detail` for one known ID.
2. Use `github-search` only when the request concerns public GitHub repositories that may not be in the local Star library.
3. Use `stars-ids` for a complete filtered selection and `stars-by-ids` only when full records are needed.
4. Report the applied filters and result count. Do not imply that a paginated response is the complete set.

## Organize categories

1. Read `category-tree` before creating, moving, or deleting categories.
2. Use `category-create` or `category-update` with the resolved parent ID.
3. Use `category-bind` and `category-unbind` only after confirming the exact repository IDs.
4. Treat `category-delete` as destructive. State the category name and ask for explicit confirmation immediately before calling it.

## Change GitHub Star state

1. Use `stars-check-starred` before changing state.
2. Call `stars-star` only when the repository is not already starred.
3. Treat `stars-unstar` as destructive and ask for explicit confirmation immediately before calling it.
4. Verify the final state and report failures without claiming success.

Keep bulk mutations scoped to the user’s explicit selection. If the scope is ambiguous or unexpectedly large, summarize it and ask for confirmation.
