/**
 * Wraps Claude's OKR report (Markdown-ish text) in a minimal, dependency-free
 * HTML shell. No framework, no build step — the whole point is that anyone
 * can open dashboard.html straight out of this script.
 */
export function renderDashboardHtml(params: {
  title: string;
  generatedAt: Date;
  jql: string;
  reportMarkdown: string;
}): string {
  const { title, generatedAt, jql, reportMarkdown } = params;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{ --bg:#F7F8FA; --ink:#171B21; --ink-soft:#565D68; --line:#DEE1E6; --accent:#B9791F; }
  @media (prefers-color-scheme: dark){
    :root{ --bg:#0F141C; --ink:#E7E9ED; --ink-soft:#A2A9B4; --line:#28313D; --accent:#E0A94A; }
  }
  body{ margin:0; background:var(--bg); color:var(--ink); font:16px/1.65 -apple-system,'Segoe UI',sans-serif; }
  .wrap{ max-width:760px; margin:0 auto; padding:3rem 1.5rem 5rem; }
  h1{ font-size:1.7rem; margin:0 0 .3rem; }
  .meta{ font:.8rem/1.5 ui-monospace,'SF Mono',monospace; color:var(--ink-soft); margin-bottom:2.2rem; }
  .meta code{ background:none; }
  .report{ white-space:pre-wrap; font-size:.98rem; }
  .report h2, .report h3{ margin-top:1.8rem; }
  hr{ border:none; border-top:1px solid var(--line); margin:2rem 0; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${escapeHtml(generatedAt.toISOString())} · JQL: <code>${escapeHtml(jql)}</code></div>
    <hr>
    <div class="report">${escapeHtml(reportMarkdown)}</div>
  </div>
</body>
</html>
`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
