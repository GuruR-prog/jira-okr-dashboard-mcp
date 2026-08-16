#!/usr/bin/env node
/**
 * Spawns the MCP server as a child process, hands its tools to Claude, and
 * lets Claude drive its own investigation (search issues, pull progress,
 * decide what's worth flagging) until it has enough to write an OKR status
 * report. The report gets wrapped in a static dashboard.html.
 *
 * This mirrors the internal tool this repo is a clean-room rebuild of: an
 * OKR dashboard that talks to Jira through MCP instead of a bespoke
 * integration, so the same server works from Claude Desktop, Claude Code,
 * or this script.
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { renderDashboardHtml } from "./template.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JQL = process.env.OKR_JQL;
if (!JQL) {
  console.error(
    'Set OKR_JQL to the query for the OKR you want reported on, e.g.\n' +
      '  OKR_JQL=\'labels = "OKR-Q3-2026-reliability"\' npm run dashboard',
  );
  process.exit(1);
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey) {
  console.error("Set ANTHROPIC_API_KEY in your environment or .env file.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: anthropicKey });

// Forward the current environment to the server subprocess so it can reach
// Jira with the same credentials this script is using.
const childEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) childEnv[key] = value;
}

const mcpServerEntry = path.join(__dirname, "../../mcp-server/src/server.ts");

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", mcpServerEntry],
  env: childEnv,
});

const mcpClient = new Client({ name: "jira-okr-dashboard-cli", version: "0.1.0" });
await mcpClient.connect(transport);

const { tools: mcpTools } = await mcpClient.listTools();
const claudeTools: Anthropic.Tool[] = mcpTools.map((tool) => ({
  name: tool.name,
  description: tool.description ?? "",
  input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
}));

const systemPrompt = `You are writing a concise OKR status report for engineering leadership.
You have Jira tools available — use them to investigate before writing anything.
Start with get_okr_progress on the JQL you're given, then use search_issues or
get_issue if you need to understand specific blockers. Once you have enough,
write a short Markdown report with:
- A one-line headline verdict (on track / at risk / behind)
- Progress by issue count and, if available, story points
- The 2-4 issues most worth a human's attention, with a one-line reason each
- Nothing else — no filler, no restating the raw numbers you already showed`;

const messages: Anthropic.MessageParam[] = [
  { role: "user", content: `Report on this OKR. JQL: ${JQL}` },
];

let finalText = "";
const MAX_TURNS = 8;

for (let turn = 0; turn < MAX_TURNS; turn++) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    tools: claudeTools,
    messages,
  });

  messages.push({ role: "assistant", content: response.content });

  if (response.stop_reason !== "tool_use") {
    finalText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    break;
  }

  const toolResults: Anthropic.ToolResultBlockParam[] = [];
  for (const block of response.content) {
    if (block.type !== "tool_use") continue;
    console.error(`→ Claude called ${block.name}(${JSON.stringify(block.input)})`);
    const result = await mcpClient.callTool({
      name: block.name,
      arguments: block.input as Record<string, unknown>,
    });
    toolResults.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: result.content as Anthropic.ToolResultBlockParam["content"],
    });
  }
  messages.push({ role: "user", content: toolResults });
}

await mcpClient.close();

if (!finalText) {
  console.error(`Claude didn't finish within ${MAX_TURNS} tool-use turns. Try a narrower JQL.`);
  process.exit(1);
}

const html = renderDashboardHtml({
  title: "OKR Status Dashboard",
  generatedAt: new Date(),
  jql: JQL,
  reportMarkdown: finalText,
});

const outPath = path.join(process.cwd(), "dashboard.html");
await writeFile(outPath, html, "utf-8");
console.log(`\nWrote ${outPath}`);
