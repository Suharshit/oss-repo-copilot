-- MVP schema for repo-onboarding-copilot (spec.md §5).
--
-- Everything here is a CACHE of regenerable artifacts. There is no user table:
-- v1 is stateless per visit (spec §3). Nothing in this schema is source of
-- truth — `repos` and `issues` are refetchable from the GitHub API, and
-- `repo_overviews` / `contribution_briefs` can be deleted and regenerated.
--
-- Access model: the ONLY client is the server-side Hono API in apps/api, which
-- connects with the service role. The browser never talks to Supabase. Every
-- table therefore has RLS enabled with no policies (deny-all for anon and
-- authenticated) and no Data API grants. See the bottom of this file.

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at honest without the application having to remember.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger function: stamps updated_at on every UPDATE. SECURITY INVOKER by design.';

-- ---------------------------------------------------------------------------
-- repos — one row per GitHub repository we have looked at.
-- ---------------------------------------------------------------------------

create table public.repos (
  id bigint generated always as identity primary key,
  owner text not null,
  name text not null,
  -- Natural key matching repoId() in @repo/shared/utils ("owner/name",
  -- lowercased). Generated so it can never drift from owner/name.
  full_name text generated always as (lower(owner) || '/' || lower(name)) stored,
  default_branch text not null,
  primary_language text,
  last_indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint repos_owner_valid check (owner ~ '^[A-Za-z0-9._-]{1,100}$'),
  constraint repos_name_valid check (name ~ '^[A-Za-z0-9._-]{1,100}$')
);

-- The lookup path for every request: parse the pasted URL, then find the repo.
create unique index repos_full_name_key on public.repos (full_name);

create trigger repos_set_updated_at
  before update on public.repos
  for each row execute function public.set_updated_at();

comment on table public.repos is
  'GitHub repositories seen by the tool. Refetchable from the GitHub API, not source of truth.';
comment on column public.repos.full_name is
  'Lowercased "owner/name". Matches repoId() in @repo/shared/utils.';

-- ---------------------------------------------------------------------------
-- repo_overviews — cached LLM artifact, one per repo, with a TTL (spec §6).
-- ---------------------------------------------------------------------------

create table public.repo_overviews (
  id bigint generated always as identity primary key,
  repo_id bigint not null references public.repos (id) on delete cascade,
  summary text not null,
  tech_stack text[] not null default '{}',
  -- [{ path, description }] — matches RepoModule[] in @repo/shared/types.
  main_modules jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint repo_overviews_summary_not_blank check (length(btrim(summary)) > 0),
  constraint repo_overviews_modules_is_array check (jsonb_typeof(main_modules) = 'array'),
  constraint repo_overviews_expires_after_generated check (expires_at > generated_at)
);

-- One overview per repo, so the cache write is a plain upsert:
--   insert ... on conflict (repo_id) do update set ...
create unique index repo_overviews_repo_id_key on public.repo_overviews (repo_id);

-- Supports sweeping expired rows without scanning the table.
create index repo_overviews_expires_at_idx on public.repo_overviews (expires_at);

comment on table public.repo_overviews is
  'Cached repo summary (US-1). TTL is OVERVIEW_TTL_DAYS in @repo/shared/constants (7 days).';

-- ---------------------------------------------------------------------------
-- repo_conventions — contribution rules scraped from CONTRIBUTING.md (US-4).
-- ---------------------------------------------------------------------------

create table public.repo_conventions (
  id bigint generated always as identity primary key,
  repo_id bigint not null references public.repos (id) on delete cascade,
  branch_naming text,
  test_requirements text,
  lint_rules text,
  pr_template text,
  -- Paths the rules were read from, e.g. {CONTRIBUTING.md,.github/PULL_REQUEST_TEMPLATE.md}
  sources text[] not null default '{}',
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint repo_conventions_expires_after_generated check (expires_at > generated_at)
);

-- Same lifecycle as the overview: one per repo, refreshed together.
create unique index repo_conventions_repo_id_key on public.repo_conventions (repo_id);

comment on table public.repo_conventions is
  'Contribution rules pulled from CONTRIBUTING.md and friends (US-4). Cached alongside the overview.';

-- ---------------------------------------------------------------------------
-- issues — open GitHub issues, scored for approachability (US-2).
-- ---------------------------------------------------------------------------

create table public.issues (
  id bigint generated always as identity primary key,
  repo_id bigint not null references public.repos (id) on delete cascade,
  number integer not null,
  title text not null,
  body text,
  labels text[] not null default '{}',
  state text not null default 'open',
  comment_count integer not null default 0,
  url text not null,
  -- Heuristic score from friendlinessScore() in @repo/shared/utils. Recomputed
  -- on every fetch — persisted for convenience, never treated as truth (spec §5).
  friendliness_score numeric(4, 3),
  github_created_at timestamptz not null,
  github_updated_at timestamptz not null,
  fetched_at timestamptz not null default now(),

  constraint issues_number_positive check (number > 0),
  constraint issues_state_valid check (state in ('open', 'closed')),
  constraint issues_comment_count_non_negative check (comment_count >= 0),
  constraint issues_score_in_range check (
    friendliness_score is null
    or friendliness_score between 0 and 1
  )
);

-- Natural key matching issueId() in @repo/shared/utils ("owner/name#123").
-- Doubles as the FK index on repo_id, since repo_id leads the index.
create unique index issues_repo_id_number_key on public.issues (repo_id, number);

-- The US-2 query: open issues for one repo, most approachable first.
create index issues_ranked_idx
  on public.issues (repo_id, friendliness_score desc)
  where state = 'open';

comment on table public.issues is
  'Open GitHub issues with a friendliness score (US-2). Refetchable; scores are recomputed, not trusted.';

-- ---------------------------------------------------------------------------
-- contribution_briefs — per-issue LLM artifact (US-3).
-- ---------------------------------------------------------------------------
--
-- NOTE: spec §6 says briefs are generated FRESH per request and are not cached
-- across users. This table is therefore a record of what was generated (useful
-- for evaluating output quality), not a cache read path. Do not wire a
-- cache-hit lookup against it without revisiting that decision.

create table public.contribution_briefs (
  id bigint generated always as identity primary key,
  issue_id bigint not null references public.issues (id) on delete cascade,
  -- [{ path, reason }] — matches RelevantFile[] in @repo/shared/types.
  relevant_files jsonb not null default '[]'::jsonb,
  suggested_approach text not null,
  conventions_notes text,
  generated_at timestamptz not null default now(),

  constraint contribution_briefs_files_is_array check (jsonb_typeof(relevant_files) = 'array'),
  constraint contribution_briefs_approach_not_blank check (length(btrim(suggested_approach)) > 0)
);

-- Indexes the FK and answers "most recent brief for this issue" in one shot.
create index contribution_briefs_issue_id_generated_at_idx
  on public.contribution_briefs (issue_id, generated_at desc);

comment on table public.contribution_briefs is
  'Generated contribution briefs (US-3). A record of output, not a cache read path — see spec §6.';

-- ---------------------------------------------------------------------------
-- Security.
--
-- No end user ever holds a Supabase key (spec §6: no end-user auth), so these
-- tables must be unreachable through the Data API. Two independent locks:
--   1. No grants to anon/authenticated — the table is invisible to those roles.
--   2. RLS enabled with zero policies — even if a grant is added by mistake,
--      no row is selectable.
-- service_role bypasses RLS, which is how apps/api reads and writes.
-- ---------------------------------------------------------------------------

alter table public.repos enable row level security;
alter table public.repo_overviews enable row level security;
alter table public.repo_conventions enable row level security;
alter table public.issues enable row level security;
alter table public.contribution_briefs enable row level security;

revoke all on public.repos from anon, authenticated;
revoke all on public.repo_overviews from anon, authenticated;
revoke all on public.repo_conventions from anon, authenticated;
revoke all on public.issues from anon, authenticated;
revoke all on public.contribution_briefs from anon, authenticated;
