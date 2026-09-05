import {
  DEFAULT_API_PORT,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_WEB_PORT,
} from "@repo/shared/constants";

// Nothing else loads these: there is no dotenv dependency and neither `tsx`
// nor `node` reads .env on its own. In production the host supplies the
// environment and these files are absent, which is why a miss is ignored.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not present — fall through to whatever the process was given.
  }
}

/**
 * Read once at boot and fail loudly, so a missing token surfaces on startup
 * rather than on the first user request.
 */
export interface Env {
  nodeEnv: "development" | "production" | "test";
  port: number;
  /** Server-side GitHub token — end users never authenticate (spec §6). */
  githubToken: string | undefined;
  geminiApiKey: string | undefined;
  /** Gemini model id, e.g. `gemini-2.5-flash`. */
  model: string;
  /**
   * Supabase, used as the cache for generated overviews and briefs.
   * The secret (service role) key bypasses RLS — every table is deny-all for
   * anon/authenticated by design, so this key is the only way in. It must never
   * reach the browser.
   */
  supabaseUrl: string | undefined;
  supabaseSecretKey: string | undefined;
  /** Origins allowed to call this API. */
  corsOrigins: string[];
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = (source.NODE_ENV ?? "development") as Env["nodeEnv"];

  return {
    nodeEnv,
    port: Number(source.PORT ?? DEFAULT_API_PORT),
    githubToken: source.GITHUB_TOKEN,
    geminiApiKey: source.GEMINI_API_KEY,
    model: source.MODEL ?? DEFAULT_GEMINI_MODEL,
    supabaseUrl: source.SUPABASE_URL,
    supabaseSecretKey: source.SUPABASE_SECRET_KEY,
    corsOrigins: (source.CORS_ORIGINS ?? `http://localhost:${DEFAULT_WEB_PORT}`)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export const env = loadEnv();
