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
| `apps/web`                  | builds and serves; starter landing page still in place                |
| `apps/api`                  | boots, serves, error handling verified                                |
| `GET /health`               | working                                                               |
| `GET /v1/issues`            | **working against live GitHub** — fetches, filters PRs, scores, ranks |
| `POST /v1/overview`         | route + validation work; 500s at the LLM stub                         |
| `POST /v1/brief`            | route + validation work; 500s at the LLM stub                         |
| `@repo/shared`              | types, utils, constants, UI all in place                              |
| Web → API typed client      | `apps/web/lib/api.ts`, contract shared with the server                |

Verified by smoke test: `/v1/issues?url=https://github.com/vercel/turborepo`
returns a scored, ranked issue list; a malformed URL returns
`400 invalid_github_url`.

### Known issues

1. **Node version mismatch.** `engines` wants `>=24`; the installed runtime is
   v20.19.2 and pnpm is 9.15.9 (root declares `packageManager: pnpm@11.25.0`).
   Everything built anyway, but the esbuild target is `node24`.
2. **`.turbo-clone-temp/`** is a leftover full clone of the turborepo repo in the
   project root, tracked by git as a gitlink. It is excluded from Prettier via
   `.prettierignore` (it was accidentally reformatted once). It is almost
   certainly deletable, but that's a pending call.

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

### Memory bank created (2026-09-05)

This folder — `ProjectBreif.md`, `Architecture.md`, `Conventions.md`,
`Decisions.md`, `ActiveContext.md`.

## Next steps

### Immediate

1. Decide on `.turbo-clone-temp/` — delete it and untrack it, or keep it.
2. Align the Node/pnpm runtime with `engines`, or relax `engines`.

### Feature work, in dependency order

3. **Repo content fetching** (`services/github.ts`): file tree, README,
   `MANIFEST_FILES`, `DOC_FILES`. Everything downstream needs this.
4. **Wire the Anthropic calls** in `services/llm.ts` — `generateOverview` first,
   since US-1 is the entry point of the product. This unblocks `POST /v1/overview`.
5. **Postgres/Supabase caching** for `REPO_OVERVIEW` with the 7-day TTL.
   `overviewExpiry()` and `isExpired()` already exist in shared; the
   read-cache-first path in `routes/overview.ts` is a marked TODO.
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
