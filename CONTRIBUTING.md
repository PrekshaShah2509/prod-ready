# Contributing

Contributions are welcome. Please search existing issues before opening a new one and keep pull requests focused.

## Before a pull request

1. Fork the project and create a focused branch.
2. Install dependencies with `npm install`.
3. Run `npm test`, `npm run lint`, `npm run build`, and `npm run format:check`.
4. Update documentation when behavior or a rule changes.
5. Do not include secrets, generated reports, or unrelated refactors.

## Branch workflow

Create short-lived branches from the latest `main` branch. Use a descriptive prefix such as `feat/`, `fix/`, `docs/`, `chore/`, or `security/` (for example, `fix/report-path`).

Open pull requests against `main`; do not push directly to it. Keep each pull request focused and wait for the required CI checks. Maintainers normally squash-merge approved pull requests and delete the source branch after merging.

## Commit messages

Use the Conventional Commits format:

```text
<type>(<optional scope>): <imperative summary>
```

Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, and `revert`. Keep the subject concise, use the imperative mood, and omit the trailing period.

Examples:

```text
feat(rules): detect unhandled async operations
fix(reporting): reject symlink escapes
docs: explain baseline behavior
```

Mark breaking changes with `!` after the type or scope, and describe the impact in the commit body or a `BREAKING CHANGE:` footer.

## Adding a rule

1. Add complete metadata and a deterministic implementation in `src/rules/builtins.ts`.
2. Add a positive fixture and a negative fixture.
3. Add unit or integration assertions for the rule ID and evidence.
4. Update `docs/rules.md`.
5. Check false-positive behavior on representative code.

Prefer 10 reliable rules over 100 noisy rules. Findings must communicate observed evidence, a calibrated confidence level, and a practical recommendation.

## Pull requests

Include the problem being solved, tests run, and any limitations. Maintainers may request smaller scope, stronger evidence, or false-positive fixtures before merging.
