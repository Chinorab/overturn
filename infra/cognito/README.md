# Cognito — authorization server for the Overturn MCP server

Amazon Cognito plays the role the Alexa+ MCP Toolkit expects of an account-linking provider:
OAuth 2.1 authorization code with PKCE, public clients, an `email` claim we can trust. The
MCP server is only a resource server (it verifies tokens); the simulator is a client.

```
./infra/cognito/setup.sh          # creates pool, domain, 3 public clients; prints env values
./infra/cognito/token.sh <email>  # access token for tests / MCP Inspector (CLI client)
./infra/cognito/teardown.sh       # deletes everything created by setup.sh
```

## What setup.sh creates

| Resource | Purpose |
|---|---|
| User pool `overturn-demo` | email = username, self sign-up, email verified by Cognito's built-in sender (fine for a demo; switch to SES in the console if volume grows) |
| Domain `overturn-demo-<account>` | hosted sign-in / sign-up pages |
| Client `overturn-simulator` | the web app's PKCE flow; callbacks `http://localhost:3000/sim/link/callback` and `<SIM_BASE_URL>/sim/link/callback` |
| Client `overturn-mcp-inspector` | lets MCP Inspector complete the OAuth flow itself (callback `http://localhost:6274/oauth/callback`) |
| Client `overturn-cli-tests` | `USER_PASSWORD_AUTH` for `token.sh` and the remote conformance test only |

All clients: no secret, scopes `openid email profile`, access/ID tokens 60 min, refresh 30 days,
token revocation on.

## Facts the code relies on (T010, T017)

- **Access tokens** carry `token_use: "access"`, `client_id` (not `aud`), `iss` = `COGNITO_ISSUER`,
  `scope`. Verify signature against `<issuer>/.well-known/jwks.json`, then `iss`, `token_use`
  and that `client_id` is in `COGNITO_CLIENT_IDS`. Access tokens do **not** contain `email`.
- **Email** comes from `GET <COGNITO_DOMAIN>/oauth2/userInfo` with the access token (needs the
  `email` scope). The server calls it once per MCP session, keeps `{ email, emailMasked }` in
  memory, and never returns `email` through a tool.
- **PKCE** is standard `S256`; Cognito's `/oauth2/authorize` accepts `code_challenge` and
  `code_challenge_method`; the token endpoint takes `code_verifier`. No client secret anywhere.
- **Protected-resource metadata** (`/.well-known/oauth-protected-resource` on the MCP server)
  lists `authorization_servers: [COGNITO_ISSUER]`. Cognito publishes
  `/.well-known/openid-configuration`, which MCP clients can follow. Cognito has **no dynamic
  client registration**: clients must use one of the pre-registered IDs (documented limitation,
  logged in FEEDBACK.md).
- **AgentCore** `CUSTOM_JWT` authorizer takes the discovery URL and the allowed client IDs
  printed by `setup.sh`; it performs the same checks before the request reaches the container.

## Judges

Self sign-up is open on purpose: a judge signs up with any email from the simulator's *Link
account* button, receives a verification code from Cognito, and is in. For MCP Inspector, use
the Inspector client (OAuth in the browser) or a token from `token.sh`.

## Cost

Cognito's free tier covers this demo (10,000 monthly active users on the Essentials tier at the
time of writing). Verify current pricing before the video.
