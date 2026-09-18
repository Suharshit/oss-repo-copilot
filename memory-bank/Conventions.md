# Conventions

Rules that are already true in the codebase. Follow them; if you need to break
one, note it in [`Decisions.md`](./Decisions.md).

## Coding standards

### TypeScript

- **ESM everywhere.** Every package is `"type": "module"`. Relative imports
  inside `apps/api` use the `.js` extension (`./lib/errors.js`) because the
  base config is `NodeNext`. `packages/shared` uses the **`.ts`** extension
  (`./format.ts`, with `allowImportingTsExtensions`), because `apps/web` bundles
  its source and Turbopack will not map `./x.js` to `x.ts`. Any tsconfig
  that type-checks shared's source (shared, api, web) needs that flag. `apps/web`
  uses `Bundler` resolution and its own imports have no extension.
- **`apps/web` builds with webpack** (`next dev --webpack`, `next build
--webpack`), and `next.config.js` sets `extensionAlias` for `.js` → `.ts`.
  The shared `.ts` extensions make Turbopack work too, so dropping `--webpack`
  is a one-line change if dev speed matters more.
- **Strict.** `strict`, `noUncheckedIndexedAccess`, `isolatedModules`,
  `declaration` are all on via `@repo/typescript-config/base.json`. Array and
  record access is possibly-undefined — handle it, don't `!` it.
- **Type-only imports are marked.** `import type { Issue } from ...`. Barrel
  files that only forward types use `export type * from "./x.js"`.
- No `any`. Cast external JSON through a declared response interface
  (`GitHubIssueResponse`) rather than inlining a shape.

### Naming

| Thing                 | Convention      | Example             |
| --------------------- | --------------- | ------------------- |
| Files                 | kebab-case      | `github-url.ts`     |
| React component files | lowercase       | `button.tsx`        |
| Types / interfaces    | PascalCase      | `ContributionBrief` |
| Functions / variables | camelCase       | `friendlinessScore` |
| Constants             | SCREAMING_SNAKE | `OVERVIEW_TTL_DAYS` |
| Workspace packages    | `@repo/<name>`  | `@repo/shared`      |
| App packages          | bare name       | `web`, `api`        |

Internal fields are **camelCase**, even when the upstream API is snake_case.
Mapping happens at the service boundary (`toIssue` in `services/github.ts`), never
in a route or a component.

### Comments

Sparse and load-bearing. Comment _why_, not _what_. Two patterns in use:

- `/** ... */` on exported types and functions whose purpose isn't obvious from
  the name.
- Inline `//` for a non-obvious decision, often citing the spec:
  `// The issues endpoint also returns PRs; they are not contribution targets.`

Reference spec sections (`spec §6`) and user stories (`US-2`) where it helps.

### Functions

- Pure logic lives in `packages/shared/src/utils` and takes its inputs
  explicitly (`FriendlinessSignals` rather than a raw GitHub payload), so it is
  testable without a network.
- Route handlers stay thin: parse → call services → wrap in `ok()`.
- Default parameters for injectable dependencies (`now: Date = new Date()`) so
  time-dependent functions are deterministic in tests.

## Styling patterns

- **Tailwind CSS v4** utility classes inline in `apps/web` components; no CSS
  Modules, no CSS-in-JS. `app/globals.css` holds only the theme tokens and
  base styles.
- **shadcn/ui** primitives live in `apps/web/components/ui` (Button, Card,
  Badge, Tabs, Input, Alert, Skeleton). App components compose them rather
  than restyling raw elements; add new ones with `pnpm dlx shadcn@latest add`.
- Colors use shadcn token names (`text-muted-foreground`, `bg-card`,
  `text-destructive`…). Dark mode follows `prefers-color-scheme`.
- Merge class names with `cn` from `@/lib/utils`.
- `"use client"` only where interactivity actually requires it.
- Fonts are local (`next/font/local`, Geist), not fetched from a CDN.

## API consistency

### One response envelope

Every route returns `ApiResponse<T>` from `@repo/shared/types`:

```ts
{ ok: true,  data: T }
{ ok: false, error: { code: ApiErrorCode, message: string } }
```

Handlers build success bodies with `ok(payload)` from `lib/errors.ts`. Never
return a bare object.

### Errors

Throw `HttpError(code, message)` from anywhere. `app.onError` maps it to the
right status via `STATUS_BY_CODE`:

| Code                 | Status |
| -------------------- | ------ |
| `bad_request`        | 400    |
| `invalid_github_url` | 400    |
| `not_found`          | 404    |
| `rate_limited`       | 429    |
| `upstream_error`     | 502    |
| `internal_error`     | 500    |

Adding an error case means adding a member to `ApiErrorCode` in shared _and_ a
row in `STATUS_BY_CODE` — the `Record<ApiErrorCode, ...>` type makes the compiler
enforce it.

Error `message` is user-facing. Write it for a newcomer pasting a URL
("Paste a public GitHub repo URL, e.g. https://github.com/owner/repo."), not for
a log reader. Unexpected errors are logged server-side and replaced with a
generic message.

### Route paths

Defined once in `API_ROUTES` (`@repo/shared/constants`) and consumed by both
`app.ts` and `apps/web/lib/api.ts`. Never hardcode a path string on either side.

Versioned under `/v1/*`; `/health` is unversioned.

### Request shape

- Pasted URLs go in a **JSON body** for `POST` (`{ url }`) and a **query param**
  for `GET` (`?url=`).
- Every payload type (`OverviewRequest`, `BriefResponse`, …) lives in
  `shared/types/api.ts`. If the API returns it, the type is shared.
- Bodies are parsed defensively — a malformed body is a `bad_request`, not a 500.

### Upstream calls

All GitHub access goes through `githubRequest()` in `services/github.ts`, which
owns headers, the token, and status→`HttpError` translation. Don't call `fetch`
against GitHub anywhere else.

## Environment management

### Where config lives

| File                    | Purpose                         | Committed |
| ----------------------- | ------------------------------- | --------- |
| `apps/api/.env.example` | documents every API var         | yes       |
| `apps/api/.env`         | real API secrets                | no        |
| `apps/web/.env.example` | documents `NEXT_PUBLIC_API_URL` | yes       |
| `apps/web/.env.local`   | real web values                 | no        |

`.env*` files (except `.example`) are gitignored. Adding a variable means
updating the matching `.env.example` in the same change.

### Reading config

- **API:** `process.env` is read **only** in `apps/api/src/env.ts`, once, at
  boot, into a typed `Env` object. Everything else imports `env`. This makes the
  full surface greppable and lets a missing value fail at startup.
- **Web:** only `NEXT_PUBLIC_*` vars, read in `lib/api.ts`. Nothing secret ever
  reaches the browser — no GitHub token, no LLM key, ever.

### Defaults

Ports and other non-secret defaults come from `@repo/shared/constants`
(`DEFAULT_API_PORT`, `DEFAULT_WEB_PORT`), so both apps agree without a `.env`
file present. Secrets have no defaults.

### Turbo

Any env var that affects a build output must be listed in `turbo.json` under
`tasks.build.env`, or Turbo will hand back a stale cached build.

## Tooling

| Command            | What it does                |
| ------------------ | --------------------------- |
| `pnpm dev`         | both apps, watch mode       |
| `pnpm build`       | Next build + esbuild bundle |
| `pnpm lint`        | ESLint, `--max-warnings 0`  |
| `pnpm check-types` | `tsc --noEmit` everywhere   |
| `pnpm format`      | Prettier                    |

- Filter to one package with `--filter=web` / `--filter=api`.
- Lint is zero-warning. A warning is an error.
- **`pnpm check-types` and `pnpm lint` must both pass before a change is done.**
- Internal deps always use `workspace:*`.
- Never format `.turbo-clone-temp` — it is excluded in `.prettierignore`.
