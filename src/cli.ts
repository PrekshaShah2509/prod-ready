#!/usr/bin/env node
/** CLI entry point for scanning repositories and presenting readiness results.
 * @author Preksha Shah
 */
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defaultConfig, loadConfig } from "./core/config.js";
import { severityRank } from "./core/models.js";
import { scan } from "./core/scanner.js";
import { allRuleMetadata } from "./rules/builtins.js";
import {
  htmlReport,
  markdownReport,
  reportPath,
  terminalReport,
} from "./reporting/reports.js";

const version = "0.1.0";
const help = `Production Readiness CLI v${version}

Usage:
  prod-ready [path]
  prod-ready scan [path] [--format terminal|json|markdown|html] [--severity critical|high|medium|low|info] [--category name] [--config path] [--diff]
  prod-ready rules [--category name]
  prod-ready init
  prod-ready baseline [path]

Exit codes: 0 no findings at/above threshold; 1 threshold violated; 2 usage, configuration, or runtime error.
Privacy: scanning is local-only. The CLI does not upload source code or use an API key.`;
type Args = {
  command: string;
  path: string;
  format: string;
  severity?: string;
  category?: string;
  config?: string;
  diff: boolean;
};
/** Parse the command, positional path, and supported CLI options. */
function parse(argv: string[]): Args {
  const args = [...argv];
  let command = "scan";
  if (
    ["scan", "rules", "init", "version", "baseline", "help"].includes(
      args[0] ?? "",
    )
  )
    command = args.shift()!;
  let path = ".";
  let format = "terminal";
  let severity: string | undefined;
  let category: string | undefined;
  let config: string | undefined;
  let diff = false;
  while (args.length) {
    const x = args.shift()!;
    if (!x.startsWith("--") && path === ".") {
      path = x;
      continue;
    }
    if (x === "--format") format = args.shift() ?? "";
    else if (x === "--severity") severity = args.shift();
    else if (x === "--category") category = args.shift();
    else if (x === "--config") config = args.shift();
    else if (x === "--diff") diff = true;
    else if (x === "--help" || x === "-h") command = "help";
    else throw new Error(`Unknown option: ${x}`);
  }
  if (!["terminal", "json", "markdown", "html"].includes(format))
    throw new Error(`Unsupported format: ${format}`);
  return { command, path, format, severity, category, config, diff };
}
/** Check whether a filesystem path can be accessed. */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
/** Create a baseline containing the current finding signatures. */
async function makeBaseline(root: string): Promise<void> {
  const result = await scan(root, defaultConfig);
  const ids = result.findings.map(
    (f) => `${f.ruleId}|${f.file ?? ""}|${f.line ?? ""}|${f.evidence ?? ""}`,
  );
  await writeFile(
    resolve(root, ".prod-ready-baseline.json"),
    JSON.stringify(
      { version, createdAt: new Date().toISOString(), findings: ids },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline saved with ${ids.length} findings.`);
}
/** Dispatch the selected command and set the documented process exit code. */
async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(version);
    return;
  }
  if (argv.length === 0) {
    console.log(help);
    return;
  }
  const args = parse(argv);
  if (args.command === "help") {
    console.log(help);
    return;
  }
  if (args.command === "version") {
    console.log(version);
    return;
  }
  if (args.command === "rules") {
    const items = allRuleMetadata().filter(
      (r) => !args.category || r.category === args.category,
    );
    console.log(
      items
        .map(
          (r) =>
            `${r.id}\t${r.defaultSeverity.toUpperCase()}\t${r.category}\t${r.name}\n  ${r.description}`,
        )
        .join("\n"),
    );
    return;
  }
  const root = resolve(args.path);
  if (args.command === "init") {
    const configPath = resolve(root, "prod-ready.config.json");
    const ignorePath = resolve(root, ".prod-readyignore");
    if (!(await exists(configPath)))
      await writeFile(
        configPath,
        JSON.stringify(defaultConfig, null, 2) + "\n",
      );
    if (!(await exists(ignorePath)))
      await writeFile(
        ignorePath,
        "node_modules/\nvendor/\ndist/\nbuild/\ncoverage/\ngenerated/\n.env\n",
        "utf8",
      );
    console.log(
      "Created prod-ready.config.json and .prod-readyignore where absent.",
    );
    return;
  }
  if (args.command === "baseline") {
    await makeBaseline(root);
    return;
  }
  const config = await loadConfig(root, args.config);
  if (args.severity) {
    if (!(args.severity in severityRank))
      throw new Error(`Invalid severity: ${args.severity}`);
    config.severityThreshold = args.severity as keyof typeof severityRank;
  }
  const result = await scan(root, config, { diff: args.diff });
  if (args.category)
    result.findings = result.findings.filter(
      (f) => f.category === args.category,
    );
  let baselineNote = "";
  const baselinePath = resolve(root, ".prod-ready-baseline.json");
  if (await exists(baselinePath)) {
    try {
      const data = JSON.parse(await readFile(baselinePath, "utf8")) as {
        findings?: string[];
      };
      const known = new Set(data.findings ?? []);
      const newCount = result.findings.filter(
        (f) =>
          !known.has(
            `${f.ruleId}|${f.file ?? ""}|${f.line ?? ""}|${f.evidence ?? ""}`,
          ),
      ).length;
      baselineNote = `\nBaseline: ${result.findings.length - newCount} existing findings; ${newCount} new findings.`;
    } catch {
      baselineNote = "\nBaseline file could not be read.";
    }
  }
  if (args.format === "json") console.log(JSON.stringify(result, null, 2));
  else if (args.format === "markdown") {
    const file = await reportPath(
      root,
      config.output?.markdownPath,
      "production-readiness.md",
    );
    await writeFile(file, markdownReport(result), "utf8");
    console.log(`Markdown report written to ${file}`);
  } else if (args.format === "html") {
    const file = await reportPath(
      root,
      config.output?.htmlPath,
      "production-readiness.html",
    );
    await writeFile(file, htmlReport(result), "utf8");
    console.log(`HTML report written to ${file}`);
  } else console.log(terminalReport(result) + baselineNote);
  const threshold = severityRank[config.severityThreshold];
  if (result.findings.some((f) => severityRank[f.severity] >= threshold))
    process.exitCode = 1;
}
run().catch((error) => {
  console.error(`prod-ready: ${(error as Error).message}`);
  process.exitCode = 2;
});
