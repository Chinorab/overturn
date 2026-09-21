# MCP conformance test — executable contract (T015)

Copy the code blocks into `tests/mcp/conformance.test.ts` and `tests/mcp/helpers.ts` at T015.
The test is the acceptance criterion for US3 and SC-007. It runs the real server (spawned, dev
auth) with the language model **mocked** through the provider interface, so it is deterministic,
offline, and under 20 s. The same file runs against the deployment with
`OVERTURN_MCP_URL` + `BEARER` set (`pnpm test:mcp:remote`), skipping the spawn and the mocks.

Assertions map to: `contracts/mcp-tools.md` (envelope, tools, confirmation gate), `data-model.md`
(statuses, errors), FR-030/031/032/033/040, Alexa+ QuickStart (401, < 500 ms).

## helpers.ts

```ts
import { spawn, type ChildProcess } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const REMOTE = !!process.env.OVERTURN_MCP_URL;
export const URL_ = process.env.OVERTURN_MCP_URL ?? "http://127.0.0.1:8765/mcp";
export const BEARER = process.env.BEARER ?? "conformance-dev-token";

/** Spawn the server with dev auth and a fake provider; resolve when /healthz answers. */
export async function startServer(): Promise<ChildProcess | null> {
  if (REMOTE) return null;
  const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "mcp/src/index.ts"], {
    env: {
      ...process.env,
      MCP_PORT: "8765",
      MCP_PUBLIC_URL: "http://127.0.0.1:8765",
      MCP_AUTH_MODE: "dev",
      MCP_DEV_BEARER: BEARER,
      MCP_DEV_EMAIL: "walter.demo@example.com",
      MCP_CASE_TTL_MINUTES: "30",
      OVERTURN_LLM_PROVIDER: "fake",          // lib/ai/providers/fake.ts: returns the samples' golden JSON
      OVERTURN_CLOCK: "2026-10-21T10:00:00Z", // injectable clock (store + rights-speech read it)
      SES_MODE: "mock",                        // lib/delivery/email.ts: records instead of sending
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try { if ((await fetch("http://127.0.0.1:8765/healthz")).ok) return child; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error("server did not start");
}

export async function connect(bearer: string | null = BEARER) {
  const transport = new StreamableHTTPClientTransport(new URL(URL_), {
    requestInit: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
  });
  const client = new Client({ name: "overturn-conformance", version: "1.0.0" });
  await client.connect(transport);
  return { client, transport };
}

/** Call a tool and return its structuredContent (the envelope). */
export async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const t0 = performance.now();
  const res = await client.callTool({ name, arguments: args });
  const ms = performance.now() - t0;
  const env = (res as any).structuredContent;
  if (!env) throw new Error(`${name}: no structuredContent`);
  return { env, ms, raw: res };
}

export const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1] ?? xs.at(-1)!;
```

## conformance.test.ts

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ChildProcess } from "node:child_process";
import { BEARER, REMOTE, URL_, call, connect, p95, startServer } from "./helpers";

const TOOLS = [
  "overturn_start_case", "overturn_attach_document", "overturn_use_sample", "overturn_answer",
  "overturn_get_readback", "overturn_confirm_facts", "overturn_compute_rights", "overturn_draft_letter",
  "overturn_send_letter", "overturn_discard_case", "overturn_get_help",
] as const;
const CONSEQUENTIAL = ["overturn_draft_letter", "overturn_send_letter", "overturn_discard_case"];
const NON_MODEL = ["overturn_start_case", "overturn_use_sample", "overturn_answer", "overturn_get_readback",
  "overturn_confirm_facts", "overturn_compute_rights", "overturn_get_help"];

let server: ChildProcess | null;
beforeAll(async () => { server = await startServer(); }, 20_000);
afterAll(() => server?.kill());

// ---------------------------------------------------------------- 1. protocol & discovery
describe("protocol", () => {
  it("negotiates 2025-11-25 over Streamable HTTP and exposes 11 annotated tools", async () => {
    const { client, transport } = await connect();
    expect(transport.protocolVersion).toBe("2025-11-25");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOLS].sort());
    for (const t of tools) {
      expect(t.description, t.name).toMatch(/\b(call|use)\b/i);          // written for an orchestrator: says when to call
      expect(t.inputSchema.type).toBe("object");
      expect(t.outputSchema, `${t.name} outputSchema`).toBeDefined();
      expect(t.annotations, `${t.name} annotations`).toBeDefined();
      if (CONSEQUENTIAL.includes(t.name)) expect(t.annotations?.readOnlyHint).toBeFalsy();
    }
    expect(tools.find((t) => t.name === "overturn_discard_case")?.annotations?.destructiveHint).toBe(true);
    expect(tools.find((t) => t.name === "overturn_get_help")?.annotations?.readOnlyHint).toBe(true);
    await client.close();
  });

  it("serves the persona prompt and the two resources", async () => {
    const { client } = await connect();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain("overturn_voice_persona");
    const persona = await client.getPrompt({ name: "overturn_voice_persona" });
    expect(persona.messages[0].content).toMatchObject({ type: "text" });
    expect((persona.messages[0].content as any).text).toMatch(/information, not legal advice/i);
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(expect.arrayContaining(["overturn://samples"]));
    const samples = await client.readResource({ uri: "overturn://samples" });
    expect(JSON.parse((samples.contents[0] as any).text).some((s: any) => s.id === "02-prior-auth-ca")).toBe(true);
    await client.close();
  });
});

// ---------------------------------------------------------------- 2. auth
describe("auth", () => {
  it("refuses unauthenticated requests with 401 + WWW-Authenticate resource_metadata", async () => {
    const res = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "x", version: "0" } } }) });
    expect(res.status).toBe(401);
    const www = res.headers.get("www-authenticate") ?? "";
    expect(www).toMatch(/^Bearer /);
    expect(www).toMatch(/resource_metadata="https?:\/\/[^"]+\/\.well-known\/oauth-protected-resource"/);
  });

  it("publishes protected-resource metadata pointing at the authorization server", async () => {
    const origin = new URL(URL_).origin;
    const res = await fetch(`${origin}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    const meta = await res.json();
    expect(meta.resource).toBeDefined();
    expect(Array.isArray(meta.authorization_servers) && meta.authorization_servers.length).toBeTruthy();
    if (REMOTE) expect(meta.authorization_servers[0]).toMatch(/^https:\/\/cognito-idp\./);
  });

  it("rejects a wrong bearer", async () => {
    await expect(connect("not-the-token")).rejects.toThrow(/401|Unauthorized/);
  });
});

// ---------------------------------------------------------------- 3. full sample case
describe("sample case 02 end to end", () => {
  const timings: number[] = [];
  const timed = async (client: any, name: string, args?: Record<string, unknown>) => {
    const r = await call(client, name, args);
    if (NON_MODEL.includes(name)) timings.push(r.ms);
    return r.env;
  };

  it("walks start → sample → confirm → answers → rights → draft (gated) → send (gated)", async () => {
    const { client } = await connect();

    const start = await timed(client, "overturn_start_case", { has_document: "yes" });
    expect(start.ok).toBe(true);
    expect(start.case.code).toMatch(/^[ACFHJKMNQRSWXY2345679]{6}$/);
    expect(start.case.status).toBe("awaiting_document");
    expect(start.speak.split(/\s+/).length).toBeLessThanOrEqual(60);
    expect(start.speak).toMatch(/not legal advice/i);
    expect((start.speak.match(/\?/g) ?? []).length).toBe(1);
    const code = start.case.code as string;

    const sample = await timed(client, "overturn_use_sample", { code, sample_id: "02-prior-auth-ca" });
    expect(sample.ok).toBe(true);
    expect(sample.case.status).toBe("facts_pending");
    expect(sample.data.readback.spoken).toMatch(/Pacific Crest Health Plan/);
    expect(sample.data.readback.spoken).toMatch(/eighteen thousand seven hundred fifty dollars/);
    expect(sample.data.readback.spoken.split(/\s+/).length).toBeLessThanOrEqual(40);
    expect(sample.data.readback.spoken.trim().endsWith("?")).toBe(true);

    // Consequential call before its state → wrong_state, never needs_confirmation
    const early = await timed(client, "overturn_draft_letter", { code, confirmed: true });
    expect(early.ok).toBe(false);
    expect(early.error.code).toBe("wrong_state");

    const confirm = await timed(client, "overturn_confirm_facts", { code, answer: "yes" });
    expect(confirm.ok).toBe(true);
    expect(confirm.case.status).toBe("facts_confirmed");
    expect(confirm.data.next).toBe("state");

    const state = await timed(client, "overturn_answer", { code, question: "state", utterance: "yes, California" });
    expect(state.data.understood).toMatchObject({ field: "state", value: "CA" });
    expect(state.data.next).toBe("plan_source");
    expect(state.data.options?.length ?? 0).toBeLessThanOrEqual(4);

    const plan = await timed(client, "overturn_answer", { code, question: "plan_source", utterance: "through Covered California" });
    expect(plan.data.understood.value).toBe("marketplace");
    expect(plan.data.next).toBe("emergency");                       // self_funded is skipped for marketplace

    const emergency = await timed(client, "overturn_answer", { code, question: "emergency", utterance: "no, it was scheduled" });
    expect(emergency.data.understood.value).toBe("no");
    const urgent = await timed(client, "overturn_answer", { code, question: "urgent", utterance: "no, it's done" });
    expect(urgent.data.next).toBe("compute_rights");

    const rights = await timed(client, "overturn_compute_rights", { code });
    expect(rights.ok).toBe(true);
    expect(rights.case.status).toBe("rights_computed");
    const s = rights.data.summary;
    expect(s.firstDeadline).toMatchObject({ date: "2027-03-10", daysRemaining: 140, approximate: false, ruleId: "fed.internal_appeal.filing_window" });
    for (const d of [s.firstDeadline, ...s.otherDeadlines]) {
      expect(d.sourceUrl).toMatch(/^https:\/\//);
      expect(d.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(s.protections.length).toBeGreaterThan(0);
    for (const p of s.protections) {
      expect(p.sourceUrl).toMatch(/^https:\/\//);
      expect(p.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.sourceName.length).toBeGreaterThan(3);
      expect(p.spoken).toMatch(new RegExp(p.sourceName.split(" ")[0]));   // the spoken line names its source
    }
    expect(s.protections.map((p: any) => p.id)).toEqual(expect.arrayContaining(["ca.grievance.then_dmhc_30_days", "ca.imr.free"]));
    expect(s.protections.map((p: any) => p.id)).not.toEqual(expect.arrayContaining(["nsa.emergency.no_balance_billing"]));
    for (const chunk of rights.data.chunks) expect(chunk.split(/\s+/).length).toBeLessThanOrEqual(120);
    expect(rights.data.chunks[0]).toMatch(/March 10th, 2027/);
    expect(rights.data.chunks[0]).toMatch(/140 days/);

    // Draft: gated
    const gate = await call(client, "overturn_draft_letter", { code });
    expect(gate.env.ok).toBe(false);
    expect(gate.env.needs_confirmation).toMatchObject({ action: "draft_letter" });
    expect(gate.env.needs_confirmation.question).toMatch(/\?$/);
    expect(gate.env.needs_confirmation.expectedYes).toEqual(expect.arrayContaining(["yes"]));
    expect(gate.env.case.status).toBe("rights_computed");             // nothing happened

    const draft = await call(client, "overturn_draft_letter", { code, confirmed: true });
    expect(draft.env.ok).toBe(true);
    expect(draft.env.case.status).toBe("letter_drafted");
    expect(draft.env.data.letter.blanksCount).toBeGreaterThan(0);
    expect(draft.env.data.letter.whereToSend.address).toMatch(/Grievance and Appeals/);

    // Send: gated, names the masked email, never the full one
    const sendGate = await call(client, "overturn_send_letter", { code });
    expect(sendGate.env.needs_confirmation.action).toBe("send_letter");
    expect(sendGate.env.needs_confirmation.question).toMatch(/w[^\s@]*@example\.com|w-dot-|w•••/);
    expect(JSON.stringify(sendGate.env)).not.toContain("walter.demo@example.com");

    const sent = await call(client, "overturn_send_letter", { code, confirmed: true });
    expect(sent.env.ok).toBe(true);
    expect(sent.env.case.status).toBe("sent");
    expect(sent.env.data.delivery.channel).toBe(REMOTE ? expect.stringMatching(/email|download_link/) : "email");
    expect(sent.env.data.delivery.toMasked).not.toContain("walter.demo");
    expect(sent.env.data.closing.humanHelp.name).toMatch(/DMHC/);
    expect(sent.env.speak).toMatch(/kept nothing/i);

    // Closed case answers case_closed
    const after = await call(client, "overturn_get_readback", { code });
    expect(after.env.error?.code).toBe("case_closed");

    await client.close();
  }, 60_000);

  it("keeps non-model calls under 500 ms at p95 (Alexa+ requirement)", () => {
    expect(timings.length).toBeGreaterThan(5);
    expect(p95(timings)).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------- 4. no-document path (no model at all)
describe("no-document path", () => {
  it("reaches an approximate deadline from five answers and drafts a letter with blanks", async () => {
    const { client } = await connect();
    const start = (await call(client, "overturn_start_case", { has_document: "no" })).env;
    expect(start.case.status).toBe("answering");
    expect(start.data.next).toBe("ask_state");
    const code = start.case.code;
    const seq: [string, string][] = [["state", "Texas"], ["plan_source", "through my employer"], ["self_funded", "no idea"],
      ["denial_category", "they said there was no prior authorization"], ["document_date", "about two weeks ago"], ["urgent", "no"]];
    let last: any;
    for (const [q, u] of seq) last = (await call(client, "overturn_answer", { code, question: q, utterance: u })).env;
    expect(last.data.next).toBe("compute_rights");
    const rights = (await call(client, "overturn_compute_rights", { code })).env;
    expect(rights.data.summary.firstDeadline).toMatchObject({ approximate: true, anchorDate: "2026-10-07", date: "2027-04-05" });
    expect(rights.data.chunks[0]).toMatch(/approximate|estimate/i);
    expect(rights.data.summary.protections.some((p: any) => p.id === "tx.internal_appeal.decision_30_days")).toBe(true);
    const draft = (await call(client, "overturn_draft_letter", { code, confirmed: true })).env;
    expect(draft.data.letter.blanksCount).toBeGreaterThanOrEqual(5);
    await client.close();
  }, 30_000);

  it("maps 'I don't know' to unknown and refuses it for the state", async () => {
    const { client } = await connect();
    const code = (await call(client, "overturn_start_case", { has_document: "no" })).env.case.code;
    const st = (await call(client, "overturn_answer", { code, question: "state", utterance: "I don't know" })).env;
    expect(st.ok).toBe(false);
    expect(st.error.code).toBe("not_understood");
    expect(st.error.speak).toMatch(/state/i);
    await client.close();
  });
});

// ---------------------------------------------------------------- 5. edges: unsupported, session, expiry, discard
describe("edges", () => {
  it("stops honestly on a Medicare document: no rights, no letter", async () => {
    const { client } = await connect();
    const code = (await call(client, "overturn_start_case", { has_document: "yes" })).env.case.code;
    const r = (await call(client, "overturn_use_sample", { code, sample_id: "06-medicare-unsupported" })).env;
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("unsupported_coverage");
    expect(r.error.speak).toMatch(/Medicare/);
    expect(r.error.speak).not.toMatch(/\d+ days/);
    const rights = (await call(client, "overturn_compute_rights", { code })).env;
    expect(rights.error.code).toMatch(/wrong_state|case_closed/);
    await client.close();
  });

  it("refuses a case code from another session", async () => {
    const a = await connect();
    const code = (await call(a.client, "overturn_start_case", {})).env.case.code;
    const b = await connect();
    const r = (await call(b.client, "overturn_get_readback", { code })).env;
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("wrong_session");
    await a.client.close(); await b.client.close();
  });

  it("discards only after confirmation, then the code is dead", async () => {
    const { client } = await connect();
    const code = (await call(client, "overturn_start_case", {})).env.case.code;
    const gate = (await call(client, "overturn_discard_case", { code })).env;
    expect(gate.needs_confirmation.action).toBe("discard_case");
    const done = (await call(client, "overturn_discard_case", { code, confirmed: true })).env;
    expect(done.ok).toBe(true);
    expect(done.speak).toMatch(/nothing was saved|kept nothing/i);
    const again = (await call(client, "overturn_start_case", {})).env;
    expect(again.case.code).not.toBe(code);                          // tombstoned for 24 h
    await client.close();
  });

  it.skipIf(REMOTE)("expires an idle case after 30 minutes (injected clock)", async () => {
    const { client } = await connect();
    const code = (await call(client, "overturn_start_case", {})).env.case.code;
    // Test-only endpoint enabled by OVERTURN_CLOCK: advance the server clock
    await fetch("http://127.0.0.1:8765/__test/clock", { method: "POST", body: JSON.stringify({ advanceMinutes: 31 }) });
    const r = (await call(client, "overturn_get_readback", { code })).env;
    expect(r.error.code).toBe("case_not_found");
    await client.close();
  });

  it("never returns the full email address through any tool", async () => {
    const { client } = await connect();
    const code = (await call(client, "overturn_start_case", {})).env.case.code;
    const help = await call(client, "overturn_get_help", { code });
    expect(JSON.stringify(help.raw)).not.toContain("walter.demo@example.com");
    await client.close();
  });
});
```

## What the implementation must provide for this to run

| Needed by the test | Task |
|---|---|
| `OVERTURN_LLM_PROVIDER=fake` → `lib/ai/providers/fake.ts` returning the samples' golden extraction/letter JSON | T006 |
| `OVERTURN_CLOCK` (fixed start) + `POST /__test/clock` (only when `OVERTURN_CLOCK` is set) | T009, T003 |
| `SES_MODE=mock` in `lib/delivery/email.ts` | T020 |
| `MCP_DEV_EMAIL` masked as `w…@example.com` in `speak`, never raw | T010 |
| `sample_id` values = sample file stems (`02-prior-auth-ca`, `06-medicare-unsupported`) | T011 |
| `plan_source = marketplace/direct` skips `self_funded`; employer asks it | T012 |
| Scripts: `test:mcp` = `vitest run tests/mcp`; `test:mcp:remote` = same with `OVERTURN_MCP_URL`/`BEARER` | T002 |

## Deliberate non-goals

- No test of the language model's output quality here (that is the provider parity test, T033,
  and the golden transcripts, T027).
- No test of the simulator (Playwright, T024). This file proves the *server* contract that any
  client, including a real Alexa+, would rely on.
