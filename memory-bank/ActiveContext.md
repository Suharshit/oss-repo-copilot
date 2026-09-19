# Active Context

**Last updated:** 2026-09-19

## Current status

The MVP's three user-facing features are built end to end: the repo page has
**Overview** (US-1) and **Issues** (US-2) tabs, and each issue opens its
**contribution brief** (US-3) with the repo's conventions (US-4) beside it.

Working through [`ToDo.md`](./ToDo.md): items 1 (overview page), 2 (issue
list) and 3 (brief page, branch `feat/brief-page`) are done; 4 (test with real
repos and tune) is next.

> **The Supabase project `OSS-Repo-Copilot` is paused (INACTIVE)** as of
> 2026-09-19; its hostname no longer resolves. The API runs in its no-cache
> mode and logs a failed read/write per request. The org is at the free
> tier's two-active-project limit (Vibely, draftly), so restoring it means
> pausing one of those.

### What works right now

| Piece                                | State                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `GET /health`                        | working                                                                                          |
| `POST /v1/overview`                  | working: Gemini generation, cached in Supabase for 7 days, `refresh: true` skips the cache       |
| `GET /v1/issues`                     | working: queries `good first issue`, falls back to recent open issues, slim rows (below)         |
| `POST /v1/brief`                     | working: ranked tree + docs, cached conventions (D-22), recorded in `contribution_briefs` (D-20) |
| Rate limiting                        | per client IP, two tiers (`GENERATION_RATE_LIMIT`, `READ_RATE_LIMIT`)                            |
| Landing page `/`                     | one URL form: a repo URL opens the repo page, an issue URL its brief, a PR URL is refused inline |
| Repo page `/r/[owner]/[name]`        | header + Overview / Issues tabs; `?tab=issues` opens the second                                  |
| Issue page `/r/[o]/[n]/issues/[num]` | the brief: issue card, files to look at, suggested approach, conventions, Regenerate             |
| Supabase                             | 5 tables, deny-all RLS, all written; **project currently paused** (above)                        |
| Tests                                | 80 (`node:test` via `tsx`): 54 shared, 26 api (GitHub service, db writes, `/v1/brief` route)     |
| CI                                   | `pnpm verify` order: format → lint → check-types → test → build, plus a Supabase lint job        |

### Brief page (ToDo 3), as built

- **Conventions (D-22).** Not generated per brief any more. `BriefResponse`
  carries the same `RepoConventions` row the overview caches; on a miss
  `/v1/brief` extracts them in parallel with the brief and writes the row.
  The brief prompt gets the cached rules (raw CONTRIBUTING.md on a miss).
- **Context.** `fetchBriefContext` reads the whole, uncapped tree plus the
  contribution docs, no README or manifests. `rankPathsForIssue` (shared)
  orders the tree by word overlap with the issue before the prompt's 800-path
  cut; a named path wins outright, and words matching over 10% of the tree
  (usually the project's name) are ignored. On microsoft/vscode this moved
  the file an issue named from outside the 800 to first.
- **Recording (D-20).** `upsertIssue` then `writeBrief`, insert only, never
  read. Unverified live because Supabase is paused; covered by `db.test.ts`.
- **Errors.** 5xx `HttpError`s are logged with their cause in `onError`.
- **Web.** `useContributionBrief` shares an in-flight request per issue URL,
  so dev-mode double mounting costs one generation, not two (checked via
  `RateLimit-Remaining`). `components/brief/`: `BriefView` (owns the header
  and Regenerate), `IssueCard` (closed warning), `RelevantFilesSection`
  (links into the default branch), `ApproachSection`, `BriefSkeleton`; the
  overview's `ConventionsSection` is reused. Not-found errors read
  "Couldn't find that issue" with the API's message.
- **Landing.** `parseGithubUrl` (shared) sorts a URL into repo, issue or pull
  request. Before, `parseRepoUrl` read an issue URL as its repo.
- `formatRelativeTime` says "just now" under a minute, including a few
  seconds in the future (server clock ahead of the browser's).

### Issue list (ToDo 2), as built

- **API.** `fetchScoredIssues` asks GitHub for open issues labelled
  `GOOD_FIRST_ISSUE_LABEL` (`"good first issue"`). If none come back (after
  PRs are dropped) it falls back to the newest `MAX_ISSUES_PER_REPO` open
  issues. `IssuesResponse.source` says which (`"labelled"` / `"recent"`), and
  the UI tells the user when it fell back.
- **Slim payload.** List rows are `IssueSummary` (`number`, `title`, `url`,
  `labels`, `commentCount`, `createdAt`, `friendlinessScore`). No body, state,
  ids or `updatedAt`. The full `Issue` is still what `/v1/brief` returns.
- **Badge.** `friendlinessTier(score)` in shared buckets the score with
  `FRIENDLINESS_TIER_THRESHOLDS`: ≥ 0.8 "Great first issue" (green), ≥ 0.6
  "Good first issue" (blue), otherwise "May need context". The score is shown
  out of 100 beside it. **Assignment is not shown** on purpose, for now.
- **Web.** `useRankedIssues` (mirrors `useRepoOverview`; both use
  `lib/load-error.ts`) → `IssuesPanel` (loading / error / retry) → `IssueList`
  → `IssueRow`. The whole row links to the issue page; "View on GitHub" is a
  separate link on top of it.
- **Tabs.** `RepoView` owns the header and the overview state, so the
  header's meta and Regenerate button sit above the tabs. The overview loads
  on arrival, the issue list the first time its tab opens, and both stay
  mounted afterwards, so switching tabs never refetches. Switching uses
  `history.replaceState`, not push, so it doesn't add browser history entries.
  `Tabs` (components/common) follows the WAI-ARIA tab pattern: arrow keys,
  Home and End move between tabs.
- **Routes.** `lib/routes.ts` owns every web path: `repoPagePath(ref, tab)`,
  `issuePagePath`, `parseRepoTab`, `parseRepoParams`, `parseIssueNumber`.
  `RepoHeader` moved to `components/repo/` because both pages use it.

### Known issues

1. **Repo metadata is fetched twice per page.** `/v1/overview` and
   `/v1/issues` each call `fetchRepo` (`GET /repos/{owner}/{name}`), and the
   overview does it even on a cache hit. The issues UI never reads
   `IssuesResponse.repo`. The fix is planned with caching (ToDo 4): drop
   `repo` and `fetchRepo` from `/v1/issues`, and read the `repos` row before
   calling GitHub in `/v1/overview`.
2. **Assigned issues score low while the UI hides assignment.** Assignment
   costs 0.4, so an assigned issue can never reach "Great". Repos that assign
   triagers look bad: all 18 labelled issues on microsoft/vscode showed as "May
   need context". Revisit when assignment is shown, or when scoring is tuned
   (ToDo 4).
3. **Only one label spelling is queried.** freeCodeCamp uses "first timers
   only", which neither `GOOD_FIRST_ISSUE_LABEL` nor `FIRST_TIMER_LABELS`
   matches, so it falls back to recent issues.
4. **The fallback list is thin on busy repos.** PRs take up slots in GitHub's
   50-item page and are filtered out afterwards (rust-lang/rust: 13 issues out
   of 50).
5. **The issue list isn't cached.** Briefs are recorded but never read
   (D-06, D-20), and `issues` rows are only written by the brief.
6. **No Docker installed**, so the local Supabase stack can't run. The remote
   project is the only working database.
7. **Nothing is deployed.** The API target is still open (OQ-4), and the web
   Vercel project hasn't been created.
8. **Supabase is paused** (see Current status). Every cache read misses, so
   every overview visit pays for two generations.

## Recent activities

### Brief page, ToDo 3 (2026-09-19, branch `feat/brief-page`)

One commit per step: conventions beside the brief (D-22); tree ranking,
slimmer fetch and 5xx logging; the brief page; issue URLs on the landing
page; brief recording; tests and docs. Verified with `pnpm verify` and in
headless Chrome against live GitHub and Gemini (desktop, 520px, light and
dark, PR URL, closed issue, the landing form driven over CDP).

### Issue list, ToDo 2 (2026-09-18, branch `feat/issue-list`)

- Shared: `IssueSummary`, `IssueListSource`, `FriendlinessTier`,
  `GOOD_FIRST_ISSUE_LABEL`, `FRIENDLINESS_TIER_THRESHOLDS`, and
  `friendlinessTier()` with tests.
- API: label-first query with a fallback, slim rows, and a `source` field.
  Five new tests stub `fetch`, covering the label query, the fallback, a
  labelled PR not blocking the fallback, the payload's field list, and
  ranking.
- Web: `useRankedIssues`, the components under `components/issues/`, `Tabs`,
  `RepoView`, the placeholder issue route, and badge colour tokens for light
  and dark mode.
- Verified: `pnpm verify` passes. In headless Chrome against live GitHub, tab
  switching (click and keyboard), `?tab=` sync, row click to the placeholder
  and back, the fallback notice, phone width, and both colour schemes all
  work.

### Overview page, ToDo 1 (#8) and CI (#9)

- Repo page at `/r/[owner]/[name]` with the summary, tech stack, modules and
  conventions, a loading skeleton, error states and Regenerate.
- CI runs the full `pnpm verify` pipeline; `CONTRIBUTING.md` documents
  branching and commits.

### Backend (after the 2026-09-05 scaffold, before #8)

GitHub content fetching, Gemini generation for the overview, conventions and
brief, a Supabase overview cache, per-IP rate limiting, and 42 tests for the
pure functions.

## Next steps

1. **Decide on Supabase:** restore `OSS-Repo-Copilot` (pausing another
   project) or move to a paid org. Then confirm the brief rows land.
2. **Test with real repos and tune (ToDo 4).** Scoring (assignment penalty,
   label spellings), prompts, path ranking, the double `fetchRepo`, a timeout
   on Supabase calls, and a Gemini 503 retry.
3. README badge (ToDo 5), then launch hardening (ToDo 6).

## Pointers

- Scope and non-goals → [`ProjectBreif.md`](./ProjectBreif.md), [`spec.md`](../spec.md)
- Where code lives → [`Architecture.md`](./Architecture.md)
- How to write code here → [`Conventions.md`](./Conventions.md)
- Why things are the way they are → [`Decisions.md`](./Decisions.md)
- Work order → [`ToDo.md`](./ToDo.md)
