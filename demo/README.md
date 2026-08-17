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

# terminal 2 — needs ANTHROPIC_API_KEY in your .env for the Summarize button
MOCK_JIRA_TOKEN=unused \
WORKSPACES_CONFIG_PATH="$(pwd)/demo/workspaces.demo.json" \
npm run web-server

# terminal 3
npm run web-client
```

Open the client (Vite prints the URL, typically http://localhost:5173).
You'll see all 13 fixture tickets across the three teams — filter by team,
label, or sprint, click **Comment** on a ticket to post one (it
round-trips through the mock server's in-memory store), or click
**Summarize & generate report** to see Claude produce a real status
summary over whatever's currently filtered.

Team 1 and Team 2 are on Scrum sprints (Sprint 12 and Sprint 8), deliberately
set up to show one **at-risk** sprint and one **on-track** sprint side by
side in the Sprint Health panel. Team 3 is Kanban — no `sprintField`
configured for it at all — so its tickets correctly show a muted "Kanban"
badge instead of a missing value. Filter by "Kanban only" to see just Team 3.

`demo/workspaces.demo.json` is the workspace config pointing at the three
mock ports — copy its shape for `config/workspaces.json` when you're ready
to point at real Jira sites instead.

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

Two endpoints per port, matching the real Jira Cloud REST API (v3) just
enough for this project's client to work against:

- `POST /rest/api/3/search` — `key = "XXX"` filters to one issue,
  `maxResults` truncates, anything else returns the full fixture set for
  that port
- `POST /rest/api/3/issue/:key/comment` — appends to that issue's
  in-memory comment list (lost on restart)

It's a test fixture, not a JQL engine or a persistent store — don't reach
for it as a stand-in for the real API's query language or durability.
