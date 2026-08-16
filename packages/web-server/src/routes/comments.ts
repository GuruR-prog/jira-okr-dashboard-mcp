import { Router } from "express";
import type { Aggregator } from "../aggregator.js";

export function commentsRouter(aggregator: Aggregator): Router {
  const router = Router();

  router.post("/:workspaceId/:key/comment", async (req, res) => {
    const { workspaceId, key } = req.params;
    const body = (req.body as { body?: unknown })?.body;

    if (typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ error: 'Request body must include a non-empty "body" string.' });
      return;
    }

    try {
      const client = aggregator.getWorkspaceClient(workspaceId);
      const comment = await client.postComment(key, body);
      res.status(201).json(comment);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.startsWith("Unknown workspace") ? 404 : 500;
      res.status(status).json({ error: message });
    }
  });

  return router;
}
