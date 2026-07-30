---
name: analyze-star-library
description: Analyze the GitHub Stars collection with repository statistics, language and owner distributions, timelines, trends, similar repositories, and exports. Use when the user requests comparisons, summaries, rankings, discovery, collection health analysis, or a report based on Star data.
---

# Analyze Star Library

Use the bundled `mcp__plugin_githubstars-agent_githubstars__*` tools and distinguish local Star data from public GitHub discovery.

## Select the evidence

- Use `stats-overview` for collection totals.
- Use `stats-languages`, `stats-owners`, and `stats-timeline` for distributions and change over time.
- Use `stats-top-starred` and `stats-recent-active` for rankings.
- Use `trending-list` for current trend data.
- Use `authors-list` and `authors-repos` for owner-level analysis.
- Use `similar-find` from a confirmed repository ID for alternatives.
- Use `stars-list` when the analysis needs repository-level filtering.

## Produce the analysis

1. State the scope, filters, and time range.
2. Fetch only the datasets needed for the question.
3. Separate observed values from interpretation.
4. Highlight concentration, outliers, stale repositories, and actionable follow-ups when supported by data.
5. Include repository names or IDs behind important claims.

## Export

Use `export-markdown`, `stars-export`, or `authors-export` only when the user asks for an export. Explain that the backend owns the output location or response format, and report the returned result accurately.

Never fabricate missing historical points or infer causation from aggregate statistics alone.
