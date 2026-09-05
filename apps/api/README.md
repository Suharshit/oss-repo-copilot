# api

Backend service for the repo onboarding copilot. Hono on Node, talking to the
GitHub REST API and an LLM provider.

## Run

```bash
cp .env.example .env   # fill in GITHUB_TOKEN / ANTHROPIC_API_KEY
pnpm dev               # from the repo root, or `pnpm --filter api dev`
```

Listens on `http://localhost:3001` by default.

## Routes

| Method | Path           | Purpose                                         |
| ------ | -------------- | ----------------------------------------------- |
| GET    | `/health`      | Liveness probe                                  |
| POST   | `/v1/overview` | Repo summary, tech stack, main modules (US-1)   |
| GET    | `/v1/issues`   | Open issues ranked by friendliness score (US-2) |
| POST   | `/v1/brief`    | Contribution brief for one issue (US-3)         |

Paths live in `@repo/shared/constants` so the web app and the server can't drift.
Every response is an `ApiResponse<T>` from `@repo/shared/types`.

## Layout

```
src/
  index.ts        server entry (node-server)
  app.ts          Hono app: middleware, route mounting, error mapping
  env.ts          environment parsed once at boot
  routes/         one file per resource, thin handlers
  services/       github.ts (real), llm.ts (stubbed generation boundary)
  lib/errors.ts   HttpError -> ApiError status mapping
```

## Not wired up yet

- `services/llm.ts` throws — the Anthropic calls for overview and brief generation.
- Overview caching in Postgres (spec §6: 7-day TTL).
- Repo file tree / README / manifest fetching to feed the prompts.
- Abuse rate limiting (spec §7, open question).
