# Architecture

```text
CLI
  ↓
Project detector
  ↓
Analysis context
  ↓
Rule engine
  ↓
Finding aggregation
  ↓
Reporters
```

The CLI parses commands and loads configuration without executing project code. The project detector identifies manifests, frameworks, Git, Docker, and basic monorepo layout. The scanner collects eligible text files according to built-in exclusions, user configuration, and `.prod-readyignore`.

Rules implement a small `Rule` contract: metadata, an applicability check, and an analysis method that returns serializable findings. Findings contain severity, confidence, evidence, recommendation, and location where the signal has a source location. Rules are deduplicated and sorted before reporting.

Git analysis uses fixed `git -C <root>` argument arrays to collect commit/change/contributor signals. Dependency analysis reads manifests and lock-file presence only; it does not claim CVE verification. Terminal and JSON reporters are read-only; Markdown and HTML reporters create explicit requested artifacts.

To add a rule, place its metadata and implementation in `src/rules/builtins.ts`, add positive and negative fixtures, and update [rules.md](rules.md). New ecosystems should be detected in `src/detector/project.ts` and should only be listed as supported after meaningful analysis exists.
