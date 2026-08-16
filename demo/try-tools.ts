// Exercises the real, shipped JiraClient (../src/jira/client.ts) against
// mock-jira-server.mjs — lets you see the actual tool logic run correctly
// without a live Jira instance or an Anthropic key. Prints raw tool output
// for search_issues / get_issue / get_okr_progress, including the
// points-vs-count fallback behavior.
import { JiraClient } from "../src/jira/client.js";

const jira = new JiraClient({
  baseUrl: `http://localhost:${process.env.MOCK_JIRA_PORT || 4567}`,
  email: "demo@example.com",
  apiToken: "unused-by-the-mock-server",
});

console.log("\n=== search_issues ===");
const search = await jira.searchIssues('labels = "OKR-Q3-2026-reliability"');
console.log(`Found ${search.total} issues:`);
for (const issue of search.issues) {
  console.log(
    `  ${issue.key.padEnd(8)} [${issue.statusCategory.padEnd(11)}] ${issue.storyPoints ?? "?"}pt  ${issue.summary}`,
  );
}

console.log("\n=== get_issue (single) ===");
const one = await jira.getIssue("REL-104");
console.log(one);

console.log("\n=== get_okr_progress (all issues estimated) ===");
{
  const { issues } = await jira.searchIssues('labels = "OKR-Q3-2026-reliability"');
  const done = issues.filter((i) => i.statusCategory === "done").length;
  const allPointed = issues.every((i) => i.storyPoints !== null);
  const totalPts = issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const donePts = issues.filter((i) => i.statusCategory === "done").reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  console.log({
    totalIssues: issues.length,
    doneIssues: done,
    percentByCount: Math.round((done / issues.length) * 100),
    percentByPoints: allPointed ? Math.round((donePts / totalPts) * 100) : null,
  });
}

console.log("\n=== get_okr_progress (two issues missing estimates -> percentByPoints is null) ===");
{
  const { issues } = await jira.searchIssues("no-points-demo");
  const done = issues.filter((i) => i.statusCategory === "done").length;
  const allPointed = issues.every((i) => i.storyPoints !== null);
  console.log({
    totalIssues: issues.length,
    doneIssues: done,
    percentByCount: Math.round((done / issues.length) * 100),
    percentByPoints: allPointed ? "computed" : null,
    note: "2 issues missing story points -> percentByPoints correctly falls back to null instead of a misleading partial average",
  });
}
