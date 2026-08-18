import { useMemo, useState } from "react";
import type { Incident } from "@jira-dashboard/core";
import { StatusBadge } from "./StatusBadge.js";
import { IncidentDetail } from "./IncidentDetail.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The date portion (YYYY-MM-DD) in the viewer's local time, for comparing against <input type="date"> values. */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function IncidentsView({ incidents, onCallConfigured }: { incidents: Incident[]; onCallConfigured: boolean }) {
  const [tab, setTab] = useState<"high" | "low">("high");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const teams = useMemo(() => uniqueSorted(incidents.map((i) => i.team)), [incidents]);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (selectedTeams.size > 0 && !selectedTeams.has(i.team)) return false;
      const reportedDate = localDateKey(i.created);
      if (dateFrom && reportedDate < dateFrom) return false;
      if (dateTo && reportedDate > dateTo) return false;
      return true;
    });
  }, [incidents, selectedTeams, dateFrom, dateTo]);

  const high = useMemo(() => filtered.filter((i) => i.isHighSeverity), [filtered]);
  const low = useMemo(() => filtered.filter((i) => !i.isHighSeverity), [filtered]);
  const visible = tab === "high" ? high : low;

  const hasActiveFilters = selectedTeams.size > 0 || dateFrom !== "" || dateTo !== "";

  function toggleTeam(team: string) {
    const next = new Set(selectedTeams);
    if (next.has(team)) next.delete(team);
    else next.add(team);
    setSelectedTeams(next);
  }

  function clearFilters() {
    setSelectedTeams(new Set());
    setDateFrom("");
    setDateTo("");
  }

  if (incidents.length === 0) {
    return (
      <div className="empty-state">
        No incidents found. Incidents are regular Jira tickets that have a severity value set — see the "Sprint &
        Kanban" and incident sections of the README for how severityField/highSeverityValues are configured per
        workspace.
      </div>
    );
  }

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-group-title">Team</span>
          <div className="filter-group-chips">
            {teams.map((team) => (
              <button
                type="button"
                key={team}
                className={`chip ${selectedTeams.has(team) ? "chip-active" : ""}`}
                aria-pressed={selectedTeams.has(team)}
                onClick={() => toggleTeam(team)}
              >
                {team}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-group-title">Reported between</span>
          <div className="date-range">
            <input
              type="date"
              className="date-input"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Reported from"
            />
            <span className="date-range-sep">–</span>
            <input
              type="date"
              className="date-input"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Reported to"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <button type="button" className="filter-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="incident-tabs">
        <button type="button" className={`incident-tab ${tab === "high" ? "incident-tab-active" : ""}`} onClick={() => setTab("high")}>
          High severity ({high.length})
        </button>
        <button type="button" className={`incident-tab ${tab === "low" ? "incident-tab-active" : ""}`} onClick={() => setTab("low")}>
          Sev3 & below ({low.length})
        </button>
      </div>

      {!onCallConfigured && (
        <div className="banner banner-warning">
          On-call isn't configured, so incidents below won't show who was on call. See{" "}
          <code>config/oncall.example.json</code>.
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state">
          {hasActiveFilters ? "No incidents match the current filters." : "No incidents in this tab."}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="ticket-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Severity</th>
                <th>Team</th>
                <th>Summary</th>
                <th>Reported</th>
                <th>Status</th>
                <th>Primary on call</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((incident) => (
                <tr key={`${incident.workspaceId}:${incident.key}`}>
                  <td className="cell-key">
                    <a href={incident.url} target="_blank" rel="noreferrer">
                      {incident.key}
                    </a>
                  </td>
                  <td>
                    <span className={`severity-badge ${incident.isHighSeverity ? "severity-high" : "severity-low"}`}>
                      {incident.severity}
                    </span>
                  </td>
                  <td>
                    <span className="pill pill-team">{incident.team}</span>
                  </td>
                  <td className="cell-summary">{incident.summary}</td>
                  <td>{formatDate(incident.created)}</td>
                  <td>
                    <StatusBadge status={incident.status} statusCategory={incident.statusCategory} />
                  </td>
                  <td>{incident.onCall?.primary?.name ?? <span className="muted">Unknown</span>}</td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => setSelected(incident)}>
                      Drill in
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <IncidentDetail incident={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
