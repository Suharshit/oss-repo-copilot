import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { API_ROUTES } from "@repo/shared/constants";
import { env } from "./env.js";
import { HttpError, statusForCode } from "./lib/errors.js";
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
