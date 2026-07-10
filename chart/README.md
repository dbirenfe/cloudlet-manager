# Cloudlet Manager — Helm Chart v2.0.0

GitOps branch management dashboard for ArgoCD-managed clusters.

Browse clusters by flavor/env, see which apps use which branches, swap branches, edit values files, get warnings for deleted branches — all committed back to the spec repo with full audit trail.

---

## Features

| Feature | Description |
|---|---|
| **Cluster browser** | Navigate by flavor → env → cluster with a tree sidebar |
| **Branch management** | Dropdown to change `targetRevision` per app, per scope |
| **Values file management** | Multi-select chips to add/remove Helm values files |
| **Inheritance** | "Inherit from parent scope" removes overrides so parent config takes effect |
| **Missing branch alerts** | Bell icon with badge count, auto-refreshes every 5 min |
| **Diff preview** | Side-by-side before/after of the YAML file before committing |
| **Global search** | Search branches or values files across all clusters |
| **Bulk update** | Change a branch across multiple clusters in one operation |
| **Audit log** | Timeline of all changes with who, what, when, and commit links |
| **SSO (RHBK)** | OAuth2 Proxy sidecar with Keycloak OIDC, group-based access control |
| **User display** | Shows logged-in username in header, includes it in commit messages |

---

## Architecture

```
                  ┌──────────────────────────────────────────┐
                  │            Frontend Pod                   │
   Route ────►   │  oauth2-proxy (:4180)  ──►  nginx (:8080)│
   (TLS edge)    │  (OIDC login via RHBK)     (React SPA +  │
                  │                            /api/ proxy)   │
                  └───────────────────────────┬───────────────┘
                                              │ /api/*
                                              ▼
                                ┌─────────────────────────┐
                                │     Backend Pod          │
                                │  FastAPI (:8000)         │
                                │  - reads spec repo       │
                                │  - validates OIDC tokens │
                                │  - commits changes       │
                                └─────────────────────────┘
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| **OpenShift** | 4.12+ |
| **Helm** | v3.x |
| **ExternalSecrets Operator** | With a `SecretStore`/`ClusterSecretStore` pointing to Vault |
| **HashiCorp Vault** | Secrets pre-populated (see below) |
| **RHBK (Keycloak)** | Client configured (see `rhbk-setup/`) |
| **Internal Git** | Hosting the `cloudlets-spec` repo |
| **Internal Registry** | Container images mirrored |

---

## Image Mirroring (Air-Gapped)

Three images need to be in your internal registry:

| Image | Source | Tag |
|---|---|---|
| `cloudlet-manager/backend` | Built from `backend/Dockerfile` | `2.0.0` |
| `cloudlet-manager/frontend` | Built from `frontend/Dockerfile` | `2.0.0` |
| `oauth2-proxy/oauth2-proxy` | `quay.io/oauth2-proxy/oauth2-proxy` | `v7.7.1` |

**Important:** Build with `--platform linux/amd64` if building on Apple Silicon.

### Build and push

```bash
# Backend
podman build --platform linux/amd64 -t registry.internal/cloudlet-manager/backend:2.0.0 backend/
podman push registry.internal/cloudlet-manager/backend:2.0.0

# Frontend
podman build --platform linux/amd64 -t registry.internal/cloudlet-manager/frontend:2.0.0 frontend/
podman push registry.internal/cloudlet-manager/frontend:2.0.0

# OAuth2 Proxy (pull, retag, push)
podman pull quay.io/oauth2-proxy/oauth2-proxy:v7.7.1
podman tag quay.io/oauth2-proxy/oauth2-proxy:v7.7.1 registry.internal/oauth2-proxy/oauth2-proxy:v7.7.1
podman push registry.internal/oauth2-proxy/oauth2-proxy:v7.7.1
```

### Offline transfer (no network to registry)

```bash
podman save -o cloudlet-backend.tar registry.internal/cloudlet-manager/backend:2.0.0
podman save -o cloudlet-frontend.tar registry.internal/cloudlet-manager/frontend:2.0.0
podman save -o oauth2-proxy.tar registry.internal/oauth2-proxy/oauth2-proxy:v7.7.1
# Transfer tars, then: podman load -i <file>.tar && podman push ...
```

---

## Vault Setup

Three secrets in Vault:

### 1. Git Token

```bash
vault kv put secret/cloudlet-manager/git token="<git-personal-access-token>"
```

### 2. SSO Client Secret

```bash
vault kv put secret/cloudlet-manager/sso client-secret="<keycloak-client-secret>"
```

### 3. OAuth2 Proxy Cookie Secret

```bash
COOKIE=$(python3 -c "import os,base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")
vault kv put secret/cloudlet-manager/oauth-proxy cookie-secret="$COOKIE"
```

### SecretStore

Ensure a `ClusterSecretStore` or `SecretStore` resource exists pointing to your Vault. Update `vault.secretStoreName` and `vault.secretStoreKind` in your values file to match.

---

## RHBK (Keycloak) Setup

Use the provided script:

```bash
export KC_URL="https://keycloak.apps.cluster.example.com"
export KC_ADMIN_USER="admin"
export KC_ADMIN_PASS="<admin-password>"
export REALM="myrealm"
export APP_ROUTE="cloudlet-manager.apps.cluster.example.com"

bash chart/rhbk-setup/setup-rhbk.sh
```

This creates:
- OIDC client `cloudlet-manager` (confidential, PKCE)
- Group `/cloudlet-admins`
- Groups mapper (adds groups to OIDC token)
- Test user `cloudlet-admin` / `admin123`

Save the client secret output into Vault (see above).

See `chart/rhbk-setup/README.md` for details.

---

## Installation

### 1. Create namespace

```bash
oc new-project cloudlet-manager
```

### 2. Prepare your values

```bash
cp chart/override-values.yaml my-values.yaml
# Edit my-values.yaml with your environment's settings
```

### 3. Install

```bash
helm install cloudlet-manager ./chart -f my-values.yaml -n cloudlet-manager
```

### 4. Verify

```bash
oc get externalsecrets -n cloudlet-manager    # Should be "SecretSynced"
oc get pods -n cloudlet-manager               # All Running, frontend 2/2
oc get route cloudlet-manager -n cloudlet-manager
```

---

## Configuration Reference

| Parameter | Description | Default |
|---|---|---|
| `namespace` | Namespace to deploy into | `cloudlet-manager` |
| **Images** | | |
| `backend.image.repository` | Backend image path | `""` (required) |
| `backend.image.tag` | Backend image tag | `2.0.0` |
| `frontend.image.repository` | Frontend image path | `""` (required) |
| `frontend.image.tag` | Frontend image tag | `2.0.0` |
| `oauthProxy.image.repository` | OAuth2 Proxy image path | `""` (required if SSO) |
| `oauthProxy.image.tag` | OAuth2 Proxy image tag | `v7.7.1` |
| `imagePullSecret` | Registry pull secret name | `""` |
| **Git** | | |
| `git.specRepo` | Spec repo (`owner/repo`) | `""` (required) |
| `git.specBranch` | Branch to read/write | `main` |
| `git.apiUrl` | Git server API URL | `""` (required) |
| **SSO** | | |
| `sso.enabled` | Enable OIDC authentication | `true` |
| `sso.keycloakUrl` | RHBK base URL | `""` (required if SSO) |
| `sso.realm` | Keycloak realm | `""` (required if SSO) |
| `sso.clientId` | OIDC client ID | `""` (required if SSO) |
| `sso.allowedGroups` | Groups allowed access | `["/cloudlet-admins"]` |
| `sso.skipTlsVerify` | Skip TLS verify for Keycloak (self-signed certs only) | `false` |
| **Route** | | |
| `route.host` | Route hostname | `""` (required) |
| `route.tls.termination` | TLS termination | `edge` |
| `route.tls.insecureEdgeTerminationPolicy` | Insecure traffic handling | `Redirect` |
| **Vault** | | |
| `vault.enabled` | Use ExternalSecrets with Vault | `true` |
| `vault.secretStoreName` | SecretStore/ClusterSecretStore name | `vault-backend` |
| `vault.secretStoreKind` | `SecretStore` or `ClusterSecretStore` | `ClusterSecretStore` |
| `vault.refreshInterval` | Secret sync interval | `1h` |
| `vault.paths.gitToken` | Vault path for Git PAT | `secret/data/cloudlet-manager/git` |
| `vault.paths.ssoClientSecret` | Vault path for RHBK client secret | `secret/data/cloudlet-manager/sso` |
| `vault.paths.oauthCookieSecret` | Vault path for cookie secret | `secret/data/cloudlet-manager/oauth-proxy` |
| **Misc** | | |
| `corsOrigins` | CORS origins (JSON array) | `["*"]` |
| `branchCacheTtl` | Branch cache TTL (seconds) | `300` |

---

## Without Vault (Manual Secrets)

Set `vault.enabled: false` and create the secrets manually:

```bash
oc create secret generic cloudlet-git-token --from-literal=token="<git-pat>" -n cloudlet-manager
oc create secret generic cloudlet-sso-secret --from-literal=client-secret="<keycloak-secret>" -n cloudlet-manager
oc create secret generic cloudlet-oauth-proxy-secret --from-literal=cookie-secret="<cookie-secret>" -n cloudlet-manager
```

---

## Disabling SSO

Set `sso.enabled: false`. This removes the OAuth2 Proxy sidecar, routes traffic directly to nginx, and the backend accepts all requests without token validation.

---

## Upgrading

```bash
helm upgrade cloudlet-manager ./chart -f my-values.yaml -n cloudlet-manager
```

## Uninstalling

```bash
helm uninstall cloudlet-manager -n cloudlet-manager
```

---

## Troubleshooting

| Issue | Check |
|---|---|
| **ExternalSecrets not syncing** | `oc describe externalsecret <name>` — verify Vault paths and SecretStore |
| **OAuth redirect loop** | Verify redirect URI in RHBK matches `https://<route>/oauth2/callback` |
| **401 after login** | Check backend logs: `oc logs deploy/cloudlet-backend` — verify groups mapper in RHBK |
| **Token expired (401)** | Cookie refresh is set to 3min — clear cookies and re-login |
| **Images not pulling** | Check `imagePullSecret` is set and exists in the namespace |
| **409 conflict on apply** | Backend retries 3 times automatically — if persistent, reduce concurrent edits |
| **Search slow first time** | First search loads files from Git API — subsequent searches use 2min cache |
