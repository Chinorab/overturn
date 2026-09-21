#!/usr/bin/env bash
# Create the Cognito user pool that acts as the OAuth 2.1 authorization server for the
# Overturn MCP server (Alexa+ account-linking shape: authorization code + PKCE, public clients).
#
# Creates, idempotently (re-running reuses what exists by name):
#   - a user pool with self sign-up and verified email (email is the username)
#   - a hosted-login domain
#   - three public app clients (no secret): simulator, MCP Inspector, CLI (password flow, tests only)
# Prints the environment values for .env.local / mcp/.env / AgentCore.
#
# Requires: aws CLI v2 configured with permissions on cognito-idp. No jq needed.
# Usage:
#   REGION=us-east-1 SIM_BASE_URL=https://overturn-peach.vercel.app ./infra/cognito/setup.sh
# Optional: POOL_NAME (default overturn-demo), DOMAIN_PREFIX (default overturn-demo-<account id>)
#
# Nothing here is a secret: pool ids, client ids and the domain are public identifiers.
# Passwords are never handled by this script.

set -euo pipefail

REGION="${REGION:-us-east-1}"
POOL_NAME="${POOL_NAME:-overturn-demo}"
SIM_BASE_URL="${SIM_BASE_URL:-http://localhost:3000}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DOMAIN_PREFIX="${DOMAIN_PREFIX:-overturn-demo-${ACCOUNT_ID}}"

aws_c() { aws cognito-idp "$@" --region "$REGION"; }

log() { printf '\n== %s\n' "$*" >&2; }

# ---------------------------------------------------------------- user pool
log "User pool '$POOL_NAME'"
POOL_ID="$(aws_c list-user-pools --max-results 60 \
  --query "UserPools[?Name=='${POOL_NAME}'].Id | [0]" --output text)"

if [[ -z "$POOL_ID" || "$POOL_ID" == "None" ]]; then
  POOL_ID="$(aws_c create-user-pool \
    --pool-name "$POOL_NAME" \
    --username-attributes email \
    --auto-verified-attributes email \
    --username-configuration CaseSensitive=false \
    --policies 'PasswordPolicy={MinimumLength=12,RequireUppercase=false,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false,TemporaryPasswordValidityDays=7}' \
    --admin-create-user-config AllowAdminCreateUserOnly=false \
    --schema Name=email,Required=true,Mutable=true \
    --user-attribute-update-settings AttributesRequireVerificationBeforeUpdate=email \
    --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
    --deletion-protection INACTIVE \
    --user-pool-tags Project=overturn,Feature=002-alexa-voice-mcp \
    --query UserPool.Id --output text)"
  echo "created $POOL_ID" >&2
else
  echo "exists  $POOL_ID" >&2
fi

ISSUER="https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}"
DISCOVERY_URL="${ISSUER}/.well-known/openid-configuration"

# ---------------------------------------------------------------- hosted domain
log "Hosted login domain '$DOMAIN_PREFIX'"
EXISTING_DOMAIN="$(aws_c describe-user-pool --user-pool-id "$POOL_ID" \
  --query 'UserPool.Domain' --output text)"
if [[ -z "$EXISTING_DOMAIN" || "$EXISTING_DOMAIN" == "None" ]]; then
  aws_c create-user-pool-domain --domain "$DOMAIN_PREFIX" --user-pool-id "$POOL_ID" >/dev/null
  echo "created" >&2
else
  DOMAIN_PREFIX="$EXISTING_DOMAIN"
  echo "exists  $DOMAIN_PREFIX" >&2
fi
COGNITO_DOMAIN="https://${DOMAIN_PREFIX}.auth.${REGION}.amazoncognito.com"

# ---------------------------------------------------------------- app clients
# find_or_create_client NAME CALLBACKS LOGOUTS [EXTRA ARGS...]
find_or_create_client() {
  local name="$1" callbacks="$2" logouts="$3"; shift 3
  local id
  id="$(aws_c list-user-pool-clients --user-pool-id "$POOL_ID" --max-results 60 \
    --query "UserPoolClients[?ClientName=='${name}'].ClientId | [0]" --output text)"
  if [[ -n "$id" && "$id" != "None" ]]; then
    echo "exists  $name $id" >&2
  else
    id="$(aws_c create-user-pool-client \
      --user-pool-id "$POOL_ID" \
      --client-name "$name" \
      --no-generate-secret \
      --supported-identity-providers COGNITO \
      --allowed-o-auth-flows code \
      --allowed-o-auth-flows-user-pool-client \
      --allowed-o-auth-scopes openid email profile \
      --callback-urls "$callbacks" \
      --logout-urls "$logouts" \
      --prevent-user-existence-errors ENABLED \
      --enable-token-revocation \
      --access-token-validity 60 --id-token-validity 60 --refresh-token-validity 30 \
      --token-validity-units AccessToken=minutes,IdToken=minutes,RefreshToken=days \
      "$@" \
      --query UserPoolClient.ClientId --output text)"
    echo "created $name $id" >&2
  fi
  printf '%s' "$id"
}

log "App clients (public, authorization code + PKCE)"
SIM_CLIENT_ID="$(find_or_create_client overturn-simulator \
  "http://localhost:3000/sim/link/callback,${SIM_BASE_URL}/sim/link/callback" \
  "http://localhost:3000/sim,${SIM_BASE_URL}/sim" \
  --explicit-auth-flows ALLOW_REFRESH_TOKEN_AUTH)"

# MCP Inspector's default OAuth callback
INSPECTOR_CLIENT_ID="$(find_or_create_client overturn-mcp-inspector \
  "http://localhost:6274/oauth/callback,http://localhost:6274/oauth/callback/debug" \
  "http://localhost:6274" \
  --explicit-auth-flows ALLOW_REFRESH_TOKEN_AUTH)"

# CLI client for automated tests only (token.sh): password auth, no hosted UI redirect needed
CLI_CLIENT_ID="$(find_or_create_client overturn-cli-tests \
  "http://localhost:3000/sim/link/callback" "http://localhost:3000/sim" \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH)"

# ---------------------------------------------------------------- output
cat <<EOF

# ---- paste into .env.local (web app) and mcp/.env (MCP server) ----
COGNITO_ISSUER=${ISSUER}
COGNITO_DOMAIN=${COGNITO_DOMAIN}
COGNITO_CLIENT_ID=${SIM_CLIENT_ID}
COGNITO_CLIENT_IDS=${SIM_CLIENT_ID},${INSPECTOR_CLIENT_ID},${CLI_CLIENT_ID}
AWS_REGION=${REGION}

# ---- AgentCore Runtime CUSTOM_JWT authorizer ----
#   --discovery-url "${DISCOVERY_URL}"
#   --allowed-clients "${SIM_CLIENT_ID}" "${INSPECTOR_CLIENT_ID}" "${CLI_CLIENT_ID}"

# ---- endpoints (for the MCP server's protected-resource metadata and the simulator) ----
#   authorize : ${COGNITO_DOMAIN}/oauth2/authorize
#   token     : ${COGNITO_DOMAIN}/oauth2/token
#   userInfo  : ${COGNITO_DOMAIN}/oauth2/userInfo   (returns "email" with the email scope)
#   jwks      : ${ISSUER}/.well-known/jwks.json

# Next: sign up a demo user through ${COGNITO_DOMAIN}/signup?client_id=${SIM_CLIENT_ID}&response_type=code&scope=openid+email+profile&redirect_uri=http://localhost:3000/sim/link/callback
# (or from the simulator's "Link account" button), then get a test token with infra/cognito/token.sh
EOF
