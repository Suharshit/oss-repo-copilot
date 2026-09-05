import { Hono } from "hono";
import type { HealthResponse } from "@repo/shared/types";
import { ok } from "../lib/errors.js";

export const healthRoutes = new Hono().get("/", (c) => {
  const body: HealthResponse = {
    status: "ok",
    service: "repo-onboarding-copilot-api",
    uptimeSeconds: Math.round(process.uptime()),
  };
  return c.json(ok(body));
});
