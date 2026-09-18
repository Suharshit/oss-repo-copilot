# Architecture

## Monorepo structure

Turborepo + pnpm workspaces. Workspace globs are `apps/*` and `packages/*`
([`pnpm-workspace.yaml`](../pnpm-workspace.yaml)).

```
repo-onboarding-copilot/
├── apps/
│   ├── web/                 Next.js 16 frontend        (port 3000)
│   └── api/                 Hono backend service       (port 3001)
├── packages/
│   ├── shared/              @repo/shared — the contract between the apps
│   ├── eslint-config/       @repo/eslint-config
│   └── typescript-config/   @repo/typescript-config
├── supabase/
│   ├── config.toml          local stack config, trimmed to MVP scope
│   ├── migrations/          imperative migrations (not declarative schemas)
│   └── seed.sql             empty by design — nothing to seed in v1
├── turbo.json               task graph
├── spec.md                  MVP spec (source of truth for scope)
└── memory-bank/             this folder
```

Five workspace packages total. There is no `apps/docs` and no `packages/ui` —
both came from the `create-turbo` starter and were removed during the restructure.

## Component overview

### `apps/web` — frontend

Next.js 16 (App Router, Turbopack), React 19.

```
app/
  layout.tsx        root layout, local Geist fonts
  page.tsx          landing page
  globals.css
lib/
  api.ts            typed client for apps/api
```

Everything the client knows about the backend goes through
[`apps/web/lib/api.ts`](../apps/web/lib/api.ts): it builds URLs from
`API_ROUTES` in `@repo/shared/constants`, unwraps `ApiResponse<T>`, and throws
`ApiRequestError` carrying the API's own error code. Components never call
`fetch` against the API directly.

`next.config.js` sets `transpilePackages: ["@repo/shared"]` because shared ships
TypeScript source, not a build output.

### `apps/api` — backend

Hono on Node via `@hono/node-server`. Thin handlers, logic in services.

```
src/
  index.ts          server entry — serve({ fetch: app.fetch })
  app.ts            middleware, route mounting, error mapping
  env.ts            environment parsed once at boot
  routes/
    health.ts       GET  /health
    overview.ts     POST /v1/overview   (US-1)
    issues.ts       GET  /v1/issues     (US-2)
    brief.ts        POST /v1/brief      (US-3)
  services/
    github.ts       GitHub REST client + issue scoring   [implemented]
    llm.ts          generation boundary                  [stubbed]
  lib/
    errors.ts       HttpError -> ApiError + HTTP status mapping
```

Request flow for every route:

```
route handler
  ├─ parse the pasted URL   (@repo/shared/utils)  → HttpError on failure
  ├─ services/github.ts     (GitHub REST)
  ├─ services/llm.ts        (generation)          → currently throws
  └─ ok(payload)            → ApiSuccess<T>
                              ↓ any thrown HttpError
                            app.onError → ApiError + status
```

`services/llm.ts` is the one deliberate stub. Its interface, inputs and error
path are real; only the Anthropic call is missing. Wiring it in is a
self-contained change that touches no route.

### `packages/shared` — `@repo/shared`

A just-in-time package: it exports TypeScript source and is compiled by whatever
consumes it. No build step, no `dist`.

```
src/
  index.ts          root: types + utils + constants (no React)
  types/
    repo.ts         Repo, RepoRef, RepoOverview, RepoModule, RepoConventions
    issue.ts        Issue, FriendlinessSignals, ContributionBrief, RelevantFile
    api.ts          ApiResponse<T>, ApiSuccess, ApiError, route payloads
  utils/
    github-url.ts   parseRepoUrl, parseIssueUrl, repoId, issueId
    friendliness.ts friendlinessScore, looksClaimed, daysSince
    format.ts       formatRelativeTime, truncate, overviewExpiry, isExpired
  constants/
    index.ts        API_ROUTES, ports, TTLs, FIRST_TIMER_LABELS, MANIFEST_FILES
```

Entry points are split on purpose:

| Import                   | Contains                  | Safe in the API? |
| ------------------------ | ------------------------- | ---------------- |
| `@repo/shared`           | types + utils + constants | yes              |
| `@repo/shared/types`     | type-only                 | yes              |
| `@repo/shared/utils`     | pure functions            | yes              |
| `@repo/shared/constants` | literals                  | yes              |

The package has no React code, so `apps/api` can import any entry point. UI
components live in `apps/web/components` (shadcn/ui primitives in
`components/ui`).

### `packages/eslint-config` / `packages/typescript-config`

Kept from the starter, consumed by both apps and by shared.
`eslint-config` exports `./base`, `./next-js`, `./react-internal`.
`typescript-config` exports `base.json`, `nextjs.json`, `react-library.json`.

## Data model

Four entities, intentionally shallow (spec §5):

```
REPO ──┬── ISSUE ──── CONTRIBUTION_BRIEF
       └── REPO_OVERVIEW
```

- `REPO` and `ISSUE` are refetchable from GitHub — not precious.
- `REPO_OVERVIEW` and `CONTRIBUTION_BRIEF` are **cached, regenerable LLM
  artifacts**. They can be deleted and rebuilt at any time.
- `friendlinessScore` is computed at fetch time, not stored truth.
- There is no `USER` entity. V1 is stateless per visit.

### Physical schema (Supabase / Postgres 17)

Five tables in `public`, all created by
`supabase/migrations/20260905101420_init_mvp_schema.sql`:

| Table                 | Rows are                     | Cardinality    |
| --------------------- | ---------------------------- | -------------- |
| `repos`               | repos we've looked at        | —              |
| `repo_overviews`      | cached summary (US-1)        | one per repo   |
| `repo_conventions`    | CONTRIBUTING.md rules (US-4) | one per repo   |
| `issues`              | open issues + score (US-2)   | many per repo  |
| `contribution_briefs` | generated briefs (US-3)      | many per issue |

Schema conventions in force:

- **PKs are `bigint generated always as identity`.** The app's string ids
  (`repoId()` = `"owner/name"`, `issueId()` = `"owner/name#123"`) map to natural
  keys, not to the PK: `repos.full_name` is a generated stored column
  (`lower(owner) || '/' || lower(name)`) with a unique index, and issues are
  unique on `(repo_id, number)`. Mapping happens at the service boundary, like
  the existing snake_case → camelCase mapping in `toIssue`.
- `timestamptz` everywhere, `text` over `varchar(n)`, arrays for label lists,
  `jsonb` for the structured LLM output (`main_modules`, `relevant_files`).
- Unique indexes on `repo_overviews.repo_id` and `repo_conventions.repo_id`
  exist so the cache write is a single `on conflict (repo_id) do update` upsert.
- `issues_ranked_idx` is a **partial** index covering exactly the US-2 query:
  `(repo_id, friendliness_score desc) where state = 'open'`.
- All FKs `on delete cascade` from `repos`, so dropping a repo drops everything
  derived from it. Every FK column is index-covered.
- `set_updated_at()` is a `SECURITY INVOKER` trigger function with
  `search_path = ''`; only `repos` carries `updated_at`.

**Access model — no policies is the design, not an oversight.** The browser
never talks to Supabase; the only client is `apps/api` using the secret
(service role) key, which bypasses RLS. So every table has RLS enabled with
**zero policies**, and `anon`/`authenticated` have had all grants revoked. Two
independent locks: no grant, and no policy even if a grant reappears.
`auto_expose_new_tables = false` in `config.toml` keeps future tables the same
way. The security advisor's five `rls_enabled_no_policy` INFO notices are the
expected output of this design.

## Dependency graph

```
web ──► @repo/shared ◄── api
 │                        │
 └──► @repo/eslint-config ─┘
 └──► @repo/typescript-config ─┘
```

No app depends on another app. Nothing depends on `web` or `api`.

## Infrastructure

### Runtime

| Piece           | Choice                            | Notes                                |
| --------------- | --------------------------------- | ------------------------------------ |
| Node            | >= 24 (`engines`)                 | esbuild target is `node24`           |
| Package manager | pnpm 11.25.0                      | workspace protocol for internal deps |
| Task runner     | Turborepo 2.10.12                 | `turbo.json` at root                 |
| Frontend        | Next.js 16.3.4 / React 19.2.8     | Turbopack builds                     |
| Backend         | Hono 4.10.4 + `@hono/node-server` | Web-standard Request/Response        |
| Language        | TypeScript 7.0.2                  | strict, `noUncheckedIndexedAccess`   |
| Lint            | ESLint 10.9.1                     | flat config                          |
| Format          | Prettier 3.9.6                    | `.prettierignore` at root            |

### Build pipeline

| Package | `dev`                            | `build`                                   |
| ------- | -------------------------------- | ----------------------------------------- |
| web     | `next dev --webpack --port 3000` | `next build --webpack` → `.next/`         |
| api     | `tsx watch src/index.ts`         | esbuild bundle → `apps/api/dist/index.js` |
| shared  | (none — source only)             | (none)                                    |

The API is **bundled**, not compiled file-by-file. esbuild inlines
`@repo/shared`'s TypeScript source into a single ESM file, which is why shared
needs no build step and there is no build-order dependency between the two.

Turbo task graph (`turbo.json`): `build` depends on `^build`; outputs are
`.next/**` (minus caches) and `dist/**`. `dev` and `start` are `persistent`,
`cache: false`. `start` depends on `build`.

### External services

| Service             | Used for                         | Auth                           |
| ------------------- | -------------------------------- | ------------------------------ |
| GitHub REST API     | repo metadata, file tree, issues | one server-side `GITHUB_TOKEN` |
| Anthropic API       | overviews + contribution briefs  | `ANTHROPIC_API_KEY`            |
| Postgres (Supabase) | cached overviews and briefs      | `SUPABASE_SECRET_KEY`          |

All three are server-side only. The browser never holds a key, and end users
never authenticate.

### Supabase

Project **OSS-Repo-Copilot** (`bvibmfdyxpsevfiukrqa`), Postgres 17, region
ap-southeast-2. `config.toml` pins `major_version = 17` to match.

Only `api`, `db` and `studio` are enabled locally. `auth`, `storage`,
`realtime`, `edge_runtime`, `analytics` and `local_smtp` are switched off
because v1 has no users, no uploads, no real-time and no Edge Functions — each
one is annotated in `config.toml` with the decision that rules it out.

Workflow is **imperative migrations** (`supabase/migrations/`), not declarative
schemas — `db.migrations.schema_paths` is empty. Create migrations with
`pnpm db:migration <name>`; never hand-write a filename.

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `pnpm db:start`     | local stack (needs Docker — not installed yet) |
| `pnpm db:reset`     | re-run every migration + `seed.sql`            |
| `pnpm db:migration` | new timestamped migration file                 |
| `pnpm db:push`      | apply pending migrations to the remote         |
| `pnpm db:diff`      | diff the local DB against migrations           |

### Not yet built

- Postgres caching layer for `REPO_OVERVIEW` (7-day TTL).
- Repo file-tree / README / manifest fetching to feed prompts.
- The Anthropic calls in `services/llm.ts`.
- Abuse rate limiting.
- Deployment targets. Hono is portable (Node, Vercel, Cloudflare Workers); the
  choice is still open.
