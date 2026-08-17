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

function issue(key, summary, statusName, categoryKey, assignee, points, duedate, labels, comments, eta, sprintObj) {
  return {
    key,
    fields: {
      summary,
      status: { name: statusName, statusCategory: { key: categoryKey } },
      issuetype: { name: "Story" },
      assignee: assignee ? { displayName: assignee } : null,
      updated: "2026-08-14T10:00:00.000Z",
      duedate,
      labels,
      customfield_10016: points,
      customfield_10050: eta ?? null,
      // Real Jira returns an array here (an issue can carry sprint history) —
      // see JiraClient.parseSprintField for why we always send an array.
      customfield_10020: sprintObj ? [sprintObj] : [],
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
      issue("PLAT-201", "Add multi-region failover for checkout", "Done", "done", "Priya N.", 8, "2026-07-15", ["project-ecommerce", "reliability"], [comment("Priya N.", "Failover tested in staging, looks solid.", "2026-08-12T09:00:00.000Z")], "2026-07-20", SPRINT_12),
      issue("PLAT-202", "Migrate on-call runbooks to auto-generated docs", "In Progress", "indeterminate", "Wei L.", 5, "2026-08-25", ["project-ecommerce", "docs"], [comment("Wei L.", "Half the runbooks converted, on track.", "2026-08-13T15:30:00.000Z")], "2026-08-30", SPRINT_12),
      issue("PLAT-203", "Reduce cold-start latency on the events consumer", "To Do", "new", null, 2, null, ["project-ecommerce", "performance"], [], null, SPRINT_12),
      issue("PLAT-204", "Chaos test the payment service", "Blocked", "indeterminate", "Priya N.", 3, "2026-08-10", ["project-ecommerce", "reliability"], [comment("Priya N.", "Blocked on shared staging environment access.", "2026-08-11T11:20:00.000Z")], null, SPRINT_12),
      issue("PLAT-205", "Define SLOs for fulfillment-routing service", "Done", "done", "Marcus T.", 3, "2026-07-01", ["project-ecommerce"], [comment("Marcus T.", "SLOs published, dashboards live.", "2026-07-02T08:00:00.000Z")], "2026-07-05", SPRINT_12),
    ],
  },
  4568: {
    team: "Team 2 — Checkout & Payments",
    issues: [
      issue("PAY-301", "Add idempotency keys to payment capture", "In Progress", "indeterminate", "Sam R.", 8, "2026-08-20", ["project-ecommerce", "payments"], [comment("Sam R.", "Design reviewed, implementation started.", "2026-08-14T13:00:00.000Z")], null, SPRINT_8),
      issue("PAY-302", "Fix double-charge race condition on retry", "Done", "done", "Sam R.", 5, "2026-08-01", ["project-ecommerce", "payments", "bug"], [comment("Sam R.", "Fixed and verified in prod.", "2026-08-02T10:00:00.000Z")], null, SPRINT_8),
      issue("PAY-303", "PCI compliance audit follow-ups", "To Do", "new", null, 5, "2026-09-01", ["project-ecommerce", "payments", "compliance"], [], null, SPRINT_8),
      issue("PAY-304", "Add Apple Pay support", "Blocked", "indeterminate", "Jordan K.", 8, "2026-08-05", ["project-ecommerce", "payments"], [comment("Jordan K.", "Blocked on vendor certificate renewal.", "2026-08-09T16:45:00.000Z")], null, SPRINT_8),
    ],
  },
  4569: {
    // Kanban board — deliberately no sprint data at all, and
    // workspaces.demo.json omits sprintField for this workspace, so these
    // issues report sprint: null end to end, same as a real Kanban team.
    team: "Team 3 — Security Engineering",
    issues: [
      issue("SEC-401", "Rotate all service-to-service credentials", "In Progress", "indeterminate", "Alex F.", 5, "2026-08-22", ["project-security"], [comment("Alex F.", "60% rotated, on schedule.", "2026-08-14T09:10:00.000Z")]),
      issue("SEC-402", "Post-incident review automation for Sev-1/Sev-2", "To Do", "new", null, 5, null, ["project-security", "reliability"], []),
      issue("SEC-403", "Close out pen-test findings from Q2", "Done", "done", "Alex F.", 3, "2026-07-10", ["project-security"], [comment("Alex F.", "All findings remediated and verified.", "2026-07-11T12:00:00.000Z")]),
      issue("SEC-404", "Implement least-privilege IAM review process", "Blocked", "indeterminate", "Nina P.", 8, "2026-07-30", ["project-security"], [comment("Nina P.", "Waiting on IAM team bandwidth.", "2026-07-29T14:00:00.000Z")]),
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
