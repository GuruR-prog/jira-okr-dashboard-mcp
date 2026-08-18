import { Router } from "express";
import { extractIncidents } from "@jira-dashboard/core";
import type { Aggregator } from "../aggregator.js";
import type { OnCallService } from "../oncall-service.js";

/**
 * Incidents aren't fetched separately from Jira — they're the subset of
 * the same tickets the main dashboard already pulls, filtered to the ones
 * with a severity value set (see extractIncidents in core). This does
 * mean a second full workspace fetch per request rather than reusing
 * /api/tickets' result — simplest correct thing for now; see README
 * roadmap for caching this if it becomes a real cost.
 */
export function incidentsRouter(aggregator: Aggregator, onCallService: OnCallService | null): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const { tickets, errors } = await aggregator.fetchAllTickets();
      const rawIncidents = extractIncidents(tickets, aggregator.severityValuesByWorkspace, aggregator.highSeverityValuesByWorkspace);
      const incidents = onCallService
        ? await onCallService.enrichWithOnCall(rawIncidents)
        : rawIncidents.map((i) => ({ ...i, onCall: null }));

      res.json({
        incidents,
        errors,
        onCallConfigured: onCallService !== null,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
