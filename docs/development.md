# Development

## Requirements

- Node.js 20 or later
- npm (the committed lock file is npm format)
- Git, for Git-history tests and analysis

## Setup

```bash
git clone https://github.com/PrekshaShah2509/prod-ready.git
cd prod-ready
npm install
```

## Validate

```bash
npm run build
npm test
npm run lint
npm run format:check
```

`lint` is the strict TypeScript typecheck. There is no watch-mode script yet; run the local built CLI directly:

```bash
node dist/cli.js scan .
node dist/cli.js --help
```

Before publication, inspect package contents with `npm pack --dry-run`. The package intentionally contains only the build output, README, and license.
