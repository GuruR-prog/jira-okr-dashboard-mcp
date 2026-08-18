import type { Incident, Ticket } from "./types.js";

/**
 * Filters tickets down to incidents and classifies each as high/lower
 * severity, using each workspace's configured severity taxonomy.
 *
 * This deliberately does NOT treat "severity is non-null" as "this is an
 * incident" — Jira's default severityField (Priority) is set on nearly
 * every ticket regardless of type, so that would misclassify ordinary
 * work items as incidents. A ticket only counts if its severity value is
 * in that workspace's `severityValues` allow-list; a workspace with no
 * severityValues configured contributes no incidents at all.
 *
 * on-call correlation isn't done here — it needs a live provider call per
 * incident (who was on call at this exact timestamp), which only
 * web-server has the wiring for. See `enrichWithOnCall` there.
 */
export function extractIncidents(
  tickets: Ticket[],
  severityValuesByWorkspace: Map<string, Set<string>>,
  highSeverityValuesByWorkspace: Map<string, Set<string>>,
): Array<Omit<Incident, "onCall">> {
  return tickets
    .filter((t) => {
      if (t.severity === null) return false;
      const recognized = severityValuesByWorkspace.get(t.workspaceId);
      return recognized ? recognized.has(t.severity) : false;
    })
    .map((t) => {
      const highValues = highSeverityValuesByWorkspace.get(t.workspaceId);
      return {
        ...t,
        severity: t.severity as string,
        isHighSeverity: highValues ? highValues.has(t.severity as string) : false,
      };
    });
}
