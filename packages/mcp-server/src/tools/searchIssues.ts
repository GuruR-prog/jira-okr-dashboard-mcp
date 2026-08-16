import { z } from "zod";
import type { JiraClient } from "@jira-dashboard/core";

export const searchIssuesInputSchema = {
  jql: z.string().describe(
    'A Jira Query Language string, e.g. \'labels = "OKR-Q3-2026" ORDER BY updated DESC\'',
  ),
  maxResults: z.number().int().min(1).max(200).optional().describe(
    "Max issues to return (default 100, max 200).",
  ),
};

export async function searchIssuesTool(
  jira: JiraClient,
  args: { jql: string; maxResults?: number },
) {
  const result = await jira.searchIssues(args.jql, args.maxResults ?? 100);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
