# Maintainer information

- **Maintainer:** Preksha Shah
- **Email:** [prekshashah.consult@gmail.com](mailto:prekshashah.consult@gmail.com)
- **GitHub:** [PrekshaShah2509](https://github.com/PrekshaShah2509)
- **Website:** [preksha-shah.vercel.app](https://preksha-shah.vercel.app/)
- **LinkedIn:** [Preksha Shah](https://www.linkedin.com/in/preksha-shah-065552183/)
- **Repository:** `https://github.com/PrekshaShah2509/prod-ready`

This information is used for project stewardship and responsible disclosure. Use GitHub Issues for normal bugs and feature requests; use the security email only for responsible vulnerability reports.

## Package releases

The [release workflow](../.github/workflows/release.yml) publishes the public npm package when a `v*` tag is pushed. Before releasing:

1. Update the version in `package.json` and document user-visible changes in `CHANGELOG.md` on `main`.
2. Run `npm test`, `npm run lint`, `npm run format:check`, and `npm pack --dry-run` against the release commit.
3. Configure npm trusted publishing for `PrekshaShah2509/prod-ready`, workflow `.github/workflows/release.yml`, and GitHub environment `npm`.
4. Confirm the tag matches the package version, then push a tag such as `v0.1.1` from the verified `main` commit.

The workflow runs validation and publishes with provenance using GitHub Actions OIDC. If using `workflow_dispatch`, select only a verified `main` ref; manual dispatch can publish the selected ref.
