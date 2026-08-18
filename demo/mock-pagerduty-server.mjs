// Fixture PagerDuty server for local testing — implements just the two
// endpoints PagerDutyProvider actually calls:
//   GET /oncalls  — on-call shifts overlapping a since/until window
//   GET /users    — batch user lookup (name, email, time_zone)
//
// Three schedules matching the three demo Jira teams, each with a
// primary/secondary rotation that covers "today" plus a couple of
// upcoming shifts, so both the current roster and the rotation preview —
// and incident-time correlation — have real data to work against.
import http from "node:http";

const USERS = {
  "USR-PRIYA": { id: "USR-PRIYA", name: "Priya N.", email: "priya@example.com", time_zone: "America/Los_Angeles" },
  "USR-WEI": { id: "USR-WEI", name: "Wei L.", email: "wei@example.com", time_zone: "America/New_York" },
  "USR-MARCUS": { id: "USR-MARCUS", name: "Marcus T.", email: "marcus@example.com", time_zone: "America/Denver" },
  "USR-SAM": { id: "USR-SAM", name: "Sam R.", email: "sam@example.com", time_zone: "America/Chicago" },
  "USR-JORDAN": { id: "USR-JORDAN", name: "Jordan K.", email: "jordan@example.com", time_zone: "America/Los_Angeles" },
  "USR-ALEX": { id: "USR-ALEX", name: "Alex F.", email: "alex@example.com", time_zone: "Europe/London" },
  "USR-NINA": { id: "USR-NINA", name: "Nina P.", email: "nina@example.com", time_zone: "Asia/Kolkata" },
};

function shift(scheduleId, scheduleName, level, userId, start, end) {
  return {
    user: { id: userId, summary: USERS[userId].name },
    schedule: { id: scheduleId, summary: scheduleName },
    escalation_level: level,
    start,
    end,
  };
}

const SCHEDULES = {
  PLAT001: {
    name: "Team 1 — Platform Primary Rotation",
    shifts: [
      shift("PLAT001", "Team 1 — Platform Primary Rotation", 1, "USR-PRIYA", "2026-08-11T00:00:00.000Z", "2026-08-18T00:00:00.000Z"),
      shift("PLAT001", "Team 1 — Platform Primary Rotation", 2, "USR-WEI", "2026-08-11T00:00:00.000Z", "2026-08-18T00:00:00.000Z"),
      shift("PLAT001", "Team 1 — Platform Primary Rotation", 1, "USR-MARCUS", "2026-08-18T00:00:00.000Z", "2026-08-25T00:00:00.000Z"),
      shift("PLAT001", "Team 1 — Platform Primary Rotation", 2, "USR-PRIYA", "2026-08-18T00:00:00.000Z", "2026-08-25T00:00:00.000Z"),
      shift("PLAT001", "Team 1 — Platform Primary Rotation", 1, "USR-WEI", "2026-08-25T00:00:00.000Z", "2026-09-01T00:00:00.000Z"),
      shift("PLAT001", "Team 1 — Platform Primary Rotation", 2, "USR-MARCUS", "2026-08-25T00:00:00.000Z", "2026-09-01T00:00:00.000Z"),
    ],
  },
  PAY001: {
    name: "Team 2 — Checkout & Payments Rotation",
    shifts: [
      shift("PAY001", "Team 2 — Checkout & Payments Rotation", 1, "USR-SAM", "2026-08-14T00:00:00.000Z", "2026-08-21T00:00:00.000Z"),
      shift("PAY001", "Team 2 — Checkout & Payments Rotation", 2, "USR-JORDAN", "2026-08-14T00:00:00.000Z", "2026-08-21T00:00:00.000Z"),
      shift("PAY001", "Team 2 — Checkout & Payments Rotation", 1, "USR-JORDAN", "2026-08-21T00:00:00.000Z", "2026-08-28T00:00:00.000Z"),
      shift("PAY001", "Team 2 — Checkout & Payments Rotation", 2, "USR-SAM", "2026-08-21T00:00:00.000Z", "2026-08-28T00:00:00.000Z"),
    ],
  },
  SEC001: {
    name: "Team 3 — Security Rotation",
    shifts: [
      shift("SEC001", "Team 3 — Security Rotation", 1, "USR-ALEX", "2026-08-15T00:00:00.000Z", "2026-08-22T00:00:00.000Z"),
      shift("SEC001", "Team 3 — Security Rotation", 2, "USR-NINA", "2026-08-15T00:00:00.000Z", "2026-08-22T00:00:00.000Z"),
      shift("SEC001", "Team 3 — Security Rotation", 1, "USR-NINA", "2026-08-22T00:00:00.000Z", "2026-08-29T00:00:00.000Z"),
      shift("SEC001", "Team 3 — Security Rotation", 2, "USR-ALEX", "2026-08-22T00:00:00.000Z", "2026-08-29T00:00:00.000Z"),
    ],
  },
};

function overlaps(s, since, until) {
  return new Date(s.start) < until && new Date(s.end) > since;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/oncalls") {
    const scheduleIds = url.searchParams.getAll("schedule_ids[]");
    const since = new Date(url.searchParams.get("since"));
    const until = new Date(url.searchParams.get("until"));
    console.log(`[mock-pagerduty] /oncalls schedules=${scheduleIds.join(",")} since=${since.toISOString()} until=${until.toISOString()}`);

    const oncalls = scheduleIds.flatMap((id) => (SCHEDULES[id]?.shifts ?? []).filter((s) => overlaps(s, since, until)));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ oncalls }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/users") {
    const ids = url.searchParams.getAll("ids[]");
    const users = ids.map((id) => USERS[id]).filter(Boolean);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ users }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

const port = process.env.MOCK_PAGERDUTY_PORT || 4570;
server.listen(port, () => console.log(`[mock-pagerduty] listening on http://localhost:${port}`));
