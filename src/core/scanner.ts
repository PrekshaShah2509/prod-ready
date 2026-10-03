/** Coordinate repository detection, analysis rules, and finding aggregation.
 * @author Preksha Shah
 */
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { analyzeDependencies } from "../dependencies/analyze.js";
import { detectProject } from "../detector/project.js";
import { analyzeGit } from "../git/analyze.js";
import { readIgnoreFile, collectFiles } from "./files.js";
import type { Config, Finding, ScanResult } from "./models.js";
import { builtinRules } from "../rules/builtins.js";

/** Scan a project and return its detected technologies, findings, and limitations. */
export async function scan(
  input: string,
  config: Config,
  options: { diff?: boolean } = {},
): Promise<ScanResult> {
  const root = resolve(input);
  try {
    await access(root);
  } catch {
    throw new Error(`Path does not exist: ${root}`);
  }
  const started = performance.now();
  const project = await detectProject(root);
  const ignores = [...config.exclude, ...(await readIgnoreFile(root))];
  const files = await collectFiles(root, ignores);
  const git = project.isGit ? await analyzeGit(root) : undefined;
  const dependencyInfo = await analyzeDependencies(root, project);
  const context = { root, project, config, files, git, dependencyInfo };
  const rules = builtinRules().filter((rule) => rule.applies(context));
  let findings: Finding[] = [];
  for (const rule of rules) findings.push(...rule.analyze(context));
  if (options.diff && git) {
    // Repository-wide findings stay visible because they have no single changed file to match.
    const changed = new Set([...git.recentChangesByFile.keys()]);
    findings = findings.filter((f) => !f.file || changed.has(f.file));
  }
  const unique = new Map<string, Finding>();
  for (const item of findings)
    unique.set(
      `${item.ruleId}|${item.file}|${item.line}|${item.evidence}`,
      item,
    );
  findings = [...unique.values()].sort(
    (a, b) =>
      ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 })[b.severity] -
        { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[a.severity] ||
      a.ruleId.localeCompare(b.ruleId),
  );
  return {
    version: "0.1.2",
    timestamp: new Date().toISOString(),
    project,
    findings,
    filesAnalyzed: files.length,
    rulesExecuted: rules.length,
    durationMs: Math.round(performance.now() - started),
    git: git
      ? { commits: git.commits, contributors: git.contributors }
      : undefined,
    dependencyInfo,
    limitations: [
      "This tool performs static and repository-level analysis; findings require engineering review.",
      "It does not prove an application is secure, reliable, or production-ready.",
      "Framework-specific checks are heuristic and dependency CVEs are not verified without a local database.",
    ],
  };
}
