export interface OnCallPerson {
  id: string;
  name: string;
  email: string | null;
  /** IANA time zone, e.g. "America/Los_Angeles" — from the provider's user profile. */
  timeZone: string | null;
}

/**
 * PagerDuty (and equivalents) express on-call as numbered escalation
 * levels, not literal "primary"/"secondary" labels. Level 1 is primary,
 * level 2 is secondary — everything past that is folded into "other"
 * rather than assumed to mean anything specific, since escalation
 * policies vary a lot past the first two levels.
 */
export type EscalationLevel = "primary" | "secondary" | "other";

export interface OnCallShift {
  level: EscalationLevel;
  person: OnCallPerson;
  start: string;
  end: string;
}

export interface OnCallRosterEntry {
  scheduleId: string;
  scheduleName: string;
  /** Maps to the same team labels used across the rest of the dashboard. */
  team: string;
  /** Who's on call right now, one shift per escalation level. */
  current: OnCallShift[];
  /** The next few shifts per level, for a rotation preview. */
  upcoming: OnCallShift[];
}

/**
 * One on-call schedule a team leader wants tracked, and which dashboard
 * team it maps to. `apiTokenEnvVar` follows the same pattern as Jira
 * workspace config — the token lives in an env var, never in this file.
 */
export interface OnCallScheduleConfig {
  scheduleId: string;
  team: string;
}

export interface OnCallConfig {
  /** Which adapter to use. Only "pagerduty" ships today; the interface is provider-agnostic. */
  provider: "pagerduty";
  apiTokenEnvVar: string;
  schedules: OnCallScheduleConfig[];
}

/**
 * Implemented once per on-call platform (PagerDuty today; VictorOps/
 * Opsgenie are meant to be additional implementations of this same
 * interface, not a rewrite of anything that calls it).
 */
export interface OnCallProvider {
  /** Current + upcoming shifts for the given schedules. */
  getRoster(scheduleIds: string[], options?: { upcomingCount?: number }): Promise<OnCallRosterEntry[]>;
  /** Who was on call for a given schedule at a specific point in time — used to correlate an incident with its responder. */
  getOnCallAt(scheduleId: string, at: Date): Promise<OnCallShift[]>;
}
