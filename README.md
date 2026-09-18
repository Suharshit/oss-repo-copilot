# repo-onboarding-copilot

Helps a newcomer go from "I found this repo" to a shipped PR: a repo overview,
a ranked list of approachable issues, and a contribution brief for a specific
issue. See [spec.md](./spec.md) for the MVP scope.

## Structure

```
apps/
  web/       Next.js 16 frontend (port 3000)
  api/       Hono backend service (port 3001)
packages/
  shared/    @repo/shared — types, utils, constants and UI shared by both apps
  eslint-config/       @repo/eslint-config
  typescript-config/   @repo/typescript-config
```

`@repo/shared` is a just-in-time package: it ships TypeScript source and is
compiled by whichever app consumes it. Its entry points are split so the API
never pulls React in:

| Import                   | Contains                                             |
| ------------------------ | ---------------------------------------------------- |
| `@repo/shared`           | types + utils + constants (server-safe)              |
| `@repo/shared/types`     | `Repo`, `Issue`, `ApiResponse<T>`, …                 |
| `@repo/shared/utils`     | GitHub URL parsing, friendliness scoring, formatting |
| `@repo/shared/constants` | route paths, TTLs, label lists, ports                |
| `@repo/shared/ui/<name>` | React components (`card`, `code`)                    |

Route paths and response types live in `shared`, so `apps/web`'s client in
[apps/web/lib/api.ts](./apps/web/lib/api.ts) and the handlers in
[apps/api/src/routes/](./apps/api/src/routes/) can't drift apart.

## Getting started

```sh
pnpm install
cp apps/api/.env.example apps/api/.env    # GITHUB_TOKEN, ANTHROPIC_API_KEY
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

`pnpm dev` runs both apps. For one at a time:

```sh
pnpm dev --filter=web
pnpm dev --filter=api
```

## Tasks

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `pnpm dev`         | Next dev server + `tsx watch` on the API                   |
| `pnpm build`       | `next build --webpack` + esbuild bundle to `apps/api/dist` |
| `pnpm start`       | Serve both production builds                               |
| `pnpm lint`        | ESLint across every package                                |
| `pnpm check-types` | `tsc --noEmit` across every package                        |
| `pnpm format`      | Prettier                                                   |
| `pnpm test`        | Unit tests in `apps/api` and `packages/shared`             |
| `pnpm verify`      | format check, lint, typecheck, test, build — same as CI    |

Requires Node >= 24 and pnpm 11.

## Database

Supabase, remote only — there is no local stack, because `supabase start` and
`supabase db diff` both need Docker. Schema lives in
[supabase/migrations/](./supabase/migrations/) and is applied with `pnpm db:push`;
`pnpm exec supabase migration list` shows local vs. remote state.

Every table is deny-all: RLS on with zero policies, and no grants to `anon` or
`authenticated`. `apps/api` is the only client and connects with the secret
(service-role) key. The browser never talks to Supabase.

## CI

[.github/workflows/ci.yml](./.github/workflows/ci.yml) runs on every pull
request and every push to `main`: format check, lint, typecheck, test and build,
plus a job that applies all Supabase migrations to a fresh Postgres and lints
the schema. Run `pnpm verify` before pushing to catch the same failures locally.

## Testing the API

There is no test suite yet. The API is exercised by hand — a Postman collection
covering every route and its error cases lives outside the repo (`postman/` is
gitignored), or with curl:

```sh
pnpm dev --filter=api
curl localhost:3001/health
curl "localhost:3001/v1/issues?url=https://github.com/honojs/hono"
```

`POST /v1/overview` and `POST /v1/brief` are expected to fail with 500 — the
routes are real but `services/llm.ts` is still a stub. The overview route does
its full GitHub read first and logs a summary line, which is how you confirm the
content fetchers work.

## Deployment

Not deployed yet.

**`apps/web` → Vercel.** Create the project from the dashboard (first-time
creation and env var entry need a login), pointing it at this repo with:

| Setting          | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Root Directory   | `apps/web`                                                 |
| Framework Preset | Next.js                                                    |
| Install Command  | default (Vercel reads `packageManager`)                    |
| Build Command    | default (the `build` script, `next build --webpack`)       |
| Env vars         | `NEXT_PUBLIC_API_URL` — see [.env.example](./.env.example) |

**`apps/api` → undecided (OQ-4).** Hono runs on Node, Vercel functions and
Workers alike, and no handler is committed for any of them. Serverless is fine
for what exists today, but repo cloning and indexing may outgrow function
execution limits — so the choice stays open until that work lands.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch and commit conventions and
the pre-push checklist.
