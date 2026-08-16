# demo/

Fixture Jira data so you can try this project without a real Jira account —
useful for checking your setup works before pointing it at a real instance,
or just for kicking the tires.

## Try the tools directly (no Anthropic key needed)

```bash
# terminal 1
node demo/mock-jira-server.mjs

# terminal 2
npx tsx demo/try-tools.ts
```

This runs `search_issues`, `get_issue`, and `get_okr_progress` against eight
fixture issues on a mock "Q3 reliability OKR" and prints the raw output —
including the points-vs-count fallback: one run has every issue estimated,
the other strips estimates off two issues so you can see `percentByPoints`
correctly come back `null` instead of a misleading partial average.

## Try the full Claude-driven dashboard

```bash
# terminal 1
node demo/mock-jira-server.mjs

# terminal 2 — needs your own ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY="your-key-here"
export JIRA_BASE_URL="http://localhost:4567"
export JIRA_EMAIL="demo@example.com"
export JIRA_API_TOKEN="unused-by-the-mock-server"
export OKR_JQL='labels = "OKR-Q3-2026-reliability"'
npm run dashboard
```

Watch terminal 2's stderr — it prints every tool call Claude makes before it
writes the report, so you can see it actually investigating the data rather
than templating a response. Swap the `JIRA_*` values for a real instance
and token whenever you're ready to move off fixtures.

`demo/mock-jira-server.mjs` implements exactly one endpoint
(`POST /rest/api/3/search`) with just enough JQL handling to make the fixture
data useful: `key = "XXX"` filters to one issue, `maxResults` truncates, and
any other query returns the full eight-issue set. It's a test fixture, not a
Jira emulator — don't reach for it as a stand-in for the real API's query
language.
