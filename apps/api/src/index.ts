import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
