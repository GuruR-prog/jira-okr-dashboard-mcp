import type { SprintInfo, SprintProgress, SprintProjection, Ticket } from "./types.js";

/** Percentage points a sprint can lag behind its own time-elapsed before flagging "at-risk". */
const AT_RISK_TOLERANCE_PCT = 15;

/**
 * Groups tickets by their current sprint and computes a pace-based
 * projection for each: is progress-so-far keeping up with time-elapsed-so-far.
 * Tickets with no sprint (Kanban, or a Scrum board where sprintField isn't
 * configured) are excluded — there's nothing to project for continuous flow.
 */
export function computeSprintProgress(tickets: Ticket[], now: Date = new Date()): SprintProgress[] {
  const bySprintId = new Map<number, { sprint: SprintInfo; tickets: Ticket[]; teams: Set<string> }>();

  for (const ticket of tickets) {
    if (!ticket.sprint) continue;
    const entry = bySprintId.get(ticket.sprint.id);
    if (entry) {
      entry.tickets.push(ticket);
      entry.teams.add(ticket.team);
    } else {
      bySprintId.set(ticket.sprint.id, { sprint: ticket.sprint, tickets: [ticket], teams: new Set([ticket.team]) });
    }
  }

  return [...bySprintId.values()]
    .map(({ sprint, tickets: sprintTickets, teams }) => buildSprintProgress(sprint, sprintTickets, teams, now))
    .sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""));
}

function buildSprintProgress(sprint: SprintInfo, tickets: Ticket[], teams: Set<string>, now: Date): SprintProgress {
  const doneIssues = tickets.filter((t) => t.statusCategory === "done").length;
  const totalIssues = tickets.length;
  const percentByCount = totalIssues === 0 ? 0 : Math.round((doneIssues / totalIssues) * 100);

  const allHavePoints = tickets.length > 0 && tickets.every((t) => t.storyPoints !== null);
  const totalPoints = allHavePoints ? tickets.reduce((s, t) => s + (t.storyPoints ?? 0), 0) : 0;
  const donePoints = allHavePoints
    ? tickets.filter((t) => t.statusCategory === "done").reduce((s, t) => s + (t.storyPoints ?? 0), 0)
    : 0;
  const percentByPoints = allHavePoints && totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : null;

  const { percentTimeElapsed, daysRemaining } = computeTimeProgress(sprint, now);
  const projection = projectOutcome({ state: sprint.state, percentByCount, percentByPoints, percentTimeElapsed });

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    teams: [...teams].sort(),
    state: sprint.state,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    goal: sprint.goal,
    totalIssues,
    doneIssues,
    percentByCount,
    percentByPoints,
    percentTimeElapsed,
    daysRemaining,
    projection,
  };
}

function computeTimeProgress(
  sprint: SprintInfo,
  now: Date,
): { percentTimeElapsed: number | null; daysRemaining: number | null } {
  if (!sprint.startDate || !sprint.endDate) return { percentTimeElapsed: null, daysRemaining: null };

  const start = new Date(sprint.startDate).getTime();
  const end = new Date(sprint.endDate).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { percentTimeElapsed: null, daysRemaining: null };
  }

  const elapsed = Math.min(Math.max(nowMs - start, 0), end - start);
  const percentTimeElapsed = Math.round((elapsed / (end - start)) * 100);
  const daysRemaining = Math.ceil((end - nowMs) / (1000 * 60 * 60 * 24));

  return { percentTimeElapsed, daysRemaining };
}

function projectOutcome(params: {
  state: SprintInfo["state"];
  percentByCount: number;
  percentByPoints: number | null;
  percentTimeElapsed: number | null;
}): SprintProjection {
  const { state, percentByCount, percentByPoints, percentTimeElapsed } = params;
  // Story points are the better signal when every ticket in the sprint has
  // an estimate — otherwise fall back to raw issue count, same tradeoff as
  // OKR progress elsewhere in this codebase.
  const percentDone = percentByPoints ?? percentByCount;

  if (percentDone >= 100) return "completed";
  if (state === "future") return "not-started";
  if (state === "closed") return "incomplete"; // closed but not fully done -> didn't finish in time
  if (percentTimeElapsed === null) return "unknown"; // active, but no start/end dates to judge pace against

  if (percentTimeElapsed >= 100) return "will-miss"; // past the sprint's own end date, still not done
  if (percentDone + AT_RISK_TOLERANCE_PCT < percentTimeElapsed) return "at-risk";
  return "on-track";
}
