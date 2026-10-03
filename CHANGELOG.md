# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows Semantic Versioning.

## [0.1.3] - 2026-10-03

### Improved

- Add dedicated Installation section to README with clear peer dependency conflict resolution options (`npx`, `--legacy-peer-deps`, `--force`).

## [0.1.2] - 2026-10-03

### Improved

- Redesign standalone HTML reports with responsive severity summaries, project metrics, accessible finding details, and print styling.
- Clarify the `npx` consumer workflow and explain existing peer-dependency conflicts.

### Fixed

- Escape dynamic HTML report content and preserve responsive layout across viewport sizes.

## [0.1.1] - 2026-10-03

### Fixed

- Exclude generated Next.js `.next/` output from default scans.
- Report sensitive environment files only when they are tracked in the Git index.

## [0.1.0] - 2026-10-03

### Added

- Local production-readiness scanning for supported JavaScript/TypeScript and PHP ecosystems.
- Project/framework detection, deterministic rules, dependency structure analysis, and Git analysis.
- Terminal, JSON, Markdown, and HTML reports.
- Configuration, ignore-file support, baselines, diff-aware filtering, and CI-friendly exit codes.
- Open-source repository documentation, issue templates, and release preparation workflows.
