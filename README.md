# jira-okr-dashboard-mcp

An MCP server that exposes Jira OKR/epic progress as tools, plus a small CLI
that lets Claude use those tools to write an OKR status report and render it
as a static dashboard.

This is a clean-room, open-source rebuild of an internal tool I built at
work — same idea (AI-generated OKR visibility over Jira via MCP), but every
line here is new code written against my own test Jira instance, with no
proprietary code, data, or credentials involved.

## Why MCP instead of a bespoke Jira integration

The tools in `src/tools/` don't know or care who's calling them. Point
Claude Desktop or Claude Code at `src/server.ts` and you get the same three
tools interactively, ask-a-question style, no dashboard needed. The CLI in
`src/dashboard/generate.ts` is one more MCP client on top of that — useful
when you want a static report to drop in Slack or a wiki page instead of a
chat.

## What it does

- **`search_issues`** — run a JQL query, get back normalized issue summaries
- **`get_issue`** — fetch one issue by key
- **`get_okr_progress`** — run a JQL scoped to one OKR (an epic or a label)
  and compute completion by issue count, and by story points when every
  matched issue is estimated

The dashboard CLI spawns the server, hands Claude those three tools, and
lets it investigate on its own — pull progress, look at specific issues if
something looks off — before writing a short status report. That report
gets wrapped in a static `dashboard.html`.

## Setup

```bash
npm install
cp .env.example .env
# fill in JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
```

Get a Jira API token at
[id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

Story points live in a custom field whose ID varies per Jira instance/plan —
`JIRA_STORY_POINTS_FIELD` defaults to `customfield_10016` (the common Jira
Cloud default). Find yours via `GET /rest/api/3/field` if progress-by-points
comes back `null` for issues you know are estimated.

### Run the MCP server directly (Claude Desktop / Claude Code)

```bash
npm run server
```

Or point an MCP client config at it — see
[`examples/claude_desktop_config.json`](examples/claude_desktop_config.json).

### Generate a static dashboard

```bash
# also needs ANTHROPIC_API_KEY and OKR_JQL in .env
npm run dashboard
```

This spawns the server, connects an MCP client, and runs an agentic loop:
Claude calls tools until it has enough to write the report, then the script
renders `dashboard.html` and exits. Watch stderr to see which tools it
called and why.

## Project layout

```
src/
  server.ts              MCP server entrypoint (stdio transport)
  jira/
    client.ts             Minimal Jira Cloud REST API client (native fetch)
    types.ts
  tools/
    searchIssues.ts
    getIssue.ts
    getOkrProgress.ts
  dashboard/
    generate.ts            CLI: MCP client + Claude tool-use loop
    template.ts            Static HTML report shell
```

## Roadmap

- [ ] Tests around `getOkrProgress`'s points-vs-count logic
- [ ] OAuth 2.0 (3LO) as an alternative to API tokens
- [ ] A `--jql-file` option for tracking a list of OKRs in one run
- [ ] Publish the server as an installable MCP package

## License

MIT — see [LICENSE](LICENSE).
