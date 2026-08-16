import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import type { Ticket } from "@jira-dashboard/core";

const SYSTEM_PROMPT = `You are an engineering-leadership assistant summarizing the current state of work across teams.
You'll be given a JSON list of Jira tickets (key, summary, assignee, status, dueDate, eta, team, labels) —
this is whatever the user currently has filtered on their dashboard, not necessarily everything.
Write a concise status summary in Markdown:
- A one-line headline verdict on overall health
- Anything overdue (dueDate in the past and not done) or clearly at risk, called out by key and why
- A one-line breakdown by team
- Nothing else — no restating the raw ticket list, no filler, no invented information not in the data`;

/**
 * Unlike the MCP-driven dashboard CLI (packages/dashboard-cli), this
 * doesn't give Claude tools to go fetch its own data — the web client
 * already has the filtered ticket set on screen, so this is a single
 * direct call over exactly that data. Simpler, faster, and "summarize what
 * I'm looking at right now" is a different job than "go investigate an OKR."
 */
export function summarizeRouter(getAnthropicKey: () => string | undefined): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const tickets = (req.body as { tickets?: unknown })?.tickets;
    if (!Array.isArray(tickets)) {
      res.status(400).json({ error: 'Request body must include a "tickets" array.' });
      return;
    }
    if (tickets.length === 0) {
      res.json({ summary: "No tickets in the current view to summarize.", ticketCount: 0, generatedAt: new Date().toISOString() });
      return;
    }

    const apiKey = getAnthropicKey();
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY isn't configured on the server." });
      return;
    }

    try {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1536,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify((tickets as Ticket[]).map(compactTicket), null, 2) }],
      });

      const summary = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      res.json({ summary, ticketCount: tickets.length, generatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

function compactTicket(t: Ticket) {
  return {
    key: t.key,
    summary: t.summary,
    assignee: t.assignee,
    status: t.status,
    dueDate: t.dueDate,
    eta: t.eta,
    team: t.team,
    labels: t.labels,
  };
}
