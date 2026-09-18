# Contract: POST /api/draft

Server route. Drafts the appeal letter from confirmed facts, answers, and the computed rights.
The server does not recompute rights; it trusts the client's RightsResult but the guard verifies
citations are a subset of it.

## Request (application/json)
```json
{ "situation": Situation, "rights": RightsResult, "tone": "formal" }
```

## Response 200
`LetterDraft` (see data-model). Streams section text as SSE when `Accept: text/event-stream`; otherwise returns the full JSON.

## Guard (server-side, before returning)
1. Every `[[cite:rule_id]]` marker in the text must be in `rights.rules[].rule.id`; unknown → removed and listed in `guard_report.unknown_citations`.
2. Prescriptive-phrase scan (`you should`, `you must`, `you will win`, `guaranteed`, `I advise`, `legal advice`…) on the generated text → one regeneration with a corrective instruction; remaining hits are reported and highlighted in the UI.
3. Any value in the letter that is not present in `situation` and not a placeholder is a fabrication risk; the prompt forbids it and the schema requires `placeholders[]` to list every `[ADD: …]`.

## Errors
400 (schema), 429, 503 as in `/api/extract`.
