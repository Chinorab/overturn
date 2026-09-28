/**
 * Entry point. Reads the environment, starts the HTTP server, and shuts down cleanly so that
 * every in-memory case dies with the process (FR-040).
 */
import { serve } from "@hono/node-server";
import { createApp, MCP_PATH, log } from "./server";
import { closeAllSessions } from "./sessions";

const port = Number(process.env.MCP_PORT ?? 8000);

let app;
try {
  app = createApp();
} catch (err) {
  // Auth is configured at startup, so a missing issuer stops the server instead of opening it.
  log.error("startup_failed", { reason: (err as Error).message });
  console.error(
    "\nSet MCP_AUTH_MODE=dev with MCP_DEV_BEARER for a local run, or configure OIDC_ISSUER and " +
      "OIDC_AUDIENCE (see .env.example and mcp/README.md).\n",
  );
  process.exit(1);
}

const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  log.info("listening", { port: info.port, path: MCP_PATH, authMode: process.env.MCP_AUTH_MODE ?? "oidc" });
});

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    log.info("shutdown", { signal });
    // Sessions first: closing them releases the open SSE streams, so `server.close` can finish.
    void closeAllSessions().finally(() => server.close(() => process.exit(0)));
  });
}
