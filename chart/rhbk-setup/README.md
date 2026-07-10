# RHBK Setup for Cloudlet Manager

This directory contains scripts to configure RHBK (Red Hat Build of Keycloak) for Cloudlet Manager SSO.

## What it creates

| Resource | Name | Purpose |
|---|---|---|
| OIDC Client | `cloudlet-manager` | Confidential client with PKCE |
| Group | `cloudlet-admins` | Users in this group can access the app |
| Protocol Mapper | `groups` | Adds group membership to the OIDC token |
| Test User | `cloudlet-admin` | Test account (password: `admin123`) |

## Usage

```bash
export KC_URL="https://keycloak.apps.cluster.example.com"
export KC_ADMIN_USER="admin"
export KC_ADMIN_PASS="your-admin-password"
export REALM="myrealm"
export APP_ROUTE="cloudlet-manager.apps.cluster.example.com"

bash setup-rhbk.sh
```

The script outputs the **Client Secret** — store it in Vault and reference it in your Helm values.

## After running

1. Copy the client secret into Vault:
   ```bash
   vault kv put secret/cloudlet-manager/sso client-secret="<from script output>"
   ```

2. Generate an OAuth2 Proxy cookie secret and store it:
   ```bash
   COOKIE=$(python3 -c "import os,base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")
   vault kv put secret/cloudlet-manager/oauth-proxy cookie-secret="$COOKIE"
   ```

3. Update your Helm values with `sso.enabled: true` and deploy.
