#!/usr/bin/env bash
# Delete the Cognito resources created by setup.sh (pool, domain, clients). Irreversible:
# all demo users are deleted. Asks for confirmation.
set -euo pipefail
REGION="${REGION:-us-east-1}"
POOL_NAME="${POOL_NAME:-overturn-demo}"
aws_c() { aws cognito-idp "$@" --region "$REGION"; }

POOL_ID="$(aws_c list-user-pools --max-results 60 --query "UserPools[?Name=='${POOL_NAME}'].Id | [0]" --output text)"
[[ -z "$POOL_ID" || "$POOL_ID" == "None" ]] && { echo "no pool named $POOL_NAME in $REGION"; exit 0; }
DOMAIN="$(aws_c describe-user-pool --user-pool-id "$POOL_ID" --query 'UserPool.Domain' --output text)"

echo "About to delete user pool $POOL_ID ($POOL_NAME) and domain $DOMAIN in $REGION."
read -r -p "Type the pool id to confirm: " CONFIRM
[[ "$CONFIRM" == "$POOL_ID" ]] || { echo "aborted"; exit 1; }

if [[ -n "$DOMAIN" && "$DOMAIN" != "None" ]]; then
  aws_c delete-user-pool-domain --domain "$DOMAIN" --user-pool-id "$POOL_ID"
fi
aws_c delete-user-pool --user-pool-id "$POOL_ID"
echo "deleted"
