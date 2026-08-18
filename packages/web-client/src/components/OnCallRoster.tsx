import type { OnCallPerson, OnCallRosterEntry, OnCallShift } from "@jira-dashboard/core";

function tzAbbreviation(timeZone: string | null): string {
  if (!timeZone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

function formatShiftDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PersonLine({ person }: { person: OnCallPerson }) {
  const tz = tzAbbreviation(person.timeZone);
  return (
    <div className="oncall-person">
      <span className="oncall-person-name">{person.name}</span>
      {tz && <span className="oncall-person-tz">{tz}</span>}
    </div>
  );
}

function CurrentShiftRow({ label, shift }: { label: string; shift: OnCallShift | undefined }) {
  return (
    <div className="oncall-role-row">
      <span className={`oncall-role-label oncall-role-${label.toLowerCase()}`}>{label}</span>
      {shift ? <PersonLine person={shift.person} /> : <span className="muted">No coverage</span>}
    </div>
  );
}

function UpcomingList({ shifts }: { shifts: OnCallShift[] }) {
  if (shifts.length === 0) return null;
  return (
    <div className="oncall-upcoming">
      <span className="oncall-upcoming-title">Next up</span>
      <ul>
        {shifts.map((s, i) => (
          <li key={`${s.level}-${s.start}-${i}`}>
            <span className={`oncall-role-tag oncall-role-${s.level}`}>{s.level}</span>
            {s.person.name} · from {formatShiftDate(s.start)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OnCallRoster({ configured, roster }: { configured: boolean; roster: OnCallRosterEntry[] }) {
  if (!configured) {
    return (
      <div className="oncall-panel oncall-panel-unconfigured">
        <p className="oncall-panel-title">On-call</p>
        <p className="muted">
          Not configured. Copy <code>config/oncall.example.json</code> to <code>config/oncall.json</code> and add
          your PagerDuty schedule IDs to see who's on call here.
        </p>
      </div>
    );
  }

  if (roster.length === 0) {
    return null;
  }

  return (
    <div className="oncall-panel">
      <p className="oncall-panel-title">On-call</p>
      <div className="oncall-cards">
        {roster.map((entry) => {
          const primary = entry.current.find((s) => s.level === "primary");
          const secondary = entry.current.find((s) => s.level === "secondary");
          return (
            <div key={entry.scheduleId} className="oncall-card">
              <div className="oncall-card-team">{entry.team}</div>
              <div className="oncall-card-schedule">{entry.scheduleName}</div>
              <CurrentShiftRow label="Primary" shift={primary} />
              <CurrentShiftRow label="Secondary" shift={secondary} />
              <UpcomingList shifts={entry.upcoming} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
