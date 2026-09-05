import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Repo,
  RepoConventions,
  RepoModule,
  RepoOverview,
} from "@repo/shared/types";
import { env } from "../env.js";

/**
 * Supabase access layer.
 *
 * Everything in this schema is a CACHE of regenerable artifacts, and that
 * decides the error policy: a failure here is logged and swallowed, never
 * thrown. A dead cache must degrade the service to what it was before this
 * file existed — slower and more expensive — not break it. The one thing that
 * would be worse than paying for a Gemini call is refusing to serve at all
 * because a cache row could not be written.
 *
 * The client connects with the service role key, which bypasses RLS. Every
 * table is deny-all for anon/authenticated by design, so this is the only way
 * in — and it must never reach the browser.
 */

interface RepoRow {
  id: number;
}

interface ConventionsRow {
  branch_naming: string | null;
  test_requirements: string | null;
  lint_rules: string | null;
  pr_template: string | null;
  sources: string[] | null;
}

interface OverviewRow {
  id: number;
  summary: string;
  tech_stack: string[] | null;
  main_modules: RepoModule[] | null;
  generated_at: string;
  expires_at: string;
}

let client: SupabaseClient | null = null;
let warned = false;

/**
 * The client, or null when Supabase is not configured.
 *
 * Not configured is a supported state, not an error: the API worked without a
 * database before this file, and a contributor without Supabase credentials
 * should still be able to run it. Callers treat null as a permanent cache miss.
 */
function getClient(): SupabaseClient | null {
  if (client) return client;

  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    if (!warned) {
      warned = true;
      console.warn(
        "SUPABASE_URL / SUPABASE_SECRET_KEY are not set — caching is off, " +
          "every overview request will pay for a full generation.",
      );
    }
    return null;
  }

  // Worth catching early: a publishable key here connects as `anon`, and every
  // table is deny-all for anon, so all you see is "permission denied for table
  // repos" logged once per request with no hint as to why.
  if (env.supabaseSecretKey.startsWith("sb_publishable_")) {
    if (!warned) {
      warned = true;
      console.warn(
        "SUPABASE_SECRET_KEY holds a publishable key. It connects as `anon`, " +
          "which every table denies — caching will not work. Use the secret " +
          "(service role) key.",
      );
    }
    return null;
  }

  client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
    // A server-side service-role client: there is no user session to persist
    // and no token to refresh, and doing either leaks state between requests.
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Insert or refresh the repo row, returning its bigint id.
 *
 * `full_name` is a generated column and carries the unique index, so this is a
 * plain upsert on it — the same natural key repoId() produces in shared utils.
 * Returns null when the cache is off or the write failed, which callers read
 * as "no cache this time".
 */
export async function upsertRepo(repo: Repo): Promise<number | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("repos")
    .upsert(
      {
        owner: repo.owner,
        name: repo.name,
        default_branch: repo.defaultBranch,
        primary_language: repo.primaryLanguage,
        last_indexed_at: repo.lastIndexedAt,
      },
      { onConflict: "full_name" },
    )
    .select("id")
    .single<RepoRow>();

  if (error) {
    console.error(`cache: could not upsert repo ${repo.id}:`, error.message);
    return null;
  }
  return data.id;
}

/**
 * The cached overview for a repo, or null on a miss.
 *
 * Expiry is filtered in SQL rather than in JS so an expired row never crosses
 * the wire — it is about to be replaced anyway.
 */
export async function readOverview(
  repoRowId: number,
  repoId: string,
): Promise<RepoOverview | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("repo_overviews")
    .select("id, summary, tech_stack, main_modules, generated_at, expires_at")
    .eq("repo_id", repoRowId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<OverviewRow>();

  if (error) {
    console.error(
      `cache: could not read overview for ${repoId}:`,
      error.message,
    );
    return null;
  }
  if (!data) return null;

  return {
    id: String(data.id),
    repoId,
    summary: data.summary,
    techStack: data.tech_stack ?? [],
    mainModules: data.main_modules ?? [],
    generatedAt: data.generated_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Store a freshly generated overview, replacing whatever was there.
 *
 * One overview per repo (unique index on repo_id), so a refresh overwrites
 * rather than accumulating. Errors are logged and swallowed: the caller
 * already has the overview to return, and failing the request over a cache
 * write would throw away the expensive part of the work.
 */
export async function writeOverview(
  repoRowId: number,
  overview: RepoOverview,
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase.from("repo_overviews").upsert(
    {
      repo_id: repoRowId,
      summary: overview.summary,
      tech_stack: overview.techStack,
      main_modules: overview.mainModules,
      generated_at: overview.generatedAt,
      expires_at: overview.expiresAt,
    },
    { onConflict: "repo_id" },
  );

  if (error) {
    console.error(
      `cache: could not write overview for ${overview.repoId}:`,
      error.message,
    );
  }
}

/**
 * The cached conventions for a repo, or null on a miss (US-4).
 *
 * Same lifecycle as the overview — one row per repo, same TTL — because they
 * are read out of the same fetch and go stale together.
 */
export async function readConventions(
  repoRowId: number,
  repoId: string,
): Promise<RepoConventions | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("repo_conventions")
    .select(
      "branch_naming, test_requirements, lint_rules, pr_template, sources",
    )
    .eq("repo_id", repoRowId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<ConventionsRow>();

  if (error) {
    console.error(
      `cache: could not read conventions for ${repoId}:`,
      error.message,
    );
    return null;
  }
  if (!data) return null;

  return {
    repoId,
    branchNaming: data.branch_naming,
    testRequirements: data.test_requirements,
    lintRules: data.lint_rules,
    prTemplate: data.pr_template,
    sources: data.sources ?? [],
  };
}

/**
 * Store freshly extracted conventions.
 *
 * `expiresAt` is passed in rather than computed here so the conventions row
 * and the overview row written in the same request expire together — a repo
 * whose overview is stale has almost certainly moved its docs too.
 */
export async function writeConventions(
  repoRowId: number,
  conventions: RepoConventions,
  generatedAt: string,
  expiresAt: string,
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase.from("repo_conventions").upsert(
    {
      repo_id: repoRowId,
      branch_naming: conventions.branchNaming,
      test_requirements: conventions.testRequirements,
      lint_rules: conventions.lintRules,
      pr_template: conventions.prTemplate,
      sources: conventions.sources,
      generated_at: generatedAt,
      expires_at: expiresAt,
    },
    { onConflict: "repo_id" },
  );

  if (error) {
    console.error(
      `cache: could not write conventions for ${conventions.repoId}:`,
      error.message,
    );
  }
}
