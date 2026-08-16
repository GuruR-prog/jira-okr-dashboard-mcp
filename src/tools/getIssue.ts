import { z } from "zod";
import type { JiraClient } from "../jira/client.js";

export const getIssueInputSchema = {
  key: z.string().describe('A Jira issue key, e.g. "ENG-1234".'),
};

export async function getIssueTool(jira: JiraClient, args: { key: string }) {
  const issue = await jira.getIssue(args.key);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(issue, null, 2),
      },
    ],
  };
}
