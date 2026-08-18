import { Router } from "express";
import type { OnCallService } from "../oncall-service.js";

export function oncallRouter(service: OnCallService | null): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    if (!service) {
      res.json({ configured: false, roster: [] });
      return;
    }
    try {
      const roster = await service.getRoster();
      res.json({ configured: true, roster });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
