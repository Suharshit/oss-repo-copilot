# Decisions

Chronological log of choices that constrain future work, with the reasoning that
justified them. If a decision is reversed, mark it superseded rather than
deleting it — the reasoning is the useful part.

---

## Product decisions (from `spec.md` §6)

### D-01 — No end-user auth; one server-side GitHub token

**Status:** accepted

Users only paste public URLs, so requiring a login would add friction to exactly
the audience we're trying to unblock. A single server-side GitHub App/PAT gives
us higher rate limits than unauthenticated calls without any per-user OAuth
complexity.

**Consequence:** rate limiting against abuse becomes a real open problem (see
D-12), because we can't key limits on a user identity.

### D-02 — Synchronous request/response, no real-time

**Status:** accepted

Overview and brief generation take a few seconds (GitHub calls + LLM). That's
acceptable as a blocking request with a loading state. No live collaboration or
streaming is in scope, so WebSockets or pub/sub would be unjustified complexity.

**Revisit if:** generation latency pushes past ~10s, at which point streaming the
LLM response becomes worth the complexity.

### D-03 — Store only generated artifacts, never source code

**Status:** accepted

Postgres (via Supabase) caches `REPO_OVERVIEW` and `CONTRIBUTION_BRIEF`. We never
store cloned repo contents. Caching avoids re-running expensive LLM generation
for popular repos; not storing code keeps storage cheap and avoids the legal and
operational surface of hosting third-party source.

### D-04 — GitHub REST API instead of `git clone`

**Status:** accepted

The file-tree and content endpoints give us enough (tree + README + manifests)
without cloning. Cloning would mean disk, cleanup, timeouts, and repo-size limits
for a side project.

**Consequence:** we are bound by GitHub API rate limits and can't do anything
that needs full file contents at scale.

### D-05 — No AST parsing or call graph in V1

**Status:** accepted

Indexing depth is deliberately: file tree + README + manifest files + issue text.
This is dramatically cheaper than a code graph and is enough for a useful
overview and a first-pass brief.

**Revisit if:** contribution briefs prove too shallow to be actionable — that's
the explicit trigger named in the spec.

### D-06 — Overviews cached with a 7-day TTL; briefs generated fresh

**Status:** accepted

Repo structure changes slowly, so a week-long cache keeps popular repos fast and
cheap. Issues are unique per request and briefs are cheap enough to generate
fresh, so per-issue caching would be complexity with no payoff yet.

Implemented as `OVERVIEW_TTL_DAYS` plus `overviewExpiry()` / `isExpired()` in
`@repo/shared`.

### D-07 — Deterministic friendliness score, not LLM-assisted

**Status:** accepted (spec §7 listed this as open; defaulting to deterministic)

A heuristic over labels, comment count, age and claimed-status is cheaper, faster
and more predictable than an LLM call per issue, and it can be explained to the
user. Implemented in `shared/src/utils/friendliness.ts` with weights 0.5 label /
0.3 discussion / 0.2 age, minus 0.4 if claimed.

Living in `shared` means the web app can explain a score without a second round
trip.

**Revisit if:** ranking quality is visibly bad on real repos.

---

## Structural decisions (restructure, 2026-09-05)

### D-08 — Separate `apps/api` instead of Next.js route handlers

**Status:** accepted

The backend does GitHub fan-out, LLM calls and caching. Keeping it a separate
process means it can be scaled, deployed and rate-limited independently of the
frontend, and it isn't tied to Next's serverless execution model or timeouts.

**Cost:** CORS config and a second dev process.

### D-09 — Hono for the API

**Status:** accepted

Chosen over Express, Fastify and NestJS. TypeScript-first, Web-standard
`Request`/`Response`, minimal boilerplate, and portable across Node, Vercel and
Cloudflare Workers — which keeps the deployment decision open (see D-14).
NestJS was rejected as far too heavy for an MVP of this size.

### D-10 — One `packages/shared` with split entry points

**Status:** accepted; supersedes the starter's `packages/ui`

Types, utils, constants and UI live in one package rather than four. At this size
four packages would be overhead, not separation.

React-safety is handled by **export subpaths** instead: the root export
(`@repo/shared`) forwards only types, utils and constants, and components are
reachable only at `@repo/shared/ui/<name>`. So `apps/api` can import from the
root without pulling React into its bundle.

**Consequence:** never re-export `./ui` from `src/index.ts`.

**Update (2026-09-18):** the `ui` entry point was removed. `apps/web` moved to
shadcn/ui, whose components live in `apps/web/components/ui`, which left
`@repo/shared/ui` unused. `@repo/shared` now has no React code or dependency.

### D-11 — Shared is a just-in-time package (source, not `dist`)

**Status:** accepted

`@repo/shared` exports `.ts`/`.tsx` source with no build step. `apps/web` handles
it via `transpilePackages`; `apps/api` bundles it with esbuild, which inlines the
source.

This removes any build-order dependency between shared and its consumers, and
means editing a shared file is instantly live in both dev servers.

**Cost:** shared can't be published to npm as-is, and consumers must be able to
compile TypeScript. Neither matters for a private monorepo.

### D-12 — esbuild bundle for the API build

**Status:** accepted

`tsc` can't emit a consumer's copy of a workspace package's source, so a
file-by-file compile would need shared to build first. Bundling with esbuild
sidesteps that entirely and produces one deployable ESM file.

Dev uses `tsx watch` instead, for speed.

### D-13 — Shared response envelope and error codes

**Status:** accepted

Every route returns `ApiResponse<T>`, and `ApiErrorCode` → HTTP status is a
`Record` in `lib/errors.ts`, so the compiler forces the mapping to stay total.
Route paths live in `API_ROUTES` in shared and are consumed by both sides.

The point is that the web client and the server cannot drift apart without a type
error.

### D-14 — LLM calls isolated behind `services/llm.ts`

**Status:** accepted

The generation boundary is a typed interface (`GenerationService`) with real
input types and a real error path; only the provider call is stubbed. Routes,
caching and response shapes could therefore be built and verified before any LLM
integration existed.

It also keeps the spec's "room to swap providers per-task later" cheap.

### D-15 — Deleted `apps/docs` and `packages/ui`

**Status:** accepted

Both were `create-turbo` scaffolding with no relationship to this product. The UI
components were folded into `packages/shared/src/ui` (D-10).

---

## Database decisions (Supabase setup, 2026-09-05)

### D-16 — Imperative migrations, not declarative schemas

**Status:** accepted

`supabase/migrations/` with timestamped SQL files; `db.migrations.schema_paths`
left empty. The schema is small and mostly write-once, so the extra indirection
of declarative schemas buys nothing yet, and a plain migration file is easier to
read as a record of intent.

Always create files with `pnpm db:migration <name>` — never hand-write a
timestamp.

### D-17 — Local stack trimmed to `api`, `db`, `studio`

**Status:** accepted

`auth`, `storage`, `realtime`, `edge_runtime`, `analytics` and `local_smtp` are
disabled in `config.toml`. Each maps to something v1 explicitly does not do:
no user accounts (D-01), no file storage (D-03), no real-time (D-02), no Edge
Functions (D-08). Keeps `supabase start` fast and the surface small.

Each disabled block is annotated in `config.toml` with the reason, so nobody
re-enables one by reflex.

### D-18 — Deny-all RLS with zero policies, and no Data API grants

**Status:** accepted

Every table has RLS enabled and **no policies**, plus all grants revoked from
`anon` and `authenticated`. `auto_expose_new_tables = false`.

The usual Supabase pattern (policies keyed on `auth.uid()`) is meaningless here:
there are no users, and the browser never holds a Supabase key. The only client
is `apps/api` with the secret/service-role key, which bypasses RLS. So the
correct policy set is the empty one, and the grant revocation is a second,
independent lock in case a grant ever reappears.

**Consequence:** the security advisor reports five `rls_enabled_no_policy` INFO
notices. That is the expected output, not a defect. If a browser ever needs to
read from Supabase directly, this decision has to be revisited first.

### D-19 — Surrogate `bigint identity` PKs, natural keys as unique indexes

**Status:** accepted

Tables use `bigint generated always as identity` primary keys, with the app's
string identifiers as unique natural keys alongside: `repos.full_name` is a
generated stored column (`lower(owner) || '/' || lower(name)`) matching
`repoId()`, and issues are unique on `(repo_id, number)` matching `issueId()`.

This follows Postgres guidance (compact, sequential, no index fragmentation)
without forcing a change to `@repo/shared`'s types, which use string ids. The
mapping happens at the service boundary, consistent with how `toIssue` already
maps snake_case to camelCase.

Making `full_name` **generated** rather than application-supplied means it can
never drift from `owner`/`name`, and it makes repo lookup case-insensitive for
free.

### D-20 — `contribution_briefs` is a record, not a cache

**Status:** accepted

The table exists and stores every generated brief, but nothing reads it on the
request path — D-06 says briefs are generated fresh per request. It's there to
evaluate output quality over time.

Noted in the migration itself, because a table that looks like a cache invites
someone to wire a cache-hit lookup against it.

### D-21 — No auth phase, against the setup doc

**Status:** accepted

`building-context/initial-setup.md` Phase 4 called for Supabase Auth wired end
to end — `@supabase/ssr`, a `/login` page, and a session-gated `/dashboard`.
That phase was skipped.

It contradicts three things already settled: spec §3 lists user accounts as a
non-goal, D-01 rules out end-user auth, and D-17 disables the `auth` service in
`config.toml`. Building it would have added a user-accounts surface the product
does not have, and D-18's deny-all RLS assumes no `authenticated` role ever
reaches the database.

**Consequence:** the setup doc's "sign-up → session → `/dashboard` → sign-out"
gate is not satisfiable and is not tracked. If v2 ever adds saved history or
personalization, this decision and D-01 fall together, and D-18 needs revisiting
in the same change.

---

## Open questions

Carried from `spec.md` §7 — unresolved, and each one blocks or shapes work.

| #    | Question                                                                        | Leaning                                                         |
| ---- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| OQ-1 | Fallback when a repo has no README/CONTRIBUTING or very sparse docs?            | unresolved — overview quality depends heavily on this           |
| OQ-2 | How to prevent scripted abuse without a login (see D-01)?                       | unresolved — likely IP-based limits + a per-repo cache hit path |
| OQ-3 | Pre-generate overviews for popular repos at launch, or generate on first visit? | unresolved                                                      |
| OQ-4 | Where does the API deploy? Hono keeps Node / Vercel / Workers all open.         | undecided by design                                             |
