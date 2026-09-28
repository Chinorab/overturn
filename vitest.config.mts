import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // See tests/stubs/server-only.ts: lets the unit tests import the AI pipeline, which is
      // server-only, without running the whole suite under --conditions=react-server.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/voice/**/*.test.ts", "tests/mcp/**/*.test.ts"],
    environment: "node",
  },
});
