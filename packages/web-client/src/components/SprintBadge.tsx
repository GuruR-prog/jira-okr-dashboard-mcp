import type { SprintInfo } from "@jira-dashboard/core";

export function SprintBadge({ sprint }: { sprint: SprintInfo | null }) {
  if (!sprint) {
    return <span className="pill pill-kanban">Kanban</span>;
  }
  return (
    <span className={`pill pill-sprint pill-sprint-${sprint.state}`}>
      {sprint.name}
    </span>
  );
}
