# Friction Log — Build, Ship, Shape: Amazon Developer Hackathon

Recorded as each friction happens, not reconstructed afterwards. Track: Alexa+.
Severity: **Blocker** (no workaround inside the track's stated path) · **High** (hours lost or
path changed) · **Medium** (under an hour, workaround exists) · **Low** (annoyance).

| # | Date | Task attempted | Severity | Status |
|---|---|---|---|---|
| 1 | 2026-09-21 | Get access to the Alexa+ MCP Toolkit / web simulator to test a self-hosted MCP server | Blocker | Worked around (simulated path) |

---

## 1 — Alexa+ MCP Toolkit is partner-only; the track's primary path is not reachable by an individual developer

**Date**: 2026-09-21 (pre-window research, before the 2026-09-28 start)

**Task attempted**: Follow the Alexa+ MCP QuickStart (`alexa-ai configure` → `alexa-ai new mcp`
→ `deploy` → web simulator) to connect a self-hosted MCP server, as the Alexa+ track describes.

**Steps**:
1. Read the Devpost track page: "Build a self-hosted MCP server (spec 2025-11-25 or later, Streamable HTTP)".
2. Read `developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html` — full CLI flow, server requirements (Streamable HTTP, public URL, 401 + OAuth 2.1 PKCE, < 500 ms), web simulator.
3. Read `developer.amazon.com/alexaplus/` — "Alexa+ for Builders is currently available to select partners working directly with our team."
4. Read the July 2026 blog — "The integration paths are currently available in Preview."
5. Looked for a request-access form or waitlist: none on the developer portal.

**Expected**: A developer account is enough to register an add-on and test it in the web
simulator, as the QuickStart implies ("you authenticate with your Alexa developer account").

**Actual**: The QuickStart documents a flow that an individual cannot start; the only public
statement of eligibility is on a marketing page, not in the docs. The Devpost page anticipates
this with an alternative ("Build a simulated Alexa+ experience in a web app using your preferred
agentic tool") but does not say *why* one would need it, so a participant can spend hours on the
QuickStart before finding the eligibility sentence.

**Workaround**: Build the MCP server to the QuickStart's published requirements anyway
(Streamable HTTP, 401 on unauthenticated, OAuth 2.1 PKCE, sub-500 ms for non-model calls), and
build a simulated Alexa+ web app that drives it through a real MCP client. Document a "when
access opens" checklist instead of a device deployment.

**Suggestion**:
- Put the eligibility statement ("select partners", "Preview") at the top of the QuickStart and
  the Toolkit overview, with a link to a request-access form.
- On the Devpost track page, state plainly that the Toolkit is not open during the hackathon and
  make the simulated path the documented default, with a reference simulator or a spec for what
  "simulated Alexa+ experience" should demonstrate (voice in/out? transcript? account linking?).
- Offer hackathon participants a time-boxed sandbox add-on ID for the web simulator.
