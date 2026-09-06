import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  API_ROUTES,
  GENERATION_RATE_LIMIT,
  READ_RATE_LIMIT,
} from "@repo/shared/constants";
import { env } from "./env.js";
import { HttpError, statusForCode } from "./lib/errors.js";
import { rateLimit } from "./lib/rate-limit.js";
import { briefRoutes } from "./routes/brief.js";
import { healthRoutes } from "./routes/health.js";
import { issueRoutes } from "./routes/issues.js";
import { overviewRoutes } from "./routes/overview.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "/v1/*",
    cors({ origin: env.corsOrigins, allowMethods: ["GET", "POST", "OPTIONS"] }),
  );

  // Rate limits go on before the routes so a refused request never reaches a
  // handler — the point is to not spend the GitHub call or the generation.
  // /health is deliberately unlimited: it is a liveness probe, it costs
  // nothing, and a limiter on it would only make monitoring flaky.
  // overview and brief share one bucket because they cost the same thing.
  const generationLimit = rateLimit("generate", GENERATION_RATE_LIMIT);
  app.use(API_ROUTES.overview, generationLimit);
  app.use(API_ROUTES.brief, generationLimit);
  app.use(API_ROUTES.issues, rateLimit("read", READ_RATE_LIMIT));

  app.route(API_ROUTES.health, healthRoutes);
  app.route(API_ROUTES.overview, overviewRoutes);
  app.route(API_ROUTES.issues, issueRoutes);
  app.route(API_ROUTES.brief, briefRoutes);

  app.notFound((c) =>
    c.json(
      {
        ok: false as const,
        error: { code: "not_found" as const, message: "No such route." },
      },
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json(error.toResponseBody(), error.status);
    }

    console.error("Unhandled error", error);
    return c.json(
      {
        ok: false as const,
        error: {
          code: "internal_error" as const,
          message: "Something went wrong.",
        },
      },
      statusForCode("internal_error"),
    );
  });

  return app;
}
