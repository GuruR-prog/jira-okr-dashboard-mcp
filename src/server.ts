#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JiraClient } from "./jira/client.js";
import { searchIssuesInputSchema, searchIssuesTool } from "./tools/searchIssues.js";
import { getIssueInputSchema, getIssueTool } from "./tools/getIssue.js";
import { getOkrProgressInputSchema, getOkrProgressTool } from "./tools/getOkrProgress.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

const jira = new JiraClient(
  {
    baseUrl: requireEnv("JIRA_BASE_URL"),
    email: requireEnv("JIRA_EMAIL"),
    apiToken: requireEnv("JIRA_API_TOKEN"),
  },
  process.env.JIRA_STORY_POINTS_FIELD,
);

const server = new McpServer({
  name: "jira-okr-dashboard-mcp",
  version: "0.1.0",
});

server.registerTool(
  "search_issues",
  {
    title: "Search Jira issues",
    description: "Run a JQL query against Jira and return normalized issue summaries.",
    inputSchema: searchIssuesInputSchema,
  },
  (args) => searchIssuesTool(jira, args),
);

server.registerTool(
  "get_issue",
  {
    title: "Get one Jira issue",
    description: "Fetch a single Jira issue by key.",
    inputSchema: getIssueInputSchema,
  },
  (args) => getIssueTool(jira, args),
);

server.registerTool(
  "get_okr_progress",
  {
    title: "Compute OKR/epic progress",
    description:
      "Run a JQL query scoped to one OKR (an epic or label) and compute completion by issue " +
      "count and, when every issue is estimated, by story points.",
    inputSchema: getOkrProgressInputSchema,
  },
  (args) => getOkrProgressTool(jira, args),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("jira-okr-dashboard-mcp server running on stdio");
