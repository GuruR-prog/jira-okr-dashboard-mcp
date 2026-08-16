import type { Ticket } from "@jira-dashboard/core";
import { StatusBadge } from "./StatusBadge.js";

const today = () => new Date().toISOString().slice(0, 10);

function isOverdue(ticket: Ticket): boolean {
  return ticket.statusCategory !== "done" && ticket.dueDate !== null && ticket.dueDate < today();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface TicketTableProps {
  tickets: Ticket[];
  onComment: (ticket: Ticket) => void;
}

export function TicketTable({ tickets, onComment }: TicketTableProps) {
  if (tickets.length === 0) {
    return <div className="empty-state">No tickets match the current filters.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="ticket-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Team</th>
            <th>Summary</th>
            <th>Assignee</th>
            <th>Due</th>
            <th>ETA</th>
            <th>Status</th>
            <th>Latest comment</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={`${ticket.workspaceId}:${ticket.key}`} className={isOverdue(ticket) ? "row-overdue" : ""}>
              <td className="cell-key">
                <a href={ticket.url} target="_blank" rel="noreferrer">
                  {ticket.key}
                </a>
              </td>
              <td>
                <span className="pill pill-team">{ticket.team}</span>
                <div className="pill-row">
                  {ticket.labels.map((label) => (
                    <span key={label} className="pill pill-label">
                      {label}
                    </span>
                  ))}
                </div>
              </td>
              <td className="cell-summary">{ticket.summary}</td>
              <td>{ticket.assignee ?? <span className="muted">Unassigned</span>}</td>
              <td className={isOverdue(ticket) ? "cell-overdue" : ""}>{formatDate(ticket.dueDate)}</td>
              <td>{formatDate(ticket.eta)}</td>
              <td>
                <StatusBadge status={ticket.status} statusCategory={ticket.statusCategory} />
              </td>
              <td className="cell-comment">
                {ticket.latestComment ? (
                  <>
                    <div className="comment-body">{ticket.latestComment.body}</div>
                    <div className="comment-meta">
                      {ticket.latestComment.author} · {formatDateTime(ticket.latestComment.created)}
                    </div>
                  </>
                ) : (
                  <span className="muted">No comments</span>
                )}
              </td>
              <td>
                <button type="button" className="btn-secondary" onClick={() => onComment(ticket)}>
                  Comment
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
