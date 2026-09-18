# OSS Repo Copilot — Feature List

Source: `Oss-Repo-Copilot-feature-list.pdf`, checked against the codebase on 2026-09-17.

### Legend

- `[x]` **Done**: implemented and wired in.
- `[x]` **Partial**: some of it is built. The note says what's missing.
- `[ ]` **Not started**
- **Fit** says whether the feature matches the project's decisions (`spec.md`, `memory-bank/Decisions.md`):
  ✅ fits · ⚠️ fits with a conflict to resolve · ❌ doesn't fit the product as scoped

> **Main gap:** the API side of the MVP is mostly built (`/v1/overview`, `/v1/issues`, `/v1/brief`), but the web app is still a static page. The form in [apps/web/app/page.tsx](apps/web/app/page.tsx) is disabled, and nothing calls the typed client in [apps/web/lib/api.ts](apps/web/lib/api.ts) yet. That's why every contributor-facing feature below is marked **Partial**.

---

## Functional (MVP)

### Contributor-facing

- [x] **Repo overview generation** (paste a repo URL, get its purpose, tech stack and main modules). **Partial** · Fit ✅
  - Done: `POST /v1/overview` ([apps/api/src/routes/overview.ts](apps/api/src/routes/overview.ts)) reads the file tree, README and manifests, then calls Gemini with a structured schema. Module paths the model made up are dropped.
  - Missing: the web UI (no input wiring, loading state or overview view).

- [x] **Good-first-issue matcher** (ranked list of approachable open issues). **Partial** · Fit ✅
  - Done: `GET /v1/issues` scores issues with a deterministic heuristic (`friendlinessScore` in [packages/shared/src/utils/friendliness.ts](packages/shared/src/utils/friendliness.ts)) based on labels, comment count, age and whether someone is assigned. PRs are filtered out. The heuristic has unit tests.
  - Missing: the web UI. `looksClaimed()` (claim phrases in comments) exists but isn't used, because comments aren't fetched. The `issues` table is never written to.

- [x] **Contribution brief generation** (paste an issue URL, get relevant files, what needs to change and a suggested approach). **Partial** · Fit ✅
  - Done: `POST /v1/brief` fetches the issue by number, reads the repo context and CONTRIBUTING.md, and returns `relevantFiles`, `suggestedApproach` and `conventionsNotes`. File paths are checked against the real tree.
  - Missing: the web UI. Briefs aren't saved to `contribution_briefs`, even though the schema says the table is for reviewing output quality. The PDF asks for "a plain-language explanation of what needs to change", but there's no separate field for it: it's folded into `suggestedApproach`.

- [x] **Repo conventions lookup** (CONTRIBUTING rules, branch naming, test/lint requirements, shown in the brief). **Partial** · Fit ✅
  - Done: `generateConventions` pulls out branch naming, test requirements, lint rules and PR template from CONTRIBUTING.md, CODE_OF_CONDUCT.md, ARCHITECTURE.md and the PR template. The result is cached in `repo_conventions`. Each field can be null, so no rules get invented.
  - Missing: the structured conventions come back with the **overview**, not the brief. The brief only gets a free-text `conventionsNotes` field, built from CONTRIBUTING.md alone. No UI yet.

### Maintainer-facing

- [ ] **Embeddable badge/link for READMEs** that points to the tool for a given repo. **Not started** · Fit ✅
  - It depends on the web app having a URL for each repo (for example `/r/:owner/:name`), and that route doesn't exist yet. Listed as US-5 in the spec, marked deferred.

### Platform

- [ ] **Basic auth** (email/password with Supabase Auth, limited to an admin/maintainer area). **Not started** · Fit ⚠️
  - **Conflict:** D-01 (no end-user auth), D-17 (Supabase `auth` turned off in `config.toml`) and D-21 (the auth phase was skipped on purpose) all rule out user accounts. D-18's deny-all RLS also assumes no `authenticated` role ever reaches the database. The PDF limits auth to maintainers, which is compatible in principle. But nothing in the MVP needs a maintainer area yet, since the badge doesn't need a login. Either move this to Future Scope next to "custom/pinned onboarding notes" and the analytics dashboard, or record a new decision that replaces D-21.

- [x] **Caching layer for repo overviews** with TTL expiry and a manual regenerate option. **Done (API)** · Fit ✅
  - Done: [apps/api/src/services/db.ts](apps/api/src/services/db.ts) reads the cache before the GitHub fetch. Entries expire after 7 days (`OVERVIEW_TTL_DAYS`), and the expiry check happens in SQL. `refresh: true` skips the cache read and writes new rows. If Supabase isn't reachable, requests still work without the cache.
  - Missing: a "Regenerate" button in the UI, and any cleanup of expired rows.

---

## Functional (Future Scope)

None of these have been started.

### Deeper code understanding

- [ ] **Semantic code graph / call-graph indexing.** Fit ✅. The spec lists it as a deferred non-goal, to revisit if briefs turn out too shallow without it.
- [ ] **Runtime user-flow tracing** (sequence diagrams from real execution paths). Fit ❌. This means cloning, building and running untrusted third-party code. That conflicts with "no raw code storage" (D-03), the shallow indexing approach and the cost goals. It's a different product (a sandboxed execution platform). Drop it or rescope it as static sequence diagrams generated from the code graph.
- [ ] **Runnable/sandboxed code demos tied to explanations.** Fit ❌. Same issue: it needs code execution infrastructure and stored source code. It also doesn't obviously help the main job of getting someone to their first PR.
- [ ] **Multi-turn chat Q&A grounded in the code graph.** Fit ✅. It's a spec non-goal for v1 and depends on the code graph above. Note: the PDF says "grounded int"; that's a typo for "grounded in".

### Maintainer product

- [ ] **Analytics dashboard** showing which parts of the codebase confuse contributors most. Fit ⚠️. It needs maintainer auth (see above), a way to collect events (none today), and a working definition of "confusion" (which files come up in briefs? repeated regenerations?).
- [ ] **Custom/pinned onboarding notes per repo.** Fit ✅. It needs maintainer auth and proof of repo ownership (for example a GitHub App install or OAuth), otherwise anyone could pin notes on any repo.
- [ ] **Webhook-based re-indexing on new commits.** Fit ✅. It needs a GitHub App installed on the repo (today there's only a PAT) and a job queue (see Scalability).
- [ ] **Private repository support (paid tier).** Fit ⚠️. It directly contradicts the privacy requirement "only public repository data is processed", the least-privilege token requirement, and D-01/D-18. It would also need per-user auth, billing and stricter data handling. Reasonable for a later version, but those non-functional requirements would have to be rewritten for it.

### Ecosystem integration

- [ ] **GitHub Action/bot that auto-comments a brief on new `good-first-issue` issues.** Fit ✅. A natural extension of `/v1/brief`. It needs a GitHub App with write permission on issues, which is broader than the current read-only token.
- [ ] **IDE/VS Code extension.** Fit ✅. It could call the existing HTTP API with the shared types.
- [ ] **Multi-host support (GitLab, Bitbucket).** Fit ✅. See Extensibility below: GitHub is currently hard-coded in URL parsing and the service layer.

### Community/learning

- [ ] **Structured multi-step learning paths for popular repos.** Fit ✅. Builds on overview and conventions. Probably needs curated or pre-generated content (OQ-3).
- [ ] **Recognition/leaderboard for first-time contributors.** Fit ⚠️. It needs user identity and tracking of merged PRs, which goes against the "no login" model (D-01). It's also a different kind of product from an onboarding helper. Lowest priority.

---

## Non-Functional

### Performance

- [x] **Fast responses for overview/brief (low single-digit seconds).** **Partial**
  - Done: GitHub requests run in parallel, overview and conventions are generated at the same time, `thinkingLevel: "low"`, prompt size limits, cache hits for overviews.
  - Missing: no measurements. A cold overview makes about 15 GitHub requests plus 2 LLM calls, which probably takes longer than a few seconds. There's no streaming or timeouts.
- [x] **Caching to avoid repeat LLM calls for popular repos.** **Done.** Overviews and conventions are cached. Briefs are generated fresh each time on purpose (spec §6).

### Scalability

- [ ] **Handle traffic spikes on popular repos without slowing down.** **Not started.** One Node process, in-memory rate limiter, no deployment yet (OQ-4). If several people request the same uncached repo at once, each request pays for its own generation. Nothing deduplicates them.
- [ ] **Indexing/generation can be queued/async as usage grows.** **Not started.** Everything is synchronous, as the MVP allows. The `GenerationService` interface is a clean place to put a queue later.

### Cost efficiency

- [x] **Shallow indexing (file tree + README + manifests) in v1.** **Done.** No clone and no AST parsing. The tree is capped at 2,000 entries, each file at 40k characters, and at most 10 manifests.
- [x] **Single LLM provider.** **Done.** Gemini only ([apps/api/src/services/llm.ts](apps/api/src/services/llm.ts)).
  - Docs are out of date: `spec.md` §6 and `memory-bank/ActiveContext.md` still say Anthropic.

### Reliability & availability

- [x] **Graceful fallback/error messages when GitHub or the LLM is down or rate-limited.** **Partial**
  - Done: GitHub 403/429 errors and Gemini 429 errors map to a typed `rate_limited` error. Other upstream failures return `upstream_error` (502). A Supabase outage turns into a cache miss instead of a failed request.
  - Missing: no retries or backoff. No fallback to stale cached data when generation fails. Not deployed, so availability can't be measured. No UI to show the errors.

### Security

- [x] **No secrets in the repo; credentials come from environment variables.** **Done.** `.env*` is gitignored and there are `.env.example` files. [apps/api/src/env.ts](apps/api/src/env.ts) is the only place env vars are read. It also warns if a publishable Supabase key is used where the secret key belongs.
- [ ] **Least-privilege GitHub token/App with public read-only access.** **Not started.** `GITHUB_TOKEN` is a plain PAT. Its scopes aren't checked anywhere and there's no GitHub App. A fine-grained PAT with no repo permissions (public read only) would meet this for now.
- [x] **Rate limiting / abuse prevention.** **Done (single instance).** [apps/api/src/lib/rate-limit.ts](apps/api/src/lib/rate-limit.ts) uses a fixed window per IP: 10 generations per 10 minutes, shared by overview and brief, and 60 reads per minute. It sends `RateLimit-*` headers and only trusts `X-Forwarded-For` when `TRUST_PROXY` is set. Limits are per process, so they need shared storage before running more than one instance.

### Privacy & data handling

- [x] **Only public repo data processed; no stored raw source, only generated artifacts.** **Partial**
  - Done: no source files are stored. Only overviews, conventions and repo metadata are written to the database.
  - Missing: nothing actually checks that a repo is public. If `GITHUB_TOKEN` has private-repo access, private repos would be processed. Also, the unused `issues.body` column would store raw issue text if it were ever written to.
- [x] **Clear retention/expiry policy for cached content.** **Partial**
  - Done: every cached row has `expires_at` (7 days), and expired rows are never served.
  - Missing: expired rows are never deleted. The `repo_overviews_expires_at_idx` index exists but no cleanup job (such as pg_cron) uses it. The policy isn't written down anywhere users can see it.

### Observability

- [x] **CI runs lint + typecheck on every push/PR.** **Done.** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint, check-types and build.
  - Tip: CI doesn't run `pnpm test`, even though `apps/api` and `packages/shared` have test suites.
- [x] **Basic error logging/monitoring so generation failures are visible.** **Partial**
  - Done: `hono/logger` request logs, `console.error` for unhandled errors and cache failures, and a log line for each fetch.
  - Missing: no monitoring or alerts (for example Sentry or a log drain). Handled `HttpError`s (the GitHub and Gemini failures) are returned to the client without being logged.

### Maintainability

- [x] **Turborepo monorepo with shared types/config.** **Done.** `apps/web`, `apps/api`, `@repo/shared` (types, utils, constants, UI), plus shared eslint and typescript config packages.
- [x] **Schema changes only through versioned migrations.** **Done.** `supabase/migrations/` and the `db:*` scripts.

### Extensibility

- [x] **Can swap/add LLM providers and non-GitHub hosts without a rewrite.** **Partial**
  - Done: the LLM sits behind the `GenerationService` interface. Prompts are built separately from the transport code.
  - Missing: host support. `parseRepoUrl`/`parseIssueUrl`, `services/github.ts` and the `RepoRef` type are all GitHub-specific, with no host abstraction.

### Accessibility

- [x] **Base UI meets basic accessibility standards.** **Partial**
  - Done: `<html lang="en">`, `<nav>`/`<main>` landmarks, `aria-label` on the URL input, `aria-hidden` on the decorative logo mark.
  - Missing: no audit, no visible label (only a placeholder), no contrast check. Most of the UI hasn't been built yet.

### Compliance

- [x] **Respect GitHub API terms and rate limits.** **Partial**
  - Done: authenticated requests, a `User-Agent` header, a pinned `X-GitHub-Api-Version`, detection of 403/429 responses, the overview cache.
  - Missing: `X-RateLimit-Remaining` and `Retry-After` aren't read. There's no backoff, and the issue list isn't cached.
- [ ] **Respect LLM provider data/usage terms when sending repo content.** **Not started.** There's no review of Gemini API data-use terms. On the free tier, prompts may be used to improve Google's models, so check which tier is in use.

### Internationalization

- [x] **English-only, best effort, in v1.** **Done.** UI text and prompts are in English, and `lang="en"` is set.

---

## Summary

| Area | Done | Partial | Not started |
| --- | --- | --- | --- |
| MVP functional (7) | 1 | 4 | 2 |
| Future scope (13) | 0 | 0 | 13 |
| Non-functional (21) | 9 | 8 | 4 |

### Things to fix in the list itself

1. **MVP auth contradicts D-01/D-17/D-21.** Move it to Future Scope, or record a decision that replaces D-21.
2. **Runtime flow tracing and sandboxed code demos** don't fit a shallow, stateless tool that stores no code. Drop them or rescope them.
3. **Private repo support and the leaderboard** go against the privacy and no-login requirements. Keep them only if those requirements get rewritten.
4. **The docs name the wrong LLM provider:** `spec.md` §6 and `ActiveContext.md` say Anthropic, but the code uses Gemini.
5. **The brief spec asks for a separate "what needs to change" explanation**, but the code doesn't return one as its own field.
