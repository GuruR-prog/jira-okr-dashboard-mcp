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
  /**
   * Custom field ID for the Sprint field — varies per Jira instance/plan
   * (commonly customfield_10020 on Jira Cloud, but not guaranteed). Omit
   * entirely for boards that don't use Scrum sprints (pure Kanban) — every
   * issue from that workspace will just report `sprint: null`, which the UI
   * renders as "Kanban" rather than a missing value.
   */
  sprintField?: string;
}

export interface LatestComment {
  author: string;
  body: string;
  created: string;
}

/**
 * A Scrum sprint an issue currently belongs to. Kanban boards don't have
 * these at all — `Ticket.sprint` is `null` for issues from a Kanban-only
 * workspace, not an empty/error state.
 */
export interface SprintInfo {
  id: number;
  name: string;
  state: "active" | "future" | "closed";
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
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
  /** null for Kanban boards, or Scrum boards where sprintField isn't configured. */
  sprint: SprintInfo | null;
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
  /** Omit for Kanban-only workspaces — see JiraClientOptions.sprintField. */
  sprintField?: string;
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
  /** One entry per distinct active/future/closed sprint found across all tickets. */
  sprints: SprintProgress[];
  fetchedAt: string;
}

/**
 * Where a sprint stands against its own deadline, and this project's read
 * on whether it'll actually finish. This is a pace heuristic — progress
 * so far vs. time elapsed so far — not a statistical burndown model or a
 * velocity forecast off historical sprints. It's meant to answer "does
 * this look OK at a glance," not to be a precise ETA. See
 * `computeSprintProgress` in sprint-progress.ts for the exact math.
 */
export type SprintProjection =
  | "on-track"
  | "at-risk"
  | "will-miss"
  | "completed"
  | "incomplete"
  | "not-started"
  | "unknown";

export interface SprintProgress {
  sprintId: number;
  sprintName: string;
  /** Team(s) whose tickets landed in this sprint — usually one, but not enforced. */
  teams: string[];
  state: SprintInfo["state"];
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
  totalIssues: number;
  doneIssues: number;
  percentByCount: number;
  percentByPoints: number | null;
  /** Null when the sprint has no end date to measure against. */
  percentTimeElapsed: number | null;
  daysRemaining: number | null;
  projection: SprintProjection;
}
