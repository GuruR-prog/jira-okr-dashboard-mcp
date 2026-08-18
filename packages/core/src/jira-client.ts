import { adfToPlainText, plainTextToAdf } from "./adf.js";
import type {
  JiraClientOptions,
  JiraConfig,
  JiraIssueSummary,
  JiraSearchResult,
  LatestComment,
  SprintInfo,
} from "./types.js";

const DEFAULT_SEVERITY_FIELD = "priority";

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
    created: string;
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
  private readonly sprintField?: string;
  private readonly severityField: string;

  constructor(config: JiraConfig, options: JiraClientOptions = {}) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authHeader =
      "Basic " + Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    this.storyPointsField = options.storyPointsField;
    this.etaField = options.etaField;
    this.sprintField = options.sprintField;
    this.severityField = options.severityField ?? DEFAULT_SEVERITY_FIELD;
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
    const fields = ["summary", "status", "issuetype", "assignee", "updated", "created", "duedate", "labels", this.severityField];
    if (this.storyPointsField) fields.push(this.storyPointsField);
    if (this.etaField) fields.push(this.etaField);
    if (this.sprintField) fields.push(this.sprintField);
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
    const rawSprint = this.sprintField ? issue.fields[this.sprintField] : undefined;
    const rawSeverity = issue.fields[this.severityField];

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
      created: issue.fields.created,
      sprint: parseSprintField(rawSprint),
      severity: parseSeverity(rawSeverity),
    };
  }
}

/**
 * Severity/priority values come back in a few shapes depending on whether
 * severityField points at Jira's standard Priority field (an object with
 * `.name`) or a custom select-list field (often `.value` instead), or a
 * plain-text custom field (a bare string). All three are supported; an
 * unrecognized shape is left null rather than stringified into something
 * misleading.
 */
function parseSeverity(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.value === "string") return obj.value;
  }
  return null;
}

/**
 * The Sprint custom field's value shape has two forms in the wild:
 *  - modern: an array of sprint objects, e.g.
 *    [{ id, name, state, startDate, endDate, goal }]
 *  - legacy: an array of stringified Java objects, e.g.
 *    ["com.atlassian.greenhopper...Sprint@1[id=37,state=ACTIVE,name=Sprint 12,...]"]
 * Some very old Jira Server/Data Center instances still return the legacy
 * form even over the Cloud-shaped API. An issue can technically list
 * several sprints (moved between them over time) — this picks the active
 * one if there is one, else the most recently added entry, since that's
 * almost always the current sprint a viewer cares about.
 */
function parseSprintField(raw: unknown): SprintInfo | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const parsed = raw
    .map((entry) => (typeof entry === "string" ? parseLegacySprintString(entry) : parseSprintObject(entry)))
    .filter((s): s is SprintInfo => s !== null);

  if (parsed.length === 0) return null;
  return parsed.find((s) => s.state === "active") ?? parsed[parsed.length - 1];
}

function parseSprintObject(entry: unknown): SprintInfo | null {
  if (typeof entry !== "object" || entry === null) return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.id !== "number" && typeof e.id !== "string") return null;
  const state = normalizeSprintState(e.state);
  if (!state) return null;

  return {
    id: Number(e.id),
    name: typeof e.name === "string" ? e.name : `Sprint ${e.id}`,
    state,
    startDate: typeof e.startDate === "string" ? e.startDate : null,
    endDate: typeof e.endDate === "string" ? e.endDate : null,
    goal: typeof e.goal === "string" && e.goal.length > 0 ? e.goal : null,
  };
}

function parseLegacySprintString(raw: string): SprintInfo | null {
  const match = raw.match(/\[(.+)\]$/);
  if (!match) return null;
  const fields = new Map<string, string>();
  for (const pair of match[1].split(",")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    fields.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  const id = fields.get("id");
  const state = normalizeSprintState(fields.get("state"));
  if (!id || !state) return null;

  return {
    id: Number(id),
    name: fields.get("name") ?? `Sprint ${id}`,
    state,
    startDate: normalizeLegacyValue(fields.get("startDate")),
    endDate: normalizeLegacyValue(fields.get("endDate")),
    goal: normalizeLegacyValue(fields.get("goal")),
  };
}

/** Jira's legacy Sprint.toString() format uses the literal string "<null>" for absent fields. */
function normalizeLegacyValue(value: string | undefined): string | null {
  if (!value || value === "<null>") return null;
  return value;
}

function normalizeSprintState(value: unknown): SprintInfo["state"] | null {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  if (s === "active" || s === "future" || s === "closed") return s;
  return null;
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
