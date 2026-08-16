// Fixture Jira server for local testing — lets you run the MCP server and
// the dashboard CLI end-to-end without a real Jira instance. Mimics the one
// endpoint the client actually calls: POST /rest/api/3/search. See
// demo/README.md for how to point the rest of the project at this.
import http from "node:http";

const ISSUES = [
  mk("REL-101", "Add multi-region failover for checkout", "Done", "done", "Story", "Priya N.", 8),
  mk("REL-102", "Cut Sev-1 alert noise by tuning thresholds", "Done", "done", "Story", "Marcus T.", 5),
  mk("REL-103", "Chaos test the payment service", "Done", "done", "Story", "Priya N.", 3),
  mk("REL-104", "Migrate on-call runbooks to auto-generated docs", "In Progress", "indeterminate", "Story", "Wei L.", 5),
  mk("REL-105", "Add synthetic canaries for the checkout API", "In Progress", "indeterminate", "Story", "Marcus T.", 8),
  mk("REL-106", "Define SLOs for the fulfillment-routing service", "To Do", "new", "Story", null, 3),
  mk("REL-107", "Reduce cold-start latency on the events consumer", "To Do", "new", "Story", null, 2),
  mk("REL-108", "Post-incident review automation for Sev-1/Sev-2", "Blocked", "indeterminate", "Story", "Wei L.", 5),
];

function mk(key, summary, statusName, categoryKey, issueType, assignee, points) {
  return {
    key,
    fields: {
      summary,
      status: { name: statusName, statusCategory: { key: categoryKey } },
      issuetype: { name: issueType },
      assignee: assignee ? { displayName: assignee } : null,
      updated: "2026-08-10T14:22:00.000Z",
      customfield_10016: points,
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/rest/api/3/search") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { jql, maxResults } = JSON.parse(body || "{}");
    console.log(`[mock-jira] received JQL: ${jql}  (maxResults=${maxResults ?? "none"})`);

    // Simulate real JQL filtering just enough for the demo:
    // - `key = "XXX"` filters to that one issue, like real Jira would
    // - a "no-points-demo" query strips story points off two issues, to
    //   show the tool's points-vs-count fallback behavior for real
    let issues = ISSUES;
    const keyMatch = jql?.match(/key\s*=\s*"([^"]+)"/);
    if (keyMatch) {
      issues = ISSUES.filter((i) => i.key === keyMatch[1]);
    } else if (jql?.includes("no-points-demo")) {
      issues = ISSUES.map((i, idx) => (idx < 2 ? { ...i, fields: { ...i.fields, customfield_10016: null } } : i));
    }
    if (typeof maxResults === "number") issues = issues.slice(0, maxResults);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ total: issues.length, issues }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const port = process.env.MOCK_JIRA_PORT || 4567;
server.listen(port, () => console.log(`[mock-jira] listening on http://localhost:${port}`));
