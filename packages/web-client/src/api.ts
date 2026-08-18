import type { AggregatedTickets, Incident, OnCallRosterEntry, Ticket, WorkspaceFetchError } from "@jira-dashboard/core";

// Empty by default so requests go to relative "/api/..." paths, which the
// Vite dev proxy forwards to the web-server (see vite.config.ts). Set
// VITE_API_BASE at build time to point a deployed client at a real API origin.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchTickets(): Promise<AggregatedTickets> {
  return fetch(`${API_BASE}/api/tickets`).then((res) => handle<AggregatedTickets>(res));
}

export function postComment(
  workspaceId: string,
  key: string,
  body: string,
): Promise<{ id: string; created: string }> {
  return fetch(`${API_BASE}/api/tickets/${encodeURIComponent(workspaceId)}/${encodeURIComponent(key)}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  }).then((res) => handle(res));
}

export interface SummarizeResponse {
  summary: string;
  ticketCount: number;
  generatedAt: string;
}

export function summarize(tickets: Ticket[]): Promise<SummarizeResponse> {
  return fetch(`${API_BASE}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickets }),
  }).then((res) => handle(res));
}

export interface OnCallResponse {
  configured: boolean;
  roster: OnCallRosterEntry[];
}

export function fetchOnCall(): Promise<OnCallResponse> {
  return fetch(`${API_BASE}/api/oncall`).then((res) => handle<OnCallResponse>(res));
}

export interface IncidentsResponse {
  incidents: Incident[];
  errors: WorkspaceFetchError[];
  onCallConfigured: boolean;
  fetchedAt: string;
}

export function fetchIncidents(): Promise<IncidentsResponse> {
  return fetch(`${API_BASE}/api/incidents`).then((res) => handle<IncidentsResponse>(res));
}
