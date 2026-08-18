#!/usr/bin/env node
// Interactive setup wizard for connecting a Jira workspace to the
// dashboard — no hand-editing JSON, no hunting for what "customfield_10016"
// means. Connects to a real Jira Cloud site, verifies the credentials
// work, lists your projects so you just pick one, auto-detects the Story
// Points/Sprint custom field IDs by name, and appends a ready-to-use
// entry to config/workspaces.json. Re-runnable — run it once per team.
//
// The API token you enter is typed into your own terminal and written
// straight to your own local .env file; it's never sent anywhere but
// Jira itself.
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = process.env.WORKSPACES_CONFIG_PATH ?? path.join(ROOT, "config/workspaces.json");
const ENV_PATH = process.env.SETUP_ENV_PATH ?? path.join(ROOT, ".env");

const rl = readline.createInterface({ input: stdin, output: stdout });

async function ask(question, { default: def } = {}) {
  const suffix = def ? ` (${def})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || def || "";
}

async function askYesNo(question, { default: def = false } = {}) {
  const answer = (await ask(`${question} (y/n)`, { default: def ? "y" : "n" })).toLowerCase();
  return answer.startsWith("y");
}

async function jiraGet(baseUrl, email, token, apiPath) {
  const res = await fetch(`${baseUrl}${apiPath}`, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${email}:${token}`).toString("base64"),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira API ${res.status} ${res.statusText} for ${apiPath}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

/** Exact match first, then a substring match, so "Story Points" still finds "Story point estimate". */
function findFieldId(fields, patterns) {
  for (const pattern of patterns) {
    const exact = fields.find((f) => f.name?.toLowerCase() === pattern.toLowerCase());
    if (exact) return exact.id;
  }
  for (const pattern of patterns) {
    const partial = fields.find((f) => f.name?.toLowerCase().includes(pattern.toLowerCase()));
    if (partial) return partial.id;
  }
  return undefined;
}

async function loadExistingWorkspaces() {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw new Error(`${CONFIG_PATH} exists but isn't valid JSON: ${err.message}`);
  }
}

/** Adds or replaces a KEY=value line in .env, preserving everything else. Creates the file if it doesn't exist. */
async function upsertEnvVar(key, value) {
  let lines = [];
  try {
    lines = (await readFile(ENV_PATH, "utf-8")).split("\n");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const pattern = new RegExp(`^${key}=`);
  const idx = lines.findIndex((line) => pattern.test(line));
  const newLine = `${key}=${value}`;
  if (idx >= 0) lines[idx] = newLine;
  else lines.push(newLine);
  await writeFile(ENV_PATH, lines.join("\n").replace(/\n+$/, "\n"));
}

async function main() {
  console.log("\n🔭 Looking Glass — Jira workspace setup\n");
  console.log("Connects to a real Jira Cloud site, checks the credentials work, lists");
  console.log("your projects, and auto-detects your Story Points/Sprint field IDs.");
  console.log("Run this once per team — it appends to config/workspaces.json each time.\n");

  const baseUrl = (await ask("Jira base URL (e.g. https://your-team.atlassian.net)")).replace(/\/+$/, "");
  const email = await ask("Your Jira account email");
  const token = await ask("Jira API token — create one at id.atlassian.com/manage-profile/security/api-tokens");

  if (!baseUrl || !email || !token) {
    console.error("\n❌ Base URL, email, and API token are all required.");
    process.exit(1);
  }

  console.log("\nTesting connection…");
  let me;
  try {
    me = await jiraGet(baseUrl, email, token, "/rest/api/3/myself");
  } catch (err) {
    console.error(`\n❌ Couldn't connect: ${err.message}`);
    console.error("Double check the base URL, email, and token, then try again.");
    process.exit(1);
  }
  console.log(`✅ Connected as ${me.displayName} (${me.emailAddress ?? email})\n`);

  console.log("Fetching your projects…");
  const projectsData = await jiraGet(baseUrl, email, token, "/rest/api/3/project/search?maxResults=100");
  const projects = projectsData.values ?? [];
  if (projects.length === 0) {
    console.error("❌ No projects visible to this account. Nothing to configure.");
    process.exit(1);
  }
  console.log("\nAvailable projects:");
  projects.forEach((p, i) => console.log(`  ${i + 1}. ${p.key} — ${p.name}`));
  const projectChoice = await ask("\nWhich project number should this workspace track?");
  const project = projects[Number(projectChoice) - 1];
  if (!project) {
    console.error("❌ Invalid selection.");
    process.exit(1);
  }

  console.log("\nDetecting custom fields…");
  const fields = await jiraGet(baseUrl, email, token, "/rest/api/3/field");
  const storyPointsField = findFieldId(fields, ["Story point estimate", "Story Points"]);
  const sprintField = findFieldId(fields, ["Sprint"]);
  const etaField = findFieldId(fields, ["ETA", "Target date"]);
  console.log(
    storyPointsField
      ? `  ✅ Story Points: ${storyPointsField}`
      : "  ⚠️  Story Points field not found — skipping (set storyPointsField manually later if you use one)",
  );
  console.log(
    sprintField
      ? `  ✅ Sprint: ${sprintField}`
      : "  ℹ️  No Sprint field found — fine if this is a Kanban board, tickets will show \"Kanban\"",
  );
  if (etaField) console.log(`  ✅ ETA: ${etaField}`);

  console.log("");
  const team = await ask('Display name for this team (e.g. "Team 1")');
  const label = await ask("Workspace label", { default: `${team} — ${project.name}` });
  const id = await ask("Workspace id (short, unique, no spaces)", { default: project.key.toLowerCase() });
  const tokenEnvVar = await ask(
    "Env var name to store this token under",
    { default: `JIRA_${team.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_TOKEN` },
  );
  const jql = await ask("JQL scope", { default: `project = ${project.key} AND resolution = Unresolved ORDER BY updated DESC` });

  const entry = {
    id,
    label,
    team,
    baseUrl,
    email,
    apiTokenEnvVar: tokenEnvVar,
    ...(storyPointsField ? { storyPointsField } : {}),
    ...(etaField ? { etaField } : {}),
    ...(sprintField ? { sprintField } : {}),
    jql,
  };

  const trackIncidents = await askYesNo("\nDoes this project track incidents with a severity field?", { default: false });
  if (trackIncidents) {
    const severityField = await ask("Severity field ID", { default: "priority" });
    const severityValuesRaw = await ask('All severity values, comma-separated (e.g. "Sev1, Sev2, Sev2.5, Sev3")');
    const highSeverityRaw = await ask('Which of those count as "high", comma-separated (e.g. "Sev1, Sev2, Sev2.5")');
    const severityValues = severityValuesRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const highSeverityValues = highSeverityRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (severityValues.length > 0) {
      entry.severityField = severityField;
      entry.severityValues = severityValues;
      if (highSeverityValues.length > 0) entry.highSeverityValues = highSeverityValues;
    }
  }

  const existing = await loadExistingWorkspaces();
  if (existing.some((w) => w.id === id)) {
    console.error(`\n❌ A workspace with id "${id}" already exists in ${CONFIG_PATH}. Edit it directly to change it.`);
    process.exit(1);
  }
  existing.push(entry);

  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(existing, null, 2) + "\n");
  await upsertEnvVar(tokenEnvVar, token);

  console.log(`\n✅ Added workspace "${id}" to ${path.relative(ROOT, CONFIG_PATH)}`);
  console.log(`✅ Wrote ${tokenEnvVar} to ${path.relative(ROOT, ENV_PATH)}`);
  console.log("\nRun this again to add another team, or start the dashboard:");
  console.log("  npm run web-server");
  console.log("  npm run web-client\n");

  rl.close();
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
