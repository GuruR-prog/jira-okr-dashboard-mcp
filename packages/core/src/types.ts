export interface JiraConfig {
  baseUrl: string; // e.g. https://yourteam.atlassian.net
  email: string;
  apiToken: string;
}

export interface JiraClientOptions {
  /** Custom field ID for Story Points — varies per Jira instance/plan. */
  storyPointsField?: string;
  /** Custom field ID for an ETA/target-date field — varies per team. */
  etaField?: string;
}

export interface LatestComment {
  author: string;
  body: string;
  created: string;
}

export interface JiraIssueSummary {
  key: string;
  /** Deep link to the issue in its Jira site. */
  url: string;
  summary: string;
  status: string;
  statusCategory: "todo" | "in-progress" | "done";
  issueType: string;
  assignee: string | null;
  storyPoints: number | null;
  dueDate: string | null;
  eta: string | null;
  labels: string[];
  /** Only populated when the caller asks for it — costs an extra field on the Jira side. */
  latestComment: LatestComment | null;
  updated: string;
}

export interface JiraSearchResult {
  total: number;
  issues: JiraIssueSummary[];
}

export interface OkrProgress {
  jql: string;
  totalIssues: number;
  doneIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  /** Percent complete by issue count. */
  percentByCount: number;
  /**
   * Percent complete by story points, when every returned issue carries
   * points. Falls back to null if any issue is missing an estimate, since a
   * partial-points average is misleading rather than merely imprecise.
   */
  percentByPoints: number | null;
  issues: JiraIssueSummary[];
}

/**
 * One Jira Cloud site + the slice of it a team leader wants surfaced.
 * `apiTokenEnvVar` names an environment variable rather than holding the
 * token directly, so a workspace config file can be shared or even checked
 * in without leaking credentials — see packages/core/src/workspaces.ts.
 */
export interface WorkspaceConfig {
  id: string;
  /** Display name for this workspace, e.g. "Team 1 — Platform". */
  label: string;
  /** Grouping label shown in the UI, e.g. "Team 1". Several workspaces can share a team. */
  team: string;
  baseUrl: string;
  email: string;
  apiTokenEnvVar: string;
  storyPointsField?: string;
  etaField?: string;
  /** JQL scoping which issues from this workspace belong on the dashboard. */
  jql: string;
}

/** A Jira issue, tagged with which workspace/team it came from. */
export interface Ticket extends JiraIssueSummary {
  workspaceId: string;
  team: string;
}

export interface WorkspaceFetchError {
  workspaceId: string;
  label: string;
  message: string;
}

export interface AggregatedTickets {
  tickets: Ticket[];
  errors: WorkspaceFetchError[];
  fetchedAt: string;
}
