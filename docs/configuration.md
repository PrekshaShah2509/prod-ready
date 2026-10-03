# Configuration

Initialize a repository with:

```bash
prod-ready init
```

It creates `prod-ready.config.json` and `.prod-readyignore` only when they are absent.

```json
{
  "severityThreshold": "high",
  "exclude": ["node_modules/**", "vendor/**", "dist/**"],
  "rules": {
    "SEC001": "error",
    "OBS001": "warning",
    "ARC007": "off"
  },
  "output": {
    "markdownPath": "production-readiness.md",
    "htmlPath": "production-readiness.html"
  }
}
```

`severityThreshold` controls the exit-code gate. Valid values are `critical`, `high`, `medium`, `low`, and `info`. `exclude` is combined with built-in exclusions and ignore-file patterns. Built-in exclusions include generated Next.js `.next/` output. `rules` accepts `off`, `info`, `warning`, `error`, or an explicit severity; `error` maps to high and `warning` maps to medium. `output` controls the paths written only by `--format markdown` and `--format html`.

Use a different file with `--config path/to/config.json`; malformed configuration exits with code 2. `.prod-readyignore` accepts basic folder and wildcard patterns, for example `generated/` and `coverage/**`.

For CI, choose a threshold explicitly:

```bash
prod-ready scan . --format json --severity high
```

The scanner also supports `baseline` and `--diff`. Baselines are saved as `.prod-ready-baseline.json`; `--diff` limits results to files changed in recent Git history when available.
