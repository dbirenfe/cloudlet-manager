#!/bin/bash
# ============================================================
# Cloudlet Manager - RHBK (Keycloak) Setup Script
# 
# Run this script to configure the OIDC client, groups, mapper,
# and a test user in your RHBK instance.
#
# Usage:
#   export KC_URL="https://keycloak.apps.cluster.example.com"
#   export KC_ADMIN_USER="admin"
#   export KC_ADMIN_PASS="your-admin-password"
#   export REALM="myrealm"
#   export APP_ROUTE="cloudlet-manager.apps.cluster.example.com"
#   bash setup-rhbk.sh
# ============================================================

set -euo pipefail

: "${KC_URL:?Set KC_URL to your Keycloak base URL}"
: "${KC_ADMIN_USER:?Set KC_ADMIN_USER}"
: "${KC_ADMIN_PASS:?Set KC_ADMIN_PASS}"
: "${REALM:?Set REALM}"
: "${APP_ROUTE:?Set APP_ROUTE to the cloudlet-manager route hostname}"

echo "==> Getting admin token..."
TOKEN=$(curl -sk -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=admin-cli&username=${KC_ADMIN_USER}&password=${KC_ADMIN_PASS}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

API="${KC_URL}/admin/realms/${REALM}"
AUTH="Authorization: Bearer ${TOKEN}"

echo "==> Creating client 'cloudlet-manager'..."
curl -sk -X POST "${API}/clients" \
  -H "${AUTH}" -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"cloudlet-manager\",
    \"name\": \"Cloudlet Manager\",
    \"enabled\": true,
    \"protocol\": \"openid-connect\",
    \"publicClient\": false,
    \"standardFlowEnabled\": true,
    \"directAccessGrantsEnabled\": false,
    \"redirectUris\": [\"https://${APP_ROUTE}/oauth2/callback\"],
    \"webOrigins\": [\"https://${APP_ROUTE}\"],
    \"attributes\": {\"pkce.code.challenge.method\": \"S256\"}
  }" -o /dev/null -w "HTTP %{http_code}\n"

CLIENT_UUID=$(curl -sk -H "${AUTH}" "${API}/clients?clientId=cloudlet-manager" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

CLIENT_SECRET=$(curl -sk -H "${AUTH}" "${API}/clients/${CLIENT_UUID}/client-secret" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['value'])")

echo "    Client UUID:   ${CLIENT_UUID}"
echo "    Client Secret: ${CLIENT_SECRET}"

echo "==> Creating group 'cloudlet-admins'..."
curl -sk -X POST "${API}/groups" \
  -H "${AUTH}" -H "Content-Type: application/json" \
  -d '{"name": "cloudlet-admins"}' -o /dev/null -w "HTTP %{http_code}\n"

GROUP_ID=$(curl -sk -H "${AUTH}" "${API}/groups?search=cloudlet-admins" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

echo "==> Adding 'groups' mapper to client..."
curl -sk -X POST "${API}/clients/${CLIENT_UUID}/protocol-mappers/models" \
  -H "${AUTH}" -H "Content-Type: application/json" \
  -d '{
    "name": "groups",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-group-membership-mapper",
    "consentRequired": false,
    "config": {
      "full.path": "true",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "claim.name": "groups",
      "userinfo.token.claim": "true"
    }
  }' -o /dev/null -w "HTTP %{http_code}\n"

echo "==> Creating test user 'cloudlet-admin'..."
curl -sk -X POST "${API}/users" \
  -H "${AUTH}" -H "Content-Type: application/json" \
  -d '{
    "username": "cloudlet-admin",
    "enabled": true,
    "firstName": "Cloudlet",
    "lastName": "Admin",
    "email": "cloudlet-admin@example.com",
    "emailVerified": true,
    "credentials": [{"type": "password", "value": "admin123", "temporary": false}]
  }' -o /dev/null -w "HTTP %{http_code}\n"

USER_ID=$(curl -sk -H "${AUTH}" "${API}/users?username=cloudlet-admin" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

echo "==> Adding user to 'cloudlet-admins' group..."
curl -sk -X PUT "${API}/users/${USER_ID}/groups/${GROUP_ID}" \
  -H "${AUTH}" -H "Content-Type: application/json" -o /dev/null -w "HTTP %{http_code}\n"

echo ""
echo "============================================================"
echo "  RHBK SETUP COMPLETE"
echo "============================================================"
echo "  Client ID:       cloudlet-manager"
echo "  Client Secret:   ${CLIENT_SECRET}"
echo "  Group:           /cloudlet-admins"
echo "  Test User:       cloudlet-admin / admin123"
echo "  Redirect URI:    https://${APP_ROUTE}/oauth2/callback"
echo ""
echo "  Store the Client Secret in Vault at:"
echo "    vault kv put secret/cloudlet-manager/sso client-secret=\"${CLIENT_SECRET}\""
echo "============================================================"
