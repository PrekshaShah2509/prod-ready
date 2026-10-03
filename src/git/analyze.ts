/** Collect bounded Git-history signals without invoking project scripts or a shell.
 * @author Preksha Shah
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitInsight } from "../core/models.js";
const exec = promisify(execFile);
/** Run one Git subcommand with fixed arguments and return empty output on failure. */
async function git(root: string, args: string[]): Promise<string> {
  try {
    // Use fixed argument arrays with bounded time and output; never invoke a shell.
    return (
      await exec("git", ["-C", root, ...args], {
        maxBuffer: 8_000_000,
        timeout: 15000,
        windowsHide: true,
      })
    ).stdout;
  } catch {
    return "";
  }
}
/** Aggregate commit, contributor, and per-file change counts from repository history. */
export async function analyzeGit(
  root: string,
): Promise<GitInsight | undefined> {
  const probe = await git(root, ["rev-parse", "--is-inside-work-tree"]);
  if (probe.trim() !== "true") return undefined;
  const log = await git(root, [
    "log",
    "--format=%H|%an|%ad",
    "--date=short",
    "--name-only",
  ]);
  const since = new Date();
  since.setDate(since.getDate() - 90);
  // Each log header updates the author and recency applied to following changed paths.
  const changesByFile = new Map<string, number>();
  const recentChangesByFile = new Map<string, number>();
  const contributorsByFile = new Map<string, Set<string>>();
  let commits = 0;
  const authors = new Set<string>();
  let currentAuthor = "";
  let recent = false;
  for (const line of log.split(/\r?\n/)) {
    const match = /^[0-9a-f]{40}\|(.+)\|(\d{4}-\d\d-\d\d)$/.exec(line);
    if (match) {
      commits++;
      currentAuthor = match[1];
      authors.add(currentAuthor);
      recent = new Date(`${match[2]}T00:00:00`) >= since;
      continue;
    }
    if (!line || !currentAuthor) continue;
    changesByFile.set(line, (changesByFile.get(line) ?? 0) + 1);
    if (recent)
      recentChangesByFile.set(line, (recentChangesByFile.get(line) ?? 0) + 1);
    const set = contributorsByFile.get(line) ?? new Set<string>();
    set.add(currentAuthor);
    contributorsByFile.set(line, set);
  }
  return {
    commits,
    contributors: authors.size,
    changesByFile,
    recentChangesByFile,
    contributorsByFile: new Map(
      [...contributorsByFile].map(([k, v]) => [k, v.size]),
    ),
  };
}
