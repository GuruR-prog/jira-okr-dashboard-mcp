import type { Incident, OnCallPerson } from "@jira-dashboard/core";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function OnCallPersonRow({ label, person }: { label: string; person: OnCallPerson | null }) {
  return (
    <div className="incident-oncall-row">
      <span className={`oncall-role-tag oncall-role-${label.toLowerCase()}`}>{label}</span>
      {person ? (
        <span>
          {person.name}
          {person.timeZone && <span className="muted"> · {person.timeZone}</span>}
        </span>
      ) : (
        <span className="muted">Unknown</span>
      )}
    </div>
  );
}

export function IncidentDetail({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer drawer-wide" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-title">
              <a href={incident.url} target="_blank" rel="noreferrer">
                {incident.key}
              </a>{" "}
              <span className={`severity-badge ${incident.isHighSeverity ? "severity-high" : "severity-low"}`}>
                {incident.severity}
              </span>
            </div>
            <div className="drawer-subtitle">{incident.summary}</div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="incident-detail-grid">
          <div>
            <span className="incident-detail-label">Team</span>
            <span>{incident.team}</span>
          </div>
          <div>
            <span className="incident-detail-label">Status</span>
            <span>{incident.status}</span>
          </div>
          <div>
            <span className="incident-detail-label">Reported</span>
            <span>{formatDateTime(incident.created)}</span>
          </div>
          <div>
            <span className="incident-detail-label">Assignee</span>
            <span>{incident.assignee ?? "Unassigned"}</span>
          </div>
        </div>

        <div className="incident-oncall-block">
          <span className="incident-detail-label">On call at report time</span>
          {incident.onCall ? (
            <>
              <OnCallPersonRow label="Primary" person={incident.onCall.primary} />
              <OnCallPersonRow label="Secondary" person={incident.onCall.secondary} />
            </>
          ) : (
            <p className="muted">
              No on-call data for this incident — either on-call isn't configured, or there's no schedule history
              for this team that far back.
            </p>
          )}
        </div>

        {incident.latestComment && (
          <div className="drawer-existing-comment">
            <div className="comment-meta">
              Latest comment — {incident.latestComment.author} · {formatDateTime(incident.latestComment.created)}
            </div>
            <div className="comment-body">{incident.latestComment.body}</div>
          </div>
        )}

        <div className="drawer-actions">
          <a className="btn-secondary" href={incident.url} target="_blank" rel="noreferrer">
            Open in Jira
          </a>
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
