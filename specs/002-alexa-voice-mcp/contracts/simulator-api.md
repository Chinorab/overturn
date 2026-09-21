# Contract: simulated Alexa+ web app (`/sim`, `/companion`)

The simulator is an MCP **client**. Everything it knows about a case comes from tool results
(FR-034). Routes live in the existing Next.js app; state is in-memory per `simSessionId`.

## Pages

| Route | Purpose |
|---|---|
| `/sim` | Voice console: big mic button, live transcript, "Alexa+ simulation (unofficial)" banner, provider/latency badge, companion QR/link. Typed input always available (accessibility + Playwright). |
| `/sim/link` | Start Cognito PKCE flow ("Link your account"); callback at `/sim/link/callback`. Shows the masked email once linked. |
| `/companion` | Enter case code → upload (PDF/JPG/PNG ≤ 10 MB) or pick a sample → status ("Reading… / Done, go back to voice"). Works on a phone via QR from `/sim`. |
| `/companion/download/[token]` | One-time letter download when email failed. |

## API (server-side, same origin)

| Method & path | Body → Response | Notes |
|---|---|---|
| `POST /api/sim/turn` | `{ text }` → SSE stream of `{ type: "assistant_text" \| "tool_call" \| "tool_result" \| "audio_url" \| "violation" \| "done" }` | Runs one orchestrator turn; enforces FR-001/002 post-check; requests Polly audio |
| `POST /api/sim/reset` | — → `{ ok }` | Discards case via MCP, clears transcript |
| `POST /api/companion/upload` | multipart `{ code, file }` or `{ code, sample_id }` → `{ ok, status }` | Calls `overturn_attach_document` / `overturn_use_sample` on the MCP session that owns `code`; the session is found in the simulator's memory map, not by asking the MCP server |
| `GET /api/companion/status?code=` | → `{ status: "waiting" \| "reading" \| "done" \| "error" }` | Polled by the companion page |
| `GET /api/sim/tts?text=` | → `audio/mpeg` | Polly (cached per text hash for the session); 503 → client falls back to `speechSynthesis` |
| `GET /api/sim/download/[token]` | → `application/pdf` | Single use |

## Orchestrator contract

- System prompt = `overturn_voice_persona` prompt fetched over MCP + simulator-specific lines
  (wake word handling, "you are in a simulation; do not claim to be a real device").
- Tools = `tools/list` from the MCP server, passed as provider tool definitions unchanged.
- Loop: user text → LLM → (tool calls → results) × ≤ 4 → assistant text. A `needs_confirmation`
  result short-circuits: the assistant must output that `question` verbatim.
- Post-check (deterministic): count `?` and question-words per turn (> 1 → regenerate once, then
  truncate to the first question), word count (> 60, or > 120 for a rights chunk → regenerate
  once, then truncate at a sentence boundary), banned-phrase list from `lib/ai/guard.ts`
  ("you should", "you will win", …). Violations are emitted as `violation` events and counted
  for SC-005.
- Latency cover: if the first token has not arrived in 2.5 s, the client plays a canned
  acknowledgement ("One moment.") once.

## Voice client contract

- STT: `webkitSpeechRecognition`/`SpeechRecognition`, `lang = "en-US"`, `interimResults`
  shown greyed, final result sent on end-of-speech; mic auto-reopens after TTS ends (barge-in:
  pressing the mic stops TTS).
- Wake word: a final transcript starting with "alexa" has the word stripped and is shown as
  `Alexa,` in the transcript; without wake word the text is still accepted (the sim is always
  "listening").
- TTS: Polly `engine: neural`, `voice: Danielle` (or `Joanna`), SSML with `<break>` between
  sentences; fallback `speechSynthesis` en-US.

## Environment variables (simulator side)

`OVERTURN_MCP_URL`, `COGNITO_ISSUER`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`, `SIM_BASE_URL`,
`AWS_REGION`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or role), `POLLY_VOICE`,
`OVERTURN_LLM_PROVIDER`, `ANTHROPIC_API_KEY` | `NEBIUS_API_KEY`.
