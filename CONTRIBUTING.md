# Contributing

Checklist for every change before it's pushed. For coding rules (TypeScript,
naming, API envelope, env handling) see
[memory-bank/Conventions.md](./memory-bank/Conventions.md).

## TL;DR — before every push

```sh
pnpm verify
```

It runs the same checks as CI, in the same order:

| Step      | Command                 | Fix it with                          |
| --------- | ----------------------- | ------------------------------------ |
| format    | `pnpm format:check`     | `pnpm format`                        |
| lint      | `turbo run lint`        | fix the code — warnings count, too   |
| typecheck | `turbo run check-types` | fix the types — no `any`, no `!`     |
| test      | `turbo run test`        | fix the code or the test, never skip |
| build     | `turbo run build`       | usually a missing env default/import |

`pnpm verify --bail` stops at the first failure. If `verify` is green, CI's
`check` job will be too.

## 1. Branch

Never commit to `main` directly. Branch off an up-to-date `main`:

```sh
git switch main && git pull
git switch -c <type>/<short-kebab-description>
```

| Prefix      | For                                    | Example                        |
| ----------- | -------------------------------------- | ------------------------------ |
| `feat/`     | new behaviour                          | `feat/rate-limiting`           |
| `fix/`      | bug fixes                              | `fix/shared-tsconfig-root-dir` |
| `test/`     | tests only                             | `test/pure-functions`          |
| `chore/`    | tooling, CI, deps, config              | `chore/updating-CI-pipeline`   |
| `docs/`     | documentation only                     | `docs/contributing`            |
| `refactor/` | restructuring with no behaviour change | `refactor/github-service`      |

One branch = one concern. If you find an unrelated bug, fix it on its own branch.

## 2. Commit

[Conventional Commits](https://www.conventionalcommits.org/), with a scope when
the change lives in one package:

```
<type>(<scope>): <what changed, imperative, lowercase> (<ref>)
```

- **type:** `feat`, `fix`, `test`, `chore`, `docs`, `refactor`
- **scope:** `api`, `web`, `shared`, `db`, `ci`. Omit it for changes that
  span packages.
- **ref:** the user story or spec section it implements, when there is one:
  `(US-3)`, `(spec §6)`, `(OQ-2)`

```
feat(api): cache overviews in Supabase (spec §6)
fix(shared): define tsconfig rootDir
test: cover the pure functions (42 tests)
```

Keep commits small and self-contained. Each one should build on its own.

## 3. Checklist by kind of change

Tick the rows that apply before you push.

**Any code change**

- [ ] `pnpm verify` is green.
- [ ] No `console.log` debugging left behind.
- [ ] No secrets, tokens or `.env` files staged (`git status` / `git diff --staged`).

**New or changed logic**

- [ ] Pure logic lives in `packages/shared/src/utils` and has a
      `*.test.ts` next to it.
- [ ] API behaviour changes have a test in `apps/api/src/**/*.test.ts`.
- [ ] Tests don't hit the network or depend on the current time. Inject `now`
      and fake the fetch.

> `apps/web` has no `test` script yet, so web tests won't run in CI until
> one is added.

**Dependencies**

- [ ] Added with `pnpm add <pkg> --filter=<package>`, not by hand-editing
      `package.json`.
- [ ] `pnpm-lock.yaml` is committed in the same commit. CI installs with
      `--frozen-lockfile` and fails on a stale lockfile.
- [ ] Internal packages use `workspace:*`.

**Environment variables**

- [ ] Documented in the matching `.env.example` in the same change.
- [ ] API: read only in `apps/api/src/env.ts`.
- [ ] Web: only `NEXT_PUBLIC_*`, and never a secret.
- [ ] If it affects a build output, it's listed in `turbo.json` →
      `tasks.build.env`.
- [ ] Build and tests still pass **without** it. CI has no `.env` files and
      no secrets.

**Database**

- [ ] New migration created with `pnpm db:migration <name>`. Never edit a
      migration that's already on `main`.
- [ ] Tables stay deny-all (RLS on, no policies, no `anon`/`authenticated`
      grants).
- [ ] CI's `database` job replays every migration on a fresh Postgres and runs
      `supabase db lint`. It needs Docker, so if you don't have it locally, that
      job is your check.

**API contract**

- [ ] New request/response types live in `packages/shared/src/types/api.ts`.
- [ ] New routes go in `API_ROUTES`. No hardcoded paths in `api` or `web`.
- [ ] A new error code is added to `ApiErrorCode` **and** `STATUS_BY_CODE`.

**Docs**

- [ ] README / `memory-bank/` updated if you changed setup, commands,
      architecture or a convention.

## 4. Push and open a PR

```sh
git push -u origin <branch>
```

Then open a PR into `main`:

- **Title:** same format as a commit message.
- **Body:** what changed, why, and how you tested it. Link the issue, user
  story or spec section.
- **Screenshots** for any UI change.
- Wait for CI to go green before merging. A newer push cancels the older run
  automatically, so only the latest commit is checked.

## What CI runs

[.github/workflows/ci.yml](./.github/workflows/ci.yml) runs on every pull
request and on every push to `main`. It has two jobs, which run in parallel:

- **check:** format → lint → typecheck → test → build. It uses a Turbo cache,
  so packages you didn't touch replay their previous result.
- **database:** starts a fresh Supabase Postgres, applies all migrations, and
  lints the schema.

Each job times out after 15 minutes and has read-only access to the repo.
