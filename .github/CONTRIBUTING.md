# Contributing to Wake Up Babe

Thanks for wanting to help. This is a small, opinionated codebase, contributions are welcome, and the bar is "would the maintainer have written it this way".

## Before you start

- **Bugs**: open an issue with reproduction steps. If you can fix it, say so in the issue and go ahead.
- **Features**: open an issue first. The product is deliberately tiny (one marker: the red event color; one channel: a phone call), so features that add UI surface or configuration need a strong case.
- **Security problems**: never a public issue, see [SECURITY.md](SECURITY.md).

## Development setup

Prerequisites: Node ≥ 22 and [pnpm](https://pnpm.io) (version pinned in `package.json`).

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # fill in secrets
pnpm -C apps/api db:migrate:local                  # create/refresh local D1
pnpm -C apps/api dev                               # worker on :8787
```

The README's [Development](../README.md#development) section covers the details: manual cron triggering, local D1 state, OAuth redirect URIs, and tunneling for real phone calls.

## Checks

Everything CI runs, you can run locally:

```sh
pnpm lint        # biome
pnpm typecheck   # tsc across the workspace
pnpm test        # vitest (apps/api)
pnpm build       # next builds
```

Lefthook runs lint on commit. Don't fight the formatter, `pnpm lint:fix` resolves most complaints.

## Pull requests

- Keep PRs focused; one change per PR.
- Follow the existing commit style, conventional commits scoped to the app, e.g. `feat(api): …`, `fix(dashboard): …`, `chore: …`.
- Add or update tests for behavior changes in `apps/api`.
- New third-party services, scopes, or permissions (especially anything beyond `calendar.events.readonly`) will not be merged without prior discussion.

## Licensing

The project is [AGPL-3.0-only](../LICENSE). By contributing, you agree your contributions are licensed under the same terms (inbound = outbound).
