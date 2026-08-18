import type { OnCallPerson } from "./oncall/types.js";

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
  /**
   * Field carrying an incident's severity — defaults to Jira's standard
   * `priority` field if unset, since many orgs repurpose Priority for
   * incident severity rather than adding a dedicated custom field. Set to
   * a custom field ID if your org tracks severity separately.
   */
  severityField?: string;
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
  /** When the issue was originally reported — used to correlate incidents with who was on call at the time. */
  created: string;
  /** null for Kanban boards, or Scrum boards where sprintField isn't configured. */
  sprint: SprintInfo | null;
  /** Raw severity value (e.g. "Sev1", "P2") — null unless severityField (or the default Priority field) has a value. */
  severity: string | null;
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
  /** See JiraClientOptions.severityField — defaults to Jira's Priority field if unset. */
  severityField?: string;
  /**
   * The full set of severity values that mean "this ticket is an
   * incident" — e.g. ["Sev1", "Sev2", "Sev2.5", "Sev3"]. This is required
   * for incident detection to do anything: Jira's Priority field (the
   * default severityField) is set on nearly every ticket regardless of
   * type, so "severity is non-null" alone would misclassify ordinary
   * work items as incidents. Leave unset and this workspace contributes
   * no incidents at all, rather than guessing wrong.
   */
  severityValues?: string[];
  /**
   * Which of severityValues count as "high" — e.g. ["Sev1", "Sev2", "Sev2.5"].
   * Drives which incidents surface on the main incidents view vs. the
   * lower-severity tab.
   */
  highSeverityValues?: string[];
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

/** Who was on call, per escalation level, at the moment an incident was reported — null levels mean no coverage found for that level. */
export interface IncidentOnCall {
  primary: OnCallPerson | null;
  secondary: OnCallPerson | null;
}

/**
 * A Jira ticket that represents an incident — same shape as any other
 * ticket, plus a non-null severity and (when on-call config + schedule
 * history allow it) who was on call for it at report time. Incidents
 * aren't a separate system: they're regular tickets from a workspace that
 * has severityField configured, filtered down to the ones that have a
 * severity value set.
 */
export interface Incident extends Ticket {
  severity: string;
  isHighSeverity: boolean;
  /** Null when there's no on-call config, or the provider has no schedule history that far back. */
  onCall: IncidentOnCall | null;
}
