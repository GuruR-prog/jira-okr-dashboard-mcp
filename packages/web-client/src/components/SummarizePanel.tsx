import { useState } from "react";
import type { Ticket } from "@jira-dashboard/core";
import { summarize } from "../api.js";

interface SummarizePanelProps {
  tickets: Ticket[];
}

export function SummarizePanel({ tickets }: SummarizePanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSummarize() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const result = await summarize(tickets);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (summary) await navigator.clipboard.writeText(summary);
  }

  return (
    <div className="summarize">
      <button type="button" className="btn-primary" onClick={handleSummarize} disabled={loading || tickets.length === 0}>
        {loading ? "Summarizing…" : `Summarize & generate report (${tickets.length})`}
      </button>

      {open && (
        <div className="summarize-panel">
          {loading && <div className="summarize-loading">Claude is reviewing {tickets.length} ticket(s)…</div>}
          {error && <div className="drawer-error">{error}</div>}
          {summary && (
            <>
              <div className="summarize-report">{summary}</div>
              <div className="summarize-actions">
                <button type="button" className="btn-secondary" onClick={handleCopy}>
                  Copy
                </button>
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
