# Initial setup — instructions for Claude Code

Read this fully before starting. Execute the phases in order. Do not skip ahead, do not build any feature logic beyond what's explicitly listed here. The goal state at the end of this document is: a scaffolded, deployed, empty application with auth and database schema working end-to-end — nothing more. No repo-analysis, issue-fetching, or LLM-integration feature code should exist yet. That comes after this setup is verified complete.

Constraint: the developer does not have Docker Desktop installed. Supabase must be used in **remote-only** mode — never run `supabase start`, never assume a local Postgres instance is available. All schema work happens against the remote project via the Supabase CLI linked to the hosted project, or applied directly through the Supabase SQL editor if the CLI push path has issues.

---

## Phase 0 — prerequisites (confirm before proceeding)

Before writing any code, confirm the following exist. If any are missing, stop and ask the developer to provide them — do not attempt to create accounts or dashboard resources yourself:

- A GitHub repository already created (empty or with just a README) that this project will push to.
- A Supabase account with a **project already created** in the Supabase dashboard (project URL + API keys available). If this doesn't exist yet, tell the developer to create one at supabase.com before continuing — this step requires dashboard login and cannot be scripted.
- A Vercel account for deployment (or confirm an alternative host if the developer prefers something else for `apps/api`).
- Node.js and npm/pnpm installed locally.
- The Supabase CLI installed (`npm install -g supabase` or via the platform's preferred method).

Ask the developer to paste in (or securely provide) the following before Phase 3, since they're needed for remote linking:

- Supabase project ref / project URL
- Supabase anon key
- Supabase service role key

## Phase 1 — scaffold the monorepo

1. Initialize a Turborepo:

   ```
   npx create-turbo@latest .
   ```

   (Run in the existing empty repo directory rather than creating a new folder, if the repo already exists.)

2. Structure the workspace as:
   - `apps/web` — Next.js frontend
   - `apps/api` — backend service (Node/TypeScript) for GitHub API calls, LLM calls, and DB access — scaffold it empty, no feature endpoints yet, just a health-check route.
   - `packages/ui` — shared UI components package, empty except for a basic setup (button/layout primitives if the Turborepo template includes starters).
   - `packages/config` — shared TypeScript config, ESLint config, and a `types.ts` file with shared type definitions for the data model entities (see Phase 3 schema) — define the TypeScript interfaces here even though the tables don't exist yet, so both apps can import from one source of truth.

3. Confirm `turbo dev`, `turbo lint`, and `turbo build` all run without errors on the empty scaffold before proceeding.

4. Commit this as the first commit: "chore: scaffold turborepo monorepo".

## Phase 2 — Supabase CLI setup (remote only)

1. Run `supabase init` in the repo root to create the `supabase/` folder and config.

2. Do **not** run `supabase start`. Skip any local Postgres/Docker step entirely.

3. Link the CLI to the existing remote project:

   ```
   supabase link --project-ref <project-ref-provided-by-developer>
   ```

4. Verify the link works with a read-only command, e.g. `supabase projects list` or `supabase status --linked`, and confirm it reaches the remote project successfully before continuing.

## Phase 3 — migrations and schema (remote)

1. Create the migrations folder structure via:

   ```
   supabase migration new init_schema
   ```

2. Write the SQL for this migration based on the following schema (from the project's spec.md data model). Implement exactly these four tables, nothing more:

   ```sql
   create table repo (
     id uuid primary key default gen_random_uuid(),
     owner text not null,
     name text not null,
     default_branch text not null,
     last_indexed_at timestamptz,
     primary_language text,
     created_at timestamptz not null default now(),
     unique (owner, name)
   );

   create table repo_overview (
     id uuid primary key default gen_random_uuid(),
     repo_id uuid not null references repo(id) on delete cascade,
     summary text,
     tech_stack text,
     main_modules text,
     generated_at timestamptz not null default now(),
     expires_at timestamptz
   );

   create table issue (
     id uuid primary key default gen_random_uuid(),
     repo_id uuid not null references repo(id) on delete cascade,
     github_issue_number text not null,
     title text not null,
     body text,
     labels text[],
     state text not null,
     comment_count int default 0,
     friendliness_score float,
     created_at timestamptz not null default now(),
     unique (repo_id, github_issue_number)
   );

   create table contribution_brief (
     id uuid primary key default gen_random_uuid(),
     issue_id uuid not null references issue(id) on delete cascade,
     relevant_files text,
     suggested_approach text,
     conventions_notes text,
     generated_at timestamptz not null default now()
   );
   ```

3. Push the migration to the remote project (there is no local database to reset or test against first, since Docker isn't available):

   ```
   supabase db push
   ```

4. Verify the tables exist by running `supabase db diff` (should show no drift) or by checking the Supabase dashboard's table editor.

5. If `supabase db push` fails for any environment reason, fall back to pasting the migration SQL directly into the Supabase SQL editor in the dashboard, but still keep the migration file committed in `supabase/migrations/` so schema history stays tracked in git regardless of how it was applied.

6. Commit: "feat: initial database schema (repo, issue, repo_overview, contribution_brief)".

## Phase 4 — auth wiring (basic, end-to-end)

Goal: prove the full stack connects (frontend → Supabase Auth → session persisted), not to build a real auth UX yet.

1. Install `@supabase/supabase-js` (and `@supabase/ssr` if using Next.js App Router with server components) in `apps/web`.

2. Create a minimal `/login` page in `apps/web` with email/password sign-up and sign-in using Supabase Auth — plain form, no styling polish needed yet.

3. Create a single protected placeholder page, e.g. `/dashboard`, that redirects to `/login` if there's no session, and shows "Signed in as {email}" if there is.

4. Confirm this full loop works locally: sign up → session created → redirected to `/dashboard` → shows the signed-in email → sign out → redirected back to `/login`.

5. Commit: "feat: basic Supabase auth wired end-to-end".

## Phase 5 — CI

1. Create `.github/workflows/ci.yml` that runs on every push and pull request:

   ```yaml
   name: CI
   on: [push, pull_request]
   jobs:
     check:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm install
         - run: npx turbo lint
         - run: npx turbo typecheck
   ```

2. Confirm this passes on the current state of the repo before moving on. Fix any lint/typecheck errors introduced during scaffolding rather than disabling rules.

3. Commit: "chore: add CI workflow".

## Phase 6 — environment variables

1. Create a single `.env.example` at the repo root (or per-app if the apps need different variables — keep it as one root file unless there's a strong reason to split) listing every variable the code references, with empty values:

   ```
   GITHUB_TOKEN=
   ANTHROPIC_API_KEY=
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

2. Confirm `.env` (and any `.env.local`) is in `.gitignore` — do not commit real values under any circumstance.

3. Tell the developer explicitly, in your final summary, that they still need to manually:
   - Add these same variables with real values in the Vercel project settings (for `apps/web`, and `apps/api` if also deployed to Vercel).
   - Add any variables CI needs (if tests eventually call real services) as GitHub Actions repository secrets.
     This step requires dashboard access you don't have — do not attempt to guess or fetch these values yourself.

4. Commit: "chore: add .env.example".

## Phase 7 — base UI shell

1. Build a minimal layout in `apps/web`: a top nav with the project name/logo placeholder and a single primary input area on the home page (a text input for "paste a GitHub repo URL", with no working submit logic yet — this is a shell, not a feature).

2. Ensure `/dashboard` (from Phase 4) is reachable from the nav once signed in.

3. Keep styling minimal and functional — this phase proves routing and layout work, not final visual design. Use `packages/ui` for any shared components even if there's only one or two right now.

4. Commit: "feat: base UI shell (layout, nav, placeholder home and dashboard routes)".

## Phase 8 — deployment

1. Deploy `apps/web` to Vercel. If the Vercel CLI is available and the developer is already authenticated, use `vercel --prod` after confirming the project is linked; otherwise, instruct the developer to connect the GitHub repo to a new Vercel project through the dashboard, since first-time project creation and env var entry requires their login.

2. Decide where `apps/api` deploys based on whether it will need long-running processes later (repo cloning, indexing) — Vercel functions are fine for now given there's no real feature logic yet, but note in your summary that this may need to move to a host supporting longer execution times once indexing work begins.

3. Confirm the deployed `apps/web` URL loads, and that visiting `/login` and `/dashboard` behaves the same as it did locally.

## Final verification (gate)

Do not consider setup complete until all of the following are true. Report the status of each explicitly at the end:

- [ ] `turbo dev`, `turbo lint`, `turbo build` all succeed on the current codebase.
- [ ] Remote Supabase project is linked, and all four tables (`repo`, `issue`, `repo_overview`, `contribution_brief`) exist and match the schema in Phase 3.
- [ ] Migration files are committed in `supabase/migrations/` — schema is tracked in git regardless of how it was applied to remote.
- [ ] Sign-up → session → `/dashboard` → sign-out flow works against the live deployed URL, not just locally.
- [ ] CI workflow passes on the latest commit.
- [ ] `.env.example` is committed; no real secrets are committed anywhere in the repo.
- [ ] The deployed URL is live and publicly reachable.
- [ ] No feature logic exists yet beyond this scaffold — no repo-fetching, issue-fetching, or LLM-calling code. If you find yourself writing any of that, stop — it belongs in the next phase, not this one.

At the end, summarize: what's done, what still needs the developer's manual action (Supabase project creation if not already done, Vercel dashboard env vars, GitHub secrets), and the exact live URL and repo state.
