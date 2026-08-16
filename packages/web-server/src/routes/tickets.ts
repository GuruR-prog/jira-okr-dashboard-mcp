import { Router } from "express";
import type { Aggregator } from "../aggregator.js";

export function ticketsRouter(aggregator: Aggregator): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const result = await aggregator.fetchAllTickets();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/workspaces", (_req, res) => {
    res.json({ workspaces: aggregator.workspaceSummaries });
  });

  return router;
}
