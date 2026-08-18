import { readFileSync } from "node:fs";
import type { WorkspaceConfig } from "./types.js";

const REQUIRED_STRING_FIELDS = ["id", "label", "team", "baseUrl", "email", "apiTokenEnvVar", "jql"] as const;

/**
 * Loads and validates a workspace config file — a JSON array describing
 * each Jira Cloud site a team leader wants pulled into one dashboard.
 * Tokens are never stored in the file itself: each entry names an
 * environment variable (`apiTokenEnvVar`) that holds the real secret, so
 * this file is safe to share or even check in as a team template.
 */
export function loadWorkspaces(configPath: string): WorkspaceConfig[] {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Couldn't read workspace config at ${configPath}. Copy config/workspaces.example.json to ` +
        `config/workspaces.json and fill it in.\n${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${configPath} isn't valid JSON: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${configPath} must be a JSON array of workspace configs.`);
  }
  if (parsed.length === 0) {
    throw new Error(`${configPath} has no workspaces defined — add at least one.`);
  }

  const workspaces = parsed.map((entry, index) => validateWorkspace(entry, index, configPath));

  const ids = new Set<string>();
  for (const w of workspaces) {
    if (ids.has(w.id)) throw new Error(`Duplicate workspace id "${w.id}" in ${configPath} — ids must be unique.`);
    ids.add(w.id);
  }

  return workspaces;
}

function validateWorkspace(entry: unknown, index: number, configPath: string): WorkspaceConfig {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`${configPath}[${index}] must be an object.`);
  }
  const e = entry as Record<string, unknown>;

  for (const key of REQUIRED_STRING_FIELDS) {
    if (typeof e[key] !== "string" || e[key] === "") {
      throw new Error(`${configPath}[${index}] is missing required string field "${key}".`);
    }
  }

  return {
    id: e.id as string,
    label: e.label as string,
    team: e.team as string,
    baseUrl: e.baseUrl as string,
    email: e.email as string,
    apiTokenEnvVar: e.apiTokenEnvVar as string,
    storyPointsField: typeof e.storyPointsField === "string" ? e.storyPointsField : undefined,
    etaField: typeof e.etaField === "string" ? e.etaField : undefined,
    sprintField: typeof e.sprintField === "string" ? e.sprintField : undefined,
    severityField: typeof e.severityField === "string" ? e.severityField : undefined,
    severityValues: Array.isArray(e.severityValues)
      ? e.severityValues.filter((v): v is string => typeof v === "string")
      : undefined,
    highSeverityValues: Array.isArray(e.highSeverityValues)
      ? e.highSeverityValues.filter((v): v is string => typeof v === "string")
      : undefined,
    jql: e.jql as string,
  };
}

/** Resolves a workspace's API token from the environment variable it names. */
export function resolveApiToken(workspace: WorkspaceConfig): string {
  const token = process.env[workspace.apiTokenEnvVar];
  if (!token) {
    throw new Error(
      `Workspace "${workspace.id}" references env var ${workspace.apiTokenEnvVar}, but it isn't set. ` +
        `Add it to your .env file.`,
    );
  }
  return token;
}
