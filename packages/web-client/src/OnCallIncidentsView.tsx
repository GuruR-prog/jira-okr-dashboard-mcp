import { useEffect, useState } from "react";
import type { Incident, OnCallRosterEntry, WorkspaceFetchError } from "@jira-dashboard/core";
import { fetchIncidents, fetchOnCall } from "./api.js";
import { OnCallRoster } from "./components/OnCallRoster.js";
import { IncidentsView } from "./components/IncidentsView.js";

export function OnCallIncidentsView() {
  const [onCallConfigured, setOnCallConfigured] = useState(false);
  const [roster, setRoster] = useState<OnCallRosterEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [errors, setErrors] = useState<WorkspaceFetchError[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [onCallResult, incidentsResult] = await Promise.all([fetchOnCall(), fetchIncidents()]);
      setOnCallConfigured(onCallResult.configured);
      setRoster(onCallResult.roster);
      setIncidents(incidentsResult.incidents);
      setErrors(incidentsResult.errors);
      setFetchedAt(incidentsResult.fetchedAt);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="view-toolbar">
        <p className="app-subtitle">
          {incidents.length} incident{incidents.length === 1 ? "" : "s"}
          {fetchedAt && ` · refreshed ${new Date(fetchedAt).toLocaleTimeString()}`}
        </p>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loadError && <div className="banner banner-error">Couldn't load on-call/incident data: {loadError}</div>}

      {errors.length > 0 && (
        <div className="banner banner-warning">
          {errors.length} workspace{errors.length === 1 ? "" : "s"} couldn't be reached — showing incidents from the
          rest.
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading on-call & incidents…</div>
      ) : (
        <>
          <OnCallRoster configured={onCallConfigured} roster={roster} />
          <IncidentsView incidents={incidents} onCallConfigured={onCallConfigured} />
        </>
      )}
    </div>
  );
}
