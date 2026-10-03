/** Inspect dependency manifests and lockfile presence without installing packages.
 * @author Preksha Shah
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DependencyInfo, ProjectInfo } from "../core/models.js";
/** Read a JSON manifest, returning undefined when it is missing or invalid. */
async function load(
  path: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const v: unknown = JSON.parse(await readFile(path, "utf8"));
    return v && typeof v === "object"
      ? (v as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
/** Summarize direct dependencies and whether a supported lockfile is present. */
export async function analyzeDependencies(
  root: string,
  project: ProjectInfo,
): Promise<DependencyInfo> {
  const node = project.manifests.package
    ? await load(project.manifests.package)
    : undefined;
  const php = project.manifests.composer
    ? await load(project.manifests.composer)
    : undefined;
  const nodeDirect = Object.keys((node?.dependencies ?? {}) as object);
  const phpDirect = Object.keys((php?.require ?? {}) as object).filter(
    (x) => x !== "php",
  );
  const notes = [
    "Dependency structure was analyzed locally. Known CVEs were not verified because no vulnerability database is bundled.",
  ];
  let packageManager: string | undefined;
  for (const [file, manager] of [
    ["package-lock.json", "npm"],
    ["yarn.lock", "yarn"],
    ["pnpm-lock.yaml", "pnpm"],
    ["composer.lock", "composer"],
  ] as const) {
    try {
      await readFile(resolve(root, file));
      packageManager ??= manager;
    } catch {
      // Missing candidate lockfiles are expected; keep checking supported managers.
    }
  }
  if (
    (nodeDirect.length > 0 && !packageManager) ||
    (phpDirect.length > 0 && !packageManager)
  )
    notes.push(
      "A manifest was found without a recognized lock file; reproducible installs may need review.",
    );
  return { nodeDirect, phpDirect, packageManager, notes };
}
