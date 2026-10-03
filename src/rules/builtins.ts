/** Built-in evidence-based static analysis rules and import-graph checks.
 * @author Preksha Shah
 */
import type {
  Finding,
  Rule,
  RuleMetadata,
  ScanContext,
  SourceFile,
  Severity,
} from "../core/models.js";
import { lineAt } from "../core/files.js";
import { severityForRule } from "../core/config.js";

/** Select supported source files for general code rules. */
const codeFiles = (c: ScanContext) =>
  c.files.filter((f) => /\.(?:[cm]?[jt]sx?|php)$/i.test(f.relativePath));
/** Exclude test sources from rules intended for application code. */
const webFiles = (c: ScanContext) =>
  codeFiles(c).filter(
    (f) => !/(?:\.test\.|\.spec\.|__tests__)/.test(f.relativePath),
  );
/** Build a finding while applying configured severity and bounding evidence. */
function finding(
  c: ScanContext,
  meta: RuleMetadata,
  file: SourceFile | undefined,
  index: number,
  evidence: string,
  overrides: Partial<Finding> = {},
): Finding | undefined {
  const severity = severityForRule(c.config, meta.id, meta.defaultSeverity);
  if (!severity) return undefined;
  return {
    id: `${meta.id}:${file?.relativePath ?? "project"}:${index}`,
    ruleId: meta.id,
    severity,
    confidence: meta.confidence,
    category: meta.category,
    title: meta.name,
    description: meta.description,
    file: file?.relativePath,
    line: file ? lineAt(file.content, index) : undefined,
    evidence: evidence.slice(0, 280),
    recommendation: meta.remediation,
    ...overrides,
  };
}
/** Create a rule that reports regex matches across eligible files. */
function regexRule(
  meta: RuleMetadata,
  pattern: RegExp,
  filter: (f: SourceFile) => boolean = () => true,
  transform?: (m: RegExpExecArray, f: SourceFile) => string,
): Rule {
  return {
    meta,
    applies: () => true,
    /** Collect transformed regex matches as findings for this rule. */
    analyze(c) {
      const out: Finding[] = [];
      for (const file of c.files.filter(filter)) {
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(file.content))) {
          const evidence = transform?.(m, file) ?? m[0];
          if (evidence) {
            const value = finding(c, meta, file, m.index, evidence);
            if (value) out.push(value);
          }
          if (!pattern.global) break;
        }
      }
      return out;
    },
  };
}
const metas: Record<string, RuleMetadata> = {
  SEC001: {
    id: "SEC001",
    name: "Potential hardcoded credential",
    category: "security",
    defaultSeverity: "high",
    confidence: "high",
    description: "A credential-like value is assigned directly in source code.",
    remediation:
      "Move the value to a secret manager or environment variable, rotate it if real, and remove it from history.",
  },
  SEC002: {
    id: "SEC002",
    name: "Private key detected",
    category: "security",
    defaultSeverity: "critical",
    confidence: "high",
    description: "Private key material appears in a repository file.",
    remediation:
      "Revoke and rotate the key immediately; store keys outside source control.",
  },
  SEC004: {
    id: "SEC004",
    name: "Sensitive environment file tracked",
    category: "security",
    defaultSeverity: "high",
    confidence: "high",
    description: "A non-example .env file is present in a Git repository.",
    remediation:
      "Remove it from Git tracking, rotate exposed values, and commit an .env.example instead.",
  },
  SEC006: {
    id: "SEC006",
    name: "Dangerous dynamic code execution",
    category: "security",
    defaultSeverity: "high",
    confidence: "high",
    description: "Dynamic code execution was observed.",
    remediation:
      "Avoid eval-style execution; use a constrained parser or explicit dispatch table.",
  },
  SEC007: {
    id: "SEC007",
    name: "Unsafe shell command construction",
    category: "security",
    defaultSeverity: "high",
    confidence: "medium",
    description: "A shell command is constructed with interpolated input.",
    remediation:
      "Use argument arrays and validate untrusted input; do not invoke a shell unless essential.",
  },
  REL001: {
    id: "REL001",
    name: "HTTP request without explicit timeout",
    category: "reliability",
    defaultSeverity: "medium",
    confidence: "medium",
    description:
      "An outbound HTTP call does not show an explicit timeout in its local call options.",
    remediation: "Set a bounded timeout and handle timeout failures.",
  },
  REL002: {
    id: "REL002",
    name: "Empty catch block",
    category: "reliability",
    defaultSeverity: "medium",
    confidence: "high",
    description: "A catch block has no handling behavior.",
    remediation:
      "Handle, log, or explicitly document why the error can be ignored.",
  },
  REL005: {
    id: "REL005",
    name: "Missing graceful shutdown handling",
    category: "reliability",
    defaultSeverity: "low",
    confidence: "low",
    description:
      "A server-like project has no visible SIGTERM/SIGINT shutdown handler.",
    remediation:
      "Handle termination signals and close listeners, queues, and database connections.",
  },
  REL007: {
    id: "REL007",
    name: "Fire-and-forget async operation",
    category: "reliability",
    defaultSeverity: "medium",
    confidence: "medium",
    description:
      "An async call appears not to be awaited, returned, or error-handled.",
    remediation:
      "Await the operation or deliberately attach error handling and document background behavior.",
  },
  CFG001: {
    id: "CFG001",
    name: "Debug mode enabled",
    category: "configuration",
    defaultSeverity: "medium",
    confidence: "high",
    description: "A debug setting is explicitly enabled.",
    remediation:
      "Ensure debug behavior is disabled in production configuration.",
  },
  CFG003: {
    id: "CFG003",
    name: "Hardcoded environment-specific URL",
    category: "configuration",
    defaultSeverity: "low",
    confidence: "medium",
    description:
      "A localhost or private environment URL appears in application code.",
    remediation:
      "Use validated environment configuration for deployment-specific endpoints.",
  },
  CFG006: {
    id: "CFG006",
    name: "Default credential detected",
    category: "configuration",
    defaultSeverity: "high",
    confidence: "high",
    description: "A known default credential is configured.",
    remediation:
      "Replace default credentials and use a unique secret from environment configuration.",
  },
  OBS001: {
    id: "OBS001",
    name: "No obvious structured logging",
    category: "observability",
    defaultSeverity: "low",
    confidence: "low",
    description:
      "No common structured logging library was detected in a server project.",
    remediation:
      "Use structured logs with stable fields appropriate for your operations tooling.",
  },
  OBS002: {
    id: "OBS002",
    name: "Console logging in production-oriented code",
    category: "observability",
    defaultSeverity: "low",
    confidence: "medium",
    description: "Console logging appears in source code.",
    remediation:
      "Use a structured logger or ensure console output is intentional and redacted.",
  },
  OBS003: {
    id: "OBS003",
    name: "Missing obvious health-check endpoint",
    category: "observability",
    defaultSeverity: "low",
    confidence: "low",
    description: "A server project has no obvious health endpoint.",
    remediation:
      "Add an authenticated or appropriately exposed health/readiness endpoint.",
  },
  TST001: {
    id: "TST001",
    name: "No obvious test suite detected",
    category: "testing",
    defaultSeverity: "medium",
    confidence: "medium",
    description: "No test files or recognized test configuration were found.",
    remediation:
      "Add automated tests for important behavior and failure modes.",
  },
  TST003: {
    id: "TST003",
    name: "Large module without corresponding test",
    category: "testing",
    defaultSeverity: "medium",
    confidence: "medium",
    description: "A large source module has no same-name test file.",
    remediation:
      "Prioritize focused tests for this module's behavior and error cases.",
  },
  ARC001: {
    id: "ARC001",
    name: "Very large source file",
    category: "architecture",
    defaultSeverity: "medium",
    confidence: "high",
    description: "A source file exceeds 500 lines.",
    remediation:
      "Review whether the module has separable responsibilities; keep cohesive code together.",
  },
  ARC003: {
    id: "ARC003",
    name: "Circular dependency",
    category: "architecture",
    defaultSeverity: "high",
    confidence: "high",
    description: "A local import cycle was detected.",
    remediation:
      "Break the cycle through dependency inversion, extraction, or a shared lower-level module.",
  },
  ARC004: {
    id: "ARC004",
    name: "High fan-in module",
    category: "architecture",
    defaultSeverity: "medium",
    confidence: "medium",
    description: "A module has many direct local importers.",
    remediation:
      "Review this high-leverage module's interface, tests, and change process.",
  },
  ARC005: {
    id: "ARC005",
    name: "High fan-out module",
    category: "architecture",
    defaultSeverity: "medium",
    confidence: "medium",
    description: "A module imports many local modules.",
    remediation:
      "Review whether orchestration and separate responsibilities can be simplified.",
  },
  ARC007: {
    id: "ARC007",
    name: "Architecture hotspot",
    category: "architecture",
    defaultSeverity: "medium",
    confidence: "medium",
    description: "Git history shows unusually frequent changes to this file.",
    remediation:
      "Review this hotspot for change drivers, ownership, and test coverage.",
  },
  ARC008: {
    id: "ARC008",
    name: "Highly changed module with many dependents",
    category: "architecture",
    defaultSeverity: "high",
    confidence: "medium",
    description:
      "A file is both frequently changed and imported by many modules.",
    remediation:
      "Review boundaries, regression tests, and ownership before further changes.",
  },
  REACT001: {
    id: "REACT001",
    name: "List rendering without stable key",
    category: "framework",
    defaultSeverity: "medium",
    confidence: "medium",
    description: "A JSX map callback returns JSX without a visible key prop.",
    remediation:
      "Provide a stable, data-derived key to preserve component identity.",
  },
  REACT004: {
    id: "REACT004",
    name: "Direct DOM manipulation",
    category: "framework",
    defaultSeverity: "low",
    confidence: "medium",
    description: "Direct DOM access appears in a React project.",
    remediation:
      "Prefer refs and declarative rendering unless imperative DOM access is necessary.",
  },
  NEXT002: {
    id: "NEXT002",
    name: "Potential sensitive public environment variable",
    category: "framework",
    defaultSeverity: "high",
    confidence: "high",
    description:
      "A NEXT_PUBLIC variable name appears to contain sensitive material.",
    remediation:
      "Do not expose secrets through NEXT_PUBLIC variables; use server-only environment variables.",
  },
  NODE002: {
    id: "NODE002",
    name: "Dangerous child_process usage",
    category: "framework",
    defaultSeverity: "high",
    confidence: "medium",
    description: "A child process API is used with a string command.",
    remediation:
      "Use execFile/spawn with argument arrays, validate inputs, and avoid shell execution.",
  },
  PHP001: {
    id: "PHP001",
    name: "Dangerous PHP dynamic execution",
    category: "framework",
    defaultSeverity: "high",
    confidence: "high",
    description: "A dangerous PHP dynamic execution primitive was found.",
    remediation:
      "Remove dynamic execution or tightly constrain it with explicit allowlists.",
  },
  LAR001: {
    id: "LAR001",
    name: "Laravel APP_DEBUG enabled",
    category: "framework",
    defaultSeverity: "high",
    confidence: "high",
    description: "Laravel debug mode is enabled in an environment file.",
    remediation:
      "Set APP_DEBUG=false in production and prevent environment files from being committed.",
  },
  LAR004: {
    id: "LAR004",
    name: "Laravel mass-assignment exposure",
    category: "framework",
    defaultSeverity: "medium",
    confidence: "medium",
    description: "A model uses an unguarded mass-assignment configuration.",
    remediation:
      "Define $fillable or carefully constrain $guarded and validate all input.",
  },
};

/** Adapt a project-level predicate into the shared rule interface. */
function projectRule(
  meta: RuleMetadata,
  applicable: (c: ScanContext) => boolean,
  report: (c: ScanContext) => Finding | undefined,
): Rule {
  return {
    meta,
    applies: applicable,
    /** Convert the project-level result to the rule interface's finding list. */
    analyze: (c) => {
      const f = report(c);
      return f ? [f] : [];
    },
  };
}
/** Extract relative import and require targets from a source file. */
function imports(file: SourceFile): string[] {
  return [
    ...file.content.matchAll(
      /(?:import\s+(?:[^'";]+?\s+from\s+)?|require\s*\()["']([^"']+)["']/g,
    ),
  ]
    .map((m) => m[1])
    .filter((x) => x.startsWith("."));
}
/** Assemble the supported built-in static and project-level rules. */
export function builtinRules(): Rule[] {
  const source = (f: SourceFile) =>
    /\.(?:[cm]?[jt]sx?|php)$/i.test(f.relativePath);
  const rules: Rule[] = [
    // Never echo credential-like values into terminal, JSON, or generated reports.
    regexRule(
      metas.SEC001,
      /(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/gi,
      source,
      (match) =>
        match[0].replace(/([:=]\s*["'])[^"']+(["'])/, "$1[REDACTED]$2"),
    ),
    regexRule(
      metas.SEC002,
      /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/g,
      () => true,
    ),
    regexRule(metas.SEC006, /\b(?:eval|Function)\s*\(/g, source),
    regexRule(
      metas.SEC007,
      /(?:exec|system|shell_exec)\s*\(\s*[`"'][^`"']*(?:\$\{|\$\w+)/g,
      source,
    ),
    regexRule(metas.REL002, /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g, source),
    regexRule(
      metas.REL001,
      /\b(?:fetch|axios\.(?:get|post|put|delete)|https?\.request)\s*\([^;\n]{0,240}\)/g,
      (f) => /\.(?:[cm]?[jt]sx?)$/i.test(f.relativePath),
      (m) =>
        m[0].includes("timeout") || m[0].includes("AbortSignal") ? "" : m[0],
    ),
    regexRule(
      metas.CFG001,
      /(?:APP_DEBUG|DEBUG)\s*=?\s*(?:true|1)|debug\s*[:=]\s*true/gi,
      (f) => /(?:\.env|\.(?:[cm]?[jt]s|php|json))$/i.test(f.relativePath),
    ),
    regexRule(
      metas.CFG003,
      /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+)(?::\d+)?/g,
      source,
    ),
    regexRule(
      metas.CFG006,
      /(?:password|pass)\s*[:=]\s*["'](?:admin|password|changeme|secret)["']/gi,
      source,
    ),
    regexRule(metas.OBS002, /console\.(?:log|debug|info)\s*\(/g, (f) =>
      /\.(?:[cm]?[jt]sx?)$/i.test(f.relativePath),
    ),
    regexRule(
      metas.REACT001,
      /\.map\s*\([^=]*=>\s*\(?\s*<(?!(?:[^>]*\bkey=))/g,
      (f) => /\.(?:[cm]?[jt]sx?)$/i.test(f.relativePath),
    ),
    regexRule(
      metas.REACT004,
      /document\.(?:querySelector|getElementById|createElement)\s*\(/g,
      (f) => /\.(?:[cm]?[jt]sx?)$/i.test(f.relativePath),
    ),
    regexRule(
      metas.NEXT002,
      /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)[A-Z0-9_]*/g,
      (f) => /\.(?:[cm]?[jt]sx?|env)$/i.test(f.relativePath),
    ),
    regexRule(metas.NODE002, /(?:exec|execSync)\s*\(\s*[`"']/g, (f) =>
      /\.(?:[cm]?[jt]sx?)$/i.test(f.relativePath),
    ),
    regexRule(metas.PHP001, /\b(?:eval|assert|create_function)\s*\(/g, (f) =>
      /\.php$/i.test(f.relativePath),
    ),
    regexRule(metas.LAR004, /protected\s+\$guarded\s*=\s*\[\s*\]/g, (f) =>
      /\.php$/i.test(f.relativePath),
    ),
  ];
  rules.push(
    projectRule(
      metas.SEC004,
      (c) => c.project.isGit,
      (c) => {
        const f = c.files.find(
          (x) =>
            /(^|\/)\.env(?:\.[^/]+)?$/.test(x.relativePath) &&
            !x.relativePath.endsWith(".example"),
        );
        return f ? finding(c, metas.SEC004, f, 0, f.relativePath) : undefined;
      },
    ),
  );
  rules.push(
    projectRule(
      metas.REL005,
      (c) => c.project.technologies.includes("Node.js"),
      (c) =>
        /process\.on\s*\(\s*["']SIG(?:TERM|INT)/.test(
          codeFiles(c)
            .map((f) => f.content)
            .join("\n"),
        )
          ? undefined
          : finding(
              c,
              metas.REL005,
              undefined,
              0,
              "No process SIGTERM/SIGINT handler found",
            ),
    ),
  );
  rules.push(
    projectRule(
      metas.OBS001,
      (c) => c.project.technologies.includes("Node.js"),
      (c) =>
        /\b(?:pino|winston|bunyan)\b/.test(
          c.files.map((f) => f.content).join("\n"),
        )
          ? undefined
          : finding(
              c,
              metas.OBS001,
              undefined,
              0,
              "No pino, winston, or bunyan usage found",
            ),
    ),
  );
  rules.push(
    projectRule(
      metas.OBS003,
      (c) => c.project.technologies.includes("Node.js"),
      (c) =>
        /(?:\/health|\/healthz|\/ready|\/status)/.test(
          codeFiles(c)
            .map((f) => f.content)
            .join("\n"),
        )
          ? undefined
          : finding(
              c,
              metas.OBS003,
              undefined,
              0,
              "No obvious health route found",
            ),
    ),
  );
  rules.push(
    projectRule(
      metas.TST001,
      () => true,
      (c) =>
        c.files.some((f) =>
          /(?:\.test\.|\.spec\.|__tests__|\/test\/)/.test(f.relativePath),
        )
          ? undefined
          : finding(c, metas.TST001, undefined, 0, "No test files detected"),
    ),
  );
  rules.push({
    meta: metas.TST003,
    applies: () => true,
    /** Find large application files that have no nearby test file. */
    analyze(c) {
      return webFiles(c)
        .filter(
          (f) =>
            f.lines.length > 300 &&
            !c.files.some(
              (t) =>
                t.relativePath.includes(
                  f.relativePath.replace(/\.[^.]+$/, ".test."),
                ) ||
                t.relativePath.includes(
                  f.relativePath.replace(/\.[^.]+$/, ".spec."),
                ),
            ),
        )
        .map((f) => finding(c, metas.TST003, f, 0, `${f.lines.length} lines`)!)
        .filter(Boolean);
    },
  });
  rules.push({
    meta: metas.ARC001,
    applies: () => true,
    /** Report application files exceeding the architecture size threshold. */
    analyze(c) {
      return webFiles(c)
        .filter((f) => f.lines.length > 500)
        .map((f) => finding(c, metas.ARC001, f, 0, `${f.lines.length} lines`)!)
        .filter(Boolean);
    },
  });
  rules.push(
    importGraphRule(metas.ARC003, "cycles"),
    importGraphRule(metas.ARC004, "fanin"),
    importGraphRule(metas.ARC005, "fanout"),
  );
  rules.push(
    projectRule(
      metas.LAR001,
      (c) => c.project.technologies.includes("Laravel"),
      (c) => {
        const f = c.files.find(
          (x) =>
            /(^|\/)\.env$/.test(x.relativePath) &&
            /APP_DEBUG\s*=\s*(true|1)/i.test(x.content),
        );
        return f
          ? finding(
              c,
              metas.LAR001,
              f,
              f.content.search(/APP_DEBUG/i),
              "APP_DEBUG=true",
            )
          : undefined;
      },
    ),
  );
  rules.push({
    meta: metas.ARC007,
    applies: (c) => Boolean(c.git),
    /** Report frequently changed files as potential maintenance hotspots. */
    analyze(c) {
      const out: Finding[] = [];
      for (const f of webFiles(c)) {
        const changes = c.git?.recentChangesByFile.get(f.relativePath) ?? 0;
        if (changes >= 10) {
          const x = finding(
            c,
            metas.ARC007,
            f,
            0,
            `${changes} changes in last 90 days`,
            {
              metadata: {
                changesLast90Days: changes,
                contributors:
                  c.git?.contributorsByFile.get(f.relativePath) ?? 0,
              },
            },
          );
          if (x) out.push(x);
        }
      }
      return out;
    },
  });
  rules.push({
    meta: metas.ARC008,
    applies: (c) => Boolean(c.git),
    /** Combine recent churn with direct dependents to find central hotspots. */
    analyze(c) {
      const graph = buildGraph(c);
      const out: Finding[] = [];
      for (const [path, parents] of graph.reverse) {
        const changes = c.git?.recentChangesByFile.get(path) ?? 0;
        if (changes >= 5 && parents.size >= 5) {
          const file = c.files.find((f) => f.relativePath === path);
          const x = finding(
            c,
            metas.ARC008,
            file,
            0,
            `${changes} changes / 90 days; ${parents.size} direct dependents`,
            {
              metadata: {
                changesLast90Days: changes,
                dependents: parents.size,
              },
            },
          );
          if (x) out.push(x);
        }
      }
      return out;
    },
  });
  return rules;
}
/** Build forward and reverse maps of resolvable local imports. */
function buildGraph(c: ScanContext): {
  forward: Map<string, Set<string>>;
  reverse: Map<string, Set<string>>;
} {
  const paths = new Set(
    webFiles(c).map((f) =>
      f.relativePath.replace(/\.(?:[cm]?[jt]sx?|php)$/, ""),
    ),
  );
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  for (const f of webFiles(c)) {
    const key = f.relativePath.replace(/\.(?:[cm]?[jt]sx?|php)$/, "");
    const edges = new Set<string>();
    for (const raw of imports(f)) {
      const normalized = raw.replace(/^\.\//, "");
      const base = f.relativePath
        .split("/")
        .slice(0, -1)
        .concat(normalized.split("/"))
        .join("/")
        .replace(/\/[^/]+\/\.\./g, "");
      const target = [...paths].find(
        (p) => p === base || p === `${base}/index`,
      );
      if (target) edges.add(target);
    }
    forward.set(key, edges);
    for (const target of edges) {
      const set = reverse.get(target) ?? new Set<string>();
      set.add(key);
      reverse.set(target, set);
    }
  }
  return { forward, reverse };
}
/** Create a rule that checks import cycles or unusually high graph degree. */
function importGraphRule(
  meta: RuleMetadata,
  kind: "cycles" | "fanin" | "fanout",
): Rule {
  return {
    meta,
    applies: () => true,
    /** Analyze import edges according to this rule's selected graph pattern. */
    analyze(c) {
      const graph = buildGraph(c);
      const out: Finding[] = [];
      if (kind === "cycles") {
        for (const [a, targets] of graph.forward)
          for (const b of targets)
            if (graph.forward.get(b)?.has(a) && a < b) {
              const f = c.files.find(
                (x) =>
                  x.relativePath.replace(/\.(?:[cm]?[jt]sx?|php)$/, "") === a,
              );
              const x = finding(c, meta, f, 0, `${a} ↔ ${b}`);
              if (x) out.push(x);
            }
      } else {
        const map = kind === "fanin" ? graph.reverse : graph.forward;
        for (const [path, edges] of map)
          if (edges.size >= 8) {
            const f = c.files.find(
              (x) =>
                x.relativePath.replace(/\.(?:[cm]?[jt]sx?|php)$/, "") === path,
            );
            const x = finding(
              c,
              meta,
              f,
              0,
              `${edges.size} direct ${kind === "fanin" ? "dependents" : "imports"}`,
            );
            if (x) out.push(x);
          }
      }
      return out;
    },
  };
}
/** Return metadata for all built-in rules. */
export const allRuleMetadata = (): RuleMetadata[] =>
  builtinRules().map((r) => r.meta);
