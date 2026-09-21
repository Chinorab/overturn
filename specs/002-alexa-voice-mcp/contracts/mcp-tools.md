# Contract: `overturn-mcp-server` tools

Protocol: MCP **2025-11-25**, Streamable HTTP, endpoint `POST/GET/DELETE /mcp`, stateful
(`Mcp-Session-Id`). Auth: `Authorization: Bearer <Cognito JWT>`; missing/invalid →
`401` + `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"`.
Health: `GET /healthz` (no auth). All tools return the envelope in `data-model.md` as
`structuredContent` plus a text block with `speak`.

Descriptions below are the ones shipped to the orchestrator (they are the product for an
assistant — written for "when to call", not "what it does"). Input/output schemas are zod, exported
from `mcp/src/tools/*.ts` and mirrored here.

---

### `overturn_start_case`
*Call first, as soon as the user mentions a denied claim, denied prior authorization, denied
insurance, or a surprise medical bill. Returns the spoken opening (information-not-advice line
+ the single question "do you have the letter?") and a case code. Ask exactly that question next.*

- in: `{ has_document?: "yes" | "no" | "unknown" }`
- out: `{ code, spokenCode, next: "ask_has_document" | "offer_upload" | "ask_state", speak }`

### `overturn_attach_document`
*Call when the client has received the user's document (the companion page in the simulator).
Never ask the user to read the document aloud. Long call (up to 60 s, reports progress); say a
short acknowledgement before calling.*

- in: `{ code, document: { kind: "pdf" | "image", media_type?, base64 } }`
- out: `{ readback: { spoken, fields }, next: "confirm_facts", speak }` or error
  `unsupported_document | unsupported_coverage | model_unavailable | unsupported_on_provider`

### `overturn_use_sample`
*Call when the user wants to try with a sample, or when the client is demonstrating. Lists
samples when `sample_id` is omitted.*

- in: `{ code, sample_id?: string }`
- out: `{ samples?: { id, spoken }[], readback?, next, speak }`

### `overturn_answer`
*Call with ONE answer at a time, exactly as the user said it; the server maps free words to the
allowed values and tells you the next question to ask. Never ask two questions at once. Accept
"I don't know" (maps to `unknown`) for everything except the state.*

- in: `{ code, question: "state" | "plan_source" | "self_funded" | "emergency" | "urgent" | "denial_category" | "document_date" | "correction", utterance: string, field?: string }`
- out: `{ understood: { field, value, spoken }, next: <question id> | "confirm_facts" | "compute_rights", options?: string[] (≤ 4), speak }`
  or `{ ok:false, error: { code: "not_understood", speak } }` with the two/four options re-listed.

### `overturn_get_readback`
*Call to repeat the current facts read-back (user said "repeat" or "say that again").*

- in: `{ code }` · out: `{ readback, speak }`

### `overturn_confirm_facts`
*Call after the user answered the read-back question. `yes` moves on; `no` returns the list of
fields to ask about; a correction is sent through `overturn_answer` with `question: "correction"`.*

- in: `{ code, answer: "yes" | "no" }`
- out: `{ next: "compute_rights" | "ask_which_field", fields?: { field, spoken }[], speak }`

### `overturn_compute_rights`
*Call once facts are confirmed. Deterministic, fast. Returns what to say in ≤ 120-word chunks:
first deadline (date + days), then up to three protections each naming its source. Speak
`chunks[0]`, offer "more" for the rest. Never rephrase deadlines or sources.*

- in: `{ code }`
- out: `{ summary: SpokenRightsSummary, chunks: string[], next: "offer_letter", speak }`

### `overturn_draft_letter` — **consequential**
*Call only after the user said yes to "Do you want me to draft an appeal letter?". Without
`confirmed: true` the server returns `needs_confirmation` with the exact question to ask. Long
call (progress).*

- in: `{ code, confirmed?: boolean }`
- out: `{ letter: { pages, blanksCount, attachmentsChecklist[], whereToSend }, next: "offer_send", speak }`

### `overturn_send_letter` — **consequential**
*Call only after the user said yes to the send question, which includes the masked email. The
server sends to the account's email only; there is no recipient parameter. On failure it returns a
download link to read out / show.*

- in: `{ code, confirmed?: boolean }`
- out: `{ delivery: { channel, toMasked, outcome, downloadUrl? }, closing: { attachments, whereToSend, humanHelp }, speak }`

### `overturn_discard_case` — **consequential (destructive)**
*Call when the user says stop, cancel, never mind, or asks to delete everything. Confirms that
nothing was kept.*

- in: `{ code, confirmed?: boolean }` · out: `{ speak }`

### `overturn_get_help`
*Call whenever the user asks "should I appeal?", "will I win?", sounds distressed, or asks for a
human. Returns the free Consumer Assistance Program / regulator for the case's state (federal
fallback) and the one-sentence "I can't advise, but…" line.*

- in: `{ code?, state? }` · out: `{ humanHelp, speak }`

---

## Resources

- `overturn://samples` — list of bundled samples (id, title, state, category).
- `overturn://rules/{jurisdiction}` — read-only view of the rules dataset with version.

## Prompts

- `overturn_voice_persona` — the recommended system prompt for an orchestrating assistant
  (one question per turn, ≤ 60 words, read-back, confirmation protocol, no advice). The simulator
  loads this prompt through MCP rather than hard-coding it, so any client gets the same voice.

## Conformance test (tests/mcp/conformance.test.ts)

1. `initialize` negotiates `2025-11-25`; `tools/list` returns the 11 tools with annotations.
2. No bearer → `401` with `WWW-Authenticate`; `/.well-known/oauth-protected-resource` lists the Cognito issuer.
3. Sample case: start → use_sample(02) → confirm_facts(yes) → answer(...) → compute_rights →
   draft_letter (expects `needs_confirmation`, then `confirmed:true`) → send_letter (SES mocked)
   → every deadline/protection has `sourceUrl` and `lastVerified`.
4. `send_letter` without prior draft → `wrong_state`; second session using the code → `wrong_session`.
5. Idle expiry (clock injected) → `case_not_found`.
6. Non-model tool calls complete in < 500 ms (p95 over the run).
