/**
 * Entry point. Reads the environment, starts the HTTP server, and shuts down cleanly so that
 * every in-memory case dies with the process (FR-040).
 */
import { serve } from "@hono/node-server";
import { createApp } from "./server";

const port = Number(process.env.MCP_PORT ?? 8000);
const app = createApp();

const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.error(JSON.stringify({
    t: new Date().toISOString(), level: "info", event: "listening",
    port: info.port, path: process.env.MCP_PATH ?? "/mcp",
    authMode: process.env.MCP_AUTH_MODE ?? "cognito",
  }));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.error(JSON.stringify({ t: new Date().toISOString(), level: "info", event: "shutdown", signal }));
    server.close(() => process.exit(0));
  });
}
