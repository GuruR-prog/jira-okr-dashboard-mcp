import { adfToPlainText, plainTextToAdf } from "./adf.js";
import type {
  JiraClientOptions,
  JiraConfig,
  JiraIssueSummary,
  JiraSearchResult,
  LatestComment,
} from "./types.js";

interface RawJiraComment {
  author?: { displayName?: string };
  body: unknown;
  created: string;
}

interface RawJiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    issuetype: { name: string };
    assignee: { displayName: string } | null;
    updated: string;
    duedate: string | null;
    labels?: string[];
    comment?: { comments: RawJiraComment[] };
    [customField: string]: unknown;
  };
}

/**
 * Minimal Jira Cloud REST API (v3) client — just enough to back the MCP
 * tools and the web dashboard in this project. Deliberately dependency-free
 * (native fetch) so the whole thing has a small, auditable surface.
 */
export class JiraClient {
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private readonly storyPointsField?: string;
  private readonly etaField?: string;

  constructor(config: JiraConfig, options: JiraClientOptions = {}) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authHeader =
      "Basic " + Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    this.storyPointsField = options.storyPointsField;
    this.etaField = options.etaField;
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

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /**
   * Runs a JQL search and normalizes the results into the shape the MCP
   * tools and dashboard work with. Comments are only requested when asked
   * for — they're an extra field Jira has to assemble per issue, and most
   * callers (e.g. progress calculations) don't need them.
   */
  async searchIssues(
    jql: string,
    maxResults = 100,
    options: { includeComments?: boolean } = {},
  ): Promise<JiraSearchResult> {
    const fields = ["summary", "status", "issuetype", "assignee", "updated", "duedate", "labels"];
    if (this.storyPointsField) fields.push(this.storyPointsField);
    if (this.etaField) fields.push(this.etaField);
    if (options.includeComments) fields.push("comment");

    const data = await this.request<{ total: number; issues: RawJiraIssue[] }>(
      "/rest/api/3/search",
      { method: "POST", body: JSON.stringify({ jql, maxResults, fields }) },
    );

    const issues: JiraIssueSummary[] = data.issues.map((issue) => this.normalizeIssue(issue));
    return { total: data.total, issues };
  }

  async getIssue(key: string, options: { includeComments?: boolean } = { includeComments: true }): Promise<JiraIssueSummary> {
    const { issues } = await this.searchIssues(`key = "${key}"`, 1, options);
    if (!issues[0]) throw new Error(`Issue ${key} not found or not visible to this API token.`);
    return issues[0];
  }

  /** Posts a plain-text comment to an issue. Jira Cloud requires the body as ADF, handled internally. */
  async postComment(issueKey: string, bodyText: string): Promise<{ id: string; created: string }> {
    const data = await this.request<{ id: string; created: string }>(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      { method: "POST", body: JSON.stringify({ body: plainTextToAdf(bodyText) }) },
    );
    return { id: data.id, created: data.created };
  }

  /** Deep link to an issue in this workspace's Jira site. */
  issueUrl(key: string): string {
    return `${this.baseUrl}/browse/${key}`;
  }

  private normalizeIssue(issue: RawJiraIssue): JiraIssueSummary {
    const rawPoints = this.storyPointsField ? issue.fields[this.storyPointsField] : undefined;
    const rawEta = this.etaField ? issue.fields[this.etaField] : undefined;

    return {
      key: issue.key,
      url: this.issueUrl(issue.key),
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      statusCategory: normalizeStatusCategory(issue.fields.status.statusCategory.key),
      issueType: issue.fields.issuetype.name,
      assignee: issue.fields.assignee?.displayName ?? null,
      storyPoints: typeof rawPoints === "number" ? rawPoints : null,
      dueDate: issue.fields.duedate ?? null,
      // ETA custom fields vary in type per Jira instance; only string-valued
      // fields (plain text or date custom fields) are supported today —
      // object-typed fields (e.g. a select list) are left null rather than
      // stringified into something misleading. See README roadmap.
      eta: typeof rawEta === "string" ? rawEta : null,
      labels: issue.fields.labels ?? [],
      latestComment: extractLatestComment(issue.fields.comment),
      updated: issue.fields.updated,
    };
  }
}

function extractLatestComment(commentField?: { comments: RawJiraComment[] }): LatestComment | null {
  const comments = commentField?.comments;
  if (!comments || comments.length === 0) return null;
  const last = comments[comments.length - 1];
  return {
    author: last.author?.displayName ?? "Unknown",
    body: adfToPlainText(last.body),
    created: last.created,
  };
}

function normalizeStatusCategory(categoryKey: string): JiraIssueSummary["statusCategory"] {
  // Jira's own category keys: "new" | "indeterminate" | "done"
  if (categoryKey === "done") return "done";
  if (categoryKey === "indeterminate") return "in-progress";
  return "todo";
}
