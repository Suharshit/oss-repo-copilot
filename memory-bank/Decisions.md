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

## Open questions

Carried from `spec.md` §7 — unresolved, and each one blocks or shapes work.

| #    | Question                                                                        | Leaning                                                         |
| ---- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| OQ-1 | Fallback when a repo has no README/CONTRIBUTING or very sparse docs?            | unresolved — overview quality depends heavily on this           |
| OQ-2 | How to prevent scripted abuse without a login (see D-01)?                       | unresolved — likely IP-based limits + a per-repo cache hit path |
| OQ-3 | Pre-generate overviews for popular repos at launch, or generate on first visit? | unresolved                                                      |
| OQ-4 | Where does the API deploy? Hono keeps Node / Vercel / Workers all open.         | undecided by design                                             |
