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
| `@repo/shared/ui/<name>` | React components (`button`, `card`, `code`)          |

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

| Command            | What it does                                     |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Next dev server + `tsx watch` on the API         |
| `pnpm build`       | `next build` + esbuild bundle to `apps/api/dist` |
| `pnpm start`       | Serve both production builds                     |
| `pnpm lint`        | ESLint across every package                      |
| `pnpm check-types` | `tsc --noEmit` across every package              |
| `pnpm format`      | Prettier                                         |

Requires Node >= 24 and pnpm 11.
