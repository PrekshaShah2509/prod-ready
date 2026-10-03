/** Shared domain types for configuration, scan results, findings, and rules.
 * @author Preksha Shah
 */
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";
export type Category =
  | "security"
  | "reliability"
  | "configuration"
  | "observability"
  | "testing"
  | "architecture"
  | "dependencies"
  | "framework";

export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  category: Category;
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  evidence?: string;
  recommendation: string;
  references?: string[];
  metadata?: Record<string, unknown>;
}

export interface RuleMetadata {
  id: string;
  name: string;
  category: Category;
  defaultSeverity: Severity;
  confidence: Confidence;
  description: string;
  remediation: string;
}

export interface ProjectInfo {
  root: string;
  name: string;
  technologies: string[];
  analyzers: string[];
  manifests: Record<string, string>;
  isGit: boolean;
  projects: Array<{ path: string; technologies: string[] }>;
}

export interface GitInsight {
  commits: number;
  contributors: number;
  trackedFiles: Set<string>;
  changesByFile: Map<string, number>;
  recentChangesByFile: Map<string, number>;
  contributorsByFile: Map<string, number>;
}

export interface Config {
  severityThreshold: Severity;
  exclude: string[];
  rules: Record<string, "off" | "info" | "warning" | "error" | Severity>;
  scanPaths?: string[];
  output?: { markdownPath?: string; htmlPath?: string };
}

export interface ScanContext {
  root: string;
  project: ProjectInfo;
  config: Config;
  files: SourceFile[];
  git?: GitInsight;
  dependencyInfo?: DependencyInfo;
}

export interface SourceFile {
  path: string;
  relativePath: string;
  content: string;
  lines: string[];
  size: number;
}
export interface DependencyInfo {
  nodeDirect: string[];
  phpDirect: string[];
  packageManager?: string;
  notes: string[];
}
export interface Rule {
  meta: RuleMetadata;
  applies(context: ScanContext): boolean;
  analyze(context: ScanContext): Finding[];
}
export interface ScanResult {
  version: string;
  timestamp: string;
  project: ProjectInfo;
  findings: Finding[];
  filesAnalyzed: number;
  rulesExecuted: number;
  durationMs: number;
  git?: { commits: number; contributors: number };
  dependencyInfo?: DependencyInfo;
  limitations: string[];
}

export const severities: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];
export const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};
