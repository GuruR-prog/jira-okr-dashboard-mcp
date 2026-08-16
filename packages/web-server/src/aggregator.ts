import {
  JiraClient,
  loadWorkspaces,
  resolveApiToken,
  type AggregatedTickets,
  type Ticket,
  type WorkspaceConfig,
} from "@jira-dashboard/core";

interface WorkspaceEntry {
  config: WorkspaceConfig;
  client: JiraClient;
}

/**
 * Owns one JiraClient per configured workspace and fetches across all of
 * them in parallel. A workspace that's down, misconfigured, or has a bad
 * token doesn't take the rest of the dashboard with it — its failure is
 * captured and returned alongside whatever data did come back, rather than
 * failing the whole request.
 */
export class Aggregator {
  private readonly entries: Map<string, WorkspaceEntry> = new Map();

  constructor(workspaces: WorkspaceConfig[]) {
    for (const config of workspaces) {
      const apiToken = resolveApiToken(config);
      const client = new JiraClient(
        { baseUrl: config.baseUrl, email: config.email, apiToken },
        { storyPointsField: config.storyPointsField, etaField: config.etaField },
      );
      this.entries.set(config.id, { config, client });
    }
  }

  get workspaceSummaries(): Array<Pick<WorkspaceConfig, "id" | "label" | "team">> {
    return [...this.entries.values()].map(({ config }) => ({
      id: config.id,
      label: config.label,
      team: config.team,
    }));
  }

  getWorkspaceClient(workspaceId: string): JiraClient {
    const entry = this.entries.get(workspaceId);
    if (!entry) {
      throw new Error(`Unknown workspace "${workspaceId}". Known: ${[...this.entries.keys()].join(", ")}`);
    }
    return entry.client;
  }

  async fetchAllTickets(): Promise<AggregatedTickets> {
    const entries = [...this.entries.values()];

    const settled = await Promise.allSettled(
      entries.map(async ({ config, client }) => {
        const { issues } = await client.searchIssues(config.jql, 200, { includeComments: true });
        return issues.map((issue): Ticket => ({ ...issue, workspaceId: config.id, team: config.team }));
      }),
    );

    const tickets: Ticket[] = [];
    const errors: AggregatedTickets["errors"] = [];

    settled.forEach((result, index) => {
      const { config } = entries[index];
      if (result.status === "fulfilled") {
        tickets.push(...result.value);
      } else {
        errors.push({
          workspaceId: config.id,
          label: config.label,
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });

    return { tickets, errors, fetchedAt: new Date().toISOString() };
  }
}

export function createAggregator(configPath: string): Aggregator {
  return new Aggregator(loadWorkspaces(configPath));
}
