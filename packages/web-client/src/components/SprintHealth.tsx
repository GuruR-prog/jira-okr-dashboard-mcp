import type { SprintProgress, SprintProjection } from "@jira-dashboard/core";

const PROJECTION_LABEL: Record<SprintProjection, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "will-miss": "Will miss deadline",
  completed: "Completed",
  incomplete: "Closed, incomplete",
  "not-started": "Not started",
  unknown: "Unknown",
};

interface SprintHealthProps {
  sprints: SprintProgress[];
}

/**
 * Only active/future sprints get a card — closed ones are historical and
 * don't need a projection front and center (they show up fine in the
 * table's Sprint filter if someone wants to look back).
 */
export function SprintHealth({ sprints }: SprintHealthProps) {
  const relevant = sprints.filter((s) => s.state === "active" || s.state === "future");
  if (relevant.length === 0) return null;

  return (
    <div className="sprint-health">
      <p className="sprint-health-title">Sprint health</p>
      <div className="sprint-health-cards">
        {relevant.map((sprint) => {
          const percentDone = sprint.percentByPoints ?? sprint.percentByCount;
          return (
            <div key={sprint.sprintId} className="sprint-card">
              <div className="sprint-card-top">
                <span className="sprint-card-name">{sprint.sprintName}</span>
                <span className={`sprint-projection sprint-projection-${sprint.projection}`}>
                  {PROJECTION_LABEL[sprint.projection]}
                </span>
              </div>
              <div className="sprint-card-teams">{sprint.teams.join(", ")}</div>
              {sprint.goal && <div className="sprint-card-goal">“{sprint.goal}”</div>}

              {sprint.percentTimeElapsed !== null ? (
                <div className="sprint-progress-bars">
                  <div className="sprint-bar-row">
                    <span className="sprint-bar-label">Done</span>
                    <div className="sprint-bar-track">
                      <div className="sprint-bar-fill" style={{ width: `${Math.min(percentDone, 100)}%` }} />
                    </div>
                    <span className="sprint-bar-value">{percentDone}%</span>
                  </div>
                  <div className="sprint-bar-row">
                    <span className="sprint-bar-label">Time</span>
                    <div className="sprint-bar-track">
                      <div
                        className="sprint-bar-fill sprint-bar-fill-time"
                        style={{ width: `${Math.min(sprint.percentTimeElapsed, 100)}%` }}
                      />
                    </div>
                    <span className="sprint-bar-value">{sprint.percentTimeElapsed}%</span>
                  </div>
                </div>
              ) : (
                <div className="sprint-card-stats">{percentDone}% done ({sprint.doneIssues}/{sprint.totalIssues})</div>
              )}

              <div className="sprint-card-footer">
                {sprint.daysRemaining !== null &&
                  (sprint.daysRemaining >= 0
                    ? `${sprint.daysRemaining} day${sprint.daysRemaining === 1 ? "" : "s"} left`
                    : `${Math.abs(sprint.daysRemaining)} day${Math.abs(sprint.daysRemaining) === 1 ? "" : "s"} overdue`)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
