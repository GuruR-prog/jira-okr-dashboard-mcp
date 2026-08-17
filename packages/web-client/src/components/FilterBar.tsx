import type { ReactNode } from "react";
import type { Ticket } from "@jira-dashboard/core";

type StatusCategory = Ticket["statusCategory"];

const STATUS_OPTIONS: { value: StatusCategory; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

interface FilterBarProps {
  teams: string[];
  labels: string[];
  sprints: string[];
  selectedTeams: Set<string>;
  selectedLabels: Set<string>;
  selectedStatuses: Set<StatusCategory>;
  selectedSprints: Set<string>;
  overdueOnly: boolean;
  kanbanOnly: boolean;
  onToggleTeam: (team: string) => void;
  onToggleLabel: (label: string) => void;
  onToggleStatus: (status: StatusCategory) => void;
  onToggleSprint: (sprint: string) => void;
  onToggleOverdue: () => void;
  onToggleKanbanOnly: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function FilterBar({
  teams,
  labels,
  sprints,
  selectedTeams,
  selectedLabels,
  selectedStatuses,
  selectedSprints,
  overdueOnly,
  kanbanOnly,
  onToggleTeam,
  onToggleLabel,
  onToggleStatus,
  onToggleSprint,
  onToggleOverdue,
  onToggleKanbanOnly,
  onClear,
  hasActiveFilters,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <FilterGroup title="Team">
        {teams.map((team) => (
          <Chip key={team} active={selectedTeams.has(team)} onClick={() => onToggleTeam(team)}>
            {team}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup title="Project / label">
        {labels.map((label) => (
          <Chip key={label} active={selectedLabels.has(label)} onClick={() => onToggleLabel(label)}>
            {label}
          </Chip>
        ))}
      </FilterGroup>

      {(sprints.length > 0 || kanbanOnly) && (
        <FilterGroup title="Sprint">
          {sprints.map((sprint) => (
            <Chip key={sprint} active={selectedSprints.has(sprint)} onClick={() => onToggleSprint(sprint)}>
              {sprint}
            </Chip>
          ))}
          <Chip active={kanbanOnly} onClick={onToggleKanbanOnly}>
            Kanban only
          </Chip>
        </FilterGroup>
      )}

      <FilterGroup title="Status">
        {STATUS_OPTIONS.map((opt) => (
          <Chip key={opt.value} active={selectedStatuses.has(opt.value)} onClick={() => onToggleStatus(opt.value)}>
            {opt.label}
          </Chip>
        ))}
        <Chip active={overdueOnly} onClick={onToggleOverdue} variant="warning">
          Overdue only
        </Chip>
      </FilterGroup>

      {hasActiveFilters && (
        <button type="button" className="filter-clear" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="filter-group">
      <span className="filter-group-title">{title}</span>
      <div className="filter-group-chips">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  variant,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: "warning";
}) {
  const classes = ["chip", active ? "chip-active" : "", variant === "warning" ? "chip-warning" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}
