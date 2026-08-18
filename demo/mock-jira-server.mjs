// Fixture Jira servers for local testing — three separate HTTP listeners
// simulating three separate Jira Cloud sites (exactly how real multi-
// workspace setups look: different baseUrl, different data, no shared
// state), so the web dashboard's multi-workspace aggregation can be
// exercised end-to-end without any real Atlassian account.
//
// Implements the two endpoints the client actually calls:
//   POST /rest/api/3/search              (fields/JQL mostly ignored — fixture data, not a JQL engine)
//   POST /rest/api/3/issue/:key/comment  (appends to that issue's in-memory comment list)
//
// See demo/README.md and config/workspaces.example.json for how these map
// to workspace configs.
import http from "node:http";

function adf(text) {
  return { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function comment(author, text, created) {
  return { author: { displayName: author }, body: adf(text), created };
}

function sprint(id, name, state, startDate, endDate, goal) {
  return { id, name, self: `http://localhost/rest/agile/1.0/sprint/${id}`, state, startDate, endDate, goal };
}

/**
 * Builds one fixture Jira issue. Takes an options object rather than a
 * long positional list — this file's fixture count has grown enough
 * (sprints, ETA, severity, ...) that positional params stopped being
 * readable at the call site.
 */
function issue({
  key,
  summary,
  status,
  category,
  assignee = null,
  points = null,
  duedate = null,
  labels = [],
  comments = [],
  eta = null,
  sprint: sprintObj = null,
  severity = null,
  created = "2026-08-01T09:00:00.000Z",
}) {
  return {
    key,
    fields: {
      summary,
      status: { name: status, statusCategory: { key: category } },
      issuetype: { name: severity ? "Incident" : "Story" },
      assignee: assignee ? { displayName: assignee } : null,
      updated: "2026-08-14T10:00:00.000Z",
      created,
      duedate,
      labels,
      customfield_10016: points,
      customfield_10050: eta,
      // Real Jira returns an array here (an issue can carry sprint history) —
      // see JiraClient.parseSprintField for why we always send an array.
      customfield_10020: sprintObj ? [sprintObj] : [],
      priority: severity ? { name: severity } : { name: "Medium" },
      comment: { comments },
    },
  };
}

// Team 1 is mid-sprint and behind pace on purpose — 52% done by points at
// ~86% of the sprint's time elapsed — so the dashboard's "at-risk"
// projection has something real to demonstrate.
const SPRINT_12 = sprint(12, "Sprint 12", "active", "2026-08-04T00:00:00.000Z", "2026-08-18T00:00:00.000Z", "Ship reliability hardening for Q3");

// Team 2's sprint just started — low points-done is expected this early,
// so it should read "on-track" rather than "at-risk".
const SPRINT_8 = sprint(8, "Sprint 8", "active", "2026-08-14T00:00:00.000Z", "2026-08-28T00:00:00.000Z", "Ship Apple Pay + close out PCI follow-ups");

const DATASETS = {
  4567: {
    team: "Team 1 — Platform Engineering",
    issues: [
      issue({ key: "PLAT-201", summary: "Add multi-region failover for checkout", status: "Done", category: "done", assignee: "Priya N.", points: 8, duedate: "2026-07-15", labels: ["project-ecommerce", "reliability"], comments: [comment("Priya N.", "Failover tested in staging, looks solid.", "2026-08-12T09:00:00.000Z")], eta: "2026-07-20", sprint: SPRINT_12 }),
      issue({ key: "PLAT-202", summary: "Migrate on-call runbooks to auto-generated docs", status: "In Progress", category: "indeterminate", assignee: "Wei L.", points: 5, duedate: "2026-08-25", labels: ["project-ecommerce", "docs"], comments: [comment("Wei L.", "Half the runbooks converted, on track.", "2026-08-13T15:30:00.000Z")], eta: "2026-08-30", sprint: SPRINT_12 }),
      issue({ key: "PLAT-203", summary: "Reduce cold-start latency on the events consumer", status: "To Do", category: "new", points: 2, labels: ["project-ecommerce", "performance"], sprint: SPRINT_12 }),
      issue({ key: "PLAT-204", summary: "Chaos test the payment service", status: "Blocked", category: "indeterminate", assignee: "Priya N.", points: 3, duedate: "2026-08-10", labels: ["project-ecommerce", "reliability"], comments: [comment("Priya N.", "Blocked on shared staging environment access.", "2026-08-11T11:20:00.000Z")], sprint: SPRINT_12 }),
      issue({ key: "PLAT-205", summary: "Define SLOs for fulfillment-routing service", status: "Done", category: "done", assignee: "Marcus T.", points: 3, duedate: "2026-07-01", labels: ["project-ecommerce"], comments: [comment("Marcus T.", "SLOs published, dashboards live.", "2026-07-02T08:00:00.000Z")], eta: "2026-07-05", sprint: SPRINT_12 }),
      // Incidents — same workspace/team as the regular backlog above, distinguished by having a severity set at all (see extractIncidents in core).
      issue({ key: "PLAT-501", summary: "Checkout API returning 500s for EU traffic", status: "Done", category: "done", assignee: "Priya N.", labels: ["project-ecommerce", "incident"], comments: [comment("Priya N.", "Rolled back the bad deploy, error rate back to baseline.", "2026-08-13T14:50:00.000Z")], severity: "Sev1", created: "2026-08-13T14:22:00.000Z" }),
      issue({ key: "PLAT-502", summary: "Elevated latency on fulfillment-routing", status: "Done", category: "done", assignee: "Wei L.", labels: ["project-ecommerce", "incident"], comments: [comment("Wei L.", "Traced to a noisy neighbor pod, rescheduled and resolved.", "2026-08-15T03:00:00.000Z")], severity: "Sev3", created: "2026-08-15T02:10:00.000Z" }),
    ],
  },
  4568: {
    team: "Team 2 — Checkout & Payments",
    issues: [
      issue({ key: "PAY-301", summary: "Add idempotency keys to payment capture", status: "In Progress", category: "indeterminate", assignee: "Sam R.", points: 8, duedate: "2026-08-20", labels: ["project-ecommerce", "payments"], comments: [comment("Sam R.", "Design reviewed, implementation started.", "2026-08-14T13:00:00.000Z")], sprint: SPRINT_8 }),
      issue({ key: "PAY-302", summary: "Fix double-charge race condition on retry", status: "Done", category: "done", assignee: "Sam R.", points: 5, duedate: "2026-08-01", labels: ["project-ecommerce", "payments", "bug"], comments: [comment("Sam R.", "Fixed and verified in prod.", "2026-08-02T10:00:00.000Z")], sprint: SPRINT_8 }),
      issue({ key: "PAY-303", summary: "PCI compliance audit follow-ups", status: "To Do", category: "new", points: 5, duedate: "2026-09-01", labels: ["project-ecommerce", "payments", "compliance"], sprint: SPRINT_8 }),
      issue({ key: "PAY-304", summary: "Add Apple Pay support", status: "Blocked", category: "indeterminate", assignee: "Jordan K.", points: 8, duedate: "2026-08-05", labels: ["project-ecommerce", "payments"], comments: [comment("Jordan K.", "Blocked on vendor certificate renewal.", "2026-08-09T16:45:00.000Z")], sprint: SPRINT_8 }),
      issue({ key: "PAY-601", summary: "Duplicate charges detected in EU region", status: "In Progress", category: "indeterminate", assignee: "Sam R.", labels: ["project-ecommerce", "payments", "incident"], comments: [comment("Sam R.", "Root cause narrowed to a retry-storm on the capture endpoint, mitigation in progress.", "2026-08-15T20:40:00.000Z")], severity: "Sev2", created: "2026-08-15T20:00:00.000Z" }),
      issue({ key: "PAY-602", summary: "Minor UI glitch on receipt page", status: "Done", category: "done", assignee: "Jordan K.", labels: ["project-ecommerce", "incident"], comments: [comment("Jordan K.", "CSS fix shipped.", "2026-08-16T01:30:00.000Z")], severity: "Sev3", created: "2026-08-16T01:00:00.000Z" }),
    ],
  },
  4569: {
    // Kanban board — deliberately no sprint data at all, and
    // workspaces.demo.json omits sprintField for this workspace, so these
    // issues report sprint: null end to end, same as a real Kanban team.
    team: "Team 3 — Security Engineering",
    issues: [
      issue({ key: "SEC-401", summary: "Rotate all service-to-service credentials", status: "In Progress", category: "indeterminate", assignee: "Alex F.", points: 5, duedate: "2026-08-22", labels: ["project-security"], comments: [comment("Alex F.", "60% rotated, on schedule.", "2026-08-14T09:10:00.000Z")] }),
      issue({ key: "SEC-402", summary: "Post-incident review automation for Sev-1/Sev-2", status: "To Do", category: "new", points: 5, labels: ["project-security", "reliability"] }),
      issue({ key: "SEC-403", summary: "Close out pen-test findings from Q2", status: "Done", category: "done", assignee: "Alex F.", points: 3, duedate: "2026-07-10", labels: ["project-security"], comments: [comment("Alex F.", "All findings remediated and verified.", "2026-07-11T12:00:00.000Z")] }),
      issue({ key: "SEC-404", summary: "Implement least-privilege IAM review process", status: "Blocked", category: "indeterminate", assignee: "Nina P.", points: 8, duedate: "2026-07-30", labels: ["project-security"], comments: [comment("Nina P.", "Waiting on IAM team bandwidth.", "2026-07-29T14:00:00.000Z")] }),
      issue({ key: "SEC-701", summary: "Suspicious auth spike from single IP range", status: "In Progress", category: "indeterminate", assignee: "Alex F.", labels: ["project-security", "incident"], comments: [comment("Alex F.", "IP range blocked at the WAF, investigating scope.", "2026-08-16T05:50:00.000Z")], severity: "Sev2.5", created: "2026-08-16T05:30:00.000Z" }),
      issue({ key: "SEC-702", summary: "Expired TLS cert on internal service", status: "Done", category: "done", assignee: "Nina P.", labels: ["project-security", "incident"], comments: [comment("Nina P.", "Cert renewed and auto-renewal alerting fixed.", "2026-08-16T08:40:00.000Z")], severity: "Sev1", created: "2026-08-16T08:00:00.000Z" }),
    ],
  },
};

function startServer(port, dataset) {
  const server = http.createServer(async (req, res) => {
    const commentMatch = req.url.match(/^\/rest\/api\/3\/issue\/([^/]+)\/comment$/);

    if (req.method === "POST" && req.url === "/rest/api/3/search") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { jql, maxResults } = JSON.parse(body || "{}");
      console.log(`[mock-jira:${port}] search — JQL: ${jql}  (maxResults=${maxResults ?? "none"})`);

      let issues = dataset.issues;
      const keyMatch = jql?.match(/key\s*=\s*"([^"]+)"/);
      if (keyMatch) issues = dataset.issues.filter((i) => i.key === keyMatch[1]);
      if (typeof maxResults === "number") issues = issues.slice(0, maxResults);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: issues.length, issues }));
      return;
    }

    if (req.method === "POST" && commentMatch) {
      const key = decodeURIComponent(commentMatch[1]);
      const target = dataset.issues.find((i) => i.key === key);
      if (!target) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unknown issue ${key}` }));
        return;
      }
      let body = "";
      for await (const chunk of req) body += chunk;
      const { body: adfBody } = JSON.parse(body || "{}");
      const created = new Date().toISOString();
      const newComment = { author: { displayName: "You (demo)" }, body: adfBody, created };
      target.fields.comment.comments.push(newComment);
      console.log(`[mock-jira:${port}] comment posted on ${key}`);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: String(target.fields.comment.comments.length), created }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => console.log(`[mock-jira:${port}] ${dataset.team} — listening on http://localhost:${port}`));
  return server;
}

for (const [port, dataset] of Object.entries(DATASETS)) {
  startServer(Number(port), dataset);
}
