---
name: operate-githubstars
description: Operate and diagnose the GitHub Stars service using synchronization, configuration, log, and task-status tools. Use when the user asks to sync Stars, inspect service state, diagnose failures, review configuration, retry operational tasks, or manage saved agent sessions.
---

# Operate GitHub Stars

Prefer read-only diagnostics before mutations. Use the bundled `mcp__plugin_githubstars-agent_githubstars__*` tools.

## Synchronization

1. Call `sync-status` before `sync-manual`.
2. Do not start another sync while one is active.
3. After starting, poll `sync-status` and use `sync-logs` for the final result.
4. Report synced, skipped, and failed counts when available.

## Configuration

1. Use `config-list` to inspect current settings.
2. Never expose secrets or masked values in the response.
3. Summarize proposed changes before `config-save`.
4. Ask for confirmation when a change affects credentials, model routing, storage paths, or other production behavior.

## Logs and failures

1. Use `logs-files` to choose a real log file, then `logs-view` with a bounded line count.
2. Correlate timestamps and task IDs before concluding a root cause.
3. Treat `logs-clear` as destructive and ask for explicit confirmation immediately before calling it.
4. Prefer the task-specific detail and retry tools over creating duplicate work.

## Agent sessions

Use the `agent-sessions-*` tools to list or inspect persisted conversations. Treat session deletion as destructive and confirm the exact session before calling it.

Report what was checked, the observed evidence, the action taken, and the remaining risk or next step.
