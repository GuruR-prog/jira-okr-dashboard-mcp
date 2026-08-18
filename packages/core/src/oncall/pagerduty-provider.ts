import type { EscalationLevel, OnCallPerson, OnCallProvider, OnCallRosterEntry, OnCallShift } from "./types.js";

interface RawPagerDutyOnCall {
  user: { id: string; summary: string } | null;
  schedule: { id: string; summary: string } | null;
  escalation_level: number;
  start: string;
  end: string;
}

interface RawPagerDutyUser {
  id: string;
  name: string;
  email: string;
  time_zone: string;
}

const DEFAULT_API_BASE = "https://api.pagerduty.com";

/**
 * PagerDuty REST API v2 client, scoped to exactly what the on-call roster
 * needs — current + upcoming shifts per schedule, and a point-in-time
 * lookup for correlating an incident with who was on call when it was
 * reported. Not a general PagerDuty SDK.
 */
export class PagerDutyProvider implements OnCallProvider {
  private readonly apiBase: string;

  constructor(
    private readonly apiToken: string,
    apiBase: string = DEFAULT_API_BASE,
  ) {
    this.apiBase = apiBase.replace(/\/+$/, "");
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      headers: {
        // PagerDuty's own auth scheme — not Bearer.
        Authorization: `Token token=${this.apiToken}`,
        Accept: "application/vnd.pagerduty+json;version=2",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new Error(`PagerDuty API ${res.status} ${res.statusText} for ${path}: ${body}`);
    }
    return (await res.json()) as T;
  }

  private async fetchOnCalls(scheduleIds: string[], since: Date, until: Date): Promise<RawPagerDutyOnCall[]> {
    const params = new URLSearchParams();
    for (const id of scheduleIds) params.append("schedule_ids[]", id);
    params.set("since", since.toISOString());
    params.set("until", until.toISOString());
    params.set("limit", "100");
    const data = await this.request<{ oncalls: RawPagerDutyOnCall[] }>(`/oncalls?${params.toString()}`);
    return data.oncalls;
  }

  private async fetchUsers(userIds: string[]): Promise<Map<string, RawPagerDutyUser>> {
    if (userIds.length === 0) return new Map();
    const params = new URLSearchParams();
    for (const id of userIds) params.append("ids[]", id);
    const data = await this.request<{ users: RawPagerDutyUser[] }>(`/users?${params.toString()}`);
    return new Map(data.users.map((u) => [u.id, u]));
  }

  async getRoster(scheduleIds: string[], options: { upcomingCount?: number } = {}): Promise<OnCallRosterEntry[]> {
    const upcomingCount = options.upcomingCount ?? 3;
    const now = new Date();
    // Three weeks out is plenty for a rotation preview without dragging in
    // a full quarter's worth of shift history on every request.
    const windowEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();

    const results: OnCallRosterEntry[] = [];

    for (const scheduleId of scheduleIds) {
      const raw = await this.fetchOnCalls([scheduleId], now, windowEnd);
      const userIds = [...new Set(raw.filter((o) => o.user).map((o) => o.user!.id))];
      const users = await this.fetchUsers(userIds);

      const shifts = raw
        .map((o) => toShift(o, users))
        .filter((s): s is OnCallShift => s !== null)
        .sort((a, b) => a.start.localeCompare(b.start));

      const current = shifts.filter((s) => s.start <= nowIso && nowIso < s.end);
      const upcoming = capPerLevel(
        shifts.filter((s) => s.start > nowIso),
        upcomingCount,
      );

      results.push({
        scheduleId,
        scheduleName: raw[0]?.schedule?.summary ?? scheduleId,
        team: "", // filled in by the caller, which owns the schedule-id -> team mapping
        current,
        upcoming,
      });
    }

    return results;
  }

  async getOnCallAt(scheduleId: string, at: Date): Promise<OnCallShift[]> {
    // PagerDuty requires since < until — a narrow one-minute window starting
    // at the target instant is enough to catch whichever shift covers it.
    const windowEnd = new Date(at.getTime() + 60 * 1000);
    const raw = await this.fetchOnCalls([scheduleId], at, windowEnd);
    const userIds = [...new Set(raw.filter((o) => o.user).map((o) => o.user!.id))];
    const users = await this.fetchUsers(userIds);
    return raw.map((o) => toShift(o, users)).filter((s): s is OnCallShift => s !== null);
  }
}

function toShift(raw: RawPagerDutyOnCall, users: Map<string, RawPagerDutyUser>): OnCallShift | null {
  if (!raw.user) return null;
  const user = users.get(raw.user.id);
  const person: OnCallPerson = {
    id: raw.user.id,
    name: user?.name ?? raw.user.summary,
    email: user?.email ?? null,
    timeZone: user?.time_zone ?? null,
  };
  return { level: escalationLevelFrom(raw.escalation_level), person, start: raw.start, end: raw.end };
}

function escalationLevelFrom(level: number): EscalationLevel {
  if (level === 1) return "primary";
  if (level === 2) return "secondary";
  return "other";
}

/** Keeps at most `count` upcoming shifts per escalation level, preserving order. */
function capPerLevel(shifts: OnCallShift[], count: number): OnCallShift[] {
  const seenPerLevel = new Map<EscalationLevel, number>();
  const result: OnCallShift[] = [];
  for (const shift of shifts) {
    const seen = seenPerLevel.get(shift.level) ?? 0;
    if (seen >= count) continue;
    seenPerLevel.set(shift.level, seen + 1);
    result.push(shift);
  }
  return result;
}
