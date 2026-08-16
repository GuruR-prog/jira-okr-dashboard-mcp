export interface JiraConfig {
  baseUrl: string; // e.g. https://yourteam.atlassian.net
  email: string;
  apiToken: string;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  statusCategory: "todo" | "in-progress" | "done";
  issueType: string;
  assignee: string | null;
  storyPoints: number | null;
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
