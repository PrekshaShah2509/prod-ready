/** Detect project ecosystems, framework signals, and conventional workspace packages.
 * @author Preksha Shah
 */
import { access, readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { ProjectInfo } from "../core/models.js";

/** Check whether a project marker exists at the given path. */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
/** Parse a JSON project manifest without failing detection on invalid input. */
async function json(
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
/** Collect direct runtime and development dependency names from a manifest. */
function depSet(pkg?: Record<string, unknown>): Set<string> {
  return new Set([
    ...Object.keys((pkg?.dependencies ?? {}) as object),
    ...Object.keys((pkg?.devDependencies ?? {}) as object),
  ]);
}
/** Identify supported technologies, analyzers, manifests, and workspace packages. */
export async function detectProject(root: string): Promise<ProjectInfo> {
  const manifests: Record<string, string> = {};
  const tech = new Set<string>();
  const analyzers = new Set<string>(["Generic"]);
  const packagePath = resolve(root, "package.json");
  const composerPath = resolve(root, "composer.json");
  const pkg = await json(packagePath);
  const composer = await json(composerPath);
  if (pkg) {
    manifests.package = packagePath;
    tech.add("Node.js");
    analyzers.add("JavaScript");
    const deps = depSet(pkg);
    if (await exists(resolve(root, "tsconfig.json"))) {
      tech.add("TypeScript");
      analyzers.add("TypeScript");
    }
    if (deps.has("react") || deps.has("react-dom")) {
      tech.add("React");
      analyzers.add("React");
    }
    if (
      deps.has("next") ||
      (await exists(resolve(root, "next.config.js"))) ||
      (await exists(resolve(root, "next.config.mjs"))) ||
      (await exists(resolve(root, "next.config.ts")))
    ) {
      tech.add("Next.js");
      analyzers.add("Next.js");
    }
  }
  if (composer || (await exists(resolve(root, "artisan")))) {
    manifests.composer = composerPath;
    tech.add("PHP");
    analyzers.add("PHP");
    const deps = depSet(composer);
    if (
      deps.has("laravel/framework") ||
      (await exists(resolve(root, "artisan")))
    ) {
      tech.add("Laravel");
      analyzers.add("Laravel");
    }
  }
  if (
    (await exists(resolve(root, "pyproject.toml"))) ||
    (await exists(resolve(root, "requirements.txt"))) ||
    (await exists(resolve(root, "setup.py")))
  )
    tech.add("Python (detection only)");
  if (
    (await exists(resolve(root, "Dockerfile"))) ||
    (await exists(resolve(root, "compose.yml"))) ||
    (await exists(resolve(root, "docker-compose.yml")))
  ) {
    tech.add("Docker");
    analyzers.add("Docker");
  }
  const isGit = await exists(resolve(root, ".git"));
  if (isGit) {
    tech.add("Git");
    analyzers.add("Git");
  }
  if (
    (await exists(resolve(root, "package-lock.json"))) ||
    (await exists(resolve(root, "yarn.lock"))) ||
    (await exists(resolve(root, "pnpm-lock.yaml"))) ||
    composer
  )
    analyzers.add("Dependencies");
  const projects: Array<{ path: string; technologies: string[] }> = [];
  // Inspect conventional workspace roots without recursively rescanning arbitrary directories.
  for (const folder of ["apps", "packages", "services"]) {
    try {
      for (const e of await readdir(resolve(root, folder), {
        withFileTypes: true,
      }))
        if (
          e.isDirectory() &&
          (await exists(resolve(root, folder, e.name, "package.json")))
        ) {
          const child = await detectProject(resolve(root, folder, e.name));
          projects.push({
            path: relative(root, child.root).replaceAll("\\", "/"),
            technologies: child.technologies,
          });
        }
    } catch {
      /* absent monorepo directory */
    }
  }
  return {
    root,
    name: String(
      pkg?.name ?? composer?.name ?? root.split(/[\\/]/).pop() ?? "project",
    ),
    technologies: [...tech],
    analyzers: [...analyzers],
    manifests,
    isGit,
    projects,
  };
}
