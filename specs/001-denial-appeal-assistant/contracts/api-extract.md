# Contract: POST /api/extract

Server route. Accepts one document, returns Extraction + Explanation. Stateless.

## Request
`multipart/form-data`
- `file`: PDF | image/jpeg | image/png, ≤ 10 MB, PDF ≤ 20 pages
- or `sample_id`: string (one of the bundled samples) — returns the pre-computed result, no model call

## Response 200
```json
{ "extraction": Extraction, "explanation": Explanation, "meta": { "model": "claude-opus-5", "ms": 18342, "cached": false } }
```

## Response 422 (document readable but unsupported)
```json
{ "code": "unsupported_program" | "unsupported_language" | "not_a_claim_document", "message": "...", "resource_url": "..." }
```
`unsupported_program` is raised server-side when `program_signals.value ∈ {medicare, medicaid, tricare}` with confidence ≥ 0.6.

## Response 413 / 415 / 429 / 503
Size / type / rate limit / model unavailable. Body: `{ code, message }`. The client renders each as a designed state.

## Guarantees
- No request body or model output is logged or stored; only `meta.ms` and status code are logged.
- Output validated with the Extraction Zod schema before returning; validation failure → 502 with `code: "extraction_invalid"` after one retry.
