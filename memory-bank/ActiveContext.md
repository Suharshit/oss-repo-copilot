# Active Context

**Last updated:** 2026-09-05

## Current status

The monorepo is **structurally complete and wired end to end**. The product logic
is not built yet — one route works against real data, two are blocked on the LLM
integration.

### Phase

Spec is drafted and at its review gate (`spec.md` §8 — the last two checkboxes,
"MVP spec doc finalized" and "spec reviewed once more", are still unticked).
Scaffolding is done. Feature work has not started.

### What works right now

| Piece                       | State                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| Turborepo + pnpm workspaces | 5 packages, task graph configured                                     |
| `apps/web`                  | builds and serves; UI shell in place (nav + repo URL input)           |
| `apps/api`                  | boots, serves, error handling verified                                |
| `GET /health`               | working                                                               |
| `GET /v1/issues`            | **working against live GitHub** — fetches, filters PRs, scores, ranks |
| `POST /v1/overview`         | route + validation work; 500s at the LLM stub                         |
| `POST /v1/brief`            | route + validation work; 500s at the LLM stub                         |
| `@repo/shared`              | types, utils, constants, UI all in place                              |
| Web → API typed client      | `apps/web/lib/api.ts`, contract shared with the server                |
| Supabase schema             | **applied to the remote and verified** — 5 tables, RLS deny-all       |
| Supabase CLI                | linked to `bvibmfdyxpsevfiukrqa`; `pnpm db:push` works                |
| CI                          | `lint` → `check-types` → `build` on every push and PR                 |

Verified by smoke test: `/v1/issues?url=https://github.com/vercel/turborepo`
returns a scored, ranked issue list; a malformed URL returns
`400 invalid_github_url`.

### Known issues

1. **No Docker installed**, so the local Supabase stack (`pnpm db:start`,
   `pnpm db:reset`) cannot run, and `pnpm db:diff` cannot build its shadow
   database. The remote project is the only working database. Drift is checked
   with `supabase migration list` instead. Install Docker Desktop to get a
   local one.
2. **`apps/api` is not deployed** (OQ-4). Hono has no Vercel handler in the repo
   yet, and indexing work may need longer execution times than serverless
   functions allow — so the target is still open.
3. **`apps/web` is not deployed.** The Vercel project has to be created from the
   dashboard; settings are in the README.

## Recent activities

### Monorepo restructure (2026-09-05)

Turned the `create-turbo` starter into the project's real shape.

- **Removed** `apps/docs` and `packages/ui` — both were scaffolding.
- **Created `packages/shared`** (`@repo/shared`): types derived from the spec's
  data model, utils (GitHub URL parsing, friendliness scoring, formatting),
  constants (route paths, TTLs, label lists, ports), and the three UI components
  folded in from `packages/ui`. Split export subpaths keep React out of the API.
- **Created `apps/api`**: Hono + `@hono/node-server`, four routes, a real GitHub
  service, a stubbed LLM service, boot-time env parsing, and `HttpError` →
  status mapping. `tsx watch` for dev, esbuild bundle for build.
- **Updated `apps/web`**: swapped `@repo/ui` for `@repo/shared`, added
  `transpilePackages`, added the typed API client in `lib/api.ts`, added
  `.env.example`.
- **Updated root**: `turbo.json` gained `dist/**` outputs, a `start` task and an
  `env` allowlist; rewrote `README.md`; added `.prettierignore`.
- **Verified**: `check-types`, `lint` and `build` all passed, and the built API
  was smoke-tested against the live GitHub API.

### Supabase connected (2026-09-05)

Phase 2. Database is live; nothing reads or writes it from code yet.

- Installed the Supabase CLI as a pinned root devDependency (2.116.0) and ran
  `supabase init`.
- Trimmed `config.toml` to MVP scope: only `api`, `db` and `studio` enabled,
  each disabled service annotated with the decision that rules it out (D-17).
  Set `auto_expose_new_tables = false`.
- Wrote `supabase/migrations/20260905101420_init_mvp_schema.sql` — five tables
  (`repos`, `repo_overviews`, `repo_conventions`, `issues`,
  `contribution_briefs`), constraints, partial index for the US-2 query,
  cascade FKs, an `updated_at` trigger, and deny-all RLS (D-18).
- **Applied it to the remote project OSS-Repo-Copilot** (`bvibmfdyxpsevfiukrqa`)
  and verified: RLS on with 0 policies on all five, `anon`/`authenticated`
  cannot select, `service_role` can; constraints reject out-of-range scores,
  invalid owners, blank summaries and case-insensitive duplicates; cascade
  deletes clear dependents; the `updated_at` trigger fires. Advisors return only
  expected INFO notices.
- Renamed the local migration file to match the version the remote recorded, so
  `db push` won't try to re-apply it.
- Added `SUPABASE_URL` / `SUPABASE_SECRET_KEY` to `apps/api/src/env.ts`,
  `.env.example` and the Turbo env allowlist; added `db:*` scripts to the root
  `package.json`; added an intentionally empty `seed.sql`.

### Scaffold finished (2026-09-05)

Closed out the remaining setup phases from
[`building-context/initial-setup.md`](./building-context/initial-setup.md).

- **Linked the CLI** to the remote project, so `pnpm db:push` and
  `pnpm migration list` work. Confirmed local and remote both sit at migration
  `20260905101420`, and all five tables are present with RLS on.
- **Aligned the toolchain** with the declared `packageManager`. The lockfile had
  been resolved by pnpm 9; under pnpm 11 a clean `--frozen-lockfile` install
  failed two gates — the supply-chain policy rejected `jose@6.2.12` (transitive
  via the Supabase CLI, inside the `minimumReleaseAge` cutoff, re-resolved to
  6.2.11), and `esbuild`'s postinstall was blocked until allowed in
  `pnpm-workspace.yaml` under `allowBuilds`.
- **Added CI** (`.github/workflows/ci.yml`): lint, check-types and build on
  every push and PR. Uses pnpm, not npm — `workspace:*` deps rule npm out.
- **Added a root `.env.example`** listing every variable the code reads, and
  un-ignored `apps/web/.env.example`, which `.env*` had been swallowing.
- **Built the UI shell** — nav with a logo placeholder, headline, and the repo
  URL input, replacing the create-turbo starter page. Submit is inert. Added
  the `ui-button` styles the shared `Button` expects, and deleted seven unused
  starter SVGs.
- **Skipped the auth phase** of the setup doc. It called for Supabase Auth with
  `/login` and `/dashboard`, which contradicts spec §3 (no user accounts), D-01
  (no end-user auth) and D-17 (`auth` disabled in `config.toml`). Recorded as
  D-21.

### Memory bank created (2026-09-05)

This folder — `ProjectBreif.md`, `Architecture.md`, `Conventions.md`,
`Decisions.md`, `ActiveContext.md`.

## Next steps

### Immediate

1. Create the Vercel project for `apps/web` from the dashboard (root directory
   `apps/web`, and the env vars listed in `.env.example`). First-time project
   creation needs a dashboard login.
2. Install Docker Desktop if you want a local database to develop against.

### Feature work, in dependency order

3. **Repo content fetching** (`services/github.ts`): file tree, README,
   `MANIFEST_FILES`, `DOC_FILES`. Everything downstream needs this.
4. **Wire the Anthropic calls** in `services/llm.ts` — `generateOverview` first,
   since US-1 is the entry point of the product. This unblocks `POST /v1/overview`.
5. **Wire the Supabase client** into `apps/api` — install `@supabase/supabase-js`,
   add a `services/db.ts` alongside `github.ts` and `llm.ts`, and implement the
   read-cache-first path in `routes/overview.ts` (still a marked TODO). The
   schema, env vars and TTL helpers (`overviewExpiry()`, `isExpired()`) are all
   in place; only the client code is missing.
6. **`generateBrief`** + conventions extraction from CONTRIBUTING.md (US-3, US-4).
   Also replace the placeholder in `routes/brief.ts` that scans the open-issue
   list instead of fetching the single issue directly.
7. **Build the actual frontend** — the landing page is still the Turborepo
   starter. Needs: URL input, loading state (D-02: synchronous, so the loading
   state carries the UX), overview view, ranked issue list, brief view.
8. **Rate limiting** (OQ-2) before anything is public.

### Deferred

- Deployment target for the API (OQ-4).
- Maintainer README badge (US-5).
- Tests. There are none yet; the pure functions in `shared/src/utils` are the
  obvious first target, and they were written to be testable without a network.

## Pointers

- Scope and non-goals → [`ProjectBreif.md`](./ProjectBreif.md), [`spec.md`](../spec.md)
- Where code lives → [`Architecture.md`](./Architecture.md)
- How to write code here → [`Conventions.md`](./Conventions.md)
- Why things are the way they are → [`Decisions.md`](./Decisions.md)
