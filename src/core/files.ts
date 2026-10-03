/** Read bounded, eligible repository files and apply scan ignore patterns.
 * @author Preksha Shah
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { SourceFile } from "./models.js";

// Static analysis benefits from bounded input: this avoids loading generated or maliciously large files.
const maxFileBytes = 1_500_000;

/** Read additional ignore patterns from the repository's ignore file. */
export async function readIgnoreFile(root: string): Promise<string[]> {
  try {
    return (await readFile(resolve(root, ".prod-readyignore"), "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

/** Match a normalized repository-relative path against the supported glob syntax. */
function matchesPattern(path: string, pattern: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const normalizedPattern = pattern
    .replaceAll("\\", "/")
    .replace(/^\//, "")
    .replace(/\/$/, "");

  if (!normalizedPattern) return false;
  if (!normalizedPattern.includes("*")) {
    return (
      normalized === normalizedPattern ||
      normalized.startsWith(`${normalizedPattern}/`)
    );
  }

  const expression = `^${normalizedPattern
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((item) => item.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*")}$`;
  return new RegExp(expression).test(normalized);
}

/** Collect eligible UTF-8 source files without following symlinks or reading oversized content. */
export async function collectFiles(
  root: string,
  patterns: string[],
): Promise<SourceFile[]> {
  const result: SourceFile[] = [];

  /** Traverse eligible directories and skip files that cannot be safely read. */
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(directory, entry.name);
      const relativePath = relative(root, fullPath).split(sep).join("/");

      if (patterns.some((pattern) => matchesPattern(relativePath, pattern)))
        continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      try {
        const metadata = await stat(fullPath);
        if (metadata.size > maxFileBytes) continue;

        const content = await readFile(fullPath, "utf8");
        if (content.includes("\0")) continue;

        result.push({
          path: fullPath,
          relativePath,
          content,
          lines: content.split(/\r?\n/),
          size: metadata.size,
        });
      } catch {
        // Permission errors and files modified during traversal are safely skipped.
      }
    }
  }

  await walk(root);
  return result;
}

/** Convert a string offset into its one-based source line number. */
export function lineAt(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}
