import { z } from "zod";
import type { JiraClient } from "../jira/client.js";
import type { OkrProgress } from "../jira/types.js";

export const getOkrProgressInputSchema = {
  jql: z.string().describe(
    "A JQL string scoped to one OKR/epic, e.g. " +
      '\'"Epic Link" = ENG-1000\' or \'labels = "OKR-Q3-2026-reliability"\'.',
  ),
};

/**
 * Computes completion for a set of issues two ways: by raw issue count, and
 * by story points when every matched issue has an estimate. Count-based
 * progress is what most teams eyeball; points-based progress is what
 * actually reflects effort, so we surface both rather than picking one.
 */
export async function getOkrProgressTool(jira: JiraClient, args: { jql: string }) {
  const { issues } = await jira.searchIssues(args.jql, 200);

  const doneIssues = issues.filter((i) => i.statusCategory === "done").length;
  const inProgressIssues = issues.filter((i) => i.statusCategory === "in-progress").length;
  const todoIssues = issues.filter((i) => i.statusCategory === "todo").length;

  const allHavePoints = issues.length > 0 && issues.every((i) => i.storyPoints !== null);
  const totalPoints = allHavePoints
    ? issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0)
    : 0;
  const donePoints = allHavePoints
    ? issues.filter((i) => i.statusCategory === "done").reduce((sum, i) => sum + (i.storyPoints ?? 0), 0)
    : 0;

  const progress: OkrProgress = {
    jql: args.jql,
    totalIssues: issues.length,
    doneIssues,
    inProgressIssues,
    todoIssues,
    percentByCount: issues.length === 0 ? 0 : Math.round((doneIssues / issues.length) * 100),
    percentByPoints: allHavePoints && totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : null,
    issues,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(progress, null, 2),
      },
    ],
  };
}
