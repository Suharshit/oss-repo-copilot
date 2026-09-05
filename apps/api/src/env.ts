import { DEFAULT_API_PORT, DEFAULT_WEB_PORT } from "@repo/shared/constants";

/**
 * Read once at boot and fail loudly, so a missing token surfaces on startup
 * rather than on the first user request.
 */
export interface Env {
  nodeEnv: "development" | "production" | "test";
  port: number;
  /** Server-side GitHub token — end users never authenticate (spec §6). */
  githubToken: string | undefined;
  anthropicApiKey: string | undefined;
  /** Origins allowed to call this API. */
  corsOrigins: string[];
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = (source.NODE_ENV ?? "development") as Env["nodeEnv"];

  return {
    nodeEnv,
    port: Number(source.PORT ?? DEFAULT_API_PORT),
    githubToken: source.GITHUB_TOKEN,
    anthropicApiKey: source.ANTHROPIC_API_KEY,
    corsOrigins: (source.CORS_ORIGINS ?? `http://localhost:${DEFAULT_WEB_PORT}`)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export const env = loadEnv();
