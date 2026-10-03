/** Default scan behavior and validation for user-provided configuration.
 * @author Preksha Shah
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Config, Severity } from "./models.js";

export const defaultConfig: Config = {
  severityThreshold: "high",
  // Avoid scanning generated Next.js output, which often contains bundled runtime code.
  exclude: [
    "node_modules/**",
    "vendor/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".next/**",
    ".git/**",
  ],
  rules: {},
};
const validSeverity = new Set<Severity>([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

/** Load and validate project configuration, falling back only when the default file is absent. */
export async function loadConfig(
  root: string,
  configPath?: string,
): Promise<Config> {
  const file = resolve(root, configPath ?? "prod-ready.config.json");
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("must be an object");
    const input = parsed as Partial<Config>;
    if (input.severityThreshold && !validSeverity.has(input.severityThreshold))
      throw new Error("severityThreshold is invalid");
    if (input.exclude && !Array.isArray(input.exclude))
      throw new Error("exclude must be an array");
    if (input.rules && typeof input.rules !== "object")
      throw new Error("rules must be an object");
    return {
      ...defaultConfig,
      ...input,
      exclude: [...defaultConfig.exclude, ...(input.exclude ?? [])],
      rules: input.rules ?? {},
    };
  } catch (error: unknown) {
    // An omitted default file is optional; an explicitly requested file must exist and be valid.
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && !configPath)
      return defaultConfig;
    throw new Error(
      `Invalid configuration at ${file}: ${(error as Error).message}`,
    );
  }
}

/** Resolve a rule's configured severity, returning undefined when the rule is disabled. */
export function severityForRule(
  config: Config,
  ruleId: string,
  fallback: Severity,
): Severity | undefined {
  const override = config.rules[ruleId];
  if (override === "off") return undefined;
  if (override === "error") return "high";
  if (override === "warning") return "medium";
  if (override === "info") return "info";
  return override ?? fallback;
}
