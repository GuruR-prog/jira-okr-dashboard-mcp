import { readFileSync } from "node:fs";
import type { OnCallConfig, OnCallScheduleConfig } from "./types.js";

/**
 * Loads and validates the on-call config file — which schedules to track
 * and which dashboard team each maps to. Same shape philosophy as
 * workspaces.ts: the token lives in an env var named by the config, never
 * in the file itself, so this is safe to share or check in.
 */
export function loadOnCallConfig(configPath: string): OnCallConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Couldn't read on-call config at ${configPath}. Copy config/oncall.example.json to ` +
        `config/oncall.json and fill it in.\n${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${configPath} isn't valid JSON: ${(err as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`${configPath} must be a JSON object.`);
  }
  const p = parsed as Record<string, unknown>;

  if (p.provider !== "pagerduty") {
    throw new Error(`${configPath}: "provider" must be "pagerduty" (the only adapter implemented today).`);
  }
  if (typeof p.apiTokenEnvVar !== "string" || p.apiTokenEnvVar === "") {
    throw new Error(`${configPath} is missing required string field "apiTokenEnvVar".`);
  }
  if (!Array.isArray(p.schedules) || p.schedules.length === 0) {
    throw new Error(`${configPath} must have a non-empty "schedules" array.`);
  }

  const schedules = p.schedules.map((entry, index) => validateSchedule(entry, index, configPath));

  return { provider: "pagerduty", apiTokenEnvVar: p.apiTokenEnvVar, schedules };
}

function validateSchedule(entry: unknown, index: number, configPath: string): OnCallScheduleConfig {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`${configPath}.schedules[${index}] must be an object.`);
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.scheduleId !== "string" || e.scheduleId === "") {
    throw new Error(`${configPath}.schedules[${index}] is missing required string field "scheduleId".`);
  }
  if (typeof e.team !== "string" || e.team === "") {
    throw new Error(`${configPath}.schedules[${index}] is missing required string field "team".`);
  }
  return { scheduleId: e.scheduleId, team: e.team };
}

/** Resolves the on-call API token from the environment variable the config names. */
export function resolveOnCallToken(config: OnCallConfig): string {
  const token = process.env[config.apiTokenEnvVar];
  if (!token) {
    throw new Error(
      `On-call config references env var ${config.apiTokenEnvVar}, but it isn't set. Add it to your .env file.`,
    );
  }
  return token;
}
