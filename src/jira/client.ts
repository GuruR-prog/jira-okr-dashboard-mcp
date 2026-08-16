import type { JiraConfig, JiraIssueSummary, JiraSearchResult } from "./types.js";

/**
 * Minimal Jira Cloud REST API (v3) client — just enough to back the MCP
 * tools in this project. Deliberately dependency-free (native fetch) so the
 * whole server has a small, auditable surface.
 */
export class JiraClient {
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private readonly storyPointsField: string;

  constructor(config: JiraConfig, storyPointsField = "customfield_10016") {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authHeader =
      "Basic " + Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    // Story points live in a custom field whose ID varies per Jira instance.
    // Find yours under a story-points issue's "..." > "View field
    // information", or via GET /rest/api/3/field, and set
    // JIRA_STORY_POINTS_FIELD accordingly.
    this.storyPointsField = storyPointsField;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new Error(`Jira API ${res.status} ${res.statusText} for ${path}: ${body}`);
    }

    return (await res.json()) as T;
  }

  /**
   * Runs a JQL search and normalizes the results into the shape the MCP
   * tools and dashboard generator work with.
   */
  async searchIssues(jql: string, maxResults = 100): Promise<JiraSearchResult> {
    const fields = ["summary", "status", "issuetype", "assignee", "updated", this.storyPointsField];

    const data = await this.request<{
      total: number;
      issues: Array<{
        key: string;
        fields: {
          summary: string;
          status: { name: string; statusCategory: { key: string } };
          issuetype: { name: string };
          assignee: { displayName: string } | null;
          updated: string;
          [field: string]: unknown;
        };
      }>;
    }>("/rest/api/3/search", {
      method: "POST",
      body: JSON.stringify({ jql, maxResults, fields }),
    });

    const issues: JiraIssueSummary[] = data.issues.map((issue) => {
      const rawPoints = issue.fields[this.storyPointsField];
      return {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        statusCategory: normalizeStatusCategory(issue.fields.status.statusCategory.key),
        issueType: issue.fields.issuetype.name,
        assignee: issue.fields.assignee?.displayName ?? null,
        storyPoints: typeof rawPoints === "number" ? rawPoints : null,
        updated: issue.fields.updated,
      };
    });

    return { total: data.total, issues };
  }

  async getIssue(key: string): Promise<JiraIssueSummary> {
    const { issues } = await this.searchIssues(`key = "${key}"`, 1);
    if (!issues[0]) throw new Error(`Issue ${key} not found or not visible to this API token.`);
    return issues[0];
  }
}

function normalizeStatusCategory(categoryKey: string): JiraIssueSummary["statusCategory"] {
  // Jira's own category keys: "new" | "indeterminate" | "done"
  if (categoryKey === "done") return "done";
  if (categoryKey === "indeterminate") return "in-progress";
  return "todo";
}
