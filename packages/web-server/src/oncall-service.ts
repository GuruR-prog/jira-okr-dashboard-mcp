import {
  PagerDutyProvider,
  loadOnCallConfig,
  resolveOnCallToken,
  type Incident,
  type IncidentOnCall,
  type OnCallConfig,
  type OnCallProvider,
  type OnCallRosterEntry,
} from "@jira-dashboard/core";

/**
 * Wraps whichever OnCallProvider is configured (PagerDuty today) and owns
 * the schedule-id -> team mapping the provider itself doesn't know about.
 * On-call is an entirely optional feature — see `createOnCallService`,
 * which returns null rather than throwing when nothing's configured, so a
 * dashboard with no PagerDuty setup just runs without this feature instead
 * of failing to start.
 */
export class OnCallService {
  constructor(
    private readonly provider: OnCallProvider,
    private readonly config: OnCallConfig,
  ) {}

  async getRoster(): Promise<OnCallRosterEntry[]> {
    const scheduleIds = this.config.schedules.map((s) => s.scheduleId);
    const entries = await this.provider.getRoster(scheduleIds);
    const teamById = new Map(this.config.schedules.map((s) => [s.scheduleId, s.team]));
    return entries.map((entry) => ({ ...entry, team: teamById.get(entry.scheduleId) ?? entry.scheduleId }));
  }

  /**
   * Looks up who was on call, per level, at each incident's report time —
   * scoped to whichever schedule maps to that incident's team. Incidents
   * from a team with no matching schedule configured just get `onCall: null`
   * rather than an error; so do individual lookups that fail (e.g. the
   * provider has no schedule history that far back), logged but not fatal.
   */
  async enrichWithOnCall(incidents: Array<Omit<Incident, "onCall">>): Promise<Incident[]> {
    const scheduleIdByTeam = new Map(this.config.schedules.map((s) => [s.team, s.scheduleId]));

    return Promise.all(
      incidents.map(async (incident): Promise<Incident> => {
        const scheduleId = scheduleIdByTeam.get(incident.team);
        if (!scheduleId) return { ...incident, onCall: null };

        try {
          const shifts = await this.provider.getOnCallAt(scheduleId, new Date(incident.created));
          const onCall: IncidentOnCall = {
            primary: shifts.find((s) => s.level === "primary")?.person ?? null,
            secondary: shifts.find((s) => s.level === "secondary")?.person ?? null,
          };
          return { ...incident, onCall };
        } catch (err) {
          console.error(`[oncall] Couldn't look up on-call for ${incident.key} at ${incident.created}:`, err);
          return { ...incident, onCall: null };
        }
      }),
    );
  }
}

/** Returns null (not a rejected promise) when on-call isn't configured — this is meant to be an optional feature. */
export function createOnCallService(configPath: string): OnCallService | null {
  let config: OnCallConfig;
  try {
    config = loadOnCallConfig(configPath);
  } catch (err) {
    console.warn(
      `[oncall] Not configured — on-call roster and incident correlation will be unavailable. ` +
        `(${err instanceof Error ? err.message : String(err)})`,
    );
    return null;
  }

  const token = resolveOnCallToken(config);
  // Only ever set for local/demo testing against the fixture server — real
  // usage always hits the actual PagerDuty API (the provider's own default).
  const apiBase = process.env.PAGERDUTY_API_BASE;
  const provider = apiBase ? new PagerDutyProvider(token, apiBase) : new PagerDutyProvider(token);
  return new OnCallService(provider, config);
}
