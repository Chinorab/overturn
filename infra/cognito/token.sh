#!/usr/bin/env bash
# Obtain a Cognito access token for tests and for MCP Inspector's "Bearer" field.
# Uses the overturn-cli-tests client (USER_PASSWORD_AUTH). The password is read from the
# terminal (hidden) or from COGNITO_TEST_PASSWORD in the environment — never from a file in
# the repo, never echoed.
#
# Usage:
#   COGNITO_CLI_CLIENT_ID=... REGION=us-east-1 ./infra/cognito/token.sh you@example.com
#   export BEARER=$(./infra/cognito/token.sh you@example.com)
set -euo pipefail

REGION="${REGION:-${AWS_REGION:-us-east-1}}"
CLIENT_ID="${COGNITO_CLI_CLIENT_ID:?set COGNITO_CLI_CLIENT_ID (overturn-cli-tests client id from setup.sh)}"
USERNAME="${1:?usage: token.sh <email>}"

if [[ -z "${COGNITO_TEST_PASSWORD:-}" ]]; then
  read -r -s -p "Password for ${USERNAME}: " COGNITO_TEST_PASSWORD; echo >&2
fi

aws cognito-idp initiate-auth \
  --region "$REGION" \
  --client-id "$CLIENT_ID" \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters "USERNAME=${USERNAME},PASSWORD=${COGNITO_TEST_PASSWORD}" \
  --query 'AuthenticationResult.AccessToken' --output text
