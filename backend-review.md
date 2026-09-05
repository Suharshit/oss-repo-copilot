# Backend review — where `apps/api` actually is

Temp working doc, generated 2026-09-05. Not committed, not part of the build.
Everything below was read out of the code, not the memory bank.

---

## 1. The one-paragraph version

The backend is a Hono service with four routes. **Two work completely**
(`/health`, `/v1/issues`), **one works end to end but expensively**
(`/v1/overview` — it calls GitHub and Gemini for real, on every single request,
with no cache), and **one is dead** (`/v1/brief` — always 500s).

The single biggest gap is not an endpoint. It is that **nothing in the codebase
talks to the database.** The schema is live on Supabase with five tables, and no
line of code reads or writes any of them. That is what makes `/v1/overview`
expensive and what blocks the caching the spec assumes.

---

## 2. Endpoint status

| Endpoint | State | What happens today |
| -------- | ----- | ------------------ |
| `GET /health` | ✅ Complete | Returns status, service name, uptime |
| `GET /v1/issues` | ✅ Complete | Live GitHub fetch, PRs filtered, scored, ranked |
| `POST /v1/overview` | ⚠️ Works, uncached | Full GitHub read + Gemini generation, 6–26s, every time |
| `POST /v1/brief` | ❌ Always 500 | Validates, fetches, then hits a deliberate stub |

---

### ✅ `GET /health`

**File:** [apps/api/src/routes/health.ts](apps/api/src/routes/health.ts)

Returns `{ status, service, uptimeSeconds }`. No GitHub call, no database, no
LLM. It is a liveness probe and nothing more.

**Complete.** Nothing outstanding.

---

### ✅ `GET /v1/issues?url=<repo url>`

**File:** [apps/api/src/routes/issues.ts](apps/api/src/routes/issues.ts) ·
**User story:** US-2

Parses the pasted URL, then fetches the repo and its open issues from GitHub in
parallel. Pull requests are stripped out (GitHub's issues endpoint returns them
too, and they are not contribution targets). Each issue is scored by
`friendlinessScore()` and the list is sorted most-approachable first.

The score is a deterministic heuristic in
[packages/shared/src/utils/friendliness.ts](packages/shared/src/utils/friendliness.ts) —
not an LLM call. It weighs four signals:

| Signal | Weight | Effect |
| ------ | ------ | ------ |
| First-timer label | 0.5 | Earlier entries in `FIRST_TIMER_LABELS` score higher |
| Comment count | 0.3 | Long threads mean contested or subtle |
| Age | 0.2 | Under 3 days may be untriaged, over a year is often stale |
| Claimed (assignee) | −0.4 | Someone already called dibs |

**Complete for v1.** Two things worth knowing, neither a defect:

- Capped at `MAX_ISSUES_PER_REPO` (50) and **not paginated**. A repo with 400
  open issues gives you the first page GitHub returns, not the best 50.
- On a repo where no issue carries a first-timer label, everything clusters at
  0.500 (the ceiling without a label hit). The ranking is only as good as the
  maintainer's labelling.

---

### ⚠️ `POST /v1/overview` — works, but pays full price every call

**File:** [apps/api/src/routes/overview.ts](apps/api/src/routes/overview.ts) ·
**User story:** US-1

This is the newest work and the deepest path in the system. What runs today:

1. Parse the pasted repo URL → 400 `invalid_github_url` if it is not a GitHub repo
2. `fetchRepo` — repo metadata, default branch, primary language
3. `fetchRepoContext` — the full content read:
   - the whole file tree in one recursive request
   - the README, via GitHub's dedicated endpoint (finds it whatever it is named)
   - manifest files present in the tree, matched by basename
   - contribution docs present in the tree (CONTRIBUTING, CoC, PR template)
4. Build a budgeted prompt and call Gemini with a `responseSchema`, so the model
   returns typed JSON rather than prose
5. Drop any `mainModules` path the model invented, by checking it against the
   real tree
6. Return `{ repo, overview, conventions, cached }`

**Verified working** against `honojs/hono` and `vercel/turborepo`.

#### What is still wrong with it

| Problem | Where | Impact |
| ------- | ----- | ------ |
| **No cache** | [overview.ts:21](apps/api/src/routes/overview.ts#L21) | Every request pays ~15 GitHub calls + a full Gemini generation. `cached` is hardcoded `false` at [line 46](apps/api/src/routes/overview.ts#L46) |
| **`conventions` always `null`** | [overview.ts:43](apps/api/src/routes/overview.ts#L43) | US-4 is unimplemented. The docs are *already fetched* and then thrown away |
| **`refresh` flag ignored** | `OverviewRequest.refresh` | Defined in the shared types, read by nothing — it only means something once a cache exists |
| **6–26 seconds per request** | Gemini | All of it generation. The spec accepts a synchronous blocking call (D-02), but this is the cost of no cache |
| **No retry on 503** | [llm.ts](apps/api/src/services/llm.ts) | Gemini returns "high demand" 503s intermittently. Mapped cleanly to 502, but the user just sees a failure |

The `conventions` gap is the cheap one: `context.docs` already holds
CONTRIBUTING.md and the PR template on every request. Only the extraction step
is missing.

---

### ❌ `POST /v1/brief` — validates, fetches, then always fails

**File:** [apps/api/src/routes/brief.ts](apps/api/src/routes/brief.ts) ·
**User story:** US-3

**What should happen:** given an issue URL, return the files likely to need
changing, a plain-language explanation of the change, and the repo conventions
to follow.

**What happens now:** the URL is parsed, the repo is fetched, the issue is
located, and then `generateBrief` throws. Guaranteed 500 on every valid request.

Three separate problems, in order of severity:

**1. The generator is a deliberate stub.**
[llm.ts:111](apps/api/src/services/llm.ts#L111) throws rather than calling
Gemini. This is intentional, not an oversight — see the blocker below.

**2. It is fed nothing to reason about.**
[brief.ts:31-32](apps/api/src/routes/brief.ts#L31-L32) passes `fileTree: []` and
`contributing: null`. Wiring the model up while these are empty would produce a
brief with no knowledge of the codebase — confident, fluent and wrong. That is
worse than a 500, which is why the stub is still there.

**3. It finds the issue the wrong way.**
[brief.ts:22](apps/api/src/routes/brief.ts#L22) calls `fetchScoredIssues` and
scans the open-issue list for a matching number. Consequences:

- A **closed** issue returns `not_found` even though it exists
- An issue past the 50-item cap returns `not_found`
- A **pull request URL** is accepted by `parseIssueUrl` (it allows `/pull/`),
  then never found, because PRs are filtered from that list

`fetchIssue()` already exists at
[github.ts:87](apps/api/src/services/github.ts#L87) to fix all three. The route
has simply not been switched over — it is close to a one-line change.

---

## 3. Service layer

| Module | State |
| ------ | ----- |
| [services/github.ts](apps/api/src/services/github.ts) | ✅ Complete for v1 |
| [services/llm.ts](apps/api/src/services/llm.ts) | ⚠️ Half — overview real, brief stubbed |
| `services/db.ts` | ❌ **Does not exist** |

### github.ts — done

Ten exported functions covering everything spec §6 asks for: `fetchRepo`,
`fetchScoredIssues`, `fetchIssue`, `fetchFileTree`, `fetchReadme`,
`fetchManifests`, `fetchDocFiles`, `fetchRepoContext`, plus two pure path
selectors. GitHub 404/403/429 are mapped to our own error codes; a missing file
is `null` rather than an error, because most repos are missing most of what we
ask for.

### llm.ts — half

`generateOverview` is real: Gemini via REST, structured output, temperature 0.2,
`thinkingLevel: "low"`, and a budgeted prompt (README 8k chars, manifests 4k
each, 800 tree paths) because every token is paid on each cache miss.

`generateBrief` throws. Two functions are missing entirely:

- **brief generation** (US-3) — blocked on brief.ts passing real inputs
- **conventions extraction** (US-4) — there is no function for it at all, even
  though `RepoConventions` types and a `repo_conventions` table both exist

### db.ts — missing entirely

This is the important one. `@supabase/supabase-js` **is not installed**. No code
reads or writes Supabase. What exists but is unused:

- Five live tables with deny-all RLS, verified on the remote project
- `SUPABASE_URL` / `SUPABASE_SECRET_KEY` parsed at boot in `env.ts`
- TTL helpers `overviewExpiry()` and `isExpired()` in shared utils
- A 7-day `OVERVIEW_TTL_DAYS` constant

Everything is in place except the client code.

---

## 4. Not built at all

| Thing | Why it matters |
| ----- | -------------- |
| **Database layer** | Blocks caching, which is the whole cost model (spec §6) |
| **Rate limiting** (OQ-2) | With no login (D-01), this is the *only* abuse control. Must exist before anything is public |
| **Tests** | Zero. `selectManifestPaths`, `selectDocPaths` and `friendlinessScore` are pure and were written to be testable without a network — obvious first targets |
| **Deployment** (OQ-4) | No Vercel/Workers handler committed. Undecided by design |
| **Conventions extraction** (US-4) | Docs are fetched then discarded |
| **README badge** (US-5) | Not started, lowest priority |

---

## 5. What is blocking what

```
db.ts  ──┬──> /v1/overview caching (cost + the 6-26s latency)
         └──> `cached` and `refresh` becoming meaningful

brief.ts real inputs ──> generateBrief ──> /v1/brief works at all
       (fetchRepoContext + fetchIssue)

conventions extraction ──> /v1/overview returns non-null `conventions`

rate limiting ──> anything public
```

Nothing is blocked on missing information or an unanswered question. Every
remaining item is ordinary implementation work, and every dependency it needs
already exists.

### Suggested order

1. **Fix `/v1/brief`'s inputs** — swap `fetchScoredIssues` for `fetchIssue`, add
   `fetchRepoContext`. Small, and it unblocks the next step.
2. **Implement `generateBrief`** — the Gemini transport in `llm.ts` is already
   written and proven; this is a second prompt and a second schema.
3. **Build `db.ts`** — biggest win. Turns overview from a 6–26s paid call into a
   cache hit for the next visitor, and makes `cached`/`refresh` real.
4. **Conventions extraction** — completes US-4 with data already being fetched.
5. **Rate limiting** — before anything is public.
6. **Tests** — the pure functions first.

---

## 6. Running and testing it

```sh
pnpm dev:api     # port 3001
pnpm dev:web     # port 3000
pnpm dev         # both
```

If you see "port 3001 busy", a previous server is still alive:

```sh
netstat -ano | grep ":3001.*LISTENING"
# then: taskkill /PID <pid> /F
```

Quick checks:

```sh
curl localhost:3001/health

curl "localhost:3001/v1/issues?url=https://github.com/honojs/hono"

curl -X POST localhost:3001/v1/overview \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/honojs/hono"}'      # 6-26s, costs a Gemini call

curl -X POST localhost:3001/v1/brief \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/honojs/hono/issues/5313"}'   # always 500
```

The Postman collection in `postman/` (gitignored) covers all of this plus the
error cases, and runs headless with
`pnpm dlx newman run postman/repo-onboarding-copilot.postman_collection.json`.

### Environment

`apps/api/.env.local` — loaded by `process.loadEnvFile()` in
[env.ts](apps/api/src/env.ts), because there is no dotenv dependency and neither
`tsx` nor `node` reads `.env` on its own.

| Variable | Status |
| -------- | ------ |
| `GITHUB_TOKEN` | Used — raises rate limits |
| `GEMINI_API_KEY` | Used — overview generation |
| `MODEL` | Used — `gemini-3.6-flash`. Note `gemini-2.5-flash` is closed to new keys |
| `SUPABASE_URL` | Parsed at boot, **read by nothing** |
| `SUPABASE_SECRET_KEY` | Parsed at boot, **read by nothing** |
| `CORS_ORIGINS` | Used |
| `PORT` | Used |

---

## 7. Error contract

Every response is one of two shapes:

```jsonc
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

Codes map to statuses in
[apps/api/src/lib/errors.ts](apps/api/src/lib/errors.ts):

| Code | Status | Raised when |
| ---- | ------ | ----------- |
| `bad_request` | 400 | Body is not JSON |
| `invalid_github_url` | 400 | URL is not a parseable GitHub repo/issue URL |
| `not_found` | 404 | Unknown repo or issue, or unknown route |
| `rate_limited` | 429 | GitHub or Gemini rate limit |
| `upstream_error` | 502 | GitHub or Gemini failed |
| `internal_error` | 500 | Unhandled, or a stub that is not wired up yet |

This contract is shared with the frontend through `@repo/shared/types`, so the
web client in [apps/web/lib/api.ts](apps/web/lib/api.ts) cannot drift from it.
