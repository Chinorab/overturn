# Infrastructure — Overturn on Alexa+ (AWS)

How the pieces are deployed, what each AWS service does, how to stand it up, what it costs, and
how to tear it down. Application-level docs: [`mcp/README.md`](../mcp/README.md) (server),
[`infra/cognito/README.md`](cognito/README.md) (auth).

## Architecture

```
                 voice / text                    OAuth 2.1 code + PKCE
  Person ───────────────────► Simulated Alexa+ web app ◄──────────────────► Amazon Cognito
  (browser, phone)            Next.js on Vercel  (/sim, /companion)          user pool, managed login
        │  companion upload         │        ▲                                      ▲
        │  (photo of the letter)    │ MCP    │ tools/list, tools/call               │ JWT verify (JWKS)
        ▼                           │ client │ Authorization: Bearer <JWT>          │ userInfo → email
  ┌──────────────┐                  ▼        │                                      │
  │ Amazon Polly │◄── TTS ──  Orchestrator (LLM tool use, provider interface)       │
  └──────────────┘                  │                                               │
                                    ▼  Streamable HTTP  https://bedrock-agentcore…/invocations
                      ┌───────────────────────────────────────────────────────────┐ │
                      │ Amazon Bedrock AgentCore Runtime  (protocol MCP, CUSTOM_JWT) │─┘
                      │  ┌─────────────────────────────────────────────────────┐  │
                      │  │ overturn-mcp-server (ARM64 container, :8000/mcp)   │  │
                      │  │  11 tools · in-memory cases · state machine        │  │
                      │  │  engine: model reads (Anthropic | Nebius) ·        │  │
                      │  │          code decides (rules dataset) ·            │  │
                      │  │          letter drafted, sent only on "yes"        │──┼──► Amazon SES v2
                      │  └─────────────────────────────────────────────────────┘  │    letter + summary PDF
                      └───────────────────────────────────────────────────────────┘    to the linked email
                                                                                        (fallback: one-time
  Future: Alexa+ device ── Alexa+ MCP Toolkit (partner preview) ──► same URL, same auth   download via /sim)
```

| Service | Role | Why this one |
|---|---|---|
| **Bedrock AgentCore Runtime** | Hosts the MCP server container; terminates auth (`401` + `WWW-Authenticate` per RFC 7235/9728), validates Cognito JWTs (`CUSTOM_JWT`), keeps a client on one runtime session via `Mcp-Session-Id` | Native MCP hosting with stateful streamable HTTP; the in-memory case store (no PHI at rest) is safe because a session sticks to one microVM. Lambda would lose state between invocations and force a database. |
| **Amazon Cognito** | OAuth 2.1 authorization server for account linking; source of the only email the server will send to | Exactly the shape the Alexa+ MCP Toolkit expects; no password handling in our code |
| **Amazon SES v2** | Delivers the appeal letter (PDF) and the one-page summary to the linked address | Attachments in `SendEmail` Simple content; verified sender; sandbox → production |
| **Amazon Polly** | The assistant's voice in the simulator (neural en-US) | Consistent voice for the demo; browser `speechSynthesis` fallback |
| **Amazon ECR** | Container image registry for AgentCore | Required by AgentCore for container deployments |
| **CloudWatch Logs** | Runtime logs (scrubbed: no document text, facts, letter text, emails) | Comes with AgentCore |
| **Vercel** | Web app + simulator (pre-existing deployment) | Unchanged from LexHack |
| Fallback: **AWS App Runner** | Same image behind a plain HTTPS URL if AgentCore blocks | Zero-ops container hosting; in-memory state per instance |

Nothing persistent is provisioned: no database, no S3 bucket for user data, no queue. The only
AWS resources are compute (AgentCore/App Runner), identity (Cognito, IAM), mail, speech, images
and logs.

## Regions and accounts

One region: **`us-east-1`** (Cognito, AgentCore, SES, ECR). Polly is called from Vercel with
the same region setting. One AWS account; resources are tagged `Project=overturn`,
`Feature=002-alexa-voice-mcp`.

## Prerequisites

- AWS CLI v2 configured (`aws sts get-caller-identity` works); Docker with `buildx` (ARM64 build);
  Node 22 + pnpm; `npm i -g @aws/agentcore` for the AgentCore CLI.
- An email address you control for the SES sender identity and one for the demo recipient.
- Permissions to create: Cognito user pools, ECR repositories, IAM roles, AgentCore runtimes,
  SES identities, CloudWatch log groups.

## Deploy, step by step

### 1. Cognito (5 min)

```bash
REGION=us-east-1 SIM_BASE_URL=https://<your-vercel-app> ./infra/cognito/setup.sh
```

Copy the printed `COGNITO_*` values into `mcp/.env` and the Vercel project; keep the
`--discovery-url` / `--allowed-clients` lines for step 4. Sign up one demo user through the
simulator's *Link account* button.

### 2. SES (5 min + waiting)

```bash
aws sesv2 create-email-identity --email-identity <sender@yourdomain>   --region us-east-1
aws sesv2 create-email-identity --email-identity <demo-recipient>       --region us-east-1   # sandbox only
```

Click both verification emails. **Request production access on day 1** (SES console → Account
dashboard → Request production access; state the use case: transactional, user-initiated,
one email per confirmed request, no marketing). Until it is granted, only verified recipients
receive mail; the assistant falls back to the download link for anyone else — that path is part of
the product, not a workaround. Set `SES_FROM` in `mcp/.env`.

### 3. Container image (10 min)

```bash
aws ecr create-repository --repository-name overturn-mcp --region us-east-1
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker buildx build --platform linux/arm64 -t <account>.dkr.ecr.us-east-1.amazonaws.com/overturn-mcp:$(git rev-parse --short HEAD) -f mcp/Dockerfile . --push
```

The Dockerfile runs `node --conditions=react-server dist/index.js`, listens on `0.0.0.0:8000`,
serves `/mcp` and `/healthz`. Test the image locally first:
`docker run -p 8000:8000 --env-file mcp/.env <image>` then `curl -i localhost:8000/mcp` → `401`.

### 4. IAM execution role for the runtime (5 min)

The runtime's role needs: pull from ECR (`ecr:GetAuthorizationToken`, `ecr:BatchGetImage`,
`ecr:GetDownloadUrlForLayer` on the repository), write logs (`logs:CreateLogGroup`,
`CreateLogStream`, `PutLogEvents`), and **`ses:SendEmail` restricted to the verified sender
identity** (condition `ses:FromAddress`). No other permissions: the server has no bucket, no
table, no secrets manager. LLM keys are passed as runtime environment variables. Policy files:
`infra/agentcore/role-trust.json`, `infra/agentcore/role-policy.json` ⟦T028⟧.

### 5. AgentCore Runtime (10 min)

Path A — CLI (verify TypeScript/container support on day 1; see friction log):

```bash
agentcore create --project-name overturn-mcp --no-agent
cd overturn-mcp
agentcore add agent --name OverturnMcp --protocol MCP \
  --authorizer-type CUSTOM_JWT \
  --discovery-url "https://cognito-idp.us-east-1.amazonaws.com/<pool-id>/.well-known/openid-configuration" \
  --allowed-clients "<sim-client-id>" "<inspector-client-id>" "<cli-client-id>" \
  --request-header-allowlist Authorization
# point the agent at the pushed container image, set env vars, then:
agentcore deploy
```

Path B — control-plane API from the pushed image (language-agnostic):

```bash
aws bedrock-agentcore-control create-agent-runtime \
  --agent-runtime-name overturn_mcp \
  --agent-runtime-artifact 'containerConfiguration={containerUri=<image uri>}' \
  --role-arn <execution role arn> \
  --network-configuration networkMode=PUBLIC \
  --protocol-configuration serverProtocol=MCP \
  --authorizer-configuration 'customJWTAuthorizer={discoveryUrl=<discovery url>,allowedClients=[<ids>]}' \
  --environment-variables MCP_AUTH_MODE=cognito,COGNITO_ISSUER=…,COGNITO_CLIENT_IDS=…,COGNITO_DOMAIN=…,SES_FROM=…,OVERTURN_LLM_PROVIDER=anthropic,ANTHROPIC_API_KEY=… \
  --region us-east-1
```

(Check exact flag names with `aws bedrock-agentcore-control create-agent-runtime help`; record
any difference in `FRICTION_LOG.md`.) The response contains the runtime ARN. The public MCP URL is:

```
https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/<URL-encoded ARN>/invocations?qualifier=DEFAULT
```

`MCP_PUBLIC_URL` in the runtime env must be that origin + path so the `WWW-Authenticate` header
and the protected-resource metadata point at the right place. Updating the image = push a new tag
and `update-agent-runtime` (or `agentcore deploy` again).

### 6. Verify (5 min)

```bash
curl -i "<MCP URL>"                                                    # 401 + WWW-Authenticate
BEARER=$(COGNITO_CLI_CLIENT_ID=<cli-client-id> ./infra/cognito/token.sh <demo-user>)
OVERTURN_MCP_URL="<MCP URL>" BEARER="$BEARER" pnpm test:mcp:remote     # full conformance
npx @modelcontextprotocol/inspector                                    # manual walkthrough
```

### 7. Simulator on Vercel (5 min)

Project environment variables: `OVERTURN_MCP_URL` (step 5), `COGNITO_ISSUER`, `COGNITO_DOMAIN`,
`COGNITO_CLIENT_ID` (simulator client), `SIM_BASE_URL`, `SIM_SESSION_SECRET`, `AWS_REGION`,
`POLLY_VOICE`, and credentials for an IAM user limited to `polly:SynthesizeSpeech`
(`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`). Redeploy. `SIM_BASE_URL/sim/link/callback` must be
in the simulator client's callback URLs (it is, if `setup.sh` ran with that `SIM_BASE_URL`).

### Fallback: App Runner

If AgentCore cannot be created or does not accept the image, the same image runs on App Runner:

```bash
aws apprunner create-service --service-name overturn-mcp \
  --source-configuration 'ImageRepository={ImageIdentifier=<image uri>,ImageRepositoryType=ECR,ImageConfiguration={Port=8000,RuntimeEnvironmentVariables={...}}},AutoDeploymentsEnabled=false,AuthenticationConfiguration={AccessRoleArn=<ecr access role>}' \
  --instance-configuration 'Cpu=1 vCPU,Memory=2 GB,InstanceRoleArn=<execution role arn>' \
  --region us-east-1
```

Differences: App Runner does not validate JWTs itself, so the server's own Cognito verification
(`MCP_AUTH_MODE=cognito`) is the only gate — which it is anyway locally; sessions are sticky to an
instance only while a single instance runs (keep min = max = 1 for the demo). Details
`infra/apprunner/` ⟦T028⟧.

## Environment variables by component

| Where | Variables |
|---|---|
| AgentCore / App Runner (MCP server) | `MCP_PORT=8000`, `MCP_PATH=/mcp`, `MCP_PUBLIC_URL`, `MCP_AUTH_MODE=cognito`, `COGNITO_ISSUER`, `COGNITO_CLIENT_IDS`, `COGNITO_DOMAIN`, `MCP_CASE_TTL_MINUTES`, `MCP_CODE_TOMBSTONE_HOURS`, `AWS_REGION`, `SES_FROM`, `SES_CONFIGURATION_SET` (optional), `OVERTURN_LLM_PROVIDER`, `ANTHROPIC_API_KEY` \| `NEBIUS_API_KEY` (+ `NEBIUS_*`) |
| Vercel (simulator) | `OVERTURN_MCP_URL`, `COGNITO_ISSUER`, `COGNITO_DOMAIN`, `COGNITO_CLIENT_ID`, `SIM_BASE_URL`, `SIM_SESSION_SECRET`, `AWS_REGION`, `POLLY_VOICE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (Polly-only user), `OVERTURN_LLM_PROVIDER` + key (orchestrator) |
| Local | everything above via `.env.local` and `mcp/.env`; `MCP_AUTH_MODE=dev` allowed |

Full list with comments: [`.env.example`](../.env.example). No value is committed anywhere;
`pnpm test -- privacy` scans `mcp/`, `infra/` and `app/` for key patterns.

## Security notes

- The MCP server never receives an email address from a client; it reads it from Cognito with
  the caller's own token. Sending to anyone else is impossible by construction.
- Documents, facts and letters exist only in the runtime's memory for one case (≤ 30 min idle)
  and are never logged. SES retains delivery metadata, not attachments, per its documentation —
  stated in `LEGAL_DESIGN.md`.
- LLM provider keys live in the runtime's environment (or Vercel's), never in the image.
- The simulator's IAM user can do exactly one thing (`polly:SynthesizeSpeech`); the runtime role
  can send mail only from `SES_FROM`.
- Self sign-up on the Cognito pool is deliberately open for judges; turn it off after judging
  (`aws cognito-idp update-user-pool --admin-create-user-config AllowAdminCreateUserOnly=true`).

## Cost (order of magnitude, verify before the video)

| Item | Expected for the hackathon |
|---|---|
| AgentCore Runtime | Consumption-based (vCPU-seconds, GB-seconds while a session is active); a few dollars for development plus judging |
| Cognito | Free tier (Essentials: 10,000 MAU) |
| SES | $0.10 per 1,000 emails + attachment data; effectively $0 |
| Polly neural | ~$16 per 1M characters; a full demo conversation ≈ 1,500 characters → cents |
| ECR | Storage of one ~200 MB image → cents |
| App Runner (only if used) | ~$0.064/h for 1 vCPU / 2 GB while running (~$46/month if left on) — stop it after judging |
| LLM calls | Tracked in `docs/api-spend.md` as for LexHack |

## Teardown

```bash
aws bedrock-agentcore-control delete-agent-runtime --agent-runtime-id <id> --region us-east-1
aws apprunner delete-service --service-arn <arn> --region us-east-1          # if created
aws ecr delete-repository --repository-name overturn-mcp --force --region us-east-1
./infra/cognito/teardown.sh
aws sesv2 delete-email-identity --email-identity <sender> --region us-east-1
aws iam delete-role-policy / delete-role for the execution role and the Polly user
```

Keep the Vercel project (it also serves the LexHack web app).

## Files

```
infra/
├── README.md              this file
├── cognito/               setup.sh · token.sh · teardown.sh · README.md
├── agentcore/             role-trust.json · role-policy.json · env.example · README.md  ⟦T028⟧
└── apprunner/             service.json · README.md                                       ⟦T028⟧
```
