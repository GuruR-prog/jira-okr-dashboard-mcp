/**
 * Minimal Atlassian Document Format (ADF) helpers. Jira Cloud's v3 API
 * returns comment bodies as ADF (a nested JSON doc, not plain text) and
 * requires ADF when you post one back — this is just enough of it to
 * round-trip a plain-text comment, not a full ADF implementation.
 */

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  [key: string]: unknown;
}

/** Flattens an ADF document down to a single-line plain-text preview. */
export function adfToPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as AdfNode;
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    return n.content
      .map((child) => adfToPlainText(child))
      .filter((s) => s.length > 0)
      .join(" ");
  }
  return "";
}

/** Wraps plain text in the minimal ADF shape the comments API requires. */
export function plainTextToAdf(text: string): { type: "doc"; version: 1; content: AdfNode[] } {
  const lines = text.split("\n");
  return {
    type: "doc",
    version: 1,
    content: lines.map((line) => ({
      type: "paragraph",
      content: line.length > 0 ? [{ type: "text", text: line }] : [],
    })),
  };
}
