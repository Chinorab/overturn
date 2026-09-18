# Quickstart: run and validate

## Prerequisites
- Node 22, pnpm 9
- `ANTHROPIC_API_KEY` in `.env.local` (never committed)

## Run
```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Validate
```bash
pnpm typecheck
pnpm test           # vitest: rules golden table, schema (sources + dates), guard
pnpm test:e2e       # playwright: sample flow at 375px + axe scan
pnpm gen:samples    # regenerate sample PDFs from data/samples/*.source.json
pnpm precompute     # (needs API key) refresh cached extractions for samples
```

## Manual validation scenarios
1. Landing on a 375 px viewport: "is / is not" and privacy statement visible without scrolling; "Try a sample" reaches Understand without upload.
2. Sample 01 (medical necessity, NY, employer, self-funded unknown): rights show federal internal appeal + external review, NY DFS external appeal with caveat, claim-file right; deadline clock shows dates with anchors and sources.
3. Sample 03 (EOB, TX, emergency, out-of-network): NSA protection listed first.
4. Sample 06 (Medicare): honest stop screen with link, no rights computed.
5. Letter from sample 01: every citation appears in the rights panel; `[ADD: …]` placeholders present for unknown facts; edit a paragraph → downloaded PDF reflects it.
6. Kill network → sample flow still works (cached); upload shows the "service unavailable" designed state.
7. Keyboard-only run through the whole flow; screen reader announces extraction completion.
