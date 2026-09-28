/**
 * Bundle the MCP server. The server imports the shared engine from ../lib through the `@/…`
 * alias, which tsc alone would not rewrite, so esbuild resolves it and emits one file.
 *
 * Packages stay external: `pnpm deploy --prod` ships a complete node_modules beside dist/, and
 * bundling native/react-server-conditioned packages (react-pdf, the Anthropic SDK) would be both
 * slower and riskier than letting Node resolve them at runtime.
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const pkg = JSON.parse(readFileSync(resolve(repo, "mcp/package.json"), "utf8"));

const result = await build({
  entryPoints: [resolve(repo, "mcp/src/index.ts")],
  outfile: resolve(repo, "mcp/dist/index.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  // `server-only` resolves to its empty variant under this condition; the runtime sets the same
  // one via NODE_OPTIONS, so what the bundle assumes and what Node does agree.
  conditions: ["react-server", "node", "import"],
  external: [...Object.keys(pkg.dependencies ?? {}), "node:*"],
  alias: { "@": repo },
  loader: { ".json": "json" },
  logLevel: "info",
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`mcp/dist/index.js — ${(bytes / 1024).toFixed(0)} kB, externals: ${Object.keys(pkg.dependencies ?? {}).length}`);
