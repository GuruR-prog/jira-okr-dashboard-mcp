import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { createAggregator } from "./aggregator.js";
import { createOnCallService } from "./oncall-service.js";
import { ticketsRouter } from "./routes/tickets.js";
import { commentsRouter } from "./routes/comments.js";
import { summarizeRouter } from "./routes/summarize.js";
import { oncallRouter } from "./routes/oncall.js";
import { incidentsRouter } from "./routes/incidents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configPath =
  process.env.WORKSPACES_CONFIG_PATH ?? path.join(__dirname, "../../../config/workspaces.json");
const onCallConfigPath =
  process.env.ONCALL_CONFIG_PATH ?? path.join(__dirname, "../../../config/oncall.json");

const aggregator = createAggregator(configPath);
// On-call is an optional feature — createOnCallService returns null (with a
// console warning) rather than throwing when nothing's configured, so the
// dashboard still runs fine for anyone who hasn't set up PagerDuty.
const onCallService = createOnCallService(onCallConfigPath);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, workspaces: aggregator.workspaceSummaries, onCallConfigured: onCallService !== null });
});

app.use("/api/tickets", ticketsRouter(aggregator));
app.use("/api/tickets", commentsRouter(aggregator));
app.use("/api/summarize", summarizeRouter(() => process.env.ANTHROPIC_API_KEY));
app.use("/api/oncall", oncallRouter(onCallService));
app.use("/api/incidents", incidentsRouter(aggregator, onCallService));

const port = Number(process.env.WEB_SERVER_PORT ?? 4000);
app.listen(port, () => {
  console.log(`web-server listening on http://localhost:${port}`);
  console.log(`Workspaces: ${aggregator.workspaceSummaries.map((w) => w.label).join(", ")}`);
  console.log(`On-call: ${onCallService ? "configured" : "not configured"}`);
});
