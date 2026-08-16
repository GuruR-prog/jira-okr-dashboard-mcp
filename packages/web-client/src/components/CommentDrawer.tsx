import { useState } from "react";
import type { Ticket } from "@jira-dashboard/core";
import { postComment } from "../api.js";

interface CommentDrawerProps {
  ticket: Ticket;
  onClose: () => void;
  onPosted: () => void;
}

export function CommentDrawer({ ticket, onClose, onPosted }: CommentDrawerProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (body.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await postComment(ticket.workspaceId, ticket.key, body.trim());
      onPosted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-title">
              Comment on <a href={ticket.url} target="_blank" rel="noreferrer">{ticket.key}</a>
            </div>
            <div className="drawer-subtitle">{ticket.summary}</div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {ticket.latestComment && (
          <div className="drawer-existing-comment">
            <div className="comment-meta">Most recent — {ticket.latestComment.author}</div>
            <div className="comment-body">{ticket.latestComment.body}</div>
          </div>
        )}

        <textarea
          className="drawer-textarea"
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          autoFocus
        />

        {error && <div className="drawer-error">{error}</div>}

        <div className="drawer-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || body.trim().length === 0}
          >
            {submitting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
