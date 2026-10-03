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
  const cards =
    result.findings
      .map(
        (finding) =>
          `<article class="finding ${finding.severity}"><h3>${esc(finding.severity.toUpperCase())} ${esc(finding.ruleId)} - ${esc(finding.title)}</h3><p class="location">${esc(location(finding))} · confidence ${esc(finding.confidence)}</p><pre>${esc(finding.evidence ?? "repository-level evidence")}</pre><p>${esc(finding.description)}</p><p><strong>Recommendation:</strong> ${esc(finding.recommendation)}</p></article>`,
      )
      .join("") || "<p>No findings were produced by enabled rules.</p>";
  const summary = order
    .map(
      (severity) =>
        `<div><strong>${severity.toUpperCase()}</strong> ${count[severity]}</div>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Production Readiness - ${esc(result.project.name)}</title><style>body{font:16px system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#172033;background:#fafafa}h1{margin-bottom:.2rem}.summary{display:flex;gap:1rem;flex-wrap:wrap}.card,.finding{background:#fff;border:1px solid #dbe2ea;border-radius:8px;padding:1rem;margin:1rem 0}.finding{border-left:5px solid #768}.finding.high,.finding.critical{border-left-color:#c33}.finding.medium{border-left-color:#d80}.finding.low{border-left-color:#268}pre{white-space:pre-wrap;background:#f5f7f9;padding:.6rem;border-radius:4px}.location{color:#52606d}</style></head><body><h1>Production Readiness Report</h1><p>${esc(result.project.name)} · ${esc(result.timestamp)}</p><section class="summary"><div class="card">${summary}</div><div class="card"><strong>Stack</strong><br>${esc(result.project.technologies.join(", ") || "Unknown")}<br><strong>Files</strong> ${result.filesAnalyzed}<br><strong>Rules</strong> ${result.rulesExecuted}</div></section><h2>Findings</h2>${cards}<h2>Limitations</h2><ul>${result.limitations.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></body></html>`;
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
