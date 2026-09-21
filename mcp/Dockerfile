# overturn-mcp-server — container image for Bedrock AgentCore Runtime (linux/arm64) and App Runner.
#
# Build from the REPO ROOT (the server imports the shared engine in ../lib):
#   docker buildx build --platform linux/arm64 -f mcp/Dockerfile -t overturn-mcp:local .
# Run locally:
#   docker run --rm -p 8000:8000 --env-file mcp/.env overturn-mcp:local
#   curl -i localhost:8000/healthz      # 200
#   curl -i localhost:8000/mcp          # 401 + WWW-Authenticate
#
# Assumptions the build scripts must satisfy (T002/T003):
#   - `pnpm --filter overturn-mcp-server build` bundles mcp/src/index.ts (and the ../lib code it imports)
#     into mcp/dist/index.js with esbuild, packages external, `@/lib/*` resolved from the root tsconfig.
#   - mcp/package.json lists every runtime dependency the bundle imports, including the ones ../lib
#     uses (zod, @anthropic-ai/sdk, openai, date-fns, @react-pdf/renderer, react, pdfjs-dist, server-only),
#     so `pnpm deploy --prod` produces a complete, self-contained node_modules for this package alone.
#   - AgentCore expects the server on 0.0.0.0:8000 at /mcp (MCP_PORT / MCP_PATH default to that).

# ---------- 1. deps + build (all workspaces, dev deps included) ----------
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# Lockfile-first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY mcp/package.json mcp/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Sources actually needed by the server (keep the image build honest: no app/, no tests)
COPY tsconfig.json ./
COPY lib ./lib
COPY data/rules ./data/rules
COPY data/help-resources.json data/glossary.json ./data/
COPY data/samples ./data/samples
COPY mcp ./mcp

RUN pnpm --filter overturn-mcp-server build \
 && pnpm --filter overturn-mcp-server deploy --prod /out \
 && cp -r mcp/dist /out/dist \
 && mkdir -p /out/data && cp -r data/rules data/help-resources.json data/glossary.json data/samples /out/data/ \
 && cp mcp/prompts/overturn_voice_persona.md /out/

# ---------- 2. runtime ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    MCP_PORT=8000 \
    MCP_PATH=/mcp \
    NODE_OPTIONS=--conditions=react-server
# --conditions=react-server: the shared engine imports "server-only", whose default export throws
# outside a React Server environment; this condition resolves it to the package's empty variant.

RUN groupadd --system overturn && useradd --system --gid overturn --home /app overturn
WORKDIR /app
COPY --from=build --chown=overturn:overturn /out /app

USER overturn
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MCP_PORT||8000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# No secrets baked in: keys and Cognito values come from the runtime environment
# (AgentCore --environment-variables, App Runner RuntimeEnvironmentVariables, or --env-file locally).
CMD ["node", "dist/index.js"]
