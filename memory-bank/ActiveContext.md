# Active Context

**Last updated:** 2026-09-18

## Current status

The API side of the MVP is built: every route works against live GitHub and
Gemini, and overviews are cached in Supabase. The web app has a real repo page
with two tabs, **Overview** (US-1) and **Issues** (US-2). The brief page
(US-3) is the next feature, and its route already exists as a placeholder.

Working through [`ToDo.md`](./ToDo.md): items 1 (overview page) and 2 (issue
list) are done; 3 (brief page) is next.

### What works right now

| Piece                                | State                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `GET /health`                        | working                                                                                    |
| `POST /v1/overview`                  | working: Gemini generation, cached in Supabase for 7 days, `refresh: true` skips the cache |
| `GET /v1/issues`                     | working: queries `good first issue`, falls back to recent open issues, slim rows (below)   |
| `POST /v1/brief`                     | working: generates a brief, but it is **not saved** and nothing in the UI calls it yet     |
| Rate limiting                        | per client IP, two tiers (`GENERATION_RATE_LIMIT`, `READ_RATE_LIMIT`)                      |
| Landing page `/`                     | repo URL form, routes to the repo page                                                     |
| Repo page `/r/[owner]/[name]`        | header + Overview / Issues tabs; `?tab=issues` opens the second                            |
| Issue page `/r/[o]/[n]/issues/[num]` | **placeholder**: links to GitHub and back to the list; the brief goes here (ToDo 3)        |
| Supabase                             | 5 tables, deny-all RLS; `repos`, `repo_overviews`, `repo_conventions` are written          |
| Tests                                | 50 (`node:test` via `tsx`): shared pure functions + `apps/api` GitHub service              |
| CI                                   | `pnpm verify` order: format → lint → check-types → test → build, plus a Supabase lint job  |

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
5. **Nothing is cached for issues or briefs.** The `issues` and
   `contribution_briefs` tables are never written to (ToDo 4).
6. **No Docker installed**, so the local Supabase stack can't run. The remote
   project is the only working database.
7. **Nothing is deployed.** The API target is still open (OQ-4), and the web
   Vercel project hasn't been created.
8. `backend-review.md` and `features-list.md` predate the overview and issue
   pages, and parts of them are stale.

## Recent activities

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

1. **Brief page (ToDo 3).** Swap the placeholder at
   `app/r/[owner]/[name]/issues/[number]` for a real brief view calling
   `getContributionBrief`, and add issue-URL paste on the landing page.
   Decide whether conventions belong in the brief.
2. **Test with real repos and tune (ToDo 4).** Scoring (assignment penalty,
   label spellings), prompts, the double `fetchRepo`, saving briefs, caching,
   and logging upstream errors.
3. README badge (ToDo 5), then launch hardening (ToDo 6).

## Pointers

- Scope and non-goals → [`ProjectBreif.md`](./ProjectBreif.md), [`spec.md`](../spec.md)
- Where code lives → [`Architecture.md`](./Architecture.md)
- How to write code here → [`Conventions.md`](./Conventions.md)
- Why things are the way they are → [`Decisions.md`](./Decisions.md)
- Work order → [`ToDo.md`](./ToDo.md)
