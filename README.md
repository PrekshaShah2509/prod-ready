# Production Readiness CLI

> Find production risks in your codebase before your users do.

[![CI](https://github.com/PrekshaShah2509/prod-ready/actions/workflows/ci.yml/badge.svg)](https://github.com/PrekshaShah2509/prod-ready/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/prod-ready)](https://www.npmjs.com/package/prod-ready)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js)](https://nodejs.org/)

Production Readiness CLI (`prod-ready`) is a local-first analyzer for application codebases. It combines deterministic static checks, configuration inspection, dependency structure, architecture signals, and Git history to produce evidence-backed findings.

No account, API key, cloud backend, telemetry, or source-code upload is required.

## Why?

Linters, formatters, vulnerability scanners, and test runners each answer useful but narrow questions. Production readiness spans security, reliability, configuration, observability, testing, architecture, dependency hygiene, and change history. `prod-ready` brings practical repository-level signals into one local workflow; it does not guarantee security or production readiness.

## Installation

**Recommended — no install needed:**

```bash
npx prod-ready scan .
```

**Install globally:**

```bash
npm install -g prod-ready
```

**Install as a dev dependency:**

```bash
npm install --save-dev prod-ready
```

> **Tip:** `prod-ready` has **zero runtime dependencies**, so `npx` is the cleanest option — nothing gets added to your project's dependency tree.

### Peer dependency conflicts

If npm reports an `ERESOLVE` error when installing as a dev dependency, the conflict is in your project's existing peer dependencies, not in `prod-ready`. Use one of these fixes:

```bash
# Option 1 — use npx (recommended, no install needed)
npx prod-ready scan .

# Option 2 — legacy peer deps flag
npm install --save-dev prod-ready --legacy-peer-deps

# Option 3 — force (use only if Option 2 doesn't help)
npm install --save-dev prod-ready --force
```

## Quick start

```bash
npx prod-ready .
npx prod-ready scan .
prod-ready scan . --format json
prod-ready scan . --format markdown
prod-ready scan . --format html
```

Node.js 20 or later is required. Terminal and JSON output are read-only; Markdown and HTML formats write reports to the scanned directory.

## Example output

```text
Production Readiness
--------------------

Project
  Name: payments-api
  Detected: Node.js, TypeScript, Next.js, Git

Results
  CRITICAL 0
  HIGH     3
  MEDIUM   7
  LOW      5

Top findings
1. HIGH SEC001 Potential hardcoded credential
   src/config/payment.ts:42
2. MEDIUM REL001 HTTP request without explicit timeout
   src/services/api.ts:87
3. MEDIUM ARC007 Architecture hotspot
   src/services/PaymentService.ts
```

## Supported stacks

| Ecosystem  | Framework   | Status                            |
| ---------- | ----------- | --------------------------------- |
| JavaScript | Node.js     | Supported                         |
| TypeScript | TypeScript  | Supported                         |
| JavaScript | React       | Supported (targeted rules)        |
| JavaScript | Next.js     | Supported (targeted rules)        |
| PHP        | Generic PHP | Supported (targeted rules)        |
| PHP        | Laravel     | Supported (targeted rules)        |
| Python     | Python      | Detection only / planned analysis |

Docker and Git are detected when present. Repositories with `apps/`, `packages/`, or `services/` are reported as monorepos; each discovered package is identified, while scanning remains repository-wide.

## Commands

```bash
prod-ready scan . --format terminal
prod-ready scan . --severity high
prod-ready scan . --category security
prod-ready scan . --config prod-ready.config.json
prod-ready scan . --diff
prod-ready rules --category security
prod-ready init
prod-ready baseline .
```

Exit code `0` means no finding met the selected threshold, `1` means it did, and `2` indicates usage, configuration, or runtime failure.

## Rules and configuration

Rules cover credential-like assignments, private keys, dynamic execution, shell use, empty catches, timeout signals, debug/default configuration, logging/health signals, test signals, import-graph cycles/concentration, Git hotspots, and targeted framework patterns. Each finding has a severity, confidence, evidence, and recommendation.

Run `prod-ready init` to create `prod-ready.config.json` and `.prod-readyignore`. See [rules](docs/rules.md), [configuration](docs/configuration.md), and [architecture](docs/architecture.md) for exact behavior and limitations.

## CI

```yaml
- name: Production Readiness Scan
  run: npx prod-ready scan . --format json --severity high
```

The included [CI workflow](.github/workflows/ci.yml) runs build, test, lint, formatting, and a CLI fixture smoke test.

## Privacy

Production Readiness CLI is local-first. It does not upload source code, require telemetry, execute project code, install project dependencies, or use an AI API. Git commands use fixed argument arrays. See [security guidance](SECURITY.md).

## Open source

The core CLI is open source and designed to run locally. Contributions are welcome, especially new rules, analyzers, false-positive reduction, test fixtures, and documentation. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [development guide](docs/development.md).

## Contact

For bugs and feature requests, use [GitHub Issues](https://github.com/PrekshaShah2509/prod-ready/issues). For security vulnerabilities, see [SECURITY.md](SECURITY.md).

**Maintainer:** [Preksha Shah](https://preksha-shah.vercel.app/) | [GitHub](https://github.com/PrekshaShah2509) | [LinkedIn](https://www.linkedin.com/in/preksha-shah-065552183/)

## License

[MIT](LICENSE). `0.x` releases are early development; `1.0.0` will mark a stable CLI/API contract.
