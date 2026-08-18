# Contributing

Thanks for taking a look. This is a small, opinionated toolkit, not a
framework — the bar for a PR is "does this make one of the five packages
better," not "does this add a new abstraction."

## Getting set up

```bash
git clone git@github.com:GuruR-prog/jira-okr-dashboard-mcp.git
cd jira-okr-dashboard-mcp
npm install
```

This is an npm-workspaces monorepo — one `npm install` at the root sets up
every package. `npm run typecheck` and `npm run build` at the root run
across all of them.

You don't need a real Jira account or Anthropic key to develop against
this — see [`demo/README.md`](demo/README.md) for the fixture servers that
back the web dashboard, the CLI, and the low-level tools.

## Project layout

| Package | What it is |
|---|---|
| `packages/core` | Shared `JiraClient`, types, workspace config loader, on-call provider interface. Everything else depends on this. |
| `packages/mcp-server` | MCP server exposing Jira tools to any MCP client (Claude Desktop, Claude Code, ...). |
| `packages/dashboard-cli` | One-shot CLI: spawns the MCP server, lets Claude drive it, writes a static `dashboard.html`. |
| `packages/web-server` | Express API aggregating multiple Jira workspaces, on-call roster + incident correlation, `/api/summarize`. |
| `packages/web-client` | React + Vite dashboard UI — tickets tab and on-call/incidents tab. |

If you're adding a feature, it almost certainly belongs in exactly one of
these — resist the urge to reach across packages beyond importing from
`@jira-dashboard/core`.

## Before opening a PR

```bash
npm run typecheck   # must pass with zero errors
npm run build        # must pass — this also catches things typecheck alone can miss (e.g. the web-client's Vite build)
```

CI runs both on every PR. There's no separate lint step yet — keep changes
consistent with the surrounding code's style (see the "conventions" below)
rather than waiting for a linter to catch it.

## Conventions

- **No silent failures.** Every place this codebase talks to an external
  system (Jira, Anthropic) either surfaces the real error or explicitly
  isolates it (see `Aggregator.fetchAllTickets` for the pattern: one
  workspace failing shouldn't blank the whole dashboard, but the failure
  still has to be visible, not swallowed).
- **Validate before you trust external structured data.**
  `packages/core/src/workspaces.ts` rejects a malformed workspace config
  with a specific, actionable error rather than letting a missing field
  surface as a confusing runtime crash three calls later. Apply the same
  standard to anything parsed from Jira's API responses or an LLM's output.
- **Comments explain *why*, not *what*.** If a comment just restates the
  code below it, delete the comment.
- **New Jira fields are opt-in and instance-aware.** Story points, ETA,
  and similar custom fields vary by Jira instance/plan — see how
  `storyPointsField`/`etaField` are threaded through `JiraClient` as
  optional config rather than hardcoded field IDs.

## Reporting issues

Open a GitHub issue. For anything Jira-API-shaped, include which endpoint
and what you expected vs. got — a lot of Jira Cloud's quirks (ADF comment
bodies, custom field IDs, status categories) are exactly the kind of thing
that's easy to get subtly wrong.
