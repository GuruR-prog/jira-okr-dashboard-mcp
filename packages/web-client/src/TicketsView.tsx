import { useEffect, useMemo, useState } from "react";
import type { AggregatedTickets, Ticket, WorkspaceFetchError } from "@jira-dashboard/core";
import { fetchTickets } from "./api.js";
import { FilterBar } from "./components/FilterBar.js";
import { TicketTable } from "./components/TicketTable.js";
import { CommentDrawer } from "./components/CommentDrawer.js";
import { SummarizePanel } from "./components/SummarizePanel.js";
import { SprintHealth } from "./components/SprintHealth.js";

type StatusCategory = Ticket["statusCategory"];

export function TicketsView() {
  const [data, setData] = useState<AggregatedTickets | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<Ticket | null>(null);

  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<StatusCategory>>(new Set());
  const [selectedSprints, setSelectedSprints] = useState<Set<string>>(new Set());
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [kanbanOnly, setKanbanOnly] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchTickets();
      setData(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const tickets = data?.tickets ?? [];

  const teams = useMemo(() => uniqueSorted(tickets.map((t) => t.team)), [tickets]);
  const labels = useMemo(() => uniqueSorted(tickets.flatMap((t) => t.labels)), [tickets]);
  const sprintNames = useMemo(
    () => uniqueSorted(tickets.flatMap((t) => (t.sprint ? [t.sprint.name] : []))),
    [tickets],
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (selectedTeams.size > 0 && !selectedTeams.has(t.team)) return false;
      if (selectedLabels.size > 0 && !t.labels.some((l) => selectedLabels.has(l))) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(t.statusCategory)) return false;
      if (selectedSprints.size > 0 && !(t.sprint && selectedSprints.has(t.sprint.name))) return false;
      if (kanbanOnly && t.sprint !== null) return false;
      if (overdueOnly && !(t.statusCategory !== "done" && t.dueDate !== null && t.dueDate < today)) return false;
      return true;
    });
  }, [tickets, selectedTeams, selectedLabels, selectedStatuses, selectedSprints, kanbanOnly, overdueOnly, today]);

  const hasActiveFilters =
    selectedTeams.size > 0 ||
    selectedLabels.size > 0 ||
    selectedStatuses.size > 0 ||
    selectedSprints.size > 0 ||
    kanbanOnly ||
    overdueOnly;

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function clearFilters() {
    setSelectedTeams(new Set());
    setSelectedLabels(new Set());
    setSelectedStatuses(new Set());
    setSelectedSprints(new Set());
    setKanbanOnly(false);
    setOverdueOnly(false);
  }

  return (
    <div>
      <div className="view-toolbar">
        <p className="app-subtitle">
          {tickets.length} ticket{tickets.length === 1 ? "" : "s"} across {teams.length} team
          {teams.length === 1 ? "" : "s"}
          {data && ` · refreshed ${new Date(data.fetchedAt).toLocaleTimeString()}`}
        </p>
        <div className="app-header-actions">
          <SummarizePanel tickets={filteredTickets} />
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loadError && <div className="banner banner-error">Couldn't load tickets: {loadError}</div>}

      {data && data.errors.length > 0 && <WorkspaceErrorBanner errors={data.errors} />}

      {data && data.sprints.length > 0 && <SprintHealth sprints={data.sprints} />}

      {!loading && tickets.length > 0 && (
        <FilterBar
          teams={teams}
          labels={labels}
          sprints={sprintNames}
          selectedTeams={selectedTeams}
          selectedLabels={selectedLabels}
          selectedStatuses={selectedStatuses}
          selectedSprints={selectedSprints}
          overdueOnly={overdueOnly}
          kanbanOnly={kanbanOnly}
          onToggleTeam={(team) => toggle(selectedTeams, team, setSelectedTeams)}
          onToggleLabel={(label) => toggle(selectedLabels, label, setSelectedLabels)}
          onToggleStatus={(status) => toggle(selectedStatuses, status, setSelectedStatuses)}
          onToggleSprint={(sprint) => toggle(selectedSprints, sprint, setSelectedSprints)}
          onToggleOverdue={() => setOverdueOnly((v) => !v)}
          onToggleKanbanOnly={() => setKanbanOnly((v) => !v)}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {loading ? (
        <div className="empty-state">Loading tickets…</div>
      ) : (
        <TicketTable tickets={filteredTickets} onComment={setCommentTarget} />
      )}

      {commentTarget && (
        <CommentDrawer ticket={commentTarget} onClose={() => setCommentTarget(null)} onPosted={load} />
      )}
    </div>
  );
}

function WorkspaceErrorBanner({ errors }: { errors: WorkspaceFetchError[] }) {
  return (
    <div className="banner banner-warning">
      {errors.length} workspace{errors.length === 1 ? "" : "s"} couldn't be reached — showing data from the rest.
      <ul>
        {errors.map((e) => (
          <li key={e.workspaceId}>
            <strong>{e.label}:</strong> {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
