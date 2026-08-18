# demo/

Fixture Jira data so you can try this project without a real Jira account.
`mock-jira-server.mjs` runs **three separate HTTP servers** (ports 4567,
4568, 4569) simulating three separate Jira Cloud sites — Platform
Engineering, Checkout & Payments, and Security Engineering — exactly how a
real multi-workspace setup looks: different origins, different data, no
shared state.

```bash
node demo/mock-jira-server.mjs
```

## Try the web dashboard (the full experience)

```bash
# terminal 1
node demo/mock-jira-server.mjs

# terminal 2
node demo/mock-pagerduty-server.mjs

# terminal 3 — needs ANTHROPIC_API_KEY in your .env for the Summarize button
MOCK_JIRA_TOKEN=unused \
MOCK_PAGERDUTY_TOKEN=unused \
PAGERDUTY_API_BASE=http://localhost:4570 \
WORKSPACES_CONFIG_PATH="$(pwd)/demo/workspaces.demo.json" \
ONCALL_CONFIG_PATH="$(pwd)/demo/oncall.demo.json" \
npm run web-server

# terminal 4
npm run web-client
```

Open the client (Vite prints the URL, typically http://localhost:5173).
You'll see all 13 regular tickets plus 6 incidents across the three teams
— filter by team, label, or sprint, click **Comment** on a ticket to post
one (it round-trips through the mock server's in-memory store), or click
**Summarize & generate report** to see Claude produce a real status
summary over whatever's currently filtered.

Team 1 and Team 2 are on Scrum sprints (Sprint 12 and Sprint 8), deliberately
set up to show one **at-risk** sprint and one **on-track** sprint side by
side in the Sprint Health panel. Team 3 is Kanban — no `sprintField`
configured for it at all — so its tickets correctly show a muted "Kanban"
badge instead of a missing value. Filter by "Kanban only" to see just Team 3.

Switch to the **On-Call & Incidents** tab to see the roster (Primary/
Secondary per team with timezone, plus a rotation preview) and the 6
fixture incidents split across "High severity" and "Sev3 & below" tabs.
Each incident's report timestamp is timed to land inside a specific
on-call shift, so drilling into one shows real primary/secondary
correlation — not just whoever's on call right now.

`demo/workspaces.demo.json` / `demo/oncall.demo.json` are the configs
pointing at the fixture servers — copy their shapes for
`config/workspaces.json` / `config/oncall.json` when you're ready to
point at a real Jira + PagerDuty setup instead.

## Try the setup wizard against the mock server

`scripts/setup-jira.mjs` (`npm run setup:jira`) works against the mock
Jira server too — it implements the same three endpoints (`/myself`,
`/project/search`, `/field`) the wizard uses against a real site, so you
can see the whole flow (connection test, project picker, auto-detected
Story Points/Sprint/ETA fields) without touching a real Jira account:

```bash
# terminal 1
node demo/mock-jira-server.mjs

# terminal 2
npm run setup:jira
# Jira base URL: http://localhost:4567
# email: demo@example.com
# API token: anything (the mock doesn't check it)
```

Point it at `:4568` or `:4569` for the other two teams. It'll append to
`config/workspaces.json` (not the demo config) — remove the entry
afterward if you were just trying it out.

## Try the low-level tools directly (no Anthropic key needed)

```bash
# terminal 1
node demo/mock-jira-server.mjs

# terminal 2
npx tsx demo/try-tools.ts
```

Exercises `search_issues`, `get_issue`, and `get_okr_progress` against the
Team 1 fixture data and prints the raw output — including the
points-vs-count fallback: one run has every issue estimated, the other
strips estimates off two issues so you can see `percentByPoints` correctly
come back `null` instead of a misleading partial average.

## Try the full Claude-driven CLI dashboard (packages/dashboard-cli)

```bash
# terminal 1
node demo/mock-jira-server.mjs

# terminal 2 — needs your own ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY="your-key-here"
export JIRA_BASE_URL="http://localhost:4567"
export JIRA_EMAIL="demo@example.com"
export JIRA_API_TOKEN="unused-by-the-mock-server"
export OKR_JQL='labels = "project-ecommerce"'
npm run dashboard
```

Watch terminal 2's stderr — it prints every tool call Claude makes before
it writes the report, so you can see it actually investigating the data
rather than templating a response.

## What the mock server implements

Five endpoints per port, matching the real Jira Cloud REST API (v3) just
enough for this project's client and setup wizard to work against:

- `POST /rest/api/3/search` — `key = "XXX"` filters to one issue,
  `maxResults` truncates, anything else returns the full fixture set for
  that port
- `POST /rest/api/3/issue/:key/comment` — appends to that issue's
  in-memory comment list (lost on restart)
- `GET /rest/api/3/myself`, `/rest/api/3/project/search`, `/rest/api/3/field`
  — used by `scripts/setup-jira.mjs`, not the dashboard itself; see "Try
  the setup wizard" above

It's a test fixture, not a JQL engine or a persistent store — don't reach
for it as a stand-in for the real API's query language or durability.

`mock-pagerduty-server.mjs` implements the two endpoints
`PagerDutyProvider` actually calls, on port 4570:

- `GET /oncalls` — on-call shifts overlapping a `since`/`until` window,
  respecting the interval overlap correctly (this is what makes
  point-in-time incident correlation work, not just "current on-call")
- `GET /users` — batch lookup for name/email/time zone

Three schedules (`PLAT001`, `PAY001`, `SEC001`) map 1:1 to the three demo
Jira teams, each with a primary/secondary rotation.
