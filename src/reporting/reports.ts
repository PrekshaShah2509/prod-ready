/** Validate report destinations and render terminal, Markdown, and HTML output.
 * @author Preksha Shah
 */
import { realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { Finding, ScanResult, Severity } from "../core/models.js";

const order: Severity[] = ["critical", "high", "medium", "low", "info"];
/** Escape text before embedding it in an HTML report. */
const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Resolve a configured report path and reject traversal or symlink escapes. */
export async function reportPath(
  root: string,
  configuredPath: string | undefined,
  fallback: string,
): Promise<string> {
  const destination = resolve(root, configuredPath ?? fallback);
  const fromRoot = relative(root, destination);
  if (
    isAbsolute(fromRoot) ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`)
  ) {
    throw new Error(
      "Report output path must stay within the scanned repository",
    );
  }

  const realRoot = await realpath(root);
  // Resolve the nearest existing ancestor so a missing output file under a symlink is checked too.
  let existingPath = destination;
  while (true) {
    try {
      existingPath = await realpath(existingPath);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      const parent = dirname(existingPath);
      if (parent === existingPath) throw error;
      existingPath = parent;
    }
  }

  const realRelative = relative(realRoot, existingPath);
  if (
    isAbsolute(realRelative) ||
    realRelative === ".." ||
    realRelative.startsWith(`..${sep}`)
  ) {
    throw new Error(
      "Report output path must stay within the scanned repository",
    );
  }
  return destination;
}
/** Count findings grouped by severity. */
export function counts(result: ScanResult): Record<Severity, number> {
  const count: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of result.findings) count[finding.severity]++;
  return count;
}
/** Format a finding's file and optional line as a display location. */
function location(finding: Finding): string {
  return finding.file
    ? `${finding.file}${finding.line ? `:${finding.line}` : ""}`
    : "repository-wide";
}

/** Render a concise, human-readable report for terminal output. */
export function terminalReport(result: ScanResult): string {
  const count = counts(result);
  const categories = new Map<string, number>();
  for (const finding of result.findings)
    categories.set(
      finding.category,
      (categories.get(finding.category) ?? 0) + 1,
    );
  const top = result.findings
    .slice(0, 10)
    .map(
      (finding, index) =>
        `${index + 1}. ${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.title}\n   ${location(finding)}${finding.evidence ? `\n   Evidence: ${finding.evidence}` : ""}`,
    );
  return [
    "Production Readiness",
    "--------------------",
    "",
    "Project",
    `  Name: ${result.project.name}`,
    `  Detected: ${result.project.technologies.join(", ") || "No supported ecosystem detected"}`,
    `  Git: ${result.project.isGit ? "detected" : "not detected"}`,
    `  Analyzers: ${result.project.analyzers.join(", ")}`,
    result.project.projects.length
      ? `  Monorepo projects: ${result.project.projects.map((project) => `${project.path} (${project.technologies.join(", ")})`).join("; ")}`
      : "",
    "",
    "Results",
    "-------",
    ...order.map(
      (severity) => `  ${severity.toUpperCase().padEnd(8)} ${count[severity]}`,
    ),
    "",
    "By category",
    ...[...categories].map(([category, total]) => `  ${category}: ${total}`),
    "",
    "Top findings",
    ...(top.length ? top : ["No findings met the enabled rules."]),
    "",
    `Scan completed in ${(result.durationMs / 1000).toFixed(2)}s. Files analyzed: ${result.filesAnalyzed}. Rules executed: ${result.rulesExecuted}.`,
    "",
    "Limitations",
    ...result.limitations.map((item) => `  ${item}`),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Render the scan result as a Markdown report. */
export function markdownReport(result: ScanResult): string {
  const count = counts(result);
  const details = result.findings.length
    ? result.findings.map((finding) =>
        [
          `### ${finding.severity.toUpperCase()} ${finding.ruleId}: ${finding.title}`,
          "",
          `- **Confidence:** ${finding.confidence}`,
          `- **Location:** ${location(finding)}`,
          `- **Evidence:** ${finding.evidence ?? "repository-level evidence"}`,
          "",
          finding.description,
          "",
          `**Recommendation:** ${finding.recommendation}`,
          "",
        ].join("\n"),
      )
    : ["No findings were produced by the enabled rules."];
  return [
    "# Production Readiness Report",
    "",
    `Generated: ${result.timestamp}`,
    `Tool version: ${result.version}`,
    "",
    "## Project summary",
    "",
    `- **Name:** ${result.project.name}`,
    `- **Detected stack:** ${result.project.technologies.join(", ") || "Unsupported/unknown"}`,
    `- **Files analyzed:** ${result.filesAnalyzed}`,
    `- **Rules executed:** ${result.rulesExecuted}`,
    `- **Git:** ${result.git ? `${result.git.commits} commits, ${result.git.contributors} contributors` : "not available"}`,
    "",
    "## Severity breakdown",
    "",
    ...order.map(
      (severity) => `- ${severity.toUpperCase()}: ${count[severity]}`,
    ),
    "",
    "## Findings",
    "",
    ...details,
    "## Dependency analysis",
    "",
    ...(result.dependencyInfo?.notes.map((note) => `- ${note}`) ?? []),
    "",
    "## Limitations",
    "",
    ...result.limitations.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

/** Render a standalone HTML report with escaped finding content. */
export function htmlReport(result: ScanResult): string {
  const count = counts(result);
  const summary = order
    .map(
      (severity) =>
        `<li class="severity-count severity-${severity}"><span>${esc(severity.toUpperCase())}</span><strong>${count[severity]}</strong></li>`,
    )
    .join("");
  const findings = result.findings.length
    ? result.findings
        .map(
          (finding) => `<article class="finding severity-${finding.severity}">
            <header class="finding-header">
              <div><p class="finding-category">${esc(finding.category)}</p><h3>${esc(finding.title)}</h3></div>
              <div class="finding-badges"><span class="severity-badge">${esc(finding.severity.toUpperCase())}</span><span class="confidence">${esc(finding.confidence)} confidence</span></div>
            </header>
            <p class="location"><code>${esc(location(finding))}</code></p>
            <p class="description">${esc(finding.description)}</p>
            ${finding.evidence ? `<details class="evidence"><summary>Evidence</summary><pre>${esc(finding.evidence)}</pre></details>` : ""}
            <div class="recommendation"><strong>Recommendation</strong><p>${esc(finding.recommendation)}</p></div>
          </article>`,
        )
        .join("")
    : '<div class="empty-state">No findings were produced by the enabled rules.</div>';
  const technologies = esc(result.project.technologies.join(", ") || "Unknown");
  const gitSummary = result.git
    ? `${result.git.commits} commits, ${result.git.contributors} contributors`
    : "Unavailable";
  const dependencyNotes = result.dependencyInfo?.notes.length
    ? `<section class="notes" aria-labelledby="dependency-notes-title"><h2 id="dependency-notes-title">Dependency notes</h2><ul>${result.dependencyInfo.notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul></section>`
    : "";
  const limitations = result.limitations
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Production Readiness - ${esc(result.project.name)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #182725;
        --muted: #536662;
        --line: #d4dfdb;
        --paper: #ffffff;
        --canvas: #f2f6f4;
        --accent: #176b58;
        --critical: #a52d35;
        --high: #bb4a34;
        --medium: #8a5b0b;
        --low: #315f82;
        --info: #536662;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--canvas);
        color: var(--ink);
        font: 15px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .report { width: min(1120px, 100%); margin: 0 auto; padding: 34px 24px 64px; }
      .report-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 24px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--line);
      }
      .eyebrow, .finding-category {
        margin: 0 0 6px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      h1 { margin: 0; font-size: 32px; line-height: 1.15; }
      .project-name { margin: 8px 0 0; color: var(--muted); font-size: 18px; overflow-wrap: anywhere; }
      .report-meta { display: grid; gap: 5px; color: var(--muted); font-size: 13px; text-align: right; }
      .report-meta strong { color: var(--ink); font-weight: 600; }
      main > section { margin-top: 28px; }
      h2 { margin: 0 0 14px; font-size: 20px; line-height: 1.3; }
      .severity-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .severity-count {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        min-height: 62px;
        padding: 12px 14px;
        background: var(--paper);
        border: 1px solid var(--line);
        border-top: 3px solid var(--severity-color);
        border-radius: 6px;
      }
      .severity-count span { color: var(--muted); font-size: 12px; font-weight: 700; }
      .severity-count strong { color: var(--severity-color); font-size: 23px; line-height: 1; }
      .severity-critical { --severity-color: var(--critical); }
      .severity-high { --severity-color: var(--high); }
      .severity-medium { --severity-color: var(--medium); }
      .severity-low { --severity-color: var(--low); }
      .severity-info { --severity-color: var(--info); }
      .project-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin: 0;
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 6px;
      }
      .project-grid > div { min-width: 0; padding: 14px 16px; }
      .project-grid dt { color: var(--muted); font-size: 12px; font-weight: 650; }
      .project-grid dd { margin: 4px 0 0; overflow-wrap: anywhere; }
      .section-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
      .finding-total { color: var(--muted); font-size: 13px; }
      .finding-list { display: grid; gap: 12px; }
      .finding {
        min-width: 0;
        padding: 18px 20px;
        background: var(--paper);
        border: 1px solid var(--line);
        border-left: 4px solid var(--severity-color);
        border-radius: 6px;
      }
      .finding-header { display: flex; justify-content: space-between; align-items: start; gap: 18px; }
      .finding-category { color: var(--muted); text-transform: capitalize; }
      .finding h3 { margin: 0; font-size: 17px; line-height: 1.35; }
      .finding-badges { display: flex; align-items: center; justify-content: end; flex-wrap: wrap; gap: 8px; }
      .severity-badge { color: var(--severity-color); font-size: 12px; font-weight: 750; }
      .confidence { color: var(--muted); font-size: 12px; white-space: nowrap; }
      .location { margin: 12px 0 0; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
      .location code { color: inherit; font: inherit; }
      .description { margin: 12px 0; }
      .evidence { margin: 12px 0; }
      .evidence summary { color: var(--accent); cursor: pointer; font-size: 13px; font-weight: 650; }
      pre {
        max-width: 100%;
        margin: 8px 0 0;
        padding: 12px;
        overflow: auto;
        background: #f2f6f4;
        border: 1px solid var(--line);
        border-radius: 4px;
        color: #263a35;
        font: 13px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .recommendation { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
      .recommendation strong { color: var(--accent); font-size: 13px; }
      .recommendation p { margin: 4px 0 0; }
      .empty-state, .notes, .limitations { padding: 16px 18px; background: var(--paper); border: 1px solid var(--line); border-radius: 6px; }
      .notes ul, .limitations ul { margin: 8px 0 0; padding-left: 20px; color: var(--muted); }
      .report-footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
      @media (max-width: 760px) {
        .report { padding: 24px 16px 44px; }
        .report-header { grid-template-columns: 1fr; align-items: start; gap: 12px; }
        .report-meta { text-align: left; }
        .severity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 440px) {
        h1 { font-size: 27px; }
        .finding { padding: 15px; }
        .finding-header { display: grid; }
        .finding-badges { justify-content: start; }
      }
      @media print {
        body { background: #fff; font-size: 12px; }
        .report { width: auto; padding: 0; }
        .severity-count, .project-grid, .finding, .empty-state, .notes, .limitations { break-inside: avoid; box-shadow: none; }
        .finding { margin: 0 0 10px; }
        .evidence:not([open]) { display: none; }
        a { color: inherit; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header class="report-header">
        <div>
          <p class="eyebrow">Production Readiness</p>
          <h1>Scan report</h1>
          <p class="project-name">${esc(result.project.name)}</p>
        </div>
        <div class="report-meta">
          <span>Generated <time datetime="${esc(result.timestamp)}">${esc(result.timestamp)}</time></span>
          <span>CLI version <strong>${esc(result.version)}</strong></span>
        </div>
      </header>

      <section aria-labelledby="severity-heading">
        <div class="section-heading">
          <h2 id="severity-heading">Severity overview</h2>
          <span class="finding-total">${result.findings.length} findings</span>
        </div>
        <ul class="severity-grid" aria-label="Findings by severity">${summary}</ul>
      </section>

      <section aria-labelledby="project-heading">
        <h2 id="project-heading">Project profile</h2>
        <dl class="project-grid">
          <div><dt>Detected stack</dt><dd>${technologies}</dd></div>
          <div><dt>Files analyzed</dt><dd>${result.filesAnalyzed}</dd></div>
          <div><dt>Rules executed</dt><dd>${result.rulesExecuted}</dd></div>
          <div><dt>Scan duration</dt><dd>${(result.durationMs / 1000).toFixed(2)}s</dd></div>
          <div><dt>Git history</dt><dd>${esc(gitSummary)}</dd></div>
          <div><dt>Projects detected</dt><dd>${result.project.projects.length}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="findings-heading">
        <div class="section-heading">
          <h2 id="findings-heading">Findings</h2>
          <span class="finding-total">${result.findings.length} total</span>
        </div>
        <div class="finding-list">${findings}</div>
      </section>

      ${dependencyNotes}

      <section class="limitations" aria-labelledby="limitations-heading">
        <h2 id="limitations-heading">Limitations</h2>
        <ul>${limitations}</ul>
      </section>

      <footer class="report-footer">Generated by Production Readiness CLI ${esc(result.version)}.</footer>
    </main>
  </body>
</html>`;
}
/** Write the requested report formats within the scanned repository. */
export async function writeReports(
  root: string,
  result: ScanResult,
  formats: string[],
  output?: { markdownPath?: string; htmlPath?: string },
): Promise<string[]> {
  const reports: string[] = [];
  if (formats.includes("markdown")) {
    const path = await reportPath(
      root,
      output?.markdownPath,
      "production-readiness.md",
    );
    await writeFile(path, markdownReport(result), "utf8");
    reports.push(path);
  }
  if (formats.includes("html")) {
    const path = await reportPath(
      root,
      output?.htmlPath,
      "production-readiness.html",
    );
    await writeFile(path, htmlReport(result), "utf8");
    reports.push(path);
  }
  return reports;
}
