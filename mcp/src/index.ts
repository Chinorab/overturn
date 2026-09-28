/**
 * Entry point. Reads the environment, starts the HTTP server, and shuts down cleanly so that
 * every in-memory case dies with the process (FR-040).
 */
import { serve } from "@hono/node-server";
import { createApp, MCP_PATH } from "./server";
import { closeAllSessions } from "./sessions";

const port = Number(process.env.MCP_PORT ?? 8000);
const app = createApp();

const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.error(JSON.stringify({
    t: new Date().toISOString(), level: "info", event: "listening",
    port: info.port, path: MCP_PATH,
    authMode: process.env.MCP_AUTH_MODE ?? "cognito",
  }));
});

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    console.error(JSON.stringify({ t: new Date().toISOString(), level: "info", event: "shutdown", signal }));
    // Sessions first: closing them releases the open SSE streams, so `server.close` can finish.
    void closeAllSessions().finally(() => server.close(() => process.exit(0)));
  });
}
