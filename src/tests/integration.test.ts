/** Integration coverage for scanner behavior, report safety, and project detection.
 * @author Preksha Shah
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defaultConfig } from "../core/config.js";
import { scan } from "../core/scanner.js";
import { htmlReport, markdownReport } from "../reporting/reports.js";
import { reportPath } from "../reporting/reports.js";
import { detectProject } from "../detector/project.js";
import { allRuleMetadata } from "../rules/builtins.js";

const exec = promisify(execFile);

const fixture = resolve(process.cwd(), "src/tests/fixtures/node-risky");
/** Verify Node rules report evidence while redacting credential-like values. */
test("detects evidence-backed risky Node findings", async () => {
  const result = await scan(fixture, {
    ...defaultConfig,
    severityThreshold: "critical",
  });
  const ids = new Set(result.findings.map((finding) => finding.ruleId));
  assert.ok(ids.has("SEC001"));
  assert.ok(ids.has("SEC006"));
  assert.ok(ids.has("REL002"));
  assert.ok(ids.has("NODE002"));
  assert.ok(result.findings.every((finding) => finding.evidence));
  assert.doesNotMatch(
    result.findings.find((finding) => finding.ruleId === "SEC001")?.evidence ??
      "",
    /abcdefghijklmnop0123456789/,
  );
});
/** Verify generated reports include expected structure and limitations. */
test("reports are standalone and include limitations", async () => {
  const result = await scan(fixture, defaultConfig);
  assert.match(markdownReport(result), /## Limitations/);
  assert.match(htmlReport(result), /<!doctype html>/i);
});
/** Verify lexical traversal cannot write reports outside the scanned root. */
test("rejects report paths outside the scanned repository", async () => {
  await assert.rejects(
    reportPath(resolve(process.cwd(), "src"), "../outside.html", "report.html"),
  );
});
/** Verify a symlink inside the repository cannot redirect report writes outside it. */
test("rejects report paths that escape through a symlink", async () => {
  const parent = await mkdtemp(resolve(tmpdir(), "prod-ready-report-"));
  const root = resolve(parent, "root");
  const outside = resolve(parent, "outside");
  try {
    await mkdir(root);
    await mkdir(outside);
    await symlink(
      outside,
      resolve(root, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      reportPath(root, "linked/report.html", "report.html"),
      /must stay within/,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
/** Verify Laravel detection and required rule metadata. */
test("detects Laravel and keeps rule metadata complete", async () => {
  const project = await detectProject(
    resolve(process.cwd(), "src/tests/fixtures/laravel-basic"),
  );
  assert.ok(project.technologies.includes("Laravel"));
  for (const rule of allRuleMetadata()) {
    assert.ok(rule.id && rule.name && rule.description && rule.remediation);
  }
});
/** Verify Git analysis reads history without executing repository code. */
test("collects Git history without executing project code", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "prod-ready-git-"));
  try {
    await writeFile(resolve(root, "package.json"), '{"name":"git-fixture"}');
    await writeFile(
      resolve(root, "service.js"),
      "export const payment = () => true;\n",
    );
    await exec("git", ["init", "-q", root]);
    await exec("git", [
      "-C",
      root,
      "config",
      "user.email",
      "test@example.invalid",
    ]);
    await exec("git", ["-C", root, "config", "user.name", "Test"]);
    await exec("git", ["-C", root, "add", "."]);
    await exec("git", ["-C", root, "commit", "-qm", "fixture"]);
    const result = await scan(root, {
      ...defaultConfig,
      severityThreshold: "critical",
    });
    assert.equal(result.project.isGit, true);
    assert.equal(result.git?.commits, 1);
    assert.equal(result.git?.contributors, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
